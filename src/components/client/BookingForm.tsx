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

export const BookingForm: React.FC<{ trainer: any, trainerProfile?: any, onDone?: () => void }> = ({ trainer, trainerProfile, onDone }) => {
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
  const [isGroupTraining, setIsGroupTraining] = useState(false)
  const [groupSize, setGroupSize] = useState<number>(1)
  const [groupTrainingData, setGroupTrainingData] = useState<GroupPricingConfig | null>(null)
  const [selectedGroupTierName, setSelectedGroupTierName] = useState<string>('')
  const [trainerCategoryId, setTrainerCategoryId] = useState<number | null>(null)
  const [locationPreference, setLocationPreference] = useState<LocationPreference | null>(null)
  const [showLocationSelector, setShowLocationSelector] = useState(false)
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false)

  const computeBaseAmount = () => {
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
    return Number(trainer.hourlyRate || 0) * Number(sessions || 1)
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

  // Validate availability when date or time changes
  useEffect(() => {
    setAvailabilityError('')
    if (!date || !time) return

    const availability = trainerProfile?.availability
    if (!availability) return

    const selectedDate = new Date(date)
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const dayLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'long' })
    const slots = availability[dayName]

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      setAvailabilityError(`Trainer is not available on ${dayLabel}s. Please select a different date.`)
      return
    }

    const selectedHour = parseInt(time.split(':')[0])
    const selectedMinute = parseInt(time.split(':')[1])
    const selectedTimeInMinutes = selectedHour * 60 + selectedMinute

    const isAvailable = slots.some((slot: string) => {
      const [start, end] = slot.split('-')
      const [startHour, startMin] = start.split(':').map(Number)
      const [endHour, endMin] = end.split(':').map(Number)
      const startInMinutes = startHour * 60 + startMin
      const endInMinutes = endHour * 60 + endMin

      return selectedTimeInMinutes >= startInMinutes && selectedTimeInMinutes < endInMinutes
    })

    if (!isAvailable) {
      const availableSlotsFormatted = formatAvailableSlots(slots)
      setAvailabilityError(`This time is not available. Available slots: ${availableSlotsFormatted}`)
    }
  }, [date, time, trainerProfile?.availability])

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

  const submit = async () => {
    if (!user) return
    if (!date || !time) {
      toast({ title: 'Missing info', description: 'Please select date and time', variant: 'destructive' })
      return
    }
    if (availabilityError) {
      toast({ title: 'Invalid time', description: availabilityError, variant: 'destructive' })
      return
    }
    setLoading(true)
    const baseAmount = computeBaseAmount()
    let baseServiceAmount = baseAmount

    // Load client saved location to link to booking
    let clientLocation: { label?: string; lat?: number | null; lng?: number | null } = {}
    try {
      const prof = await apiRequest('profile_get', { user_id: user.id }, { headers: withAuth() })
      const label = (prof?.location_label as string) || (prof?.location as string) || ''
      const lat = prof?.location_lat != null ? Number(prof.location_lat) : null
      const lng = prof?.location_lng != null ? Number(prof.location_lng) : null
      clientLocation = { label, lat, lng }
    } catch {}


    const payload: any = {
      client_id: user.id,
      trainer_id: trainer.id,
      session_date: date,
      session_time: time,
      duration_hours: 1,
      total_sessions: sessions,
      status: 'pending',
      session_phase: 'waiting_start',
      base_service_amount: baseServiceAmount,
      notes: notes || `Session location preference: ${locationPreference?.label || 'Not specified'}${locationPreference?.customLocation ? ` (${locationPreference.customLocation})` : ''}`,
      session_location_preference: locationPreference?.type || null,
      session_location_custom: locationPreference?.customLocation || null,
      client_location_label: (clientLocation.label || null),
      client_location_lat: (clientLocation.lat != null ? clientLocation.lat : null),
      client_location_lng: (clientLocation.lng != null ? clientLocation.lng : null),
    }

    // Add group training data if applicable
    if (isGroupTraining && groupTrainingData) {
      payload.is_group_training = true
      payload.group_size = groupSize
      payload.group_size_tier_name = selectedGroupTierName
      payload.category_id = trainerCategoryId
      payload.pricing_model_used = groupTrainingData.pricing_model
    }

    try {
      // create booking using new booking_create action with server-side fee calculation
      const bookingResponse = await apiRequest('booking_create', payload, { headers: withAuth() })
      const bookingId = bookingResponse?.booking_id
      if (!bookingId) {
        throw new Error('Booking creation did not return a booking id')
      }
      const bookingData = { id: bookingId }
      const clientTotal = bookingResponse?.total_amount || 0
      const baseServiceAmount = bookingResponse?.base_service_amount || 0
      const transportFee = bookingResponse?.transport_fee || 0
      const platformFee = bookingResponse?.platform_charge_client || bookingResponse?.platform_fee || 0
      const vatAmount = bookingResponse?.vat_amount || 0
      const trainerNetAmount = bookingResponse?.trainer_net_amount || 0

      // in-app notifications: client, trainer, admins
      try {
        const trainerUserId = trainer.id
        const nowIso = new Date().toISOString()
        const notifRows: any[] = [
          {
            user_id: user.id,
            booking_id: bookingData?.id || null,
            title: 'Booking submitted',
            body: `Your session request for ${date} at ${time} has been created. Use in-app chat for safe communication and complaint follow-up.`,
            action_type: 'view_booking',
            type: 'booking',
            created_at: nowIso,
            read: false,
          },
          {
            user_id: trainerUserId,
            booking_id: bookingData?.id || null,
            title: 'New booking request',
            body: `A client requested ${date} at ${time}. Please review the booking and continue the conversation in-app if needed.`,
            action_type: 'view_booking',
            type: 'booking',
            created_at: nowIso,
            read: false,
          },
        ]
        try {
          const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
          for (const a of (admins || [])) notifRows.push({ user_id: a.user_id, booking_id: bookingData?.id || null, title: 'New booking', body: `Booking from ${user.email || user.id} to trainer ${trainer.name || trainer.id}.`, action_type: 'view_booking', type: 'booking', created_at: nowIso, read: false })
        } catch {}
        if (notifRows.length) await apiRequest('notifications_insert', { notifications: notifRows }, { headers: withAuth() })
      } catch (err) {
        console.warn('Notification insert failed', err)
      }

      const paymentCreatedAt = new Date().toISOString()
      const paymentBaseRecord = {
        booking_id: bookingData.id,
        client_id: user.id,
        trainer_id: trainer.id,
        amount: clientTotal,
        base_service_amount: baseServiceAmount,
        transport_fee: transportFee,
        platform_fee: platformFee,
        vat_amount: vatAmount,
        trainer_net_amount: trainerNetAmount,
        status: 'completed' as const,
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
            description: `The session cost (Ksh ${clientTotal}) is below the minimum M-Pesa payment of Ksh 5. Please check the trainer rate or session details.`,
            variant: 'destructive'
          })
          throw new Error(`Payment amount ${clientTotal} is below minimum of 5`)
        }

        if (clientTotal > 150000) {
          toast({
            title: 'Amount too high',
            description: `The session cost (Ksh ${clientTotal}) exceeds the maximum M-Pesa payment of Ksh 150,000. Please contact support or split the booking into smaller sessions.`,
            variant: 'destructive'
          })
          throw new Error(`Payment amount ${clientTotal} exceeds maximum of 150000`)
        }

        toast({ title: 'M-Pesa STK', description: 'Check your phone and enter PIN to approve.' })

        const paymentResult = await processBookingPayment({
          phone: mpesaPhone,
          amount: clientTotal,
          bookingId,
          clientId: user.id,
          trainerId: trainer.id,
          accountReference: bookingId,
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
      } else {
        const mockResult = await completeMockPayment(paymentBaseRecord, bookingId)
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
            body: JSON.stringify({ type: 'booking_created', booking: bookingData, payer: paymentRecord }),
          })
        }
      } catch (err) {
        console.warn('Zapier webhook error', err)
      }

      // Navigate to booking confirmation page with booking details
      const bookingConfirmationState = {
        bookingId: bookingId,
        trainerName: trainer.name || 'Trainer',
        date,
        time,
        sessions,
        totalAmount: clientTotal,
        disciplineName: trainer.disciplineName,
        location: clientLocation.label,
        notes,
      }

      navigate(`/booking-confirmation/${bookingId}`, { state: bookingConfirmationState })
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
            ? 'The session cost is too low for M-Pesa payment (minimum Ksh 5). Please use Mock payment or check trainer rates.'
            : 'The session cost is too high for M-Pesa payment (maximum Ksh 150,000). Please contact support.',
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

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-1 gap-3 flex-1 overflow-y-auto pr-2">
        <div>
          <Label>Session Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Session Time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          {availabilityError && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{availabilityError}</div>}
        </div>
        <div>
          <Label>Number of Sessions</Label>
          <Input type="number" min={1} value={String(sessions)} onChange={(e) => setSessions(Number(e.target.value))} />
        </div>

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
          <Label className="mb-2 block">Session Location Preference</Label>
          {!showLocationSelector ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLocationSelector(true)}
              className="w-full justify-start"
            >
              {locationPreference ? `✓ ${locationPreference.label}${locationPreference.customLocation ? ` (${locationPreference.customLocation})` : ''}` : 'Select location preference'}
            </Button>
          ) : (
            <div className="p-3 border border-border rounded-md bg-muted/5">
              <LocationPreferenceSelector
                value={locationPreference || undefined}
                onChange={setLocationPreference}
                onClose={() => setShowLocationSelector(false)}
              />
            </div>
          )}
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
            <Label>M-Pesa Phone Number</Label>
            <Input value={mpesaPhone} onChange={(e)=>setMpesaPhone(e.target.value)} placeholder="254712345678 or 0712345678" />
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
              <div className="flex justify-between"><span>Rate</span><span className="font-semibold">Ksh {Number(trainer.hourlyRate || 0)}/hr</span></div>
            </>
          )}
          <div className="flex justify-between"><span>Sessions</span><span className="font-semibold">{sessions}</span></div>
          <div className="flex justify-between"><span>Base Service Amount</span><span className="font-semibold">Ksh {baseAmount}</span></div>
          <div className="border-t border-border my-2 pt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">Fee Breakdown:</span>
              <button
                type="button"
                onClick={() => setShowFeeBreakdown(true)}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                View Details
              </button>
            </div>
            <div className="flex justify-between text-xs"><span>Platform Charge (Client)</span><span>Ksh {feeBreakdown.platformChargeClient}</span></div>
            <div className="flex justify-between text-xs"><span>Compensation Fee</span><span>Ksh {feeBreakdown.compensationFee}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Maintenance Fee (system revenue)</span><span>Ksh {feeBreakdown.maintenanceFee}</span></div>
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
      <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4 flex-shrink-0">
        <Button variant="outline" onClick={() => onDone?.()}>Cancel</Button>
        {(() => {
          const isInvalidMpesaAmount = payMethod === 'mpesa' && (feeBreakdown.clientTotal < 5 || feeBreakdown.clientTotal > 150000)
          const submitDisabled = loading || !!availabilityError || isInvalidMpesaAmount
          let submitTitle = ''
          if (availabilityError) submitTitle = 'Please select a valid date and time'
          else if (isInvalidMpesaAmount) submitTitle = 'Payment amount is outside M-Pesa limits. Switch to Mock or adjust booking details.'

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
            transportFee: 0,
            clientTotal: feeBreakdown.clientTotal,
          }}
          onClose={() => setShowFeeBreakdown(false)}
        />
      )}
    </div>
  )
}
