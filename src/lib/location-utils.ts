/**
 * Location Utilities
 * Provides geographic distance calculations and location-based filtering
 */

/**
 * Coordinates interface for location data
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate great-circle distance between two points on Earth using Haversine formula
 * @param point1 First location coordinate
 * @param point2 Second location coordinate
 * @returns Distance in kilometers
 */
export function calculateDistance(point1: Coordinates, point2: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Check if a point is within a certain distance radius
 * @param trainerLocation Trainer's location
 * @param clientLocation Client's location
 * @param radiusKm Service radius in kilometers
 * @returns True if client is within service radius
 */
export function isWithinServiceRadius(
  trainerLocation: Coordinates,
  clientLocation: Coordinates,
  radiusKm: number
): boolean {
  const distance = calculateDistance(trainerLocation, clientLocation);
  return distance <= radiusKm;
}

/**
 * Parse location string "latitude,longitude" to Coordinates object
 * @param locationString String in format "latitude,longitude"
 * @returns Coordinates object
 */
export function parseLocationString(locationString: string): Coordinates | null {
  if (!locationString || typeof locationString !== 'string') {
    return null;
  }

  const parts = locationString.split(',').map((p) => parseFloat(p.trim()));

  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return {
      latitude: parts[0],
      longitude: parts[1],
    };
  }

  return null;
}

/**
 * Format coordinates to location string "latitude,longitude"
 * @param coords Coordinates object
 * @returns String in format "latitude,longitude"
 */
export function formatLocationString(coords: Coordinates): string {
  return `${coords.latitude},${coords.longitude}`;
}

/**
 * Validate coordinate values
 * @param coords Coordinates to validate
 * @returns True if coordinates are valid
 */
export function isValidCoordinates(coords: Coordinates | null): boolean {
  if (!coords) return false;

  const { latitude, longitude } = coords;

  // Latitude must be between -90 and 90
  // Longitude must be between -180 and 180
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Calculate default service radius based on trainer level or rating
 * Can be customized based on business logic
 * @param trainerLevel Optional trainer expertise level
 * @returns Default service radius in kilometers
 */
export function getDefaultServiceRadius(trainerLevel?: string): number {
  // Default service radius mapping
  const radiusMap: Record<string, number> = {
    beginner: 5,
    intermediate: 10,
    expert: 15,
    professional: 20,
  };

  return radiusMap[trainerLevel?.toLowerCase() || 'intermediate'] || 10;
}

/**
 * Sort trainers by distance from client location
 * @param trainers Array of trainer objects with location and coordinates
 * @param clientLocation Client's location coordinates
 * @returns Trainers sorted by distance (closest first)
 */
export function sortTrainersByDistance<T extends { location?: string | null; coordinates?: Coordinates }>(
  trainers: T[],
  clientLocation: Coordinates
): (T & { distance?: number })[] {
  return trainers
    .map((trainer) => {
      let distance = Infinity;

      // Try to parse location string or use coordinates object
      let trainerCoords = trainer.coordinates;

      if (!trainerCoords && trainer.location) {
        trainerCoords = parseLocationString(trainer.location);
      }

      if (trainerCoords && isValidCoordinates(trainerCoords)) {
        distance = calculateDistance(trainerCoords, clientLocation);
      }

      return { ...trainer, distance };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
}

/**
 * Filter trainers by service radius
 * @param trainers Array of trainer objects
 * @param clientLocation Client's location
 * @returns Trainers within their service radius of client
 */
export function filterTrainersByServiceRadius<
  T extends { location?: string | null; service_radius?: number; coordinates?: Coordinates }
>(trainers: T[], clientLocation: Coordinates): T[] {
  return trainers.filter((trainer) => {
    const radius = trainer.service_radius || getDefaultServiceRadius();

    let trainerCoords = trainer.coordinates;
    if (!trainerCoords && trainer.location) {
      trainerCoords = parseLocationString(trainer.location);
    }

    if (!trainerCoords || !isValidCoordinates(trainerCoords)) {
      return false;
    }

    return isWithinServiceRadius(trainerCoords, clientLocation, radius);
  });
}
