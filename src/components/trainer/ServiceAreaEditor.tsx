import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useGeolocation } from '@/hooks/use-geolocation'
import { toast } from '@/hooks/use-toast'

export const ServiceAreaEditor: React.FC<{ onClose?: () => void; onSaved?: () => void | Promise<void> }> = ({ onClose, onSaved }) => {
  const { user } = useAuth()
  const { location: geoLocation, requestLocation: requestGeoLocation } = useGeolocation()
  const userId = user?.id
  const [lat, setLat] = useState<string>('')
  const [lng, setLng] = useState<string>('')
  const [label, setLabel] = useState<string>('')
  const [radius, setRadius] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)

  // Sync geolocation result to form fields
  useEffect(() => {
    if (geoLocation?.lat != null && geoLocation?.lng != null) {
      setLat(String(geoLocation.lat))
      setLng(String(geoLocation.lng))
    }
  }, [geoLocation])

  useEffect(() => {
    if (!userId) return
    let mounted = true
    apiRequest('profile_get', { user_id: userId }, { headers: withAuth() })
      .then((data: any) => {
        if (!mounted || !data) return

        // Load location data
        const profileData = data.data || data

        // Debug log to help diagnose loading issues
        if (profileData) {
          console.log('ServiceAreaEditor: Loaded profile data with fields:', Object.keys(profileData).filter(k => k.includes('location') || k.includes('radius')))
        }

        // Set latitude (handle both decimal and string formats)
        if (profileData?.location_lat != null) {
          setLat(String(profileData.location_lat))
        } else {
          setLat('')
        }

        // Set longitude (handle both decimal and string formats)
        if (profileData?.location_lng != null) {
          setLng(String(profileData.location_lng))
        } else {
          setLng('')
        }

        // Set location label - this is what was missing
        if (profileData?.location_label) {
          setLabel(String(profileData.location_label))
        } else {
          setLabel('')
        }

        // Set service radius
        if (profileData?.service_radius != null) {
          setRadius(Number(profileData.service_radius))
        } else {
          setRadius('')
        }
      })
      .catch((err) => {
        console.error('Failed to load profile data:', err)
      })
    return () => { mounted = false }
  }, [userId])

  const useMyLocation = async () => {
    await requestGeoLocation()
  }

  const save = async () => {
    if (!userId) return
    const latNum = Number(lat)
    const lngNum = Number(lng)
    const radNum = radius === '' ? null : Number(radius)

    // Validate coordinates
    if (!isFinite(latNum) || !isFinite(lngNum)) {
      toast({ title: 'Invalid coordinates', description: 'Provide numeric latitude and longitude', variant: 'destructive' })
      return
    }

    // Validate latitude range
    if (latNum < -90 || latNum > 90) {
      toast({ title: 'Invalid latitude', description: 'Latitude must be between -90 and 90', variant: 'destructive' })
      return
    }

    // Validate longitude range
    if (lngNum < -180 || lngNum > 180) {
      toast({ title: 'Invalid longitude', description: 'Longitude must be between -180 and 180', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      // Prepare update payload - send location_label as string or null
      const updatePayload = {
        user_id: userId,
        location_lat: latNum,
        location_lng: lngNum,
        location_label: label && label.trim() ? label.trim() : null,
        service_radius: radNum
      }

      console.log('Saving service area:', updatePayload)

      const result = await apiRequest('profile_update', updatePayload, { headers: withAuth() })

      if (result?.status === 'success') {
        toast({ title: 'Saved', description: 'Service area updated successfully' })
        // Notify parent to refresh profile data
        if (onSaved) {
          await onSaved()
        }
        onClose?.()
      } else {
        toast({ title: 'Error', description: result?.message || 'Failed to save service area', variant: 'destructive' })
      }
    } catch (err) {
      console.error('Save service area error', err)
      toast({ title: 'Error', description: (err as any)?.message || 'Failed to save service area', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Service Area</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Latitude</Label>
                  <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. -1.2921" />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 36.8219" />
                </div>
              </div>
              <div>
                <Label>Location label (optional)</Label>
                <Input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="Estate, City" />
              </div>
              <div>
                <Label>Service radius (km)</Label>
                <Input type="number" value={String(radius)} onChange={(e)=>setRadius(e.target.value ? Number(e.target.value) : '')} />
              </div>
              <div className="space-y-2 sm:space-y-0 sm:flex sm:justify-between sm:items-center">
                <Button variant="ghost" onClick={useMyLocation} className="w-full sm:w-auto">Use my current location</Button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={() => onClose?.()} disabled={loading} className="flex-1 sm:flex-none">Cancel</Button>
                  <Button onClick={save} disabled={loading} className="flex-1 sm:flex-none">{loading ? 'Saving...' : 'Save'}</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
