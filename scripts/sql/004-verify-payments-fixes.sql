-- Verification and Audit Queries for Transport Fee and Trainer Earnings Fixes
-- Run these queries to verify the fixes are working correctly

-- ============================================================================
-- VERIFICATION QUERY 1: Check payments table has all new columns
-- ============================================================================
-- Expected result: Should show all columns including trainer_id, trainer_net_amount, etc.

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'payments'
  AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;


-- ============================================================================
-- VERIFICATION QUERY 2: Check payments are properly linked to trainers
-- ============================================================================
-- Expected result: All completed payments should have trainer_id and match booking trainer_id

SELECT 
    p.id,
    p.booking_id,
    p.trainer_id as payment_trainer_id,
    b.trainer_id as booking_trainer_id,
    CASE WHEN p.trainer_id = b.trainer_id THEN 'MATCH' ELSE 'MISMATCH' END as trainer_match,
    p.amount as client_paid,
    p.trainer_net_amount as trainer_earned,
    p.status,
    p.created_at
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
WHERE p.status = 'completed'
ORDER BY p.created_at DESC
LIMIT 50;


-- ============================================================================
-- VERIFICATION QUERY 3: Check for orphaned payments (not linked to trainer)
-- ============================================================================
-- Expected result: 0 rows (all payments should have trainer_id)

SELECT 
    p.id,
    p.booking_id,
    p.amount,
    p.status,
    'NO_TRAINER_ID' as issue
FROM payments p
WHERE p.trainer_id IS NULL
  AND p.status = 'completed'
LIMIT 50;


-- ============================================================================
-- VERIFICATION QUERY 4: Verify fee breakdown calculations in payments
-- ============================================================================
-- Expected: client_paid = base_service + transport + platform_fee + vat
-- Expected: trainer_earned = base_service + transport - platform_fee

SELECT 
    p.id,
    p.amount as client_paid,
    p.base_service_amount,
    p.transport_fee,
    p.platform_fee,
    p.vat_amount,
    (p.base_service_amount + p.transport_fee + p.platform_fee + p.vat_amount) as calculated_client_total,
    ABS(p.amount - (p.base_service_amount + p.transport_fee + p.platform_fee + p.vat_amount)) as client_total_variance,
    p.trainer_net_amount,
    (p.base_service_amount + p.transport_fee - p.platform_fee) as calculated_trainer_net,
    ABS(p.trainer_net_amount - (p.base_service_amount + p.transport_fee - p.platform_fee)) as trainer_net_variance
FROM payments p
WHERE p.status = 'completed'
ORDER BY p.created_at DESC
LIMIT 50;


-- ============================================================================
-- VERIFICATION QUERY 5: Identify fee mismatches
-- ============================================================================
-- Expected result: 0 rows (all calculations should be correct)

SELECT 
    p.id as payment_id,
    p.booking_id,
    p.trainer_id,
    'CLIENT_TOTAL_MISMATCH' as issue_type,
    ABS(p.amount - (p.base_service_amount + p.transport_fee + p.platform_fee + p.vat_amount)) as variance
FROM payments p
WHERE ABS(p.amount - (p.base_service_amount + p.transport_fee + p.platform_fee + p.vat_amount)) > 0.01
  AND p.status = 'completed'

UNION ALL

SELECT 
    p.id as payment_id,
    p.booking_id,
    p.trainer_id,
    'TRAINER_NET_MISMATCH' as issue_type,
    ABS(p.trainer_net_amount - (p.base_service_amount + p.transport_fee - p.platform_fee)) as variance
FROM payments p
WHERE ABS(p.trainer_net_amount - (p.base_service_amount + p.transport_fee - p.platform_fee)) > 0.01
  AND p.status = 'completed'

UNION ALL

SELECT 
    p.id as payment_id,
    p.booking_id,
    p.trainer_id,
    'PLATFORM_FEE_INCLUDES_TRANSPORT' as issue_type,
    p.platform_fee - (p.base_service_amount * 0.10) as variance
FROM payments p
WHERE ABS(p.platform_fee - (p.base_service_amount * 0.10)) > 0.01
  AND p.status = 'completed'

ORDER BY payment_id, issue_type;


-- ============================================================================
-- VERIFICATION QUERY 6: Trainer earnings summary by trainer
-- ============================================================================
-- Expected result: Shows total earnings per trainer (should NOT be zero)

SELECT 
    p.trainer_id,
    u.name as trainer_name,
    COUNT(*) as total_payments,
    SUM(p.amount) as total_client_paid,
    SUM(p.trainer_net_amount) as total_trainer_earned,
    SUM(p.base_service_amount) as total_service_amount,
    SUM(p.transport_fee) as total_transport_earned,
    SUM(p.platform_fee) as total_platform_fees_deducted,
    ROUND(SUM(p.trainer_net_amount) / COUNT(*), 2) as avg_earnings_per_payment,
    MAX(p.created_at) as last_payment_date
