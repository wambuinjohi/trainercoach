import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MapPin, Loader2 } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useGeolocation } from '@/hooks/use-geolocation'

const RECENTS_KEY = 'recent_localities'

const readRecents = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch { return [] }
}

const writeRecents = (value: string) => {
  try {
    const list = readRecents()
    const next = [value, ...list.filter((v) => v.toLowerCase() !== value.toLowerCase())].slice(0, 8)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {}
}

export const LocationSelector: React.FC<{ className?: string; onSaved?: (loc: { label: string; lat?: number; lng?: number }) => void }>
  = ({ className, onSaved }) => {
  const { user } = useAuth()
  const { requestLocation, location: geoLocation, loading: geoLoading } = useGeolocation()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({})
  const [recents, setRecents] = useState<string[]>([])
  const [hasAutoSaved, setHasAutoSaved] = useState(false)

  useEffect(() => { setRecents(readRecents()) }, [])

  useEffect(() => {
    if (!user) return
    let mounted = true
    setLoading(true)
    apiRequest('profile_get', { user_id: user.id }, { headers: withAuth() })
      .then((data: any) => {
        if (!mounted) return
        const label = (data?.location as string) || (data?.location_label as string) || ''
        setLocation(label || '')
        const lat = data?.location_lat != null ? Number(data.location_lat) : undefined
        const lng = data?.location_lng != null ? Number(data.location_lng) : undefined
        setCoords({ lat, lng })
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [user])

  const save = async (newCoords?: { lat?: number; lng?: number }, label?: string) => {
    if (!user) return
    const locLabel = (label ?? location).trim()
    if (!locLabel) {
      toast({ title: 'Location required', description: 'Please enter your locality (e.g., city, estate, town).' })
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        user_id: user.id,
        location: locLabel,
        location_label: locLabel,
      }
      const lat = newCoords?.lat ?? coords.lat
      const lng = newCoords?.lng ?? coords.lng
      if (lat != null && lng != null) {
        payload.location_lat = lat
        payload.location_lng = lng
      }
      await apiRequest('profile_update', payload, { headers: withAuth() })
      writeRecents(locLabel)
      setRecents(readRecents())
      toast({ title: 'Location saved', description: locLabel })
      onSaved?.({ label: locLabel, lat, lng })
    } catch (e:any) {
      toast({ title: 'Save failed', description: e?.message || 'Could not save location', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const useGPS = async () => {
    setSaving(true)
    try {
      await requestLocation()
    } finally {
      setSaving(false)
    }
  }

  const disabled = saving || loading || geoLoading

  useEffect(() => {
    if (geoLocation && geoLocation.lat != null && geoLocation.lng != null) {
      setCoords({ lat: geoLocation.lat, lng: geoLocation.lng })
      // Auto-populate location label from geolocation result
      if (geoLocation.label && !location) {
        setLocation(geoLocation.label)
      }
    }
  }, [geoLocation, location])

  // Auto-save GPS location once coordinates are obtained and label is populated
  useEffect(() => {
    if (
      !hasAutoSaved &&
      !saving &&
      geoLocation &&
      geoLocation.lat != null &&
      geoLocation.lng != null &&
      location.trim().length > 0
    ) {
      setHasAutoSaved(true)
      save({ lat: geoLocation.lat, lng: geoLocation.lng }, location)
    }
  }, [geoLocation, location, hasAutoSaved, saving])

  const canSave = useMemo(() => (location || '').trim().length > 0, [location])

  return (
    <Card className={className ? className : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1 bg-muted/40 rounded-full p-2">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="locality" className="text-sm">Your locality</Label>
              {disabled && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex gap-2">
              <Input
                id="locality"
                placeholder="e.g. Nairobi, Parklands"
                value={location}
                onChange={(e)=> setLocation(e.target.value)}
                className="bg-input border-border"
                disabled={disabled}
              />
              <Button onClick={()=> save()} disabled={disabled || !canSave}>
                Save
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={useGPS} disabled={disabled}>
                Use my GPS
              </Button>
              {coords.lat != null && coords.lng != null && (
                <div className="text-xs text-muted-foreground self-center">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</div>
              )}
            </div>
            {recents.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {recents.map((r)=> (
                  <Button key={r} size="sm" variant="secondary" className="h-7 px-2" onClick={()=> setLocation(r)}>
                    {r}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default LocationSelector
