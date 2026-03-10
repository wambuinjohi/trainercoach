import { useState, useCallback, useEffect } from 'react'
import { getApproxLocation, type ApproxLocation } from '@/lib/location'
import { toast } from '@/hooks/use-toast'

export interface UseGeolocationReturn {
  location: ApproxLocation | null
  loading: boolean
  error: string | null
  requestLocation: () => Promise<void>
}

const LOCATION_STORAGE_KEY = 'saved-user-location'

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<ApproxLocation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load previously saved location on mount
  useEffect(() => {
    try {
      const savedLocation = localStorage.getItem(LOCATION_STORAGE_KEY)
      if (savedLocation) {
        const parsed = JSON.parse(savedLocation)
        if (parsed && parsed.lat != null && parsed.lng != null) {
          setLocation(parsed)
        }
      }
    } catch (err) {
      console.warn('Failed to load saved location from localStorage', err)
    }
  }, [])

  const requestLocation = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const loc = await getApproxLocation()

      if (loc && loc.lat != null && loc.lng != null) {
        setLocation(loc)
        // Save location to localStorage for future use
        try {
          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc))
        } catch (storageErr) {
          console.warn('Failed to save location to localStorage', storageErr)
        }
        const sourceLabel = loc.source === 'capacitor-geolocation' ? 'GPS' : 'device location'
        toast({
          title: 'Location set',
          description: `Location obtained via ${sourceLabel}`,
        })
      } else {
        setError('Could not determine location')
        toast({
          title: 'Location error',
          description: 'Please enable location services and try again',
          variant: 'destructive',
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      toast({
        title: 'Location error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    location,
    loading,
    error,
    requestLocation,
  }
}
