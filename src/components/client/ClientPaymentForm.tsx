import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, PhoneOff, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { loadSettings } from '@/lib/settings'

interface PaymentSession {
  id: string
  amount: number
  phone: string
  checkoutRequestId: string
  status: 'pending' | 'success' | 'failed' | 'timeout'
  startTime: number
  lastCheck: number
}

export const ClientPaymentForm: React.FC<{ bookingId?: string; amount: number; onSuccess?: () => void }> = ({
  bookingId,
  amount,
  onSuccess
}) => {
  const { user } = useAuth()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null)
  const [pollingActive, setPollingActive] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load ongoing payment session from localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem(`payment_session_${bookingId}`)
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession)
        // Check if session is still valid (less than 5 minutes old)
        if (Date.now() - session.startTime < 5 * 60 * 1000) {
          setPaymentSession(session)
          if (session.status === 'pending') {
            setPollingActive(true)
          }
        } else {
          localStorage.removeItem(`payment_session_${bookingId}`)
        }
      } catch {}
    }
  }, [bookingId])

  // Poll for payment status
  useEffect(() => {
    if (!pollingActive || !paymentSession) return

    const pollWithCreds = async () => {
      try {
        const response = await fetch('/api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'stk_push_query',
            checkout_request_id: paymentSession.checkoutRequestId
          })
        })

        const result = await response.json()
        const resultCode = result.data?.result_code || result.resultCode || result.result?.ResultCode

        let newStatus: 'pending' | 'success' | 'failed' | 'timeout' = paymentSession.status
        if (resultCode === '0') {
          newStatus = 'success'
        } else if (resultCode === '1032') {
          newStatus = 'timeout'
        } else if (resultCode !== '0' && resultCode !== '') {
          newStatus = 'failed'
        }

        if (newStatus !== 'pending') {
          setPollingActive(false)
          const updatedSession = { ...paymentSession, status: newStatus, lastCheck: Date.now() }
          setPaymentSession(updatedSession)
          localStorage.setItem(`payment_session_${bookingId}`, JSON.stringify(updatedSession))

          if (newStatus === 'success') {
            toast({ title: 'Payment successful!', description: 'Your payment has been processed' })
            onSuccess?.()
          } else if (newStatus === 'timeout') {
            toast({ title: 'Payment timeout', description: 'STK prompt expired. Please try again', variant: 'destructive' })
          } else {
            toast({ title: 'Payment failed', description: 'Please try again', variant: 'destructive' })
          }
        }
      } catch (err) {
        console.warn('Payment polling error', err)
      }
    }

    pollingIntervalRef.current = setInterval(pollWithCreds, 2000)
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [pollingActive, paymentSession, bookingId, onSuccess])

  const initiatePayment = async () => {
    const phoneNum = phone.trim()

    if (!phoneNum || phoneNum.length < 9) {
      toast({ title: 'Invalid phone', description: 'Please enter a valid M-Pesa phone number', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stk_push_initiate',
          phone: phoneNum,
          amount: amount,
          booking_id: bookingId,
          account_reference: bookingId ? `booking_${bookingId}` : 'service_payment',
          transaction_description: 'Service Payment'
        })
      })

      const result = await response.json()
      const checkoutId = result.data?.CheckoutRequestID || result.CheckoutRequestID || result.result?.CheckoutRequestID

      if (checkoutId && result.status === 'success') {
        const session: PaymentSession = {
          id: `${Date.now()}`,
          amount,
          phone: phoneNum,
          checkoutRequestId: checkoutId,
          status: 'pending',
          startTime: Date.now(),
          lastCheck: Date.now()
        }

        setPaymentSession(session)
        localStorage.setItem(`payment_session_${bookingId}`, JSON.stringify(session))
        setPollingActive(true)

        toast({ title: 'STK prompt sent', description: 'Check your phone to complete payment' })
      } else {
        toast({
          title: 'Failed to initiate payment',
          description: result.errorMessage || 'Please try again',
          variant: 'destructive'
        })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to initiate payment', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const clearSession = () => {
    setPaymentSession(null)
    setPollingActive(false)
    if (bookingId) {
      localStorage.removeItem(`payment_session_${bookingId}`)
    }
  }

  const retryPayment = () => {
    clearSession()
    setPhone('')
  }

  if (paymentSession?.status === 'success') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6 flex items-center gap-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <div className="flex-1">
            <p className="font-semibold text-green-900">Payment Successful</p>
            <p className="text-sm text-green-700">Ksh {amount.toFixed(2)} paid via M-Pesa</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (paymentSession?.status === 'pending') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complete Your Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold">STK Prompt Sent</p>
              <p>Check your phone for the M-Pesa prompt and enter your PIN to complete the payment</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <div className="text-3xl font-bold text-primary">Ksh {amount.toFixed(2)}</div>
          </div>

          <div className="space-y-2">
            <Label>Phone Number</Label>
            <div className="p-3 bg-gray-100 rounded text-sm">{paymentSession.phone}</div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for payment confirmation...
          </div>

          <Button
            variant="outline"
            onClick={retryPayment}
            disabled={pollingActive}
            className="w-full"
          >
            <PhoneOff className="h-4 w-4 mr-2" />
            Didn't receive prompt? Try again
          </Button>

          <p className="text-xs text-muted-foreground">
            The prompt will expire in 5 minutes. This session will be saved and you can complete payment later.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (paymentSession?.status === 'failed' || paymentSession?.status === 'timeout') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Payment {paymentSession.status === 'timeout' ? 'Timeout' : 'Failed'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">
                {paymentSession.status === 'timeout' ? 'Payment prompt expired' : 'Payment was not successful'}
              </p>
              <p className="text-sm text-red-700 mt-1">
                {paymentSession.status === 'timeout'
                  ? 'The STK prompt expired. Please try again.'
                  : 'Please check your balance and try again.'}
              </p>
            </div>
          </div>

          <Button onClick={retryPayment} className="w-full">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay for Service</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold">Secure M-Pesa Payment</p>
            <p>Pay directly using M-Pesa on your phone</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Amount to Pay</Label>
          <div className="text-3xl font-bold text-primary">Ksh {amount.toFixed(2)}</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">M-Pesa Phone Number</Label>
          <Input
            id="phone"
            placeholder="254712345678 or +254712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            type="tel"
          />
          <p className="text-xs text-muted-foreground">
            Enter the phone number registered with M-Pesa
          </p>
        </div>

        <Button
          onClick={initiatePayment}
          disabled={loading || !phone}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Initiating Payment...
            </>
          ) : (
            'Send STK Prompt'
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          You will receive an M-Pesa prompt on your phone. Enter your PIN to complete payment.
        </p>
      </CardContent>
    </Card>
  )
}
