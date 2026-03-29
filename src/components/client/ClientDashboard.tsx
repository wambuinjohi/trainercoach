import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
  RefreshCw,
  Sliders,
  Repeat2,
  Send,
  AlertCircle
} from 'lucide-react'
import { TrainerDetails } from './TrainerDetails'
import { BookingModal } from './BookingModal'
import { ClientProfileEditor } from './ClientProfileEditor'
import { PaymentMethods } from './PaymentMethods'
import { NotificationsCenter } from './NotificationsCenter'
import { ReportIssue } from './ReportIssue'
import { FiltersModal } from './FiltersModal'
import { ReviewModal } from './ReviewModal'
import { NextSessionModal } from './NextSessionModal'
import { LocationSelector } from './LocationSelector'
import { LocationChoiceModal } from './LocationChoiceModal'
import { SessionEndConfirmModal } from './SessionEndConfirmModal'
import { SessionStartConfirmModal } from './SessionStartConfirmModal'
import { CancelBookingModal } from './CancelBookingModal'
import { RescheduleBookingModal } from './RescheduleBookingModal'
import { RefundRequestModal } from './RefundRequestModal'
import { ChangeTrainerModal } from './ChangeTrainerModal'
import { TransferBookingModal } from './TransferBookingModal'
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
import { filterTrainersByServiceRadius } from '@/lib/location-utils'
import { apiRequest, withAuth } from '@/lib/api'
import { reverseGeocode } from '@/lib/location'

