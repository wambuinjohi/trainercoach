import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Star, CheckCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { Booking } from '@/types'

interface TrainerRatingModalProps {
  booking: Booking
  onConfirm?: () => void
  onDismiss?: () => void
}

export const TrainerRatingModal: React.FC<TrainerRatingModalProps> = ({
  booking,
  onConfirm,
  onDismiss,
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [clientRating, setClientRating] = useState(5)
  const [appRating, setAppRating] = useState(5)
  const [review, setReview] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!user || !booking?.id) return

    setLoading(true)
    try {
      // Insert trainer rating
      const response = await apiService.makeRequest('trainer_rating_insert', {
        booking_id: booking.id,
        trainer_id: user.id,
        client_rating: clientRating,
        app_rating: appRating,
        review: review || null,
      })

      toast({
        title: 'Rating Submitted',
        description: 'Thank you for your feedback!',
      })

      setSubmitted(true)
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onConfirm?.()
        onDismiss?.()
      }, 2000)
    } catch (err: any) {
      console.error('Rating submission error:', err)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to submit rating',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const renderStars = (rating: number, onRate: (rating: number) => void) => {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onRate(star)}
            className="focus:outline-none"
          >
            <Star
              className={`h-8 w-8 ${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              } cursor-pointer hover:fill-yellow-400 hover:text-yellow-400 transition-colors`}
            />
          </button>
        ))}
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40">
        <Card className="w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
          <CardContent className="p-4 sm:p-6 space-y-4 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Thank You!</h2>
            <p className="text-muted-foreground">
              Your feedback has been recorded successfully.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40">
      <Card className="w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Rate This Session</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Please rate your experience with this client and the app. Your feedback helps us improve.
            </p>
          </div>

          {booking?.full_name && (
            <div className="text-sm">
              <p className="text-muted-foreground">Client:</p>
              <p className="font-semibold">{booking.full_name}</p>
            </div>
          )}

          {/* Client Rating */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">How would you rate this client?</label>
              <p className="text-xs text-muted-foreground">1 = Poor, 5 = Excellent</p>
            </div>
            {renderStars(clientRating, setClientRating)}
            <p className="text-sm text-right text-muted-foreground">
              {clientRating}/5
            </p>
          </div>

          {/* App Rating */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">How would you rate this app?</label>
              <p className="text-xs text-muted-foreground">1 = Poor, 5 = Excellent</p>
            </div>
            {renderStars(appRating, setAppRating)}
            <p className="text-sm text-right text-muted-foreground">
              {appRating}/5
            </p>
          </div>

          {/* Review */}
          <div className="space-y-2">
            <label htmlFor="review" className="text-sm font-semibold">
              Review and Recommendations (Optional)
            </label>
            <textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your feedback about the session, client behavior, app experience, or any recommendations..."
              className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
              rows={4}
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onDismiss}
              disabled={loading}
            >
              Skip
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
