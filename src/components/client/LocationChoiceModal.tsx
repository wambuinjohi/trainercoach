import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Navigation, Home } from 'lucide-react'
import { reverseGeocode } from '@/lib/location'

interface LocationChoiceModalProps {
  homeLocation?: { lat: number; lng: number; label?: string }
  currentLocation?: { lat: number; lng: number }
  onSelectHome: () => void
  onSelectCurrent: () => void
}

export const LocationChoiceModal: React.FC<LocationChoiceModalProps> = ({
  homeLocation,
  currentLocation,
  onSelectHome,
  onSelectCurrent,
}) => {
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(null)
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false)

  // Reverse geocode current location to get a readable address
  useEffect(() => {
    if (!currentLocation) return

    const geocode = async () => {
      setLoadingCurrentLocation(true)
      try {
        const result = await reverseGeocode(currentLocation.lat, currentLocation.lng)
        if (result?.label) {
          setCurrentLocationName(result.label)
        }
      } catch (err) {
        console.warn('Failed to reverse geocode current location', err)
        setCurrentLocationName('Current Location')
      } finally {
        setLoadingCurrentLocation(false)
      }
    }

    geocode()
  }, [currentLocation])

  const hasHomeLocation = homeLocation && homeLocation.lat != null && homeLocation.lng != null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40" />
      <Card className="relative w-full max-w-sm rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Where are you?
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Choose a location to find trainers nearby
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Home Location Option */}
          {hasHomeLocation && (
            <button
              onClick={onSelectHome}
              className="w-full p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
            >
              <div className="flex items-start gap-3">
                <Home className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">Your training locality</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {homeLocation.label || 'Saved location'}
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Current Location Option */}
          <button
            onClick={onSelectCurrent}
            className="w-full p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
          >
            <div className="flex items-start gap-3">
              <Navigation className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">Current Location</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {loadingCurrentLocation ? 'Getting location...' : (currentLocationName || 'Using GPS')}
                </p>
              </div>
            </div>
          </button>

          {!hasHomeLocation && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <span className="font-medium">Tip:</span> You can save your home address in your profile settings for quick access.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
