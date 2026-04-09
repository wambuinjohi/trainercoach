import { apiRequest, withAuth } from './api'

export interface SessionReminder {
  id?: string
  booking_id: string
  trainer_id: string
  client_id: string
  reminder_type: '2hour'
  scheduled_for: string // ISO datetime when reminder should be sent
  sent_at?: string | null
  status: 'pending' | 'sent' | 'failed'
  created_at?: string
}

/**
 * Schedule a 2-hour pre-session reminder for a booking
 * Creates a reminder record that will be processed by the worker script
 * @param booking The booking object containing session_date, session_time, trainer_id, client_id, and id
 */
export async function scheduleSessionReminder(booking: any): Promise<void> {
  if (!booking?.id || !booking?.session_date || !booking?.session_time || !booking?.trainer_id || !booking?.client_id) {
    console.warn('Invalid booking data for reminder scheduling', booking)
    return
  }

  try {
    // Parse the session date and time to calculate reminder time (2 hours before)
    const sessionDateTime = new Date(`${booking.session_date}T${booking.session_time}`)
    if (isNaN(sessionDateTime.getTime())) {
      console.warn('Invalid session date/time format', booking.session_date, booking.session_time)
      return
    }

    // Calculate 2 hours before the session
    const reminderTime = new Date(sessionDateTime.getTime() - 2 * 60 * 60 * 1000)

    // Create reminder record
    const reminderRecord: SessionReminder = {
      booking_id: booking.id,
      trainer_id: booking.trainer_id,
      client_id: booking.client_id,
      reminder_type: '2hour',
      scheduled_for: reminderTime.toISOString(),
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    // Insert reminder into database
    await apiRequest('session_reminder_insert', { reminder: reminderRecord }, { headers: withAuth() })
    console.log('Session reminder scheduled for booking', booking.id, 'scheduled for', reminderTime)
  } catch (err) {
    console.error('Failed to schedule session reminder:', err)
  }
}

/**
 * Check if a reminder has already been scheduled for a booking
 * Useful to avoid duplicate reminders
 */
export async function getReminderStatus(bookingId: string): Promise<SessionReminder | null> {
  try {
    const result = await apiRequest('session_reminder_get', { booking_id: bookingId }, { headers: withAuth() })
    if (Array.isArray(result) && result.length > 0) {
      return result[0]
    }
    if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
      return result.data[0]
    }
    return null
  } catch (err) {
    console.warn('Failed to get reminder status:', err)
    return null
  }
}

/**
 * Cancel a scheduled reminder
 */
export async function cancelReminder(bookingId: string): Promise<void> {
  try {
    await apiRequest('session_reminder_cancel', { booking_id: bookingId }, { headers: withAuth() })
    console.log('Session reminder cancelled for booking', bookingId)
  } catch (err) {
    console.error('Failed to cancel reminder:', err)
  }
}
