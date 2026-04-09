import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, X, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import * as apiService from '@/lib/api-service'

interface UnratedSession {
  id: string
  booking_id?: string
  trainer_name: string
  trainer_id: string
  session_date: string
  total_amount: number
  [key: string]: any
}

interface UnratedSessionNoticeProps {
  bookings?: any[]
  onRateClick?: (booking: UnratedSession) => void
  onDismiss?: () => void
}

export const UnratedSessionNotice: React.FC<UnratedSessionNoticeProps> = ({
  bookings,
  onRateClick,
  onDismiss
}) => {
  const { user } = useAuth()
  const [unratedSessions, setUnratedSessions] = useState<UnratedSession[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Use provided bookings if available, otherwise fetch
  useEffect(() => {
    if (bookings) {
      deriveUnratedSessions(bookings)
    } else if (!user?.id) {
      return
    } else {
      loadUnratedSessions()
    }
  }, [user?.id, bookings])

  const deriveUnratedSessions = (bookingsData: any[]) => {
    console.log('Processing bookings:', bookingsData)
    const unrated = (bookingsData as any[])
      .filter(
        booking => {
          const isCompleted = booking.status === 'completed'
          const notRated = booking.rating_submitted === 0 || !booking.rating_submitted
          const noClientRating = booking.client_rating === null || !booking.client_rating

          console.log('Booking:', {
            id: booking.id,
            status: booking.status,
            isCompleted,
            rating_submitted: booking.rating_submitted,
            notRated,
            client_rating: booking.client_rating,
            noClientRating,
            passes: isCompleted && notRated && noClientRating
          })

          return isCompleted && notRated && noClientRating
        }
      )
      .map(booking => ({
        ...booking,
        id: booking.id || booking.booking_id,
        trainer_name: booking.trainer_name || 'Trainer',
        trainer_id: booking.trainer_id,
        session_date: booking.session_date,
        total_amount: booking.total_amount || 0,
      }))
    console.log('Filtered unrated sessions:', unrated)
    setUnratedSessions(unrated)
  }

  const loadUnratedSessions = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const bookingsData = await apiService.getBookings(user.id, 'client')
      if (bookingsData?.data) {
        deriveUnratedSessions(bookingsData.data)
      }
    } catch (err) {
      console.warn('Failed to load unrated sessions', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const handleRateClick = () => {
    if (unratedSessions.length > 0) {
      onRateClick?.(unratedSessions[currentIndex])
    }
  }

  const handleNext = () => {
    if (currentIndex < unratedSessions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  if (dismissed || unratedSessions.length === 0 || loading) {
    return null
  }

  const currentSession = unratedSessions[currentIndex]

  return (
    <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800 mb-4">
      <CardContent className="p-4">
        <div className="flex gap-4 items-start">
          <Star className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 fill-amber-600 dark:fill-amber-400" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
              Rate Your Session
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
              You have a completed session with <span className="font-medium">{currentSession.trainer_name}</span> on{' '}
              <span className="font-medium">
                {new Date(currentSession.session_date).toLocaleDateString()}
              </span>
              . Your feedback helps us improve the platform.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {unratedSessions.length} session{unratedSessions.length !== 1 ? 's' : ''} awaiting your rating
            </p>
          </div>
          <div className="flex gap-2 items-start flex-shrink-0">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleRateClick}
            >
              <Star className="h-4 w-4 mr-1" />
              Rate
            </Button>
            {unratedSessions.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleNext}
                className="border-amber-200 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleDismiss}
              className="border-amber-200 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {unratedSessions.length > 1 && (
          <div className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            {currentIndex + 1} of {unratedSessions.length} sessions
          </div>
        )}
      </CardContent>
    </Card>
  )
}