export const ClientDashboard: React.FC = () => {
  const { user, userType, signOut, loading } = useAuth()
  const { location: geoLocation, requestLocation: requestGeoLocation, loading: geoLoading } = useGeolocation()

  // State declarations
  const [trainers, setTrainers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'schedule'>('home')
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null)
  const [selectedTrainerForBooking, setSelectedTrainerForBooking] = useState<any>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [bookings, setBookings] = useState<any[]>([])
  const [reviewsByBooking, setReviewsByBooking] = useState<Record<string, boolean>>({})
  const [reviewBooking, setReviewBooking] = useState<any>(null)
  const [unreadNotificationsClient, setUnreadNotificationsClient] = useState(0)
  const [dbCategories, setDbCategories] = useState<any[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [filters, setFilters] = useState<any>({
    minRating: null,
    maxPrice: null,
    onlyAvailable: false,
    radius: null,
    categoryId: null,
    availabilityDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    availabilityStartTime: '06:00',
    availabilityEndTime: '20:00'
  })
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showPaymentMethods, setShowPaymentMethods] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHelpSupport, setShowHelpSupport] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [nextSessionBooking, setNextSessionBooking] = useState<any>(null)
  const [pendingSessionConfirm, setPendingSessionConfirm] = useState<any>(null)
  const [pendingSessionStart, setPendingSessionStart] = useState<any>(null)
  const [clientProfile, setClientProfile] = useState<any>(null)
  const [cancellingBooking, setCancellingBooking] = useState<any>(null)
  const [reschedulingBooking, setReschedulingBooking] = useState<any>(null)
  const [selectedLocationMode, setSelectedLocationMode] = useState<'home' | 'current' | null>(null)
  const [showLocationChoice, setShowLocationChoice] = useState(false)
  const [requestingRefund, setRequestingRefund] = useState<any>(null)
  const [changingTrainer, setChangingTrainer] = useState<any>(null)
  const [transferringBooking, setTransferringBooking] = useState<any>(null)

  // Ref to track if trainers have been enriched with the current location to avoid infinite loops
  const lastEnrichedLocation = useRef<{ lat: number; lng: number } | null>(null)

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
      try {
        const result = await reverseGeocode(userLocation.lat, userLocation.lng)
        if (result?.label) {
          setLocationName(result.label)
        }
      } catch (err) {
        console.warn('Failed to reverse geocode location', err)
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

  const getClientFlowState = (bookingList: any[]) => ({
    pendingStart: bookingList.find((booking: any) => booking.status === 'in_session' && booking.trainer_marked_start && !booking.client_confirmed_start) || null,
    pendingCompletion: bookingList.find((booking: any) => booking.status === 'in_session' && (booking.session_phase === 'awaiting_completion' || booking.trainer_marked_end)) || null,
  })

  // Define helper functions (must be before hooks that use them)
  const loadBookings = useCallback(async () => {
    if (!user?.id) return
    try {
      const bookingsData = await apiService.getBookings(user.id, 'client')
      const bookingList = Array.isArray(bookingsData)
        ? bookingsData
        : (Array.isArray(bookingsData?.data) ? bookingsData.data : [])

      setBookings(bookingList)

      const flowState = getClientFlowState(bookingList)
      setPendingSessionStart(flowState.pendingStart)
      setPendingSessionConfirm(flowState.pendingCompletion)
    } catch (err) {
      console.warn('Failed to load bookings', err)
      setBookings([])
      setPendingSessionStart(null)
      setPendingSessionConfirm(null)
    }
  }, [user?.id])

  const loadClientProfile = useCallback(async () => {
    if (!user?.id) return
    try {
      const profileData = await apiRequest('profile_get', { user_id: user.id }, { headers: withAuth() })
      if (profileData) {
        setClientProfile(profileData)
      }
    } catch (err) {
      console.warn('Failed to load client profile', err)
    }
  }, [user?.id])

  const checkPendingRatings = useCallback(async () => {
    if (!user?.id) return
    try {
      const notifData = await apiRequest('notifications_get', { user_id: user.id }, { headers: withAuth() })
      const notifs = Array.isArray(notifData) ? notifData : (notifData?.data || [])

      // Find pending rating notifications (Feature #19)
      const pendingRateNotif = notifs.find((n: any) =>
        (n.action_type === 'rate' || n.action_type === 'review_requested') && !n.read && n.booking_id
      )

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
  }, [user?.id, bookings, reviewsByBooking])

  // Check for pending ratings when bookings load
  useEffect(() => {
    if (bookings.length > 0) {
      checkPendingRatings()
    }
  }, [bookings, checkPendingRatings])

  // Load notifications on mount and poll periodically
  useEffect(() => {
    if (!user?.id) return

    const loadNotifications = async () => {
      try {
        const notifData = await apiRequest('notifications_get', { user_id: user.id }, { headers: withAuth() })
        const notifs = Array.isArray(notifData) ? notifData : (notifData?.data || [])
        const unreadCount = notifs.filter((n: any) => !n.read).length
        setUnreadNotificationsClient(unreadCount)
      } catch (err) {
        console.warn('Failed to load notifications', err)
      }
    }

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
              let categoryPricing: any[] = []
              try {
                const categoriesData = await apiService.getTrainerCategories(trainer.user_id)
                if (categoriesData?.data && Array.isArray(categoriesData.data)) {
                  categoryIds = categoriesData.data.map((cat: any) => cat.category_id || cat.cat_id)
                }
              } catch (err) {
                console.warn('Failed to fetch categories for trainer', trainer.user_id, err)
              }

              try {
                const pricingData = await apiService.getTrainerCategoryPricing(trainer.user_id)
                if (pricingData?.data && Array.isArray(pricingData.data)) {
                  categoryPricing = pricingData.data
                }
              } catch (err) {
                console.warn('Failed to fetch category pricing for trainer', trainer.user_id, err)
              }

              return {
                id: trainer.user_id,
                name: trainer.full_name || trainer.user_id,
                discipline: parseDisciplines(trainer.disciplines),
                bio: trainer.bio || '',
                profile_image: trainer.profile_image || null,
                categoryIds: categoryIds,
                categoryPricing: categoryPricing,
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
                availability: Array.isArray(trainer.availability) || typeof trainer.availability === 'object' ? trainer.availability : null,
                hourly_rate_by_radius: Array.isArray(trainer.hourly_rate_by_radius) ? trainer.hourly_rate_by_radius : [],
                pricing_packages: Array.isArray(trainer.pricing_packages) ? trainer.pricing_packages : []
              }
            })
          )
          console.debug('[Explore] Trainers loaded', {
            totalLoaded: trainersWithCategories.length,
            trainers: trainersWithCategories.map(t => ({id: t.id, name: t.name, categoryIds: t.categoryIds, profile_image: t.profile_image ? 'set' : 'missing'}))
          })
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
    loadClientProfile()
  }, [user?.id, filters, loadBookings, loadClientProfile])

  // Update distances when user location changes and filter by service radius
  useEffect(() => {
    if (!userLocation || trainers.length === 0) return

    // Check if we've already enriched trainers for this location to avoid redundant processing
    const locationChanged = !lastEnrichedLocation.current ||
      lastEnrichedLocation.current.lat !== userLocation.lat ||
      lastEnrichedLocation.current.lng !== userLocation.lng

    if (!locationChanged) return

    // First enrich with distance
    const enrichedTrainers = enrichTrainersWithDistance(trainers, userLocation)

    // Then filter by service radius - only show trainers within their service area
    const filteredTrainers = enrichedTrainers.filter(trainer => {
      if (!trainer.location_lat || !trainer.location_lng || !trainer.service_radius) {
        console.debug(`[Distance] Trainer ${trainer.name}: missing location/radius info, included by default`, {trainerId: trainer.id})
        return true // Include trainers without location/radius info
      }

      // Check if user is within trainer's service radius
      const distance = trainer.distanceKm
      if (distance === null) {
        console.debug(`[Distance] Trainer ${trainer.name}: distance can't be calculated, included by default`, {trainerId: trainer.id})
        return true // Include if distance can't be calculated
      }

      const included = distance <= trainer.service_radius
      if (!included) {
        console.debug(`[Distance] Trainer ${trainer.name} filtered: distance ${distance.toFixed(2)}km > service_radius ${trainer.service_radius}km`, {trainerId: trainer.id})
      }
      return included
    })

    console.debug('[Distance] Service radius filtering summary', {
      totalEnriched: enrichedTrainers.length,
      afterRadiusFilter: filteredTrainers.length,
      userLocation
    })

    // Update trainers with enriched distances
    setTrainers(filteredTrainers)
    lastEnrichedLocation.current = userLocation
  }, [userLocation, trainers])

  // Handle location choice when entering explore tab
  useEffect(() => {
    if (activeTab === 'explore' && !selectedLocationMode) {
      setShowLocationChoice(true)
    } else if (activeTab !== 'explore') {
      // Close the modal and reset location mode when navigating away from explore tab
      // This prevents the modal from appearing on the home/schedule tabs
      setShowLocationChoice(false)
      setSelectedLocationMode(null)
    }
  }, [activeTab])

  // Handle location selection - resolve the location and close modal
  useEffect(() => {
    if (selectedLocationMode && showLocationChoice) {
      setShowLocationChoice(false)

      // Set userLocation based on selected mode
      if (selectedLocationMode === 'home' && clientProfile?.location_lat && clientProfile?.location_lng) {
        setUserLocation({ lat: clientProfile.location_lat, lng: clientProfile.location_lng })
      } else if (selectedLocationMode === 'current' && geoLocation?.lat != null && geoLocation?.lng != null) {
        setUserLocation({ lat: geoLocation.lat, lng: geoLocation.lng })
      }
    }
  }, [selectedLocationMode, showLocationChoice, clientProfile, geoLocation])

  // Early returns must be after all hooks
  if (loading) return null
  if (!user || userType !== 'client') {
    return <Navigate to="/" replace />
  }

  const modalOpen = Boolean(selectedTrainer || selectedTrainerForBooking || showEditProfile || showPaymentMethods || showNotifications || showHelpSupport || showFilters || reviewBooking || nextSessionBooking || showLocationChoice)

  const setReviewByBooking = (bookingId: string) => {
    setReviewsByBooking(prev => ({ ...prev, [bookingId]: true }))
  }

  const requestLocation = async () => {
    await requestGeoLocation()
  }

  // Helper function to format trainer availability for display
  const getAvailabilitySummary = (trainer: any) => {
    if (!trainer.availability) return null

    let availability: any = trainer.availability

    // Parse availability if it's a string (JSON)
    if (typeof availability === 'string') {
      try {
        availability = JSON.parse(availability)
      } catch {
        return null
      }
    }

    if (!availability || typeof availability !== 'object') return null

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const workingDays = days.filter(day => availability[day] && Array.isArray(availability[day]) && availability[day].length > 0)

    if (workingDays.length === 0) return null

    // Get first and last working day for summary
    const firstWorkingDay = workingDays[0].charAt(0).toUpperCase() + workingDays[0].slice(1)
    const lastWorkingDay = workingDays[workingDays.length - 1].charAt(0).toUpperCase() + workingDays[workingDays.length - 1].slice(1)

    // Get time range from first slot
    const firstSlot = availability[workingDays[0]][0]
    if (!firstSlot) return `Available: ${firstWorkingDay} - ${lastWorkingDay}`

    const [startTime] = firstSlot.split('-')
    const lastSlot = availability[workingDays[workingDays.length - 1]][availability[workingDays[workingDays.length - 1]].length - 1]
    const [, endTime] = lastSlot.split('-')

    if (startTime && endTime) {
      return `Available: ${startTime} - ${endTime}`
    }

    return `Available: ${firstWorkingDay} - ${lastWorkingDay}`
  }

  // Helper function to check if trainer has availability on selected days and times
  const trainerHasAvailability = (trainer: any) => {
    if (!trainer.availability) return true // If no availability data, don't filter

    let availability: any = trainer.availability

    // Parse availability if it's a string (JSON)
    if (typeof availability === 'string') {
      try {
        availability = JSON.parse(availability)
      } catch {
        return true // If we can't parse, don't filter
      }
    }

    if (!availability || typeof availability !== 'object') return true

    const selectedDays = filters.availabilityDays || []
    const filterStartTime = filters.availabilityStartTime || '06:00'
    const filterEndTime = filters.availabilityEndTime || '20:00'

    // Check if trainer has any slots on selected days that overlap with filter time range
    for (const day of selectedDays) {
      const dayLower = day.toLowerCase()
      const slots = availability[dayLower]

      if (!Array.isArray(slots) || slots.length === 0) continue

      // Check if any slot overlaps with the requested time range
      for (const slot of slots) {
        if (typeof slot !== 'string') continue

        const [slotStart, slotEnd] = slot.split('-')
        if (!slotStart || !slotEnd) continue

        // Simple time overlap check: slot.start < filter.end AND slot.end > filter.start
        if (slotStart < filterEndTime && slotEnd > filterStartTime) {
          return true // Found overlapping slot
        }
      }
    }

    return false // No overlapping availability found
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

        {clientProfile && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
                  {clientProfile.profile_image ? (
                    <img src={clientProfile.profile_image} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-foreground">{clientProfile.full_name || 'Your Profile'}</h2>
                  {clientProfile.phone_number && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      📱 {clientProfile.phone_number}
                    </p>
                  )}
                  {clientProfile.location_label && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      📍 {clientProfile.location_label}
                    </p>
                  )}
                  {clientProfile.bio && (
                    <p className="text-sm text-foreground mt-2">{clientProfile.bio}</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowEditProfile(true)}
                    className="mt-3"
                  >
                    Edit Profile
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Find Your Perfect Trainer</h1>
          <p className="text-muted-foreground">Connect with certified professionals in your area</p>
        </div>
      <SearchBar
        placeholder="Search trainers or categories..."
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
        categories={dbCategories}
        onCategorySelect={handleCategorySelect}
      />



      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Browse Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categoriesLoading ? (
            <>
              <Skeleton className="h-24 w-full rounded-lg bg-muted/40" />
              <Skeleton className="h-24 w-full rounded-lg bg-muted/40" />
              <Skeleton className="h-24 w-full rounded-lg bg-muted/40" />
            </>
          ) : dbCategories.length === 0 ? (
            <div className="col-span-2 sm:col-span-2 lg:col-span-3 text-center text-sm text-muted-foreground py-8">No categories available.</div>
          ) : (
            dbCategories.map((category) => (
              <Card key={category.id} className="bg-trainer-card border-transparent rounded-lg shadow-sm hover:shadow-md hover:border-primary/20 cursor-pointer group transition-all duration-200" onClick={() => handleCategorySelect(category.name)}>
                <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full gap-2">
                  <div className="w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center text-2xl text-white shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">{category.icon}</div>
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">{category.name}</h3>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      </div>
    )
  }

  // Helper function to get category names from trainer's categoryIds
  const getCategoryNamesForTrainer = (categoryIds: number[] | undefined) => {
    if (!categoryIds || categoryIds.length === 0) return []
    return categoryIds
      .map(id => dbCategories.find(c => c.id === id))
      .filter((c): c is any => c !== undefined)
  }

  // Helper function to render category icon
  const getCategoryIcon = (category: any): string => {
    if (!category) return '🏆'
    if (category.icon && category.icon.length <= 2) {
      return category.icon
    }
    // Fallback icons based on category name
    const iconMap: Record<string, string> = {
      'badminton': '🏸',
      'tennis': '🎾',
      'table tennis': '🏓',
      'basketball': '🏀',
      'volleyball': '🏐',
      'soccer': '⚽',
      'fitness': '💪',
      'yoga': '🧘',
      'pilates': '🤸',
      'running': '🏃',
      'cycling': '🚴',
      'swimming': '🏊',
      'boxing': '🥊',
      'martial arts': '🥋',
      'dance': '💃',
      'baking': '🍰',
      'cooking': '👨‍🍳',
      'climbing': '🧗',
      'hiking': '⛰️'
    }
    return iconMap[(category.name || '').toLowerCase()] || '🏆'
  }

  const renderExploreContent = () => {
    // Filter trainers based on selected category, search query, and other criteria
    const filteredTrainers = selectedCategory
      ? trainers.filter(t => {
          const selectedCategoryId = dbCategories.find(c => c.name === selectedCategory)?.id
          const match = selectedCategoryId && t.categoryIds && t.categoryIds.includes(selectedCategoryId)

          if (!match) {
            console.debug(`[Filter] Trainer ${t.name} filtered: category "${selectedCategory}" not in trainer's categories`, {trainerId: t.id, categoryIds: t.categoryIds})
            return false
          }
          if (filters.minRating && (t.rating || 0) < filters.minRating) {
            console.debug(`[Filter] Trainer ${t.name} filtered: rating ${t.rating} < minRating ${filters.minRating}`, {trainerId: t.id})
            return false
          }
          if (filters.maxPrice && (t.hourlyRate || 0) > Number(filters.maxPrice)) {
            console.debug(`[Filter] Trainer ${t.name} filtered: hourlyRate ${t.hourlyRate} > maxPrice ${filters.maxPrice}`, {trainerId: t.id})
            return false
          }
          if (filters.onlyAvailable && !t.available) {
            console.debug(`[Filter] Trainer ${t.name} filtered: onlyAvailable=true but trainer.available=false`, {trainerId: t.id})
            return false
          }
          if (filters.radius && (t.distanceKm == null || t.distanceKm > Number(filters.radius))) {
            console.debug(`[Filter] Trainer ${t.name} filtered: distanceKm ${t.distanceKm} > radius ${filters.radius}`, {trainerId: t.id})
            return false
          }
          if (!trainerHasAvailability(t)) {
            console.debug(`[Filter] Trainer ${t.name} filtered: no matching availability for selected days/times`, {trainerId: t.id})
            return false
          }
          if (searchQuery && !((t.name || '').toLowerCase().includes(searchQuery.toLowerCase()))) {
            console.debug(`[Filter] Trainer ${t.name} filtered: search query "${searchQuery}" doesn't match name`, {trainerId: t.id})
            return false
          }

          return true
        })
      : trainers.filter(t => {
          if (filters.minRating && (t.rating || 0) < filters.minRating) {
            console.debug(`[Filter] Trainer ${t.name} filtered: rating ${t.rating} < minRating ${filters.minRating}`, {trainerId: t.id})
            return false
          }
          if (filters.maxPrice && (t.hourlyRate || 0) > Number(filters.maxPrice)) {
            console.debug(`[Filter] Trainer ${t.name} filtered: hourlyRate ${t.hourlyRate} > maxPrice ${filters.maxPrice}`, {trainerId: t.id})
            return false
          }
          if (filters.onlyAvailable && !t.available) {
            console.debug(`[Filter] Trainer ${t.name} filtered: onlyAvailable=true but trainer.available=false`, {trainerId: t.id})
            return false
          }
          if (filters.radius && (t.distanceKm == null || t.distanceKm > Number(filters.radius))) {
            console.debug(`[Filter] Trainer ${t.name} filtered: distanceKm ${t.distanceKm} > radius ${filters.radius}`, {trainerId: t.id})
            return false
          }
          if (!trainerHasAvailability(t)) {
            console.debug(`[Filter] Trainer ${t.name} filtered: no matching availability for selected days/times`, {trainerId: t.id})
            return false
          }

          // Enhanced search: check trainer name, discipline, AND category names
          if (searchQuery) {
            const searchLower = searchQuery.toLowerCase()
            const matchesName = (t.name || '').toLowerCase().includes(searchLower)
            const matchesDiscipline = (t.discipline || '').toLowerCase().includes(searchLower)
            const categoryNames = getCategoryNamesForTrainer(t.categoryIds)
            const matchesCategory = categoryNames.some(c => (c.name || '').toLowerCase().includes(searchLower))

            if (!matchesName && !matchesDiscipline && !matchesCategory) {
              console.debug(`[Filter] Trainer ${t.name} filtered: search query "${searchQuery}" doesn't match name, discipline, or categories`, {trainerId: t.id})
              return false
            }
          }

          return true
        })

    console.debug('[Explore] Trainer filtering summary', {
      totalTrainers: trainers.length,
      filteredTrainers: filteredTrainers.length,
      selectedCategory,
      filters,
      searchQuery
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
          <Button variant="outline" size="sm" onClick={() => setShowFilters(true)}><Sliders className="h-4 w-4 mr-2" />Filters</Button>
        </div>

        {/* Location Display and Change Button */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-700 dark:text-blue-300">
              {selectedLocationMode === 'home' ? '🏠 Using Home' : '📍 Using Current'}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedLocationMode(null)} className="h-auto py-1 px-2 text-xs">
            Change
          </Button>
        </div>

        {/* Horizontal Scrollable Categories */}
        {dbCategories.length > 0 && (
          <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                !selectedCategory
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
              }`}
            >
              All
            </button>
            {dbCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex-shrink-0 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === cat.name
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                }`}
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {filteredTrainers.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No trainers found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTrainers.map((trainer, idx) => {
              const trainerCategories = getCategoryNamesForTrainer(trainer.categoryIds)
              const displayCategories = trainerCategories.slice(0, 2)
              const remainingCategoriesCount = trainerCategories.length - displayCategories.length

              return (
              <Card
                key={trainer.id}
                className={`bg-card border-2 transition-all ${idx === 0 && userLocation ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'}`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header with name, badges */}
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                      {trainer.profile_image ? (
                        <img src={trainer.profile_image} alt={trainer.name} className="w-full h-full object-cover" />
                      ) : (
                        '👤'
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-foreground">{trainer.name}</h3>
                        {idx === 0 && userLocation && selectedCategory && (
                          <Badge className="bg-green-500 text-white text-xs">Nearest</Badge>
                        )}
                        <Badge variant={trainer.available ? "default" : "secondary"} className="flex-shrink-0">
                          {trainer.available ? 'Available' : 'Busy'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{trainer.discipline || 'Training'}</p>
                      {trainer.bio && (
                        <p className="text-xs text-muted-foreground mt-1">{trainer.bio}</p>
                      )}
                    </div>
                  </div>

                  {/* Service Categories */}
                  {trainerCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {displayCategories.map((category, catIdx) => (
                        <Badge key={catIdx} variant="outline" className="bg-muted/50">
                          {getCategoryIcon(category)} <span className="ml-1">{category.name}</span>
                        </Badge>
                      ))}
                      {remainingCategoriesCount > 0 && (
                        <Badge variant="outline" className="bg-muted/50 text-xs">
                          +{remainingCategoriesCount} more
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Rating, Location, Distance */}
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{trainer.rating.toFixed(1)} ({trainer.reviews})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{trainer.location_label}</span>
                      </div>
                      {trainer.distance !== '—' && (
                        <span className="font-semibold text-foreground">{trainer.distance}</span>
                      )}
                    </div>
                  </div>

                  {/* Pricing and Availability Info */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                    <div className="flex flex-wrap gap-2">
                      {trainer.categoryPricing && trainer.categoryPricing.length > 0 ? (
                        trainer.categoryPricing.map((pricing: any, idx: number) => {
                          const categoryName = dbCategories.find((cat: any) => cat.id === pricing.category_id)?.name || `Category ${pricing.category_id}`
                          const isSelectedCategory = selectedCategory === categoryName
                          return (
                            <span key={idx} className={isSelectedCategory ? 'font-bold text-foreground text-sm' : 'text-muted-foreground text-sm'}>
                              {categoryName}: <span className="font-semibold">Ksh {formatHourlyRate(pricing.hourly_rate)}</span>
                            </span>
                          )
                        })
                      ) : (
                        <span className="font-semibold text-foreground text-sm">Ksh {formatHourlyRate(trainer.hourlyRate)}/hour</span>
                      )}
                    </div>
                    {trainer.pricing_packages && trainer.pricing_packages.length > 0 && (
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs w-fit">
                        📦 Packages
                      </Badge>
                    )}
                    {getAvailabilitySummary(trainer) && (
                      <div className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2 py-1 w-fit">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {getAvailabilitySummary(trainer)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button size="sm" className="bg-gradient-primary text-white" onClick={() => setSelectedTrainerForBooking(trainer)}>
                      Book Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )})}
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
      in_session: sortedBookings.filter(b => b.status === 'in_session' && b.session_phase !== 'awaiting_completion'),
      awaiting_completion: sortedBookings.filter(b => b.status === 'in_session' && b.session_phase === 'awaiting_completion'),
      completed: sortedBookings.filter(b => b.status === 'completed'),
      cancelled: sortedBookings.filter(b => b.status === 'cancelled'),
    }

    const renderBookingCard = (booking: any, showActions: boolean = true) => {
      const bookingSessions = (() => {
        const sessionsValue = booking?.sessions
        if (Array.isArray(sessionsValue)) return sessionsValue
        if (typeof sessionsValue === 'string' && sessionsValue.trim()) {
          try {
            const parsed = JSON.parse(sessionsValue)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        }
        return []
      })()
      const primarySession = bookingSessions[0]
      return (
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
              {booking.status === 'in_session' && booking.session_phase === 'awaiting_completion'
                ? 'Awaiting completion'
                : booking.status?.replace('_', ' ').charAt(0).toUpperCase() + booking.status?.slice(1).replace('_', ' ') || 'Pending'}
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
              {(booking.session_date ? new Date(booking.session_date).toLocaleDateString() : null) || (primarySession?.date ? new Date(primarySession.date).toLocaleDateString() : 'TBD')}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {(booking.session_time || primarySession?.start_time) || 'Time TBD'}
            </div>
            {bookingSessions.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {bookingSessions.length === 1
                  ? `Single session on ${primarySession?.date || booking.session_date}`
                  : `${bookingSessions.length} sessions total • first on ${primarySession?.date || booking.session_date}`}
              </div>
            )}
            {booking.total_amount && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Ksh {Number(booking.total_amount).toLocaleString()}
              </div>
            )}
          </div>

          {showActions && (
            <div className="space-y-2">
              {booking.status === 'completed' && (
                <div className="flex gap-2">
                  {!reviewsByBooking[booking.id] && (
                    <Button size="sm" className="flex-1 bg-gradient-primary text-white" onClick={() => setReviewBooking(booking)}>
                      <Star className="h-3 w-3 mr-1" />
                      Rate
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setNextSessionBooking(booking)}>
                    <Plus className="h-3 w-3 mr-1" />
                    Next
                  </Button>
                </div>
              )}
              {(booking.status === 'pending' || booking.status === 'confirmed') && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReschedulingBooking(booking)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reschedule
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setChangingTrainer(booking)}
                    >
                      <User className="h-3 w-3 mr-1" />
                      Trainer
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTransferringBooking(booking)}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Transfer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                      onClick={() => setRequestingRefund(booking)}
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Refund
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    onClick={() => setCancellingBooking(booking)}
                  >
                    Cancel Booking
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )
    }

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

            {groupedByStatus.awaiting_completion.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Awaiting Completion
                </h2>
                {groupedByStatus.awaiting_completion.map(b => renderBookingCard(b, false))}
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
        <div className="container max-w-md mx-auto flex justify-end items-center gap-2 p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEditProfile(true)}
            className="text-muted-foreground hover:text-foreground"
            title="Edit profile"
          >
            <User className="h-5 w-5" />
          </Button>
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

      {selectedTrainer && <TrainerDetails trainer={selectedTrainer} onClose={closeTrainer} selectedCategory={selectedCategory} />}
      {selectedTrainerForBooking && <BookingModal trainer={selectedTrainerForBooking} onClose={() => setSelectedTrainerForBooking(null)} />}
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
      {pendingSessionStart && <SessionStartConfirmModal booking={pendingSessionStart} onConfirm={() => loadBookings()} onDismiss={() => setPendingSessionStart(null)} />}
      {pendingSessionConfirm && <SessionEndConfirmModal booking={pendingSessionConfirm} onConfirm={() => {
        setPendingSessionConfirm(null)
        // Auto-show review modal after session completion (Feature #19)
        setTimeout(() => setReviewBooking(pendingSessionConfirm), 500)
        loadBookings()
      }} onDismiss={() => setPendingSessionConfirm(null)} />}
      {cancellingBooking && <CancelBookingModal booking={cancellingBooking} isOpen={!!cancellingBooking} onClose={() => setCancellingBooking(null)} onSuccess={() => loadBookings()} />}
      {reschedulingBooking && <RescheduleBookingModal booking={reschedulingBooking} trainerProfile={null} isOpen={!!reschedulingBooking} onClose={() => setReschedulingBooking(null)} onSuccess={() => loadBookings()} />}
      {requestingRefund && <RefundRequestModal booking={requestingRefund} onClose={() => setRequestingRefund(null)} onSuccess={() => loadBookings()} />}
      {changingTrainer && <ChangeTrainerModal booking={changingTrainer} onClose={() => setChangingTrainer(null)} onSuccess={() => loadBookings()} />}
      {transferringBooking && <TransferBookingModal booking={transferringBooking} onClose={() => setTransferringBooking(null)} onSuccess={() => loadBookings()} />}
      {showLocationChoice && (
        <LocationChoiceModal
          homeLocation={
            clientProfile?.location_lat && clientProfile?.location_lng
              ? {
                  lat: clientProfile.location_lat,
                  lng: clientProfile.location_lng,
                  label: clientProfile.location_label,
                }
              : undefined
          }
          currentLocation={geoLocation ? { lat: geoLocation.lat, lng: geoLocation.lng } : undefined}
          onSelectHome={() => {
            setSelectedLocationMode('home')
          }}
          onSelectCurrent={() => {
            setSelectedLocationMode('current')
          }}
        />
      )}

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
