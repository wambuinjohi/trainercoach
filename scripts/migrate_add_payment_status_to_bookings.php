<?php
/**
 * Migration: Add payment_status column to bookings table
 * 
 * Adds explicit payment status tracking to bookings table to distinguish
 * between booking status and payment status. This is critical for STK push
 * payments which may be initiated but not yet completed.
 * 
 * Payment Status Values:
 * - pending: Payment not yet initiated
 * - processing: STK push initiated, waiting for user to enter PIN
 * - completed: Payment successful
 * - failed: Payment failed or abandoned
 * 
 * Usage: php scripts/migrate_add_payment_status_to_bookings.php
 */

require_once(__DIR__ . '/../connection.php');

echo "\n" . str_repeat("=", 80) . "\n";
echo "MIGRATION: ADD PAYMENT_STATUS TO BOOKINGS TABLE\n";
echo str_repeat("=", 80) . "\n\n";

// Check if bookings table exists
$result = $conn->query("SHOW TABLES LIKE 'bookings'");
if ($result->num_rows === 0) {
    echo "✗ Error: bookings table does not exist\n";
    echo "Run migrate_bookings_table.php first\n";
    exit(1);
}

$alterStatements = [
    'payment_status' => "
        ALTER TABLE `bookings` 
        ADD COLUMN IF NOT EXISTS `payment_status` VARCHAR(50) DEFAULT 'pending'
        COMMENT 'Payment status: pending, processing, completed, failed'
    ",
    'stk_session_id' => "
        ALTER TABLE `bookings` 
        ADD COLUMN IF NOT EXISTS `stk_session_id` VARCHAR(36) NULL
        COMMENT 'Associated STK push session ID'
    ",
    'idx_payment_status' => "
        ALTER TABLE `bookings` 
        ADD INDEX IF NOT EXISTS `idx_payment_status` (`payment_status`)
    ",
    'idx_stk_session_id' => "
        ALTER TABLE `bookings` 
        ADD INDEX IF NOT EXISTS `idx_stk_session_id` (`stk_session_id`)
    "
];

$successCount = 0;
$failureCount = 0;

echo "Adding payment tracking columns...\n";
echo str_repeat("-", 80) . "\n";

foreach ($alterStatements as $col_name => $sql) {
    // Check if column/index already exists
    if (strpos($col_name, 'idx_') === 0) {
        // This is an index
        $indexName = str_replace('idx_', '', $col_name);
        $check_result = $conn->query("
            SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_NAME = 'bookings' 
            AND INDEX_NAME = 'idx_$indexName'
            AND TABLE_SCHEMA = DATABASE()
        ");
    } else {
        // This is a column
        $check_result = $conn->query("
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'bookings' 
            AND COLUMN_NAME = '$col_name'
            AND TABLE_SCHEMA = DATABASE()
        ");
    }
    
    if ($check_result && $check_result->num_rows > 0) {
        echo "  ℹ $col_name already exists\n";
        $successCount++;
        continue;
    }
    
    if ($conn->query($sql)) {
        echo "  ✓ $col_name added successfully\n";
        $successCount++;
    } else {
        echo "  ✗ Error adding $col_name: " . $conn->error . "\n";
        $failureCount++;
    }
}

echo "\n" . str_repeat("=", 80) . "\n";
echo "MIGRATION SUMMARY\n";
echo str_repeat("=", 80) . "\n\n";

echo "✓ Columns/Indexes added: $successCount\n";
if ($failureCount > 0) {
    echo "✗ Failures: $failureCount\n";
    exit(1);
} else {
    echo "\n✓ Payment status migration completed successfully!\n";
    echo "\nNew columns/indexes:\n";
    echo "  • payment_status - Tracks payment state independently from booking status\n";
    echo "  • stk_session_id - Links booking to STK push session\n";
    echo "\nPayment status values:\n";
    echo "  • pending - Payment not yet initiated\n";
    echo "  • processing - STK initiated, waiting for user response\n";
    echo "  • completed - Payment successful\n";
    echo "  • failed - Payment failed or abandoned\n";
    echo "\n";
    exit(0);
}
?>
