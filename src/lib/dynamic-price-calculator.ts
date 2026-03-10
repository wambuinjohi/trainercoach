import { calculateFeeBreakdown, type FeeSettings, type FeeBreakdown } from './fee-calculations'

/**
 * Dynamic Price Calculation Engine
 * 
 * Calculates booking prices dynamically based on:
 * - Base hourly rate and session count
 * - Distance/transport fees
 * - Group training pricing
 * - Surge pricing (peak hours, short notice)
 * - Time-based discounts
 * - Platform fees and taxes
 */

export interface PriceCalculationInput {
  // Base pricing
  baseHourlyRate: number
  numSessions: number
  
  // Distance/location
  distance?: number // in kilometers
  clientLat?: number
  clientLng?: number
  trainerLat?: number
  trainerLng?: number
  
  // Group training
  isGroupTraining?: boolean
  groupSize?: number
  groupTierName?: string
  groupPricingModel?: 'per_person' | 'fixed' // per_person or fixed rate
  groupTierRate?: number
  
  // Surge pricing triggers
  bookingDate?: string // YYYY-MM-DD
  bookingTime?: string // HH:MM
  daysUntilBooking?: number // number of days from now to booking
  
  // Discount/promotion
  discountPercent?: number // 0-100
  
  // Fee settings
  platformChargeClientPercent?: number
  platformChargeTrainerPercent?: number
  compensationFeePercent?: number
  maintenanceFeePercent?: number
}

export interface DynamicPriceResult {
  baseAmount: number
  surgeMultiplier: number
  surgePriceAmount: number
  discountAmount: number
  finalBaseAmount: number
  transportFee: number
  feeBreakdown: FeeBreakdown
  clientTotal: number
  trainerNetAmount: number
  breakdown: {
    baseRate: number
    sessions: number
    subtotal: number
    surgeApplied: boolean
    surgePercentage: number
    discountApplied: boolean
    discountPercentage: number
    transportFee: number
    platformFee: number
    compensationFee: number
    maintenanceFee: number
    total: number
  }
}

/**
 * Calculate Haversine distance between two coordinates
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculate transport fee based on distance
 * Uses tiered pricing:
 * - 0-3 km: KES 100 base
 * - 3-8 km: KES 150
 * - 8-15 km: KES 250
 * - 15+ km: KES 400 + (distance - 15) * 20
 */
function calculateTransportFee(distance: number): number {
  if (distance <= 0) return 0
  if (distance <= 3) return 100
  if (distance <= 8) return 150
  if (distance <= 15) return 250
  return 400 + (distance - 15) * 20
}

/**
 * Determine surge multiplier based on booking time and notice period
 * 
 * Peak hours (6 AM - 9 AM, 5 PM - 7 PM): +20%
 * Short notice (< 24 hours): +15%
 * Next day bookings: +10%
 * Weekend (Sat/Sun): +5%
 */
function calculateSurgeMultiplier(
  bookingDate?: string,
  bookingTime?: string,
  daysUntilBooking?: number
): number {
  let multiplier = 1.0
  
  if (!bookingDate || !bookingTime) {
    return multiplier
  }

  // Parse time
  const [hours, minutes] = bookingTime.split(':').map(Number)
  
  // Peak hours surcharge
  const isPeakHours = 
    (hours >= 6 && hours < 9) || // Morning rush
    (hours >= 17 && hours < 19)  // Evening rush
  if (isPeakHours) {
    multiplier += 0.20
  }

  // Short notice surcharge
  if (typeof daysUntilBooking === 'number') {
    if (daysUntilBooking < 1) {
      // Same day booking: +15%
      multiplier += 0.15
    } else if (daysUntilBooking <= 1) {
      // Next day: +10%
      multiplier += 0.10
    }
  }

  // Weekend surcharge
  try {
    const date = new Date(bookingDate)
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend (0 = Sunday, 6 = Saturday)
      multiplier += 0.05
    }
  } catch {
    // Invalid date, skip weekend check
  }

  return multiplier
}

