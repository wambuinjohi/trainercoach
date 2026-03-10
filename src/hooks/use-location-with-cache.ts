import { useState, useCallback, useEffect } from 'react'
import { getApproxLocation, type ApproxLocation } from '@/lib/location'
import { toast } from '@/hooks/use-toast'

export interface CachedLocation extends ApproxLocation {
  timestamp: number
  cacheExpiry?: number // milliseconds (default 7 days)
}

export interface UseLocationWithCacheReturn {
  location: ApproxLocation | null
  isCached: boolean
  loading: boolean
  error: string | null
  requestLocation: (force?: boolean) => Promise<void>
  clearCache: () => void
  getCacheAge: () => number | null // returns age in milliseconds
}

const LOCATION_CACHE_KEY = 'location_cache'
const LOCATION_CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
const LOCATION_PERMISSION_SHOWN_KEY = 'location_permission_shown'

/**
 * Hook to manage geolocation with local caching
 * Requests location once and reuses it for future interactions
 * Allows user to update location from settings
 */
export function useLocationWithCache(): UseLocationWithCacheReturn {
  const [location, setLocation] = useState<ApproxLocation | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load cached location on mount
  useEffect(() => {
    const loadCachedLocation = () => {
      try {
        const cached = localStorage.getItem(LOCATION_CACHE_KEY)
        if (!cached) return

        const cachedData: CachedLocation = JSON.parse(cached)
        const cacheExpiry = cachedData.cacheExpiry || LOCATION_CACHE_EXPIRY
        const age = Date.now() - cachedData.timestamp

        // Check if cache is still valid
        if (age < cacheExpiry) {
          const { timestamp, cacheExpiry, ...locationData } = cachedData
          setLocation(locationData as ApproxLocation)
          setIsCached(true)
          return
        } else {
          // Cache expired, remove it
          localStorage.removeItem(LOCATION_CACHE_KEY)
        }
      } catch (err) {
        console.warn('Failed to load cached location:', err)
        localStorage.removeItem(LOCATION_CACHE_KEY)
      }
    }

    loadCachedLocation()
  }, [])

  const requestLocation = useCallback(
    async (force = false) => {
      // If we have a valid cached location and not forcing, use it
      if (!force && isCached && location) {
        setError(null)
        toast({
          title: 'Using saved location',
          description: 'Your location was retrieved from previous session',
        })
        return
      }

      setLoading(true)
      setError(null)

      try {
        const loc = await getApproxLocation()

        if (loc && loc.lat != null && loc.lng != null) {
          // Cache the location
          const cachedData: CachedLocation = {
            ...loc,
            timestamp: Date.now(),
            cacheExpiry: LOCATION_CACHE_EXPIRY,
          }
          localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cachedData))

          setLocation(loc)
          setIsCached(true)
          setError(null)

          const sourceLabel = loc.source === 'capacitor-geolocation' ? 'GPS' : 'device location'
          toast({
            title: 'Location set',
            description: `Location saved from ${sourceLabel}. Will be reused in future sessions.`,
          })

          // Mark that we've shown the permission prompt
          localStorage.setItem(LOCATION_PERMISSION_SHOWN_KEY, 'true')
        } else {
          const errorMsg = 'Could not determine location'
          setError(errorMsg)
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
    },
    [isCached, location]
  )

  const clearCache = useCallback(() => {
    localStorage.removeItem(LOCATION_CACHE_KEY)
    setLocation(null)
    setIsCached(false)
    setError(null)
  }, [])

  const getCacheAge = useCallback((): number | null => {
    try {
      const cached = localStorage.getItem(LOCATION_CACHE_KEY)
      if (!cached) return null
      const data: CachedLocation = JSON.parse(cached)
      return Date.now() - data.timestamp
    } catch {
      return null
    }
  }, [])

  return {
    location,
    isCached,
    loading,
    error,
    requestLocation,
    clearCache,
    getCacheAge,
  }
}
