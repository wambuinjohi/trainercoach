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
