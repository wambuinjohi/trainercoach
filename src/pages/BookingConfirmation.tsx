import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { BookingSession } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, MapPin, Clock, Users, DollarSign, MessageSquare, ArrowLeft, Send, AlertCircle } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Chat } from '@/components/client/Chat'
import * as apiService from '@/lib/api-service'
import { toast } from '@/hooks/use-toast'
import { retryPayment } from '@/lib/payment-service'

interface BookingConfirmationState {
  bookingId: string
  trainerName: string
  date: string
  time: string
  sessions: BookingSession[]
  totalAmount: number
  disciplineName?: string
  location?: string
  notes?: string
}

export default function BookingConfirmation() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [bookingData, setBookingData] = useState<any>(null)
  const [trainerProfile, setTrainerProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [trainerConfirmationStatus, setTrainerConfirmationStatus] = useState<'pending' | 'confirmed' | 'declined' | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | null>(null)
  const [alternativeTrainers, setAlternativeTrainers] = useState<any[]>([])
  const [loadingAlternatives, setLoadingAlternatives] = useState(false)
  const [pollingActive, setPollingActive] = useState(true)
  const [paymentPollingActive, setPaymentPollingActive] = useState(true)
  const [retryLoading, setRetryLoading] = useState(false)

  // Get booking details from location state or fetch from API
  const locationState = location.state as BookingConfirmationState | null

  // Function to fetch alternative trainers by same criteria
  const fetchAlternativeTrainers = async (declinedTrainerId: string, discipline?: string) => {
    if (!discipline) return

    setLoadingAlternatives(true)
    try {
      const response = await apiRequest(
        'trainers_get',
        { discipline, exclude_trainer_id: declinedTrainerId },
        { headers: withAuth() }
      )

      if (response && Array.isArray(response.data)) {
        setAlternativeTrainers(response.data.slice(0, 5)) // Show top 5 alternatives
      }
    } catch (err) {
      console.warn('Failed to fetch alternative trainers:', err)
    } finally {
      setLoadingAlternatives(false)
    }
  }

  // Handle payment retry
  const handleRetryPayment = async () => {
    if (!bookingId || !bookingData) return

    setRetryLoading(true)
    setPaymentStatus('processing')

    try {
      const paymentRecord = {
        booking_id: bookingId,
        client_id: user?.id || '',
        trainer_id: bookingData.trainer_id,
        amount: displayData?.totalAmount || bookingData.total_amount || 0,
        base_service_amount: bookingData.base_service_amount || 0,
        transport_fee: bookingData.transport_fee || 0,
        platform_fee: bookingData.platform_fee_amount || bookingData.platform_fee || 0,
        vat_amount: bookingData.vat_amount || 0,
        trainer_net_amount: bookingData.trainer_net_amount || 0,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
      }

      // Get phone number - try to get it from user profile
      let phone = ''
      try {
        const profile = await apiRequest('profile_get', { user_id: user?.id }, { headers: withAuth() })
        phone = profile?.phone || profile?.phone_number || ''
      } catch {
        // Phone not found in profile, will prompt user
      }

      if (!phone) {
        toast({
          title: 'Phone required',
          description: 'Please provide your M-Pesa phone number to retry payment.',
          variant: 'destructive'
        })
        setPaymentStatus('failed')
        setRetryLoading(false)
        return
      }

      const result = await retryPayment({
        phone,
        amount: paymentRecord.amount,
        bookingId,
        clientId: user?.id,
        trainerId: bookingData.trainer_id,
        accountReference: bookingId,
        paymentRecord,
      })

      if (!result.success) {
        toast({
          title: 'Retry failed',
          description: result.error || 'Failed to retry payment. Please try again.',
          variant: 'destructive'
        })
        setPaymentStatus('failed')
      } else {
        toast({
          title: 'Payment retry initiated',
          description: 'Check your phone and enter your M-Pesa PIN.',
        })
        // Payment status will be updated by polling
        setPaymentPollingActive(true)
      }
    } catch (err) {
      console.error('Payment retry error:', err)
      toast({
        title: 'Error',
        description: 'An error occurred while retrying payment.',
        variant: 'destructive'
      })
      setPaymentStatus('failed')
    } finally {
      setRetryLoading(false)
    }
  }

  const displayData = locationState || bookingData

  useEffect(() => {
    const fetchBookingDetails = async () => {
      if (!bookingId) {
        setError('No booking ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // Fetch booking details from API using dedicated booking_get action
        const response = await apiRequest(
          'booking_get',
          { id: bookingId },
          { headers: withAuth() }
        )

        if (response && response.id) {
          setBookingData(response)

          // Track payment status
          const paymentStat = response.payment_status || 'pending'
          setPaymentStatus(paymentStat as any)

          // Stop polling if payment is completed or failed
          if (paymentStat === 'completed' || paymentStat === 'failed') {
            setPaymentPollingActive(false)
          }

          // Determine trainer confirmation status
          if (response.status === 'confirmed') {
            setTrainerConfirmationStatus('confirmed')
            setPollingActive(false) // Stop polling once confirmed
            toast({
              title: 'Booking Confirmed!',
              description: 'Your trainer has confirmed the session. You can now proceed with preparation.',
            })
          } else if (response.status === 'cancelled' || response.status === 'declined') {
            setTrainerConfirmationStatus('declined')
            setPollingActive(false) // Stop polling once declined
            toast({
              title: 'Booking Not Confirmed',
              description: 'The trainer has not confirmed this booking. Please select another trainer.',
              variant: 'destructive'
            })
            // Fetch alternative trainers
            await fetchAlternativeTrainers(response.trainer_id, response.discipline || locationState?.disciplineName)
          } else {
            setTrainerConfirmationStatus('pending')
          }

          // Fetch trainer profile
          const trainerResponse = await apiRequest(
            'profile_get',
            { user_id: response.trainer_id },
            { headers: withAuth() }
          )
          setTrainerProfile(trainerResponse)
        } else {
          setError('Booking not found')
        }
      } catch (err) {
        console.error('Error fetching booking details:', err)
        setError(err instanceof Error ? err.message : 'Failed to load booking details')
      } finally {
        setLoading(false)
      }
    }

    fetchBookingDetails()
  }, [bookingId])

  // Polling effect to check for trainer confirmation status changes
  useEffect(() => {
    if (!bookingId || !pollingActive || trainerConfirmationStatus !== 'pending') return

    const pollInterval = setInterval(async () => {
      try {
        const response = await apiRequest(
          'booking_get',
          { id: bookingId },
          { headers: withAuth() }
        )

        if (response && response.status && response.status !== 'pending') {
          // Status has changed!
          if (response.status === 'confirmed') {
            setTrainerConfirmationStatus('confirmed')
            setPollingActive(false)
            toast({
              title: 'Booking Confirmed!',
              description: 'Your trainer has confirmed the session. You can now proceed with preparation.',
            })
          } else if (response.status === 'cancelled' || response.status === 'declined') {
            setTrainerConfirmationStatus('declined')
            setPollingActive(false)
            toast({
              title: 'Trainer Did Not Confirm',
              description: 'The trainer failed to confirm attendance. Please select another coach from the profiles below.',
              variant: 'destructive'
            })
            // Fetch alternative trainers
            await fetchAlternativeTrainers(response.trainer_id, response.discipline || bookingData?.discipline)
          }

          setBookingData(response)
        }
      } catch (err) {
        console.warn('Polling error:', err)
      }
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(pollInterval)
  }, [bookingId, pollingActive, trainerConfirmationStatus, bookingData?.discipline])

  // Payment status polling effect
  useEffect(() => {
    if (!bookingId || !paymentPollingActive || paymentStatus === 'completed' || paymentStatus === 'failed') return

    const paymentPollInterval = setInterval(async () => {
      try {
        const response = await apiRequest(
          'booking_get',
          { id: bookingId },
          { headers: withAuth() }
        )

        if (response && response.payment_status) {
          const newPaymentStatus = response.payment_status

          if (newPaymentStatus !== paymentStatus) {
            setPaymentStatus(newPaymentStatus)
            setBookingData(response)

            if (newPaymentStatus === 'completed') {
              setPaymentPollingActive(false)
              toast({
                title: 'Payment Successful!',
                description: 'Your payment has been processed successfully.',
              })
            } else if (newPaymentStatus === 'failed') {
              setPaymentPollingActive(false)
              toast({
                title: 'Payment Failed',
                description: 'Your payment could not be processed. Please try again.',
                variant: 'destructive'
              })
            }
          }
        }
      } catch (err) {
        console.warn('Payment polling error:', err)
      }
    }, 3000) // Poll every 3 seconds for faster payment status updates

    return () => clearInterval(paymentPollInterval)
  }, [bookingId, paymentPollingActive, paymentStatus])

  const bookingSessions = (() => {
    const sessionsValue = displayData?.sessions
    if (Array.isArray(sessionsValue)) return sessionsValue as BookingSession[]
    if (typeof sessionsValue === 'string' && sessionsValue.trim()) {
      try {
        const parsed = JSON.parse(sessionsValue)
        return Array.isArray(parsed) ? parsed as BookingSession[] : []
      } catch {
        return []
      }
    }
    return []
  })()
  const primarySession = bookingSessions[0]
  const sessionDateValue = primarySession?.date || displayData?.date || displayData?.session_date
  const sessionCount = bookingSessions.length || displayData?.total_sessions || 1
  const totalBookedHours = bookingSessions.reduce((sum, session) => sum + Number(session.duration_hours || 0), 0)
  const formattedDate = sessionDateValue ? new Date(`${sessionDateValue}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : 'TBD'

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 animate-pulse"></div>
          <p className="text-muted-foreground">Loading booking details...</p>
        </div>
      </div>
    )
  }

  if (error || !displayData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error || 'Unable to load booking details'}</p>
            <Button onClick={() => navigate('/client')} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/client')}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Booking Confirmation</h1>
        </div>

        {/* Payment Status Card - Dynamic based on payment_status */}
        {paymentStatus === 'completed' && (
          <Card className="mb-6 border-2 border-green-500/30 bg-green-50/5 dark:bg-green-950/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <CardTitle>Booking confirmed and payment processed!</CardTitle>
                  <CardDescription>
                    Your session has been booked and payment has been completed. The trainer will confirm and contact you shortly.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {displayData.totalAmount && (
              <CardContent className="border-t border-green-500/20 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Payment Status:</span>
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    Completed
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-medium">Amount Paid:</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    KES {displayData.totalAmount.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {paymentStatus === 'processing' && (
          <Card className="mb-6 border-2 border-blue-500/30 bg-blue-50/5 dark:bg-blue-950/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin flex-shrink-0"></div>
                <div>
                  <CardTitle>Processing payment...</CardTitle>
                  <CardDescription>
                    We're processing your M-Pesa payment. Please enter your M-Pesa PIN when prompted on your phone.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {displayData.totalAmount && (
              <CardContent className="border-t border-blue-500/20 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Amount:</span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    KES {displayData.totalAmount.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Payment status will update automatically. Do not refresh this page.
                </p>
              </CardContent>
            )}
          </Card>
        )}

        {paymentStatus === 'failed' && (
          <Card className="mb-6 border-2 border-red-500/30 bg-red-50/5 dark:bg-red-950/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div>
                  <CardTitle>Payment failed</CardTitle>
                  <CardDescription>
                    Your payment could not be processed. Our system will automatically retry with exponential backoff, or you can retry immediately.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {displayData.totalAmount && (
              <CardContent className="border-t border-red-500/20 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Amount:</span>
                  <span className="text-xl font-bold text-red-600 dark:text-red-400">
                    KES {displayData.totalAmount.toLocaleString()}
                  </span>
                </div>

                {bookingData?.retry_count !== undefined && (
                  <div className="flex items-center justify-between pt-2 border-t border-red-500/10">
                    <span className="text-sm text-muted-foreground">Retry attempts:</span>
                    <span className="text-sm font-medium">{bookingData.retry_count}/10</span>
                  </div>
                )}

                {bookingData?.next_retry_at && (
                  <div className="flex items-center justify-between pt-2 border-t border-red-500/10">
                    <span className="text-sm text-muted-foreground">Next auto-retry:</span>
                    <span className="text-sm font-medium">
                      {new Date(bookingData.next_retry_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>
                )}

                <p className="text-xs text-muted-foreground pt-2">
                  💡 The system uses exponential backoff to automatically retry your payment. You can also retry immediately below.
                </p>

                <Button
                  onClick={handleRetryPayment}
                  disabled={retryLoading}
                  className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                >
                  {retryLoading ? 'Retrying...' : 'Retry Payment Now'}
                </Button>
              </CardContent>
            )}
          </Card>
        )}

        {paymentStatus === 'pending' && (
          <Card className="mb-6 border-2 border-amber-500/30 bg-amber-50/5 dark:bg-amber-950/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <CardTitle>Payment pending</CardTitle>
                  <CardDescription>
                    Your booking has been created. Please proceed with payment to complete the booking.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {displayData.totalAmount && (
              <CardContent className="border-t border-amber-500/20 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Amount to Pay:</span>
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    KES {displayData.totalAmount.toLocaleString()}
                  </span>
                </div>
                <Button
                  onClick={handleRetryPayment}
                  disabled={retryLoading}
                  className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                >
                  {retryLoading ? 'Processing...' : 'Proceed to Payment'}
                </Button>
              </CardContent>
            )}
          </Card>
        )}

        {/* Booking Details */}
        <div className="space-y-4">
          {/* Trainer Confirmation Status */}
          {trainerConfirmationStatus && (
            <Card className={
              trainerConfirmationStatus === 'confirmed'
                ? 'border-green-500/30 bg-green-50/5 dark:bg-green-950/10'
                : trainerConfirmationStatus === 'declined'
                ? 'border-red-500/30 bg-red-50/5 dark:bg-red-950/10'
                : 'border-blue-500/30 bg-blue-50/5 dark:bg-blue-950/10'
            }>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {trainerConfirmationStatus === 'confirmed' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Trainer Confirmed Attendance
                      </>
                    ) : trainerConfirmationStatus === 'declined' ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        Trainer Failed To Confirm Attendance
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-blue-600" />
                        Waiting For Trainer To Confirm Attendance
                      </>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {trainerConfirmationStatus === 'confirmed'
                    ? 'Your trainer has confirmed the session. If you would like to talk to the trainer, kindly press the chat button.'
                    : trainerConfirmationStatus === 'declined'
                    ? 'The trainer failed to confirm attendance. Kindly select another coach from the profiles below who are of the same criteria.'
                    : 'The trainer is reviewing your request. You will be notified once they confirm attendance. Use in-app chat for communication.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Trainer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trainer Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{displayData.trainerName || trainerProfile?.name || 'Trainer'}</h3>
                  {displayData.disciplineName && (
                    <p className="text-sm text-muted-foreground">{displayData.disciplineName}</p>
                  )}
                </div>
                <Badge variant={trainerConfirmationStatus === 'confirmed' ? 'default' : 'secondary'}>
                  {trainerConfirmationStatus === 'confirmed' ? 'Confirmed' : 'Pending Review'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {trainerConfirmationStatus === 'confirmed'
                  ? 'Your trainer has confirmed this booking and is ready to begin.'
                  : 'The trainer will review your booking request and send you a confirmation.'}
              </p>
              <button
                onClick={() => setShowChat(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm font-medium transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Open Chat with Trainer
              </button>
            </CardContent>
          </Card>

          {/* Session Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date and Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Session Date & Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookingSessions.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">First session</p>
                      <p className="font-semibold">
                        {formattedDate} • {primarySession?.start_time} - {primarySession?.end_time}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {bookingSessions.slice(0, 3).map((session, index) => {
                        const sessionLabel = new Date(`${session.date}T00:00:00`).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })
                        return (
                          <div key={`${session.date}-${session.start_time}-${index}`} className="rounded-md border border-border bg-muted/20 p-2 text-sm">
                            <div className="font-medium">Session {index + 1}</div>
                            <div className="text-muted-foreground">
                              {sessionLabel} • {session.start_time} - {session.end_time}
                            </div>
                          </div>
                        )
                      })}
                      {bookingSessions.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{bookingSessions.length - 3} more sessions</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="font-semibold">{formattedDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Time</p>
                      <p className="font-semibold">{displayData.time || displayData.session_time}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Number of Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{sessionCount}</p>
                <p className="text-xs text-muted-foreground">
                  {bookingSessions.length > 0 ? `${totalBookedHours.toFixed(1)} total hours` : '1 hour each'}
                </p>
              </CardContent>
            </Card>

            {/* Location */}
            {(displayData.location || displayData.client_location_label) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">{displayData.location || displayData.client_location_label}</p>
                </CardContent>
              </Card>
            )}

            {/* Payment Receipt */}
            {displayData.totalAmount && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Payment Receipt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount Paid</span>
                      <span className="font-semibold">KES {displayData.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payment Method</span>
                      <span className="font-semibold">M-Pesa/Mobile Money</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
                        ✓ Completed
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                      Your payment has been successfully processed and credited to the trainer.
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Notes */}
          {displayData.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Additional Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">{displayData.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Alternative Trainers (shown when booking is declined) */}
          {trainerConfirmationStatus === 'declined' && (
            <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/5 dark:bg-amber-950/10">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Other Available Coaches With Same Criteria
                </CardTitle>
                <CardDescription>
                  Choose from these coaches who specialize in the same discipline
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAlternatives ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="text-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-primary mx-auto mb-2 animate-pulse"></div>
                      <p className="text-xs text-muted-foreground">Finding alternative coaches...</p>
                    </div>
                  </div>
                ) : alternativeTrainers.length > 0 ? (
                  <div className="space-y-3">
                    {alternativeTrainers.map((trainer: any) => (
                      <div key={trainer.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                            {trainer.name ? trainer.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{trainer.name || 'Coach'}</h4>
                            <p className="text-xs text-muted-foreground">
                              {trainer.discipline || displayData.disciplineName}
                            </p>
                            {trainer.rating && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-xs text-yellow-600 dark:text-yellow-400">★ {trainer.rating}</span>
                                <span className="text-xs text-muted-foreground">({trainer.reviews || 0} reviews)</span>
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-sm">Ksh {trainer.hourlyRate || 0}/hr</p>
                            <Button
                              size="sm"
                              onClick={() => navigate(`/trainer/${trainer.id}`)}
                              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                            >
                              Book Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No alternative coaches found at the moment. Please try again later.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Next Steps - conditional based on status */}
          {trainerConfirmationStatus !== 'declined' ? (
            <Card className="bg-blue-50/5 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/50">
              <CardHeader>
                <CardTitle className="text-sm">What happens next?</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm">
                  {trainerConfirmationStatus === 'pending' ? (
                    <>
                      <li className="flex gap-3">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">1.</span>
                        <span>The trainer will review your booking request</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">2.</span>
                        <span>You'll receive a notification once they confirm attendance</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">3.</span>
                        <span>Use in-app chat to communicate with the trainer before the session</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">4.</span>
                        <span>Show up for your training session at the scheduled time</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex gap-3">
                        <span className="font-semibold text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                        <span>Trainer has confirmed your session</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-semibold text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                        <span>Payment has been processed and credited to the trainer</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">3.</span>
                        <span>If you would like to talk to the trainer, kindly press the chat button</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">4.</span>
                        <span>Show up for your training session at the scheduled time</span>
                      </li>
                    </>
                  )}
                </ol>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-red-50/5 dark:bg-red-950/10 border-red-200/50 dark:border-red-800/50">
              <CardHeader>
                <CardTitle className="text-sm">What to do now?</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="font-semibold text-red-600 dark:text-red-400 flex-shrink-0">1.</span>
                    <span>Select another coach from the list above who matches your needs</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">2.</span>
                    <span>Your payment has been credited to your account and can be used for a new booking</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">3.</span>
                    <span>Click "Book Now" to book a session with your new coach</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons - conditional based on status */}
          {trainerConfirmationStatus !== 'declined' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/client')}
                className="w-full"
              >
                Back to Dashboard
              </Button>
              {trainerConfirmationStatus === 'confirmed' && (
                <Button
                  onClick={() => setShowChat(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat With Trainer
                </Button>
              )}
              <Button
                onClick={() => navigate(`/client?tab=bookings&booking=${bookingId}`)}
                className="w-full"
              >
                View Booking Details
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/client')}
                className="w-full"
              >
                Back to Dashboard
              </Button>
              <Button
                onClick={() => navigate('/search')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Find More Coaches
              </Button>
            </div>
          )}

          {/* Safety Reminder */}
          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200 mb-2">Safety Reminder</p>
            <p className="text-amber-800 dark:text-amber-300">
              All communication with your trainer should happen through the app for safety and dispute resolution purposes. Never share payment details outside the app.
            </p>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {showChat && displayData && (
        <Chat
          trainer={{
            id: displayData.trainerId || bookingData?.trainer_id,
            name: displayData.trainerName || trainerProfile?.name || 'Trainer',
          }}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  )
}
