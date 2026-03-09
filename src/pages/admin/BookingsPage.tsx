import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const BOOKING_STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_session: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
    isDestructive?: boolean
  }>({
    open: false,
    title: '',
    description: '',
    action: async () => {},
  })
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    loadBookings()
  }, [])

  const loadBookings = async () => {
    try {
      setLoading(true)
      const bookingsData = await apiService.getAllBookings()
      const bookingsList = Array.isArray(bookingsData) ? bookingsData : bookingsData?.data || []
      setBookings(bookingsList)
    } catch (error) {
      console.error('Failed to load bookings:', error)
      toast({ title: 'Error', description: 'Failed to load bookings', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const updateBookingStatus = (booking: any, newStatus: string) => {
    const statusLabels: Record<string, string> = {
      confirmed: 'Confirmed',
      in_session: 'In Session',
      completed: 'Completed',
      cancelled: 'Cancelled',
    }
    
    setConfirmModal({
      open: true,
      title: 'Update Booking Status',
      description: `Change booking status from "${statusLabels[booking.status] || booking.status}" to "${statusLabels[newStatus] || newStatus}"?`,
      isDestructive: newStatus === 'cancelled',
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.updateBooking(booking.id, { status: newStatus })
          setBookings(bookings.map(b => (b.id === booking.id ? { ...b, status: newStatus } : b)))
          toast({ title: 'Success', description: 'Booking status updated' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Update booking status error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to update booking', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  const cancelBooking = (booking: any) => {
    setConfirmModal({
      open: true,
      title: 'Cancel Booking',
      description: `Are you sure you want to cancel this booking? This action cannot be undone.`,
      isDestructive: true,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.updateBooking(booking.id, { status: 'cancelled' })
          setBookings(bookings.map(b => (b.id === booking.id ? { ...b, status: 'cancelled' } : b)))
          toast({ title: 'Success', description: 'Booking cancelled' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Cancel booking error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to cancel booking', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  const getStatusBadgeColor = (status: string) => {
    return BOOKING_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(num)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading bookings...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Bookings Management</h1>
        <Badge variant="secondary">{bookings.length}</Badge>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">All Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-2">ID</th>
                  <th className="p-2">Client</th>
                  <th className="p-2">Trainer</th>
                  <th className="p-2">Session Date</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      No bookings found
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id} className="border-t">
                      <td className="p-2 text-sm">{booking.id?.substring(0, 8) || '-'}...</td>
                      <td className="p-2 text-sm">{booking.client_name || booking.client_id || '-'}</td>
                      <td className="p-2 text-sm">{booking.trainer_name || booking.trainer_id || '-'}</td>
                      <td className="p-2 text-sm">{formatDate(booking.session_date)}</td>
                      <td className="p-2 text-sm font-semibold">{formatCurrency(booking.amount || booking.total_amount || 0)}</td>
                      <td className="p-2">
                        <Badge className={getStatusBadgeColor(booking.status)}>
                          {booking.status?.replace('_', ' ') || 'unknown'}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">{formatDate(booking.created_at)}</td>
                      <td className="p-2">
                        <div className="flex gap-2 flex-wrap">
                          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                            <Select value={booking.status || 'confirmed'} onValueChange={(v) => updateBookingStatus(booking, v)}>
                              <SelectTrigger className="bg-input border-border w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="in_session">In Session</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {booking.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => cancelBooking(booking)}
                            >
                              Cancel
                            </Button>
                          )}
                          {booking.status === 'cancelled' && (
                            <span className="text-xs text-muted-foreground">Cancelled</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmModal.open} onOpenChange={(open) => setConfirmModal({ ...confirmModal, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmModal.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmModal.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmModal.action}
              disabled={confirmLoading}
              className={confirmModal.isDestructive ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {confirmLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
