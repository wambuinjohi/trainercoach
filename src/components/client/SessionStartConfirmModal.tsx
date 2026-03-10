import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface SessionStartConfirmModalProps {
  booking: any
  onConfirm?: () => void
  onDismiss?: () => void
}

export const SessionStartConfirmModal: React.FC<SessionStartConfirmModalProps> = ({
  booking,
  onConfirm,
  onDismiss,
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  // Auto-dismiss after 5 minutes if no response
  useEffect(() => {
    const timeout = setTimeout(() => {
      toast({
        title: 'Session Start Confirmation',
        description: 'No response received. Please contact your trainer if you missed this.',
        variant: 'default',
      })
      onDismiss?.()
    }, 5 * 60 * 1000) // 5 minutes

    setTimeoutId(timeout)

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [onDismiss])

  const handleConfirm = async () => {
    if (!user || !booking?.id) return

    setLoading(true)
    try {
      await apiRequest(
        'booking_update',
        {
          booking_id: booking.id,
          session_started: true,
          client_confirmed_start: true,
          session_start_confirmed_at: new Date().toISOString(),
        },
        { headers: withAuth() }
      )

      if (timeoutId) clearTimeout(timeoutId)

      toast({
        title: 'Session Started',
        description: 'Your session has been confirmed. Enjoy your training!',
      })

      onConfirm?.()
      onDismiss?.()
    } catch (err: any) {
      console.error('Confirm error:', err)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to confirm session start',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleNotReady = async () => {
    if (timeoutId) clearTimeout(timeoutId)

    toast({
      title: 'Trainer Notified',
      description: 'Your trainer has been notified that you are not ready.',
    })

    onDismiss?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            Session is Starting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Your trainer is ready to start the session. Please confirm that you are ready to begin.
            </p>
          </div>

          {booking?.trainer_name && (
            <div className="text-sm">
              <p className="text-muted-foreground">Trainer:</p>
              <p className="font-semibold">{booking.trainer_name}</p>
            </div>
          )}

          {booking?.session_date && booking?.session_time && (
            <div className="text-sm">
              <p className="text-muted-foreground">Session Time:</p>
              <p className="font-semibold">{booking.session_date} at {booking.session_time}</p>
            </div>
          )}

          {booking?.discipline && (
            <div className="text-sm">
              <p className="text-muted-foreground">Discipline:</p>
              <p className="font-semibold">{booking.discipline}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleNotReady}
              disabled={loading}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Not Ready
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? 'Confirming...' : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Start
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This prompt will auto-dismiss in 5 minutes
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
