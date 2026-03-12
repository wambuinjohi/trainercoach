/**
 * Centralized configuration for admin panel
 * Contains all hardcoded constants, mappings, and defaults
 */

import { Users, UserCheck, AlertCircle, TrendingUp, MessageSquare, DollarSign, Plus, Clock, Calendar, Settings, FileCheck, CreditCard } from 'lucide-react'

// ============================================================================
// SIDEBAR NAVIGATION ITEMS
// ============================================================================

export const ADMIN_SIDEBAR_ITEMS = [
  { key: 'overview', label: 'Overview', icon: Users },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'approvals', label: 'Approvals', icon: UserCheck },
  { key: 'document-review', label: 'Document Review', icon: FileCheck },
  { key: 'disputes', label: 'Disputes', icon: AlertCircle },
  { key: 'issues', label: 'Issues', icon: MessageSquare },
  { key: 'contacts', label: 'Contacts', icon: MessageSquare },
  { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  { key: 'promotions', label: 'Promotions', icon: MessageSquare },
  { key: 'payouts', label: 'Payouts', icon: DollarSign },
  { key: 'sms-manager', label: 'SMS Manager', icon: MessageSquare },
  { key: 'categories', label: 'Categories', icon: Plus },
  { key: 'bookings', label: 'Bookings', icon: Calendar },
  { key: 'waitlist', label: 'Waiting List', icon: Clock },
  { key: 'mpesa', label: 'M-Pesa Settings', icon: CreditCard },
  { key: 'settings', label: 'Settings', icon: Settings },
]

// ============================================================================
// SMS MANAGER CONFIGURATION
// ============================================================================

export const SMS_EVENT_TYPES = ['registration', 'payment', 'booking', 'payout', 'custom'] as const

// ============================================================================
// PLATFORM SETTINGS OPTIONS
// ============================================================================

export const CURRENCY_OPTIONS = [
  { value: 'KES', label: 'KES' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
] as const

export const TIMEZONE_OPTIONS = [
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'Europe/London', label: 'Europe/London' },
] as const

export const PAYOUT_SCHEDULE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
] as const

// ============================================================================
// ANNOUNCEMENT TARGET OPTIONS
// ============================================================================

export const ANNOUNCEMENT_TARGETS = [
  { value: 'all', label: 'All users' },
  { value: 'clients', label: 'Clients' },
  { value: 'trainers', label: 'Trainers' },
  { value: 'admins', label: 'Admins' },
] as const

// ============================================================================
// USER TYPE STYLING
// ============================================================================

export const USER_TYPE_COLORS = {
  trainer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  client: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
} as const

// ============================================================================
// ISSUE STATUS COLORS
// ============================================================================

export const ISSUE_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  investigating: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
} as const

// ============================================================================
// ACTIVITY TONE COLORS
// ============================================================================

export const ACTIVITY_TONE_COLORS = {
  positive: 'bg-blue-500',
  neutral: 'bg-blue-500',
  alert: 'bg-yellow-500',
} as const

// ============================================================================
// CHART COLORS
// ============================================================================

export const CHART_COLORS = {
  revenue: '#3b82f6',
  bookings: '#8b5cf6',
  primary: '#ef4444',
} as const
