/**
 * Timezone utility for automatic device timezone detection
 * Uses the browser's Intl API to detect the user's local timezone
 */

/**
 * Detect the user's timezone from the device
 * Returns the IANA timezone identifier (e.g., 'Africa/Nairobi')
 */
export function detectDeviceTimezone(): string {
  try {
    // Use Intl API to get the locale's timezone
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch (error) {
    console.warn('Failed to detect timezone:', error)
    return 'UTC'
  }
}

/**
 * Get the current time formatted for a specific timezone
 */
export function getTimeInTimezone(timezone: string, date: Date = new Date()): string {
  try {
    return date.toLocaleString('en-US', { timeZone: timezone })
  } catch {
    return date.toLocaleString()
  }
}

/**
 * Convert a date to another timezone
 */
export function convertToTimezone(date: Date, timezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    
    const parts = formatter.formatToParts(date)
    const values: { [key: string]: string } = {}
    
    for (const part of parts) {
      if (part.type !== 'literal') {
        values[part.type] = part.value
      }
    }
    
    return new Date(
      parseInt(values.year),
      parseInt(values.month) - 1,
      parseInt(values.day),
      parseInt(values.hour),
      parseInt(values.minute),
      parseInt(values.second)
    )
  } catch (error) {
    console.warn('Failed to convert timezone:', error)
    return date
  }
}

/**
 * List of common timezone options (can be expanded)
 */
export const COMMON_TIMEZONES = [
  'Africa/Nairobi',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
]

/**
 * Store timezone preference in localStorage
 */
export function setStoredTimezone(timezone: string): void {
  try {
    localStorage.setItem('user_timezone', timezone)
  } catch (error) {
    console.warn('Failed to store timezone:', error)
  }
}

/**
 * Get timezone from localStorage or detect automatically
 */
export function getStoredOrDetectedTimezone(): string {
  try {
    const stored = localStorage.getItem('user_timezone')
    if (stored) return stored
  } catch (error) {
    console.warn('Failed to retrieve stored timezone:', error)
  }
  
  return detectDeviceTimezone()
}
