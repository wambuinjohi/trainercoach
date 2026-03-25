import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, MapPin, Clock, Users, DollarSign, MessageSquare, ArrowLeft } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface BookingConfirmationState {
  bookingId: string
  trainerName: string
  date: string
  time: string
  sessions: number
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
        // Fetch booking details from API
        const response = await apiRequest(
          'select',
          {
            table: 'bookings',
            where: `id = '${bookingId}'`,
          },
          { headers: withAuth() }
        )

        if (response && response.length > 0) {
          const booking = response[0]
          setBookingData(booking)

          // Fetch trainer profile
          const trainerResponse = await apiRequest(
            'profile_get',
            { user_id: booking.trainer_id },
            { headers: withAuth() }
          )
          setTrainerProfile(trainerResponse)
        } else {
          setError('Booking not found')
        }
      } catch (err) {
        console.error('Error fetching booking details:', err)
        setError('Failed to load booking details')
      } finally {
        setLoading(false)
      }
    }

    fetchBookingDetails()
  }, [bookingId])

  const displayData = locationState || bookingData

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

  const sessionDate = new Date(displayData.date || displayData.session_date)
  const formattedDate = sessionDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

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
                <CardTitle>Your booking has been submitted!</CardTitle>
                <CardDescription>
                  The trainer will review your request and confirm the session
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Booking Details */}
        <div className="space-y-4">
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
                <Badge variant="secondary">Pending Review</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                The trainer will review your booking request and send you a confirmation.
              </p>
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
                <p className="text-3xl font-bold">{displayData.sessions || displayData.total_sessions || 1}</p>
                <p className="text-xs text-muted-foreground">1 hour each</p>
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

            {/* Total Amount */}
            {displayData.totalAmount && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Total Amount
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">KES {displayData.totalAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Payment completed</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate('/client')}
              className="w-full"
            >
              Back to Dashboard
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
    </div>
  )
}
