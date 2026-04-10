import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Star, MapPin, Search, Sliders, X,
  Dumbbell, Zap, Activity, Heart, Brain, Flame,
  Wind, Bike, Music, Trophy, Compass, Mountain
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import Header from '@/components/Header'
import { FiltersModal } from '@/components/client/FiltersModal'
import { SearchBar } from '@/components/client/SearchBar'
import { toast } from '@/hooks/use-toast'
import { useSearchHistory } from '@/hooks/use-search-history'
import { useGeolocation } from '@/hooks/use-geolocation'
import * as apiService from '@/lib/api-service'
import {
  enrichTrainersWithDistance,
  filterTrainers,
  type FilterCriteria,
  type TrainerWithCategories,
} from '@/lib/distance-utils'
import { isTrainerAvailableNow } from '@/lib/availability-utils'

// Icon mapping for categories (fallback)
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className: string }>> = {
  'fitness': Dumbbell,
  'yoga': Wind,
  'pilates': Activity,
  'strength': Zap,
  'cardio': Heart,
  'boxing': Trophy,
  'martial arts': Flame,
  'dance': Music,
  'running': Activity,
  'cycling': Bike,
  'swimming': Activity,
  'hiit': Flame,
  'crossfit': Dumbbell,
  'stretching': Wind,
  'meditation': Brain,
  'badminton': Trophy,
  'tennis': Trophy,
  'table tennis': Trophy,
  'basketball': Trophy,
  'soccer': Trophy,
  'volleyball': Trophy,
  'lawn tennis': Trophy,
  'baking': Flame,
  'cooking': Flame,
  'tour guide': Compass,
  'climbing': Mountain,
  'hiking': Mountain,
}

// Helper to render category icon from database or fallback
const renderCategoryIcon = (icon: string | null | undefined, fallbackCategoryName?: string, sizeClass: string = 'h-4 w-4'): React.ReactNode => {
  // If icon exists and looks like emoji/unicode character
  if (icon && icon.length <= 2) {
    return <span className="text-base leading-none flex-shrink-0">{icon}</span>
  }

  // If icon is a lucide icon name, try to map it
  if (icon) {
    const normalized = (icon || '').toLowerCase().trim()
    const IconComponent = CATEGORY_ICONS[normalized]
    if (IconComponent) {
      return <IconComponent className={`${sizeClass} flex-shrink-0`} />
    }
  }

  // Fallback to category name based mapping
  if (fallbackCategoryName) {
    const normalized = (fallbackCategoryName || '').toLowerCase().trim()
    const IconComponent = CATEGORY_ICONS[normalized] || Trophy
    return <IconComponent className={`${sizeClass} flex-shrink-0`} />
  }

  // Default to Trophy icon
  return <Trophy className={`${sizeClass} flex-shrink-0`} />
}

interface Trainer {
  user_id: string
  full_name: string
  hourly_rate: number
  location_label: string
  is_available: boolean
  rating: number
  categoryIds?: number[]
  location_lat?: number
  location_lng?: number
  service_radius?: number
}

