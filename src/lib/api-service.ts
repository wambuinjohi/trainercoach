import { apiRequest, withAuth } from './api'
import { calculateDistance, filterTrainersByServiceRadius, sortTrainersByDistance, Coordinates, isValidCoordinates } from './location-utils'

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

export async function checkPhoneExists(phone: string) {
  return apiRequest('check_phone_exists', { phone_number: phone })
}

export async function resetPINWithPhone(phone: string, newPin: string) {
  return apiRequest('reset_pin_with_phone', { phone_number: phone, new_pin: newPin })
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

export async function approveCategory(categoryId: string | number, reviewedBy: string) {
  return apiRequest('admin_category_approve', {
    category_id: categoryId,
    reviewed_by: reviewedBy,
  })
}

export async function rejectCategory(
  categoryId: string | number,
  reviewedBy: string,
  rejectionReason?: string
) {
  return apiRequest('admin_category_reject', {
    category_id: categoryId,
    reviewed_by: reviewedBy,
    ...(rejectionReason && { rejection_reason: rejectionReason }),
  })
}

export async function getAdminCategories(status?: string, sortBy?: string) {
  return apiRequest('admin_category_list', {
    ...(status && { status }),
    ...(sortBy && { sortBy }),
  })
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

/**
 * Get trainers by category with distance filtering and sorting
 * @param categoryId Category ID
 * @param clientLocation Client's location coordinates
 * @returns Trainers filtered by service radius and sorted by distance
 */
export async function getTrainersByCategoryWithDistance(
  categoryId: number,
  clientLocation: Coordinates
) {
  try {
    const response = await getTrainersByCategory(categoryId)
    const trainers = Array.isArray(response) ? response : response?.data || []

    // Validate client location
    if (!isValidCoordinates(clientLocation)) {
      console.warn('Invalid client location, returning unfiltered trainers')
      return trainers
    }

    // Filter trainers by service radius
    const filteredTrainers = filterTrainersByServiceRadius(trainers, clientLocation)

    // Sort by distance (closest first)
    const sortedTrainers = sortTrainersByDistance(filteredTrainers, clientLocation)

    return sortedTrainers
  } catch (error) {
    console.error('Error fetching trainers with distance calculation:', error)
    return []
  }
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
// PAYOUT SERVICES - AUTOMATIC TRAINER MPESA PAYOUTS
// ============================================================================

/**
 * Initiate automatic payout to trainer's MPESA account after session completion
 * Called automatically when a session is marked as completed
 */
export async function initiateTrainerPayout(data: {
  booking_id: string
  trainer_id: string
  trainer_mpesa_number: string
  amount: number
  reason?: string // e.g., 'session_completion'
}) {
  return apiRequest('trainer_payout_initiate', {
    booking_id: data.booking_id,
    trainer_id: data.trainer_id,
    mpesa_number: data.trainer_mpesa_number,
    amount: data.amount,
    reason: data.reason || 'session_completion',
  })
}

/**
 * Create payout record for tracking trainer earnings
 */
export async function createPayoutRecord(data: {
  trainer_id: string
  booking_id: string
  amount: number
  mpesa_number: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
}) {
  return apiRequest('insert', {
    table: 'trainer_payouts',
    data: {
      trainer_id: data.trainer_id,
      booking_id: data.booking_id,
      amount: data.amount,
      mpesa_number: data.mpesa_number,
      status: data.status || 'pending',
      initiated_at: new Date().toISOString(),
    },
  })
}

/**
 * Get payout history for a trainer
 */
export async function getTrainerPayoutHistory(trainerId: string, limit: number = 50) {
  return apiRequest('select', {
    table: 'trainer_payouts',
    where: `trainer_id = '${trainerId}'`,
    order: 'initiated_at DESC',
    limit,
  })
}

/**
 * Update payout status (for admin tracking)
 */
export async function updatePayoutStatus(payoutId: string, status: string) {
  return apiRequest('update', {
    table: 'trainer_payouts',
    data: { status, updated_at: new Date().toISOString() },
    where: `id = '${payoutId}'`,
  })
}

// ============================================================================
// TRAINER ACCOUNT STATUS & VERIFICATION SERVICES
// ============================================================================

export async function checkProfileCompletion(userId: string) {
  return apiRequest('trainer_check_profile_completion', { user_id: userId })
}

export async function checkDocumentsSubmission(userId: string) {
  return apiRequest('trainer_check_documents_submission', { user_id: userId })
}

export async function setTrainerAccountStatus(userId: string, status: string, token?: string) {
  const headers = token ? { 'X-Admin-Token': token } : {}
  return apiRequest('trainer_set_account_status', { user_id: userId, status }, { headers })
}

export async function uploadVerificationDocument(trainerId: string, documentType: string, file: File, idNumber?: string, onProgress?: (progress: number) => void, additionalData?: Record<string, any>) {
  const formData = new FormData()
  formData.append('action', 'verification_document_upload')
  formData.append('trainer_id', trainerId)
  formData.append('document_type', documentType)
  formData.append('file', file)
  if (idNumber) {
    formData.append('id_number', idNumber)
  }
  // Add any additional data (like id_side, id_type, passport_number)
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value))
      }
    })
  }

  const apiBaseUrl = (typeof window !== 'undefined' && window.location.origin) + '/api.php'

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          onProgress(progress)
        }
      })
    }

    xhr.addEventListener('load', () => {
      try {
        const response = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response)
        } else {
          reject(new Error(response?.message || `Upload failed with status ${xhr.status}`))
        }
      } catch (e) {
        if (xhr.status >= 200 && xhr.status < 300) {
          reject(new Error('Failed to parse response'))
        } else {
          reject(new Error(`Upload failed: ${xhr.responseText || 'Unknown error'}`))
        }
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.open('POST', apiBaseUrl, true)
    xhr.send(formData)
  })
}

