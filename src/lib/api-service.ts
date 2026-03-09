import { apiRequest, withAuth } from './api'

// ============================================================================
// AUTHENTICATION SERVICES
// ============================================================================

export async function loginUser(email: string, password: string) {
  return apiRequest('login', { email, password })
}

export async function signupUser(
  email: string,
  password: string,
  userType: string,
  profile?: Record<string, any>
) {
  return apiRequest('signup', {
    email,
    password,
    user_type: userType,
    ...profile,
  })
}

export async function requestPasswordReset(email: string) {
  return apiRequest('request_password_reset', { email })
}

export async function resetPasswordWithToken(
  email: string,
  token: string,
  newPassword: string
) {
  return apiRequest('reset_password_with_token', {
    email,
    token,
    new_password: newPassword,
  })
}

export async function getUserType(userId: string) {
  return apiRequest('get_user_type', { user_id: userId })
}

// ============================================================================
// USER MANAGEMENT SERVICES
// ============================================================================

export async function getUsers() {
  const data = await apiRequest('get_users')
  // Handle both array and object responses
  return Array.isArray(data) ? data : data?.data || []
}

export async function getUserProfile(userId: string) {
  return apiRequest('select', {
    table: 'user_profiles',
    where: `user_id = '${userId}'`,
  })
}

