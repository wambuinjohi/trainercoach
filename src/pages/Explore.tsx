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

// Compact Trainer Card component - Matching ClientDashboard.tsx design
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
  const displayCategory = categoryNames[0]

  // Generate a consistent avatar color based on trainer ID
  const getAvatarColor = (id: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-amber-500', 'bg-cyan-500', 'bg-red-500', 'bg-indigo-500']
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  // Format hourly rate
  const formatHourlyRate = (rate: number | null | undefined): string => {
    if (rate == null || rate === 0) return '0'
    const num = Number(rate)
    if (!Number.isFinite(num)) return '0'
    if (num % 1 === 0) {
      return num.toLocaleString()
    }
    return num.toFixed(2).replace(/\.?0+$/, '')
  }

  return (
    <Card className="bg-card border-border hover:border-muted-foreground/50 transition-colors">
      <CardContent className="p-3 md:p-4">
        <div className="flex gap-2 md:gap-4">
          {/* Trainer Image - Left */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-primary flex items-center justify-center text-xl md:text-2xl overflow-hidden">
              {t.image_url && !imageError ? (
                <img
                  src={t.image_url}
                  alt={t.name}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  loading="lazy"
                />
              ) : (
                '👤'
              )}
            </div>
          </div>

          {/* Content - Right */}
          <div className="flex-1 min-w-0 space-y-1 md:space-y-2">
            {/* Name and Category Badge */}
            <div className="flex items-start gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground text-base md:text-lg break-words line-clamp-2">{t.name}</h3>
                <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">{t.discipline || 'Training'}</p>
              </div>
              {displayCategory && (
                <Badge className="bg-blue-600 text-white text-xs flex-shrink-0 whitespace-nowrap">
                  {displayCategory}
                </Badge>
              )}
            </div>

            {/* Rating and Experience */}
            <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm flex-wrap">
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 md:h-4 md:w-4 ${
                        i < Math.floor(t.rating || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-semibold text-foreground text-xs md:text-sm">{t.rating?.toFixed(1) || '0.0'}</span>
                <span className="text-muted-foreground text-xs hidden sm:inline">({t.total_reviews || 0})</span>
              </div>
            </div>

            {/* Price */}
            <div className="text-xs md:text-sm">
              <span className="font-semibold text-foreground">Ksh {formatHourlyRate(t.hourlyRate)}</span>
              <span className="text-muted-foreground">/hr</span>
            </div>

            {/* Distance and Action */}
            <div className="flex items-center pt-1 md:pt-2 gap-2">
              <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground hidden md:flex flex-1">
                <MapPin className="h-3 w-3 md:h-4 md:w-4" />
                <span>{t.location_label}</span>
                {t.distance && t.distance !== '—' && (
                  <span className="font-semibold text-foreground ml-1">{t.distance}</span>
                )}
              </div>
              <div className="flex gap-1 md:gap-2 items-center ml-auto">
                {isNearest && (
                  <Badge className="bg-green-500 text-white text-xs">Nearest</Badge>
                )}
                <Button
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-white text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
                  onClick={onBookNow}
                >
                  Book
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
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

  // Initialize filters and search from URL parameters
  useEffect(() => {
    const categoryParam = searchParams.get('category')
    if (categoryParam) {
      const categoryId = parseInt(categoryParam, 10)
      if (!isNaN(categoryId)) {
        setFilters(prev => ({ ...prev, categoryId }))
      }
    }

    const searchParam = searchParams.get('search')
    if (searchParam) {
      setSearchQuery(decodeURIComponent(searchParam))
    }

    const sortParam = searchParams.get('sort')
    if (sortParam && ['location', 'price', 'availability'].includes(sortParam)) {
      setSortBy(sortParam as 'location' | 'price' | 'availability')
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <Header />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="container max-w-md mx-auto p-4 space-y-3 md:space-y-6">
          {/* Category Filter Pills Bar */}
          {categories.length > 0 && (
            <div className="space-y-2 md:space-y-3">
              <div className="flex overflow-x-auto gap-2 pb-2 -mx-2 px-2 scrollbar-hide">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, categoryIds: [], categoryId: null }))}
                  className={`flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full whitespace-nowrap font-medium transition-colors text-xs md:text-sm ${
                    (!filters.categoryIds || filters.categoryIds.length === 0) && !filters.categoryId
                      ? 'bg-muted text-muted-foreground border'
                      : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilters(prev => ({ ...prev, categoryIds: [cat.id] }))}
                    className={`flex-shrink-0 px-2 md:px-4 py-1.5 md:py-2 rounded-full whitespace-nowrap font-medium transition-colors text-xs md:text-sm ${
                      filters.categoryIds && filters.categoryIds.length === 1 && filters.categoryIds[0] === cat.id
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                    }`}
                  >
                    {cat.icon && <span className="mr-0.5 md:mr-1 text-sm">{cat.icon}</span>}
                    <span className="hidden sm:inline">{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Filter Options Row */}
              <div className="flex flex-wrap gap-2 md:gap-3 px-1">
                <button onClick={requestLocation} className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <MapPin className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Location</span>
                </button>
                <button onClick={() => setShowFilters(true)} className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Sliders className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Filters</span>
                </button>
              </div>
            </div>
          )}

          {/* Heading */}
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-foreground line-clamp-2">
              {filters.categoryIds && filters.categoryIds.length > 0
                ? categories.find(c => c.id === filters.categoryIds[0])?.name + ' Trainers'
                : 'All Trainers'}
            </h2>
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center text-muted-foreground py-12">
              <p>Loading trainers…</p>
            </div>
          ) : filteredTrainers.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No trainers found matching your criteria.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {filteredTrainers.map((t, idx) => (
                <TrainerCard
                  key={t.id}
                  t={t}
                  categories={categories}
                  isNearest={idx === 0 && userLocation && filters.categoryIds && filters.categoryIds.length > 0}
                  onBookNow={handleBookNow}
                />
              ))}
            </div>
          )}

          {/* Sign In Prompt */}
          <div className="mt-6 mb-4">
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <p className="text-foreground font-semibold mb-2">Ready to book?</p>
                <p className="text-sm text-muted-foreground mb-4">Sign in to make bookings</p>
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