// Improved Trainer Card component - List style with image on left
const TrainerCard: React.FC<{
  t: TrainerWithCategories & { image_url?: string }
  categories: any[]
  isNearest?: boolean
  onBookNow?: () => void
}> = ({ t, categories, isNearest, onBookNow }) => {
  const [imageLoaded, setImageLoaded] = React.useState(false)
  const [imageError, setImageError] = React.useState(false)

  const categoryNames = t.categoryIds
    ? t.categoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean)
    : []

  // Generate a consistent avatar color based on trainer ID
  const getAvatarColor = (id: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-amber-500', 'bg-cyan-500', 'bg-red-500', 'bg-indigo-500']
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  // Get initials from trainer name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 border-0 bg-white dark:bg-slate-800">
      <div className="flex flex-col md:flex-row gap-2 md:gap-4 p-3 md:p-5 relative">
        {/* Left: Profile Image - Circular */}
        <div className="flex-shrink-0">
          <div className="relative w-16 h-16 md:w-32 md:h-32 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center mx-auto md:mx-0 flex-shrink-0">
            {/* Trainer Image or Fallback Avatar */}
            {t.image_url && !imageError ? (
              <>
                <img
                  src={t.image_url}
                  alt={t.name}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    console.warn(`Failed to load image for trainer ${t.id}:`, t.image_url)
                    setImageError(true)
                  }}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  loading="lazy"
                />
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                    <div className="text-slate-400 text-4xl">📸</div>
                  </div>
                )}
              </>
            ) : (
              <div className={`w-full h-full ${getAvatarColor(t.id)} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-3xl font-semibold">{getInitials(t.name)}</span>
              </div>
            )}

            {isNearest && (
              <Badge className="absolute bottom-2 right-2 bg-green-500 dark:bg-green-600 text-white text-xs font-semibold">Nearest</Badge>
            )}
          </div>
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex flex-col justify-between">
          {/* Top Section: Badge, Name, Title, Rating */}
          <div>
            {/* Specialty Badge */}
            {categoryNames.length > 0 && (
              <Badge className="mb-1 bg-blue-600 dark:bg-blue-700 text-white text-xs inline-block">
                {categoryNames[0]}
              </Badge>
            )}

            {/* Trainer Name and Title */}
            <h3 className="font-semibold text-sm md:text-lg text-foreground mb-0.5">{t.name || 'Trainer'}</h3>
            <p className="text-xs text-muted-foreground mb-1.5">
              {t.bio ? t.bio.split('\n')[0] : `${categoryNames[0] || 'Training'} Specialist`}
            </p>

            {/* Rating */}
            {t.rating > 0 && (
              <div className="flex items-center gap-1 mb-1.5">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 md:h-3.5 md:w-3.5 ${
                        i < Math.round(t.rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-slate-300 text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs md:text-sm font-medium">{t.rating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({t.total_reviews || 0})</span>
              </div>
            )}
          </div>

          {/* Middle Section: Experience, Availability, Location, Price */}
          <div className="space-y-1 text-xs md:text-sm mt-1.5 md:mt-3">
            {/* Experience */}
            {t.experience_level && (
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0 text-slate-600 dark:text-slate-400" />
                <span className="text-muted-foreground text-xs md:text-sm">{t.experience_level}</span>
              </div>
            )}

            {/* Availability (placeholder - can be enhanced with real data) */}
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0 text-slate-600 dark:text-slate-400" />
              <span className="text-muted-foreground line-clamp-1 text-xs md:text-sm">Available: Mon, Wed, Fri · 08:00am - 4:00pm</span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0 text-slate-600 dark:text-slate-400" />
              <span className="text-muted-foreground text-xs md:text-sm">
                {t.location_label || 'Unknown'}
                {t.distance !== '—' && (
                  <span className="ml-1 md:ml-2 font-semibold text-foreground">{t.distance}</span>
                )}
              </span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-1">
              <span className="text-sm md:text-lg font-semibold text-foreground">Ksh {t.hourlyRate ?? '—'}</span>
              <span className="text-xs text-muted-foreground">per hour</span>
            </div>
          </div>
        </div>

        {/* Right: Action Button - Mobile stacked, Desktop flex */}
        <div className="flex md:flex-col items-center md:items-end justify-between md:justify-between gap-2 mt-1.5 md:mt-0">
          <div className="text-xs text-muted-foreground hidden md:block">{isNearest && 'Nearest'}</div>
          <Button onClick={onBookNow} className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white w-full md:w-auto flex-1 md:flex-none text-sm md:text-base">
            Book Now
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Main Explore page
const Explore: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { location: geoLocation, requestLocation: requestGeoLocation, loading: geoLoading } = useGeolocation()
  const [trainers, setTrainers] = useState<TrainerWithCategories[]>([])
  const [filteredTrainers, setFilteredTrainers] = useState<TrainerWithCategories[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<any>({})
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'location' | 'price' | 'availability'>('location')

  const { recentSearches, popularSearches, addSearch } = useSearchHistory({ trainers })

  // Sync geolocation hook result to userLocation state
  useEffect(() => {
    if (geoLocation?.lat != null && geoLocation?.lng != null) {
      setUserLocation({ lat: geoLocation.lat, lng: geoLocation.lng })
      setLocationName('Current location')
    }
  }, [geoLocation])

  // Initialize filters from URL parameters
  useEffect(() => {
    const categoryParam = searchParams.get('category')
    if (categoryParam) {
      const categoryId = parseInt(categoryParam, 10)
      if (!isNaN(categoryId)) {
        setFilters(prev => ({ ...prev, categoryId }))
      }
    }
  }, [searchParams])

  // Generate suggestions from trainer names
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    return trainers
      .filter(t => (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .map(t => t.name)
      .slice(0, 5)
  }, [searchQuery, trainers])

  // Load categories and trainers
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories first
        const categoriesData = await apiService.getCategories()
        if (categoriesData?.data) {
          setCategories(categoriesData.data)
        }

        // Fetch available trainers
        const trainersData = await apiService.getAvailableTrainers()
        if (trainersData?.data) {
          console.log('[Explore] Fetched trainers:', trainersData.data.map((t: any) => ({
            id: t.user_id,
            name: t.full_name,
            profile_image: t.profile_image,
            image_url: t.image_url,
            profile_image_url: t.profile_image_url
          })))

          // Fetch categories for each trainer
          const trainersWithCategories = await Promise.all(
            trainersData.data.map(async (trainer: Trainer) => {
              try {
                const categoriesData = await apiService.getTrainerCategories(trainer.user_id)
                const categoryIds = categoriesData?.data?.map((cat: any) => cat.category_id || cat.cat_id) || []

                // Populate discipline field with category names for search
                const categoryNames = categoryIds
                  .map(id => categoriesData?.data?.find((cat: any) => (cat.category_id || cat.cat_id) === id)?.name)
                  .filter(Boolean) as string[]
                const discipline = categoryNames.join(', ')

                return {
                  id: trainer.user_id,
                  name: trainer.full_name || 'Trainer',
                  hourlyRate: trainer.hourly_rate || 0,
                  rating: trainer.rating || 0,
                  available: trainer.is_available ?? true,
                  location_label: trainer.location_label || 'Unknown',
                  location_lat: trainer.location_lat || null,
                  location_lng: trainer.location_lng || null,
                  categoryIds,
                  discipline,
                  image_url: trainer.profile_image || trainer.profile_image_url || trainer.image_url || null,
                  bio: trainer.bio || null,
                  experience_level: trainer.experience_level || null,
                  total_reviews: trainer.total_reviews || 0,
                  distance: '—',
                  distanceKm: null,
                }
              } catch (err) {
                console.warn('Failed to fetch categories for trainer', trainer.user_id)
                return {
                  id: trainer.user_id,
                  name: trainer.full_name || 'Trainer',
                  hourlyRate: trainer.hourly_rate || 0,
                  rating: trainer.rating || 0,
                  available: trainer.is_available ?? true,
                  location_label: trainer.location_label || 'Unknown',
                  location_lat: trainer.location_lat || null,
                  location_lng: trainer.location_lng || null,
                  categoryIds: [],
                  discipline: '',
                  image_url: trainer.profile_image || trainer.profile_image_url || trainer.image_url || null,
                  bio: trainer.bio || null,
                  experience_level: trainer.experience_level || null,
                  total_reviews: trainer.total_reviews || 0,
                  distance: '—',
                  distanceKm: null,
                }
              }
            })
          )
          setTrainers(trainersWithCategories)
        }
      } catch (err) {
        console.error('Failed to load explore data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Re-apply filters when trainers, filters, or search query change
  useEffect(() => {
    const filterCriteria: FilterCriteria = {
      minRating: filters.minRating,
      maxPrice: filters.maxPrice,
      onlyAvailable: filters.onlyAvailable,
      radius: filters.radius,
      categoryIds: filters.categoryIds,
      categoryId: filters.categoryId, // Fallback for backward compatibility
      searchQuery: searchQuery,
      userLocationAvailable: userLocation !== null,
    }

    let enrichedTrainers = enrichTrainersWithDistance(trainers, userLocation)
    let result = filterTrainers(enrichedTrainers, filterCriteria)

    // Apply sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'location') {
        // Sort by distance (nearest first)
        const distA = a.distanceKm ?? Infinity
        const distB = b.distanceKm ?? Infinity
        return distA - distB
      } else if (sortBy === 'price') {
        // Sort by price (lowest first)
        return (a.hourlyRate ?? Infinity) - (b.hourlyRate ?? Infinity)
      } else if (sortBy === 'availability') {
        // Sort by availability (available first, then by rating)
        const availA = isTrainerAvailableNow(a) ? 0 : 1
        const availB = isTrainerAvailableNow(b) ? 0 : 1
        if (availA !== availB) return availA - availB
        return (b.rating ?? 0) - (a.rating ?? 0)
      }
      return 0
    })

    setFilteredTrainers(result)
  }, [trainers, filters, searchQuery, userLocation, sortBy])

  const requestLocation = async () => {
    await requestGeoLocation()
  }

  const handleCategorySelect = (categoryName: string) => {
    // Find the category ID from the name
    const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
    if (category) {
      setFilters(prev => ({ ...prev, categoryIds: [category.id] }))
      setSearchQuery('')
    }
  }

  const clearFilters = () => {
    setFilters({})
    setSearchQuery('')
  }

  const handleBookNow = () => {
    // Navigate to signin - user must authenticate to book
    navigate('/signin')
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== null && v !== '') || searchQuery

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 opacity-95" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=400&fit=crop")',
          }}
        />
        <div className="relative container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="text-center space-y-6">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
              Find Your Perfect Trainer
            </h1>
            <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto">
              Browse certified trainers, compare rates, and book sessions that fit your schedule
            </p>
          </div>
        </div>
      </section>

      {/* Sticky Header with Search */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <Header />
        <div className="px-4 py-5 border-t border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-900">
          <div className="container max-w-4xl mx-auto space-y-3">
            {/* Horizontal Scrollable Categories with Icons - NOW ON TOP */}
            {categories.length > 0 && (
              <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 pb-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, categoryIds: [], categoryId: null }))}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-full whitespace-nowrap font-medium transition-all text-sm flex items-center gap-2 ${
                      (!filters.categoryIds || filters.categoryIds.length === 0) && !filters.categoryId
                        ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Compass className="h-4 w-4" />
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFilters(prev => ({ ...prev, categoryIds: [cat.id] }))}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-full whitespace-nowrap font-medium transition-all text-sm flex items-center gap-2 ${
                        filters.categoryIds && filters.categoryIds.length === 1 && filters.categoryIds[0] === cat.id
                          ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 hover:shadow-sm'
                      }`}
                      title={cat.name}
                    >
                      {renderCategoryIcon(cat.icon, cat.name)}
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Bar with Enhanced Styling */}
            <div className="relative">
              <SearchBar
                placeholder="Search trainers or disciplines..."
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={(query) => {
                  if (query) {
                    addSearch(query)
                  }
                }}
                suggestions={suggestions}
                recentSearches={recentSearches}
                popularSearches={popularSearches}
                categories={categories}
                onCategorySelect={handleCategorySelect}
              />
            </div>

            {/* Quick Action Buttons with Better Layout */}
            <div className="flex gap-2">
              <Button
                variant={userLocation ? 'default' : 'outline'}
                size="sm"
                onClick={requestLocation}
                disabled={geoLoading}
                className="flex-1 h-10"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {geoLoading ? 'Getting location...' : userLocation ? 'Location set' : 'Use my location'}
              </Button>
              <Button
                variant={hasActiveFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(true)}
                className="h-10 px-4"
              >
                <Sliders className="h-4 w-4 mr-1.5" />
                Filters
              </Button>
            </div>

            {/* Sort Options */}
            <div className="flex gap-2 items-center mt-4">
              <span className="text-xs font-medium text-muted-foreground uppercase">Sort by:</span>
              <div className="flex gap-2">
                {(['location', 'price', 'availability'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setSortBy(option)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all flex items-center gap-1 capitalize ${
                      sortBy === option
                        ? 'bg-slate-900 dark:bg-slate-700 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {option === 'location' && <MapPin className="h-3.5 w-3.5" />}
                    {option === 'price' && <span>💰</span>}
                    {option === 'availability' && <Activity className="h-3.5 w-3.5" />}
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 items-center">
                {filters.categoryIds && filters.categoryIds.length > 0 ? (
                  filters.categoryIds.map(categoryId => {
                    const cat = categories.find(c => c.id === categoryId)
                    return (
                      <Badge
                        key={categoryId}
                        variant="secondary"
                        className="pl-2.5 pr-1.5 h-7 flex items-center gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 cursor-pointer group"
                        onClick={() => setFilters(prev => ({
                          ...prev,
                          categoryIds: prev.categoryIds?.filter(id => id !== categoryId) || []
                        }))}
                      >
                        <div className="flex items-center">{renderCategoryIcon(cat?.icon, cat?.name, 'h-3.5 w-3.5')}</div>
                        <span className="text-xs font-medium">{cat?.name || `Category`}</span>
                        <X className="h-3 w-3 ml-0.5 group-hover:scale-110 transition-transform" />
                      </Badge>
                    )
                  })
                ) : filters.categoryId ? (
                  <Badge
                    variant="secondary"
                    className="pl-2.5 pr-1.5 h-7 flex items-center gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 cursor-pointer group"
                    onClick={() => setFilters(prev => ({ ...prev, categoryId: null }))}
                  >
                    {(() => {
                      const cat = categories.find(c => c.id === filters.categoryId)
                      return <div className="flex items-center">{renderCategoryIcon(cat?.icon, cat?.name, 'h-3.5 w-3.5')}</div>
                    })()}
                    <span className="text-xs font-medium">{categories.find(c => c.id === filters.categoryId)?.name || `Category`}</span>
                    <X className="h-3 w-3 ml-0.5 group-hover:scale-110 transition-transform" />
                  </Badge>
                ) : null}
                {filters.minRating > 0 && (
                  <Badge
                    variant="secondary"
                    className="pl-2.5 pr-1.5 h-7 flex items-center gap-1 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-950/50 cursor-pointer group"
                    onClick={() => setFilters(prev => ({ ...prev, minRating: null }))}
                  >
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span className="text-xs font-medium">≥ {filters.minRating}</span>
                    <X className="h-3 w-3 ml-0.5 group-hover:scale-110 transition-transform" />
                  </Badge>
                )}
                {filters.maxPrice && (
                  <Badge
                    variant="secondary"
                    className="pl-2.5 pr-1.5 h-7 flex items-center gap-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50 cursor-pointer group"
                    onClick={() => setFilters(prev => ({ ...prev, maxPrice: null }))}
                  >
                    <span className="text-xs font-medium">≤ Ksh {filters.maxPrice}</span>
                    <X className="h-3 w-3 ml-0.5 group-hover:scale-110 transition-transform" />
                  </Badge>
                )}
                {filters.radius && (
                  <Badge
                    variant="secondary"
                    className="pl-2.5 pr-1.5 h-7 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 cursor-pointer group"
                    onClick={() => setFilters(prev => ({ ...prev, radius: null }))}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{filters.radius}km</span>
                    <X className="h-3 w-3 ml-0.5 group-hover:scale-110 transition-transform" />
                  </Badge>
                )}
                {filters.onlyAvailable && (
                  <Badge
                    variant="secondary"
                    className="pl-2.5 pr-1.5 h-7 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 cursor-pointer group"
                    onClick={() => setFilters(prev => ({ ...prev, onlyAvailable: false }))}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Available</span>
                    <X className="h-3 w-3 ml-0.5 group-hover:scale-110 transition-transform" />
                  </Badge>
                )}
                {searchQuery && (
                  <Badge
                    variant="secondary"
                    className="pl-2.5 pr-1.5 h-7 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer group"
                    onClick={() => setSearchQuery('')}
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium truncate max-w-[100px]">"{searchQuery}"</span>
                    <X className="h-3 w-3 ml-0.5 group-hover:scale-110 transition-transform" />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 pb-20">
        <div className="container max-w-4xl mx-auto">
          {/* Location Display */}
          {userLocation && (
            <p className="text-sm text-muted-foreground mb-4">
              Searching near: <span className="font-semibold text-foreground">{locationName || 'Your location'}</span>
            </p>
          )}

          {/* Results */}
          {loading ? (
            <div className="text-center text-muted-foreground py-12">
              <p>Loading trainers…</p>
            </div>
          ) : filteredTrainers.length === 0 ? (
            <Card className="border-0">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-3">
                  {trainers.length === 0
                    ? 'No trainers found. Try again later.'
                    : 'No trainers match your criteria. Try adjusting your filters.'}
                </p>
                {trainers.length > 0 && hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-6 font-medium">
                {filteredTrainers.length} trainer{filteredTrainers.length !== 1 ? 's' : ''} available
              </p>

              {/* Trainer List */}
              <div className="space-y-4">
                {filteredTrainers.map((t, idx) => (
                  <TrainerCard
                    key={t.id}
                    t={t}
                    categories={categories}
                    isNearest={idx === 0 && userLocation && filteredTrainers.length > 0}
                    onBookNow={handleBookNow}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sign In Prompt */}
          <div className="mt-12 mb-4">
            <Card className="bg-slate-50 dark:bg-slate-900 border-0">
              <CardContent className="p-6 text-center">
                <p className="text-foreground font-semibold mb-3">Ready to book your training session?</p>
                <p className="text-sm text-muted-foreground mb-4">Sign in to view more details and make bookings</p>
                <Link to="/signin">
                  <Button className="w-full">Sign in to book</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Filters Modal */}
      {showFilters && (
        <FiltersModal
          initial={filters}
          onApply={(f) => setFilters(f)}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  )
}

export default Explore
