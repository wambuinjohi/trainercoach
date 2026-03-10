import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Loader2 } from 'lucide-react'
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
  const [loading, setLoading] = useState(false)
  const [areaLabel, setAreaLabel] = useState(initialLocation?.label || '')

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
  }

  const getCurrentLocation = async () => {
    setLoading(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        })
      })

      const { latitude, longitude } = position.coords
      setLocation(prev => ({ ...prev, lat: latitude, lng: longitude }))

      if (map.current && marker.current) {
        map.current.setView([latitude, longitude], 13)
        marker.current.setLatLng([latitude, longitude])
      }

      onChange({ lat: latitude, lng: longitude, label: areaLabel })
      toast({ title: 'Location found', description: 'Map has been updated to your current location' })
    } catch (error) {
      console.error('Geolocation error:', error)
      toast({
        title: 'Could not get location',
        description: 'Please enable location services or manually select on the map',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAreaLabelChange = (value: string) => {
    setAreaLabel(value)
    const newLocation = { lat: location.lat, lng: location.lng, label: value }
    setLocation(newLocation)
    onChange(newLocation)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold mb-2 block">Area of Residence/Operation</Label>
        <p className="text-sm text-gray-600 mb-4">
          Click on the map to set your location, drag the marker to adjust, or use your current location
        </p>

        {/* Map Container */}
        <Card className="mb-4 overflow-hidden">
          <CardContent className="p-0">
            <div ref={mapRef} className="w-full h-64 bg-gray-100 rounded" />
          </CardContent>
        </Card>

        {/* Location Info */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-sm">Latitude</Label>
            <Input
              type="number"
              value={location.lat.toFixed(6)}
              disabled
              className="mt-1 bg-gray-50"
              step="0.000001"
            />
          </div>
          <div>
            <Label className="text-sm">Longitude</Label>
            <Input
              type="number"
              value={location.lng.toFixed(6)}
              disabled
              className="mt-1 bg-gray-50"
              step="0.000001"
            />
          </div>
        </div>

        {/* Area Label */}
        <div className="mb-4">
          <Label htmlFor="area-label" className="text-sm">
            Area Name (e.g., Nairobi, Westlands)
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

        {/* Helper Text */}
        <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-gray-700">
          <p className="font-semibold mb-1">How to set your location:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Click on the map to place a marker at your desired location</li>
            <li>Drag the marker to fine-tune your exact position</li>
            <li>Or click "Use My Location" to auto-detect</li>
            <li>Enter an area name for reference (optional)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
