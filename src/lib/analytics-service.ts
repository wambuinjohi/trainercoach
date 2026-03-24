/**
 * Analytics Service - Centralized analytics and reporting queries
 * Handles metrics for admin dashboard and reporting
 */

import { apiRequest, withAuth } from '@/lib/api'
import type { BookingStatus, AccountStatus } from '@/types'

export interface BookingMetrics {
  total: number
  byStatus: Record<BookingStatus, number>
  pending: number
  confirmed: number
  inSession: number
  completed: number
  cancelled: number
  clientNoShow: number
}

export interface UserMetrics {
  totalClients: number
  totalTrainers: number
  totalAdmins: number
  newClientsToday: number
  newTrainersToday: number
  newClientsThisWeek: number
  newTrainersThisWeek: number
}

export interface ApprovalMetrics {
  totalPending: number
  totalApproved: number
  totalRejected: number
  totalSuspended: number
  approvalRate: number // percentage of trainers approved
  avgDaysToApproval: number // average days from signup to approval
}

export interface TrainerMetrics {
  totalTrainers: number
  approvedTrainers: number
  pendingApprovalTrainers: number
  suspendedTrainers: number
  activeTrainers: number // approved and have completed bookings in last 30 days
}

export interface RevenueMetrics {
  totalRevenue: number
  totalPayouts: number
  totalRefunds: number
  netRevenue: number // revenue - payouts - refunds
  averageBookingValue: number
  lastUpdated: string
}

export interface ActivityEvent {
  id: string
  eventType: 'booking_created' | 'payment_completed' | 'session_started' | 'session_completed' | 'review_submitted' | 'trainer_approved' | 'dispute_created' | 'dispute_resolved'
  userId: string
  relatedUserId?: string // trainer or client involved
  bookingId?: string
  metadata?: Record<string, any>
  timestamp: string
}

export interface PendingSessionsMetrics {
  awaitingClientConfirmation: number
  awaitingTrainerStart: number
  total: number
}

/**
 * Get booking status distribution
 */
export async function getBookingMetrics(): Promise<BookingMetrics | null> {
  try {
    const bookings = await apiRequest('select', {
      table: 'bookings',
      columns: 'status, COUNT(*) as count',
      group_by: 'status',
    }, { headers: withAuth() })

    if (!bookings || !Array.isArray(bookings)) {
      return null
    }

    const metrics: BookingMetrics = {
      total: 0,
      byStatus: {
        pending: 0,
        confirmed: 0,
        in_session: 0,
        completed: 0,
        cancelled: 0,
        client_no_show: 0,
      },
      pending: 0,
      confirmed: 0,
      inSession: 0,
      completed: 0,
      cancelled: 0,
      clientNoShow: 0,
    }

    for (const row of bookings) {
      const count = parseInt(row.count || 0)
      metrics.total += count

      if (row.status === 'pending') metrics.pending = count
      else if (row.status === 'confirmed') metrics.confirmed = count
      else if (row.status === 'in_session') metrics.inSession = count
      else if (row.status === 'completed') metrics.completed = count
      else if (row.status === 'cancelled') metrics.cancelled = count
      else if (row.status === 'client_no_show') metrics.clientNoShow = count

      metrics.byStatus[row.status as BookingStatus] = count
    }

    return metrics
  } catch (error) {
    console.error('Failed to get booking metrics:', error)
    return null
  }
}

/**
 * Get user signup metrics
 */
export async function getUserMetrics(): Promise<UserMetrics | null> {
  try {
    // Get total counts by type
    const userTypeCounts = await apiRequest('select', {
      table: 'users',
      columns: 'user_type, COUNT(*) as count',
      group_by: 'user_type',
    }, { headers: withAuth() })

    // Get new signups today and this week
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const newToday = await apiRequest('select', {
      table: 'users',
      columns: 'user_type, COUNT(*) as count',
      where: `DATE(created_at) = '${today}'`,
      group_by: 'user_type',
    }, { headers: withAuth() })

    const newThisWeek = await apiRequest('select', {
      table: 'users',
      columns: 'user_type, COUNT(*) as count',
      where: `DATE(created_at) >= '${weekAgo}'`,
      group_by: 'user_type',
    }, { headers: withAuth() })

    const metrics: UserMetrics = {
      totalClients: 0,
      totalTrainers: 0,
      totalAdmins: 0,
      newClientsToday: 0,
      newTrainersToday: 0,
      newClientsThisWeek: 0,
      newTrainersThisWeek: 0,
    }

    // Process total counts
    if (userTypeCounts && Array.isArray(userTypeCounts)) {
      for (const row of userTypeCounts) {
        const count = parseInt(row.count || 0)
        if (row.user_type === 'client') metrics.totalClients = count
        else if (row.user_type === 'trainer') metrics.totalTrainers = count
        else if (row.user_type === 'admin') metrics.totalAdmins = count
      }
    }

    // Process new today
    if (newToday && Array.isArray(newToday)) {
      for (const row of newToday) {
        const count = parseInt(row.count || 0)
        if (row.user_type === 'client') metrics.newClientsToday = count
        else if (row.user_type === 'trainer') metrics.newTrainersToday = count
      }
    }

    // Process new this week
    if (newThisWeek && Array.isArray(newThisWeek)) {
      for (const row of newThisWeek) {
        const count = parseInt(row.count || 0)
        if (row.user_type === 'client') metrics.newClientsThisWeek = count
        else if (row.user_type === 'trainer') metrics.newTrainersThisWeek = count
      }
    }

    return metrics
  } catch (error) {
    console.error('Failed to get user metrics:', error)
    return null
  }
}

