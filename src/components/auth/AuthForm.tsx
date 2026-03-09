import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useGeolocation } from '@/hooks/use-geolocation'
import { Loader2, User, Dumbbell, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import AuthLogo from '@/components/auth/AuthLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { toast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'

interface AuthFormProps {
  onSuccess?: (userType?: string) => void
  initialTab?: 'signin' | 'signup'
}

const AuthFormContent: React.FC<AuthFormProps> = ({ onSuccess, initialTab = 'signin' }) => {
  const { signIn, signUp } = useAuth()
  const { location: geoLocation, requestLocation: requestGeoLocation } = useGeolocation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'client' as 'client' | 'trainer',
    fullName: '',
    phone: '',
    locationLabel: '',
    locationLat: null as number | null,
    locationLng: null as number | null,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Sync geolocation result to form data
  useEffect(() => {
    if (geoLocation?.lat != null && geoLocation?.lng != null) {
      setFormData(prev => ({
        ...prev,
        locationLat: geoLocation.lat,
        locationLng: geoLocation.lng,
        locationLabel: prev.locationLabel || 'My location',
      }))
    }
  }, [geoLocation])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const userType = await signIn(formData.email.trim().toLowerCase(), formData.password)
      onSuccess?.(userType || undefined)
    } catch (err) {
      console.error('Sign in error:', err)
      setError('Sign in failed. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  const sanitizePhone = (input: string) => {
    if (!input) return ''
    let p = String(input).trim().replace(/[^0-9]/g, '')
    if (p.startsWith('0')) p = '254' + p.replace(/^0+/, '')
    return p
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Please ensure your passwords match', variant: 'destructive' })
      return
    }

    setIsLoading(true)
    try {
      const sanitizedPhone = sanitizePhone(formData.phone)
      await signUp(formData.email.trim().toLowerCase(), formData.password, formData.userType, {
        full_name: formData.fullName.trim(),
        phone_number: sanitizedPhone,
        location: formData.locationLabel.trim() || undefined,
        location_label: formData.locationLabel.trim() || undefined,
        location_lat: formData.locationLat ?? undefined,
        location_lng: formData.locationLng ?? undefined,
      })
      onSuccess?.(formData.userType)
    } catch (error) {
      console.error('Sign up error:', error)
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-card">
        <CardHeader className="text-center">
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-trainer-primary/30 text-trainer-primary hover:bg-trainer-primary/10 hover:border-trainer-primary transition-all duration-200 text-sm font-medium">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <ThemeToggle />
          </div>
          <div className="relative mb-6 flex justify-center">
            <AuthLogo />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Welcome</CardTitle>
          <CardDescription className="text-muted-foreground">
            Connect with the best trainers in your area
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue={initialTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                {error && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive mb-2">{error}</p>
                    <a href="/api-test" className="text-xs text-primary hover:underline">
                      Having connection issues? Test API →
                    </a>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" type="email" placeholder="Enter your email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} required className="bg-input border-border" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <Link to="/password-reset" className="text-xs text-trainer-primary hover:underline">
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input id="signin-password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} required className="bg-input border-border pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full border border-trainer-primary bg-transparent text-trainer-primary hover:bg-trainer-primary/10 disabled:bg-transparent" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : 'Sign In'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Signup form fields remain unchanged */}
                {/* User Type */}
                <div className="space-y-2">
                  <Label htmlFor="user-type">I am a</Label>
                  <Select value={formData.userType} onValueChange={(value: 'client' | 'trainer') => handleInputChange('userType', value)}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client"><div className="flex items-center gap-2"><User className="h-4 w-4" />Client - Looking for trainers</div></SelectItem>
                      <SelectItem value="trainer"><div className="flex items-center gap-2"><Dumbbell className="h-4 w-4" />Trainer - Offering services</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input id="full-name" type="text" placeholder="Enter your full name" value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} required className="bg-input border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" placeholder="e.g. 0712345678 or +254712345678" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} required className="bg-input border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" placeholder="Enter your email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} required className="bg-input border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-location">Your locality</Label>
                  <div className="flex gap-2">
                    <Input id="signup-location" type="text" placeholder="e.g. Nairobi, Parklands" value={formData.locationLabel} onChange={(e) => handleInputChange('locationLabel', e.target.value)} className="bg-input border-border" />
                    <Button type="button" variant="outline" onClick={() => {
                      requestGeoLocation()
                    }}>Use GPS</Button>
                  </div>
                  {(formData.locationLat != null && formData.locationLng != null) && (
                    <div className="text-xs text-muted-foreground">{formData.locationLat.toFixed(4)}, {formData.locationLng.toFixed(4)}</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="Create a password" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} required className="bg-input border-border pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input id="confirm-password" type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your password" value={formData.confirmPassword} onChange={(e) => handleInputChange('confirmPassword', e.target.value)} required className="bg-input border-border pr-10" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full border border-trainer-primary bg-transparent text-trainer-primary hover:bg-trainer-primary/10 disabled:bg-transparent" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export const AuthForm = AuthFormContent;
