import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link, useSearchParams } from 'react-router-dom'
import { Star, MapPin, Search, Sliders, X } from 'lucide-react'
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

// Improved Trainer Card component (Airbnb-inspired)
const TrainerCard: React.FC<{
  t: TrainerWithCategories & { image_url?: string }
  categories: any[]
  isNearest?: boolean
}> = ({ t, categories, isNearest }) => {
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
      <div className="aspect-video bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center relative overflow-hidden">
        {/* Trainer Image or Fallback Avatar */}
        {t.image_url && !imageError ? (
          <>
            <img
              src={t.image_url}
              alt={t.name}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
            />
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                <div className="text-slate-400 text-4xl">👤</div>
              </div>
            )}
          </>
        ) : (
          <div className={`w-full h-full ${getAvatarColor(t.id)} flex items-center justify-center`}>
            <span className="text-white text-2xl font-semibold">{getInitials(t.name)}</span>
          </div>
        )}

        {isNearest && (
          <Badge className="absolute top-3 right-3 bg-green-500 text-white">Nearest</Badge>
        )}
        {!t.available && (
          <Badge className="absolute top-3 left-3 bg-slate-500 text-white">Offline</Badge>
        )}
      </div>
      
      <CardContent className="p-4">
        {/* Trainer Name and Rating */}
        <div className="mb-2">
          <h3 className="font-semibold text-lg text-foreground mb-1">{t.name || 'Trainer'}</h3>
          {t.rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{t.rating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">(12 reviews)</span>
            </div>
          )}
        </div>

        {/* Location and Distance */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <MapPin className="h-3.5 w-3.5" />
          <span>{t.location_label || 'Unknown'}</span>
          {t.distance !== '—' && (
            <span className="ml-auto font-semibold text-foreground">{t.distance}</span>
          )}
        </div>

        {/* Categories/Disciplines */}
        {categoryNames.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {categoryNames.slice(0, 2).map((name, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {name}
              </Badge>
            ))}
            {categoryNames.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{categoryNames.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xl font-semibold">Ksh {t.hourlyRate ?? '—'}</span>
            <span className="text-sm text-muted-foreground">/hour</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Explore page
const Explore: React.FC = () => {
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
          // Fetch categories for each trainer
          const trainersWithCategories = await Promise.all(
            trainersData.data.map(async (trainer: Trainer) => {
              try {
                const categoriesData = await apiService.getTrainerCategories(trainer.user_id)
                const categoryIds = categoriesData?.data?.map((cat: any) => cat.category_id || cat.cat_id) || []
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
                  image_url: trainer.profile_image_url || trainer.image_url || null,
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
                  image_url: trainer.profile_image_url || trainer.image_url || null,
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
      categoryId: filters.categoryId,
      searchQuery: searchQuery,
    }

    const enrichedTrainers = enrichTrainersWithDistance(trainers, userLocation)
    const result = filterTrainers(enrichedTrainers, filterCriteria)
    setFilteredTrainers(result)
  }, [trainers, filters, searchQuery, userLocation])

  const requestLocation = async () => {
    await requestGeoLocation()
  }

  const clearFilters = () => {
    setFilters({})
    setSearchQuery('')
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== null && v !== '') || searchQuery

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header with Search */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <Header />
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800">
          <div className="container max-w-4xl mx-auto">
            {/* Search Bar */}
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
            />

            {/* Quick Action Buttons */}
            <div className="flex gap-2 mt-3">
              <Button
                variant={userLocation ? 'default' : 'outline'}
                size="sm"
                onClick={requestLocation}
                disabled={geoLoading}
                className="flex-1"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {geoLoading ? 'Getting location...' : userLocation ? '📍 Location set' : 'Use my location'}
              </Button>
              <Button
                variant={hasActiveFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(true)}
              >
                <Sliders className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>

            {/* Horizontal Scrollable Categories */}
            {categories.length > 0 && (
              <div className="mt-4 -mx-4 px-4 overflow-x-auto">
                <div className="flex gap-2 pb-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, categoryId: null }))}
                    className={`flex-shrink-0 px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors text-sm ${
                      !filters.categoryId
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFilters(prev => ({ ...prev, categoryId: cat.id }))}
                      className={`flex-shrink-0 px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors text-sm ${
                        filters.categoryId === cat.id
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mt-3">
                {filters.categoryId && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
                    <span className="text-sm">{categories.find(c => c.id === filters.categoryId)?.name || `Category ${filters.categoryId}`}</span>
                    <button onClick={() => setFilters(prev => ({ ...prev, categoryId: null }))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {filters.minRating > 0 && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
                    <span className="text-sm">Rating ≥ {filters.minRating}</span>
                    <button onClick={() => setFilters(prev => ({ ...prev, minRating: null }))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {filters.maxPrice && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
                    <span className="text-sm">Price ≤ Ksh {filters.maxPrice}</span>
                    <button onClick={() => setFilters(prev => ({ ...prev, maxPrice: null }))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {filters.radius && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
                    <span className="text-sm">Within {filters.radius}km</span>
                    <button onClick={() => setFilters(prev => ({ ...prev, radius: null }))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {filters.onlyAvailable && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
                    <span className="text-sm">Available only</span>
                    <button onClick={() => setFilters(prev => ({ ...prev, onlyAvailable: false }))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {searchQuery && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
                    <span className="text-sm">"{searchQuery}"</span>
                    <button onClick={() => setSearchQuery('')} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs"
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
              
              {/* Trainer Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTrainers.map((t, idx) => (
                  <TrainerCard
                    key={t.id}
                    t={t}
                    categories={categories}
                    isNearest={idx === 0 && userLocation && filteredTrainers.length > 0}
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
