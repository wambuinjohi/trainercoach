import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

interface SessionEndConfirmModalProps {
  booking: any
  onConfirm?: () => void
  onDismiss?: () => void
}

export const SessionEndConfirmModal: React.FC<SessionEndConfirmModalProps> = ({
  booking,
  onConfirm,
  onDismiss,
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [reminderCount, setReminderCount] = useState(0)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const [autoCompleteTimeout, setAutoCompleteTimeout] = useState<NodeJS.Timeout | null>(null)

  // Start reminder timer and auto-complete after 3 reminders (9 minutes total)
  useEffect(() => {
    // Set reminder every 3 minutes if user hasn't confirmed
    const startReminder = () => {
      const timeout = setTimeout(() => {
        setReminderCount((prev) => {
          const newCount = prev + 1
          
          if (newCount >= 3) {
            // Auto-complete after 3 reminders
            handleAutoComplete()
            return newCount
          }
          
          toast({
            title: 'Session Reminder',
            description: `Please confirm session end (reminder ${newCount} of 3)`,
            variant: 'destructive',
          })
          
          startReminder()
          return newCount
        })
      }, 3 * 60 * 1000) // 3 minutes
      
      setTimeoutId(timeout)
    }

    startReminder()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (autoCompleteTimeout) clearTimeout(autoCompleteTimeout)
    }
  }, [])

  const settleCompletion = async (autoCompleted: boolean) => {
    try {
      const trainerProfile = await apiRequest('profile_get', { user_id: booking.trainer_id }, { headers: withAuth() })
      const trainerData = trainerProfile?.data || trainerProfile || {}
      const payoutDetails = typeof trainerData.payout_details === 'string'
        ? JSON.parse(trainerData.payout_details)
        : (trainerData.payout_details || {})
      const trainerMpesaNumber = payoutDetails.mpesa_number || trainerData.mpesa_number || trainerData.phone_number || trainerData.phone
      const trainerNetAmount = Number(booking.trainer_net_amount || booking.total_amount || 0)

      if (trainerMpesaNumber && trainerNetAmount > 0) {
        await apiService.initiateTrainerPayout({
          booking_id: booking.id,
          trainer_id: booking.trainer_id,
          trainer_mpesa_number: trainerMpesaNumber,
          amount: trainerNetAmount,
          reason: autoCompleted ? 'session_auto_completed' : 'session_completion',
        })
      }

      // Create notifications for trainer and client
      await apiRequest('notifications_insert', {
        notifications: [
          // Trainer notification about session completion
          {
            user_id: booking.trainer_id,
            booking_id: booking.id,
            title: autoCompleted ? 'Session auto-completed' : 'Session completed',
            body: autoCompleted
              ? 'The session was automatically completed after no response from the client.'
              : 'The client confirmed the session is complete.',
            action_type: 'complete_session',
            type: 'session',
            created_at: new Date().toISOString(),
            read: false,
          },
          // Client notification to review/rate the session (Feature #19)
          {
            user_id: user?.id,
            booking_id: booking.id,
            title: 'Rate your session',
            body: 'Please rate your coach and share feedback about the app to help us improve.',
            action_type: 'review_requested',
            type: 'review',
            created_at: new Date().toISOString(),
            read: false,
          }
        ]
      }, { headers: withAuth() })
    } catch (err) {
      console.warn('Completion side effects failed', err)
    }
  }

  const handleAutoComplete = async () => {
    if (!user || !booking?.id) return

    try {
      await apiService.updateBooking(booking.id, {
        status: 'completed',
        session_phase: 'completed',
        auto_completed: true,
        completed_at: new Date().toISOString(),
      })

      await settleCompletion(true)

      toast({
        title: 'Session Auto-Completed',
        description: 'Session has been automatically marked as completed after no response.',
      })

      onDismiss?.()
    } catch (err) {
      console.error('Auto-complete error:', err)
      toast({
        title: 'Error',
        description: 'Failed to auto-complete session',
        variant: 'destructive',
      })
    }
  }

  const handleConfirm = async () => {
    if (!user || !booking?.id) return
    
    setLoading(true)
    try {
      await apiService.updateBooking(booking.id, {
        status: 'completed',
        session_phase: 'completed',
        completed_at: new Date().toISOString(),
      })

      await settleCompletion(false)

      if (timeoutId) clearTimeout(timeoutId)
      if (autoCompleteTimeout) clearTimeout(autoCompleteTimeout)

      toast({
        title: 'Session Confirmed',
        description: 'Your session has been marked as complete.',
      })

      onConfirm?.()
      onDismiss?.()
    } catch (err: any) {
      console.error('Confirm error:', err)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to confirm session end',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40">
      <Card className="w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2">
            {reminderCount >= 3 ? (
              <>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Session Auto-Completing
              </>
            ) : reminderCount > 0 ? (
              <>
                <Clock className="h-5 w-5 text-yellow-500" />
                Session End Reminder {reminderCount}
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-blue-500" />
                Confirm Session End
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              {reminderCount >= 3 ? (
                <>
                  Your session will be automatically completed due to lack of response. If this is not correct, please contact support.
                </>
              ) : reminderCount > 0 ? (
                <>
                  This is reminder {reminderCount} of 3. Please confirm that your session has ended. If you don't respond in the next {3 - reminderCount} reminder{3 - reminderCount !== 1 ? 's' : ''}, the system will automatically complete your session.
                </>
              ) : (
                <>
                  Your trainer has ended the session. Please confirm that the session is complete so we can process your payment.
                </>
              )}
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
              <p className="text-muted-foreground">Session:</p>
              <p className="font-semibold">{booking.session_date} at {booking.session_time}</p>
            </div>
          )}

          <div className="flex gap-3">
            {reminderCount < 3 && (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onDismiss}
                  disabled={loading}
                >
                  Dismiss
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  {loading ? 'Confirming...' : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Session End
                    </>
                  )}
                </Button>
              </>
            )}
            {reminderCount >= 3 && (
              <Button
                className="w-full"
                onClick={() => {
                  if (timeoutId) clearTimeout(timeoutId)
                  if (autoCompleteTimeout) clearTimeout(autoCompleteTimeout)
                  onDismiss?.()
                }}
              >
                OK
              </Button>
            )}
          </div>

          {reminderCount > 0 && reminderCount < 3 && (
            <p className="text-xs text-center text-muted-foreground">
              Reminder {reminderCount} of 3 - Auto-complete in {3 - reminderCount} reminder{3 - reminderCount !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
