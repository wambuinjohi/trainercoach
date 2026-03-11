/**
 * Location and service radius utilities
 * Handles distance calculations and service radius validation
 */

import { calculateDistance as haversineDistance } from './distance-utils'

/**
 * Validates if a location is within a trainer's service radius
 * @param trainerLat - Trainer's latitude
 * @param trainerLng - Trainer's longitude
 * @param clientLat - Client's latitude
 * @param clientLng - Client's longitude
 * @param serviceRadiusKm - Service radius in kilometers
 * @returns true if client is within service radius, false otherwise
 */
export function isWithinServiceRadius(
  trainerLat: number | null | undefined,
  trainerLng: number | null | undefined,
  clientLat: number | null | undefined,
  clientLng: number | null | undefined,
  serviceRadiusKm: number
): boolean {
  if (
    !trainerLat ||
    !trainerLng ||
    !clientLat ||
    !clientLng ||
    serviceRadiusKm <= 0
  ) {
    return false
  }

  const distance = haversineDistance(trainerLat, trainerLng, clientLat, clientLng)
  if (distance === null) {
    return false
  }

  return distance <= serviceRadiusKm
}

/**
 * Calculate service radius based on trainer tier or location preference
 * Default radiuses:
 * - Standard: 10 km
 * - Premium: 20 km
 * - Elite: 50 km
 * @param tier - Trainer tier (optional, defaults to 'standard')
 * @returns Service radius in kilometers
 */
export function calculateDefaultServiceRadius(tier: 'standard' | 'premium' | 'elite' = 'standard'): number {
  const radiusMap = {
    standard: 10,
    premium: 20,
    elite: 50,
  }
  return radiusMap[tier]
}

/**
 * Get multiple trainers filtered by service radius
 * @param trainers - Array of trainers with location data
 * @param clientLat - Client's latitude
 * @param clientLng - Client's longitude
 * @returns Trainers within their respective service radius, sorted by distance
 */
export function filterTrainersByServiceRadius(
  trainers: any[],
  clientLat: number | null | undefined,
  clientLng: number | null | undefined
): any[] {
  if (!clientLat || !clientLng) {
    return trainers
  }

  return trainers
    .filter((trainer) => {
      if (!trainer.location_lat || !trainer.location_lng) {
        return false
      }

      return isWithinServiceRadius(
        trainer.location_lat,
        trainer.location_lng,
        clientLat,
        clientLng,
        trainer.service_radius || 10
      )
    })
    .map((trainer) => ({
      ...trainer,
      distanceKm: haversineDistance(
        clientLat,
        clientLng,
        trainer.location_lat,
        trainer.location_lng
      ),
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
}

/**
 * Calculate service radius from multiple locations (e.g., multiple work areas)
 * Returns the smallest radius that covers all locations
 * @param locations - Array of {lat, lng} objects
 * @returns Minimum service radius in kilometers to cover all locations
 */
export function calculateServiceRadiusFromLocations(
  locations: Array<{ lat: number; lng: number }>
): number {
  if (locations.length === 0) {
    return calculateDefaultServiceRadius()
  }

  if (locations.length === 1) {
    return calculateDefaultServiceRadius()
  }

  // Calculate center point
  const centerLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length
  const centerLng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length

  // Find maximum distance from center
  let maxDistance = 0
  for (const location of locations) {
    const distance = haversineDistance(centerLat, centerLng, location.lat, location.lng)
    if (distance !== null && distance > maxDistance) {
      maxDistance = distance
    }
  }

  // Add 20% buffer to ensure all locations are covered
  return Math.ceil((maxDistance + maxDistance * 0.2) / 5) * 5 // Round to nearest 5km
}

/**
 * Validate trainer location coordinates
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns true if valid coordinates, false otherwise
 */
export function validateLocationCoordinates(lat: any, lng: any): boolean {
  if (lat == null || lng == null) return false

  const numLat = Number(lat)
  const numLng = Number(lng)

  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return false

  return numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180
}

/**
 * Get distance between trainer and client
 * @param trainerLat - Trainer's latitude
 * @param trainerLng - Trainer's longitude
 * @param clientLat - Client's latitude
 * @param clientLng - Client's longitude
 * @returns Distance in kilometers, or null if invalid
 */
export function getDistanceBetweenLocations(
  trainerLat: number | null | undefined,
  trainerLng: number | null | undefined,
  clientLat: number | null | undefined,
  clientLng: number | null | undefined
): number | null {
  if (
    !validateLocationCoordinates(trainerLat, trainerLng) ||
    !validateLocationCoordinates(clientLat, clientLng)
  ) {
    return null
  }

  return haversineDistance(trainerLat as number, trainerLng as number, clientLat as number, clientLng as number)
}