/**
 * Get trainer approval funnel metrics
 */
export async function getApprovalMetrics(): Promise<ApprovalMetrics | null> {
  try {
    const trainerStats = await apiRequest('select', {
      table: 'user_profiles',
      columns: 'account_status, COUNT(*) as count',
      where: "user_type = 'trainer'",
      group_by: 'account_status',
    }, { headers: withAuth() })

    if (!trainerStats || !Array.isArray(trainerStats)) {
      return null
    }

    let totalPending = 0
    let totalApproved = 0
    let totalRejected = 0
    let totalSuspended = 0
    let totalTrainers = 0

    for (const row of trainerStats) {
      const count = parseInt(row.count || 0)
      totalTrainers += count

      if (row.account_status === 'pending_approval') totalPending = count
      else if (row.account_status === 'approved') totalApproved = count
      // Rejected is not a standard status, but handling it
      else if (row.account_status === 'suspended') totalSuspended = count
    }

    const approvalRate = totalTrainers > 0 ? (totalApproved / totalTrainers) * 100 : 0

    // Calculate average days to approval (simplified - uses sample of recent approvals)
    let avgDaysToApproval = 0
    try {
      const approvedTrainers = await apiRequest('select', {
        table: 'user_profiles',
        columns: 'DATEDIFF(updated_at, created_at) as days_to_approval',
        where: "user_type = 'trainer' AND account_status = 'approved'",
        limit: '1000',
      }, { headers: withAuth() })

      if (approvedTrainers && Array.isArray(approvedTrainers) && approvedTrainers.length > 0) {
        const totalDays = approvedTrainers.reduce((sum, row) => sum + (parseInt(row.days_to_approval) || 0), 0)
        avgDaysToApproval = Math.round(totalDays / approvedTrainers.length)
      }
    } catch {
      // If calculation fails, just use 0
    }

    return {
      totalPending,
      totalApproved,
      totalRejected,
      totalSuspended,
      approvalRate,
      avgDaysToApproval,
    }
  } catch (error) {
    console.error('Failed to get approval metrics:', error)
    return null
  }
}

/**
 * Get trainer-specific metrics
 */
export async function getTrainerMetrics(): Promise<TrainerMetrics | null> {
  try {
    const trainerStats = await apiRequest('select', {
      table: 'user_profiles',
      columns: 'account_status, COUNT(*) as count',
      where: "user_type = 'trainer'",
      group_by: 'account_status',
    }, { headers: withAuth() })

    if (!trainerStats || !Array.isArray(trainerStats)) {
      return null
    }

    let totalTrainers = 0
    let approvedTrainers = 0
    let pendingApprovalTrainers = 0
    let suspendedTrainers = 0

    for (const row of trainerStats) {
      const count = parseInt(row.count || 0)
      totalTrainers += count

      if (row.account_status === 'approved') approvedTrainers = count
      else if (row.account_status === 'pending_approval') pendingApprovalTrainers = count
      else if (row.account_status === 'suspended') suspendedTrainers = count
    }

    // Get active trainers (approved + completed at least one session in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const activeTrainers = await apiRequest('select', {
      table: 'bookings',
      columns: 'COUNT(DISTINCT trainer_id) as count',
      where: `status = 'completed' AND completed_at >= '${thirtyDaysAgo}'`,
    }, { headers: withAuth() })

    const activeCount = (activeTrainers && Array.isArray(activeTrainers) && activeTrainers[0])
      ? parseInt(activeTrainers[0].count || 0)
      : 0

    return {
      totalTrainers,
      approvedTrainers,
      pendingApprovalTrainers,
      suspendedTrainers,
      activeTrainers: activeCount,
    }
  } catch (error) {
    console.error('Failed to get trainer metrics:', error)
    return null
  }
}

