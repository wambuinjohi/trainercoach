import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Send, Loader2, Check } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

export const TrainerPayoutRequest: React.FC = () => {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [requests, setRequests] = useState<any[]>([])
  const [balance, setBalance] = useState(0)

  // Load trainer's earnings and pending requests
  useEffect(() => {
    if (!user?.id) return

    const loadData = async () => {
      try {
        setLoading(true)

        // Get trainer's payments/earnings
        const paymentsData = await apiRequest('payments_get', { trainer_id: user.id }, { headers: withAuth() })

        // Use summary if available, fallback to sum of trainer_net_amount
        let totalEarnings = 0
        if (paymentsData?.summary?.total_earnings) {
          totalEarnings = Number(paymentsData.summary.total_earnings) || 0
        } else {
          totalEarnings = paymentsData?.data?.reduce((sum: number, p: any) => sum + (Number(p.trainer_net_amount) || 0), 0) || 0
        }
        setBalance(totalEarnings)

        // Get pending payout requests for this trainer
        const requestsData = await apiRequest('select', {
          table: 'payout_requests',
          where: `trainer_id = '${user.id}'`,
          order: 'requested_at DESC LIMIT 10'
        }, { headers: withAuth() })

        if (requestsData?.data) {
          setRequests(Array.isArray(requestsData.data) ? requestsData.data : [requestsData.data])
        }
      } catch (err) {
        console.warn('Failed to load payout data', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user?.id])

  const submitRequest = async () => {
    const amountNum = parseFloat(amount)

    if (!amountNum || amountNum <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }

    if (amountNum > balance) {
      toast({ title: 'Insufficient balance', description: `You only have Ksh ${balance.toFixed(2)} available`, variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const data = await apiRequest('payout_insert', {
        trainer_id: user?.id,
        amount: amountNum,
        status: 'pending'
      }, { headers: withAuth() })

      if (data?.status === 'success') {
        toast({ title: 'Payout request submitted', description: `Admin will review your request shortly` })
        setAmount('')
        // Reload requests
        const updatedRequests = await apiRequest('select', {
          table: 'payout_requests',
          where: `trainer_id = '${user?.id}'`,
          order: 'requested_at DESC LIMIT 10'
        }, { headers: withAuth() })
        if (updatedRequests?.data) {
          setRequests(Array.isArray(updatedRequests.data) ? updatedRequests.data : [updatedRequests.data])
        }
      } else {
        toast({ title: 'Error', description: data?.message || 'Failed to submit request', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to submit request', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Balance</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <div className="text-4xl font-bold text-primary">
              Ksh {balance.toFixed(2)}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-2">From completed sessions</p>
          {!loading && balance > 0 && (
            <>
              {requests && requests.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  This includes any client travel/transport fees you've earned
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Payout Request Form */}
      <Card>
        <CardHeader>
          <CardTitle>Request Payout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold">Admin approval required</p>
              <p>Your payout request will be reviewed and approved by the admin. The amount shown is your net earnings (platform fees and transport compensation already calculated).</p>
            </div>
          </div>

          <div>
            <Label htmlFor="payout_amount">Amount to Request (Ksh)</Label>
            <Input
              id="payout_amount"
              type="number"
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting || loading}
              min="0"
              step="100"
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available: Ksh {balance.toFixed(2)}
            </p>
          </div>

          <Button
            onClick={submitRequest}
            disabled={submitting || loading || !amount || parseFloat(amount) <= 0}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No payout requests yet</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">Ksh {Number(req.amount).toFixed(2)}</p>
                      <Badge className={getStatusColor(req.status)}>
                        {req.status === 'approved' ? 'Being Processed' : req.status}
                      </Badge>
                    </div>
                    {req.net_amount && (
                      <p className="text-sm text-muted-foreground">
                        After commission: Ksh {Number(req.net_amount).toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(req.requested_at).toLocaleDateString()} at {new Date(req.requested_at).toLocaleTimeString()}
                    </p>
                  </div>
                  {req.status === 'completed' && (
                    <Check className="h-5 w-5 text-green-600 ml-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
