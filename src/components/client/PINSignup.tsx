import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import * as apiService from '@/lib/api-service'
import { AccountExistsModal } from '@/components/auth/AccountExistsModal'
import { PINReset } from '@/components/auth/PINReset'
import { isValidEmail, isValidPhoneFormat, normalizePhoneNumber } from '@/lib/validation'

interface PINSignupProps {
  onSuccess?: () => void
  onCancel?: () => void
  email?: string
  phone?: string
}

export const PINSignup: React.FC<PINSignupProps> = ({ onSuccess, onCancel, email: initialEmail, phone: initialPhone }) => {
  const { signUp, signIn } = useAuth()
  const [step, setStep] = useState<'contact' | 'phoneCheck' | 'pin' | 'accountExists' | 'pinReset'>('contact')
  const [email, setEmail] = useState(initialEmail || '')
  const [phone, setPhone] = useState(initialPhone || '')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkedPhone, setCheckedPhone] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const sanitizePhone = (input: string): string => {
    return normalizePhoneNumber(input)
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEmailError(null)
    setPhoneError(null)

    // Validate that at least email or phone is provided
    if (!email && !phone) {
      setError('Please provide either an email or phone number')
      return
    }

    // Validate email format if provided
    if (email && !isValidEmail(email)) {
      setError('Please provide a valid email address')
      setEmailError('Invalid email format')
      return
    }

    // Check if email already exists
    if (email) {
      setLoading(true)
      try {
        const emailExists = await apiService.checkEmailExists(email.trim().toLowerCase())
        if (emailExists?.exists) {
          setError('Email is already registered. Please sign in or use a different email.')
          setEmailError('Email already in use')
          setLoading(false)
          return
        }
      } catch (err: any) {
        console.error('Email check error:', err)
        // Continue even if check fails
      }
    }

    // Validate phone format if provided
    if (phone) {
      const sanitizedPhone = sanitizePhone(phone)

      if (!sanitizedPhone || !isValidPhoneFormat(phone)) {
        setError('Please provide a valid Kenyan phone number (07XX XXX XXX or +254...)')
        setPhoneError('Invalid phone format')
        setLoading(false)
        return
      }

      // Check if phone already exists
      try {
        const response = await apiService.checkPhoneExists(sanitizedPhone)
        setCheckedPhone(sanitizedPhone)

        if (response?.exists) {
          // Account found - show account exists modal
          setStep('accountExists')
        } else {
          // No account - proceed to PIN creation
          setStep('pin')
        }
      } catch (err: any) {
        console.error('Phone check error:', err)
        // On error, assume account doesn't exist and proceed
        setStep('pin')
      } finally {
        setLoading(false)
      }
    } else {
      // No phone provided, proceed to PIN creation
      setLoading(false)
      setStep('pin')
    }
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

  const handleLoginExistingAccount = async () => {
    // Navigate to login screen or show login form
    // The parent component should handle redirecting to login
    onCancel?.()
    toast({ title: 'Please sign in', description: 'Use your phone number and PIN to sign in' })
  }

  const handleResetPIN = () => {
    setStep('pinReset')
  }

  const handleResetSuccess = () => {
    toast({ title: 'Success', description: 'Your PIN has been reset. Please sign in with your new PIN.' })
    onCancel?.()
  }

  const handleBackFromAccountExists = () => {
    setStep('contact')
    setCheckedPhone('')
  }

  return (
    <>
      {step === 'accountExists' ? (
        <AccountExistsModal
          phone={checkedPhone}
          onLogin={handleLoginExistingAccount}
          onResetPin={handleResetPIN}
          onCancel={handleBackFromAccountExists}
        />
      ) : step === 'pinReset' ? (
        <PINReset
          phone={checkedPhone}
          onSuccess={handleResetSuccess}
          onBack={handleBackFromAccountExists}
        />
      ) : (
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
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setEmailError(null)
                    }}
                    className={emailError ? 'border-destructive' : ''}
                  />
                  {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="07XX XXX XXX or +254..."
                    value={phone}
                    onChange={(e) => {
                      const formatted = normalizePhoneNumber(e.target.value)
                      setPhone(e.target.value === '' ? '' : formatted)
                      setPhoneError(null)
                    }}
                    disabled={loading}
                    className={phoneError ? 'border-destructive' : ''}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    We accept Kenyan phone numbers (07... or +254...)
                  </p>
                  {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
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
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      'Next'
                    )}
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
      )}
    </>
  )
}
