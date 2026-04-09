import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { apiRequest, withAuth } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export const Payouts: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [earnings, setEarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    // load payments where trainer_id = user.id
    apiRequest('payments_get', { trainer_id: userId }, { headers: withAuth() })
      .then((data: any) => {
        setEarnings(Array.isArray(data) ? data : [])
      })
      .catch((error: any) => {
        console.warn('Failed to load payments', error)
      })
      .finally(() => setLoading(false))
  }, [userId])

  const requestPayout = async () => {
    if (!userId) return
    setLoading(true)
    try {
      // sum available earnings
      const total = earnings.reduce((s, e) => s + (e.amount || 0), 0)
      const payload = { trainer_id: userId, amount: total, status: 'requested', requested_at: new Date().toISOString() }
      await apiRequest('payout_insert', payload, { headers: withAuth() })
      toast({ title: 'Payout requested', description: 'We will process your payout shortly.' })
      onClose?.()
    } catch (err) {
      console.error('Request payout failed', err)
      toast({ title: 'Error', description: (err as any)?.message || 'Failed to request payout', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Earnings & Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {earnings.length === 0 && <div className="text-sm text-muted-foreground">No earnings yet</div>}
              {earnings.map((e) => (
                <div key={e.id || `${e.amount}-${e.created_at}`} className="p-2 border border-border rounded-md bg-card flex justify-between items-center">
                  <div>
                    <div className="font-semibold">Ksh {e.amount}</div>
                    <div className="text-sm text-muted-foreground">{new Date(e.created_at || Date.now()).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{e.status || 'completed'}</div>
                </div>
              ))}

              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => onClose?.()} disabled={loading}>Close</Button>
                <Button onClick={requestPayout} disabled={loading || earnings.length === 0}>{loading ? 'Requesting...' : 'Request Payout'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
