import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useGeolocation } from '@/hooks/use-geolocation'
import { MapPin, Upload } from 'lucide-react'
import { reverseGeocode } from '@/lib/location'

export const ClientProfileEditor: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const { location: geoLocation, requestLocation: requestGeoLocation, loading: geoLoading } = useGeolocation()
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>({})
  const [updatingLocation, setUpdatingLocation] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    const loadProfile = async () => {
      try {
        console.log('[Client Profile Load] Fetching profile from API for userId:', userId)
        const response = await apiService.getUserProfile(userId)
        console.log('[Client Profile Load] API response:', response)

        // Handle both direct array response and wrapped response with .data property
        let profileList: any[] = []
        if (Array.isArray(response)) {
          profileList = response
        } else if (response?.data && Array.isArray(response.data)) {
          profileList = response.data
        }

        if (profileList.length > 0) {
          const profileData = profileList[0]
          console.log('[Client Profile Load] Raw profile data from API:', profileData)
          setProfile(profileData)
        } else {
          console.log('[Client Profile Load] No profile found, initializing empty profile')
          // Initialize empty profile if user doesn't have one yet
          setProfile({})
        }
      } catch (error: any) {
        console.error('[Client Profile Load] Failed to load profile:', error)
        // Initialize empty profile on error so user can still edit
        setProfile({})
        toast({
          title: 'Note',
          description: 'Could not load profile data. You can still edit and save.',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [userId])

  const handleImageUpload = async (file: File) => {
    if (!userId) return
    setUploadingImage(true)
    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Upload file
      const response = await apiService.uploadClientProfileImage(userId, file)
      if (response.image_url) {
        setProfile(prev => ({
          ...prev,
          profile_image: response.image_url
        }))
        toast({
          title: 'Image uploaded',
          description: 'Profile picture uploaded successfully'
        })
      }
    } catch (err) {
      console.error('Failed to upload image', err)
      toast({
        title: 'Error',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setUploadingImage(false)
    }
  }

  const updateLocationFromGPS = async () => {
    setUpdatingLocation(true)
    try {
      await requestGeoLocation()

      if (geoLocation?.lat != null && geoLocation?.lng != null) {
        // Reverse geocode to get location name
        try {
          const result = await reverseGeocode(geoLocation.lat, geoLocation.lng)
          if (result?.label) {
            setProfile(prev => ({
              ...prev,
              area_of_residence: result.label,
              location: result.label,
              location_label: result.label,
              location_lat: geoLocation.lat,
              location_lng: geoLocation.lng,
            }))
            toast({
              title: 'Location updated',
              description: `Your location has been set to ${result.label}`
            })
          }
        } catch (err) {
          console.warn('Failed to reverse geocode location', err)
          setProfile(prev => ({
            ...prev,
            location_lat: geoLocation.lat,
            location_lng: geoLocation.lng,
          }))
          toast({
            title: 'Location coordinates saved',
            description: 'Please save profile to apply changes'
          })
        }
      }
    } catch (err) {
      console.error('Failed to update location', err)
      toast({
        title: 'Error',
        description: 'Failed to update location. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setUpdatingLocation(false)
    }
  }

  const save = async () => {
    if (!userId) return
    setLoading(true)
    try {
      // Build area_coordinates JSON if we have location coordinates
      let areaCoordinates = null
      if (profile.location_lat != null && profile.location_lng != null) {
        areaCoordinates = JSON.stringify({
          lat: profile.location_lat,
          lng: profile.location_lng
        })
      }

      const payload = {
        full_name: profile.full_name || null,
        phone_number: profile.phone_number || null,
        profile_image: profile.profile_image || null,
        area_of_residence: (profile.location || profile.location_label || profile.area_of_residence || '') || null,
        area_coordinates: areaCoordinates,
        location_lat: profile.location_lat || null,
        location_lng: profile.location_lng || null,
      }
      console.log('[Client Profile Save] Saving profile with payload:', payload)
      await apiService.updateUserProfile(userId, payload)
      console.log('[Client Profile Save] Profile saved successfully')
      toast({ title: 'Saved', description: 'Profile updated' })
      onClose?.()
    } catch (err) {
      console.error('[Client Profile Save] Error:', err)
      toast({ title: 'Error', description: (err as any)?.message || 'Failed to save profile', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label>Full name</Label>
                <Input value={profile.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={profile.phone_number || ''} onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })} />
              </div>
              <div>
                <Label>Locality</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Nairobi, Parklands"
                    value={(profile.area_of_residence || profile.location || profile.location_label) || ''}
                    onChange={(e) => setProfile({ ...profile, area_of_residence: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={updateLocationFromGPS}
                    disabled={updatingLocation || geoLoading}
                    className="flex-shrink-0"
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    {updatingLocation || geoLoading ? 'Updating...' : 'Update'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Update" to set your location from GPS
                </p>
              </div>
              <div>
                <Label>Profile Picture</Label>
                {(imagePreview || profile.profile_image) && (
                  <div className="mb-3 flex justify-center">
                    <img src={imagePreview || profile.profile_image} alt="Profile preview" className="h-32 w-32 rounded-lg object-cover border border-border" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleImageUpload(file)
                      }
                    }}
                    disabled={uploadingImage}
                    className="bg-input border-border"
                  />
                  {uploadingImage && <span className="text-sm text-muted-foreground">Uploading...</span>}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onClose?.()} disabled={loading}>Cancel</Button>
                <Button onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
