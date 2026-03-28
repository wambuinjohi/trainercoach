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
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import * as apiService from '@/lib/api-service'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { scheduleSessionReminder } from '@/lib/reminder-service'

interface TrainerAttendanceConfirmModalProps {
  booking: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  trainerProfile?: any
}

export const TrainerAttendanceConfirmModal: React.FC<TrainerAttendanceConfirmModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSuccess,
  trainerProfile,
}) => {
  const { user } = useAuth()
  const [declineReason, setDeclineReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDeclineForm, setShowDeclineForm] = useState(false)

  const handleConfirmAttendance = async () => {
    setLoading(true)
    try {
      // Update booking status to confirmed
      await apiService.updateBooking(booking.id, {
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })

      // Schedule 2-hour pre-session reminder
      await scheduleSessionReminder(booking)

      // Notify client that trainer confirmed
      const nowIso = new Date().toISOString()
      const notifRows = [
        {
          user_id: booking.client_id,
          booking_id: booking.id,
          title: 'Trainer confirmed attendance',
          body: `${trainerProfile?.name || 'Your trainer'} confirmed attendance for your booking on ${booking.session_date}. If you would like to talk to the trainer, kindly press the chat button.`,
          action_type: 'view_booking',
          type: 'booking',
          created_at: nowIso,
          read: false,
        },
      ]

      await apiRequest('notifications_insert', { notifications: notifRows }, { headers: withAuth() })

      toast({
        title: 'Attendance confirmed',
        description: 'Client has been notified. You can now chat with them.',
      })

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error confirming attendance:', err)
      toast({
        title: 'Failed to confirm attendance',
        description: 'Please try again or contact support',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeclineAttendance = async () => {
    if (!declineReason.trim()) {
      toast({
        title: 'Please provide a reason',
        description: 'Help the client understand why you cannot attend',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Update booking status to cancelled with decline reason
      await apiService.updateBooking(booking.id, {
        status: 'cancelled',
        decline_reason: declineReason,
        declined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      // Notify client that trainer declined with reason
      const nowIso = new Date().toISOString()
      const notifRows = [
        {
          user_id: booking.client_id,
          booking_id: booking.id,
          title: 'Booking declined',
          body: `${trainerProfile?.name || 'Your trainer'} declined your booking. Reason: ${declineReason}`,
          action_type: 'view_booking',
          type: 'booking',
          created_at: nowIso,
          read: false,
        },
      ]

      // Also notify admins
      try {
        const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
        for (const admin of (admins || [])) {
          notifRows.push({
            user_id: admin.user_id,
            booking_id: booking.id,
            title: 'Booking declined by trainer',
            body: `${trainerProfile?.name || 'Trainer'} declined booking ${booking.id}. Reason: ${declineReason}`,
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
        await apiRequest('notifications_insert', { notifications: notifRows }, { headers: withAuth() })
      }

      toast({
        title: 'Booking declined',
        description: 'Client has been notified of your decision.',
      })

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error declining attendance:', err)
      toast({
        title: 'Failed to decline booking',
        description: 'Please try again or contact support',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const sessionDate = new Date(booking.session_date)
  const formattedDate = sessionDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Attendance</DialogTitle>
          <DialogDescription>
            {formattedDate} at {booking.session_time}
          </DialogDescription>
        </DialogHeader>

        {!showDeclineForm ? (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 space-y-2">
              <div className="font-semibold text-sm">Booking Details</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div>
                  <span className="font-medium">Client:</span> {booking.client_name || 'Client'}
                </div>
                <div>
                  <span className="font-medium">Date:</span> {formattedDate}
                </div>
                <div>
                  <span className="font-medium">Time:</span> {booking.session_time}
                </div>
                <div>
                  <span className="font-medium">Duration:</span> {booking.duration_hours} hour(s)
                </div>
                <div>
                  <span className="font-medium">Amount:</span> KES {booking.total_amount}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please confirm if you can attend this session or decline with a reason.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="declineReason" className="font-semibold mb-2 block">
                Why are you declining this booking?
              </Label>
              <Textarea
                id="declineReason"
                placeholder="Please provide a reason for declining this session..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="resize-none"
                rows={4}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This reason will be sent to the client.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2">
          {!showDeclineForm ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeclineForm(true)}
                disabled={loading}
                className="flex-1 gap-2"
              >
                <XCircle className="h-4 w-4" />
                Decline Attendance
              </Button>
              <Button
                onClick={handleConfirmAttendance}
                disabled={loading}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirm Attendance
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeclineForm(false)
                  setDeclineReason('')
                }}
                disabled={loading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeclineAttendance}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Declining...
                  </>
                ) : (
                  'Decline'
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
