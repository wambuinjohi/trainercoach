import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link, useSearchParams } from 'react-router-dom'
import { Star, MapPin, Search, Sliders } from 'lucide-react'
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

// Trainer card component
const TrainerRow: React.FC<{
  t: TrainerWithCategories
  categories: any[]
  isNearest?: boolean
}> = ({ t, categories, isNearest }) => {
  const categoryNames = t.categoryIds
    ? t.categoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean)
    : []

  return (
    <Card
      className={`mb-3 transition-all ${
        isNearest ? 'border-green-500 bg-green-50 dark:bg-green-950/20 border-2' : ''
      }`}
    >
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="font-semibold text-foreground">{t.name || 'Trainer'}</div>
              {isNearest && <Badge className="bg-green-500 text-white text-xs">Nearest</Badge>}
            </div>
            {categoryNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {categoryNames.map((name, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
            <div className="text-sm text-muted-foreground mt-2 flex items-center gap-1 flex-wrap">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{t.location_label || 'Unknown'}</span>
              </div>
              {t.distance !== '—' && (
                <span className="font-semibold text-foreground">{t.distance}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">Ksh {t.hourlyRate ?? '—'}/hr</div>
            {t.rating && (
              <div className="flex items-center gap-1 mt-1 justify-end text-sm">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span>{t.rating}</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              {t.available ? 'Available' : 'Offline'}
            </div>
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

  const { recentSearches, popularSearches, addSearch } = useSearchHistory({ trainers })

  // Sync geolocation hook result to userLocation state
  useEffect(() => {
    if (geoLocation?.lat != null && geoLocation?.lng != null) {
      setUserLocation({ lat: geoLocation.lat, lng: geoLocation.lng })
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
      <Header />
      <div className="p-4">
        <div className="container max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Explore Trainers</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Browse trainers nearby, view profiles, and book sessions. Sign in to see more details and to make bookings.
          </p>

          {/* Search and Filter Section */}
          <div className="space-y-3 mb-6">
            {/* Search Input */}
            <SearchBar
              placeholder="Search trainers or services..."
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

            {/* Location and Filter Buttons */}
            <div className="flex gap-2">
              <Button
                variant={userLocation ? 'default' : 'outline'}
                size="sm"
                onClick={requestLocation}
                disabled={geoLoading}
                className="flex-1"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {geoLoading ? 'Getting location...' : userLocation ? 'Location set' : 'Use my location'}
              </Button>
              <Button
                variant={hasActiveFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(true)}
                className="flex-1"
              >
                <Sliders className="h-4 w-4 mr-2" />
                Filters
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Horizontal Scrollable Categories */}
            {categories.length > 0 && (
              <div className="mt-4">
                <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1 scrollbar-hide">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, categoryId: null }))}
                    className={`flex-shrink-0 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                      !filters.categoryId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFilters(prev => ({ ...prev, categoryId: cat.id }))}
                      className={`flex-shrink-0 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                        filters.categoryId === cat.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                      }`}
                    >
                      {cat.icon && <span className="mr-1">{cat.icon}</span>}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {filters.categoryId && (
                  <Badge variant="secondary">
                    {categories.find(c => c.id === filters.categoryId)?.name || `Category ${filters.categoryId}`}
                  </Badge>
                )}
                {filters.minRating > 0 && (
                  <Badge variant="secondary">Rating ≥ {filters.minRating}</Badge>
                )}
                {filters.maxPrice && (
                  <Badge variant="secondary">Price ≤ Ksh {filters.maxPrice}</Badge>
                )}
                {filters.radius && (
                  <Badge variant="secondary">Within {filters.radius}km</Badge>
                )}
                {filters.onlyAvailable && (
                  <Badge variant="secondary">Available only</Badge>
                )}
                {searchQuery && (
                  <Badge variant="secondary">"{searchQuery}"</Badge>
                )}
              </div>
            )}
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading trainers…</div>
          ) : (
            <div>
              {filteredTrainers.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground mb-2">
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
                  <p className="text-sm text-muted-foreground mb-4">
                    {filteredTrainers.length} trainer{filteredTrainers.length !== 1 ? 's' : ''} found
                  </p>
                  {filteredTrainers.map((t, idx) => (
                    <TrainerRow
                      key={t.id}
                      t={t}
                      categories={categories}
                      isNearest={idx === 0 && userLocation && filteredTrainers.length > 0}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sign In Prompt */}
          <div className="mt-8 mb-4">
            <Link to="/signin">
              <Button className="w-full">Sign in to book a session</Button>
            </Link>
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
