import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useGeolocation } from '@/hooks/use-geolocation'
import { MapPin } from 'lucide-react'
import { reverseGeocode } from '@/lib/location'

export const ClientProfileEditor: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const { location: geoLocation, requestLocation: requestGeoLocation, loading: geoLoading } = useGeolocation()
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>({})
  const [updatingLocation, setUpdatingLocation] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    apiRequest('profile_get', { user_id: userId }, { headers: withAuth() })
      .then((data: any) => {
        if (data) {
          setProfile(data)
        }
      })
      .catch((error: any) => {
        console.warn('Failed to load profile', error)
      })
      .finally(() => setLoading(false))
  }, [userId])

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
      const payload = {
        user_id: userId,
        full_name: profile.full_name || null,
        phone_number: profile.phone_number || null,
        profile_image: profile.profile_image || null,
        bio: profile.bio || null,
        location: (profile.location || profile.location_label || '') || null,
        location_lat: profile.location_lat || null,
        location_lng: profile.location_lng || null,
      }
      await apiRequest('profile_update', payload, { headers: withAuth() })
      toast({ title: 'Saved', description: 'Profile updated' })
      onClose?.()
    } catch (err) {
      console.error('Save client profile error', err)
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
                    value={(profile.location || profile.location_label) || ''}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
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
                <Label>Profile image URL</Label>
                <Input value={profile.profile_image || ''} onChange={(e) => setProfile({ ...profile, profile_image: e.target.value })} />
              </div>
              <div>
                <Label>Bio</Label>
                <textarea className="w-full p-2 border border-border rounded-md bg-input" value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={4} />
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
