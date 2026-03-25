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

  try {
    const normalizedPhone = normalizePhoneNumber(phone)
    const result = await apiRequest(
      'mpesa_stk_initiate',
      {
        phone: normalizedPhone,
        amount,
        account_reference: accountReference,
        transaction_description: description,
        booking_id: bookingId || null,
        client_id: clientId || null,
        trainer_id: trainerId || null,
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
 * Also auto-credits trainer wallet with their earnings (minus commission)
 */
export async function completePayment(
  paymentRecord: PaymentRecord,
  bookingId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Insert payment record
    await apiRequest('payment_insert', paymentRecord, { headers: withAuth() })

    // Update booking status to 'confirmed' if bookingId provided
    if (bookingId) {
      await apiRequest(
        'booking_update',
        {
          id: bookingId,
          status: 'confirmed',
          session_phase: 'waiting_start',
        },
        { headers: withAuth() }
      )
    }

    // Auto-initiate B2C payout to trainer (direct to M-Pesa, not wallet)
    // This happens immediately when payment is completed
    if (paymentRecord.trainer_id && bookingId && paymentRecord.trainer_net_amount && paymentRecord.trainer_net_amount > 0) {
      try {
        await apiRequest(
          'trainer_payout_auto_b2c',
          {
            booking_id: bookingId,
            trainer_id: paymentRecord.trainer_id,
            amount: paymentRecord.trainer_net_amount,
            reason: 'payment_completed'
          },
          { headers: withAuth() }
        )
        console.log(`[Payment] Initiated B2C payout for trainer ${paymentRecord.trainer_id}: Ksh ${paymentRecord.trainer_net_amount}`)
      } catch (payoutError: any) {
        console.error('Failed to auto-initiate B2C payout:', payoutError)
        // Log but don't fail the payment completion - the earnings are still recorded in the payments table
        // Manual payout can be requested later if needed
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Payment completion error:', error)
    return {
      success: false,
      error: error.message || 'Failed to complete payment',
    }
  }
}

/**
 * Handle failed payment by inserting payment record with 'failed' status
 * Does NOT update booking status, leaves it in 'pending'
 */
export async function recordFailedPayment(paymentRecord: PaymentRecord): Promise<{ success: boolean; error?: string }> {
  try {
    await apiRequest('payment_insert', paymentRecord, { headers: withAuth() })
    return { success: true }
  } catch (error: any) {
    console.error('Failed payment record error:', error)
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
 * Full payment flow for a booking
 * Handles: initiation → polling → completion
 * Returns whether payment was successful
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
  const { paymentRecord, bookingId, ...stkParams } = params

  // Initiate STK push
  const initResult = await initiatePayment(stkParams)
  if (!initResult.success) {
    // Record failed payment attempt
    await recordFailedPayment({
      ...paymentRecord,
      status: 'failed',
      method: 'mpesa',
    })
    return { success: false, error: initResult.error }
  }

  const checkoutRequestId = initResult.checkoutRequestId
  if (!checkoutRequestId) {
    return { success: false, error: 'No checkout request ID received' }
  }

  // Poll for result
  const queryResult = await pollPaymentStatus(checkoutRequestId)
  if (!queryResult.success) {
    // Record failed payment
    await recordFailedPayment({
      ...paymentRecord,
      status: 'failed',
      method: 'mpesa',
    })
    return { success: false, error: queryResult.error || queryResult.resultDescription }
  }

  // Complete the payment
  const completeResult = await completePayment(
    {
      ...paymentRecord,
      status: 'completed',
      method: 'mpesa',
    },
    bookingId
  )

  if (!completeResult.success) {
    return { success: false, error: completeResult.error }
  }

  return {
    success: true,
    checkoutRequestId,
  }
}