/**
 * Main dynamic price calculation function
 */
export function calculateDynamicPrice(input: PriceCalculationInput): DynamicPriceResult {
  // Validate and normalize inputs
  const baseHourlyRate = Math.max(0, input.baseHourlyRate || 0)
  const numSessions = Math.max(1, input.numSessions || 1)
  const discountPercent = Math.max(0, Math.min(100, input.discountPercent || 0))

  // Fee settings with defaults
  const feeSettings: FeeSettings = {
    platformChargeClientPercent: input.platformChargeClientPercent ?? 15,
    platformChargeTrainerPercent: input.platformChargeTrainerPercent ?? 10,
    compensationFeePercent: input.compensationFeePercent ?? 10,
    maintenanceFeePercent: input.maintenanceFeePercent ?? 15,
  }

  // Calculate base amount
  let baseAmount: number
  
  if (input.isGroupTraining && input.groupTierRate && input.groupPricingModel) {
    // Group training pricing
    if (input.groupPricingModel === 'per_person') {
      baseAmount = input.groupTierRate * (input.groupSize || 1) * numSessions
    } else {
      // Fixed rate
      baseAmount = input.groupTierRate * numSessions
    }
  } else {
    // Individual training
    baseAmount = baseHourlyRate * numSessions
  }

  // Calculate transport fee if coordinates provided
  let transportFee = 0
  if (input.distance !== undefined && input.distance > 0) {
    transportFee = calculateTransportFee(input.distance)
  } else if (
    input.clientLat !== undefined &&
    input.clientLng !== undefined &&
    input.trainerLat !== undefined &&
    input.trainerLng !== undefined
  ) {
    const distance = calculateDistance(
      input.trainerLat,
      input.trainerLng,
      input.clientLat,
      input.clientLng
    )
    transportFee = calculateTransportFee(distance)
  }

  // Calculate surge multiplier
  const surgeMultiplier = calculateSurgeMultiplier(
    input.bookingDate,
    input.bookingTime,
    input.daysUntilBooking
  )
  const surgePriceAmount = round(baseAmount * (surgeMultiplier - 1))
  const surgeApplied = surgeMultiplier > 1

  // Apply surge to base amount
  let priceAfterSurge = round(baseAmount * surgeMultiplier)

  // Apply discount
  const discountAmount = round(priceAfterSurge * (discountPercent / 100))
  const finalBaseAmount = round(priceAfterSurge - discountAmount)

  // Calculate fees
  const feeBreakdown = calculateFeeBreakdown(finalBaseAmount, feeSettings, transportFee)

  return {
    baseAmount,
    surgeMultiplier,
    surgePriceAmount,
    discountAmount,
    finalBaseAmount,
    transportFee,
    feeBreakdown,
    clientTotal: feeBreakdown.clientTotal,
    trainerNetAmount: feeBreakdown.trainerNetAmount,
    breakdown: {
      baseRate: baseHourlyRate,
      sessions: numSessions,
      subtotal: baseAmount,
      surgeApplied,
      surgePercentage: Math.round((surgeMultiplier - 1) * 100),
      discountApplied: discountPercent > 0,
      discountPercentage: discountPercent,
      transportFee,
      platformFee: feeBreakdown.platformChargeClient,
      compensationFee: feeBreakdown.compensationFee,
      maintenanceFee: feeBreakdown.maintenanceFee,
      total: feeBreakdown.clientTotal,
    },
  }
}

/**
 * Quick price estimate without detailed breakdown
 */
export function estimatePrice(
  baseHourlyRate: number,
  numSessions: number,
  distance?: number
): number {
  const result = calculateDynamicPrice({
    baseHourlyRate,
    numSessions,
    distance,
  })
  return result.clientTotal
}

/**
 * Helper function to round to 2 decimal places
 */
function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = 'KES'): string {
  return `${currency} ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
