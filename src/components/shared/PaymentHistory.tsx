import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Download, Filter } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface PaymentRecord {
  id: string
  user_id: string
  booking_id?: string
  amount: number
  status: string
  method: string
  transaction_reference?: string
  created_at: string
  updated_at: string
}

export const PaymentHistory: React.FC = () => {
  const { user } = useAuth()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')

  useEffect(() => {
    loadPayments()
  }, [user?.id, statusFilter, methodFilter])

  const loadPayments = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      // This endpoint should be created in the API to get user's payment history
      const data = await apiRequest('payments_get', { user_id: user.id }, { headers: withAuth() })
      let paymentList = data?.data ? (Array.isArray(data.data) ? data.data : [data.data]) : []
      
      // Apply filters
      if (statusFilter !== 'all') {
        paymentList = paymentList.filter((p: any) => p.status === statusFilter)
      }
      if (methodFilter !== 'all') {
        paymentList = paymentList.filter((p: any) => p.method === methodFilter)
      }
      
      setPayments(paymentList)
    } catch (err) {
      console.warn('Failed to load payments', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getMethodLabel = (method: string) => {
    const methods: { [key: string]: string } = {
      'mpesa': 'M-Pesa',
      'stk': 'M-Pesa STK Push',
      'card': 'Credit/Debit Card',
      'bank': 'Bank Transfer',
      'wallet': 'Wallet',
      'b2c': 'M-Pesa B2C'
    }
    return methods[method?.toLowerCase()] || method
  }

  const exportCSV = () => {
    if (payments.length === 0) {
      toast({ title: 'No data', description: 'No payments to export', variant: 'destructive' })
      return
    }

    const csv = [
      ['Date', 'Amount (Ksh)', 'Status', 'Method', 'Reference', 'Booking ID'].join(','),
      ...payments.map(p => [
        new Date(p.created_at).toLocaleString(),
        p.amount,
        p.status,
        p.method,
        p.transaction_reference || 'N/A',
        p.booking_id || 'N/A'
      ].map(v => `"${v}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast({ title: 'Exported', description: 'Payment history exported successfully' })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              >
                <option value="all">All Methods</option>
                <option value="mpesa">M-Pesa</option>
                <option value="stk">STK Push</option>
                <option value="card">Card</option>
                <option value="wallet">Wallet</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={exportCSV} variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Payments List */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No payments found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold">Ksh {payment.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <span>{getMethodLabel(payment.method)}</span>
                          <span>•</span>
                          <span>{new Date(payment.created_at).toLocaleDateString()}</span>
                          {payment.transaction_reference && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-xs">{payment.transaction_reference}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusColor(payment.status)}>
                    {payment.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Payments</p>
                <p className="text-2xl font-bold">{payments.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">Ksh {payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{payments.filter(p => p.status === 'completed' || p.status === 'success').length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{payments.filter(p => p.status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
