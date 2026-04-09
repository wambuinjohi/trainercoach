/**
 * Validate and normalize geographic coordinates
 * @param lat - Latitude value (should be -90 to 90)
 * @param lng - Longitude value (should be -180 to 180)
 * @returns Valid coordinates or null if invalid
 */
function validateCoordinates(
  lat: any,
  lng: any
): { lat: number; lng: number } | null {
  // Handle empty/null values
  if (lat == null || lng == null || lat === '' || lng === '') {
    return null
  }

  // Convert to numbers
  const numLat = Number(lat)
  const numLng = Number(lng)

  // Check if both are valid numbers
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return null
  }

  // Check if within valid geographic ranges
  // Latitude: -90 to 90
  // Longitude: -180 to 180
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return null
  }

  return { lat: numLat, lng: numLng }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers, or null if coordinates are invalid
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number | null {
  // Validate coordinates
  const startCoords = validateCoordinates(lat1, lon1)
  const endCoords = validateCoordinates(lat2, lon2)

  if (!startCoords || !endCoords) {
    return null
  }

  const R = 6371 // Earth's radius in km
  const dLat = ((endCoords.lat - startCoords.lat) * Math.PI) / 180
  const dLon = ((endCoords.lng - startCoords.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startCoords.lat * Math.PI) / 180) *
      Math.cos((endCoords.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  // Sanity check: max distance between two points on Earth is ~20,000km (half Earth's circumference)
  // If distance is greater, coordinates are likely invalid/swapped
  if (distance > 20000) {
    return null
  }

  return distance
}

/**
 * Format distance for display
 * @param distanceKm - Distance in kilometers
 * @returns Formatted distance string
 */
export function formatDistance(distanceKm: number | null | undefined): string {
  if (distanceKm === null || distanceKm === undefined) {
    return '—'
  }
  return distanceKm < 1
    ? `${(distanceKm * 1000).toFixed(0)}m`
    : `${distanceKm.toFixed(1)}km`
}

/**
 * Enrich trainers with distance information
 * @param trainers - Array of trainers
 * @param userLocation - User's location {lat, lng}
 * @returns Trainers with distance and formatted distance
 */
export function enrichTrainersWithDistance(
  trainers: any[],
  userLocation: { lat: number; lng: number } | null
): any[] {
  if (!userLocation) {
    return trainers.map((t) => ({
      ...t,
      distanceKm: null,
      distance: '—',
    }))
  }

  return trainers
    .map((trainer) => {
      if (trainer.location_lat != null && trainer.location_lng != null) {
        const distKm = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          trainer.location_lat,
          trainer.location_lng
        )
        // Debug logging for any issues
        if (distKm === null) {
          console.debug('[Distance] Coordinates rejected as invalid:', {
            trainer: trainer.name,
            trainerLat: trainer.location_lat,
            trainerLng: trainer.location_lng,
            typeOfLat: typeof trainer.location_lat,
            typeOfLng: typeof trainer.location_lng,
          })
        } else if (distKm > 1000) {
          console.warn('[Distance] Unusually large distance:', {
            trainer: trainer.name,
            distanceKm: distKm,
          })
        }
        return {
          ...trainer,
          distanceKm: distKm,
          distance: formatDistance(distKm),
        }
      }
      return {
        ...trainer,
        distanceKm: null,
        distance: '—',
      }
    })
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
}

/**
 * Filter trainers based on criteria
 */
export interface FilterCriteria {
  minRating?: number
  maxPrice?: number
  onlyAvailable?: boolean
  radius?: number
  categoryId?: number | null
  categoryIds?: number[]
  searchQuery?: string
  userLocationAvailable?: boolean
  availabilityDays?: string[]
  availabilityStartTime?: string
  availabilityEndTime?: string
}

export interface TrainerWithCategories {
  id: string
  name: string
  rating: number
  hourlyRate: number
  available: boolean
  distanceKm: number | null
  categoryIds: number[]
  availability?: Record<string, string[]>
  [key: string]: any
}

/**
 * Helper function to parse time string (HH:MM format) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Helper function to check if a time range overlaps with trainer availability
 */
function checkTimeOverlap(
  requestStartTime: string,
  requestEndTime: string,
  availabilitySlot: string
): boolean {
  try {
    const requestStart = timeToMinutes(requestStartTime)
    const requestEnd = timeToMinutes(requestEndTime)

    // Parse availability slot (e.g., "06:00 - 20:00")
    const [slotStart, slotEnd] = availabilitySlot
      .split('-')
      .map(s => s.trim())
      .map(timeToMinutes)

    // Check if there's any overlap between request time and availability
    return requestStart < slotEnd && requestEnd > slotStart
  } catch (err) {
    console.warn('Failed to parse availability time:', err)
    return true // Default to allowing if parsing fails
  }
}

/**
 * Helper function to check if trainer has availability on requested days/times
 */
function hasAvailability(
  trainer: TrainerWithCategories,
  requestedDays: string[],
  requestStartTime: string,
  requestEndTime: string
): boolean {
  if (!trainer.availability) {
    return true // Assume available if no availability data
  }

  // Check if trainer is available on at least one of the requested days within the time range
  for (const day of requestedDays) {
    const dayKey = day.toLowerCase()
    const slots = trainer.availability[dayKey]

    if (slots && Array.isArray(slots)) {
      for (const slot of slots) {
        if (checkTimeOverlap(requestStartTime, requestEndTime, slot)) {
          return true
        }
      }
    }
  }

  return false
}

export function filterTrainers(
  trainers: TrainerWithCategories[],
  criteria: FilterCriteria
): TrainerWithCategories[] {
  return trainers.filter((trainer) => {
    // Filter by categories (support both single and multi-select)
    // If categoryIds array is provided, use it (OR logic - trainer must have at least one)
    if (criteria.categoryIds && criteria.categoryIds.length > 0) {
      if (!trainer.categoryIds || !trainer.categoryIds.some(id => criteria.categoryIds!.includes(id))) {
        return false
      }
    }
    // Fallback to legacy categoryId for backward compatibility
    else if (criteria.categoryId !== null && criteria.categoryId !== undefined) {
      if (!trainer.categoryIds || !trainer.categoryIds.includes(criteria.categoryId)) {
        return false
      }
    }

    // Filter by rating
    if (criteria.minRating && (trainer.rating || 0) < criteria.minRating) {
      return false
    }

    // Filter by price
    if (criteria.maxPrice && (trainer.hourlyRate || 0) > criteria.maxPrice) {
      return false
    }

    // Filter by availability
    if (criteria.onlyAvailable && !trainer.available) {
      return false
    }

    // Filter by day + time availability
    if (criteria.availabilityDays && criteria.availabilityDays.length > 0 && criteria.availabilityStartTime && criteria.availabilityEndTime) {
      if (!hasAvailability(trainer, criteria.availabilityDays, criteria.availabilityStartTime, criteria.availabilityEndTime)) {
        return false
      }
    }

    // Filter by distance (only apply if user location is available)
    if (criteria.radius && criteria.userLocationAvailable) {
      if (trainer.distanceKm == null || trainer.distanceKm > criteria.radius) {
        return false
      }
    }

    // Filter by search query
    if (criteria.searchQuery) {
      const query = criteria.searchQuery.toLowerCase()
      const nameMatch = (trainer.name || '').toLowerCase().includes(query)
      const disciplineMatch = (trainer.discipline || '').toLowerCase().includes(query)
      if (!nameMatch && !disciplineMatch) {
        return false
      }
    }

    return true
  })
}
