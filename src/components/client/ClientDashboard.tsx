import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Search,
  MapPin,
  Star,
  Calendar,
  MessageCircle,
  Gift,
  Home,
  Compass,
  Clock,
  User,
  Users,
  Plus,
  ChevronRight,
  ArrowLeft,
  LogOut,
  DollarSign,
  Bell,
  RefreshCw
} from 'lucide-react'
import { TrainerDetails } from './TrainerDetails'
import { ClientProfileEditor } from './ClientProfileEditor'
import { PaymentMethods } from './PaymentMethods'
import { NotificationsCenter } from './NotificationsCenter'
import { ReportIssue } from './ReportIssue'
import { FiltersModal } from './FiltersModal'
import { ReviewModal } from './ReviewModal'
import { NextSessionModal } from './NextSessionModal'
import { LocationSelector } from './LocationSelector'
import { AnnouncementBanner } from '@/components/shared/AnnouncementBanner'
import { UnratedSessionNotice } from './UnratedSessionNotice'

// Helper functions for formatting trainer data
function parseDisciplines(disciplines: any): string {
  if (!disciplines) return 'Training'
  if (typeof disciplines === 'string') {
    try {
      const parsed = JSON.parse(disciplines)
      if (Array.isArray(parsed)) {
        return parsed.join(', ')
      }
      return String(parsed)
    } catch {
      return String(disciplines).trim()
    }
  }
  if (Array.isArray(disciplines)) {
    return disciplines.join(', ')
  }
  return String(disciplines)
}

function formatHourlyRate(rate: number | null | undefined): string {
  if (rate == null || rate === 0) return '0'
  const num = Number(rate)
  if (!Number.isFinite(num)) return '0'
  if (num % 1 === 0) {
    return num.toLocaleString()
  }
  return num.toFixed(2).replace(/\.?0+$/, '')
}
import { SearchBar } from './SearchBar'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { useSearchHistory } from '@/hooks/use-search-history'
import { useGeolocation } from '@/hooks/use-geolocation'
import * as apiService from '@/lib/api-service'
import { enrichTrainersWithDistance } from '@/lib/distance-utils'
import { apiRequest, withAuth } from '@/lib/api'
import { reverseGeocode } from '@/lib/location'

