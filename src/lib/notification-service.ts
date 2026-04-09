/**
 * Notification Service - Centralized notification creation and management
 * Handles notifications for client, trainer, and admin journeys
 */

import { apiRequest, withAuth } from '@/lib/api'
import type { Notification, NotificationType, NotificationAction } from '@/types'

export interface NotificationPayload {
  userId: string
  title: string
  body: string
  type: NotificationType
  actionType?: NotificationAction
  bookingId?: string
  actionData?: Record<string, any>
  read?: boolean
}

/**
 * Insert a single notification
 */
export async function createNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    const notificationRecord = {
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      action_type: payload.actionType,
      booking_id: payload.bookingId || null,
      action_data: payload.actionData || {},
      read: payload.read ?? false,
      created_at: new Date().toISOString(),
    }

    await apiRequest('notifications_insert', { notifications: [notificationRecord] }, { headers: withAuth() })
    return true
  } catch (error) {
    console.warn('Failed to create notification:', error)
    return false
  }
}

/**
 * Insert multiple notifications at once
 */
export async function createNotifications(notifications: NotificationPayload[]): Promise<boolean> {
  if (notifications.length === 0) return true

  try {
    const notificationRecords = notifications.map(payload => ({
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      action_type: payload.actionType,
      booking_id: payload.bookingId || null,
      action_data: payload.actionData || {},
      read: payload.read ?? false,
      created_at: new Date().toISOString(),
    }))

    await apiRequest('notifications_insert', { notifications: notificationRecords }, { headers: withAuth() })
    return true
  } catch (error) {
    console.warn('Failed to create notifications:', error)
    return false
  }
}

/**
 * Booking Creation Notifications
 * Sent to: client, trainer, all admins
 */
export async function notifyBookingCreated(
  bookingId: string,
  clientId: string,
  trainerId: string,
  trainerName: string,
  sessionDate: string,
  sessionTime: string,
  clientEmail?: string
): Promise<boolean> {
  const notifications: NotificationPayload[] = [
    {
      userId: clientId,
      title: 'Booking submitted',
      body: `Your session request for ${sessionDate} at ${sessionTime} has been created. Use in-app chat for safe communication and complaint follow-up.`,
      type: 'booking',
      actionType: 'booking_created',
      bookingId,
    },
    {
      userId: trainerId,
      title: 'New booking request',
      body: `A client requested a session for ${sessionDate} at ${sessionTime}. Please review and respond in-app.`,
      type: 'booking',
      actionType: 'view_booking',
      bookingId,
    },
  ]

  // Try to notify all admins
  try {
    const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
    if (admins && Array.isArray(admins)) {
      for (const admin of admins) {
        notifications.push({
          userId: admin.user_id,
          title: 'New booking',
          body: `Booking from ${clientEmail || clientId} to trainer ${trainerName || trainerId} for ${sessionDate} at ${sessionTime}.`,
          type: 'booking',
          actionType: 'view_booking',
          bookingId,
        })
      }
    }
  } catch (error) {
    console.warn('Failed to fetch admins for notification:', error)
  }

  return createNotifications(notifications)
}

/**
 * Payment Completion Notifications
 * Sent to: trainer, admins
 */
export async function notifyPaymentCompleted(
  bookingId: string,
  trainerUserId: string,
  trainerName: string,
  amount: number,
  clientEmail?: string
): Promise<boolean> {
  const notifications: NotificationPayload[] = [
    {
      userId: trainerUserId,
      title: 'Payment received',
      body: `Payment of KES ${amount} for booking has been received. Session is confirmed.`,
      type: 'payment',
      actionType: 'payment_completed',
      bookingId,
    },
  ]

  // Notify admins
  try {
    const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
    if (admins && Array.isArray(admins)) {
      for (const admin of admins) {
        notifications.push({
          userId: admin.user_id,
          title: 'Payment completed',
          body: `Payment of KES ${amount} completed for booking with ${trainerName || 'trainer'}.`,
          type: 'payment',
          actionType: 'payment_completed',
          bookingId,
        })
      }
    }
  } catch (error) {
    console.warn('Failed to notify admins of payment:', error)
  }

  return createNotifications(notifications)
}