FROM payments p
LEFT JOIN users u ON p.trainer_id = u.id
WHERE p.status = 'completed'
GROUP BY p.trainer_id
ORDER BY SUM(p.trainer_net_amount) DESC;


-- ============================================================================
-- VERIFICATION QUERY 7: Check for zero balances (should be ZERO after fix)
-- ============================================================================
-- Expected result: 0 rows (no trainer should have zero balance if they have payments)

SELECT 
    p.trainer_id,
    u.name as trainer_name,
    COUNT(*) as payment_count,
    SUM(p.trainer_net_amount) as total_earned,
    'ZERO_BALANCE_ERROR' as issue
FROM payments p
LEFT JOIN users u ON p.trainer_id = u.id
WHERE p.status = 'completed'
  AND p.trainer_id IS NOT NULL
GROUP BY p.trainer_id
HAVING SUM(p.trainer_net_amount) <= 0;


-- ============================================================================
-- VERIFICATION QUERY 8: Verify payout requests don't double-commission transport
-- ============================================================================
-- Expected: commission = 0 OR commission = minimal B2C processing fee (not 5%+ of full amount)

SELECT 
    pr.id as payout_request_id,
    pr.trainer_id,
    u.name as trainer_name,
    pr.amount as requested_amount,
    pr.commission,
    pr.net_amount,
    (pr.commission / pr.amount * 100) as commission_percentage,
    CASE 
        WHEN (pr.commission / pr.amount * 100) > 2 THEN 'DOUBLE_COMMISSION_LIKELY'
        WHEN pr.commission = 0 THEN 'CORRECT_NO_COMMISSION'
        ELSE 'MINIMAL_B2C_FEE'
    END as status,
    pr.status as payout_status,
    pr.updated_at
FROM payout_requests pr
LEFT JOIN users u ON pr.trainer_id = u.id
WHERE pr.status = 'approved'
ORDER BY pr.updated_at DESC
LIMIT 50;


-- ============================================================================
-- VERIFICATION QUERY 9: Transport fee revenue analysis
-- ============================================================================
-- Shows how much transport fee revenue is being properly recorded

SELECT 
    COUNT(*) as bookings_with_transport,
    SUM(CASE WHEN p.transport_fee > 0 THEN 1 ELSE 0 END) as payments_with_transport,
    SUM(CASE WHEN p.transport_fee = 0 AND b.transport_fee > 0 THEN 1 ELSE 0 END) as transport_not_recorded,
    SUM(p.transport_fee) as total_transport_in_payments,
    SUM(b.transport_fee) as total_transport_in_bookings,
    CASE 
        WHEN ABS(SUM(p.transport_fee) - SUM(b.transport_fee)) < 0.01 THEN 'MATCH'
        ELSE 'MISMATCH'
    END as status
FROM bookings b
LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'completed'
WHERE b.status = 'completed';


-- ============================================================================
-- VERIFICATION QUERY 10: Identify trainers who can't request payouts (zero balance)
-- ============================================================================
-- Expected result: Should be empty after fix (no trainer should show as zero balance)

SELECT 
    u.id as trainer_id,
    u.name,
    u.email,
    COUNT(b.id) as total_bookings,
    SUM(p.trainer_net_amount) as total_earned,
    COALESCE(SUM(p.trainer_net_amount), 0) as current_balance,
    CASE 
        WHEN COALESCE(SUM(p.trainer_net_amount), 0) <= 0 AND COUNT(b.id) > 0 THEN 'ERROR_ZERO_BALANCE'
        WHEN COALESCE(SUM(p.trainer_net_amount), 0) > 0 THEN 'OK'
        WHEN COUNT(b.id) = 0 THEN 'NO_BOOKINGS'
    END as status
FROM users u
LEFT JOIN bookings b ON u.id = b.trainer_id AND b.status = 'completed'
LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'completed'
WHERE u.user_type = 'trainer'
GROUP BY u.id
ORDER BY COALESCE(SUM(p.trainer_net_amount), 0) DESC;


-- ============================================================================
-- BACKUP QUERY: Get all payment data for manual audit
-- ============================================================================
-- Run this to export all payment data for spreadsheet analysis

SELECT 
    p.id as payment_id,
    b.id as booking_id,
    p.trainer_id,
    u.name as trainer_name,
    c.name as client_name,
    p.amount as client_paid_total,
    p.base_service_amount,
    p.transport_fee,
    p.platform_fee,
    p.vat_amount,
    p.trainer_net_amount,
    p.status,
    p.method,
    p.transaction_reference,
    p.created_at,
    ROUND((p.transport_fee / p.amount * 100), 2) as transport_pct_of_total,
    ROUND((p.trainer_net_amount / p.amount * 100), 2) as trainer_net_pct_of_total
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
LEFT JOIN users u ON p.trainer_id = u.id
LEFT JOIN users c ON p.user_id = c.id
WHERE p.status = 'completed'
ORDER BY p.created_at DESC;
