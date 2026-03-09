import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api'

interface RefundModalProps {
  dispute: {
    id: string | number
    client: string
    amount: number
    issue: string
  }
  clientPhone?: string
  onClose: () => void
  onSuccess: () => void
}

export const RefundModal: React.FC<RefundModalProps> = ({
  dispute,
  clientPhone = '',
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'confirm' | 'phone' | 'processing'>('confirm')
  const [phone, setPhone] = useState(clientPhone)
  const [loading, setLoading] = useState(false)

  const normalizePhoneNumber = (phoneInput: string): string => {
    let normalized = phoneInput.trim().replace(/\s+/g, '')

    // Remove leading +
    if (normalized.startsWith('+')) {
      normalized = normalized.slice(1)
    }

    // Convert 07 to 254 (Kenya format)
    if (normalized.startsWith('07')) {
      normalized = '254' + normalized.slice(1)
    }

    // Add country code if not present
    if (!normalized.startsWith('254') && normalized.startsWith('7')) {
      normalized = '254' + normalized
    }

    return normalized
  }

  const handleConfirmRefund = () => {
    if (!phone || phone.trim().length < 9) {
      toast({
        title: 'Error',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      })
      return
    }
    setStep('processing')
    processRefund()
  }

  const processRefund = async () => {
    setLoading(true)
    try {
      // Normalize phone number to M-Pesa format (254xxxxxxxxx)
      const normalizedPhone = normalizePhoneNumber(phone)

      // Step 1: Get user details to determine user_id from phone
      const userResult = await apiRequest('select', {
        table: 'users',
        where: `id = '${dispute.client}'`,
      })

      if (!userResult?.data?.length) {
        throw new Error('Client not found')
      }

      const client = userResult.data[0]

      // Step 2: Create B2C payment record for refund
      let b2cPaymentId: string
      const referenceId = 'refund_' + Date.now()

      try {
        const insertResult = await apiRequest('insert', {
          table: 'b2c_payments',
          data: {
            user_id: dispute.client,
            user_type: 'client',
            phone_number: normalizedPhone,
            amount: dispute.amount,
            reference_id: referenceId,
            status: 'pending',
            initiated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        })

        // Get the ID from the backend response
        b2cPaymentId = insertResult?.id || insertResult?.data?.id
        if (!b2cPaymentId) {
          throw new Error('Backend did not return payment ID')
        }
      } catch (err: any) {
        console.error('Failed to create B2C payment record:', err)
        throw new Error('Failed to create payment record: ' + (err?.message || 'Unknown error'))
      }

      // Step 3: Initiate B2C payment (refund)
      const initiateResult = await apiRequest('b2c_payment_initiate', {
        b2c_payment_id: b2cPaymentId,
        phone_number: normalizedPhone,
        amount: dispute.amount,
      })

      if (!initiateResult || initiateResult.status !== 'success') {
        throw new Error(initiateResult?.message || 'Failed to initiate B2C payment')
      }

      // Step 4: Update dispute status to resolved
      await apiRequest('update', {
        table: 'reported_issues',
        data: { status: 'resolved' },
        where: `id = '${dispute.id}'`,
      })

      // Step 5: Log refund transaction
      await apiRequest('insert', {
        table: 'transactions',
        data: {
          user_id: dispute.client,
          type: 'refund',
          amount: dispute.amount,
          description: `Refund for dispute: ${dispute.issue}`,
          reference_id: referenceId,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      }).catch(err => {
        // Log error but don't fail the refund if transaction logging fails
        console.error('Failed to log transaction:', err)
      })

      toast({
        title: 'Success',
        description: `Refund of Ksh ${dispute.amount} initiated to ${normalizedPhone}. Waiting for M-Pesa confirmation.`,
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Refund error:', error)
      toast({
        title: 'Refund Failed',
        description: error?.message || 'Failed to process refund. Please try again.',
        variant: 'destructive',
      })
      setStep('confirm')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Confirm Refund
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                You are about to refund <strong>Ksh {dispute.amount}</strong> to the client.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">Client ID</p>
                  <p className="font-medium">{dispute.client}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">Ksh {dispute.amount}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Reason</p>
                <p className="font-medium">{dispute.issue}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={() => setStep('phone')}
                disabled={loading}
                className="flex-1"
              >
                Proceed
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'phone') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Enter Client Phone Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The refund will be sent to this M-Pesa phone number.
            </p>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="0712345678 or +254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: 0712345678 (Kenya) or +254712345678
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('confirm')}
                disabled={loading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmRefund}
                disabled={loading || !phone}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Refund'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-semibold">Processing Refund</p>
            <p className="text-sm text-muted-foreground">
              Sending Ksh {dispute.amount} to {normalizePhoneNumber(phone)}...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
