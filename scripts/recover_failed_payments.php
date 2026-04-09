<?php
/**
 * Payment Recovery Script
 * 
 * Recovers failed or incomplete M-Pesa payments by:
 * 1. Finding payments with 'pending_verification' status (received but no receipt)
 * 2. Querying M-Pesa callback audit trail for missing receipts
 * 3. Updating payments with recovered receipt information
 * 4. Marking payments as 'completed' when receipt is found
 * 5. Logging recovery attempts for admin review
 * 
 * Usage: php scripts/recover_failed_payments.php [--dry-run] [--limit 50]
 * 
 * Examples:
 *   php scripts/recover_failed_payments.php                    # Process all pending_verification
 *   php scripts/recover_failed_payments.php --dry-run          # Preview changes
 *   php scripts/recover_failed_payments.php --limit 10         # Process only 10 records
 */

require_once(__DIR__ . '/../connection.php');

// Parse command line arguments
$dryRun = in_array('--dry-run', $argv);
$limitIndex = array_search('--limit', $argv);
$limit = ($limitIndex !== false && isset($argv[$limitIndex + 1])) ? intval($argv[$limitIndex + 1]) : 100;

echo "\n" . str_repeat("=", 70) . "\n";
echo "M-PESA PAYMENT RECOVERY SCRIPT\n";
echo str_repeat("=", 70) . "\n\n";

if ($dryRun) {
    echo "🔍 DRY RUN MODE - No changes will be made\n\n";
}

// Step 1: Find payments with pending_verification status
echo "Step 1: Finding payments with pending_verification status\n";
echo str_repeat("-", 70) . "\n";

$pendingQuery = "
    SELECT p.id, p.booking_id, p.amount, p.created_at, p.transaction_reference
    FROM payments p
    WHERE p.status = 'pending_verification'
    ORDER BY p.created_at DESC
    LIMIT $limit
";

$pendingResult = $conn->query($pendingQuery);
if (!$pendingResult) {
    echo "✗ Error querying payments: " . $conn->error . "\n";
    exit(1);
}

$pendingCount = $pendingResult->num_rows;
echo "  Found $pendingCount payments with pending_verification status\n\n";

if ($pendingCount === 0) {
    echo "✓ No payments to recover!\n";
    exit(0);
}

// Step 2: For each pending payment, check audit trail
echo "Step 2: Checking C2B callback audit trail for receipts\n";
echo str_repeat("-", 70) . "\n";

$recoveredCount = 0;
$notFoundCount = 0;
$errorCount = 0;
$updates = [];

while ($payment = $pendingResult->fetch_assoc()) {
    $paymentId = $payment['id'];
    $bookingId = $payment['booking_id'];
    $amount = $payment['amount'];
    $createdAt = $payment['created_at'];
    
    echo "\n  Processing: $paymentId\n";
    echo "    Amount: Ksh " . number_format($amount, 2) . "\n";
    echo "    Created: $createdAt\n";
    
    // Try to find callback data by booking_id via STK session
    if ($bookingId) {
        $callbackQuery = "
            SELECT cpc.mpesa_receipt_number, cpc.result_code, cpc.raw_response
            FROM c2b_payment_callbacks cpc
            INNER JOIN stk_push_sessions sps ON cpc.checkout_request_id = sps.checkout_request_id
            WHERE sps.booking_id = ? AND cpc.mpesa_receipt_number IS NOT NULL
            ORDER BY cpc.received_at DESC
            LIMIT 1
        ";
        
        $callbackStmt = $conn->prepare($callbackQuery);
        if ($callbackStmt) {
            $callbackStmt->bind_param("s", $bookingId);
            $callbackStmt->execute();
            $callbackResult = $callbackStmt->get_result();
            
            if ($callbackResult && $callbackResult->num_rows > 0) {
                $callback = $callbackResult->fetch_assoc();
                $receipt = $callback['mpesa_receipt_number'];
                $resultCode = $callback['result_code'];
                
                echo "    ✓ Found receipt in callback: $receipt (ResultCode: $resultCode)\n";
                
                $updates[] = [
                    'payment_id' => $paymentId,
                    'booking_id' => $bookingId,
                    'receipt' => $receipt,
                    'old_status' => 'pending_verification',
                    'new_status' => $resultCode === '0' || $resultCode === 0 ? 'completed' : 'failed',
                    'reason' => 'Recovered from C2B callback audit trail'
                ];
                $recoveredCount++;
            } else {
                echo "    ✗ No callback receipt found\n";
                $notFoundCount++;
            }
            $callbackStmt->close();
        } else {
            echo "    ✗ Error querying callback: " . $conn->error . "\n";
            $errorCount++;
        }
    } else {
        echo "    ✗ No booking_id - cannot recover\n";
        $notFoundCount++;
    }
}

