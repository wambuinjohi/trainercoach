/**
 * Fee Calculation Utility (REFACTORED)
 *
 * NEW PRICING MODEL:
 * - Client pays: base + VAT (16%) + transport ONLY
 * - Trainer receives: base - platform fee (25%) + transport
 * - Platform gets: VAT + platform fee
 *
 * NO additional surcharges/commissions are charged to clients.
 */

export interface FeeBreakdown {
  baseAmount: number
  platformChargeClient: number // DEPRECATED: Always 0 now
  platformChargeTrainer: number // DEPRECATED: Always 0 now
  compensationFee: number // DEPRECATED: Always 0 now
  sumOfCharges: number // DEPRECATED: Always 0 now
  maintenanceFee: number // DEPRECATED: Always 0 now
  transportFee: number
  vatAmount: number
  commissionAmount: number // DEPRECATED: Use platformFeeAmount instead
  platformFeeAmount?: number // NEW: 25% platform fee deducted from trainer
  clientTotal: number
  trainerNetAmount: number
}

export interface FeeSettings {
  platformChargeClientPercent?: number // DEPRECATED: No longer used
  platformChargeTrainerPercent?: number // DEPRECATED: No longer used
  compensationFeePercent?: number // DEPRECATED: No longer used
  maintenanceFeePercent?: number // DEPRECATED: No longer used
}

/**
 * Calculate fee breakdown for a booking (REFACTORED)
 *
 * NEW PRICING MODEL:
 * 1. Calculate VAT: vatAmount = base × 16%
 * 2. Calculate Platform Fee: platformFeeAmount = base × 25%
 * 3. Client total = base + VAT + transport
 * 4. Trainer net = base - platform fee + transport
 *
 * @param baseAmount - Base service amount (hourly_rate × sessions)
 * @param settings - Fee percentage settings (kept for backward compatibility, not used)
 * @param transportFee - Optional transport fee (not subject to charges, but included in totals)
 * @returns FeeBreakdown object with all calculated values
 */
export function calculateFeeBreakdown(
  baseAmount: number,
  settings: FeeSettings = {},
  transportFee: number = 0
): FeeBreakdown {
  // Validate inputs
  baseAmount = Math.max(0, baseAmount)
  transportFee = Math.max(0, transportFee)

  // NEW LOGIC: Simplified to only VAT and platform fee

  // Step 1: Calculate VAT (16% on base amount only)
  const vatAmount = round((baseAmount * 16) / 100)

  // Step 2: Calculate Platform Fee (25% of base amount, deducted from trainer)
  const platformFeeAmount = round((baseAmount * 25) / 100)

  // Step 3: Calculate client total
  // Client pays: base + VAT + transport ONLY
  const clientTotal = round(baseAmount + vatAmount + transportFee)

  // Step 4: Calculate trainer net
  // Trainer receives: base - platform fee + transport
  const trainerNetAmount = round(baseAmount - platformFeeAmount + transportFee)

  return {
    // New fields
    baseAmount,
    transportFee,
    vatAmount,
    platformFeeAmount,
    clientTotal,
    trainerNetAmount,

    // Deprecated fields (kept for backward compatibility)
    platformChargeClient: 0,
    platformChargeTrainer: 0,
    compensationFee: 0,
    sumOfCharges: 0,
    maintenanceFee: 0,
    commissionAmount: 0,
  }
}

/**
 * Calculate what the client needs to pay based on base amount and fees
 * Used for quick calculations without detailed breakdown
 */
export function calculateClientPayment(
  baseAmount: number,
  settings: FeeSettings,
  transportFee: number = 0
): number {
  const breakdown = calculateFeeBreakdown(baseAmount, settings, transportFee)
  return breakdown.clientTotal
}

/**
 * Calculate what the trainer receives after all deductions
 */
export function calculateTrainerEarnings(
  baseAmount: number,
  settings: FeeSettings,
  transportFee: number = 0
): number {
  const breakdown = calculateFeeBreakdown(baseAmount, settings, transportFee)
  return breakdown.trainerNetAmount
}

/**
 * Helper function to round to 2 decimal places
 */
function round(value: number): number {
  return Math.round(value * 100) / 100
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
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return null
  }

  // Check if within valid geographic ranges
  if (lat1 < -90 || lat1 > 90 || lon1 < -180 || lon1 > 180 || lat2 < -90 || lat2 > 90 || lon2 < -180 || lon2 > 180) {
    return null
  }

  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  // Sanity check: max distance between two points on Earth is ~20,000km
  if (distance > 20000) {
    return null
  }

  return distance
}

/**
 * Calculate transport fee based on distance and radius tiers
 * Mirrors the backend calculateTransportFee logic
 *
 * @param distanceKm - Distance in kilometers
 * @param radiusTiers - Array of radius tier objects with { radius_km: number, rate: number } or { radius: number, hourly_rate: number }
 * @returns Transport fee amount or 0 if cannot calculate
 */
export function calculateTransportFee(
  distanceKm: number | null,
  radiusTiers: any[]
): number {
  // If no distance calculated, return 0
  if (distanceKm === null || distanceKm === undefined) {
    return 0
  }

  // If no radius tiers configured, return 0
  if (!radiusTiers || !Array.isArray(radiusTiers) || radiusTiers.length === 0) {
    return 0
  }

  // Sort tiers by radius in ascending order
  const sortedTiers = [...radiusTiers].sort((a, b) => {
    const radiusA = Number(a.radius_km ?? a.radius ?? 0)
    const radiusB = Number(b.radius_km ?? b.radius ?? 0)
    return radiusA - radiusB
  })

  // Find the matching tier (first tier >= distance)
  for (const tier of sortedTiers) {
    const tierRadius = Number(tier.radius_km ?? tier.radius ?? 0)
    const tierRate = Number(tier.rate ?? tier.hourly_rate ?? 0)

    if (distanceKm <= tierRadius) {
      return round(tierRate)
    }
  }

  // If distance exceeds all tiers, use the highest tier rate
  const lastTier = sortedTiers[sortedTiers.length - 1]
  const rate = Number(lastTier.rate ?? lastTier.hourly_rate ?? 0)
  return round(rate)
}
