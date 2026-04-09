import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { Booking } from '@/types'
import { ComplaintModal } from '@/components/shared/ComplaintModal'

interface TrainerSessionEndModalProps {
  booking: Booking
  onConfirm?: () => void
  onDismiss?: () => void
}

export const TrainerSessionEndModal: React.FC<TrainerSessionEndModalProps> = ({
  booking,
  onConfirm,
  onDismiss,
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  // Auto-dismiss after 5 minutes if no response
  useEffect(() => {
    const timeout = setTimeout(() => {
      toast({
        title: 'Session Completion',
        description: 'No response received. Please contact support if needed.',
        variant: 'default',
      })
      onDismiss?.()
    }, 5 * 60 * 1000) // 5 minutes

    setTimeoutId(timeout)

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [onDismiss])

  const handleSessionCompleted = async () => {
    if (!user || !booking?.id) return

    setLoading(true)
    try {
      // Calculate session duration if started_at exists
      const endedAt = new Date().toISOString()
      let durationMinutes = 60 // Default 1 hour

      if (booking.started_at) {
        const startTime = new Date(booking.started_at).getTime()
        const endTime = new Date(endedAt).getTime()
        durationMinutes = Math.round((endTime - startTime) / (1000 * 60))
      }

      // Update booking: trainer marks end
      await apiService.updateBooking(booking.id, {
        ended_at: endedAt,
        session_duration_minutes: durationMinutes,
      })

      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId)

      // Create notification for client to confirm completion
      // This will be handled by the ClientDashboard component polling logic

      toast({
        title: 'Session Marked Complete',
        description: 'Client will now be asked to confirm session completion.',
      })

      onConfirm?.()
      onDismiss?.()
    } catch (err: any) {
      console.error('Session completion error:', err)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to mark session as complete',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleComplaintSubmitted = () => {
    // After filing complaint, still need to mark session as requiring client confirmation
    setShowComplaintModal(false)
    
    // Transition to awaiting_completion just like session completed
    handleSessionCompleted()
  }

  const handleDismiss = () => {
    if (timeoutId) clearTimeout(timeoutId)
    onDismiss?.()
  }

  if (showComplaintModal) {
    return (
      <ComplaintModal
        booking={booking}
        complainantType="trainer"
        onSubmitted={handleComplaintSubmitted}
        onDismiss={() => {
          setShowComplaintModal(false)
          handleDismiss()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40">
      <Card className="w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            Session Time Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              The session duration has elapsed. Please confirm that the session is complete, or file a complaint if there were any issues.
            </p>
          </div>

          {booking?.full_name && (
            <div className="text-sm">
              <p className="text-muted-foreground">Client:</p>
              <p className="font-semibold">{booking.full_name}</p>
            </div>
          )}

          {booking?.started_at && (
            <div className="text-sm">
              <p className="text-muted-foreground">Session Started:</p>
              <p className="font-semibold">
                {new Date(booking.started_at).toLocaleString()}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleSessionCompleted}
              disabled={loading}
            >
              {loading ? 'Processing...' : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Session Completed
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowComplaintModal(true)}
              disabled={loading}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              File Complaint
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleDismiss}
              disabled={loading}
            >
              Cancel
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
