/**
 * Payment Service - Centralized M-Pesa payment handling
 * Manages STK push initiation, polling, and completion for bookings and other payments
 */

import { apiRequest, withAuth } from '@/lib/api'

export interface PaymentInitiationParams {
  phone: string
  amount: number
  bookingId?: string
  clientId?: string
  trainerId?: string
  accountReference?: string
  description?: string
}

export interface STKPushResult {
  success: boolean
  checkoutRequestId?: string
  merchantRequestId?: string
  responseCode?: string
  responseMessage?: string
  error?: string
}

export interface PaymentQueryResult {
  success: boolean
  resultCode?: number
  resultDescription?: string
  amount?: number
  mpesaReceiptNumber?: string
  transactionDate?: string
  phoneNumber?: string
  error?: string
}

export interface PaymentRecord {
  booking_id?: string | null
  client_id: string
  trainer_id?: string
  amount: number
  base_service_amount?: number
  distance_fee?: number
  transport_fee?: number
  platform_fee?: number
  vat_amount?: number
  trainer_net_amount?: number
  status: 'pending' | 'completed' | 'failed'
  method: 'mpesa' | 'wallet' | 'bank_transfer' | 'mock'
  transaction_reference?: string | null
  created_at: string
}

/**
 * Normalize phone number to M-Pesa format (254xxxxxxxxx)
 * Handles:
 * - 07xxxxxxxx → 254xxxxxxxx
 * - 01xxxxxxxx → 254xxxxxxxx
 * - 7xxxxxxxx → 2547xxxxxxxx
 * - +254xxxxxxx → 254xxxxxxx
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
 * Initiate M-Pesa STK push for payment
 * Returns checkout request ID which is used for polling
 */
