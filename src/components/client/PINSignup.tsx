import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'

interface PINSignupProps {
  onSuccess?: () => void
  onCancel?: () => void
  email?: string
  phone?: string
}

export const PINSignup: React.FC<PINSignupProps> = ({ onSuccess, onCancel, email: initialEmail, phone: initialPhone }) => {
  const { signUp } = useAuth()
  const [step, setStep] = useState<'contact' | 'pin'>('contact')
  const [email, setEmail] = useState(initialEmail || '')
  const [phone, setPhone] = useState(initialPhone || '')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sanitizePhone = (input: string): string => {
    if (!input) return ''
    let p = String(input).trim().replace(/[^0-9]/g, '')
    if (p.startsWith('0')) p = '254' + p.replace(/^0+/, '')
    if (!p.startsWith('254') && (p.startsWith('7') || p.startsWith('1'))) {
      p = '254' + p
    }
    return p
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email && !phone) {
      setError('Please provide either an email or phone number')
      return
    }

    if (email && !email.includes('@')) {
      setError('Please provide a valid email address')
      return
    }

    setStep('pin')
  }

  const handlePINSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setLoading(true)
    try {
      const sanitizedPhone = sanitizePhone(phone)
      
      // Sign up with PIN as password
      await signUp(
        email.trim().toLowerCase() || `user_${Date.now()}@temp.local`,
        pin,
        'client',
        {
          phone_number: sanitizedPhone || undefined,
          email: email || undefined,
        }
      )

      toast({ title: 'Success', description: 'Your account has been created successfully!' })
      onSuccess?.()
    } catch (err: any) {
      console.error('PIN signup error:', err)
      setError(err?.message || 'Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Your Account</CardTitle>
        <CardDescription>
          {step === 'contact' ? 'Enter your contact information' : 'Create a 4-digit PIN for your account'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'contact' ? (
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="07XX XXX XXX or +254..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                We accept Kenyan phone numbers (07... or +254...)
              </p>
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
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Next
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePINSubmit} className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-400">
                <p className="font-semibold">Create a 4-digit PIN</p>
                <p>This PIN will be used to sign in to your account instead of a password.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="pin">4-Digit PIN</Label>
              <Input
                id="pin"
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                placeholder="0000"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
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
                onClick={() => setStep('contact')}
                disabled={loading}
              >
                Back
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={loading || !pin || pin.length < 4}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
