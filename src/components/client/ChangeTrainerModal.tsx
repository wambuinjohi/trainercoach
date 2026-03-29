import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Star, MapPin, Clock } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

interface ChangeTrainerModalProps {
  booking: any
  onClose?: () => void
  onSuccess?: () => void
}

export const ChangeTrainerModal: React.FC<ChangeTrainerModalProps> = ({
  booking,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const [availableTrainers, setAvailableTrainers] = useState<any[]>([])
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingTrainers, setLoadingTrainers] = useState(true)

  useEffect(() => {
    loadAvailableTrainers()
  }, [])

  const loadAvailableTrainers = async () => {
    if (!booking?.category_id && !booking?.discipline_id) {
      setAvailableTrainers([])
      setLoadingTrainers(false)
      return
    }

    setLoadingTrainers(true)
    try {
      // Get all trainers
      const trainers = await apiService.getUsers()
      const trainerList = Array.isArray(trainers)
        ? trainers
        : (trainers?.data ? Array.isArray(trainers.data) ? trainers.data : [trainers.data] : [])

      // Filter trainers
      const filtered = (trainerList || [])
        .filter((t: any) => {
          // Exclude current trainer
          if (t.user_id === booking.trainer_id) return false
          
          // Only trainers
          if (t.user_type !== 'trainer') return false

          // Must be approved
          if (!t.is_approved) return false

          return true
        })
        .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))

      setAvailableTrainers(filtered.slice(0, 10))
    } catch (err) {
      console.error('Failed to load available trainers:', err)
      toast({
        title: 'Error',
        description: 'Failed to load available trainers',
        variant: 'destructive',
      })
      setAvailableTrainers([])
    } finally {
      setLoadingTrainers(false)
    }
  }

  const handleSubmit = async () => {
    if (!user || !booking?.id || !selectedTrainerId) return

    setLoading(true)
    try {
      await apiService.requestTrainerChange(
        booking.id,
        user.id,
        selectedTrainerId,
        'Client requested to change trainer'
      )

      // Create notification for new trainer
      const newTrainer = availableTrainers.find(t => t.user_id === selectedTrainerId)
      await apiRequest('notifications_insert', {
        notifications: [{
          user_id: selectedTrainerId,
          booking_id: booking.id,
          title: 'Trainer Change Request',
          body: `A client has requested to change their trainer to you for a session on ${booking.session_date}`,
          action_type: 'review_application',
          type: 'booking',
          created_at: new Date().toISOString(),
          read: false,
        }],
      }, { headers: withAuth() })

      // Create notification for current trainer
      await apiRequest('notifications_insert', {
        notifications: [{
          user_id: booking.trainer_id,
          booking_id: booking.id,
          title: 'Trainer Change Request',
          body: 'Your client has requested to change trainers for their upcoming session.',
          action_type: 'review_application',
          type: 'booking',
          created_at: new Date().toISOString(),
          read: false,
        }],
      }, { headers: withAuth() })

      toast({
        title: 'Request Submitted',
        description: 'Your trainer change request has been submitted. The current trainer will be notified.',
      })

      onSuccess?.()
      onClose?.()
    } catch (err: any) {
      console.error('Trainer change request error:', err)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to submit trainer change request',
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
          <CardTitle>Change Trainer</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select a different trainer for your session on {new Date(booking?.session_date).toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Current Session Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{booking?.session_date} at {booking?.session_time}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Duration:</span>
              <span>{booking?.duration_hours} hour(s)</span>
            </div>
          </div>

          {/* Available Trainers */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Select a new trainer</h3>
            
            {loadingTrainers ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : availableTrainers.length === 0 ? (
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 flex gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-900 dark:text-orange-100 text-sm">No trainers available</p>
                  <p className="text-orange-800 dark:text-orange-200 text-sm">There are no other trainers available for this session.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableTrainers.map((trainer) => (
                  <button
                    key={trainer.user_id}
                    onClick={() => setSelectedTrainerId(trainer.user_id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedTrainerId === trainer.user_id
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/20 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{trainer.full_name || 'Trainer'}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs font-semibold">{(trainer.rating || 0).toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({trainer.total_reviews || 0} reviews)</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        selectedTrainerId === trainer.user_id
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground'
                      }`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Your current trainer will be notified of this change request and can approve or decline it.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-primary text-white"
              onClick={handleSubmit}
              disabled={loading || !selectedTrainerId || availableTrainers.length === 0}
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
