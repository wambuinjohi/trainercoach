import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Navigation, Phone, MessageCircle, Loader2 } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface TrainerLocationTrackerProps {
  booking: any
  trainer: any
  onCallTrainer?: () => void
  onMessageTrainer?: () => void
}

export const TrainerLocationTracker: React.FC<TrainerLocationTrackerProps> = ({
  booking,
  trainer,
  onCallTrainer,
  onMessageTrainer,
}) => {
  const { user } = useAuth()
  const [trainerLocation, setTrainerLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapUrl, setMapUrl] = useState<string | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Fetch trainer's current location
  const fetchTrainerLocation = async () => {
    try {
      setRefreshing(true)
      const trainerProfile = await apiRequest(
        'profile_get',
        { user_id: trainer.id },
        { headers: withAuth() }
      )

      if (trainerProfile?.location_lat && trainerProfile?.location_lng) {
        const lat = Number(trainerProfile.location_lat)
        const lng = Number(trainerProfile.location_lng)
        setTrainerLocation({ lat, lng })

        // Calculate distance if we have client location
        if (booking?.client_location_lat && booking?.client_location_lng) {
          const dist = calculateDistance(
            Number(booking.client_location_lat),
            Number(booking.client_location_lng),
            lat,
            lng
          )
          setDistance(Math.round(dist * 10) / 10)
        }

        // Generate Google Maps embed URL
        const mapsUrl = `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`
        setMapUrl(mapsUrl)
      }
    } catch (err) {
      console.warn('Failed to fetch trainer location', err)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrainerLocation()

    // Poll for location updates every 30 seconds during active session
    const interval = setInterval(() => {
      fetchTrainerLocation()
    }, 30000)

    return () => clearInterval(interval)
  }, [trainer.id, booking?.id])

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Navigation className="h-5 w-5 text-blue-600" />
            {trainer.name} is on the way
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTrainerLocation}
            disabled={refreshing}
            className="h-8"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Map Container */}
        {mapUrl ? (
          <div className="rounded-lg overflow-hidden border border-border h-64 sm:h-80">
            <iframe
              width="100%"
              height="100%"
              frameBorder="0"
              src={mapUrl}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        ) : loading ? (
          <div className="rounded-lg border border-border h-64 sm:h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">Loading location...</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border h-64 sm:h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Location unavailable</p>
          </div>
        )}

        {/* Distance Info */}
        {distance !== null && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-semibold">{distance} km away</span>
              {distance < 1 && ' — trainer is nearby!'}
              {distance >= 1 && distance < 5 && ' — trainer is approaching'}
              {distance >= 5 && ' — trainer is on the way'}
            </p>
          </div>
        )}

        {/* Session Info */}
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-border space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Session Date:</span>
            <span className="font-medium">{booking?.session_date}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Session Time:</span>
            <span className="font-medium">{booking?.session_time}</span>
          </div>
          {booking?.session_location_preference && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Location:</span>
              <span className="font-medium capitalize">
                {booking.session_location_preference.replace('_', ' ')}
                {booking.session_location_custom && ` (${booking.session_location_custom})`}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onCallTrainer}
            className="flex-1 gap-2"
            disabled={true}
            title="Call feature not yet implemented"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Call</span>
          </Button>
          <Button
            onClick={onMessageTrainer}
            className="flex-1 gap-2 bg-gradient-primary text-white"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Message</span>
          </Button>
        </div>

        {/* Last Updated */}
        <p className="text-xs text-gray-500 text-center">
          Location updates every 30 seconds
        </p>
      </CardContent>
    </Card>
  )
}
