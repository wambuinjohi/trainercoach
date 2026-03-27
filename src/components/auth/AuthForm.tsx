import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useGeolocation } from '@/hooks/use-geolocation'
import { reverseGeocode, searchLocations } from '@/lib/location'
import { Loader2, User, Dumbbell, Eye, EyeOff, ArrowLeft, MapPin } from 'lucide-react'
import AuthLogo from '@/components/auth/AuthLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { toast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import { isValidEmail, isValidPhoneFormat, normalizePhoneNumber } from '@/lib/validation'
import * as apiService from '@/lib/api-service'

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
  const [emailError, setEmailError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ label: string; lat: number; lng: number }>>([])
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [searchingLocations, setSearchingLocations] = useState(false)
  const locationSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync geolocation result to form data
  useEffect(() => {
    if (geoLocation?.lat != null && geoLocation?.lng != null) {
      const syncLocation = async () => {
        setFormData(prev => ({
          ...prev,
          locationLat: geoLocation.lat,
          locationLng: geoLocation.lng,
        }))

        // Try to get human-readable location from coordinates
        try {
          const result = await reverseGeocode(geoLocation.lat, geoLocation.lng)
          if (result?.label) {
            setFormData(prev => ({
              ...prev,
              locationLabel: result.label || '',
            }))
            toast({ title: 'Location captured', description: `Location set to ${result.label}` })
          } else {
            toast({ title: 'GPS coordinates captured', description: `You can now proceed with GPS coordinates (${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)})` })
          }
        } catch (err) {
          console.warn('Failed to reverse geocode location', err)
          toast({ title: 'GPS coordinates captured', description: `You can now proceed with GPS coordinates (${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)})` })
        }
      }
      syncLocation()
    }
  }, [geoLocation])

  // Cleanup location search timeout on unmount
  useEffect(() => {
    return () => {
      if (locationSearchTimeoutRef.current) {
        clearTimeout(locationSearchTimeoutRef.current)
      }
    }
  }, [])

  const handleInputChange = (field: string, value: string) => {
    // Apply phone formatting in real-time
    if (field === 'phone') {
      const normalized = normalizePhoneNumber(value)
      // Only update if value actually changed after normalization
      const formatted = value === '' ? '' : normalized
      setFormData(prev => ({ ...prev, [field]: formatted }))
      // Clear phone error when user starts typing
      setPhoneError(null)
    } else if (field === 'email') {
      setFormData(prev => ({ ...prev, [field]: value }))
      // Clear email error when user starts typing
      setEmailError(null)
    } else if (field === 'locationLabel') {
      setFormData(prev => ({ ...prev, [field]: value }))
      // Handle location search with debouncing
      if (locationSearchTimeoutRef.current) {
        clearTimeout(locationSearchTimeoutRef.current)
      }
      if (value.trim().length >= 2) {
        setShowLocationSuggestions(true)
        setSearchingLocations(true)
        locationSearchTimeoutRef.current = setTimeout(async () => {
          const suggestions = await searchLocations(value)
          if (suggestions) {
            setLocationSuggestions(suggestions)
          }
          setSearchingLocations(false)
        }, 300)
      } else {
        setLocationSuggestions([])
        setShowLocationSuggestions(false)
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleLocationSelect = (location: { label: string; lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      locationLabel: location.label,
      locationLat: location.lat,
      locationLng: location.lng,
    }))
    setShowLocationSuggestions(false)
    toast({ title: 'Location selected', description: location.label })
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    setPhoneError(null)

    // Validate PIN
    if (formData.password.length !== 4) {
      toast({ title: 'Invalid PIN', description: 'Please enter a 4-digit PIN', variant: 'destructive' })
      return
    }
    if (formData.password !== formData.confirmPassword) {
      toast({ title: 'PINs do not match', description: 'Please ensure your PINs match', variant: 'destructive' })
      return
    }

    // Validate location
    if (!formData.locationLabel.trim() && (formData.locationLat == null || formData.locationLng == null)) {
      toast({ title: 'Location required', description: 'Please enter your locality or use GPS', variant: 'destructive' })
      return
    }

    // Validate email format
    const trimmedEmail = formData.email.trim().toLowerCase()
    if (!isValidEmail(trimmedEmail)) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address', variant: 'destructive' })
      setEmailError('Invalid email format')
      return
    }

    // Check if email already exists
    setIsLoading(true)
    try {
      const emailExists = await apiService.checkEmailExists(trimmedEmail)
      if (emailExists?.exists) {
        toast({ title: 'Email Already In Use', description: 'This email is already registered. Please sign in or use a different email.', variant: 'destructive' })
        setEmailError('Email already in use')
        setIsLoading(false)
        return
      }
    } catch (error) {
      console.error('Error checking email:', error)
      // Continue even if check fails
    }

    // Validate phone format
    if (!formData.phone.trim()) {
      toast({ title: 'Phone Required', description: 'Please enter a phone number', variant: 'destructive' })
      setPhoneError('Phone number is required')
      setIsLoading(false)
      return
    }

    if (!isValidPhoneFormat(formData.phone)) {
      toast({ title: 'Invalid Phone', description: 'Please enter a valid Kenyan phone number (07XX XXX XXX or +254...)', variant: 'destructive' })
      setPhoneError('Invalid phone format')
      setIsLoading(false)
      return
    }

    // Check if phone already exists
    try {
      const phoneExists = await apiService.checkPhoneExists(formData.phone)
      if (phoneExists?.exists) {
        toast({ title: 'Phone Already In Use', description: 'This phone number is already registered. Please sign in or use a different number.', variant: 'destructive' })
        setPhoneError('Phone already in use')
        setIsLoading(false)
        return
      }
    } catch (error) {
      console.error('Error checking phone:', error)
      // Continue even if check fails
    }

    // All validations passed, proceed with signup
    try {
      console.log('Starting signup for:', { email: trimmedEmail, userType: formData.userType })

      await signUp(trimmedEmail, formData.password, formData.userType, {
        full_name: formData.fullName.trim(),
        phone_number: formData.phone,
        location: formData.locationLabel.trim() || undefined,
        location_label: formData.locationLabel.trim() || undefined,
        location_lat: formData.locationLat ?? undefined,
        location_lng: formData.locationLng ?? undefined,
      })

      console.log('Signup successful, checking for step 2 redirect')

      // Check if step 2 flag was set and redirect immediately
      const trainerStep2 = localStorage.getItem('trainer_signup_step2') === 'true'
      const clientStep2 = localStorage.getItem('client_signup_step2') === 'true'

      if (trainerStep2 && formData.userType === 'trainer') {
        console.log('Redirecting to trainer step 2')
        window.location.href = '/signup-step2'
        return
      } else if (clientStep2 && formData.userType === 'client') {
        console.log('Redirecting to client step 2')
        window.location.href = '/signup-client-step2'
        return
      }

      // Otherwise call onSuccess callback
      console.log('Signup successful, calling onSuccess callback')
      onSuccess?.(formData.userType)
    } catch (error) {
      console.error('Sign up error:', error)
      setError(error instanceof Error ? error.message : 'Sign up failed. Please try again.')
      toast({
        title: 'Sign up failed',
        description: error instanceof Error ? error.message : 'Please check your details and try again.',
        variant: 'destructive'
      })
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
                    <Label htmlFor="signin-password">4-Digit PIN</Label>
                    <Link to="/password-reset" className="text-xs text-trainer-primary hover:underline">
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input id="signin-password" type={showPassword ? "text" : "password"} placeholder="Enter your 4-digit PIN" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} required className="bg-input border-border pr-10" />
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
                  <Select value={formData.userType} onValueChange={(value: 'client' | 'trainer') => {
                    handleInputChange('userType', value)
                  }}>
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
                  <Input id="phone" type="tel" placeholder="e.g. 0712345678 or +254712345678" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} required className={`bg-input border-border ${phoneError ? 'border-destructive' : ''}`} />
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" placeholder="Enter your email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} required className={`bg-input border-border ${emailError ? 'border-destructive' : ''}`} />
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-location">Your locality</Label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Input id="signup-location" type="text" placeholder="e.g. Nairobi, Parklands" value={formData.locationLabel} onChange={(e) => handleInputChange('locationLabel', e.target.value)} required className="bg-input border-border" />
                        {showLocationSuggestions && locationSuggestions.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {searchingLocations && (
                              <div className="p-2 text-sm text-muted-foreground flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border-2 border-trainer-primary border-t-transparent animate-spin" />
                                Searching...
                              </div>
                            )}
                            {!searchingLocations && locationSuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleLocationSelect(suggestion)}
                                className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm border-b border-border/50 last:border-b-0 flex items-start gap-2"
                              >
                                <MapPin className="h-4 w-4 text-trainer-primary flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">{suggestion.label}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button type="button" variant="outline" onClick={() => {
                        requestGeoLocation()
                      }}>Use GPS</Button>
                    </div>
                  </div>
                  {(formData.locationLat != null && formData.locationLng != null) && (
                    <div className="text-xs text-muted-foreground">{formData.locationLat.toFixed(4)}, {formData.locationLng.toFixed(4)}</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">4-Digit PIN</Label>
                  <div className="relative">
                    <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="Create a 4-digit PIN" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} required className="bg-input border-border pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm PIN</Label>
                  <div className="relative">
                    <Input id="confirm-password" type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your 4-digit PIN" value={formData.confirmPassword} onChange={(e) => handleInputChange('confirmPassword', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} required className="bg-input border-border pr-10" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full border border-trainer-primary bg-transparent text-trainer-primary hover:bg-trainer-primary/10 disabled:bg-transparent" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{formData.userType === 'trainer' ? 'Creating account...' : 'Setting up...'}</> : 'Next'}
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
