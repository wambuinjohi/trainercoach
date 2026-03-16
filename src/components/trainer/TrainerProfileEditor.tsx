import React, { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { MediaUploadSection } from './MediaUploadSection'
import { MapLocationSelector } from './MapLocationSelector'
import { AvailabilitySelector } from './AvailabilitySelector'
import { VerificationDocumentsForm } from './VerificationDocumentsForm'
import { SponsorSelector } from './SponsorSelector'
import { useFileUpload } from '@/hooks/use-file-upload'
import { Upload, X } from 'lucide-react'
import { detectDeviceTimezone } from '@/lib/timezone'
import * as apiService from '@/lib/api-service'
import { apiRequest, withAuth } from '@/lib/api'
import { getDefaultServiceRadius } from '@/lib/location-utils'

interface TrainerProfile {
  user_id?: string
  user_type?: string
  name?: string
  hourly_rate?: number
  service_radius?: number
  availability?: any
  payout_details?: any
  profile_image?: string
  bio?: string
  area_of_residence?: string
  area_coordinates?: { lat: number; lng: number }
  mpesa_number?: string
  registration_path?: 'direct' | 'sponsored'
  path_locked?: boolean
}

interface Category {
  id: number
  name: string
  icon?: string
  description?: string
}

// Helper function to clean and parse disciplines/certifications
const cleanAndParseArray = (value: any): string[] => {
  if (!value) return []

  // If already an array, filter out empty/whitespace-only values
  if (Array.isArray(value)) {
    return value
      .map(item => String(item).trim().replace(/['"\\]/g, ''))
      .filter(Boolean)
  }

  // If string, try to parse as JSON first
  if (typeof value === 'string') {
    const stringValue = value.trim()

    // Try JSON parsing
    if (stringValue.startsWith('[') || stringValue.startsWith('{')) {
      try {
        const parsed = JSON.parse(stringValue)
        if (Array.isArray(parsed)) {
          return parsed
            .map(item => String(item).trim().replace(/['"\\]/g, ''))
            .filter(Boolean)
        }
      } catch {
        // If JSON parsing fails, treat as raw string
      }
    }

    // Clean the string and split by comma
    return stringValue
      .split(',')
      .map(item => item.trim().replace(/['"\\]/g, ''))
      .filter(Boolean)
  }

  return []
}

export const TrainerProfileEditor: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Partial<TrainerProfile>>({})
  const [name, setName] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [categoryPricing, setCategoryPricing] = useState<Record<number, number>>({})
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const [sponsorId, setSponsorId] = useState<string | null>(null)
  const [sponsorName, setSponsorName] = useState<string | null>(null)
  const [registrationPath, setRegistrationPath] = useState<'direct' | 'sponsored'>('direct')
  const [pathLocked, setPathLocked] = useState(false)
  const [areaLocation, setAreaLocation] = useState<{ lat: number; lng: number; label: string }>({
    lat: -1.2921,
    lng: 36.8219, // Default to Nairobi, Kenya
    label: ''
  })
  const [calculatedServiceRadius] = useState(() => getDefaultServiceRadius())
  const [verificationDocuments, setVerificationDocuments] = useState<any[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { upload } = useFileUpload({
    maxFileSize: 5 * 1024 * 1024,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif'],
    onSuccess: (files) => {
      if (files.length > 0) {
        const uploadedFile = files[0]
        console.log('[Image Upload] Success - updating profile_image to:', uploadedFile.url)
        handleChange('profile_image', uploadedFile.url)
        toast({ title: 'Image uploaded', description: 'Profile image has been updated' })
        setUploadingImage(false)
        setUploadProgress(0)
      }
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error, variant: 'destructive' })
      setUploadingImage(false)
      setUploadProgress(0)
    },
    onProgress: (progress) => {
      setUploadProgress(progress)
    }
  })

  useEffect(() => {
    const loadCategories = async () => {
      try {
        console.log('Loading all categories...')
        const categoriesData = await apiService.getCategories()
        console.log('All categories response:', categoriesData)

        if (categoriesData?.data && Array.isArray(categoriesData.data)) {
          console.log('Categories loaded:', categoriesData.data)
          setCategories(categoriesData.data)
        } else {
          console.warn('Invalid categories response format:', categoriesData)
        }
      } catch (error) {
        console.error('Failed to fetch categories', error)
        toast({
          title: 'Failed to load categories',
          description: `${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'destructive'
        })
      } finally {
        setCategoriesLoading(false)
      }
    }

    loadCategories()
  }, [])

  useEffect(() => {
    if (!userId) {
      console.log('[Profile Load] Waiting for userId...')
      return
    }
    setLoading(true)
    setSelectedCategoryIds([])
    setCategoryPricing({})
    setDocumentsLoading(true)
    const loadProfile = async () => {
      try {
        // First, try to load from localStorage cache for instant display
        const cachedProfile = localStorage.getItem(`trainer_profile_${userId}`)
        if (cachedProfile) {
          try {
            const cachedData = JSON.parse(cachedProfile)
            console.log('[Profile Load] Loaded from localStorage cache:', cachedData)
            setProfile(cachedData)
            setName(String(cachedData.full_name || cachedData.name || ''))
            setRegistrationPath(cachedData.registration_path || 'direct')
            setPathLocked(cachedData.path_locked || false)
            if (cachedData.area_coordinates) {
              try {
                const coords = typeof cachedData.area_coordinates === 'string'
                  ? JSON.parse(cachedData.area_coordinates)
                  : cachedData.area_coordinates
                setAreaLocation({
                  lat: coords.lat || -1.2921,
                  lng: coords.lng || 36.8219,
                  label: cachedData.area_of_residence || ''
                })
              } catch (e) {
                console.warn('Could not parse cached area_coordinates:', e)
              }
            }
          } catch (cacheErr) {
            console.warn('Could not parse cached profile:', cacheErr)
          }
        }

        // Now load from API to get fresh data
        let profileData: any = null
        console.log('[Profile Load] Fetching profile from API for userId:', userId, 'at', new Date().toISOString())
        const response = await apiService.getUserProfile(userId)
        console.log('[Profile Load] API response:', response, 'at', new Date().toISOString())

        // Handle both direct array response and wrapped response with .data property
        let profileList: any[] = []
        if (Array.isArray(response)) {
          profileList = response
        } else if (response?.data && Array.isArray(response.data)) {
          profileList = response.data
        }

        if (profileList.length > 0) {
          profileData = profileList[0]
          console.log('[Profile Load] Raw profile data from API:', profileData)
          console.log('[Profile Load] Extracted full_name:', profileData.full_name, 'name:', profileData.name)
          setProfile(profileData)
          const fullName = String(profileData.full_name || profileData.name || '')
          console.log('[Profile Load] Setting name state to:', fullName)
          setName(fullName)
          // Update localStorage cache
          localStorage.setItem(`trainer_profile_${userId}`, JSON.stringify(profileData))
          setRegistrationPath(profileData.registration_path || 'direct')
          setPathLocked(profileData.path_locked || false)

          // Load sponsor information if available
          if (profileData.sponsor_trainer_id) {
            setSponsorId(profileData.sponsor_trainer_id)
            // Load sponsor name from API
            try {
              const sponsorProfile = await apiService.getUserProfile(profileData.sponsor_trainer_id)
              const sponsorList = Array.isArray(sponsorProfile) ? sponsorProfile : (sponsorProfile?.data && Array.isArray(sponsorProfile.data) ? sponsorProfile.data : [])
              if (sponsorList.length > 0) {
                setSponsorName(sponsorList[0].full_name || sponsorList[0].name || profileData.sponsor_trainer_id)
              }
            } catch (e) {
              console.warn('Could not load sponsor information:', e)
            }
          }

          // Load area coordinates if available
          if (profileData.area_coordinates) {
            try {
              const coords = typeof profileData.area_coordinates === 'string'
                ? JSON.parse(profileData.area_coordinates)
                : profileData.area_coordinates
              setAreaLocation({
                lat: coords.lat || -1.2921,
                lng: coords.lng || 36.8219,
                label: profileData.area_of_residence || ''
              })
            } catch (e) {
              console.warn('Could not parse area_coordinates:', e)
            }
          }
        } else {
          // Fallback to localStorage
          const savedProfile = localStorage.getItem(`trainer_profile_${userId}`)
          if (savedProfile) {
            profileData = JSON.parse(savedProfile)
            setProfile(profileData)
            setName(String(profileData.name || ''))
            if (profileData.sponsor_trainer_id) {
              setSponsorId(profileData.sponsor_trainer_id)
              setSponsorName(profileData.sponsor_name || profileData.sponsor_trainer_id)
            }
          }
        }

        // Load trainer categories
        const categoriesData = await apiService.getTrainerCategories(userId)
        console.log('Raw trainer categories response:', categoriesData)

        // Handle different API response formats
        let categoriesList: any[] = []
        if (categoriesData?.data && Array.isArray(categoriesData.data)) {
          categoriesList = categoriesData.data
        } else if (Array.isArray(categoriesData)) {
          categoriesList = categoriesData
        }

        console.log('Parsed categories list:', categoriesList)

        if (categoriesList.length > 0) {
          const ids = categoriesList.map((cat: any) => {
            const catId = cat.category_id || cat.cat_id || cat.id
            console.log('Processing category:', cat, 'Extracted ID:', catId)
            return catId
          }).filter((id): id is number => typeof id === 'number' && id > 0)

          console.log('Final selected category IDs:', ids)
          setSelectedCategoryIds(ids)

          // Load category pricing
          const pricing: Record<number, number> = {}
          const baseRate = profileData?.hourly_rate || 1000
          for (const cat of categoriesList) {
            const catId = cat.category_id || cat.cat_id || cat.id
            if (typeof catId === 'number' && catId > 0) {
              pricing[catId] = cat.hourly_rate || baseRate
            }
          }
          console.log('Category pricing:', pricing)
          setCategoryPricing(pricing)
        } else {
          console.log('No trainer categories found, response was:', categoriesData)
          setSelectedCategoryIds([])
          setCategoryPricing({})
        }

        // Load verification documents with improved error handling
        try {
          console.log('[Profile Load] Fetching verification documents for userId:', userId)
          const docsResponse = await apiService.getVerificationDocuments(userId)
          console.log('[Profile Load] Verification documents response:', docsResponse)

          // Handle both direct array response and wrapped response with .data property
          let docsList: any[] = []
          if (Array.isArray(docsResponse)) {
            docsList = docsResponse
          } else if (docsResponse?.data && Array.isArray(docsResponse.data)) {
            docsList = docsResponse.data
          }

          console.log('[Profile Load] Loaded documents:', docsList)
          setVerificationDocuments(docsList)
        } catch (docsError) {
          console.warn('Failed to fetch verification documents:', docsError)
          // Don't show error toast - documents will load in the VerificationDocumentsForm component
          setVerificationDocuments([])
        } finally {
          setDocumentsLoading(false)
        }
      } catch (error) {
        console.error('[Profile Load] Failed to fetch profile:', error)
        // Fallback to localStorage on error - don't show error toast if we have cached data
        try {
          const savedProfile = localStorage.getItem(`trainer_profile_${userId}`)
          if (savedProfile) {
            const data = JSON.parse(savedProfile)
            console.log('[Profile Load] Using cached profile from localStorage')
            setProfile(data)
            setName(String(data.full_name || data.name || ''))
            if (data.sponsor_trainer_id) {
              setSponsorId(data.sponsor_trainer_id)
              setSponsorName(data.sponsor_name || data.sponsor_trainer_id)
            }
            console.log('[Profile Load] Loaded profile from localStorage as fallback')
          } else {
            // Only show error toast if we have no cached data
            console.error('[Profile Load] No cached profile and API failed')
            toast({
              title: 'Failed to load profile',
              description: `${error instanceof Error ? error.message : 'Unknown error'}`,
              variant: 'destructive'
            })
          }
        } catch (cacheErr) {
          console.error('[Profile Load] Error loading from cache:', cacheErr)
          toast({
            title: 'Failed to load profile',
            description: `${error instanceof Error ? error.message : 'Unknown error'}`,
            variant: 'destructive'
          })
        }
      } finally {
        setLoading(false)
        setDocumentsLoading(false)
        console.log('[Profile Load] Profile loading complete for userId:', userId)
      }
    }
    loadProfile()
  }, [userId])

  const handleChange = (field: string, value: any) => {
    console.log(`[Profile Change] Field "${field}" changing:`, { from: profile[field], to: value })
    setProfile(prev => {
      const updated = { ...prev, [field]: value }
      console.log(`[Profile Change] New state for "${field}":`, updated[field])
      return updated
    })
  }

  // Log profile state changes (runs AFTER state update completes)
  useEffect(() => {
    console.log('[Profile State Updated] profile_image is now:', profile.profile_image)
  }, [profile.profile_image])

  // Track when profile data is loaded from API
  useEffect(() => {
    if (profile.profile_image) {
      console.log('[Profile Loaded] Profile image from API:', profile.profile_image)
    }
  }, [profile])

  const handleCategoryChange = (categoryId: number, checked: boolean) => {
    if (checked) {
      setSelectedCategoryIds(prev => [...new Set([...prev, categoryId])])
    } else {
      setSelectedCategoryIds(prev => prev.filter(id => id !== categoryId))
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      setUploadingImage(true)
      const fileArray = Array.from(files)
      await upload(fileArray)
    }
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const clearProfileImage = () => {
    handleChange('profile_image', '')
  }

  const save = async () => {
    if (!userId) {
      toast({ title: 'Not signed in', description: 'Please sign in to edit your profile', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      // Validate categories
      if (selectedCategoryIds.length === 0) {
        toast({ title: 'Category required', description: 'Please select at least one service category.', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Validate sponsor for sponsored trainers
      if (registrationPath === 'sponsored' && !sponsorId) {
        toast({ title: 'Sponsor required', description: 'Please select a sponsor trainer for your sponsored registration.', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Hourly rate validation
      const hourlyRateRaw = profile.hourly_rate == null ? '' : profile.hourly_rate
      const hourlyRateNum = hourlyRateRaw === '' ? 0 : Number(hourlyRateRaw)
      if (!Number.isFinite(hourlyRateNum) || hourlyRateNum < 0) {
        toast({ title: 'Invalid hourly rate', description: 'Enter a non-negative number for hourly rate.', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Service radius validation and auto-calculation
      const serviceRadiusRaw = profile.service_radius == null ? '' : profile.service_radius
      let serviceRadiusNum = serviceRadiusRaw === '' ? null : Number(serviceRadiusRaw)
      if (serviceRadiusNum !== null && (!Number.isFinite(serviceRadiusNum) || serviceRadiusNum < 0)) {
        toast({ title: 'Invalid service radius', description: 'Enter a non-negative number for service radius.', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Auto-calculate service radius if not manually set
      if (serviceRadiusNum === null) {
        serviceRadiusNum = getDefaultServiceRadius()
      }


      // Payout is M-Pesa only - default to null
      const payoutDetails = null

      // Availability - if string, attempt parse
      let availabilityVal: any = profile.availability ?? null
      if (typeof availabilityVal === 'string' && availabilityVal.trim() !== '') {
        try {
          availabilityVal = JSON.parse(availabilityVal)
        } catch (e) {
          toast({ title: 'Invalid availability JSON', description: 'Availability must be valid JSON.', variant: 'destructive' })
          setLoading(false)
          return
        }
      }

      const profileData: TrainerProfile = {
        user_id: userId,
        user_type: 'trainer',
        name: name || null,
        hourly_rate: hourlyRateNum,
        service_radius: calculatedServiceRadius,
        availability: availabilityVal ?? null,
        payout_details: payoutDetails ?? null,
        profile_image: profile.profile_image || null,
        bio: profile.bio || null,
      }

      // Save to API
          try {
        const detectedTimezone = detectDeviceTimezone()
        const updatePayload = {
          full_name: name,
          hourly_rate: hourlyRateNum,
          // Always include service_radius (auto-calculated or manually set)
          service_radius: serviceRadiusNum,
          availability: JSON.stringify(availabilityVal),
          timezone: detectedTimezone,
          profile_image: profile.profile_image || null,
          bio: profile.bio || null,
          payout_details: payoutDetails ? JSON.stringify(payoutDetails) : null,
          area_of_residence: areaLocation.label || null,
          area_coordinates: JSON.stringify({ lat: areaLocation.lat, lng: areaLocation.lng }),
          // Send location_lat and location_lng for auto service radius calculation
          location_lat: areaLocation.lat,
          location_lng: areaLocation.lng,
          location_label: areaLocation.label || null,
          location_updated_at: new Date().toISOString(),
          mpesa_number: profile.mpesa_number || null,
          registration_path: !pathLocked ? registrationPath : undefined,
        }
        console.log('[Profile Save] ========== SAVING PROFILE ==========')
        console.log('[Profile Save] User ID:', userId)
        console.log('[Profile Save] Profile image being saved:', profile.profile_image)
        console.log('[Profile Save] Full payload:', updatePayload)
        const response = await apiService.updateUserProfile(userId, updatePayload)
        console.log('[Profile Save] API response:', response)
        console.log('[Profile Save] ========== SAVE COMPLETE ==========')
      } catch (apiErr) {
        console.error('API save failed:', apiErr)
        toast({
          title: 'Database update failed',
          description: apiErr instanceof Error ? apiErr.message : 'Could not save to database',
          variant: 'destructive'
        })
        setLoading(false)
        return
      }

      // Save to localStorage as fallback
      localStorage.setItem(`trainer_profile_${userId}`, JSON.stringify(profileData))

      // Get previous categories to determine what changed
      const previousCategoriesData = await apiService.getTrainerCategories(userId)
      // Handle both direct array response and wrapped response with .data property
      const previousCategoryList = Array.isArray(previousCategoriesData) ? previousCategoriesData : (previousCategoriesData?.data && Array.isArray(previousCategoriesData.data) ? previousCategoriesData.data : [])
      const previousCategoryIds = previousCategoryList.map((cat: any) => cat.category_id || cat.cat_id) || []

      // Determine which categories to add and remove
      const categoriesToAdd = selectedCategoryIds.filter(id => !previousCategoryIds.includes(id))
      const categoriesToRemove = previousCategoryIds.filter(id => !selectedCategoryIds.includes(id))

      // Save category changes
      for (const categoryId of categoriesToAdd) {
        try {
          await apiService.addTrainerCategory(userId, categoryId)
        } catch (catErr) {
          console.warn(`Failed to add category ${categoryId}:`, catErr)
        }
      }

      for (const categoryId of categoriesToRemove) {
        try {
          await apiService.removeTrainerCategory(userId, categoryId)
        } catch (catErr) {
          console.warn(`Failed to remove category ${categoryId}:`, catErr)
        }
      }

      // Save category pricing for all selected categories
      for (const categoryId of selectedCategoryIds) {
        const price = categoryPricing[categoryId]
        if (price && price > 0) {
          try {
            await apiRequest('trainer_category_pricing_set', {
              trainer_id: userId,
              category_id: categoryId,
              hourly_rate: price
            }, { headers: withAuth() })
          } catch (pricingErr) {
            console.warn(`Failed to save pricing for category ${categoryId}:`, pricingErr)
          }
        }
      }

      toast({ title: 'Saved', description: 'Profile updated successfully.' })
      onClose?.()
    } catch (err) {
      console.error('Save profile error', err)
      toast({ title: 'Error', description: (err as any)?.message || 'Failed to save profile', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Trainer Profile</CardTitle>
      </CardHeader>
      <CardContent className="pb-24">
        {(loading || documentsLoading) && !categoriesLoading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-blue-700 animate-spin"></div>
              <span className="text-sm font-medium">
                Loading your profile information{documentsLoading ? ' and verification documents' : ''}...
              </span>
            </div>
          </div>
        )}

        {!loading && !documentsLoading && (name || selectedCategoryIds.length > 0 || profile.profile_image || verificationDocuments.length > 0) && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-2">Profile Data Loaded</p>
            <div className="text-xs text-green-700 space-y-1">
              {name && <p>✓ Name: {name}</p>}
              {profile.profile_image && <p>✓ Profile image loaded</p>}
              {selectedCategoryIds.length > 0 && <p>✓ {selectedCategoryIds.length} service category/ies selected</p>}
              {profile.hourly_rate && <p>✓ Hourly rate: Ksh {profile.hourly_rate}</p>}
              {areaLocation.label && <p>✓ Service area: {areaLocation.label}</p>}
              {sponsorName && registrationPath === 'sponsored' && <p>✓ Sponsor: {sponsorName}</p>}
              {verificationDocuments.length > 0 && <p>✓ {verificationDocuments.length} verification document(s) preloaded</p>}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Profile Image</Label>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                💡 A high quality photo creates client trust.
              </p>
            </div>
            <div className="space-y-3">
              {/* Image Preview */}
              {profile.profile_image && (
                <div className="relative w-32 h-32 mx-auto rounded-lg overflow-hidden border-2 border-border bg-muted">
                  <img
                    src={profile.profile_image}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearProfileImage}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Upload Area */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage || loading}
                  className="flex-1 p-3 border-2 border-dashed border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">{uploadingImage ? 'Uploading...' : 'Upload Photo'}</span>
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleImageUpload}
                  disabled={uploadingImage || loading}
                  className="hidden"
                />
              </div>

              {/* Upload Progress Bar */}
              {uploadingImage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Uploading...</span>
                    <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Manual URL Input */}
              <div>
                <Label htmlFor="profile-image-url" className="text-xs text-muted-foreground">Or paste image URL</Label>
                <Input
                  id="profile-image-url"
                  value={profile.profile_image || ''}
                  onChange={(e) => handleChange('profile_image', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <p className="text-sm text-gray-600 mb-2">Describe your expertise, experience, and what clients should expect during training sessions</p>
            <textarea
              id="bio"
              value={profile.bio || ''}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="Share your expertise and training philosophy..."
              className="w-full p-2 border border-border rounded-md bg-input"
              rows={4}
            />
          </div>

          {/* Area of Residence Selector */}
          <MapLocationSelector
            initialLocation={areaLocation}
            onChange={(location) => setAreaLocation(location)}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hourly_rate">Default Hourly Rate (Ksh)</Label>
              <Input
                id="hourly_rate"
                type="number"
                value={profile.hourly_rate ?? ''}
                onChange={(e) => handleChange('hourly_rate', Number(e.target.value))}
                placeholder="e.g., 300 or 500"
              />
            </div>
            <div>
              <Label htmlFor="service_radius">Service Radius (km)</Label>
              <div className="space-y-2">
                <Input
                  id="service_radius"
                  type="number"
                  value={calculatedServiceRadius}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <div className="text-xs text-muted-foreground">
                  <p>💡 Auto-calculated: {calculatedServiceRadius} km (based on your location)</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="mpesa_number">M-Pesa Payout Number (required)</Label>
            <Input
              id="mpesa_number"
              value={profile.mpesa_number || ''}
              onChange={(e) => handleChange('mpesa_number', e.target.value)}
              placeholder="e.g., 254712345678 or 0712345678"
            />
            <p className="text-xs text-muted-foreground mt-1">Payments will be sent directly to this number after each completed session.</p>
          </div>

          <div className="space-y-3">
            <Label>Service Categories (required)</Label>
            <p className="text-sm text-muted-foreground">Select the categories of services you offer. These are defined by the platform administrator.</p>
            {categoriesLoading ? (
              <div className="text-sm text-muted-foreground">Loading categories...</div>
            ) : categories.length === 0 ? (
              <div className="text-sm text-muted-foreground">No categories available. Please ask the administrator to create some.</div>
            ) : (
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="Search categories..."
                  value={categorySearchTerm}
                  onChange={(e) => setCategorySearchTerm(e.target.value)}
                  className="bg-input border-border"
                />
                <p className="text-xs text-muted-foreground">
                  {categories.filter(cat =>
                    cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
                    (cat.description && cat.description.toLowerCase().includes(categorySearchTerm.toLowerCase()))
                  ).length} of {categories.length} categories
                </p>
                <div className="space-y-3 border border-border rounded-md p-4">
                  {categories
                    .filter(cat =>
                      cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
                      (cat.description && cat.description.toLowerCase().includes(categorySearchTerm.toLowerCase()))
                    )
                    .map((category) => (
                    <div key={category.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-b-0">
                      <input
                        type="checkbox"
                        id={`category_${category.id}`}
                        checked={selectedCategoryIds.includes(category.id)}
                        onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
                        disabled={loading}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor={`category_${category.id}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            {category.icon && <span className="text-xl">{category.icon}</span>}
                            <span className="font-medium text-foreground">{category.name}</span>
                          </div>
                          {category.description && (
                            <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                          )}
                        </label>
                        {selectedCategoryIds.includes(category.id) && (
                          <div className="mt-2 ml-6">
                            <label htmlFor={`price_${category.id}`} className="text-xs font-medium text-foreground">
                              Hourly Rate (Ksh)
                            </label>
                            <input
                              id={`price_${category.id}`}
                              type="number"
                              min="0"
                              step="100"
                              value={categoryPricing[category.id] || ''}
                              onChange={(e) => setCategoryPricing(prev => ({
                                ...prev,
                                [category.id]: Number(e.target.value)
                              }))}
                              disabled={loading}
                              placeholder="e.g., 1500"
                              className="w-full mt-1 px-2 py-1 border border-border rounded text-sm bg-input"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedCategoryIds.length === 0 && (
              <p className="text-xs text-destructive">Please select at least one category</p>
            )}
          </div>

          {/* Registration Path Section */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
            <Label className="font-semibold">Registration Path</Label>
            <div className="space-y-2">
              {!pathLocked ? (
                <>
                  <p className="text-sm text-muted-foreground">How are you registered with the platform?</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all" style={{borderColor: registrationPath === 'direct' ? 'var(--trainer-primary)' : 'var(--border)'}} onClick={() => setRegistrationPath('direct')}>
                      <input type="radio" name="registration-path" value="direct" checked={registrationPath === 'direct'} onChange={() => setRegistrationPath('direct')} />
                      <div>
                        <p className="font-medium text-sm">Direct Registration</p>
                        <p className="text-xs text-muted-foreground">Registered independently with full documentation</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all" style={{borderColor: registrationPath === 'sponsored' ? 'var(--trainer-primary)' : 'var(--border)'}} onClick={() => setRegistrationPath('sponsored')}>
                      <input type="radio" name="registration-path" value="sponsored" checked={registrationPath === 'sponsored'} onChange={() => setRegistrationPath('sponsored')} />
                      <div>
                        <p className="font-medium text-sm">Sponsored Registration</p>
                        <p className="text-xs text-muted-foreground">Registered under an approved sponsor (10% commission)</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-3 bg-background rounded border border-border">
                  <p className="text-sm font-medium text-foreground">
                    Registration Path: <span className="capitalize text-trainer-primary">{registrationPath}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">🔒 Your registration path is locked after document submission.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sponsorship Section - Show for all trainers, but required for sponsored path */}
          <SponsorSelector
            currentSponsorId={sponsorId}
            currentSponsorName={sponsorName}
            onSponsorSelected={(id, name) => {
              setSponsorId(id)
              setSponsorName(name)
              handleChange('sponsor_trainer_id', id)
            }}
            onSponsorRemoved={() => {
              setSponsorId(null)
              setSponsorName(null)
              handleChange('sponsor_trainer_id', null)
            }}
            required={registrationPath === 'sponsored'}
            registrationPath={registrationPath}
          />

          {/* Verification Documents Section */}
          <VerificationDocumentsForm
            onComplete={() => {
              toast({
                title: 'Success',
                description: 'Your verification documents have been submitted for review.',
              })
            }}
          />


          <div>
            <Label>Availability</Label>
            <AvailabilitySelector
              value={profile.availability}
              onChange={(availability) => handleChange('availability', availability)}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onClose?.()} disabled={loading}>Cancel</Button>
            <Button onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save Profile'}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const TrainerProfileWithMedia: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-4">
      <TrainerProfileEditor onClose={onClose} />
      <MediaUploadSection
        title="Upload Your Media"
        description="Add photos, videos, and certifications to showcase your expertise"
        uploadType="all"
        onFilesUploaded={(files) => {
          toast({
            title: 'Success',
            description: `${files.length} file(s) uploaded successfully`
          })
        }}
      />
    </div>
  )
}
