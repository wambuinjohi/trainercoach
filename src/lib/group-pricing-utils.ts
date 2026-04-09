/**
 * Group Training Pricing Utilities
 * 
 * Provides helper functions for managing group training tiers and pricing
 */

export interface GroupTier {
  group_size_name: string
  min_size: number
  max_size: number
  rate: number
}

export interface GroupPricingConfig {
  id?: string
  trainer_id?: string
  category_id?: number
  pricing_model: 'fixed' | 'per_person'
  tiers: GroupTier[]
  created_at?: string
  updated_at?: string
}

/**
 * Get default group training tiers
 * Returns the standard tier structure: 1 Person, 1-20, 21-50, 51-100, 100+
 * Note: "1 Person" and "1-20" tiers overlap at group size 1. This allows trainers to set different rates
 * for solo training vs small group training. The tier selected by the client determines which rate applies.
 */
export function getDefaultGroupTiers(): GroupTier[] {
  return [
    { group_size_name: '1 Person', min_size: 1, max_size: 1, rate: 0 },
    { group_size_name: '1-20', min_size: 1, max_size: 20, rate: 0 },
    { group_size_name: '21-50', min_size: 21, max_size: 50, rate: 0 },
    { group_size_name: '51-100', min_size: 51, max_size: 100, rate: 0 },
    { group_size_name: '100+', min_size: 101, max_size: 999999, rate: 0 }
  ]
}

/**
 * Validate that a tier name exists in the pricing configuration
 */
export function validateGroupTierName(
  groupPricing: GroupPricingConfig | null,
  tierName: string
): boolean {
  if (!groupPricing) return false
  return groupPricing.tiers.some(tier => tier.group_size_name === tierName)
}

/**
 * Get the rate for a specific tier
 */
export function getGroupTierRate(
  groupPricing: GroupPricingConfig | null,
  tierName: string
): number | null {
  if (!groupPricing) return null
  const tier = groupPricing.tiers.find(t => t.group_size_name === tierName)
  return tier ? tier.rate : null
}

/**
 * Get tier by group size name
 */
export function getGroupTierByName(
  groupPricing: GroupPricingConfig | null,
  tierName: string
): GroupTier | null {
  if (!groupPricing) return null
  return groupPricing.tiers.find(t => t.group_size_name === tierName) || null
}

/**
 * Check if all tiers have valid rates (non-zero)
 */
export function validateAllTiersHaveRates(tiers: GroupTier[]): boolean {
  return tiers.every(tier => tier.rate > 0)
}

/**
 * Format pricing display for UI
 * @param rate - The rate to format
 * @param pricingModel - Either 'fixed' or 'per_person'
 * @returns Formatted string like "Ksh 1,500 per person" or "Ksh 3,000 (group rate)"
 */
export function formatGroupPricingDisplay(rate: number, pricingModel: 'fixed' | 'per_person'): string {
  const formatted = `Ksh ${rate.toLocaleString('en-US')}`
  if (pricingModel === 'per_person') {
    return `${formatted} per person`
  }
  return `${formatted} (group rate)`
}

/**
 * Get tier label with price for display
 */
export function getGroupTierLabel(tier: GroupTier, pricingModel: 'fixed' | 'per_person'): string {
  const priceDisplay = formatGroupPricingDisplay(tier.rate, pricingModel)
  return `${tier.group_size_name} - ${priceDisplay}`
}

/**
 * Validate tier structure
 */
export function validateTierStructure(tiers: GroupTier[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!Array.isArray(tiers) || tiers.length === 0) {
    errors.push('At least one tier is required')
    return { valid: false, errors }
  }

  tiers.forEach((tier, idx) => {
    if (!tier.group_size_name) {
      errors.push(`Tier ${idx + 1}: Missing group_size_name`)
    }
    if (typeof tier.min_size !== 'number' || tier.min_size < 1) {
      errors.push(`Tier ${idx + 1}: min_size must be a number >= 1`)
    }
    if (typeof tier.max_size !== 'number' || tier.max_size < tier.min_size) {
      errors.push(`Tier ${idx + 1}: max_size must be >= min_size`)
    }
    if (typeof tier.rate !== 'number' || tier.rate < 0) {
      errors.push(`Tier ${idx + 1}: rate must be a non-negative number`)
    }
  })

  return { valid: errors.length === 0, errors }
}
