import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { AlertCircle, Loader2 } from 'lucide-react'

interface RescheduleBookingModalProps {
  booking: any
  trainerProfile?: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const RescheduleBookingModal: React.FC<RescheduleBookingModalProps> = ({
  booking,
  trainerProfile,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string>('')

  // Validate availability when date or time changes
  useEffect(() => {
    setAvailabilityError('')
    if (!newDate || !newTime) return

    const availability = trainerProfile?.availability
    if (!availability) return

    const selectedDate = new Date(newDate)
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const slots = availability[dayName]

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      setAvailabilityError(`Trainer is not available on ${dayName}s`)
      return
    }

    const selectedHour = parseInt(newTime.split(':')[0])
    const selectedMinute = parseInt(newTime.split(':')[1])
    const selectedTimeInMinutes = selectedHour * 60 + selectedMinute

    const isAvailable = slots.some((slot: string) => {
      const [start, end] = slot.split('-')
      const [startHour, startMin] = start.split(':').map(Number)
      const [endHour, endMin] = end.split(':').map(Number)
      const startInMinutes = startHour * 60 + startMin
      const endInMinutes = endHour * 60 + endMin

      return selectedTimeInMinutes >= startInMinutes && selectedTimeInMinutes < endInMinutes
    })

    if (!isAvailable) {
      const availableTimes = slots.join(', ')
      setAvailabilityError(`Time not available. Available slots: ${availableTimes}`)
    }
  }, [newDate, newTime, trainerProfile?.availability])

  const handleReschedule = async () => {
    if (!newDate || !newTime) {
      toast({
        title: 'Please select date and time',
        description: 'Both date and time are required',
        variant: 'destructive',
      })
      return
    }

    if (availabilityError) {
      toast({
        title: 'Invalid time',
        description: availabilityError,
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      if (!user?.id) {
        toast({
          title: 'Error',
          description: 'User not found',
          variant: 'destructive',
        })
        return
      }

      // Create reschedule request using the booking_request API
      await apiRequest('booking_request_create', {
        booking_id: booking.id,
        request_type: 'reschedule',
        requested_by: user.id,
        target_date: newDate,
        target_time: newTime,
      }, { headers: withAuth() })

      toast({
        title: 'Reschedule Request Submitted',
        description: `Request sent to trainer for ${new Date(newDate).toLocaleDateString()} at ${newTime}`,
      })

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error requesting reschedule:', err)
      toast({
        title: 'Failed to submit reschedule request',
        description: 'Please try again or contact support',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Booking</DialogTitle>
          <DialogDescription>
            Current session: {new Date(booking.session_date).toLocaleDateString()} at {booking.session_time}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">Reschedule policy</p>
              <p>You can reschedule up to 24 hours before the session.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newDate">New Date</Label>
            <Input
              id="newDate"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={today}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newTime">New Time</Label>
            <Input
              id="newTime"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
            {availabilityError && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                {availabilityError}
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              A reschedule request will be sent to the trainer for confirmation. Your original session will remain scheduled until the trainer approves the new time.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={loading || availabilityError !== ''}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rescheduling...
              </>
            ) : (
              'Request Reschedule'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
