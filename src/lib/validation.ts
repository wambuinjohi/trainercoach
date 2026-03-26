/**
 * Validation utilities for signup forms
 * Handles email and phone format validation
 */

/**
 * Validate email format
 * @param email Email address to validate
 * @returns true if email is in valid format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  // Standard email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Normalize phone number to M-Pesa format (254xxxxxxxxx)
 * Handles:
 * - 07xxxxxxxx → 254xxxxxxxx
 * - 01xxxxxxxx → 254xxxxxxxx
 * - 7xxxxxxxx → 2547xxxxxxxx
 * - +254xxxxxxx → 254xxxxxxx
 * - 0 prefix → trim and prefix with 254
 */
export function normalizePhoneNumber(phoneInput: string): string {
  let normalized = phoneInput.trim().replace(/\s+/g, '')

  // Remove leading +
  if (normalized.startsWith('+')) {
    normalized = normalized.slice(1)
  }

  // Convert 07 or 01 to 254
  if (normalized.startsWith('07') || normalized.startsWith('01')) {
    normalized = '254' + normalized.slice(1)
  }

  // Add country code if not present
  if (!normalized.startsWith('254') && (normalized.startsWith('7') || normalized.startsWith('1'))) {
    normalized = '254' + normalized
  }

  return normalized
}

/**
 * Validate phone format (after normalization)
 * Kenyan phone numbers should be 12 digits starting with 254
 * @param phone Phone number to validate
 * @returns true if phone is in valid format
 */
export function isValidPhoneFormat(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false
  }

  // Normalize first
  const normalized = normalizePhoneNumber(phone)

  // Check if it's 12 digits and starts with 254
  const phoneRegex = /^254[0-9]{9}$/
  return phoneRegex.test(normalized)
}

/**
 * Sanitize and normalize phone number for database storage
 * @param phone Raw phone input from user
 * @returns Normalized phone number ready for API calls
 */
export function sanitizePhone(phone: string): string {
  if (!phone) return ''

  // Remove non-digits
  let p = String(phone).trim().replace(/[^0-9]/g, '')

  // Normalize using normalizePhoneNumber logic
  if (p.startsWith('+')) {
    p = p.slice(1)
  }

  if (p.startsWith('0')) {
    p = '254' + p.replace(/^0+/, '')
  }

  if (!p.startsWith('254') && (p.startsWith('7') || p.startsWith('1'))) {
    p = '254' + p
  }

  return p
}
