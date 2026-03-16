import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Star } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export const ReviewModal: React.FC<{ booking: any, onClose?: () => void, onSubmitted?: () => Promise<void> | void }> = ({ booking, onClose, onSubmitted }) => {
  const { user } = useAuth()
  const [rating, setRating] = useState<number>(5)
  const [hover, setHover] = useState<number>(0)
  const [comment, setComment] = useState('')
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

      const payload: any = {
        booking_id: booking.id,
        client_id: user.id,
        trainer_id: booking.trainer_id,
        rating,
        comment: comment || null,
        created_at: new Date().toISOString(),
      }
      console.log('Submitting review with payload:', payload)
      const response = await apiRequest('review_insert', payload, { headers: withAuth() })
      console.log('Review submission response:', response)

      try {
        // update aggregate rating for trainer if possible
        const stats = await apiRequest('reviews_get', { trainer_id: booking.trainer_id }, { headers: withAuth() })
        const ratings = (stats || []).map((r: any) => Number(r.rating) || 0)
        if (ratings.length > 0) {
          const avg = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          await apiRequest('profile_update', { user_id: booking.trainer_id, rating: avg, total_reviews: ratings.length }, { headers: withAuth() })
        }
      } catch {}

      toast({ title: 'Thank you!', description: 'Your review was submitted.' })
      await Promise.resolve(onSubmitted?.())
      onClose?.()
    } catch (err: any) {
      toast({ title: 'Failed to submit review', description: err?.message || 'Please try again', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
        <Card className="rounded-none sm:rounded-lg">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Rate and Review</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 overflow-y-auto flex-1">
            <div className="space-y-4">
              <div>
                <Label>Rating</Label>
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3,4,5].map((i) => (
                    <button key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i)} aria-label={`Rate ${i}`} className="p-1">
                      <Star className={`h-6 w-6 ${((hover || rating) >= i) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Comment (optional)</Label>
                <Input value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="Share your experience" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button onClick={submit} disabled={loading}>{loading ? 'Submitting...' : 'Submit'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
