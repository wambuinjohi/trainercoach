import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { loadSettings } from '@/lib/settings'
import { toast } from '@/hooks/use-toast'
import { calculateFeeBreakdown } from '@/lib/fee-calculations'
import * as apiService from '@/lib/api-service'
import { completeMockPayment, processBookingPayment } from '@/lib/payment-service'
import { getGroupTierByName, formatGroupPricingDisplay, type GroupPricingConfig, type GroupTier } from '@/lib/group-pricing-utils'
import { LocationPreferenceSelector, type LocationPreference } from './LocationPreferenceSelector'
import { FeeBreakdownModal, type FeeBreakdown } from './FeeBreakdownModal'
import { MultiSessionSelector } from './MultiSessionSelector'
import { BookingSession } from '@/types'
import { CategoryTimingSelector, type CategoryTiming } from './CategoryTimingSelector'

type LiveAvailabilitySnapshot = {
  day_label?: string
  working_slots?: string[]
  booked_slots?: Array<{ start: string, end: string }>
  available_start_times?: string[]
  selected_time?: string | null
  selected_time_available?: boolean | null
  selected_time_message?: string
  checked_at?: string
}

export const BookingForm: React.FC<{ trainer: any, trainerProfile?: any, onDone?: () => void, selectedCategory?: string | null }> = ({ trainer, trainerProfile, onDone, selectedCategory }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [sessions, setSessions] = useState<number>(1)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [payMethod, setPayMethod] = useState<'mpesa' | 'mock'>('mpesa')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [availabilityError, setAvailabilityError] = useState<string>('')
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'not-available' | null>(null)
  const [isGroupTraining, setIsGroupTraining] = useState(false)
  const [groupSize, setGroupSize] = useState<number>(1)
  const [groupTrainingData, setGroupTrainingData] = useState<GroupPricingConfig | null>(null)
  const [selectedGroupTierName, setSelectedGroupTierName] = useState<string>('')
  const [trainerCategoryId, setTrainerCategoryId] = useState<number | null>(null)
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false)
  const [liveAvailability, setLiveAvailability] = useState<LiveAvailabilitySnapshot | null>(null)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [bookingMode, setBookingMode] = useState<'single' | 'multi'>('single')
  const [selectedSessions, setSelectedSessions] = useState<BookingSession[]>([])
  const [categoryPricing, setCategoryPricing] = useState<any[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [bookingStep, setBookingStep] = useState<'step1' | 'step2'>('step1')
  const [categoryTimings, setCategoryTimings] = useState<CategoryTiming[]>([])
  const [categoryTimingsValid, setCategoryTimingsValid] = useState(false)

  // Determine if we should show Step 2 (per-category timing selection)
  const shouldShowStep2 = () => {
    // Only show Step 2 if:
    // - Multiple categories selected
    // - Single session mode (not multi-session mode)
    // - Not group training
    return (
      selectedCategoryIds.length > 1 &&
      bookingMode === 'single' &&
      !isGroupTraining &&
      categoryPricing.length > 0
    )
  }

  const computeBaseAmount = () => {
    // For multi-session mode, calculate based on total duration
    if (bookingMode === 'multi' && selectedSessions.length > 0) {
      const totalDurationHours = selectedSessions.reduce((sum, s) => sum + s.duration_hours, 0)
      // Sum rates for all selected categories
      let totalHourlyRate = 0
      if (selectedCategoryIds.length > 0 && categoryPricing.length > 0) {
        totalHourlyRate = selectedCategoryIds.reduce((sum, catId) => {
          const cat = categoryPricing.find((c: any) => String(c.id) === catId)
          return sum + (cat ? Number(cat.hourly_rate || 0) : 0)
        }, 0)
      } else {
        totalHourlyRate = Number(trainer.hourlyRate || 0)
      }
      return totalHourlyRate * totalDurationHours
    }

    // For single session or group training
    if (isGroupTraining && selectedGroupTierName && groupTrainingData) {
      const tier = getGroupTierByName(groupTrainingData, selectedGroupTierName)
      if (tier) {
        const tierRate = tier.rate
        // Calculate based on pricing model
        if (groupTrainingData.pricing_model === 'per_person') {
          return tierRate * groupSize * Number(sessions || 1)
        } else {
          // fixed rate
          return tierRate * Number(sessions || 1)
        }
      }
    }

    // Sum rates for all selected categories
    let totalHourlyRate = 0
    if (selectedCategoryIds.length > 0 && categoryPricing.length > 0) {
      totalHourlyRate = selectedCategoryIds.reduce((sum, catId) => {
        const cat = categoryPricing.find((c: any) => String(c.id) === catId)
        return sum + (cat ? Number(cat.hourly_rate || 0) : 0)
      }, 0)
    } else {
      totalHourlyRate = Number(trainer.hourlyRate || 0)
    }
    return totalHourlyRate * Number(sessions || 1)
  }

  const settings = loadSettings()

  // Format time to 12-hour format with AM/PM
  const formatTime12hr = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
  }

  // Format available slots into readable time ranges
  const formatAvailableSlots = (slots: string[]): string => {
    return slots.map(slot => {
      const [start, end] = slot.split('-')
      return `${formatTime12hr(start)} - ${formatTime12hr(end)}`
    }).join(', ')
  }

  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr || !timeStr.includes(':')) return null
    const [hours, minutes] = timeStr.split(':').map(Number)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    return hours * 60 + minutes
  }

  const getWorkingSlotsForDate = (selectedDate: string): string[] => {
    const availability = trainerProfile?.availability
    if (!availability || !selectedDate) return []

    const parsedDate = new Date(`${selectedDate}T00:00:00`)
    const dayName = parsedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const slots = availability[dayName]
    return Array.isArray(slots) ? slots : []
  }

  const getLiveAvailability = async (selectedDate: string, selectedTime?: string) => {
    return apiRequest<LiveAvailabilitySnapshot>('booking_live_availability', {
      trainer_id: trainer.id,
      session_date: selectedDate,
      session_time: selectedTime || undefined,
      duration_hours: 1,
    }, { headers: withAuth() })
  }

  useEffect(() => {
    if (!date || !trainer?.id) {
      setLiveAvailability(null)
      setAvailabilityLoading(false)
      return
    }

    let isActive = true

    const loadAvailability = async (silent = false) => {
      if (!silent) setAvailabilityLoading(true)

      try {
        const snapshot = await getLiveAvailability(date, time || undefined)
        if (isActive) {
          setLiveAvailability(snapshot)
        }
      } catch (err) {
        console.warn('Failed to load live availability:', err)
        if (isActive && !silent) {
          setLiveAvailability(null)
        }
      } finally {
        if (isActive && !silent) {
          setAvailabilityLoading(false)
        }
      }
    }

    loadAvailability()
    const intervalId = window.setInterval(() => {
      loadAvailability(true)
    }, 30000)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [date, time, trainer?.id])

  useEffect(() => {
    setAvailabilityError('')
    setAvailabilityStatus(null)
    if (!date || !time) return

    const selectedDate = new Date(`${date}T00:00:00`)
    const dayLabel = liveAvailability?.day_label || selectedDate.toLocaleDateString('en-US', { weekday: 'long' })
    const workingSlots = liveAvailability?.working_slots?.length ? liveAvailability.working_slots : getWorkingSlotsForDate(date)

    if (!workingSlots.length) {
      setAvailabilityError(`Trainer is not available on ${dayLabel}. Please select a different date.`)
      setAvailabilityStatus('not-available')
      return
    }

    if (liveAvailability?.selected_time === time && liveAvailability.selected_time_available === false) {
      setAvailabilityError(liveAvailability.selected_time_message || `This time is not available. Available slots: ${formatAvailableSlots(workingSlots)}`)
      setAvailabilityStatus('not-available')
      return
    }

    const selectedTimeInMinutes = parseTimeToMinutes(time)
    if (selectedTimeInMinutes === null) {
      setAvailabilityError('Please enter a valid time.')
      setAvailabilityStatus('not-available')
      return
    }

    const durationMinutes = 60
    const endsWithinWorkingHours = workingSlots.some((slot: string) => {
      const [start, end] = slot.split('-')
      const startInMinutes = parseTimeToMinutes(start)
      const endInMinutes = parseTimeToMinutes(end)
      if (startInMinutes === null || endInMinutes === null) return false
      return selectedTimeInMinutes >= startInMinutes && (selectedTimeInMinutes + durationMinutes) <= endInMinutes
    })

    if (!endsWithinWorkingHours) {
      setAvailabilityError(`This time is not available. Available slots: ${formatAvailableSlots(workingSlots)}`)
      setAvailabilityStatus('not-available')
      return
    }

    const overlappingBooking = liveAvailability?.booked_slots?.find((slot) => {
      const slotStart = parseTimeToMinutes(slot.start)
      const slotEnd = parseTimeToMinutes(slot.end)
      if (slotStart === null || slotEnd === null) return false
      return selectedTimeInMinutes < slotEnd && slotStart < (selectedTimeInMinutes + durationMinutes)
    })

    if (overlappingBooking) {
      setAvailabilityError(`This time has already been booked. Occupied slot: ${formatTime12hr(overlappingBooking.start)} - ${formatTime12hr(overlappingBooking.end)}`)
      setAvailabilityStatus('not-available')
      return
    }

    setAvailabilityStatus('available')
  }, [date, time, liveAvailability, trainerProfile?.availability])

  // Load category pricing for the trainer
  useEffect(() => {
    const loadCategoryPricing = async () => {
      if (!trainer?.id) return
      try {
        const response = await apiService.getTrainerCategoryPricing(trainer.id)
        // Handle both direct array response and wrapped response with .data property
        const pricingList = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : [])
        if (pricingList.length > 0) {
          setCategoryPricing(pricingList)
          // If a specific category is selected, only select that one
          if (selectedCategory) {
            const selectedCat = pricingList.find((cat: any) => cat.name === selectedCategory)
            if (selectedCat) {
              setSelectedCategoryIds([String(selectedCat.id)])
            }
          } else {
            // Auto-select all categories by default
            setSelectedCategoryIds(pricingList.map((cat: any) => String(cat.id)))
          }
        }
      } catch (err) {
        console.warn('Failed to load category pricing:', err)
      }
    }
    loadCategoryPricing()
  }, [trainer?.id, selectedCategory])

  // Auto-advance to step 2 when conditions are met
  useEffect(() => {
    if (shouldShowStep2() && bookingStep === 'step1') {
      // Check if user has progressed beyond initial category selection
      // Only auto-advance if they've already filled in step 1 fields
      if (date || time || sessions > 1) {
        // Don't auto-advance yet, let user control when to proceed
      }
    }
  }, [selectedCategoryIds, bookingMode, isGroupTraining, categoryPricing])

  // Load group training data for the trainer
  useEffect(() => {
    const loadGroupTrainingData = async () => {
      if (!trainer?.id) return
      try {
        const response = await apiService.getTrainerGroupPricing(trainer.id)
        // Handle both direct array response and wrapped response with .data property
        const pricingList = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : [])
        if (pricingList.length > 0) {
          const firstGroupPricing = pricingList[0]
          setGroupTrainingData(firstGroupPricing)
          setTrainerCategoryId(firstGroupPricing.category_id)
          // Auto-select first tier for convenience
          if (firstGroupPricing.tiers && firstGroupPricing.tiers.length > 0) {
            setSelectedGroupTierName(firstGroupPricing.tiers[0].group_size_name)
          }
        }
      } catch (err) {
        console.warn('Failed to load group training data:', err)
      }
    }
    loadGroupTrainingData()
  }, [trainer?.id])

  // Get fee breakdown using new calculation utility
  const baseAmount = computeBaseAmount()
  const feeBreakdown = calculateFeeBreakdown(baseAmount, {
    platformChargeClientPercent: settings.platformChargeClientPercent || 15,
    platformChargeTrainerPercent: settings.platformChargeTrainerPercent || 10,
    compensationFeePercent: settings.compensationFeePercent || 10,
    maintenanceFeePercent: settings.maintenanceFeePercent || 15,
  }, 0) // transportFee will be calculated server-side

  const today = new Date().toISOString().split('T')[0]
  const availableStartTimes = liveAvailability?.available_start_times || []
  const bookedTimeRanges = liveAvailability?.booked_slots?.map(slot => `${formatTime12hr(slot.start)} - ${formatTime12hr(slot.end)}`).join(', ') || ''
  const selectedSessionCount = selectedSessions.length
  const selectedSessionHours = selectedSessions.reduce((sum, session) => sum + session.duration_hours, 0)

  const createPerCategoryBookings = async (
    categoriesToBook: string[],
    clientLocation: { label?: string; lat?: number | null; lng?: number | null }
  ) => {
    const bookingIds: string[] = []
    const categoryBookings: Array<{categoryId: string, categoryName: string, bookingId: string, baseAmount: number}> = []

    for (const categoryId of categoriesToBook) {
      // Find the timing for this category
      const categoryTiming = categoryTimings.find(t => t.categoryId === categoryId)
      if (!categoryTiming || !categoryTiming.date || !categoryTiming.time) {
        throw new Error(`Missing timing for category ${categoryId}`)
      }

      const selectedCategory = categoryPricing.find((cat: any) => String(cat.id) === categoryId)
      const hourlyRate = selectedCategory ? Number(selectedCategory.hourly_rate || 0) : Number(trainer.hourlyRate || 0)
      const categoryBaseAmount = hourlyRate * (sessions || 1)

      const payload: any = {
        client_id: user!.id,
        trainer_id: trainer.id,
        category_id: categoryId,
        session_date: categoryTiming.date,
        session_time: categoryTiming.time,
        duration_hours: 1,
        total_sessions: sessions,
        status: 'pending',
        session_phase: 'waiting_start',
        base_service_amount: categoryBaseAmount,
        notes: notes || '',
        client_location_label: (clientLocation.label || null),
        client_location_lat: (clientLocation.lat != null ? clientLocation.lat : null),
        client_location_lng: (clientLocation.lng != null ? clientLocation.lng : null),
      }

      // Create the booking
      const bookingResponse = await apiRequest('booking_create', payload, { headers: withAuth() })
      const bookingId = bookingResponse?.booking_id
      if (!bookingId) {
        throw new Error(`Failed to create booking for category ${categoryId}`)
      }

      bookingIds.push(bookingId)
      const categoryName = selectedCategory?.name || 'Session'
      categoryBookings.push({
        categoryId,
        categoryName,
        bookingId,
        baseAmount: categoryBaseAmount
      })
    }

    return { bookingIds, categoryBookings }
  }

  const submit = async () => {
    if (!user) return

    // Handle Step 1 to Step 2 transition for multi-category bookings
    if (shouldShowStep2() && bookingStep === 'step1') {
      // Step 1 only collects categories and booking mode for multi-category bookings.
      // Proceed directly to step 2 where each category gets its own date/time.
      setBookingStep('step2')
      return
    }

    // Handle Step 2 completion (multi-category with per-category timings)
    if (shouldShowStep2() && bookingStep === 'step2') {
      if (!categoryTimingsValid) {
        toast({ title: 'Missing info', description: 'Please set valid date and time for all categories', variant: 'destructive' })
        return
      }
    }

    // Validate based on booking mode
    if (bookingMode === 'single' && !shouldShowStep2()) {
      if (!date || !time) {
        toast({ title: 'Missing info', description: 'Please select date and time', variant: 'destructive' })
        return
      }
    } else if (bookingMode === 'multi') {
      if (selectedSessions.length === 0) {
        toast({ title: 'Missing info', description: 'Please select at least one session', variant: 'destructive' })
        return
      }
    }

    // Validate at least one category is selected
    if (selectedCategoryIds.length === 0 && !isGroupTraining) {
      toast({ title: 'Missing info', description: 'Please select at least one service category', variant: 'destructive' })
      return
    }

    // Validate payment method
    if (payMethod === 'mpesa' && !mpesaPhone.trim()) {
      toast({ title: 'Phone required', description: 'Enter your M-Pesa phone number (e.g., 2547XXXXXXX)', variant: 'destructive' })
      return
    }

    if (bookingMode === 'single' && !shouldShowStep2()) {
      if (availabilityError) {
        toast({ title: 'Invalid time', description: availabilityError, variant: 'destructive' })
        return
      }
      // Double-check availability status before submitting
      if (availabilityStatus !== 'available') {
        toast({ title: 'Invalid time', description: 'Please select a time when the trainer is available', variant: 'destructive' })
        return
      }

      try {
        const latestAvailability = await getLiveAvailability(date, time)
        setLiveAvailability(latestAvailability)
        if (latestAvailability.selected_time_available !== true) {
          toast({
            title: 'Time no longer available',
            description: latestAvailability.selected_time_message || 'This slot was just taken. Please choose another time.',
            variant: 'destructive'
          })
          return
        }
      } catch (err) {
        console.warn('Failed to refresh live availability before booking:', err)
      }
    }

    setLoading(true)

    // Load client saved location to link to booking
    let clientLocation: { label?: string; lat?: number | null; lng?: number | null } = {}
    try {
      const prof = await apiRequest('profile_get', { user_id: user.id }, { headers: withAuth() })
      const label = (prof?.location_label as string) || (prof?.location as string) || ''
      const lat = prof?.location_lat != null ? Number(prof.location_lat) : null
      const lng = prof?.location_lng != null ? Number(prof.location_lng) : null
      clientLocation = { label, lat, lng }
    } catch {}

    try {
      // Create bookings for each selected category
      const bookingIds: string[] = []
      const categoryBookings: Array<{categoryId: string, categoryName: string, bookingId: string, baseAmount: number}> = []

      // Determine which categories to book
      const categoriesToBook = isGroupTraining ? [trainerCategoryId?.toString() || ''] : selectedCategoryIds

      for (const categoryId of categoriesToBook) {
        // Calculate base amount for this category
        const selectedCategory = categoryPricing.find((cat: any) => String(cat.id) === categoryId)
        let categoryBaseAmount = 0
        let sessionDate = date
        let sessionTime = time

        // If Step 2 was used, get timing from categoryTimings
        if (shouldShowStep2() && bookingStep === 'step2') {
          const categoryTiming = categoryTimings.find(t => t.categoryId === categoryId)
          if (categoryTiming) {
            sessionDate = categoryTiming.date
            sessionTime = categoryTiming.time
          }
        }

        if (bookingMode === 'multi' && selectedSessions.length > 0) {
          const totalDurationHours = selectedSessions.reduce((sum, s) => sum + s.duration_hours, 0)
          const hourlyRate = selectedCategory ? Number(selectedCategory.hourly_rate || 0) : Number(trainer.hourlyRate || 0)
          categoryBaseAmount = hourlyRate * totalDurationHours
        } else if (isGroupTraining && selectedGroupTierName && groupTrainingData) {
          const tier = getGroupTierByName(groupTrainingData, selectedGroupTierName)
          if (tier) {
            const tierRate = tier.rate
            if (groupTrainingData.pricing_model === 'per_person') {
              categoryBaseAmount = tierRate * groupSize * Number(sessions || 1)
            } else {
              categoryBaseAmount = tierRate * Number(sessions || 1)
            }
          }
        } else {
          const hourlyRate = selectedCategory ? Number(selectedCategory.hourly_rate || 0) : Number(trainer.hourlyRate || 0)
          categoryBaseAmount = hourlyRate * Number(sessions || 1)
        }

        const payload: any = {
          client_id: user.id,
          trainer_id: trainer.id,
          category_id: categoryId,
          session_date: bookingMode === 'multi' ? selectedSessions[0]?.date : sessionDate,
          session_time: bookingMode === 'multi' ? selectedSessions[0]?.start_time : sessionTime,
          duration_hours: bookingMode === 'multi' ? selectedSessions[0]?.duration_hours || 1 : 1,
          total_sessions: bookingMode === 'multi' ? selectedSessions.length : sessions,
          status: 'pending',
          session_phase: 'waiting_start',
          base_service_amount: categoryBaseAmount,
          notes: notes || '',
          client_location_label: (clientLocation.label || null),
          client_location_lat: (clientLocation.lat != null ? clientLocation.lat : null),
          client_location_lng: (clientLocation.lng != null ? clientLocation.lng : null),
        }

        // Add sessions array for multi-session bookings
        if (bookingMode === 'multi' && selectedSessions.length > 0) {
          payload.sessions = selectedSessions
        }

        // Add group training data if applicable
        if (isGroupTraining && groupTrainingData) {
          payload.is_group_training = true
          payload.group_size = groupSize
          payload.group_size_tier_name = selectedGroupTierName
          payload.pricing_model_used = groupTrainingData.pricing_model
        }

        // Create the booking
        const bookingResponse = await apiRequest('booking_create', payload, { headers: withAuth() })
        const bookingId = bookingResponse?.booking_id
        if (!bookingId) {
          throw new Error(`Failed to create booking for category ${categoryId}`)
        }

        bookingIds.push(bookingId)
        const categoryName = isGroupTraining ? trainer.disciplineName : (selectedCategory?.name || 'Session')
        categoryBookings.push({
          categoryId,
          categoryName,
          bookingId,
          baseAmount: categoryBaseAmount
        })
      }

      // Calculate combined total
      const combinedBaseAmount = categoryBookings.reduce((sum, b) => sum + b.baseAmount, 0)
      const combinedFeeBreakdown = calculateFeeBreakdown(combinedBaseAmount, {
        platformChargeClientPercent: settings.platformChargeClientPercent || 15,
        platformChargeTrainerPercent: settings.platformChargeTrainerPercent || 10,
        compensationFeePercent: settings.compensationFeePercent || 10,
        maintenanceFeePercent: settings.maintenanceFeePercent || 15,
      }, 0)

      const clientTotal = combinedFeeBreakdown.clientTotal

      // Send notifications for all bookings
      try {
        const trainerUserId = trainer.id
        const nowIso = new Date().toISOString()
        const notifRows: any[] = [
          {
            user_id: user.id,
            booking_id: bookingIds[0] || null,
            title: 'Multi-category booking submitted',
            body: `Your booking for ${categoryBookings.map(b => b.categoryName).join(', ')} has been created. Use in-app chat for safe communication.`,
            action_type: 'view_booking',
            type: 'booking',
            created_at: nowIso,
            read: false,
          },
          {
            user_id: trainerUserId,
            booking_id: bookingIds[0] || null,
            title: 'New multi-category booking',
            body: `A client requested ${categoryBookings.map(b => b.categoryName).join(', ')} sessions. Please confirm or decline.`,
            action_type: 'confirm_attendance',
            type: 'booking',
            created_at: nowIso,
            read: false,
          },
        ]
        try {
          const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
          for (const a of (admins || [])) {
            notifRows.push({
              user_id: a.user_id,
              booking_id: bookingIds[0] || null,
              title: 'New multi-category booking',
              body: `Booking from ${user.email || user.id} to trainer ${trainer.name || trainer.id} for ${categoryBookings.map(b => b.categoryName).join(', ')}.`,
              action_type: 'view_booking',
              type: 'booking',
              created_at: nowIso,
              read: false
            })
          }
        } catch {}
        if (notifRows.length) await apiRequest('notifications_insert', { notifications: notifRows }, { headers: withAuth() })
      } catch (err) {
        console.warn('Notification insert failed', err)
      }

      const paymentCreatedAt = new Date().toISOString()
      const paymentBaseRecord = {
        booking_id: bookingIds[0],
        client_id: user.id,
        trainer_id: trainer.id,
        amount: clientTotal,
        base_service_amount: combinedBaseAmount,
        transport_fee: 0,
        platform_fee: combinedFeeBreakdown.platformFeeAmount,
        vat_amount: combinedFeeBreakdown.vatAmount,
        trainer_net_amount: combinedFeeBreakdown.trainerNetAmount,
        status: 'pending' as const,
        created_at: paymentCreatedAt,
      }

      let paymentRecord: any = null

      if (payMethod === 'mpesa') {
        if (!mpesaPhone.trim()) {
          toast({ title: 'Phone required', description: 'Enter your M-Pesa phone number (e.g., 2547XXXXXXX)', variant: 'destructive' })
          throw new Error('phone required')
        }

        // Validate payment amount is within M-Pesa limits (5-150000)
        if (clientTotal < 5) {
          toast({
            title: 'Amount too low',
            description: `The combined cost (Ksh ${clientTotal}) is below the minimum M-Pesa payment of Ksh 5.`,
            variant: 'destructive'
          })
          throw new Error(`Payment amount ${clientTotal} is below minimum of 5`)
        }

        if (clientTotal > 150000) {
          toast({
            title: 'Amount too high',
            description: `The combined cost (Ksh ${clientTotal}) exceeds the maximum M-Pesa payment of Ksh 150,000.`,
            variant: 'destructive'
          })
          throw new Error(`Payment amount ${clientTotal} exceeds maximum of 150000`)
        }

        toast({ title: 'M-Pesa STK', description: 'Check your phone and enter PIN to approve.' })

        const paymentResult = await processBookingPayment({
          phone: mpesaPhone,
          amount: clientTotal,
          bookingId: bookingIds[0],
          clientId: user.id,
          trainerId: trainer.id,
          accountReference: bookingIds[0],
          paymentRecord: paymentBaseRecord,
        })

        if (!paymentResult.success) {
          const errorMessage = paymentResult.error || 'Payment not completed'
          if (errorMessage.includes('not configured')) {
            toast({
              title: 'M-Pesa not available',
              description: 'M-Pesa is not currently configured. Please use the Mock payment method for testing.',
              variant: 'destructive'
            })
          } else {
            toast({
              title: 'Payment not completed',
              description: errorMessage,
              variant: 'destructive'
            })
          }
          return
        }

        paymentRecord = {
          ...paymentBaseRecord,
          method: 'mpesa',
        }

        const bookingConfirmationState = {
          bookingId: bookingIds[0],
          bookingIds: bookingIds,
          categoryBookings: categoryBookings,
          trainerName: trainer.name || 'Trainer',
          date: bookingMode === 'multi' ? selectedSessions[0]?.date || date : date,
          time: bookingMode === 'multi' ? selectedSessions[0]?.start_time || time : time,
          sessions: bookingMode === 'multi' ? selectedSessions : [],
          totalAmount: clientTotal,
          disciplineName: trainer.disciplineName,
          location: clientLocation.label,
          notes,
          paymentStatus: 'processing' as const,
          checkoutRequestId: paymentResult.checkoutRequestId,
        }

        navigate(`/booking-confirmation/${bookingIds[0]}`, { state: bookingConfirmationState })
        onDone?.()
        return
      } else {
        const mockResult = await completeMockPayment(paymentBaseRecord, bookingIds[0])
        if (!mockResult.success) {
          throw new Error(mockResult.error || 'Failed to record payment')
        }

        paymentRecord = {
          ...paymentBaseRecord,
          method: 'mock',
        }
      }

      try {
        const hook = (import.meta.env.VITE_ZAPIER_WEBHOOK_URL || import.meta.env.NEXT_PUBLIC_ZAPIER_WEBHOOK_URL) as string | undefined
        if (hook) {
          await fetch(hook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'multi_category_booking_created',
              bookingIds: bookingIds,
              categories: categoryBookings,
              payer: paymentRecord
            }),
          })
        }
      } catch (err) {
        console.warn('Zapier webhook error', err)
      }

      // Navigate to booking confirmation page with all booking details
      const bookingConfirmationState = {
        bookingId: bookingIds[0],
        bookingIds: bookingIds,
        categoryBookings: categoryBookings,
        trainerName: trainer.name || 'Trainer',
        date: bookingMode === 'multi' ? selectedSessions[0]?.date || date : date,
        time: bookingMode === 'multi' ? selectedSessions[0]?.start_time || time : time,
        sessions: bookingMode === 'multi' ? selectedSessions : [],
        totalAmount: clientTotal,
        disciplineName: trainer.disciplineName,
        location: clientLocation.label,
        notes,
        paymentStatus: 'completed' as const,
      }

      navigate(`/booking-confirmation/${bookingIds[0]}`, { state: bookingConfirmationState })
      onDone?.()
    } catch (err) {
      console.error('Booking error', err)
      const errorMessage = err instanceof Error ? err.message : String(err)

      // Provide user-friendly error message
      if (errorMessage.includes('not available') || errorMessage.includes('availability')) {
        toast({
          title: 'Time slot unavailable',
          description: errorMessage.includes('not available on')
            ? errorMessage
            : 'The trainer is no longer available at this time. Please select a different date or time.',
          variant: 'destructive'
        })
        // Reset form to allow selection of different time
        setDate('')
        setTime('')
      } else if (errorMessage.includes('Amount must be between') || errorMessage.includes('below minimum') || errorMessage.includes('exceeds maximum')) {
        toast({
          title: 'Invalid payment amount',
          description: errorMessage.includes('below minimum') || errorMessage.includes('Amount must be between')
            ? 'The combined session cost is too low for M-Pesa payment (minimum Ksh 5). Please use Mock payment or check trainer rates.'
            : 'The combined session cost is too high for M-Pesa payment (maximum Ksh 150,000). Please contact support.',
          variant: 'destructive'
        })
      } else if (errorMessage.includes('access token') || errorMessage.includes('credentials') || errorMessage.includes('not configured')) {
        toast({
          title: 'M-Pesa not configured',
          description: 'Please use the Mock payment method to complete your booking.',
          variant: 'destructive'
        })
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast({
          title: 'Connection error',
          description: 'Please check your internet connection and try again.',
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Booking failed',
          description: 'Please try again or contact support if the problem persists.',
          variant: 'destructive'
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Render Step 1 or Step 2 based on bookingStep
  const renderFormContent = () => {
    if (shouldShowStep2() && bookingStep === 'step2') {
      // Step 2: Per-category timing selection
      return (
        <div className="grid grid-cols-1 gap-3 flex-1 overflow-y-auto pr-2">
          <div className="border border-border rounded-md p-3 bg-muted/5">
            <CategoryTimingSelector
              selectedCategories={selectedCategoryIds.map(catId => {
                const cat = categoryPricing.find(c => String(c.id) === catId)
                return {
                  id: catId,
                  name: cat?.name || 'Unknown',
                  hourlyRate: Number(cat?.hourly_rate || 0)
                }
              })}
              trainerAvailability={trainerProfile?.availability || {}}
              onTimingsChange={setCategoryTimings}
              onValidationChange={setCategoryTimingsValid}
            />
          </div>
        </div>
      )
    }

    // Step 1: Default booking form
    return (
      <div className="grid grid-cols-1 gap-3 flex-1 overflow-y-auto pr-2">
        {/* Booking Mode Toggle */}
        <div className="space-y-3 border border-border rounded-md p-3 bg-muted/5">
          <Label className="text-sm font-medium">Booking Type</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={bookingMode === 'single' ? 'default' : 'outline'}
              className={bookingMode === 'single' ? 'bg-gradient-primary text-white' : ''}
              onClick={() => {
                setBookingMode('single')
                setSelectedSessions([])
                setAvailabilityError('')
                setAvailabilityStatus(null)
                setLiveAvailability(null)
              }}
            >
              Single Session
            </Button>
            <Button
              type="button"
              variant={bookingMode === 'multi' ? 'default' : 'outline'}
              className={bookingMode === 'multi' ? 'bg-gradient-primary text-white' : ''}
              onClick={() => {
                setBookingMode('multi')
                setDate('')
                setTime('')
                setAvailabilityError('')
                setAvailabilityStatus(null)
                setLiveAvailability(null)
              }}
            >
              Multiple Sessions
            </Button>
          </div>
        </div>

        {/* Category Selector - Multi-select */}
        {!isGroupTraining && categoryPricing.length > 0 && (
          <div className="border border-border rounded-md p-3 bg-muted/5">
            <Label className="text-sm font-medium">Service Categories</Label>
            {selectedCategory ? (
              <p className="text-xs text-muted-foreground mb-3">Booking for: <span className="font-semibold">{selectedCategory}</span></p>
            ) : (
              <p className="text-xs text-muted-foreground mb-3">Select one or more categories. Pricing will be combined.</p>
            )}
            <div className="space-y-2">
              {categoryPricing.map((category: any) => {
                const isSelectedCategory = category.name === selectedCategory
                const isDisabled = selectedCategory && !isSelectedCategory
                return (
                  <label key={category.id} className={`flex items-center gap-3 p-2 rounded ${isDisabled ? 'opacity-50 cursor-not-allowed bg-muted/20' : 'hover:bg-muted/50 cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(String(category.id))}
                      onChange={(e) => {
                        const catId = String(category.id)
                        if (e.target.checked) {
                          setSelectedCategoryIds([...selectedCategoryIds, catId])
                        } else {
                          setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== catId))
                        }
                      }}
                      disabled={isDisabled}
                      className="w-4 h-4 rounded border-border cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{category.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Ksh {Number(category.hourly_rate || 0)}/hr
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Single Session Booking */}
        {bookingMode === 'single' && !shouldShowStep2() && (
          <>
            <div>
              <Label>Session Date</Label>
              <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          {date && (
            <div className="mt-2 rounded-md border border-border bg-muted/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {availabilityLoading ? 'Checking live availability...' : `Available times for ${liveAvailability?.day_label || 'this date'}`}
                </span>
                {!availabilityLoading && liveAvailability?.checked_at && (
                  <span className="text-[11px] text-muted-foreground">Live</span>
                )}
              </div>

              {availableStartTimes.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableStartTimes.map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      size="sm"
                      variant={time === slot ? 'default' : 'outline'}
                      className={time === slot ? 'bg-gradient-primary text-white' : ''}
                      onClick={() => setTime(slot)}
                    >
                      {formatTime12hr(slot)}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {availabilityLoading ? 'Refreshing availability...' : 'No open times on this date right now. Please choose another date.'}
                </p>
              )}

              {bookedTimeRanges && (
                <p className="mt-2 text-xs text-muted-foreground">Already booked: {bookedTimeRanges}</p>
              )}
            </div>
          )}
        </div>
        <div>
          <Label>Session Time</Label>
          <Input type="time" step={1800} value={time} onChange={(e) => setTime(e.target.value)} />
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
            ⚠️ Times are displayed in 12-hour format (AM/PM). Please ensure you select the correct AM or PM time.
          </div>
          {availabilityStatus === 'available' && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1 font-medium">
              <span className="text-lg">✓</span> Available
            </div>
          )}
          {availabilityStatus === 'not-available' && (
            <div className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1 font-medium">
              <span className="text-lg">✗</span> Not Available
            </div>
          )}
              {availabilityError && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{availabilityError}</div>}
            </div>
            <div>
              <Label>Number of Sessions</Label>
              <Input type="number" min={1} value={String(sessions)} onChange={(e) => setSessions(Number(e.target.value))} />
            </div>
          </>
        )}

        {/* Multi-Session Booking */}
        {bookingMode === 'multi' && (
          <div className="border border-border rounded-md p-3 bg-muted/5">
            <MultiSessionSelector
              trainerAvailability={trainerProfile?.availability || {}}
              onSelectionChange={setSelectedSessions}
              minSessions={1}
              maxSessions={20}
            />
          </div>
        )}

        {/* Group Training Section */}
        {groupTrainingData && groupTrainingData.tiers && groupTrainingData.tiers.length > 0 && (
          <div className="space-y-3 border border-border rounded-md p-3 bg-muted/5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Book as group training</Label>
              <Switch checked={isGroupTraining} onCheckedChange={setIsGroupTraining} />
            </div>

            {isGroupTraining && (
              <>
                <div>
                  <Label className="text-xs">Group size</Label>
                  <Input
                    type="number"
                    min={1}
                    value={String(groupSize)}
                    onChange={(e) => setGroupSize(Math.max(1, Number(e.target.value)))}
                    placeholder="Enter group size"
                    className="mt-1"
                  />
                </div>

                {selectedGroupTierName && (
                  <div>
                    <Label className="text-xs">Select group tier</Label>
                    <Select value={selectedGroupTierName} onValueChange={setSelectedGroupTierName}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {groupTrainingData.tiers.map((tier) => (
                          <SelectItem key={tier.group_size_name} value={tier.group_size_name}>
                            <div className="flex flex-col">
                              <span>{tier.group_size_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatGroupPricingDisplay(tier.rate, groupTrainingData.pricing_model)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedGroupTierName && (
                      <>
                        <p className="text-xs text-muted-foreground mt-2">
                          Rate: {groupTrainingData && getGroupTierByName(groupTrainingData, selectedGroupTierName) && formatGroupPricingDisplay(getGroupTierByName(groupTrainingData, selectedGroupTierName)!.rate, groupTrainingData.pricing_model)}
                        </p>
                        {(() => {
                          const selectedTier = getGroupTierByName(groupTrainingData, selectedGroupTierName)
                          if (selectedTier && (groupSize < selectedTier.min_size || groupSize > selectedTier.max_size)) {
                            return (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                                ⚠ Group size {groupSize} is outside tier range ({selectedTier.min_size}-{selectedTier.max_size})
                              </p>
                            )
                          }
                          return null
                        })()}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div>
          <Label>Notes / Additional Info</Label>
          <input className="w-full p-2 border border-border rounded-md bg-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special requests or details..." />
        </div>

        <div>
          <Label>Payment Method</Label>
          <select className="w-full p-2 border border-border rounded-md bg-input" value={payMethod} onChange={(e)=>setPayMethod(e.target.value as any)}>
            <option value="mpesa">M-Pesa (STK Push)</option>
            <option value="mock">Mock (for testing)</option>
          </select>
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-400">
            <p className="font-medium mb-1">Payment Method Info:</p>
            <ul className="text-xs space-y-1 ml-3 list-disc">
              <li><strong>M-Pesa:</strong> Real payments using M-Pesa STK Push. Requires M-Pesa configuration by admin.</li>
              <li><strong>Mock:</strong> For testing only. Use this method if M-Pesa isn't configured yet.</li>
            </ul>
            <p className="text-xs mt-2 opacity-80">If M-Pesa payments fail, switch to Mock for testing or contact support.</p>
          </div>
        </div>
        {payMethod === 'mpesa' && (
          <div>
            <Label>M-Pesa Phone Number <span className="text-red-500">*</span></Label>
            <Input value={mpesaPhone} onChange={(e)=>setMpesaPhone(e.target.value)} placeholder="254712345678 or 0712345678" required />
            <p className="text-xs text-muted-foreground mt-1">Format: 254712345678 (Kenyan number). 07xxxxxxxx format will be converted automatically.</p>
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/10 p-3 text-sm">
          {isGroupTraining && groupTrainingData ? (
            <>
              <div className="flex justify-between"><span>Group tier</span><span className="font-semibold">{selectedGroupTierName}</span></div>
              <div className="flex justify-between"><span>Group size</span><span className="font-semibold">{groupSize} people</span></div>
              <div className="flex justify-between"><span>Rate per {groupTrainingData.pricing_model === 'per_person' ? 'person' : 'group'}</span>
                <span className="font-semibold">Ksh {groupTrainingData && selectedGroupTierName && getGroupTierByName(groupTrainingData, selectedGroupTierName) ? getGroupTierByName(groupTrainingData, selectedGroupTierName)!.rate : 0}</span>
              </div>
            </>
          ) : (
            <>
              {selectedCategoryIds.length > 0 ? (
                <div className="space-y-1 mb-2">
                  {selectedCategoryIds.map(catId => {
                    const cat = categoryPricing.find(c => String(c.id) === catId)
                    return (
                      <div key={catId} className="flex justify-between text-xs">
                        <span>{cat?.name}</span>
                        <span className="font-medium">Ksh {Number(cat?.hourly_rate || 0)}/hr</span>
                      </div>
                    )
                  })}
                  <div className="border-t border-border pt-1 mt-1 flex justify-between">
                    <span>Combined Rate</span>
                    <span className="font-semibold">Ksh {selectedCategoryIds.reduce((sum, catId) => {
                      const cat = categoryPricing.find(c => String(c.id) === catId)
                      return sum + (cat ? Number(cat.hourly_rate || 0) : 0)
                    }, 0)}/hr</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between"><span>Rate</span><span className="font-semibold">Ksh {Number(trainer.hourlyRate || 0)}/hr</span></div>
              )}
            </>
          )}
          <div className="flex justify-between"><span>Sessions</span><span className="font-semibold">{bookingMode === 'multi' ? selectedSessionCount : sessions}</span></div>
          {bookingMode === 'multi' && (
            <div className="flex justify-between"><span>Total Hours</span><span className="font-semibold">{selectedSessionHours.toFixed(1)}</span></div>
          )}
          <div className="flex justify-between"><span>Base Service Amount</span><span className="font-semibold">Ksh {baseAmount}</span></div>
          <div className="border-t border-border my-2 pt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">Surcharge:</span>
              <button
                type="button"
                onClick={() => setShowFeeBreakdown(true)}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                View Details
              </button>
            </div>
            <div className="flex justify-between text-xs"><span>VAT (16%)</span><span>Ksh {feeBreakdown.vatAmount}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Transport fee (distance-based)</span><span>Ksh 0 (server-calculated)</span></div>
            <div className="flex justify-between mt-2"><span className="font-medium">Estimated Total (excl. transport)</span><span className="font-bold">Ksh {feeBreakdown.clientTotal}</span></div>
            <div className="text-xs text-muted-foreground mt-1">*Transport fee will be added based on distance at checkout</div>

            {/* Warning for invalid M-Pesa amounts */}
            {payMethod === 'mpesa' && (feeBreakdown.clientTotal < 5 || feeBreakdown.clientTotal > 150000) && (
              <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
                {feeBreakdown.clientTotal < 5 ? (
                  <>
                    <strong>⚠️ Amount too low:</strong> M-Pesa requires minimum payment of Ksh 5. Current: Ksh {feeBreakdown.clientTotal}. Use Mock payment or increase sessions.
                  </>
                ) : (
                  <>
                    <strong>⚠️ Amount too high:</strong> M-Pesa has a maximum payment limit of Ksh 150,000. Current: Ksh {feeBreakdown.clientTotal}. Use Mock payment or contact support.
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Step Indicator */}
      {shouldShowStep2() && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800/50 rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
              {bookingStep === 'step1' ? 'Step 1 of 2: Select Categories & Mode' : 'Step 2 of 2: Set Different Times Per Category'}
            </h2>
          </div>
          <div className="flex gap-2">
            <div className={`flex-1 h-1 rounded-full ${bookingStep === 'step1' ? 'bg-gradient-primary' : 'bg-gradient-primary/50'}`}></div>
            <div className={`flex-1 h-1 rounded-full ${bookingStep === 'step2' ? 'bg-gradient-primary' : 'bg-gradient-primary/50'}`}></div>
          </div>
        </div>
      )}

      {renderFormContent()}

      <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4 flex-shrink-0">
        {shouldShowStep2() && bookingStep === 'step2' ? (
          <Button variant="outline" onClick={() => setBookingStep('step1')}>Back</Button>
        ) : (
          <Button variant="outline" onClick={() => onDone?.()}>Cancel</Button>
        )}

        {(() => {
          // Handle Step 1 to Step 2 transition
          if (shouldShowStep2() && bookingStep === 'step1') {
            return (
              <Button
                onClick={submit}
                disabled={loading}
                className="bg-gradient-primary text-white"
              >
                {loading ? 'Processing...' : 'Next: Set Times per Category'}
              </Button>
            )
          }

          // Handle Step 2 completion or single-category booking
          const isInvalidMpesaAmount = payMethod === 'mpesa' && (feeBreakdown.clientTotal < 5 || feeBreakdown.clientTotal > 150000)
          const isAvailabilityInvalid = bookingMode === 'single' && date && time && availabilityStatus !== 'available'
          const submitDisabled = loading || (bookingMode === 'single' && !!availabilityError) || isInvalidMpesaAmount || isAvailabilityInvalid || (shouldShowStep2() && bookingStep === 'step2' && !categoryTimingsValid)
          let submitTitle = ''
          if (bookingMode === 'single' && availabilityError) submitTitle = 'Please select a valid date and time'
          else if (isAvailabilityInvalid) submitTitle = 'Trainer is not available at selected time'
          else if (isInvalidMpesaAmount) submitTitle = 'Payment amount is outside M-Pesa limits. Switch to Mock or adjust booking details.'
          else if (shouldShowStep2() && bookingStep === 'step2' && !categoryTimingsValid) submitTitle = 'Please set valid date and time for all categories'

          return (
            <Button
              onClick={submit}
              disabled={submitDisabled}
              className="bg-gradient-primary text-white"
              title={submitTitle}
            >
              {loading ? 'Processing...' : 'Confirm & Pay'}
            </Button>
          )
        })()}
      </div>
      {showFeeBreakdown && (
        <FeeBreakdownModal
          breakdown={{
            baseServiceAmount: baseAmount,
            platformChargeClient: feeBreakdown.platformChargeClient,
            compensationFee: feeBreakdown.compensationFee,
            maintenanceFee: feeBreakdown.maintenanceFee,
            vatAmount: feeBreakdown.vatAmount,
            commissionAmount: feeBreakdown.commissionAmount,
            platformFeeAmount: feeBreakdown.platformFeeAmount,
            transportFee: 0,
            clientTotal: feeBreakdown.clientTotal,
            trainerNetAmount: feeBreakdown.trainerNetAmount,
          }}
          onClose={() => setShowFeeBreakdown(false)}
        />
      )}
    </div>
  )
}