/**
 * Get revenue metrics
 */
export async function getRevenueMetrics(): Promise<RevenueMetrics | null> {
  try {
    // Get total revenue from completed payments
    const payments = await apiRequest('select', {
      table: 'payments',
      columns: 'COALESCE(SUM(amount), 0) as total',
      where: "status = 'completed'",
    }, { headers: withAuth() })

    const totalRevenue = (payments && Array.isArray(payments) && payments[0])
      ? parseFloat(payments[0].total || 0)
      : 0

    // Get total payouts
    const payouts = await apiRequest('select', {
      table: 'payout_requests',
      columns: 'COALESCE(SUM(amount), 0) as total',
      where: "status = 'completed'",
    }, { headers: withAuth() })

    const totalPayouts = (payouts && Array.isArray(payouts) && payouts[0])
      ? parseFloat(payouts[0].total || 0)
      : 0

    // Get total refunds
    const refunds = await apiRequest('select', {
      table: 'payments',
      columns: 'COALESCE(SUM(amount), 0) as total',
      where: "status = 'refunded'",
    }, { headers: withAuth() })

    const totalRefunds = (refunds && Array.isArray(refunds) && refunds[0])
      ? parseFloat(refunds[0].total || 0)
      : 0

    // Get average booking value
    const avgBooking = await apiRequest('select', {
      table: 'bookings',
      columns: 'COALESCE(AVG(total_amount), 0) as average',
      where: "status = 'completed'",
    }, { headers: withAuth() })

    const averageBookingValue = (avgBooking && Array.isArray(avgBooking) && avgBooking[0])
      ? parseFloat(avgBooking[0].average || 0)
      : 0

    const netRevenue = totalRevenue - totalPayouts - totalRefunds

    return {
      totalRevenue,
      totalPayouts,
      totalRefunds,
      netRevenue,
      averageBookingValue,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Failed to get revenue metrics:', error)
    return null
  }
}

/**
 * Get pending sessions metrics
 */
export async function getPendingSessionsMetrics(): Promise<PendingSessionsMetrics | null> {
  try {
    const pendingSessions = await apiRequest('select', {
      table: 'bookings',
      columns: 'session_phase, COUNT(*) as count',
      where: "status = 'in_session'",
      group_by: 'session_phase',
    }, { headers: withAuth() })

    if (!pendingSessions || !Array.isArray(pendingSessions)) {
      return {
        awaitingClientConfirmation: 0,
        awaitingTrainerStart: 0,
        total: 0,
      }
    }

    let awaitingClientConfirmation = 0
    let awaitingTrainerStart = 0

    for (const row of pendingSessions) {
      const count = parseInt(row.count || 0)
      if (row.session_phase === 'awaiting_completion') awaitingClientConfirmation = count
      else if (row.session_phase === 'waiting_start') awaitingTrainerStart = count
    }

    return {
      awaitingClientConfirmation,
      awaitingTrainerStart,
      total: awaitingClientConfirmation + awaitingTrainerStart,
    }
  } catch (error) {
    console.error('Failed to get pending sessions metrics:', error)
    return null
  }
}

/**
 * Get activity feed - real event log
 * Returns recent activity events across the system
 */
export async function getActivityFeed(limit: number = 50): Promise<ActivityEvent[] | null> {
  try {
    // Try to fetch from an activity_log table if it exists
    // This is a normalized audit log table
    const activities = await apiRequest('select', {
      table: 'activity_log',
      columns: '*',
      order: 'timestamp DESC',
      limit: String(limit),
    }, { headers: withAuth() })

    if (activities && Array.isArray(activities)) {
      return activities.map(row => ({
        id: row.id,
        eventType: row.event_type,
        userId: row.user_id,
        relatedUserId: row.related_user_id,
        bookingId: row.booking_id,
        metadata: row.metadata,
        timestamp: row.timestamp,
      }))
    }

    return []
  } catch (error) {
    console.warn('Activity log not available, falling back to synthetic feed:', error)
    return null
  }
}

/**
 * Get comprehensive dashboard overview
 */
export async function getDashboardOverview() {
  const [bookingMetrics, userMetrics, approvalMetrics, revenueMetrics, pendingSessions] = await Promise.all([
    getBookingMetrics(),
    getUserMetrics(),
    getApprovalMetrics(),
    getRevenueMetrics(),
    getPendingSessionsMetrics(),
  ])

  return {
    bookings: bookingMetrics,
    users: userMetrics,
    approvals: approvalMetrics,
    revenue: revenueMetrics,
    pendingSessions,
  }
}
