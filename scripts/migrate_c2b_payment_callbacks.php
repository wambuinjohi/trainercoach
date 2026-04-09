<?php
/**
 * Migration: Create C2B payment callbacks audit trail table
 * 
 * Stores all C2B (STK Push) callbacks from M-Pesa for auditing and debugging
 * This is critical for troubleshooting missing receipts and failed payments
 * 
 * Usage: php scripts/migrate_c2b_payment_callbacks.php
 */

require_once(__DIR__ . '/../connection.php');

echo "\n" . str_repeat("=", 70) . "\n";
echo "C2B PAYMENT CALLBACKS AUDIT TRAIL MIGRATION\n";
echo str_repeat("=", 70) . "\n\n";

// Create C2B payment callbacks table
$sql = "
CREATE TABLE IF NOT EXISTS `c2b_payment_callbacks` (
    `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    `checkout_request_id` VARCHAR(255) UNIQUE NOT NULL COMMENT 'Links to stk_push_sessions',
    `merchant_request_id` VARCHAR(255) COMMENT 'M-Pesa merchant request ID',
    `result_code` VARCHAR(10) COMMENT 'M-Pesa result code (0 = success)',
    `result_description` TEXT COMMENT 'M-Pesa result description',
    `amount` DECIMAL(15, 2) COMMENT 'Transaction amount',
    `mpesa_receipt_number` VARCHAR(50) COMMENT 'M-Pesa receipt/transaction reference',
    `phone_number` VARCHAR(20) COMMENT 'Phone number that made payment',
    `transaction_date` VARCHAR(20) COMMENT 'M-Pesa transaction timestamp (YYYYMMDDHHmmss)',
    `raw_response` LONGTEXT COMMENT 'Full JSON callback response from M-Pesa',
    `payment_recorded` BOOLEAN DEFAULT FALSE COMMENT 'Whether payment was successfully recorded',
    `notes` TEXT COMMENT 'Admin notes about this callback',
    `received_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When callback was received',
    `processed_at` TIMESTAMP NULL COMMENT 'When callback was processed',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT `fk_c2b_callbacks_checkout_id`
        FOREIGN KEY (`checkout_request_id`)
        REFERENCES `stk_push_sessions`(`checkout_request_id`)
        ON DELETE CASCADE,
    
    INDEX `idx_checkout_request_id` (`checkout_request_id`),
    INDEX `idx_mpesa_receipt` (`mpesa_receipt_number`),
    INDEX `idx_result_code` (`result_code`),
    INDEX `idx_phone_number` (`phone_number`),
    INDEX `idx_payment_recorded` (`payment_recorded`),
    INDEX `idx_received_at` (`received_at` DESC),
    INDEX `idx_processed_at` (`processed_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit trail for all C2B (STK Push) payment callbacks from M-Pesa'
";

echo "Creating c2b_payment_callbacks table...\n";

if ($conn->query($sql)) {
    echo "✓ Table created successfully\n\n";
    
    echo "✓ C2B Payment Callbacks Audit Trail Migration Complete!\n\n";
    echo "📊 TABLE STRUCTURE:\n";
    echo "  • checkout_request_id - Unique callback identifier\n";
    echo "  • result_code - M-Pesa status (0 = success)\n";
    echo "  • mpesa_receipt_number - M-Pesa transaction reference\n";
    echo "  • raw_response - Full callback JSON for debugging\n";
    echo "  • payment_recorded - Track if payment was successfully recorded\n";
    echo "  • received_at - Callback arrival timestamp\n";
    echo "  • processed_at - Payment processing timestamp\n\n";
    
    echo "🔍 USAGE:\n";
    echo "  1. All M-Pesa C2B callbacks are stored here for audit\n";
    echo "  2. Missing receipts can be investigated through raw_response\n";
    echo "  3. Failed payments can be reviewed and retried via admin interface\n";
    echo "  4. Supports troubleshooting callback delivery issues\n\n";
    
    exit(0);
} else {
    if (strpos($conn->error, "already exists") !== false) {
        echo "✓ Table already exists\n\n";
        exit(0);
    } else {
        echo "✗ Error: " . $conn->error . "\n";
        exit(1);
    }
}
?>