export async function initiatePayment(params: PaymentInitiationParams): Promise<STKPushResult> {
  const {
    phone,
    amount,
    bookingId,
    clientId,
    trainerId,
    accountReference = bookingId || 'payment',
    description = 'Payment for session booking'
  } = params

  // Validate amount is within M-Pesa limits
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      error: `Invalid payment amount: ${amount}. Amount must be greater than 0.`,
    }
  }

  if (amount < 5) {
    return {
      success: false,
      error: `Amount must be at least Ksh 5. Current amount: Ksh ${amount}. Please check the trainer rate or book more sessions.`,
    }
  }

  if (amount > 150000) {
    return {
      success: false,
      error: `Amount cannot exceed Ksh 150,000. Current amount: Ksh ${amount}. Please contact support to split the booking.`,
    }
  }

  try {
    const normalizedPhone = normalizePhoneNumber(phone)

    // Generate unique IDs and timestamps for the STK request
    const stkId = `stk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const checkoutRequestId = `CO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const merchantRequestId = `MR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()

    const result = await apiRequest(
      'mpesa_stk_initiate',
      {
        stk_id: stkId,
        client_id: clientId || null,
        trainer_id: trainerId || null,
        phone: normalizedPhone,
        amount,
        booking_id: bookingId || null,
        request_id: requestId,
        account_reference: accountReference,
        transaction_description: description,
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        status: 'initiated',
        is_test: false,
        is_retry: false,
        created_at: now,
        updated_at: now,
      },
      { headers: withAuth() }
    )

    if (!result) {
      return {
        success: false,
        error: 'No response from payment server',
      }
    }

    const checkoutId = result?.checkout_request_id || ''
    if (!checkoutId) {
      return {
        success: false,
        error: 'M-Pesa credentials may not be configured. Please contact support.',
      }
    }

    return {
      success: true,
      checkoutRequestId: checkoutId,
      merchantRequestId: result?.merchant_request_id,
      responseCode: result?.response_code,
      responseMessage: result?.response_message,
    }
  } catch (error: any) {
    const errorMsg = error.message || 'Failed to initiate payment'

    // Check if M-Pesa is not configured on backend
    if (errorMsg.includes('access token') || errorMsg.includes('credentials') || errorMsg.includes('not configured')) {
      return {
        success: false,
        error: 'M-Pesa is not currently configured. Please use the Mock payment method for testing.',
      }
    }

    return {
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Poll for payment status using checkout request ID
 * M-Pesa is asynchronous, so we need to poll until we get a result
 * Returns true if payment was successful (resultCode === 0)
 */
export async function pollPaymentStatus(
  checkoutRequestId: string,
  maxAttempts: number = 20,
  pollIntervalMs: number = 3000
): Promise<PaymentQueryResult> {
  let attempts = 0

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))

    try {
      const result = await apiRequest(
        'mpesa_stk_query',
        { checkout_request_id: checkoutRequestId },
        { headers: withAuth() }
      )

      const resultCode = Number(result?.result_code || -1)

      // Result code 0 = success
      if (resultCode === 0) {
        return {
          success: true,
          resultCode,
          resultDescription: result?.result_description,
          amount: result?.amount,
          mpesaReceiptNumber: result?.mpesa_receipt_number,
          transactionDate: result?.transaction_date,
          phoneNumber: result?.phone_number,
        }
      }

      // Result code 1032 = user cancelled
      // Result code 1037 = timeout
      // These are terminal states, stop polling
      if (resultCode === 1032 || resultCode === 1037) {
        return {
          success: false,
          resultCode,
          resultDescription: result?.result_description || 'Payment cancelled or timed out',
        }
      }

      // Result code 1 = pending, continue polling
      // Any other code = still pending
    } catch (error: any) {
      console.error('STK query error:', error)
      // Continue polling, don't fail on query error
    }

    attempts += 1
  }

  // Exhausted polling attempts
  return {
    success: false,
    error: 'Payment did not complete within expected time',
  }
}

/**
 * Complete a payment by inserting payment record and updating booking status
 * Should be called after successful payment confirmation
 * Note: Payout is initiated when the session is completed by the client, not when payment is completed
 *
 * FRONTEND FALLBACK: This function serves as a fallback if the backend M-Pesa callback doesn't arrive.
 * The backend callback (c2b_callback.php) should also record the payment, but this ensures
 * payment is recorded even if the callback fails.
 */
export async function completePayment(
  paymentRecord: PaymentRecord,
  bookingId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Payment Service] Completing payment:', {
      bookingId,
      clientId: paymentRecord.client_id,
      amount: paymentRecord.amount,
      status: paymentRecord.status,
      method: paymentRecord.method,
      transactionReference: paymentRecord.transaction_reference || 'MISSING - THIS NEEDS M-PESA RECEIPT',
    })

    // DUPLICATE PROTECTION: Check if payment already exists for this booking
    if (bookingId) {
      try {
        // Query to check if a completed payment already exists for this booking
        // This prevents duplicate payment records if the callback fires multiple times
        // or if this fallback is called multiple times
        console.log('[Payment Service] Checking for existing completed payment for booking:', bookingId)

        // Note: We can't directly query the payments table from the frontend,
        // but the backend payment_insert endpoint should handle duplicate detection.
        // The backend uses transaction_reference (M-Pesa receipt) for deduplication.
        // Here we rely on the API to return an error if duplicate is detected.
      } catch (checkErr) {
        console.warn('[Payment Service] Could not check for duplicate, proceeding with insert:', checkErr)
      }
    }

    // Insert payment record with 'completed' status
    const insertResult = await apiRequest('payment_insert', paymentRecord, { headers: withAuth() })
    console.log('[Payment Service] Payment record inserted:', insertResult)

    // Update booking status to 'confirmed' if bookingId provided
    if (bookingId) {
      await apiRequest(
        'booking_update',
        {
          id: bookingId,
          status: 'confirmed',
          session_phase: 'waiting_start',
          payment_status: 'completed',
        },
        { headers: withAuth() }
      )
      console.log('[Payment Service] Booking updated to confirmed:', bookingId)
    }

    console.log('[Payment Service] Payment completion successful')
    return { success: true }
  } catch (error: any) {
    // Don't fail if payment already exists (duplicate call is safe)
    if (error.message && error.message.includes('duplicate') || error.message?.includes('Duplicate')) {
      console.warn('[Payment Service] Payment already recorded (duplicate detected, this is OK):', bookingId)
      return { success: true } // Treat duplicate as success
    }

    console.error('[Payment Service] Payment completion error:', error)
    return {
      success: false,
      error: error.message || 'Failed to complete payment',
    }
  }
}

/**
 * Handle failed payment by inserting payment record with 'failed' status
 * Does NOT update booking status, leaves it in 'pending'
 *
 * AUDIT: This should only be called when STK initiation fails, not when payment fails on M-Pesa side
 * If M-Pesa callback shows failure, the backend should handle that (c2b_callback.php)
 */
export async function recordFailedPayment(paymentRecord: PaymentRecord): Promise<{ success: boolean; error?: string }> {
  try {
    // VALIDATION: Ensure record is marked as failed
    if (paymentRecord.status !== 'failed') {
      console.warn('[Payment Service] recordFailedPayment called with non-failed status:', paymentRecord.status)
      // Force status to 'failed' to prevent data inconsistency
      paymentRecord.status = 'failed'
    }

    // AUDIT: Log failed payment attempt
    console.log('[Payment Service] Recording failed payment:', {
      bookingId: paymentRecord.booking_id,
      clientId: paymentRecord.client_id,
      amount: paymentRecord.amount,
      method: paymentRecord.method,
      reason: 'STK initiation failure - user will retry'
    })

    const result = await apiRequest('payment_insert', paymentRecord, { headers: withAuth() })

    console.log('[Payment Service] Failed payment recorded:', result)
    return { success: true }
  } catch (error: any) {
    console.error('[Payment Service] Failed payment record error:', error)
    return {
      success: false,
      error: error.message || 'Failed to record payment failure',
    }
  }
}

/**
 * Create a mock payment for testing
 * Immediately returns success without calling M-Pesa APIs
 */
export async function completeMockPayment(
  paymentRecord: Omit<PaymentRecord, 'method'>,
  bookingId?: string
): Promise<{ success: boolean; error?: string }> {
  const mockPaymentRecord: PaymentRecord = {
    ...paymentRecord,
    method: 'mock',
  }

  return completePayment(mockPaymentRecord, bookingId)
}

/**
 * Retry a failed payment by initiating a new STK push
 * Used when a previous payment attempt failed and needs to be retried
 */
export async function retryPayment(
  params: PaymentInitiationParams & {
    paymentRecord: Omit<PaymentRecord, 'method'>
    bookingId: string
  }
): Promise<{
  success: boolean
  checkoutRequestId?: string
  error?: string
}> {
  return processBookingPayment(params)
}

/**
 * Start a booking payment by initiating the STK push.
 *
 * PAYMENT FLOW:
 * 1. Frontend initiates STK push via this function
 * 2. User receives STK prompt on M-Pesa, enters PIN
 * 3. M-Pesa sends callback to backend (c2b_callback.php)
 * 4. Backend callback records payment as 'completed' or 'failed'
 * 5. Frontend polls booking_get to detect status change
 * 6. If backend callback doesn't arrive, frontend fallback calls completePayment()
 *
 * SAFEGUARDS:
 * - Only recordFailedPayment() on STK initiation failure
 * - completePayment() is the fallback (called from BookingConfirmation when polling shows success)
 * - Duplicate detection prevents multiple payments for same booking
 * - All payment operations are logged for audit trail
 */
export async function processBookingPayment(
  params: PaymentInitiationParams & {
    paymentRecord: Omit<PaymentRecord, 'method'>
    bookingId: string
  }
): Promise<{
  success: boolean
  checkoutRequestId?: string
  error?: string
}> {
  const { paymentRecord, ...stkParams } = params

  console.log('[Payment Service] processBookingPayment starting:', {
    bookingId: params.bookingId,
    clientId: params.clientId,
    amount: params.amount,
    phone: params.phone?.replace(/./g, '*').slice(-4), // Mask phone for security
  })

  const initResult = await initiatePayment(stkParams)
  if (!initResult.success) {
    console.warn('[Payment Service] STK initiation failed, recording failed payment')
    await recordFailedPayment({
      ...paymentRecord,
      status: 'failed',
      method: 'mpesa',
    })
    return { success: false, error: initResult.error }
  }

  console.log('[Payment Service] STK initiation successful, checkout request ID:', initResult.checkoutRequestId)

  return {
    success: true,
    checkoutRequestId: initResult.checkoutRequestId,
  }
}