export async function uploadClientProfileImage(userId: string, file: File, onProgress?: (progress: number) => void) {
  const formData = new FormData()
  formData.append('action', 'client_profile_image_upload')
  formData.append('user_id', userId)
  formData.append('file', file)

  const apiBaseUrl = (typeof window !== 'undefined' && window.location.origin) + '/api.php'

  return new Promise<{ image_url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          onProgress(progress)
        }
      })
    }

    xhr.addEventListener('load', () => {
      try {
        const response = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response)
        } else {
          reject(new Error(response?.message || `Upload failed with status ${xhr.status}`))
        }
      } catch (e) {
        if (xhr.status >= 200 && xhr.status < 300) {
          reject(new Error('Failed to parse response'))
        } else {
          reject(new Error(`Upload failed: ${xhr.responseText || 'Unknown error'}`))
        }
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.open('POST', apiBaseUrl, true)
    xhr.send(formData)
  })
}

export async function getVerificationDocuments(trainerId: string) {
  return apiRequest('verification_documents_get', { trainer_id: trainerId })
}

export async function listVerificationDocuments(status?: string, token?: string) {
  // Note: Authorization header is automatically added by apiRequest() via withAuth()
  // No need to pass token parameter - it's handled automatically
  const payload: any = {}
  if (status) {
    payload.status = status
  }
  return apiRequest('verification_documents_list', payload)
}

export async function verifyDocument(documentId: string, status: 'approved' | 'rejected', rejectionReason?: string, token?: string) {
  // Note: Authorization header is automatically added by apiRequest() via withAuth()
  // No need to pass token parameter - it's handled automatically
  return apiRequest('verification_document_verify', {
    document_id: documentId,
    status,
    rejection_reason: rejectionReason || null
  })
}

export async function updateTrainerSponsor(trainerId: string, sponsorId: string | null) {
  return apiRequest('profile_update', {
    user_id: trainerId,
    sponsor_id: sponsorId,
  })
}

export async function validateSponsor(sponsorId: string) {
  return apiRequest('validate_sponsor', { sponsor_id: sponsorId })
}

export async function completeBooking(bookingId: string) {
  return apiRequest('booking_complete', { booking_id: bookingId })
}

