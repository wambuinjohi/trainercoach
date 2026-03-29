import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

interface RefundRequestModalProps {
  booking: any
  onClose?: () => void
  onSuccess?: () => void
}

export const RefundRequestModal: React.FC<RefundRequestModalProps> = ({
  booking,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  // Check refund eligibility
  const checkEligibility = () => {
    if (!booking) return { eligible: false, reason: 'No booking found' }
    
    // Check status
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return { eligible: false, reason: 'Only pending or confirmed bookings can be refunded' }
    }

    // Check if session date is in the future
    const sessionDate = new Date(booking.session_date)
    const now = new Date()
    if (sessionDate < now) {
      return { eligible: false, reason: 'Session has already started or passed' }
    }

    // Check if within 7 days of booking
    const bookingDate = new Date(booking.created_at)
    const daysSinceBooking = Math.floor((now.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceBooking > 7) {
      return { eligible: false, reason: 'Refund requests must be made within 7 days of booking' }
    }

    return { eligible: true }
  }

  const eligibility = checkEligibility()

  const handleSubmit = async () => {
    if (!user || !booking?.id) return

    if (!eligibility.eligible) {
      toast({
        title: 'Not Eligible',
        description: eligibility.reason,
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await apiService.requestRefund(booking.id, user.id, reason || undefined)

      // Create notification for trainer/admin
      await apiRequest('notifications_insert', {
        notifications: [{
          user_id: booking.trainer_id,
          booking_id: booking.id,
          title: 'Refund Request',
          body: `Client has requested a refund for the booking.${reason ? ` Reason: ${reason.substring(0, 100)}` : ''}`,
          action_type: 'review_application',
          type: 'dispute',
          created_at: new Date().toISOString(),
          read: false,
        }],
      }, { headers: withAuth() })

      toast({
        title: 'Refund Request Submitted',
        description: 'Your refund request has been submitted for review.',
      })

      onSuccess?.()
      onClose?.()
    } catch (err: any) {
      console.error('Refund request error:', err)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to submit refund request',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40">
      <Card className="w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
        <CardHeader className="p-4 sm:p-6 border-b">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Request Refund
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Booking Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coach:</span>
              <span className="font-semibold">{booking?.trainer_name || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date:</span>
              <span className="font-semibold">{booking?.session_date && new Date(booking.session_date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-semibold">Ksh {Number(booking?.total_amount || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Eligibility Check */}
          {!eligibility.eligible ? (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-100 text-sm">Not Eligible</p>
                <p className="text-red-800 dark:text-red-200 text-sm">{eligibility.reason}</p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                Your refund request will be reviewed by the platform. You'll receive a decision within 2-3 business days.
              </p>
            </div>
          )}

          {/* Reason */}
          {eligibility.eligible && (
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason for Refund (optional)</Label>
              <Textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tell us why you're requesting a refund..."
                className="min-h-20"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleSubmit}
              disabled={loading || !eligibility.eligible}
            >
              {loading ? 'Submitting...' : 'Request Refund'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
