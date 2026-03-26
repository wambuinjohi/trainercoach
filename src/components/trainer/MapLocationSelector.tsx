import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Loader2, Edit2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Location {
  lat: number
  lng: number
  label: string
}

interface MapLocationSelectorProps {
  initialLocation?: Location
  onChange: (location: Location) => void
}

type LocationMode = 'selection' | 'location-selected'

export const MapLocationSelector: React.FC<MapLocationSelectorProps> = ({ initialLocation, onChange }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const [location, setLocation] = useState<Location>(
    initialLocation || {
      lat: -1.2921,
      lng: 36.8219, // Default to Nairobi, Kenya
      label: ''
    }
  )
  const [mode, setMode] = useState<LocationMode>(
    initialLocation?.label && !(initialLocation.lat === -1.2921 && initialLocation.lng === 36.8219) ? 'location-selected' : 'selection'
  )
  const [loading, setLoading] = useState(false)
  const [areaLabel, setAreaLabel] = useState(initialLocation?.label || '')
  const [geolocationRetries, setGeolocationRetries] = useState(0)
  const [lastGeolocationError, setLastGeolocationError] = useState<string | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || map.current) return

    // Create map
    const newMap = L.map(mapRef.current).setView([location.lat, location.lng], 13)

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(newMap)

    // Add marker
    const newMarker = L.marker([location.lat, location.lng], {
      draggable: true,
      icon: L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      })
    }).addTo(newMap)

    // Handle marker drag
    newMarker.on('dragend', () => {
      const latLng = newMarker.getLatLng()
      updateLocation(latLng.lat, latLng.lng)
    })

    // Handle map clicks
    newMap.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng
      newMarker.setLatLng([lat, lng])
      updateLocation(lat, lng)
    })

    map.current = newMap
    marker.current = newMarker

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  const updateLocation = (lat: number, lng: number) => {
    const newLocation = { lat, lng, label: areaLabel }
    setLocation(newLocation)
    onChange(newLocation)
    // Transition to location-selected mode when coordinates are set via map click
    setMode('location-selected')
  }

  const getCurrentLocation = async () => {
    setLoading(true)
    setLastGeolocationError(null)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        })
      })

      const { latitude, longitude } = position.coords
      const newLocation = { lat: latitude, lng: longitude, label: areaLabel }
      setLocation(newLocation)
      setGeolocationRetries(0)

      if (map.current && marker.current) {
        map.current.setView([latitude, longitude], 13)
        marker.current.setLatLng([latitude, longitude])
      }

      onChange(newLocation)
      // Transition to location-selected mode after successful location retrieval
      setMode('location-selected')
      toast({ title: 'Location found', description: 'Map has been updated to your current location' })
    } catch (error) {
      console.error('Geolocation error:', error)
      let errorMessage = 'Please enable location services or try again'

      if (error instanceof GeolocationPositionError) {
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Location permission denied. Please enable location access in your browser settings.'
        } else if (error.code === error.TIMEOUT) {
          errorMessage = 'Location request timed out. Please try again.'
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = 'Location is unavailable. Please try a different location method.'
        }
      }

      setLastGeolocationError(errorMessage)
      // Show toast with retry option for permission denied
      if (error instanceof GeolocationPositionError && error.code === error.PERMISSION_DENIED) {
        toast({
          title: 'Location permission denied',
          description: errorMessage,
          variant: 'destructive',
          action: {
            label: 'Retry',
            onClick: () => retryGeolocation()
          }
        })
      } else {
        toast({
          title: 'Could not get location',
          description: errorMessage,
          variant: 'destructive'
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const retryGeolocation = async () => {
    setGeolocationRetries(prev => prev + 1)
    await getCurrentLocation()
  }

  const handleAreaLabelChange = (value: string) => {
    setAreaLabel(value)
    const newLocation = { lat: location.lat, lng: location.lng, label: value }
    setLocation(newLocation)
    onChange(newLocation)
  }

  const handleChangeLocation = () => {
    // Reset to selection mode and clear the label for re-selection
    setMode('selection')
    setGeolocationRetries(0)
    setLastGeolocationError(null)
  }

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Area of Residence/Operation</Label>

      {mode === 'selection' ? (
        // SELECTION MODE - Interactive map and location picker
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Click on the map to set your location, drag the marker to adjust, or use your current location
          </p>

          {/* Map Container */}
          <Card className="mb-4 overflow-hidden">
            <CardContent className="p-0">
              <div ref={mapRef} className="w-full h-64 bg-gray-100 rounded" />
            </CardContent>
          </Card>

          {/* Area Label Input - Only editable in selection mode */}
          <div className="mb-4">
            <Label htmlFor="area-label" className="text-sm">
              Area Name (e.g., Nairobi, Westlands) <span className="text-red-600">*</span>
            </Label>
            <Input
              id="area-label"
              type="text"
              value={areaLabel}
              onChange={(e) => handleAreaLabelChange(e.target.value)}
              placeholder="Enter area name or neighborhood"
              className="mt-1"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentLocation}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Getting location...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  Use My Location
                </>
              )}
            </Button>
          </div>

          {/* Geolocation Error Message with Retry */}
          {lastGeolocationError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-800 mb-2">{lastGeolocationError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retryGeolocation}
                disabled={loading}
                className="text-xs"
              >
                {loading ? 'Retrying...' : `Retry${geolocationRetries > 0 ? ` (${geolocationRetries})` : ''}`}
              </Button>
            </div>
          )}

          {/* Helper Text */}
          <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-gray-700">
            <p className="font-semibold mb-1">How to set your location:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Click on the map to place a marker at your desired location</li>
              <li>Drag the marker to fine-tune your exact position</li>
              <li>Or click "Use My Location" to auto-detect</li>
              <li>Enter an area name first, then select location</li>
            </ul>
            <p className="font-semibold mt-3 mb-1 text-blue-900">💡 Your location grid will automatically verify your Proof of Residence document.</p>
          </div>
        </div>
      ) : (
        // LOCATION-SELECTED MODE - Read-only display
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs font-semibold text-green-900 mb-3">✓ Location Selected</p>
            <div className="space-y-3">
              {/* Area Name - Read-only display */}
              <div>
                <Label className="text-xs font-medium text-green-900">Area Name</Label>
                <div className="mt-1 p-2 bg-white border border-green-200 rounded text-sm text-green-900 font-medium">
                  {location.label}
                </div>
              </div>

              {/* Coordinates - Read-only display */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-green-900">Latitude</Label>
                  <div className="mt-1 p-2 bg-white border border-green-200 rounded text-xs text-green-900">
                    {location.lat.toFixed(6)}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-green-900">Longitude</Label>
                  <div className="mt-1 p-2 bg-white border border-green-200 rounded text-xs text-green-900">
                    {location.lng.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Change Location Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleChangeLocation}
            disabled={loading}
            className="w-full"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Change Location
          </Button>

          <div className="p-3 bg-blue-50 rounded text-xs text-blue-800">
            <p>📌 Click "Change Location" if you want to select a different area.</p>
          </div>
        </div>
      )}
    </div>
  )
}
