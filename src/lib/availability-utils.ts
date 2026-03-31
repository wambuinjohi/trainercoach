import { getNowInTimezone, convertToTimezone } from './timezone'

/**
 * Check if a trainer is available right now based on their schedule
 * @param trainer Trainer object with availability and timezone
 * @returns true if trainer is available at the current time, false otherwise
 */
export function isTrainerAvailableNow(trainer: any): boolean {
  // If no availability schedule is set, assume they're available if the boolean flag is true
  if (!trainer.availability) {
    return trainer.available !== false && trainer.is_available !== false
  }

  // Parse availability if it's a string
  let availability = trainer.availability
  if (typeof availability === 'string') {
    try {
      availability = JSON.parse(availability)
    } catch {
      // If parsing fails, fall back to boolean flag
      return trainer.available !== false && trainer.is_available !== false
    }
  }

  if (!availability || typeof availability !== 'object') {
    return trainer.available !== false && trainer.is_available !== false
  }

  // Get current time in trainer's timezone (default to UTC if no timezone is set)
  const trainerTimezone = trainer.timezone || 'UTC'
  const now = getNowInTimezone(trainerTimezone)

  // Get current day name (lowercase)
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

  // Get slots for today
  const todaySlots = availability[dayName]
  if (!Array.isArray(todaySlots) || todaySlots.length === 0) {
    // No availability today
    return false
  }

  // Get current time in HH:MM format
  const currentHours = String(now.getHours()).padStart(2, '0')
  const currentMinutes = String(now.getMinutes()).padStart(2, '0')
  const currentTimeStr = `${currentHours}:${currentMinutes}`
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes()

  // Check if current time falls within any of today's slots
  for (const slot of todaySlots) {
    if (typeof slot !== 'string') continue

    const [startTime, endTime] = slot.split('-')
    if (!startTime || !endTime) continue

    const [startHours, startMins] = startTime.split(':').map(Number)
    const [endHours, endMins] = endTime.split(':').map(Number)

    const startMinutes = startHours * 60 + startMins
    const endMinutes = endHours * 60 + endMins

    // Check if current time is within this slot
    if (currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes) {
      return true
    }
  }

  return false
}

/**
 * Get the next available time slot for a trainer
 * @param trainer Trainer object with availability and timezone
 * @returns Object with nextDate and nextTimeSlot, or null if no upcoming slots
 */
export function getNextAvailableSlot(trainer: any): { nextDate: string, nextTimeSlot: string } | null {
  // If no availability schedule, return null
  if (!trainer.availability || typeof trainer.availability !== 'object') {
    return null
  }

  const trainerTimezone = trainer.timezone || 'UTC'
  const now = getNowInTimezone(trainerTimezone)
  const currentDayIndex = now.getDay()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  // Check next 14 days for availability
  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    const checkDate = new Date(now)
    checkDate.setDate(checkDate.getDate() + daysAhead)

    const dayName = dayNames[checkDate.getDay()]
    const slots = trainer.availability[dayName]

    if (Array.isArray(slots) && slots.length > 0) {
      // For today, only return slots that haven't passed yet
      if (daysAhead === 0) {
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes()
        const upcomingSlots = slots.filter((slot: string) => {
          const [startTime] = slot.split('-')
          if (!startTime) return false
          const [startHours, startMins] = startTime.split(':').map(Number)
          const startMinutes = startHours * 60 + startMins
          return startMinutes > currentTimeMinutes
        })

        if (upcomingSlots.length > 0) {
          return {
            nextDate: checkDate.toISOString().split('T')[0],
            nextTimeSlot: upcomingSlots[0]
          }
        }
      } else {
        // For future days, return the first slot
        return {
          nextDate: checkDate.toISOString().split('T')[0],
          nextTimeSlot: slots[0]
        }
      }
    }
  }

  return null
}

/**
 * Format availability status for display
 * @param trainer Trainer object with availability and timezone
 * @returns User-friendly availability status string
 */
export function getAvailabilityStatus(trainer: any): string {
  if (isTrainerAvailableNow(trainer)) {
    return 'Available Now'
  }

  const nextSlot = getNextAvailableSlot(trainer)
  if (nextSlot) {
    const date = new Date(nextSlot.nextDate)
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
    const [startTime] = nextSlot.nextTimeSlot.split('-')
    return `Next: ${dayName} at ${startTime}`
  }

  return 'Not Available'
}
