import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import * as apiService from '@/lib/api-service'
import { AlertCircle, Loader2 } from 'lucide-react'

interface CancelBookingModalProps {
  booking: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const CancelBookingModal: React.FC<CancelBookingModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState<string>('')
  const [customReason, setCustomReason] = useState('')
  const [loading, setLoading] = useState(false)

  const reasons = [
    { value: 'schedule_conflict', label: 'Schedule conflict' },
    { value: 'found_another_trainer', label: 'Found another trainer' },
    { value: 'personal_reason', label: 'Personal reason' },
    { value: 'health_issue', label: 'Health issue' },
    { value: 'other', label: 'Other' },
  ]

  const handleCancel = async () => {
    if (!reason) {
      toast({
        title: 'Please select a reason',
        description: 'Help us improve by telling us why you\'re cancelling',
        variant: 'destructive',
      })
      return
    }

    if (reason === 'other' && !customReason.trim()) {
      toast({
        title: 'Please provide details',
        description: 'Please explain your reason for cancelling',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Update booking status to cancelled
      await apiService.updateBooking(booking.id, {
        status: 'cancelled',
        cancellation_reason: reason === 'other' ? customReason : reason,
        cancelled_at: new Date().toISOString(),
      })

      // Notify trainer and admins
      const nowIso = new Date().toISOString()
      const notifRows = [
        {
          user_id: booking.trainer_id,
          booking_id: booking.id,
          title: 'Booking cancelled',
          body: `Client cancelled the booking for ${booking.session_date}`,
          action_type: 'view_booking',
          type: 'booking',
          created_at: nowIso,
          read: false,
        },
      ]

      try {
        const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
        for (const admin of (admins || [])) {
          notifRows.push({
            user_id: admin.user_id,
            booking_id: booking.id,
            title: 'Booking cancelled by client',
            body: `Booking ${booking.id} was cancelled`,
            action_type: 'view_booking',
            type: 'booking',
            created_at: nowIso,
            read: false,
          })
        }
      } catch (err) {
        console.warn('Failed to fetch admins for notification', err)
      }

      if (notifRows.length > 0) {
        try {
          await apiRequest('notifications_insert', { notifications: notifRows }, { headers: withAuth() })
        } catch (err) {
          console.warn('Failed to send notifications', err)
        }
      }

      toast({
        title: 'Booking cancelled',
        description: 'Your booking has been cancelled. Refund will be processed shortly.',
      })

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error cancelling booking:', err)
      toast({
        title: 'Failed to cancel booking',
        description: 'Please try again or contact support',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            Session on {new Date(booking.session_date).toLocaleDateString()} at {booking.session_time}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1">Cancellation policy</p>
              <p>Cancel at least 24 hours before the session to avoid charges.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="font-semibold">Why are you cancelling?</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {reasons.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={opt.value} />
                  <Label htmlFor={opt.value} className="font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {reason === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="customReason">Additional details</Label>
              <Textarea
                id="customReason"
                placeholder="Please tell us more..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Keep Booking
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Cancel Booking'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
