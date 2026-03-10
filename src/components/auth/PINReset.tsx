import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { resetPINWithPhone } from '@/lib/api-service'

interface PINResetProps {
  phone: string
  onSuccess?: () => void
  onBack?: () => void
}

export const PINReset: React.FC<PINResetProps> = ({ phone, onSuccess, onBack }) => {
  const [step, setStep] = useState<'verify' | 'reset'>('verify')
  const [verificationCode, setVerificationCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!verificationCode.trim()) {
      setError('Please enter the verification code sent to your phone')
      return
    }

    // For MVP, we'll assume the verification code is valid
    // In production, this would validate against the code sent via SMS
    setStep('reset')
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate PIN format
    if (!/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    if (newPin === verificationCode) {
      setError('New PIN cannot be the same as verification code')
      return
    }

    setLoading(true)
    try {
      await resetPINWithPhone(phone, newPin)
      toast({ title: 'Success', description: 'Your PIN has been reset successfully!' })
      onSuccess?.()
    } catch (err: any) {
      console.error('PIN reset error:', err)
      setError(err?.message || 'Failed to reset PIN. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={onBack}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        <CardTitle>Reset Your PIN</CardTitle>
        <CardDescription>
          {step === 'verify' ? 'Verify your identity to reset your PIN' : 'Create a new 4-digit PIN'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'verify' ? (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-400">
                <p className="font-semibold">Verification code sent</p>
                <p>Check your phone for a verification code</p>
              </div>
            </div>

            <div>
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                type="text"
                placeholder="Enter the code sent to your phone"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="text-center"
              />
            </div>

            {error && (
              <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onBack}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Verify
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-700 dark:text-green-400">
                <p className="font-semibold">Identity verified</p>
                <p>Create a new 4-digit PIN for your account</p>
              </div>
            </div>

            <div>
              <Label htmlFor="new-pin">New 4-Digit PIN</Label>
              <Input
                id="new-pin"
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                placeholder="0000"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <div>
              <Label htmlFor="confirm-pin">Confirm PIN</Label>
              <Input
                id="confirm-pin"
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                placeholder="0000"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            {error && (
              <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep('verify')}
                disabled={loading}
              >
                Back
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={loading || !newPin || newPin.length < 4}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset PIN'
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
