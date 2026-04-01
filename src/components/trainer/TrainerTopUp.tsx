import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { loadSettings } from '@/lib/settings'

export const TrainerTopUp: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [amount, setAmount] = useState<number | ''>('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    // try to load phone from profile
    apiRequest('profile_get', { user_id: userId }, { headers: withAuth() })
      .then((data: any) => {
        if (data?.phone_number) setPhone(String(data.phone_number))
      }).catch(() => {})
  }, [userId])

  const startTopUp = async () => {
    if (!userId) return
    const amt = Number(amount || 0)
    if (!amt || amt <= 0) { toast({ title: 'Amount required', description: 'Enter a positive amount', variant: 'destructive' }); return }
    if (!phone.trim()) { toast({ title: 'Phone required', description: 'Enter your M-Pesa phone number (e.g., 2547XXXXXXX)', variant: 'destructive' }); return }

    setLoading(true)
    try {
      toast({ title: 'M-Pesa STK', description: 'Check your phone and enter PIN to approve.' })
      const initRes = await fetch('/api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stk_push_initiate', phone: phone.trim(), amount: amt, account_reference: 'wallet-topup', transaction_description: 'Wallet top up' }) })
      const initJson = await initRes.json().catch(() => null)
      if (!initRes.ok || initJson?.status !== 'success') throw new Error(initJson?.message || 'Failed to initiate STK')
      const checkoutId = String(initJson.data?.CheckoutRequestID || '')
      if (!checkoutId) throw new Error('Missing checkout id')

      // poll for result
      let attempts = 0
      let success = false
      while (attempts < 12) {
        await new Promise(r => setTimeout(r, 3000))
        attempts += 1
        try {
          const qRes = await fetch('/api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stk_push_query', checkout_request_id: checkoutId }) })
          const qJson = await qRes.json().catch(() => null)
          if (qRes.ok && qJson?.status === 'success' && qJson.data?.result_code === '0') {
            success = true
            // record payment
            try { await apiRequest('payment_insert', { trainer_id: userId, amount: amt, status: 'completed', method: 'mpesa', created_at: new Date().toISOString() }, { headers: withAuth() }) } catch {}
            break
          }
          if (qJson?.data?.result_code && qJson.data.result_code !== '0') {
            // failed
            break
          }
        } catch (err) {
          // ignore and retry
        }
      }

      if (success) {
        toast({ title: 'Top up completed', description: `Added Ksh ${amt} to wallet.` })
        onClose?.()
      } else {
        // mark failed
        try { await apiRequest('payment_insert', { trainer_id: userId, amount: amt, status: 'failed', method: 'mpesa', created_at: new Date().toISOString() }, { headers: withAuth() }) } catch {}
        toast({ title: 'Payment failed', description: 'M-Pesa payment did not complete', variant: 'destructive' })
      }
    } catch (err:any) {
      console.error('Top up failed', err)
      toast({ title: 'Error', description: err?.message || 'Failed to top up', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Top Up Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label>Amount</Label>
                <Input value={amount as any} onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')} placeholder="Amount" />
              </div>
              <div>
                <Label>M-Pesa Phone (2547XXXXXXX)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="2547XXXXXXXX" />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onClose?.()} disabled={loading}>Close</Button>
                <Button onClick={startTopUp} disabled={loading}>{loading ? 'Processing...' : 'Pay with M-Pesa'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
