import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Star, MapPin, Loader2, X } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

interface SessionTransferModalProps {
  currentBooking: any
  currentTrainer: any
  onTransfer?: (newTrainerId: number) => void
  onClose?: () => void
}

export const SessionTransferModal: React.FC<SessionTransferModalProps> = ({
  currentBooking,
  currentTrainer,
  onTransfer,
  onClose,
}) => {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestedTrainers, setSuggestedTrainers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [selectedTrainer, setSelectedTrainer] = useState<any | null>(null)

  // Fetch suggested trainers based on current trainer's category
  useEffect(() => {
    const loadSuggestedTrainers = async () => {
      try {
        setLoading(true)
        // Get current trainer's categories
        const currentCategories = await apiService.getTrainerCategories(currentTrainer.id)

        // Search for other trainers with same categories
        const allTrainers = await apiService.getAvailableTrainers({})

        // Filter trainers: exclude current trainer, filter by category
        const filtered = allTrainers.filter((t: any) => {
          if (t.id === currentTrainer.id) return false // Exclude current trainer
          if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
          return true
        })

        setSuggestedTrainers(filtered.slice(0, 5))
      } catch (err) {
        console.warn('Failed to load suggested trainers', err)
        setSuggestedTrainers([])
      } finally {
        setLoading(false)
      }
    }

    loadSuggestedTrainers()
  }, [currentTrainer.id, searchQuery])

  const handleTransfer = async () => {
    if (!selectedTrainer || !currentBooking) return

    setTransferring(true)
    try {
      // Create new booking with the selected trainer
      const newBookingPayload = {
        client_id: currentBooking.client_id,
        trainer_id: selectedTrainer.id,
        session_date: currentBooking.session_date,
        session_time: currentBooking.session_time,
        duration_hours: currentBooking.duration_hours || 1,
        total_sessions: currentBooking.total_sessions || 1,
        status: 'pending',
        session_phase: 'waiting_start',
        base_service_amount: currentBooking.base_service_amount,
        notes: `Transferred from trainer ${currentTrainer.name}. ${currentBooking.notes || ''}`,
        session_location_preference: currentBooking.session_location_preference,
        session_location_custom: currentBooking.session_location_custom,
        client_location_label: currentBooking.client_location_label,
        client_location_lat: currentBooking.client_location_lat,
        client_location_lng: currentBooking.client_location_lng,
      }

      // Create new booking
      const newBooking = await apiRequest('booking_create', newBookingPayload, { headers: withAuth() })

      // Cancel the current booking
      await apiRequest(
        'update',
        {
          table: 'bookings',
          data: { status: 'cancelled', cancelled_reason: 'Client transferred to another trainer' },
          where: `id = '${currentBooking.id}'`,
        },
        { headers: withAuth() }
      )

      // Create notification for new trainer
      const nowIso = new Date().toISOString()
      await apiRequest(
        'notifications_insert',
        {
          notifications: [
            {
              user_id: selectedTrainer.id,
              booking_id: newBooking?.id || null,
              title: 'New session transfer',
              body: `A client transferred from another trainer. Session on ${currentBooking.session_date} at ${currentBooking.session_time}.`,
              action_type: 'view_booking',
              type: 'booking',
              created_at: nowIso,
              read: false,
            },
          ],
        },
        { headers: withAuth() }
      )

      toast({
        title: 'Session transferred',
        description: `Your session has been transferred to ${selectedTrainer.name}. They will review your request.`,
      })

      onTransfer?.(selectedTrainer.id)
      onClose?.()
    } catch (err: any) {
      console.error('Transfer error', err)
      toast({
        title: 'Transfer failed',
        description: err?.message || 'Could not transfer session',
        variant: 'destructive',
      })
    } finally {
      setTransferring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors z-10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader>
          <CardTitle className="text-lg">Transfer Session to Another Trainer</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current session info */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Current Session</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700 dark:text-blue-300">Trainer:</span>
                <span className="font-medium">{currentTrainer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700 dark:text-blue-300">Date:</span>
                <span className="font-medium">{currentBooking.session_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700 dark:text-blue-300">Time:</span>
                <span className="font-medium">{currentBooking.session_time}</span>
              </div>
            </div>
          </div>

          {/* Search for new trainer */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Find a new trainer</label>
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Trainer list */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : suggestedTrainers.length > 0 ? (
              suggestedTrainers.map(trainer => (
                <button
                  key={trainer.id}
                  onClick={() => setSelectedTrainer(trainer)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                    selectedTrainer?.id === trainer.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-border hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-white text-lg flex-shrink-0">
                      {trainer.image || trainer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{trainer.name}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {trainer.rating && (
                          <>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-400" />
                              {trainer.rating}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        {trainer.distance && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {trainer.distance}
                          </span>
                        )}
                      </div>
                      {trainer.available && (
                        <Badge variant="default" className="mt-2 text-xs">
                          Available
                        </Badge>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-sm">Ksh {trainer.hourlyRate || 0}/hr</div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500">No trainers found. Try a different search.</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!selectedTrainer || transferring}
              className="flex-1 bg-gradient-primary text-white"
            >
              {transferring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Transferring...
                </>
              ) : (
                'Transfer Session'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
