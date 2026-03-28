import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { BookingSession } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, MapPin, Clock, Users, DollarSign, MessageSquare, ArrowLeft, Send } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Chat } from '@/components/client/Chat'

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

  // Get booking details from location state or fetch from API
  const locationState = location.state as BookingConfirmationState | null

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

          // Determine trainer confirmation status
          if (response.status === 'confirmed') {
            setTrainerConfirmationStatus('confirmed')
          } else if (response.status === 'cancelled' || response.status === 'declined') {
            setTrainerConfirmationStatus('declined')
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

  const displayData = locationState || bookingData
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

        {/* Success Card */}
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
                        Trainer Confirmed
                      </>
                    ) : trainerConfirmationStatus === 'declined' ? (
                      <>
                        <span className="text-lg">✗</span>
                        Trainer Declined
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-blue-600" />
                        Waiting for Trainer Confirmation
                      </>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {trainerConfirmationStatus === 'confirmed'
                    ? 'Your trainer has confirmed this booking. You can now proceed with preparation for the session.'
                    : trainerConfirmationStatus === 'declined'
                    ? 'Your trainer has declined this booking. Please try booking with another trainer or adjust your preferred time.'
                    : 'The trainer is reviewing your request. You\'ll receive a notification once they respond. Use the chat to discuss details.'}
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

          {/* Next Steps */}
          <Card className="bg-blue-50/5 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/50">
            <CardHeader>
              <CardTitle className="text-sm">What happens next?</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">1.</span>
                  <span>The trainer will review your booking request</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">2.</span>
                  <span>You'll receive a notification once they confirm</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">3.</span>
                  <span>Use in-app chat to communicate before the session</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">4.</span>
                  <span>Show up for your training session at the scheduled time</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate('/client')}
              className="w-full"
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={() => setShowChat(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat Now
            </Button>
            <Button
              onClick={() => navigate(`/client?tab=bookings&booking=${bookingId}`)}
              className="w-full"
            >
              View Booking Details
            </Button>
          </div>

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
