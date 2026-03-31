import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { apiRequest, withAuth } from '@/lib/api'
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
  pending_attendance_confirmation: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  pending_session: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  completed_session: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  refunded: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
}

const PAYOUT_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  initiated: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [paymentStatusByBooking, setPaymentStatusByBooking] = useState<Record<string, any>>({})
  const [payoutStatusByBooking, setPayoutStatusByBooking] = useState<Record<string, any>>({})
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
    loadBookingsPage(1)
  }, [])

  useEffect(() => {
    if (page > 1) {
      loadBookingsPage(page)
    }
  }, [page])

  const normalizeRows = (result: any) => {
    if (Array.isArray(result)) return result
    if (Array.isArray(result?.data)) return result.data
    if (result?.data && typeof result.data === 'object') return [result.data]
    return []
  }

  const escapeSqlValue = (value: string) => value.replace(/'/g, "\\'")

  const getBookingIdsWhereClause = (bookingIds: string[]) => bookingIds
    .filter(Boolean)
    .map((bookingId) => `booking_id = '${escapeSqlValue(bookingId)}'`)
    .join(' OR ')

  const loadRelatedStatuses = async (bookingsList: any[]) => {
    const bookingIds = bookingsList.map((booking) => booking.id).filter(Boolean)

    if (bookingIds.length === 0) {
      setPaymentStatusByBooking({})
      setPayoutStatusByBooking({})
      return
    }

    const whereClause = getBookingIdsWhereClause(bookingIds)

    const [paymentsResult, payoutsResult] = await Promise.all([
      apiRequest('select', {
        table: 'payments',
        where: whereClause,
        order: 'created_at DESC',
      }, { headers: withAuth() }),
      apiRequest('select', {
        table: 'b2c_payments',
        where: whereClause,
        order: 'created_at DESC',
      }, { headers: withAuth() }),
    ])

    const latestPayments = normalizeRows(paymentsResult).reduce((acc: Record<string, any>, payment: any) => {
      if (payment?.booking_id && !acc[payment.booking_id]) {
        acc[payment.booking_id] = payment
      }
      return acc
    }, {})

    const latestPayouts = normalizeRows(payoutsResult).reduce((acc: Record<string, any>, payout: any) => {
      if (payout?.booking_id && !acc[payout.booking_id]) {
        acc[payout.booking_id] = payout
      }
      return acc
    }, {})

    setPaymentStatusByBooking(latestPayments)
    setPayoutStatusByBooking(latestPayouts)
  }

  const loadBookingsPage = async (pageNum: number) => {
    try {
      setLoading(true)
      const result = await apiService.getBookingsWithPagination({ page: pageNum, pageSize })
      const bookingsList = Array.isArray(result.data) ? result.data : result?.data || []
      setBookings(bookingsList)
      await loadRelatedStatuses(bookingsList)
      if (result.count !== undefined) {
        setTotalCount(result.count)
      }
      setPage(pageNum)
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
    const cancellationReason = window.prompt('Enter cancellation reason')?.trim()

    if (!cancellationReason) {
      toast({
        title: 'Cancellation reason required',
        description: 'Please provide a reason before cancelling the booking',
        variant: 'destructive',
      })
      return
    }

    setConfirmModal({
      open: true,
      title: 'Cancel Booking',
      description: `Are you sure you want to cancel this booking? Reason: "${cancellationReason}". This action cannot be undone.`,
      isDestructive: true,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.updateBooking(booking.id, {
            status: 'cancelled',
            cancellation_reason: cancellationReason,
            cancelled_at: new Date().toISOString(),
          })
          setBookings(bookings.map(b => (b.id === booking.id ? { ...b, status: 'cancelled', cancellation_reason: cancellationReason } : b)))
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

  const getPaymentStatus = (booking: any) => paymentStatusByBooking[booking.id]?.status || 'not_recorded'

  const getPayoutStatus = (booking: any) => {
    return payoutStatusByBooking[booking.id]?.status || booking.payout_status || 'not_initiated'
  }

  const getBookingStatusKey = (booking: any) => {
    const payoutStatus = getPayoutStatus(booking)

    if (booking.status === 'cancelled') {
      return 'cancelled'
    }

    if (payoutStatus === 'completed') {
      return 'paid'
    }

    if (booking.status === 'completed' || booking.session_phase === 'completed') {
      return 'completed_session'
    }

    if (booking.trainer_marked_start && !booking.client_confirmed_start) {
      return 'pending_attendance_confirmation'
    }

    return 'pending_session'
  }

  const getStatusBadgeColor = (booking: any) => {
    return BOOKING_STATUS_COLORS[getBookingStatusKey(booking)] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }

  const getStatusLabel = (booking: any) => {
    switch (getBookingStatusKey(booking)) {
      case 'pending_attendance_confirmation':
        return 'Pending Attendance Confirmation'
      case 'completed_session':
        return 'Completed Session'
      case 'paid':
        return 'Paid'
      case 'cancelled':
        return 'Cancelled'
      default:
        return 'Pending Session'
    }
  }

  const getPaymentBadgeColor = (status: string) => {
    return PAYMENT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }

  const getPaymentLabel = (status: string) => {
    if (status === 'not_recorded') return 'Not Recorded'
    return status?.replace(/_/g, ' ') || 'Unknown'
  }

  const getPayoutBadgeColor = (status: string) => {
    return PAYOUT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }

  const getPayoutLabel = (status: string) => {
    if (status === 'not_initiated') return 'Not Initiated'
    return status?.replace(/_/g, ' ') || 'Unknown'
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
        <Badge variant="secondary">{totalCount}</Badge>
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
                  <th className="p-2">Payment Status</th>
                  <th className="p-2">Payout Status</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-4 text-center text-muted-foreground">
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
                        <Badge className={getStatusBadgeColor(booking)}>
                          {getStatusLabel(booking)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge className={getPaymentBadgeColor(getPaymentStatus(booking))}>
                          {getPaymentLabel(getPaymentStatus(booking))}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge className={getPayoutBadgeColor(getPayoutStatus(booking))}>
                          {getPayoutLabel(getPayoutStatus(booking))}
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
                            <div className="text-xs text-muted-foreground">
                              <div>Cancelled</div>
                              {booking.cancellation_reason && (
                                <div className="max-w-[220px] break-words">Reason: {booking.cancellation_reason}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalCount > pageSize && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(totalCount / pageSize)} ({totalCount} total)
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1 || loading}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === Math.ceil(totalCount / pageSize) || loading}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