export async function updateUserProfile(userId: string, data: Record<string, any>) {
  // Escape single quotes in userId for SQL safety
  const escapedUserId = userId.replace(/'/g, "''")
  const escapedWhere = `user_id = '${escapedUserId}'`
  return apiRequest('update', {
    table: 'user_profiles',
    data,
    where: escapedWhere,
  })
}

export async function deleteUser(userId: string) {
  return apiRequest('delete_user', { user_id: userId })
}

export async function updateUserType(userId: string, userType: string) {
  return apiRequest('update_user_type', { user_id: userId, user_type: userType })
}

export async function approveTrainer(userId: string) {
  return apiRequest('approve_trainer', { user_id: userId })
}

export async function rejectTrainer(userId: string) {
  return apiRequest('reject_trainer', { user_id: userId })
}

// ============================================================================
// CATEGORY SERVICES
// ============================================================================

export async function getCategories() {
  const data = await apiRequest('get_categories')
  // Wrap unwrapped response so callers can access .data property
  return Array.isArray(data) ? { data } : data
}

export async function addCategory(name: string, icon?: string, description?: string) {
  return apiRequest('add_category', {
    name,
    ...(icon && { icon }),
    ...(description && { description }),
  })
}

export async function updateCategory(
  id: string | number,
  data: Record<string, any>
) {
  return apiRequest('update_category', { id, ...data })
}

export async function deleteCategory(id: string | number) {
  return apiRequest('delete_category', { id })
}

// ============================================================================
// TRAINER CATEGORY SERVICES
// ============================================================================

export async function getTrainerCategories(trainerId: string) {
  return apiRequest('trainer_categories_get', { trainer_id: trainerId })
}

export async function addTrainerCategory(trainerId: string, categoryId: number) {
  return apiRequest('trainer_category_add', { trainer_id: trainerId, category_id: categoryId })
}

export async function removeTrainerCategory(trainerId: string, categoryId: number) {
  return apiRequest('trainer_category_remove', { trainer_id: trainerId, category_id: categoryId })
}

export async function setTrainerCategoryPricing(trainerId: string, categoryId: number, hourlyRate: number) {
  return apiRequest('trainer_category_pricing_set', { trainer_id: trainerId, category_id: categoryId, hourly_rate: hourlyRate })
}

export async function getTrainerCategoryPricing(trainerId: string) {
  return apiRequest('trainer_category_pricing_get', { trainer_id: trainerId })
}

export async function getTrainersByCategory(categoryId: number) {
  return apiRequest('trainers_by_category', { category_id: categoryId })
}

// ============================================================================
// GROUP TRAINING PRICING SERVICES
// ============================================================================

export async function setTrainerGroupPricing(
  trainerId: string,
  categoryId: number,
  pricingModel: 'fixed' | 'per_person',
  tiers: Array<{ group_size_name: string; min_size: number; max_size: number; rate: number }>
) {
  return apiRequest('trainer_group_pricing_set', {
    trainer_id: trainerId,
    category_id: categoryId,
    pricing_model: pricingModel,
    tiers: JSON.stringify(tiers),
  })
}

export async function getTrainerGroupPricing(trainerId: string, categoryId?: number) {
  return apiRequest('trainer_group_pricing_get', {
    trainer_id: trainerId,
    ...(categoryId && { category_id: categoryId }),
  })
}

export async function deleteTrainerGroupPricing(trainerId: string, categoryId: number) {
  return apiRequest('trainer_group_pricing_delete', {
    trainer_id: trainerId,
    category_id: categoryId,
  })
}

// ============================================================================
// BOOKING SERVICES
// ============================================================================

export async function createBooking(data: Record<string, any>) {
  return apiRequest('insert', {
    table: 'bookings',
    data,
  })
}

export async function getBookings(userId: string, userType: 'client' | 'trainer') {
  const column = userType === 'client' ? 'client_id' : 'trainer_id'
  return apiRequest('select', {
    table: 'bookings',
    where: `${column} = '${userId}'`,
    order: 'session_date DESC',
  })
}

export async function updateBooking(bookingId: string, data: Record<string, any>) {
  return apiRequest('update', {
    table: 'bookings',
    data,
    where: `id = '${bookingId}'`,
  })
}

export async function getBookingDetails(bookingId: string) {
  return apiRequest('select', {
    table: 'bookings',
    where: `id = '${bookingId}'`,
  })
}

export async function getAllBookings() {
  const data = await apiRequest('select', {
    table: 'bookings',
    order: 'created_at DESC',
  })
  // Handle both array and object responses
  return Array.isArray(data) ? data : data?.data || []
}

export async function getBookingsWithPagination(options?: { page?: number; pageSize?: number }) {
  const page = Math.max(1, options?.page || 1)
  const pageSize = Math.max(1, Math.min(100, options?.pageSize || 10))
  const offset = (page - 1) * pageSize

  return apiRequest('select', {
    table: 'bookings',
    order: 'created_at DESC',
    limit: pageSize,
    offset,
    count: 'exact',
  })
}

// ============================================================================
// TRAINER SERVICES
// ============================================================================


export async function getAvailableTrainers(filters?: Record<string, any>) {
  let where = `user_type = 'trainer' AND is_approved = 1`
  if (filters?.discipline) {
    where += ` AND disciplines LIKE '%${filters.discipline}%'`
  }
  if (filters?.maxRate) {
    where += ` AND hourly_rate <= ${filters.maxRate}`
  }
  return apiRequest('select', {
    table: 'user_profiles',
    where,
    order: 'rating DESC',
  })
}

export async function getTrainerProfile(trainerId: string) {
  return apiRequest('select', {
    table: 'user_profiles',
    where: `user_id = '${trainerId}'`,
  })
}

// ============================================================================
// AVAILABILITY SERVICES
// ============================================================================

export async function getAvailability(trainerId: string) {
  return apiRequest('select', {
    table: 'trainer_availability',
    where: `trainer_id = '${trainerId}'`,
  })
}

export async function setAvailability(trainerId: string, slots: any[]) {
  return apiRequest('insert', {
    table: 'trainer_availability',
    data: {
      trainer_id: trainerId,
      slots: JSON.stringify(slots),
    },
  })
}

export async function updateAvailability(trainerId: string, slots: any[]) {
  return apiRequest('update', {
    table: 'trainer_availability',
    data: {
      slots: JSON.stringify(slots),
      updated_at: new Date().toISOString(),
    },
    where: `trainer_id = '${trainerId}'`,
  })
}

// ============================================================================
// REVIEWS & RATINGS SERVICES
// ============================================================================

export async function getReviews(trainerId: string) {
  return apiRequest('select', {
    table: 'reviews',
    where: `trainer_id = '${trainerId}'`,
    order: 'created_at DESC',
  })
}

export async function addReview(data: Record<string, any>) {
  return apiRequest('insert', {
    table: 'reviews',
    data,
  })
}

export async function updateReview(reviewId: string, data: Record<string, any>) {
  return apiRequest('update', {
    table: 'reviews',
    data,
    where: `id = '${reviewId}'`,
  })
}

// ============================================================================
// PAYMENT SERVICES
// ============================================================================

export async function getPaymentMethods(userId: string) {
  return apiRequest('select', {
    table: 'payment_methods',
    where: `user_id = '${userId}'`,
  })
}

export async function addPaymentMethod(data: Record<string, any>) {
  return apiRequest('insert', {
    table: 'payment_methods',
    data,
  })
}

export async function deletePaymentMethod(methodId: string) {
  return apiRequest('delete', {
    table: 'payment_methods',
    where: `id = '${methodId}'`,
  })
}

// ============================================================================
// TRANSACTION & PAYOUT SERVICES
// ============================================================================

export async function getTransactions(userId: string, type?: 'income' | 'expense') {
  let where = `user_id = '${userId}'`
  if (type) {
    where += ` AND type = '${type}'`
  }
  return apiRequest('select', {
    table: 'transactions',
    where,
    order: 'created_at DESC',
  })
}

export async function getPayoutRequests(trainerId: string) {
  return apiRequest('select', {
    table: 'payout_requests',
    where: `trainer_id = '${trainerId}'`,
    order: 'created_at DESC',
  })
}

export async function requestPayout(trainerId: string, amount: number) {
  return apiRequest('insert', {
    table: 'payout_requests',
    data: {
      trainer_id: trainerId,
      amount,
      status: 'pending',
      requested_at: new Date().toISOString(),
    },
  })
}

// ============================================================================
// MESSAGE/CHAT SERVICES
// ============================================================================

export async function sendMessage(data: Record<string, any>) {
  return apiRequest('insert', {
    table: 'messages',
    data,
  })
}

export async function getMessages(userId: string) {
  return apiRequest('select', {
    table: 'messages',
    where: `sender_id = '${userId}' OR recipient_id = '${userId}'`,
    order: 'created_at DESC',
  })
}

export async function getConversation(userId1: string, userId2: string) {
  return apiRequest('select', {
    table: 'messages',
    where: `(sender_id = '${userId1}' AND recipient_id = '${userId2}') OR (sender_id = '${userId2}' AND recipient_id = '${userId1}')`,
    order: 'created_at ASC',
  })
}

// ============================================================================
// ISSUE REPORTING SERVICES
// ============================================================================

export async function reportIssue(data: Record<string, any>) {
  return apiRequest('insert', {
    table: 'reported_issues',
    data,
  })
}

export async function getIssues(filter?: Record<string, any>) {
  let where = '1=1'
  if (filter?.userId) {
    where += ` AND user_id = '${filter.userId}'`
  }
  if (filter?.trainerId) {
    where += ` AND trainer_id = '${filter.trainerId}'`
  }
  if (filter?.status) {
    where += ` AND status = '${filter.status}'`
  }
  return apiRequest('select', {
    table: 'reported_issues',
    where,
    order: 'created_at DESC',
  })
}

export async function getIssuesWithPagination(options?: {
  page?: number
  pageSize?: number
  status?: string
  userId?: string
  trainerId?: string
  searchQuery?: string
}) {
  const page = Math.max(1, options?.page || 1)
  const pageSize = Math.max(1, Math.min(100, options?.pageSize || 20))
  const offset = (page - 1) * pageSize

  let where = '1=1'
  if (options?.userId) {
    where += ` AND user_id = '${options.userId}'`
  }
  if (options?.trainerId) {
    where += ` AND trainer_id = '${options.trainerId}'`
  }
  if (options?.status) {
    where += ` AND status = '${options.status}'`
  }
  if (options?.searchQuery) {
    const query = options.searchQuery.replace(/'/g, "\\'")
    where += ` AND (description LIKE '%${query}%' OR complaint_type LIKE '%${query}%' OR title LIKE '%${query}%')`
  }

  return apiRequest('select', {
    table: 'reported_issues',
    where,
    order: 'created_at DESC',
    limit: pageSize,
    offset: offset,
    count: 'exact',
  })
}

export async function updateIssueStatus(issueId: string, status: string) {
  return apiRequest('update', {
    table: 'reported_issues',
    data: { status },
    where: `id = '${issueId}'`,
  })
}

export async function updateIssue(issueId: string, data: Record<string, any>) {
  return apiRequest('update', {
    table: 'reported_issues',
    data,
    where: `id = '${issueId}'`,
  })
}

export async function softDeleteIssue(issueId: string) {
  return apiRequest('update', {
    table: 'reported_issues',
    data: { deleted_at: new Date().toISOString() },
    where: `id = '${issueId}'`,
  })
}

export async function restoreIssue(issueId: string) {
  return apiRequest('update', {
    table: 'reported_issues',
    data: { deleted_at: null },
    where: `id = '${issueId}'`,
  })
}

// ============================================================================
// WALLET/BALANCE SERVICES
// ============================================================================

export async function getWalletBalance(userId: string) {
  return apiRequest('select', {
    table: 'user_wallets',
    where: `user_id = '${userId}'`,
  })
}

export async function updateWalletBalance(userId: string, amount: number) {
  return apiRequest('update', {
    table: 'user_wallets',
    data: { balance: amount },
    where: `user_id = '${userId}'`,
  })
}

// ============================================================================
// PROMOTION/REFERRAL SERVICES
// ============================================================================

export async function createPromotionRequest(data: Record<string, any>) {
  return apiRequest('insert', {
    table: 'promotion_requests',
    data,
  })
}

export async function getPromotionRequests(filter?: Record<string, any>) {
  let where = '1=1'
  if (filter?.trainerId) {
    where += ` AND trainer_id = '${filter.trainerId}'`
  }
  if (filter?.status) {
    where += ` AND status = '${filter.status}'`
  }
  return apiRequest('select', {
    table: 'promotion_requests',
    where,
    order: 'created_at DESC',
  })
}

export async function getPromotionRequestsForAdmin(status: string = 'pending') {
  return apiRequest('promotion_requests_get', { status })
}

export async function approvePromotionRequest(promotionRequestId: string, adminId?: string) {
  return apiRequest('promotion_request_approve', {
    promotion_request_id: promotionRequestId,
    admin_id: adminId,
  })
}

export async function rejectPromotionRequest(promotionRequestId: string, adminId?: string) {
  return apiRequest('promotion_request_reject', {
    promotion_request_id: promotionRequestId,
    admin_id: adminId,
  })
}

// ============================================================================
// GENERIC DATABASE OPERATIONS (for flexibility)
// ============================================================================

export async function selectData(table: string, options?: Record<string, any>) {
  return apiRequest('select', {
    table,
    ...options,
  })
}

export async function insertData(table: string, data: Record<string, any>) {
  return apiRequest('insert', {
    table,
    data,
  })
}

export async function updateData(
  table: string,
  data: Record<string, any>,
  where: string
) {
  return apiRequest('update', {
    table,
    data,
    where,
  })
}

export async function deleteData(table: string, where: string) {
  return apiRequest('delete', {
    table,
    where,
  })
}

// ============================================================================
// CONTACTS SERVICES
// ============================================================================

export async function getContactsWithPagination(options?: {
  page?: number
  pageSize?: number
}) {
  const page = Math.max(1, options?.page || 1)
  const pageSize = Math.max(1, Math.min(100, options?.pageSize || 10))
  const offset = (page - 1) * pageSize

  return apiRequest('select', {
    table: 'contacts',
    order: 'created_at DESC',
    limit: pageSize,
    offset,
    count: 'exact',
  })
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function healthCheck() {
  return apiRequest('health_check')
}
