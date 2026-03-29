import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Search, User } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

interface TransferBookingModalProps {
  booking: any
  onClose?: () => void
  onSuccess?: () => void
}

export const TransferBookingModal: React.FC<TransferBookingModalProps> = ({
  booking,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [allClients, setAllClients] = useState<any[]>([])
  const [filteredClients, setFilteredClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(true)

  useEffect(() => {
    loadAvailableClients()
  }, [])

  useEffect(() => {
    // Filter clients based on search query
    if (!searchQuery.trim()) {
      setFilteredClients(allClients)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = allClients.filter((client) => {
      const name = (client.full_name || '').toLowerCase()
      const email = (client.email || '').toLowerCase()
      const phone = (client.phone_number || '').toLowerCase()
      return name.includes(query) || email.includes(query) || phone.includes(query)
    })

    setFilteredClients(filtered)
  }, [searchQuery, allClients])

  const loadAvailableClients = async () => {
    setLoadingClients(true)
    try {
      // Get all clients from the API
      const response = await apiRequest('select', {
        table: 'user_profiles',
        columns: ['user_id', 'full_name', 'email', 'phone_number']
      }, { headers: withAuth() })

      const userList = response?.data || []

      const clients = (userList || [])
        .filter((u: any) => {
          // Exclude self
          if (u.user_id === user?.id) return false

          return true
        })
        .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))

      setAllClients(clients)
      setFilteredClients(clients)
    } catch (err) {
      console.error('Failed to load available clients:', err)
      toast({
        title: 'Error',
        description: 'Failed to load available clients',
        variant: 'destructive',
      })
      setAllClients([])
      setFilteredClients([])
    } finally {
      setLoadingClients(false)
    }
  }

  const handleSubmit = async () => {
    if (!user || !booking?.id || !selectedClientId) return

    setLoading(true)
    try {
      const selectedClient = allClients.find(c => c.user_id === selectedClientId)

      // Create transfer request using the new API
      await apiRequest('booking_request_create', {
        booking_id: booking.id,
        request_type: 'transfer',
        requested_by: user.id,
        target_user_id: selectedClientId,
        reason: `Transfer to ${selectedClient?.full_name}`,
      }, { headers: withAuth() })

      toast({
        title: 'Transfer Request Submitted',
        description: `Your booking transfer request to ${selectedClient?.full_name} has been submitted for trainer approval.`,
      })

      onSuccess?.()
      onClose?.()
    } catch (err: any) {
      console.error('Transfer booking error:', err)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to submit transfer request',
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
          <CardTitle>Transfer Booking</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Transfer this session to another client on the app
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Session Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coach:</span>
              <span className="font-semibold">{booking?.trainer_name || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date & Time:</span>
              <span className="font-semibold">{booking?.session_date} {booking?.session_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-semibold">Ksh {Number(booking?.total_amount || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Search Clients */}
          <div className="space-y-2">
            <Label htmlFor="client-search">Search for a client</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="client-search"
                placeholder="Name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Clients List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Select a client</h3>
            
            {loadingClients ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 flex gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-900 dark:text-orange-100 text-sm">No clients found</p>
                  <p className="text-orange-800 dark:text-orange-200 text-sm">
                    {searchQuery ? 'No clients match your search.' : 'No other clients available.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredClients.map((client) => (
                  <button
                    key={client.user_id}
                    onClick={() => setSelectedClientId(client.user_id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedClientId === client.user_id
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/20 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <User className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{client.full_name || 'Client'}</p>
                          {client.email && (
                            <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                          )}
                          {client.phone_number && (
                            <p className="text-xs text-muted-foreground">{client.phone_number}</p>
                          )}
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1 ${
                        selectedClientId === client.user_id
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
              The trainer must approve this transfer before it becomes effective. Both you and the recipient will be notified once a decision is made.
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
              disabled={loading || !selectedClientId || filteredClients.length === 0}
            >
              {loading ? 'Submitting...' : 'Submit Transfer'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
