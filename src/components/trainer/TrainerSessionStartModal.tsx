import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { Booking } from '@/types'
import * as notificationService from '@/lib/notification-service'

interface TrainerSessionStartModalProps {
  booking: Booking
  trainerName?: string
  onConfirm?: () => void
  onDismiss?: () => void
}

export const TrainerSessionStartModal: React.FC<TrainerSessionStartModalProps> = ({
  booking,
  trainerName,
  onConfirm,
  onDismiss,
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  // Auto-dismiss after 10 minutes if no response
  useEffect(() => {
    const timeout = setTimeout(() => {
      toast({
        title: 'Session Start Confirmation',
        description: 'No response received. Please start the session when ready.',
        variant: 'default',
      })
      onDismiss?.()
    }, 10 * 60 * 1000) // 10 minutes

    setTimeoutId(timeout)

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [onDismiss])

  const handleStartSession = async () => {
    if (!user || !booking?.id) return

    setLoading(true)
    try {
      // Update booking status to in_session
      await apiService.updateBooking(booking.id, {
        status: 'in_session',
      })

      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId)

      // Notify client that session has started
      await notificationService.notifySessionStarted(
        booking.id,
        booking.client_id,
        trainerName || 'Your trainer'
      )

      toast({
        title: 'Session Started',
        description: 'Session has been marked as active. Client has been notified.',
      })

      onConfirm?.()
      onDismiss?.()
    } catch (err: any) {
      console.error('Start session error:', err)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to start session',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    if (timeoutId) clearTimeout(timeoutId)
    onDismiss?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40">
      <Card className="w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Ready to Start Session?
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              It's time to start your training session. Click "Start Session" to begin. Your client will be notified immediately.
            </p>
          </div>

          {booking?.full_name && (
            <div className="text-sm">
              <p className="text-muted-foreground">Client:</p>
              <p className="font-semibold">{booking.full_name}</p>
            </div>
          )}

          {booking?.session_date && booking?.session_time && (
            <div className="text-sm">
              <p className="text-muted-foreground">Session Time:</p>
              <p className="font-semibold">{booking.session_date} at {booking.session_time}</p>
            </div>
          )}

          {booking?.duration_hours && (
            <div className="text-sm">
              <p className="text-muted-foreground">Duration:</p>
              <p className="font-semibold">{booking.duration_hours} hour{booking.duration_hours !== 1 ? 's' : ''}</p>
            </div>
          )}

          {booking?.total_amount && (
            <div className="text-sm">
              <p className="text-muted-foreground">Amount:</p>
              <p className="font-semibold">KES {booking.total_amount.toLocaleString()}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDismiss}
              disabled={loading}
            >
              Dismiss
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleStartSession}
              disabled={loading}
            >
              {loading ? 'Starting...' : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Start Session
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This prompt will auto-dismiss in 10 minutes
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