/**
 * Session Started Notification
 * Sent to: client (when trainer confirms start)
 */
export async function notifySessionStarted(
  bookingId: string,
  clientUserId: string,
  trainerName: string
): Promise<boolean> {
  return createNotification({
    userId: clientUserId,
    title: 'Session started',
    body: `Your session with ${trainerName} has started. Please stay available until the trainer confirms completion.`,
    type: 'session',
    actionType: 'session_started',
    bookingId,
  })
}

/**
 * Session End Confirmation Request
 * Sent to: client (when trainer marks end)
 */
export async function notifySessionEndConfirmation(
  bookingId: string,
  clientUserId: string,
  trainerName: string
): Promise<boolean> {
  return createNotification({
    userId: clientUserId,
    title: 'Confirm session completion',
    body: `${trainerName} has marked the session as completed. Please confirm that you received the service.`,
    type: 'session',
    actionType: 'awaiting_completion',
    bookingId,
  })
}

/**
 * Session Completed Notification
 * Sent to: trainer (when client confirms completion)
 */
export async function notifySessionCompleted(
  bookingId: string,
  trainerUserId: string,
  clientName: string
): Promise<boolean> {
  return createNotification({
    userId: trainerUserId,
    title: 'Session completed',
    body: `Your session with ${clientName} has been completed and confirmed. Thank you for delivering great service!`,
    type: 'session',
    actionType: 'session_completed',
    bookingId,
  })
}

/**
 * Review Request Notification
 * Sent to: client (after session completion)
 */
export async function notifyReviewRequested(
  bookingId: string,
  clientUserId: string,
  trainerName: string
): Promise<boolean> {
  return createNotification({
    userId: clientUserId,
    title: 'Please review your session',
    body: `Help us improve by rating and reviewing your session with ${trainerName}. Your feedback helps other clients find great trainers.`,
    type: 'review',
    actionType: 'review_requested',
    bookingId,
  })
}

/**
 * Review Submitted Notification
 * Sent to: trainer, admins (when client submits review)
 */
export async function notifyReviewSubmitted(
  bookingId: string,
  trainerUserId: string,
  rating: number,
  comment?: string
): Promise<boolean> {
  const notifications: NotificationPayload[] = [
    {
      userId: trainerUserId,
      title: `You received a ${rating}-star review`,
      body: comment || `A client left you a ${rating}-star review for your session.`,
      type: 'review',
      actionType: 'review_submitted',
      bookingId,
    },
  ]

  // Notify admins
  try {
    const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
    if (admins && Array.isArray(admins)) {
      for (const admin of admins) {
        notifications.push({
          userId: admin.user_id,
          title: 'New review submitted',
          body: `A ${rating}-star review was submitted for a booking.`,
          type: 'review',
          actionType: 'review_submitted',
          bookingId,
        })
      }
    }
  } catch (error) {
    console.warn('Failed to notify admins of review:', error)
  }

  return createNotifications(notifications)
}

/**
 * Document Upload Reminder
 * Sent to: trainer (to upload verification documents)
 */
export async function notifyDocumentUploadRequired(
  trainerUserId: string,
  documentTypes: string[]
): Promise<boolean> {
  return createNotification({
    userId: trainerUserId,
    title: 'Complete your verification',
    body: `Please upload the required documents (${documentTypes.join(', ')}) to activate your account and start accepting bookings.`,
    type: 'document',
    actionType: 'upload_documents',
  })
}

/**
 * Document Approval Notification
 * Sent to: trainer (when admin approves a document)
 */
