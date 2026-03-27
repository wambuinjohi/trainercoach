/**
 * Fee Calculation Utility
 * 
 * Implements the following calculation order:
 * 1. Calculate all charges on base amount
 * 2. Sum all charges
 * 3. Apply maintenance fee on sum of charges
 * 4. Add to client payment
 */

export interface FeeBreakdown {
  baseAmount: number
  platformChargeClient: number
  platformChargeTrainer: number
  compensationFee: number
  sumOfCharges: number
  maintenanceFee: number
  transportFee: number
  vatAmount: number
  commissionAmount: number
  clientTotal: number
  trainerNetAmount: number
}

export interface FeeSettings {
  platformChargeClientPercent: number
  platformChargeTrainerPercent: number
  compensationFeePercent: number
  maintenanceFeePercent: number
}

/**
 * Calculate fee breakdown for a booking
 *
 * Calculation order:
 * 1. Base amount: hourly_rate × sessions
 * 2. Calculate charges on base amount:
 *    - platformChargeClient = base × platformChargeClientPercent %
 *    - platformChargeTrainer = base × platformChargeTrainerPercent %
 *    - compensationFee = base × compensationFeePercent %
 * 3. Sum all charges: sum = platformChargeClient + platformChargeTrainer + compensationFee
 * 4. Apply maintenance fee: maintenanceFee = sum × maintenanceFeePercent %
 *    (Maintenance fee is system developer revenue, NOT charged to client)
 * 5. Calculate VAT: vatAmount = base × 16%
 *    (VAT is only applied to base amount, not to charges)
 * 6. Calculate Commission: commissionAmount = base × 25%
 *    (Commission is deducted from trainer payment)
 * 7. Client total = base + platformChargeClient + compensationFee + transportFee + vatAmount
 *    (Does NOT include maintenance fee - it's internal)
 * 8. Trainer net = base + transportFee - platformChargeTrainer - commissionAmount - (trainer's proportional share of maintenance fee)
 *
 * @param baseAmount - Base service amount (hourly_rate × sessions)
 * @param settings - Fee percentage settings
 * @param transportFee - Optional transport fee (not subject to charges, but included in trainer net)
 * @returns FeeBreakdown object with all calculated values
 */
export function calculateFeeBreakdown(
  baseAmount: number,
  settings: FeeSettings,
  transportFee: number = 0
): FeeBreakdown {
  // Validate inputs
  baseAmount = Math.max(0, baseAmount)
  transportFee = Math.max(0, transportFee)

  // Clamp percentages to 0-100
  const clientPct = Math.max(0, Math.min(100, settings.platformChargeClientPercent))
  const trainerPct = Math.max(0, Math.min(100, settings.platformChargeTrainerPercent))
  const compPct = Math.max(0, Math.min(100, settings.compensationFeePercent))
  const maintPct = Math.max(0, Math.min(100, settings.maintenanceFeePercent))

  // Step 1: Calculate all charges on base amount
  const platformChargeClient = round((baseAmount * clientPct) / 100)
  const platformChargeTrainer = round((baseAmount * trainerPct) / 100)
  const compensationFee = round((baseAmount * compPct) / 100)

  // Step 2: Sum all charges
  const sumOfCharges = round(
    platformChargeClient + platformChargeTrainer + compensationFee
  )

  // Step 3: Apply maintenance fee on the sum of charges
  const maintenanceFee = round((sumOfCharges * maintPct) / 100)

  // Step 4: Calculate VAT (16% on base amount only)
  const vatAmount = round((baseAmount * 16) / 100)

  // Step 5: Calculate Platform Commission (25% on base amount, deducted from trainer)
  const commissionAmount = round((baseAmount * 25) / 100)

  // Step 6: Calculate client total
  // Client pays: base + client charges (platformChargeClient + compensationFee) + transport + VAT
  // NOTE: Maintenance fee is NOT charged to client (it's internal platform revenue)
  const clientCharges = platformChargeClient + compensationFee
  const clientTotal = round(baseAmount + clientCharges + transportFee + vatAmount)

  // Step 7: Calculate trainer net
  // Trainer receives: base + transport - trainer charges - commission - trainer's share of maintenance
  // Trainer's share of maintenance is proportional to their charges
  const trainerShareOfMaintenance = sumOfCharges > 0
    ? round((platformChargeTrainer / sumOfCharges) * maintenanceFee)
    : 0
  const trainerNetAmount = round(
    baseAmount + transportFee - platformChargeTrainer - commissionAmount - trainerShareOfMaintenance
  )

  return {
    baseAmount,
    platformChargeClient,
    platformChargeTrainer,
    compensationFee,
    sumOfCharges,
    maintenanceFee,
    transportFee,
    vatAmount,
    commissionAmount,
    clientTotal,
    trainerNetAmount,
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
