import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import Header from '@/components/Header'
import { apiRequest } from '@/lib/api'

type ResetStep = 'email' | 'reset' | 'success'

const PasswordReset: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState<ResetStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!email) {
        throw new Error('Please enter your email address')
      }

      const result = await apiRequest('request_password_reset', {
        email: email.trim().toLowerCase(),
      })

      toast({
        title: 'Check your email',
        description: 'Password reset instructions have been sent to your email',
      })
      
      setStep('reset')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Password reset error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your password')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)

    try {
      const token = searchParams.get('token')
      const resetEmail = searchParams.get('email') || email

      if (!token) {
        throw new Error('Invalid reset link. Please request a new password reset.')
      }

      const result = await apiRequest('reset_password_with_token', {
        email: resetEmail,
        token: token,
        new_password: password,
      })

      setStep('success')
      setTimeout(() => {
        navigate('/signin')
      }, 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Password reset error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-120px)]">
        <Card className="w-full max-w-md border-border shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">Reset Password</CardTitle>
            <CardDescription className="text-muted-foreground">
              {step === 'email' && 'Enter your email address'}
              {step === 'reset' && 'Create a new password'}
              {step === 'success' && 'Password updated'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 'success' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Your password has been reset successfully. Redirecting to sign in...
                </p>
                <Button
                  onClick={() => navigate('/signin')}
                  className="w-full border border-trainer-primary bg-transparent text-trainer-primary hover:bg-trainer-primary/10"
                >
                  Go to Sign In
                </Button>
              </div>
            )}

            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-input border-border"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full border border-trainer-primary bg-transparent text-trainer-primary hover:bg-trainer-primary/10 disabled:bg-transparent"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Remember your password? </span>
                  <button
                    type="button"
                    onClick={() => navigate('/signin')}
                    className="text-trainer-primary hover:underline"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-input border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-input border-border"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long
                </p>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full border border-trainer-primary bg-transparent text-trainer-primary hover:bg-trainer-primary/10 disabled:bg-transparent"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting password...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Back to sign in? </span>
                  <button
                    type="button"
                    onClick={() => navigate('/signin')}
                    className="text-trainer-primary hover:underline"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PasswordReset
