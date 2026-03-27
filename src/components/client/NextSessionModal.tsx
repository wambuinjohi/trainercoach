import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export const NextSessionModal: React.FC<{ previous: any, onClose?: () => void, onBooked?: () => void }> = ({ previous, onClose, onBooked }) => {
  const { user } = useAuth()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string>('')
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'not-available' | null>(null)

  // Format time to 12-hour format with AM/PM
  const formatTime12hr = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
  }

  // Format available slots into readable time ranges
  const formatAvailableSlots = (slots: string[]): string => {
    return slots.map(slot => {
      const [start, end] = slot.split('-')
      return `${formatTime12hr(start)} - ${formatTime12hr(end)}`
    }).join(', ')
  }

  // Validate availability when date or time changes
  useEffect(() => {
    setAvailabilityError('')
    setAvailabilityStatus(null)
    if (!date || !time) return

    const availability = previous?.trainerProfile?.availability || previous?.trainer?.availability
    if (!availability) return

    const selectedDate = new Date(date)
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const dayLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'long' })
    const slots = availability[dayName]

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      setAvailabilityError(`Trainer is not available on ${dayLabel}s. Please select a different date.`)
      setAvailabilityStatus('not-available')
      return
    }

    const selectedHour = parseInt(time.split(':')[0])
    const selectedMinute = parseInt(time.split(':')[1])
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
      const availableSlotsFormatted = formatAvailableSlots(slots)
      setAvailabilityError(`This time is not available. Available slots: ${availableSlotsFormatted}`)
      setAvailabilityStatus('not-available')
    } else {
      setAvailabilityStatus('available')
    }
  }, [date, time, previous?.trainerProfile?.availability, previous?.trainer?.availability])

  const submit = async () => {
    if (!user || !date || !time) {
      toast({ title: 'Missing info', description: 'Please select date and time', variant: 'destructive' })
      return
    }
    if (availabilityError) {
      toast({ title: 'Invalid time', description: availabilityError, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const hourly = Number(previous?.hourlyRate || previous?.total_amount || 0)
      const amount = hourly > 0 ? hourly : Number(previous?.total_amount || 0)
      const payload: any = {
        client_id: previous.client_id || user.id,
        trainer_id: previous.trainer_id,
        session_date: date,
        session_time: time,
        duration_hours: previous.duration_hours || 1,
        total_sessions: 1,
        status: 'confirmed',
        total_amount: amount,
        notes: 'Follow-up session',
      }
      const booking = await apiRequest('booking_insert', payload, { headers: withAuth() })
      try {
        await apiRequest('payment_insert', { booking_id: booking?.booking_id || booking?.id, user_id: user.id, amount: amount, status: 'completed', method: 'mock', created_at: new Date().toISOString() }, { headers: withAuth() })
      } catch {}
      toast({ title: 'Next session booked', description: `${date} at ${time}` })
      onBooked?.()
      onClose?.()
    } catch (err: any) {
      const errorMessage = err?.message || String(err)
      if (errorMessage.includes('not available') || errorMessage.includes('availability')) {
        toast({
          title: 'Time slot unavailable',
          description: errorMessage.includes('not available on')
            ? errorMessage
            : 'The trainer is no longer available at this time. Please select a different date or time.',
          variant: 'destructive'
        })
        setDate('')
        setTime('')
      } else {
        toast({ title: 'Failed to book next session', description: errorMessage, variant: 'destructive' })
      }
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
            <CardTitle>Confirm Next Session</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={time} onChange={(e)=>setTime(e.target.value)} />
                {availabilityStatus === 'available' && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1 font-medium">
                    <span className="text-lg">✓</span> Available
                  </div>
                )}
                {availabilityStatus === 'not-available' && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1 font-medium">
                    <span className="text-lg">✗</span> Not Available
                  </div>
                )}
                {availabilityError && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{availabilityError}</div>}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button onClick={submit} disabled={loading || !!availabilityError} title={availabilityError ? 'Please select a valid date and time' : ''}>{loading ? 'Booking...' : 'Book'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