export async function notifyDocumentApproved(
  trainerUserId: string,
  documentType: string
): Promise<boolean> {
  return createNotification({
    userId: trainerUserId,
    title: 'Document approved',
    body: `Your ${documentType} has been verified and approved. Continue uploading any remaining documents to complete your profile.`,
    type: 'document',
    actionType: 'document_approved',
  })
}

/**
 * Document Rejection Notification
 * Sent to: trainer (when admin rejects a document)
 */
export async function notifyDocumentRejected(
  trainerUserId: string,
  documentType: string,
  reason?: string
): Promise<boolean> {
  return createNotification({
    userId: trainerUserId,
    title: 'Document rejected',
    body: `Your ${documentType} was rejected${reason ? `: ${reason}` : ''}. Please upload a replacement.`,
    type: 'document',
    actionType: 'document_rejected',
  })
}

/**
 * Trainer Approval Notification
 * Sent to: trainer (when admin fully approves the account)
 */
export async function notifyTrainerApproved(
  trainerUserId: string,
  trainerName: string
): Promise<boolean> {
  return createNotification({
    userId: trainerUserId,
    title: 'Account approved',
    body: `Congratulations ${trainerName}! Your account has been approved. You can now start accepting bookings and earning.`,
    type: 'approval',
    actionType: 'trainer_approved',
  })
}

/**
 * New Message Notification
 * Sent to: recipient of message (trainer or client)
 */
export async function notifyNewMessage(
  recipientUserId: string,
  senderName: string,
  messagePreview?: string
): Promise<boolean> {
  return createNotification({
    userId: recipientUserId,
    title: `Message from ${senderName}`,
    body: messagePreview || `${senderName} sent you a message. Open the app to view it.`,
    type: 'chat',
    actionType: 'new_message',
  })
}

/**
 * Issue/Dispute Report Notification
 * Sent to: admins (when a user reports an issue)
 */
export async function notifyIssueReported(
  reportedByUserId: string,
  reportedByName: string,
  issueTitle: string,
  bookingId?: string
): Promise<boolean> {
  try {
    const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
    if (!admins || !Array.isArray(admins)) {
      return false
    }

    const notifications: NotificationPayload[] = admins.map(admin => ({
      userId: admin.user_id,
      title: 'Issue reported',
      body: `${reportedByName} reported an issue: "${issueTitle}". Please review and take action.`,
      type: 'dispute',
      actionType: 'issue_reported',
      bookingId,
    }))

    return createNotifications(notifications)
  } catch (error) {
    console.warn('Failed to notify admins of issue:', error)
    return false
  }
}

/**
 * Dispute Resolution Notification
 * Sent to: affected parties (client and trainer)
 */
export async function notifyDisputeResolved(
  clientUserId: string,
  trainerUserId: string,
  resolution: string,
  reason?: string
): Promise<boolean> {
  const notifications: NotificationPayload[] = [
    {
      userId: clientUserId,
      title: 'Dispute resolved',
      body: `Your dispute has been resolved. Resolution: ${resolution}${reason ? ` - ${reason}` : ''}. Thank you for your patience.`,
      type: 'dispute',
      actionType: 'dispute_resolved',
    },
    {
      userId: trainerUserId,
      title: 'Dispute resolved',
      body: `A dispute has been resolved. Resolution: ${resolution}${reason ? ` - ${reason}` : ''}. Thank you for your cooperation.`,
      type: 'dispute',
      actionType: 'dispute_resolved',
    },
  ]

  return createNotifications(notifications)
}

/**
 * System Announcement Notification
 * Sent to: specified user (or all users if userId is null)
 */
export async function notifySystemAnnouncement(
  title: string,
  body: string,
  userIds?: string[]
): Promise<boolean> {
  if (!userIds || userIds.length === 0) {
    console.warn('System announcement requires at least one user ID')
    return false
  }

  const notifications: NotificationPayload[] = userIds.map(userId => ({
    userId,
    title,
    body,
    type: 'system',
    actionType: 'system_announcement',
  }))

  return createNotifications(notifications)
}