// Step 3: Apply updates
echo "\n\n" . str_repeat("=", 70) . "\n";
echo "Step 3: Applying Updates\n";
echo str_repeat("-", 70) . "\n";

echo "  Summary:\n";
echo "    Recovered: $recoveredCount\n";
echo "    Not Found: $notFoundCount\n";
echo "    Errors: $errorCount\n";
echo "    Total: " . ($recoveredCount + $notFoundCount + $errorCount) . "\n\n";

if (empty($updates)) {
    echo "  No payments to recover.\n";
    exit(0);
}

if ($dryRun) {
    echo "  DRY RUN: Would update $recoveredCount payments\n\n";
    echo "  Updates that would be applied:\n";
    echo str_repeat("-", 70) . "\n";
    foreach ($updates as $update) {
        echo "  • Payment: {$update['payment_id']}\n";
        echo "    Booking: {$update['booking_id']}\n";
        echo "    Receipt: {$update['receipt']}\n";
        echo "    Status: {$update['old_status']} → {$update['new_status']}\n";
        echo "    Reason: {$update['reason']}\n";
        echo "\n";
    }
    echo "  Run without --dry-run to apply these updates.\n";
    exit(0);
}

// Apply actual updates
echo "  Applying updates...\n";
echo str_repeat("-", 70) . "\n";

$successCount = 0;
$failureCount = 0;

foreach ($updates as $update) {
    $paymentId = $update['payment_id'];
    $receipt = $update['receipt'];
    $newStatus = $update['new_status'];
    $reason = $update['reason'];
    
    // Update payment
    $updateStmt = $conn->prepare("
        UPDATE payments
        SET status = ?, transaction_reference = ?, updated_at = NOW()
        WHERE id = ?
    ");
    
    if (!$updateStmt) {
        echo "  ✗ Error preparing update for $paymentId: " . $conn->error . "\n";
        $failureCount++;
        continue;
    }
    
    $updateStmt->bind_param("sss", $newStatus, $receipt, $paymentId);
    
    if ($updateStmt->execute()) {
        echo "  ✓ Updated $paymentId: pending_verification → $newStatus\n";
        
        // Log recovery event
        $logQuery = "
            INSERT INTO activity_log (event_type, payment_id, metadata, timestamp)
            VALUES ('payment_recovered', ?, ?, NOW())
        ";
        $logStmt = $conn->prepare($logQuery);
        if ($logStmt) {
            $metadata = json_encode([
                'old_status' => 'pending_verification',
                'new_status' => $newStatus,
                'receipt' => $receipt,
                'reason' => $reason
            ]);
            $logStmt->bind_param("ss", $paymentId, $metadata);
            $logStmt->execute();
            $logStmt->close();
        }
        
        $successCount++;
    } else {
        echo "  ✗ Failed to update $paymentId: " . $conn->error . "\n";
        $failureCount++;
    }
    
    $updateStmt->close();
}

echo "\n" . str_repeat("=", 70) . "\n";
echo "RECOVERY COMPLETE\n";
echo str_repeat("=", 70) . "\n";
echo "  Updated: $successCount\n";
echo "  Failed: $failureCount\n";
echo "\n✓ Recovery script completed successfully!\n\n";

exit($failureCount > 0 ? 1 : 0);
?>