export async function getSponsorCommissions(sponsorId: string) {
  return apiRequest('select', {
    table: 'sponsor_commissions',
    where: `sponsor_trainer_id = '${sponsorId}'`,
    orderBy: 'created_at DESC',
  })
}

export async function getTrainerCommissions(trainerId: string) {
  return apiRequest('select', {
    table: 'sponsor_commissions',
    where: `sponsored_trainer_id = '${trainerId}'`,
    orderBy: 'created_at DESC',
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
// M-PESA CREDENTIALS MANAGEMENT
// ============================================================================

export async function getMpesaCredentials() {
  return apiRequest('mpesa_credentials_get')
}

export async function saveMpesaCredentials(credentials: Record<string, any>) {
  return apiRequest('mpesa_credentials_save', credentials)
}

export async function deleteMpesaCredentials() {
  return apiRequest('mpesa_credentials_delete')
}

// ============================================================================
// COACH/TRAINER SEARCH SERVICES
// ============================================================================

export async function searchTrainersByName(query: string) {
  return apiRequest('search_trainers', { query })
}

export async function searchCoaches(filters?: {
  name?: string
  email?: string
  minRating?: number
  maxRate?: number
  verified?: boolean
}) {
  return apiRequest('search_coaches', {
    ...(filters?.name && { name: filters.name }),
    ...(filters?.email && { email: filters.email }),
    ...(filters?.minRating && { min_rating: filters.minRating }),
    ...(filters?.maxRate && { max_rate: filters.maxRate }),
    ...(filters?.verified && { verified: true }),
  })
}

// ============================================================================
// SPONSORSHIP SERVICES
// ============================================================================

export async function searchAvailableSponsors(query?: string) {
  let where = `account_status = 'approved' AND is_verified = 1`
  if (query && query.trim()) {
    const escapedQuery = query.replace(/'/g, "''")
    where += ` AND (full_name LIKE '%${escapedQuery}%' OR email LIKE '%${escapedQuery}%')`
  }
  return apiRequest('select', {
    table: 'user_profiles',
    where,
    order: 'rating DESC',
  })
}

export async function getSponsorCommissionRate() {
  const settings = await apiRequest('get_system_settings')
  return settings?.data?.sponsor_commission_percentage || 10
}

// ============================================================================
// GRACE PERIOD SERVICES
// ============================================================================

export async function setGracePeriod(
  trainerId: string,
  reason: string,
  durationDays: number = 30
) {
  const startDate = new Date().toISOString()
  const endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

  return apiRequest('update', {
    table: 'user_profiles',
    data: {
      good_conduct_grace_period_start: startDate,
      good_conduct_grace_period_end: endDate,
    },
    where: `user_id = '${trainerId}'`,
  })
}

export async function getGracePeriod(trainerId: string) {
  return apiRequest('select', {
    table: 'user_profiles',
    where: `user_id = '${trainerId}' AND good_conduct_grace_period_end IS NOT NULL`,
  })
}

export async function expireGracePeriod(trainerId: string) {
  return apiRequest('update', {
    table: 'user_profiles',
    data: {
      good_conduct_grace_period_start: null,
      good_conduct_grace_period_end: null,
    },
    where: `user_id = '${trainerId}'`,
  })
}

// ============================================================================
// TRAINER PROFILE SERVICES (Phase 5/6)
// ============================================================================

/**
 * Get trainer profile completion status and percentage
 * @param trainerId Trainer user ID
 * @returns Profile completion data with percentage and missing fields
 */
export async function getProfileCompletion(trainerId: string) {
  try {
    const profile = await getUserProfile(trainerId)
    const profileList = Array.isArray(profile) ? profile : (profile?.data && Array.isArray(profile.data) ? profile.data : [])

    if (profileList.length === 0) {
      return { percentage: 0, isComplete: false, missingFields: ['profile'] }
    }

    const profileData = profileList[0]
    const requiredFields = [
      'full_name',
      'hourly_rate',
      'area_of_residence',
      'profile_image',
      'bio',
      'mpesa_number'
    ]

    const missingFields = requiredFields.filter(field => !profileData[field])
    const completedFields = requiredFields.length - missingFields.length
    const percentage = Math.round((completedFields / requiredFields.length) * 100)

    // Check if trainer has categories
    const categories = await getTrainerCategories(trainerId)
    const categoriesList = Array.isArray(categories) ? categories : (categories?.data && Array.isArray(categories.data) ? categories.data : [])
    const hasCategories = categoriesList.length > 0

    return {
      percentage,
      isComplete: percentage === 100 && hasCategories,
      completedFields,
      totalFields: requiredFields.length,
      missingFields: missingFields.length > 0 ? missingFields : [],
      hasCategories,
      profileData: {
        name: profileData.full_name,
        email: profileData.email,
        image: profileData.profile_image,
        bio: profileData.bio,
        location: profileData.area_of_residence,
        rate: profileData.hourly_rate,
        mpesaNumber: profileData.mpesa_number,
        registrationPath: profileData.registration_path,
        verificationStatus: profileData.verification_status
      }
    }
  } catch (error) {
    console.error('Error getting profile completion:', error)
    return { percentage: 0, isComplete: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get trainer statistics (bookings, ratings, etc.)
 * @param trainerId Trainer user ID
 * @returns Trainer stats data
 */
export async function getTrainerStats(trainerId: string) {
  try {
    return await apiRequest('trainer_stats_get', { trainer_id: trainerId })
  } catch (error) {
    console.error('Error getting trainer stats:', error)
    return { totalBookings: 0, rating: 0, reviews: 0, earnings: 0, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get trainer profile summary (public view)
 * @param trainerId Trainer user ID
 * @returns Trainer profile summary with essential info
 */
export async function getTrainerProfileSummary(trainerId: string) {
  try {
    const profile = await getUserProfile(trainerId)
    const profileList = Array.isArray(profile) ? profile : (profile?.data && Array.isArray(profile.data) ? profile.data : [])

    if (profileList.length === 0) {
      return null
    }

    const profileData = profileList[0]

    // Get categories
    const categories = await getTrainerCategories(trainerId)
    const categoriesList = Array.isArray(categories) ? categories : (categories?.data && Array.isArray(categories.data) ? categories.data : [])

    // Get stats
    const stats = await getTrainerStats(trainerId)

    return {
      id: trainerId,
      name: profileData.full_name,
      email: profileData.email,
      image: profileData.profile_image,
      bio: profileData.bio,
      location: profileData.area_of_residence,
      hourlyRate: profileData.hourly_rate,
      serviceRadius: profileData.service_radius,
      categories: categoriesList.map((cat: any) => ({
        id: cat.category_id || cat.id,
        name: cat.name,
        rate: cat.hourly_rate
      })),
      rating: stats?.rating || 0,
      reviews: stats?.reviews || 0,
      totalBookings: stats?.totalBookings || 0,
      verified: profileData.verification_status === 'approved',
      registrationPath: profileData.registration_path
    }
  } catch (error) {
    console.error('Error getting trainer profile summary:', error)
    return null
  }
}

/**
 * Update trainer profile status (e.g., active, inactive, suspended)
 * @param trainerId Trainer user ID
 * @param status Profile status
 */
export async function updateTrainerProfileStatus(trainerId: string, status: 'active' | 'inactive' | 'suspended') {
  return apiRequest('update', {
    table: 'user_profiles',
    data: { profile_status: status },
    where: `user_id = '${trainerId}'`,
  })
}

/**
 * Get list of trainers with profile completion status (for admin)
 * @returns List of trainers with completion percentage
 */
export async function getTrainersWithProfileStatus() {
  try {
    const trainers = await apiRequest('trainers_with_profile_status')
    return Array.isArray(trainers) ? trainers : (trainers?.data && Array.isArray(trainers.data) ? trainers.data : [])
  } catch (error) {
    console.error('Error getting trainers with profile status:', error)
    return []
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function healthCheck() {
  return apiRequest('health_check')
}
