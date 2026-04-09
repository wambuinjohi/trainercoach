import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Star } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export const ReviewModal: React.FC<{ booking: any, onClose?: () => void, onSubmitted?: () => Promise<void> | void }> = ({ booking, onClose, onSubmitted }) => {
  const { user } = useAuth()
  const [coachRating, setCoachRating] = useState<number>(5)
  const [coachHover, setCoachHover] = useState<number>(0)
  const [appRating, setAppRating] = useState<number>(5)
  const [appHover, setAppHover] = useState<number>(0)
  const [coachReview, setCoachReview] = useState('')
  const [appReview, setAppReview] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!user || !booking) return

    // Prevent double submission
    if (loading) return

    setLoading(true)
    try {
      // Check if review already exists for this booking
      try {
        const existingReviews = await apiRequest('select', {
          table: 'reviews',
          where: `booking_id = '${booking.id}' AND client_id = '${user.id}'`
        }, { headers: withAuth() })

        if (existingReviews?.data && existingReviews.data.length > 0) {
          toast({ title: 'Already reviewed', description: 'You have already submitted a review for this session.', variant: 'destructive' })
          onClose?.()
          return
        }
      } catch (err) {
        console.warn('Failed to check existing reviews', err)
      }

      // Submit coach review to reviews table
      const coachReviewPayload: any = {
        booking_id: booking.id,
        client_id: user.id,
        trainer_id: booking.trainer_id,
        rating: coachRating,
        comment: coachReview || null,
        created_at: new Date().toISOString(),
      }
      console.log('Submitting coach review with payload:', coachReviewPayload)
      await apiRequest('review_insert', coachReviewPayload, { headers: withAuth() })

      // Update booking with app rating and review
      await apiRequest('update', {
        table: 'bookings',
        data: {
          app_rating: appRating,
          app_review: appReview || null,
          coach_rating: coachRating,
          coach_review: coachReview || null,
          rating_submitted: true,
          updated_at: new Date().toISOString(),
        },
        where: `id = '${booking.id}'`,
      }, { headers: withAuth() })

      try {
        // update aggregate rating for trainer if possible
        const stats = await apiRequest('reviews_get', { trainer_id: booking.trainer_id }, { headers: withAuth() })
        const ratings = (stats || []).map((r: any) => Number(r.rating) || 0)
        if (ratings.length > 0) {
          const avg = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          await apiRequest('profile_update', { user_id: booking.trainer_id, rating: avg, total_reviews: ratings.length }, { headers: withAuth() })
        }
      } catch {}

      toast({ title: 'Thank you!', description: 'Your feedback has been submitted successfully.' })
      await Promise.resolve(onSubmitted?.())
      onClose?.()
    } catch (err: any) {
      toast({ title: 'Failed to submit feedback', description: err?.message || 'Please try again', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const StarRating = ({ rating, hover, onHover, setHover, onChange }: any) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          aria-label={`Rate ${i}`}
          className="p-1 transition-transform hover:scale-110"
        >
          <Star
            className={`h-6 w-6 ${
              (hover || rating) >= i
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="relative w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
        <Card className="rounded-none sm:rounded-lg">
          <CardHeader className="p-4 sm:p-6 border-b">
            <CardTitle>Share Your Feedback</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Help us improve by rating your experience</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Coach Rating */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-semibold">How would you rate your coach?</Label>
                  <p className="text-sm text-muted-foreground mt-1">Rate {booking.trainer_name || 'your trainer'}'s professionalism and skill</p>
                </div>
                <StarRating
                  rating={coachRating}
                  hover={coachHover}
                  onHover={setCoachHover}
                  setHover={setCoachHover}
                  onChange={setCoachRating}
                />
              </div>

              {/* Coach Review */}
              <div className="space-y-2">
                <Label htmlFor="coach-review" className="text-sm">Review (optional)</Label>
                <Textarea
                  id="coach-review"
                  value={coachReview}
                  onChange={(e) => setCoachReview(e.target.value)}
                  placeholder="Share your experience with the coach..."
                  className="min-h-20"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* App Rating */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-semibold">How would you rate this app?</Label>
                  <p className="text-sm text-muted-foreground mt-1">Help us improve our platform</p>
                </div>
                <StarRating
                  rating={appRating}
                  hover={appHover}
                  onHover={setAppHover}
                  setHover={setAppHover}
                  onChange={setAppRating}
                />
              </div>

              {/* App Review */}
              <div className="space-y-2">
                <Label htmlFor="app-review" className="text-sm">Recommendations (optional)</Label>
                <Textarea
                  id="app-review"
                  value={appReview}
                  onChange={(e) => setAppReview(e.target.value)}
                  placeholder="Tell us what we can improve..."
                  className="min-h-20"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Skip for now
                </Button>
                <Button
                  className="bg-gradient-primary text-white"
                  onClick={submit}
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
