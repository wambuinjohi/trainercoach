import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { MediaUploadSection } from './MediaUploadSection'
import { MapLocationSelector } from './MapLocationSelector'
import { AvailabilitySelector } from './AvailabilitySelector'
import { DisciplineAndSponsorSection } from './DisciplineAndSponsorSection'
import { detectDeviceTimezone } from '@/lib/timezone'
import * as apiService from '@/lib/api-service'
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

interface TrainerProfileEditorProps {
  onClose?: () => void
  onSaveSuccess?: () => void
  isNewSignup?: boolean
}

export const TrainerProfileEditor: React.FC<TrainerProfileEditorProps> = ({ onClose, onSaveSuccess, isNewSignup = false }) => {
  const { user, signupData } = useAuth()
  const userId = user?.id
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Partial<TrainerProfile>>({})
  const [name, setName] = useState(signupData?.full_name || '')
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [categoryPricing, setCategoryPricing] = useState<Record<number, number>>({})
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const [sponsorId, setSponsorId] = useState<string | null>(signupData?.sponsor_trainer_id || null)
  const [sponsorName, setSponsorName] = useState<string | null>(null)
  const [registrationPath, setRegistrationPath] = useState<'direct' | 'sponsored'>(signupData?.registration_path || 'direct')
  const [pathLocked, setPathLocked] = useState(false)
  const [areaLocation, setAreaLocation] = useState<{ lat: number; lng: number; label: string }>({
    lat: signupData?.location_lat || -1.2921,
    lng: signupData?.location_lng || 36.8219, // Default to Nairobi, Kenya
    label: signupData?.location_label || ''
  })
  const [hadExistingCoordinates, setHadExistingCoordinates] = useState(false)
  const [calculatedServiceRadius] = useState(() => getDefaultServiceRadius())
  const [verificationDocuments, setVerificationDocuments] = useState<any[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [hasDisciplineCertificate, setHasDisciplineCertificate] = useState(false)
  const [showSuggestDiscipline, setShowSuggestDiscipline] = useState(false)
  const [suggestDisciplineForm, setSuggestDisciplineForm] = useState({ name: '', description: '' })
  const [suggestingDiscipline, setSuggestingDiscipline] = useState(false)

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
                // Mark that existing coordinates were found in cache
                if (coords.lat && coords.lng && cachedData.area_of_residence) {
                  setHadExistingCoordinates(true)
                }
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
              // Mark that existing coordinates were found
              if (coords.lat && coords.lng && profileData.area_of_residence) {
                setHadExistingCoordinates(true)
              }
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
  }, [userId, isNewSignup])

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

  const handleSuggestDiscipline = async () => {
    if (!suggestDisciplineForm.name.trim()) {
      toast({ title: 'Required', description: 'Please enter a discipline name', variant: 'destructive' })
      return
    }

    setSuggestingDiscipline(true)
    try {
      const response = await apiService.suggestDiscipline(
        suggestDisciplineForm.name.trim(),
        suggestDisciplineForm.description.trim() || undefined,
        userId
      )

      if (response?.status === 'success' || response?.data) {
        toast({
          title: 'Discipline suggestion submitted',
          description: 'Your suggestion has been sent to admin for review. You can save your profile and wait for approval.',
        })
        setSuggestDisciplineForm({ name: '', description: '' })
        setShowSuggestDiscipline(false)
      } else {
        throw new Error(response?.message || 'Failed to submit suggestion')
      }
    } catch (error) {
      console.error('Suggest discipline error:', error)
      toast({
        title: 'Failed to submit',
        description: error instanceof Error ? error.message : 'Could not submit discipline suggestion',
        variant: 'destructive'
      })
    } finally {
      setSuggestingDiscipline(false)
    }
  }

  const save = async () => {
    if (!userId) {
      toast({ title: 'Not signed in', description: 'Please sign in to edit your profile', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      // Validate name - required
      if (!name || name.trim() === '') {
        toast({ title: 'Name required', description: 'Please enter your full name.', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Validate categories
      if (selectedCategoryIds.length === 0) {
        toast({ title: 'Category required', description: 'Please select at least one service category.', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Hourly rate will be derived from category pricing
      const hourlyRateNum = 0 // Base rate is no longer used; pricing is set per-discipline

      // Validate M-Pesa number - required
      if (!profile.mpesa_number || profile.mpesa_number.trim() === '') {
        toast({ title: 'M-Pesa number required', description: 'Please enter your M-Pesa number.', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Validate residence location (GPS) - Optional
      // Trainers can proceed without setting location
      const isDefaultLocation = areaLocation.lat === -1.2921 && areaLocation.lng === 36.8219
      const hasValidCoordinates = areaLocation.lat && areaLocation.lng && !isDefaultLocation

      if (hasValidCoordinates) {
        console.log('[Profile Save] Valid coordinates set:', areaLocation)
      } else if (hadExistingCoordinates) {
        console.log('[Profile Save] Preserving existing coordinates:', areaLocation)
      } else {
        console.log('[Profile Save] No location set - proceeding without GPS coordinates (optional)')
      }

      // Validate registration path is selected
      if (!registrationPath || registrationPath === '') {
        toast({
          title: 'Registration path required',
          description: 'Please select either "Direct" or "Sponsored" registration path.',
          variant: 'destructive'
        })
        setLoading(false)
        return
      }

      // Validate path-specific requirements
      if (registrationPath === 'direct' && !hasDisciplineCertificate) {
        toast({
          title: 'Discipline certificate required',
          description: 'Please upload your discipline certificate for direct registration.',
          variant: 'destructive'
        })
        setLoading(false)
        return
      }

      if (registrationPath === 'sponsored' && !sponsorId) {
        toast({
          title: 'Sponsor required',
          description: 'Please select a sponsor trainer for sponsored registration.',
          variant: 'destructive'
        })
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

      // Upload profile image if a new one was selected
      let profileImageUrl = profile.profile_image || null
      if ((profile as any)._profile_image_file) {
        try {
          console.log('[Profile Save] Uploading profile image...')
          const imageResponse = await apiService.uploadProfileImage(userId, (profile as any)._profile_image_file)
          if (imageResponse?.file_url) {
            profileImageUrl = imageResponse.file_url
            console.log('[Profile Save] Profile image uploaded:', profileImageUrl)
            toast({
              title: 'Image uploaded',
              description: 'Profile photo uploaded successfully.',
            })
          } else {
            throw new Error('No image URL returned from upload')
          }
        } catch (imageErr) {
          console.error('Profile image upload failed:', imageErr)
          toast({
            title: 'Image upload failed',
            description: imageErr instanceof Error ? imageErr.message : 'Could not upload profile photo',
            variant: 'destructive'
          })
          setLoading(false)
          return
        }
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
          profile_image: profileImageUrl,
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
        console.log('[Profile Save] Profile image being saved:', profileImageUrl)
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

      const updatedProfileCache = {
        ...profileData,
        full_name: name,
        hourly_rate: hourlyRateNum,
        service_radius: serviceRadiusNum,
        availability: availabilityVal ?? null,
        payout_details: payoutDetails ?? null,
        profile_image: profileImageUrl,
        bio: profile.bio || null,
        area_of_residence: areaLocation.label || null,
        area_coordinates: { lat: areaLocation.lat, lng: areaLocation.lng },
        location_lat: areaLocation.lat,
        location_lng: areaLocation.lng,
        location_label: areaLocation.label || null,
        mpesa_number: profile.mpesa_number || null,
        registration_path: registrationPath,
        sponsor_trainer_id: sponsorId,
      }

      setProfile(prev => ({
        ...prev,
        ...updatedProfileCache,
        _profile_image_file: undefined,
        _profile_image_preview: undefined,
      }))
      localStorage.setItem(`trainer_profile_${userId}`, JSON.stringify(updatedProfileCache))

      const previousCategoriesData = await apiService.getTrainerCategories(userId)
      const previousCategoryList = Array.isArray(previousCategoriesData)
        ? previousCategoriesData
        : (previousCategoriesData?.data && Array.isArray(previousCategoriesData.data) ? previousCategoriesData.data : [])
      const previousCategoryIds = previousCategoryList
        .map((cat: any) => cat.category_id || cat.cat_id || cat.id)
        .filter((id: unknown): id is number => typeof id === 'number' && id > 0)

      const categoriesToAdd = selectedCategoryIds.filter(id => !previousCategoryIds.includes(id))
      const categoriesToRemove = previousCategoryIds.filter(id => !selectedCategoryIds.includes(id))
      const categorySaveErrors: string[] = []

      for (const categoryId of categoriesToAdd) {
        try {
          await apiService.addTrainerCategory(userId, categoryId)
        } catch (catErr) {
          console.warn(`Failed to add category ${categoryId}:`, catErr)
          categorySaveErrors.push(`Could not add category ${categoryId}`)
        }
      }

      for (const categoryId of categoriesToRemove) {
        try {
          await apiService.removeTrainerCategory(userId, categoryId)
        } catch (catErr) {
          console.warn(`Failed to remove category ${categoryId}:`, catErr)
          categorySaveErrors.push(`Could not remove category ${categoryId}`)
        }
      }

      for (const categoryId of selectedCategoryIds) {
        const price = categoryPricing[categoryId] || hourlyRateNum
        if (price > 0) {
          try {
            await apiService.setTrainerCategoryPricing(userId, categoryId, Number(price))
          } catch (pricingErr) {
            console.warn(`Failed to save pricing for category ${categoryId}:`, pricingErr)
            categorySaveErrors.push(`Could not save pricing for category ${categoryId}`)
          }
        }
      }

      if (categorySaveErrors.length > 0) {
        throw new Error(categorySaveErrors[0])
      }

      const refreshedCategoriesData = await apiService.getTrainerCategories(userId)
      const refreshedCategoryList = Array.isArray(refreshedCategoriesData)
        ? refreshedCategoriesData
        : (refreshedCategoriesData?.data && Array.isArray(refreshedCategoriesData.data) ? refreshedCategoriesData.data : [])
      const refreshedCategoryIds = refreshedCategoryList
        .map((cat: any) => cat.category_id || cat.cat_id || cat.id)
        .filter((id: unknown): id is number => typeof id === 'number' && id > 0)
      const refreshedPricing: Record<number, number> = {}

      for (const cat of refreshedCategoryList) {
        const catId = cat.category_id || cat.cat_id || cat.id
        if (typeof catId === 'number' && catId > 0) {
          refreshedPricing[catId] = Number(cat.hourly_rate || hourlyRateNum)
        }
      }

      setSelectedCategoryIds(refreshedCategoryIds)
      setCategoryPricing(refreshedPricing)

      toast({ title: 'Saved', description: 'Profile updated successfully.' })
      onSaveSuccess?.()
      onClose?.()
    } catch (err) {
      console.error('Save profile error', err)
      toast({ title: 'Error', description: (err as any)?.message || 'Failed to save profile', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const displayedProfileImage = (profile as any)._profile_image_preview || profile.profile_image

  return (
    <div className="space-y-5">
      {/* Loading State */}
      {(loading || documentsLoading) && !categoriesLoading && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-blue-700 animate-spin flex-shrink-0"></div>
          <span className="text-xs font-medium text-blue-700">
            Loading profile{documentsLoading ? ' and documents' : ''}...
          </span>
        </div>
      )}

      {/* Profile Data Loaded State */}
      {!loading && !documentsLoading && (name || selectedCategoryIds.length > 0 || profile.profile_image || verificationDocuments.length > 0) && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs font-medium text-green-800 mb-1">✓ Profile Data Loaded</p>
          <div className="text-xs text-green-700 space-y-0.5">
            {name && <p>Name: {name}</p>}
            {selectedCategoryIds.length > 0 && <p>{selectedCategoryIds.length} categories selected</p>}
            {areaLocation.label && <p>Area: {areaLocation.label}</p>}
          </div>
        </div>
      )}

      {/* BASIC INFORMATION SECTION */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Basic Information</CardTitle>
          <CardDescription className="text-xs">Your name, profile photo, and bio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Profile Image */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Profile Photo</Label>
              <div className="flex gap-4 items-start">
                {/* Image Preview */}
                <div className="flex-shrink-0">
                  {displayedProfileImage ? (
                    <div className="relative">
                      <img
                        src={displayedProfileImage}
                        alt="Profile"
                        className="w-24 h-24 rounded-lg object-cover border-2 border-border"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-muted border-2 border-border flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">No photo</span>
                    </div>
                  )}
                </div>
                {/* Upload Input */}
                <div className="flex-1">
                  <input
                    type="file"
                    id="profile-image"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        // Validate file size (max 5MB)
                        if (file.size > 5 * 1024 * 1024) {
                          toast({
                            title: 'File too large',
                            description: 'Profile photo must be smaller than 5MB.',
                            variant: 'destructive'
                          })
                          return
                        }

                        // Store file for uploading during save
                        handleChange('_profile_image_file', file)

                        // Show preview
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const preview = event.target?.result as string
                          // Store preview temporarily for display
                          handleChange('_profile_image_preview', preview)
                          toast({
                            title: 'Image selected',
                            description: 'Your profile photo will be uploaded when you save.',
                          })
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    disabled={loading}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">JPG, PNG, GIF or WebP (max 5MB)</p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Full name <span className="text-red-600">*</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="bg-input border-border"
              />
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Describe your expertise, experience, and what clients should expect during training sessions</p>
              <textarea
                id="bio"
                value={profile.bio || ''}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="Share your expertise and training philosophy..."
                className="w-full p-3 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-trainer-primary text-sm"
                rows={5}
              />
            </div>
          </div>
        </CardContent>
      </Card>



      {/* RATES & PAYOUT SECTION */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Rates & Payout</CardTitle>
          <CardDescription className="text-xs">Your hourly rates and payment information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="service_radius">Service Radius</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="service_radius"
                  type="number"
                  value={calculatedServiceRadius}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed flex-1"
                />
                <span className="text-sm font-medium text-muted-foreground">km</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Auto-calculated from location</p>
            </div>
            <div>
              <Label htmlFor="mpesa_number">M-Pesa Number <span className="text-red-600">*</span></Label>
              <Input
                id="mpesa_number"
                value={profile.mpesa_number || ''}
                onChange={(e) => handleChange('mpesa_number', e.target.value)}
                placeholder="0712345678"
                className="bg-input border-border"
              />
              <p className="text-xs text-muted-foreground mt-2">For payouts (required)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SERVICE CATEGORIES SECTION */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Service Categories <span className="text-red-600">*</span></CardTitle>
          <CardDescription className="text-xs">What you're certified and trained to teach (required)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {categoriesLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No categories available. Please ask the administrator to create some.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Search categories..."
                  value={categorySearchTerm}
                  onChange={(e) => setCategorySearchTerm(e.target.value)}
                  className="bg-input border-border flex-1"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap py-2">
                  {categories.filter(cat =>
                    cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
                    (cat.description && cat.description.toLowerCase().includes(categorySearchTerm.toLowerCase()))
                  ).length} of {categories.length}
                </span>
              </div>
              <div className="space-y-2 border border-border rounded-lg p-4 max-h-96 overflow-y-auto">
                {categories
                  .filter(cat =>
                    cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
                    (cat.description && cat.description.toLowerCase().includes(categorySearchTerm.toLowerCase()))
                  )
                  .map((category) => (
                    <div key={category.id} className="space-y-2 pb-2 border-b border-border last:border-b-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id={`category_${category.id}`}
                          checked={selectedCategoryIds.includes(category.id)}
                          onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
                          disabled={loading}
                          className="mt-1 cursor-pointer flex-shrink-0"
                        />
                        <label htmlFor={`category_${category.id}`} className="cursor-pointer flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {category.icon && <span className="text-xl flex-shrink-0">{category.icon}</span>}
                            <span className="font-medium text-sm text-foreground break-words">{category.name}</span>
                          </div>
                          {category.description && (
                            <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                          )}
                        </label>
                      </div>
                      {selectedCategoryIds.includes(category.id) && (
                        <div className="ml-6 pt-1">
                          <label htmlFor={`price_${category.id}`} className="text-xs font-medium text-foreground block mb-1">
                            Rate (Ksh) <span className="text-muted-foreground">e.g. 300, 500, 1000</span>
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
                            placeholder="e.g. 1500"
                            className="w-32 px-2 py-1 border border-border rounded text-sm bg-input focus:outline-none focus:ring-2 focus:ring-trainer-primary"
                          />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              {selectedCategoryIds.length === 0 && (
                <p className="text-xs text-destructive font-medium">Please select at least one category</p>
              )}

              {/* Suggest New Discipline Section */}
              <div className="mt-4 pt-4 border-t border-border">
                {!showSuggestDiscipline ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSuggestDiscipline(true)}
                    className="text-xs"
                  >
                    + Suggest a new discipline
                  </Button>
                ) : (
                  <div className="space-y-3 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Suggest a New Discipline</p>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Discipline Name <span className="text-red-600">*</span></label>
                      <Input
                        placeholder="e.g. Pilates, CrossFit, Boxing"
                        value={suggestDisciplineForm.name}
                        onChange={(e) => setSuggestDisciplineForm(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-input border-border"
                        disabled={suggestingDiscipline}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Description (Optional)</label>
                      <textarea
                        placeholder="Brief description of this discipline..."
                        value={suggestDisciplineForm.description}
                        onChange={(e) => setSuggestDisciplineForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-2 py-1 border border-border rounded text-sm bg-input focus:outline-none focus:ring-2 focus:ring-trainer-primary resize-none"
                        rows={2}
                        disabled={suggestingDiscipline}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSuggestDiscipline}
                        disabled={suggestingDiscipline}
                        className="text-xs"
                      >
                        {suggestingDiscipline ? 'Submitting...' : 'Submit Suggestion'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowSuggestDiscipline(false)
                          setSuggestDisciplineForm({ name: '', description: '' })
                        }}
                        disabled={suggestingDiscipline}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* REGISTRATION PATH & LOCATION SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* REGISTRATION PATH SECTION */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Registration Path</CardTitle>
            <CardDescription className="text-xs">How you're registered</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!pathLocked ? (
              <div className="space-y-2">
                <div
                  className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-muted/50"
                  style={{borderColor: registrationPath === 'direct' ? 'var(--trainer-primary)' : 'var(--border)'}}
                  onClick={() => setRegistrationPath('direct')}
                >
                  <input
                    type="radio"
                    name="registration-path"
                    value="direct"
                    checked={registrationPath === 'direct'}
                    onChange={() => setRegistrationPath('direct')}
                    className="cursor-pointer flex-shrink-0"
                  />
                  <div>
                    <p className="font-medium text-xs">Direct</p>
                    <p className="text-xs text-muted-foreground">Independent registration</p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-muted/50"
                  style={{borderColor: registrationPath === 'sponsored' ? 'var(--trainer-primary)' : 'var(--border)'}}
                  onClick={() => setRegistrationPath('sponsored')}
                >
                  <input
                    type="radio"
                    name="registration-path"
                    value="sponsored"
                    checked={registrationPath === 'sponsored'}
                    onChange={() => setRegistrationPath('sponsored')}
                    className="cursor-pointer flex-shrink-0"
                  />
                  <div>
                    <p className="font-medium text-xs">Sponsored</p>
                    <p className="text-xs text-muted-foreground">Under sponsor (10%)</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted rounded border border-border">
                <p className="text-xs font-medium text-foreground">
                  Path: <span className="capitalize text-trainer-primary">{registrationPath}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">🔒 Locked after docs</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SERVICE LOCATION SECTION */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Residence Location (GPS) <span className="text-red-600">*</span></CardTitle>
            <CardDescription className="text-xs">Your GPS coordinates for service area and residence verification (required)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MapLocationSelector
              initialLocation={areaLocation}
              onChange={(location) => setAreaLocation(location)}
            />
            {areaLocation.label && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-900 mb-2">📍 Coordinates Set:</p>
                <div className="space-y-1 text-xs text-blue-800">
                  <p><strong>Location:</strong> {areaLocation.label}</p>
                  <p><strong>Latitude:</strong> {areaLocation.lat.toFixed(6)}</p>
                  <p><strong>Longitude:</strong> {areaLocation.lng.toFixed(6)}</p>
                </div>
              </div>
            )}
            {(!areaLocation.label || (areaLocation.lat === -1.2921 && areaLocation.lng === 36.8219)) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-medium text-amber-900">⚠️ Please select a location on the map above</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DISCIPLINE & SPONSORSHIP SECTION */}
      <DisciplineAndSponsorSection
        onDisciplineCertificateStatusChange={(hasApproved) => setHasDisciplineCertificate(hasApproved)}
        registrationPath={registrationPath}
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
      />

      {/* AVAILABILITY SECTION */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Availability</CardTitle>
          <CardDescription className="text-xs">When you're available for training sessions</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AvailabilitySelector
            value={profile.availability}
            onChange={(availability) => handleChange('availability', availability)}
          />
        </CardContent>
      </Card>

      {/* FORM ACTIONS */}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        {!isNewSignup && onClose && (
          <Button variant="outline" onClick={() => onClose?.()} disabled={loading} size="sm">
            Cancel
          </Button>
        )}
        <Button onClick={save} disabled={loading} size="sm" className="sm:min-w-32">
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </div>
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
