import React, { useState } from 'react'
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

  const submit = async () => {
    if (!user || !date || !time) return
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
      toast({ title: 'Failed to book next session', description: err?.message || 'Try again', variant: 'destructive' })
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
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button onClick={submit} disabled={loading}>{loading ? 'Booking...' : 'Book'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
