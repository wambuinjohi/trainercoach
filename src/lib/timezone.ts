/**
 * Timezone utility for automatic device timezone detection
 * Uses the browser's Intl API to detect the user's local timezone
 * Automatically stores and retrieves user timezone preference
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
 * Format a date in a specific timezone
 */
export function formatInTimezone(
  date: Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      ...options,
    })
    return formatter.format(date)
  } catch (error) {
    console.warn('Failed to format date in timezone:', error)
    return date.toString()
  }
}

/**
 * Get current time in a specific timezone
 */
export function getNowInTimezone(timezone: string): Date {
  return convertToTimezone(new Date(), timezone)
}

/**
 * Get the offset hours from UTC for a given timezone
 */
export function getTimezoneOffsetHours(timezone: string): number {
  const now = new Date()
  try {
    const utcString = now.toLocaleString('en-US', { timeZone: 'UTC' })
    const tzString = now.toLocaleString('en-US', { timeZone: timezone })

    const utcDate = new Date(utcString)
    const tzDate = new Date(tzString)

    return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60 * 60)
  } catch (error) {
    console.warn('Failed to get timezone offset:', error)
    return 0
  }
}

/**
 * List of common timezone options with labels
 */
export const COMMON_TIMEZONES = [
  { value: 'Africa/Nairobi', label: 'Nairobi (Kenya)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (South Africa)' },
  { value: 'Africa/Lagos', label: 'Lagos (Nigeria)' },
  { value: 'Africa/Cairo', label: 'Cairo (Egypt)' },
  { value: 'Asia/Dubai', label: 'Dubai (UAE)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (Thailand)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Tokyo', label: 'Tokyo (Japan)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (China)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Kolkata', label: 'India' },
  { value: 'Australia/Sydney', label: 'Sydney (Australia)' },
  { value: 'Europe/London', label: 'London (UK)' },
  { value: 'Europe/Paris', label: 'Paris (France)' },
  { value: 'Europe/Berlin', label: 'Berlin (Germany)' },
  { value: 'Europe/Moscow', label: 'Moscow (Russia)' },
  { value: 'America/New_York', label: 'New York (USA)' },
  { value: 'America/Chicago', label: 'Chicago (USA)' },
  { value: 'America/Denver', label: 'Denver (USA)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (USA)' },
  { value: 'America/Toronto', label: 'Toronto (Canada)' },
  { value: 'America/Mexico_City', label: 'Mexico City (Mexico)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (Brazil)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (Argentina)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
]

/**
 * Get timezone label from value
 */
export function getTimezoneLabel(timezone: string): string {
  const found = COMMON_TIMEZONES.find(tz => tz.value === timezone)
  return found?.label || timezone
}

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

/**
 * Initialize automatic timezone detection on app load
 * Detects and stores the user's timezone once
 */
export function initializeTimezoneDetection(): string {
  const timezone = getStoredOrDetectedTimezone()
  console.log('User timezone initialized:', timezone)
  return timezone
}