export const ClientDashboard: React.FC = () => {
  const { user, userType, signOut, loading } = useAuth()
  const { location: geoLocation, requestLocation: requestGeoLocation, loading: geoLoading } = useGeolocation()

  if (loading) return null
  if (!user || userType !== 'client') {
    return <Navigate to="/" replace />
  }
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('home')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<any>({})
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [reverseGeocodeLoading, setReverseGeocodeLoading] = useState(false)
  const [selectedTrainer, setSelectedTrainer] = useState<any | null>(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showPaymentMethods, setShowPaymentMethods] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHelpSupport, setShowHelpSupport] = useState(false)
  const [unreadMessagesClient, setUnreadMessagesClient] = useState(0)
  const [unreadNotificationsClient, setUnreadNotificationsClient] = useState(0)
  const [dbCategories, setDbCategories] = useState<any[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [referralSavings, setReferralSavings] = useState(0)
  const [referralCode, setReferralCode] = useState('REF-' + Math.random().toString(36).slice(2, 8).toUpperCase())
  const [referralCount, setReferralCount] = useState(0)
  const [trainers, setTrainers] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [reviewsByBooking, setReviewsByBooking] = useState<Record<string, any>>({})
  const [reviewBooking, setReviewBooking] = useState<any | null>(null)
  const [nextSessionBooking, setNextSessionBooking] = useState<any | null>(null)

  const { recentSearches, popularSearches, addSearch } = useSearchHistory({ trainers })

  // Sync geolocation hook result to userLocation state
  useEffect(() => {
    if (geoLocation?.lat != null && geoLocation?.lng != null) {
      setUserLocation({ lat: geoLocation.lat, lng: geoLocation.lng })
    }
  }, [geoLocation])

  // Reverse geocode GPS coordinates to get location name
  useEffect(() => {
    if (!userLocation) {
      setLocationName(null)
      return
    }

    const geocode = async () => {
      setReverseGeocodeLoading(true)
      try {
        const result = await reverseGeocode(userLocation.lat, userLocation.lng)
        if (result?.label) {
          setLocationName(result.label)
        }
      } catch (err) {
        console.warn('Failed to reverse geocode location', err)
      } finally {
        setReverseGeocodeLoading(false)
      }
    }

    geocode()
  }, [userLocation])

  // Auto-save GPS location to database
  useEffect(() => {
    if (!user?.id || !userLocation || !locationName) return

    const saveLocation = async () => {
      try {
        const payload = {
          user_id: user.id,
          location: locationName,
          location_label: locationName,
          location_lat: userLocation.lat,
          location_lng: userLocation.lng,
        }
        await apiRequest('profile_update', payload, { headers: withAuth() })
        console.debug('Client location saved to database', { locationName, ...userLocation })
      } catch (err) {
        console.warn('Failed to save location to database', err)
      }
    }

    saveLocation()
  }, [user?.id, userLocation, locationName])

  // Generate suggestions from trainer names
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    return trainers
      .filter(t => (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .map(t => t.name)
      .slice(0, 5)
  }, [searchQuery, trainers])

  const modalOpen = Boolean(selectedTrainer || showEditProfile || showPaymentMethods || showNotifications || showHelpSupport || showFilters || reviewBooking || nextSessionBooking)

  const loadBookings = async () => {
    if (!user?.id) return
    try {
      const bookingsData = await apiService.getBookings(user.id, 'client')
      if (bookingsData?.data) {
        setBookings(bookingsData.data)
      }
    } catch (err) {
      console.warn('Failed to load bookings', err)
      setBookings([])
    }
  }

  const setReviewByBooking = (bookingId: string) => {
    setReviewsByBooking(prev => ({ ...prev, [bookingId]: true }))
  }

  const checkPendingRatings = async () => {
    if (!user?.id) return
    try {
      const notifData = await apiRequest('notifications_get', { user_id: user.id }, { headers: withAuth() })
      const notifs = Array.isArray(notifData) ? notifData : (notifData?.data || [])

      // Find pending rate action notifications
      const pendingRateNotif = notifs.find((n: any) => n.action_type === 'rate' && !n.read && n.booking_id)

      if (pendingRateNotif && bookings.length > 0) {
        // Find the associated booking
        const targetBooking = bookings.find(b => b.id === pendingRateNotif.booking_id)
        if (targetBooking && targetBooking.status === 'completed' && !reviewsByBooking[targetBooking.id] && !targetBooking.rating_submitted) {
          // Auto-open the review modal
          setReviewBooking(targetBooking)
        }
      }
    } catch (err) {
      console.warn('Failed to check pending ratings', err)
    }
  }

  // Check for pending ratings when bookings load
  useEffect(() => {
    if (bookings.length > 0) {
      checkPendingRatings()
    }
  }, [bookings])

  const loadNotifications = async () => {
    if (!user?.id) return
    try {
      const notifData = await apiRequest('notifications_get', { user_id: user.id }, { headers: withAuth() })
      const notifs = Array.isArray(notifData) ? notifData : (notifData?.data || [])
      const unreadCount = notifs.filter((n: any) => !n.read).length
      setUnreadNotificationsClient(unreadCount)
    } catch (err) {
      console.warn('Failed to load notifications', err)
    }
  }

  // Load notifications on mount and poll periodically
  useEffect(() => {
    if (!user?.id) return
    loadNotifications()

    const notificationInterval = setInterval(loadNotifications, 10000) // Poll every 10 seconds
    return () => clearInterval(notificationInterval)
  }, [user?.id])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await apiService.getCategories()
        if (categoriesData?.data) {
          setDbCategories(categoriesData.data)
        }
      } catch (err) {
        console.warn('Failed to load categories', err)
        setDbCategories([])
      } finally {
        setCategoriesLoading(false)
      }
    }

    const loadTrainers = async () => {
      try {
        const trainersData = await apiService.getAvailableTrainers(filters)
        if (trainersData?.data) {
          const trainersWithCategories = await Promise.all(
            trainersData.data.map(async (trainer: any) => {
              let categoryIds: number[] = []
              try {
                const categoriesData = await apiService.getTrainerCategories(trainer.user_id)
                if (categoriesData?.data && Array.isArray(categoriesData.data)) {
                  categoryIds = categoriesData.data.map((cat: any) => cat.category_id || cat.cat_id)
                }
              } catch (err) {
                console.warn('Failed to fetch categories for trainer', trainer.user_id, err)
              }
              return {
                id: trainer.user_id,
                name: trainer.full_name || trainer.user_id,
                discipline: parseDisciplines(trainer.disciplines),
                bio: trainer.bio || '',
                profile_image: trainer.profile_image || null,
                categoryIds: categoryIds,
                rating: Number(trainer.rating) || 0,
                reviews: Number(trainer.total_reviews) || 0,
                hourlyRate: Number(trainer.hourly_rate) || 0,
                available: trainer.is_available !== false,
                distance: '—',
                distanceKm: null,
                service_radius: trainer.service_radius || 10,
                location_lat: trainer.location_lat || null,
                location_lng: trainer.location_lng || null,
                location_label: trainer.location_label || 'Unknown',
                image: trainer.profile_image ? null : '👤',
                availability: Array.isArray(trainer.availability) || typeof trainer.availability === 'object' ? trainer.availability : null,
                hourly_rate_by_radius: Array.isArray(trainer.hourly_rate_by_radius) ? trainer.hourly_rate_by_radius : [],
                pricing_packages: Array.isArray(trainer.pricing_packages) ? trainer.pricing_packages : []
              }
            })
          )
          setTrainers(trainersWithCategories)
        }
      } catch (err) {
        console.warn('Failed to load trainers', err)
        setTrainers([])
      }
    }

    loadCategories()
    loadTrainers()
    loadBookings()
  }, [user?.id, filters])

  const applyFilters = (list: any[]) => {
    return list.filter(t => {
      // Handle category filter from selectedCategory (sidebar) or from filters (modal)
      if (selectedCategory) {
        const selectedCategoryId = dbCategories.find(c => c.name === selectedCategory)?.id
        const match = selectedCategoryId && t.categoryIds && t.categoryIds.includes(selectedCategoryId)
        if (!match) return false
      } else if (filters.categoryId !== null && filters.categoryId !== undefined) {
        // Category filter from modal
        const match = t.categoryIds && t.categoryIds.includes(filters.categoryId)
        if (!match) return false
      }
      if (filters.minRating && (t.rating || 0) < filters.minRating) return false
      if (filters.maxPrice && (t.hourlyRate || 0) > Number(filters.maxPrice)) return false
      if (filters.onlyAvailable && !t.available) return false
      if (filters.radius && (t.distanceKm == null || t.distanceKm > Number(filters.radius))) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const nameMatch = (t.name || '').toLowerCase().includes(query)
        const disciplineMatch = (t.discipline || '').toLowerCase().includes(query)
        if (!nameMatch && !disciplineMatch) return false
      }
      return true
    })
  }

  // Update distances when user location changes
  useEffect(() => {
    if (userLocation && trainers.length > 0) {
      const updatedTrainers = enrichTrainersWithDistance(trainers, userLocation)
      setTrainers(updatedTrainers)
    }
  }, [userLocation])

  const requestLocation = async () => {
    await requestGeoLocation()
  }

  const inviteFriends = () => {
    try { navigator.clipboard.writeText(referralCode) } catch {}
    toast({ title: 'Referral code', description: `Share this code: ${referralCode}` })
  }

  const openTrainer = (trainer: any) => setSelectedTrainer(trainer)
  const closeTrainer = () => setSelectedTrainer(null)

  const handleCategorySelect = (category: string) => {
    if (!userLocation) {
      toast({
        title: 'Location required',
        description: 'Please enable GPS to find trainers near you',
        variant: 'destructive'
      })
      requestLocation()
      return
    }
    setSelectedCategory(category)
    setActiveTab('explore')
  }

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/'
  }

  // -------------------- Render Functions --------------------
  const renderHomeContent = () => {
    if (!userLocation) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-5 w-5 text-red-500" />
            </Button>
          </div>

          <Card className="bg-gradient-primary border-0 text-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">Enable Location</h2>
              <p className="text-white/90">We need your location to find trainers near you and calculate distances accurately.</p>

              {geoLoading ? (
                <div className="space-y-3 pt-2">
                  <p className="text-white font-semibold">Acquiring your location...</p>
                  <Progress value={undefined} className="bg-white/30" />
                  <p className="text-sm text-white/70">Please allow location access and wait for GPS signal</p>
                </div>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={requestLocation}
                    className="bg-white text-trainer-accent hover:bg-gray-100 w-full font-semibold"
                  >
                    Enable GPS Now
                  </Button>
                  <p className="text-sm text-white/70">Your location is only used to show nearby trainers. We never share your data.</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex-1"></div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-5 w-5 text-red-500" />
          </Button>
        </div>
        <AnnouncementBanner userId={user?.id} userType="client" />
        <UnratedSessionNotice
          bookings={bookings}
          onRateClick={(booking) => setReviewBooking(booking)}
          onDismiss={() => loadBookings()}
        />
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Find Your Perfect Trainer</h1>
          <p className="text-muted-foreground">Connect with certified professionals in your area</p>
        </div>
      <SearchBar
        placeholder="Search trainers or services..."
        value={searchQuery}
        onChange={setSearchQuery}
        onSubmit={(query) => {
          if (!userLocation) {
            toast({
              title: 'Location required',
              description: 'Please enable GPS to search for trainers',
              variant: 'destructive'
            })
            requestLocation()
            return
          }
          if (query) {
            addSearch(query)
            setActiveTab('explore')
          }
        }}
        suggestions={suggestions}
        recentSearches={recentSearches}
        popularSearches={popularSearches}
      />

      {userLocation && (
        <Card className="border-0 bg-muted/30">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="bg-trainer-accent/20 rounded-full p-2 flex-shrink-0">
                <MapPin className="h-5 w-5 text-trainer-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Using your location</p>
                {reverseGeocodeLoading ? (
                  <p className="text-xs text-muted-foreground animate-pulse">Loading location details...</p>
                ) : (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {locationName && <p className="truncate">{locationName}</p>}
                    <p className="text-muted-foreground/80">{userLocation.lat.toFixed(4)}°, {userLocation.lng.toFixed(4)}°</p>
                  </div>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={requestGeoLocation}
              disabled={geoLoading}
              className="flex-shrink-0"
              title="Refresh GPS location"
            >
              <RefreshCw className={`h-4 w-4 ${geoLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-gradient-primary border-0 text-white">
        <CardContent className="p-6 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2"><Gift className="h-5 w-5" /><span className="font-semibold">Referral Rewards</span></div>
            <p className="text-sm opacity-90 mb-3">Invite friends and get 10% off your next 5 bookings!</p>
            <Button variant="secondary" size="sm" className="bg-white text-trainer-accent hover:bg-gray-100" onClick={inviteFriends}>Invite Friends</Button>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">Ksh {referralSavings}</div>
            <div className="text-sm opacity-90">Saved so far</div>
            <div className="text-xs opacity-90">Code: {referralCode}</div>
            <div className="text-xs opacity-90">Referrals: {referralCount}</div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Browse Categories</h2>
        <div className="grid grid-cols-1 gap-4">
          {categoriesLoading ? (
            <>
              <Skeleton className="h-20 w-full rounded-xl bg-muted/40" />
              <Skeleton className="h-20 w-full rounded-xl bg-muted/40" />
              <Skeleton className="h-20 w-full rounded-xl bg-muted/40" />
            </>
          ) : dbCategories.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">No categories available.</div>
          ) : (
            dbCategories.map((category) => (
              <Card key={category.id} className="bg-trainer-card border-transparent rounded-xl shadow-card hover:shadow-glow cursor-pointer group" onClick={() => handleCategorySelect(category.name)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-xl text-white shadow-glow">{category.icon}</div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{category.name}</h3>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      </div>
    )
  }

  const renderExploreContent = () => {
    // Filter trainers based on selected category and other criteria
    const filteredTrainers = selectedCategory
      ? trainers.filter(t => {
          const selectedCategoryId = dbCategories.find(c => c.name === selectedCategory)?.id
          const match = selectedCategoryId && t.categoryIds && t.categoryIds.includes(selectedCategoryId)

          if (!match) return false
          if (filters.minRating && (t.rating || 0) < filters.minRating) return false
          if (filters.maxPrice && (t.hourlyRate || 0) > Number(filters.maxPrice)) return false
          if (filters.onlyAvailable && !t.available) return false
          if (filters.radius && (t.distanceKm == null || t.distanceKm > Number(filters.radius))) return false
          if (searchQuery && !((t.name || '').toLowerCase().includes(searchQuery.toLowerCase()))) return false

          return true
        })
      : trainers.filter(t => {
          if (filters.minRating && (t.rating || 0) < filters.minRating) return false
          if (filters.maxPrice && (t.hourlyRate || 0) > Number(filters.maxPrice)) return false
          if (filters.onlyAvailable && !t.available) return false
          if (filters.radius && (t.distanceKm == null || t.distanceKm > Number(filters.radius))) return false
          if (searchQuery && !((t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (t.discipline || '').toLowerCase().includes(searchQuery.toLowerCase()))) return false

          return true
        })

    const nearestTrainerId = filteredTrainers.length > 0 ? filteredTrainers[0].id : null

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className="-ml-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              {selectedCategory ? `${selectedCategory} Trainers` : 'Nearby Trainers'}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(true)}><MapPin className="h-4 w-4 mr-2" />Filters</Button>
        </div>

        {filteredTrainers.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No trainers found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTrainers.map((trainer, idx) => (
              <Card
                key={trainer.id}
                className={`bg-card border-2 transition-all ${idx === 0 && userLocation ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'}`}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                    {trainer.image}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{trainer.name}</h3>
                      {idx === 0 && userLocation && selectedCategory && (
                        <Badge className="bg-green-500 text-white text-xs">Nearest</Badge>
                      )}
                      <Badge variant={trainer.available ? "default" : "secondary"} className="flex-shrink-0">
                        {trainer.available ? 'Available' : 'Busy'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{trainer.discipline || 'Training'}</p>
                    <div className="space-y-1 mb-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{trainer.rating.toFixed(1)} ({trainer.reviews})</span>
                        <MapPin className="h-4 w-4 ml-2" />
                        <span>{trainer.location_label}</span>
                        {trainer.distance !== '—' && <span className="font-semibold text-foreground">{trainer.distance}</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Ksh {formatHourlyRate(trainer.hourlyRate)}/hour</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openTrainer(trainer)}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" className="bg-gradient-primary text-white" onClick={() => openTrainer(trainer)}>
                          Book Now
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderScheduleContent = () => {
    const sortedBookings = [...bookings].sort((a, b) =>
      new Date(b.session_date || 0).getTime() - new Date(a.session_date || 0).getTime()
    )

    const groupedByStatus = {
      pending: sortedBookings.filter(b => b.status === 'pending'),
      confirmed: sortedBookings.filter(b => b.status === 'confirmed'),
      in_session: sortedBookings.filter(b => b.status === 'in_session'),
      completed: sortedBookings.filter(b => b.status === 'completed'),
      cancelled: sortedBookings.filter(b => b.status === 'cancelled'),
    }

    const renderBookingCard = (booking: any, showActions: boolean = true) => (
      <Card key={booking.id} className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{booking.trainer_name || booking.trainer_id || 'Trainer'}</h3>
              <p className="text-sm text-muted-foreground">{booking.notes || 'Session'}</p>
            </div>
            <Badge variant={
              booking.status === 'confirmed' ? 'default' :
              booking.status === 'in_session' ? 'secondary' :
              booking.status === 'completed' ? 'outline' :
              booking.status === 'cancelled' ? 'destructive' :
              'secondary'
            }>
              {booking.status?.replace('_', ' ').charAt(0).toUpperCase() + booking.status?.slice(1).replace('_', ' ') || 'Pending'}
            </Badge>
          </div>

          {booking.is_group_training && (
            <div className="flex gap-2 mb-3">
              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                <Users className="h-3 w-3 mr-1" />
                Group Training
              </Badge>
              {booking.group_size_tier_name && (
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  {booking.group_size_tier_name}
                </Badge>
              )}
              {booking.pricing_model_used && (
                <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800">
                  {booking.pricing_model_used === 'per_person' ? 'Per Person' : 'Fixed Rate'}
                </Badge>
              )}
            </div>
          )}

          <div className="space-y-2 mb-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {booking.session_date ? new Date(booking.session_date).toLocaleDateString() : 'TBD'}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {booking.session_time || 'Time TBD'}
            </div>
            {booking.total_amount && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Ksh {Number(booking.total_amount).toLocaleString()}
              </div>
            )}
          </div>

          {showActions && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => openTrainer({ id: booking.trainer_id })} className="flex-1">
                <MessageCircle className="h-3 w-3 mr-1" />
                Chat
              </Button>
              {booking.status === 'completed' && !reviewsByBooking[booking.id] && (
                <Button size="sm" className="flex-1 bg-gradient-primary text-white" onClick={() => setReviewBooking(booking)}>
                  <Star className="h-3 w-3 mr-1" />
                  Rate
                </Button>
              )}
              {booking.status === 'completed' && (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setNextSessionBooking(booking)}>
                  <Plus className="h-3 w-3 mr-1" />
                  Next
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">My Sessions</h1>
        </div>

        {bookings.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No sessions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Book a session to get started</p>
              <Button className="mt-4" size="sm" onClick={() => setActiveTab('explore')}>Explore Trainers</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedByStatus.confirmed.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Upcoming
                </h2>
                {groupedByStatus.confirmed.map(b => renderBookingCard(b))}
              </div>
            )}

            {groupedByStatus.in_session.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  In Session
                </h2>
                {groupedByStatus.in_session.map(b => renderBookingCard(b, false))}
              </div>
            )}

            {groupedByStatus.completed.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Completed
                </h2>
                {groupedByStatus.completed.map(b => renderBookingCard(b))}
              </div>
            )}

            {groupedByStatus.pending.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-500" />
                  Pending
                </h2>
                {groupedByStatus.pending.map(b => renderBookingCard(b))}
              </div>
            )}

            {groupedByStatus.cancelled.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-red-500" />
                  Cancelled
                </h2>
                {groupedByStatus.cancelled.map(b => renderBookingCard(b, false))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // -------------------- Other renderContent functions (Schedule, Profile) can also be simplified similarly --------------------

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="container max-w-md mx-auto flex justify-end p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(true)}
            className="relative text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
            {unreadNotificationsClient > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground rounded-full text-xs">
                {unreadNotificationsClient > 9 ? '9+' : unreadNotificationsClient}
              </Badge>
            )}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto pb-20 container max-w-md mx-auto p-4">
        {activeTab === 'home' && renderHomeContent()}
        {activeTab === 'explore' && renderExploreContent()}
        {activeTab === 'schedule' && renderScheduleContent()}
      </div>

      {selectedTrainer && <TrainerDetails trainer={selectedTrainer} onClose={closeTrainer} />}
      {showEditProfile && <ClientProfileEditor onClose={() => setShowEditProfile(false)} />}
      {showPaymentMethods && <PaymentMethods onClose={() => setShowPaymentMethods(false)} />}
      {showNotifications && <NotificationsCenter onClose={() => setShowNotifications(false)} />}
      {showHelpSupport && <ReportIssue onDone={() => setShowHelpSupport(false)} />}
      {showFilters && <FiltersModal initial={filters} onApply={(f) => setFilters(f)} onClose={() => setShowFilters(false)} />}
      {reviewBooking && <ReviewModal booking={reviewBooking} onClose={() => setReviewBooking(null)} onSubmitted={async () => {
        setReviewByBooking(reviewBooking.id)
        setReviewBooking(null)
        // Reload bookings from server to get the updated rating_submitted status
        await loadBookings()
      }} />}
      {nextSessionBooking && <NextSessionModal previous={nextSessionBooking} onClose={() => setNextSessionBooking(null)} onBooked={() => { setNextSessionBooking(null); loadBookings() }} />}

      {!modalOpen && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
          <div className="container max-w-md mx-auto flex justify-around py-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'text-primary' : 'text-muted-foreground'}><Home className="h-5 w-5" /><span className="text-xs">Home</span></Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('explore')} className={activeTab === 'explore' ? 'text-primary' : 'text-muted-foreground'}><Compass className="h-5 w-5" /><span className="text-xs">Explore</span></Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('schedule')} className={activeTab === 'schedule' ? 'text-primary' : 'text-muted-foreground'}><Calendar className="h-5 w-5" /><span className="text-xs">Sessions</span></Button>
          </div>
        </div>
      )}
    </div>
  )
}
