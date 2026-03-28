<?php
/**
 * STK Push Retry Tracking Migration
 * Adds columns to support persistent retry functionality for STK push payments
 * 
 * Usage: php scripts/migrate_stk_retry_tracking.php
 */

require_once(__DIR__ . '/../connection.php');

echo "\n" . str_repeat("=", 80) . "\n";
echo "STK PUSH RETRY TRACKING MIGRATION\n";
echo str_repeat("=", 80) . "\n\n";

// Check if table exists
$result = $conn->query("SHOW TABLES LIKE 'stk_push_sessions'");
if ($result->num_rows === 0) {
    echo "✗ Error: stk_push_sessions table does not exist\n";
    echo "Run migrate_payment_tables_complete.php first\n";
    exit(1);
}

// Define columns to add
$columns_to_add = [
    'retry_count' => "
        ALTER TABLE stk_push_sessions 
        ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0 
        COMMENT 'Number of retry attempts made'
    ",
    'last_retry_at' => "
        ALTER TABLE stk_push_sessions 
        ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP NULL 
        COMMENT 'Timestamp of the last retry attempt'
    ",
    'next_retry_at' => "
        ALTER TABLE stk_push_sessions 
        ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP NULL 
        COMMENT 'Timestamp when the next retry should be attempted'
    ",
    'should_retry' => "
        ALTER TABLE stk_push_sessions 
        ADD COLUMN IF NOT EXISTS should_retry BOOLEAN DEFAULT TRUE 
        COMMENT 'Flag to indicate if this payment should be retried'
    ",
    'merchant_request_id' => "
        ALTER TABLE stk_push_sessions 
        ADD COLUMN IF NOT EXISTS merchant_request_id VARCHAR(255) 
        COMMENT 'M-Pesa merchant request ID for status queries'
    "
];

$success_count = 0;
$fail_count = 0;

echo "Adding retry tracking columns...\n";
echo str_repeat("-", 80) . "\n";

foreach ($columns_to_add as $col_name => $sql) {
    // Check if column already exists
    $check_result = $conn->query("
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'stk_push_sessions' 
        AND COLUMN_NAME = '$col_name'
        AND TABLE_SCHEMA = DATABASE()
    ");
    
    if ($check_result && $check_result->num_rows > 0) {
        echo "  ℹ Column '$col_name' already exists\n";
        $success_count++;
        continue;
    }
    
    if ($conn->query($sql)) {
        echo "  ✓ Column '$col_name' added successfully\n";
        $success_count++;
    } else {
        echo "  ✗ Error adding column '$col_name': " . $conn->error . "\n";
        $fail_count++;
    }
}

// Add index for retry queries
$retry_index = "
    ALTER TABLE stk_push_sessions 
    ADD INDEX IF NOT EXISTS idx_next_retry (next_retry_at, should_retry)
";

echo "\nAdding indexes for retry queries...\n";
echo str_repeat("-", 80) . "\n";

if ($conn->query($retry_index)) {
    echo "  ✓ Index 'idx_next_retry' added successfully\n";
    $success_count++;
} else {
    if (strpos($conn->error, "Duplicate") !== false) {
        echo "  ℹ Index 'idx_next_retry' already exists\n";
        $success_count++;
    } else {
        echo "  ✗ Error adding index: " . $conn->error . "\n";
        $fail_count++;
    }
}

echo "\n" . str_repeat("=", 80) . "\n";
echo "MIGRATION SUMMARY\n";
echo str_repeat("=", 80) . "\n\n";

echo "✓ Columns/Indexes added: $success_count\n";
if ($fail_count > 0) {
    echo "✗ Failures: $fail_count\n";
    exit(1);
} else {
    echo "\n✓ STK Push retry tracking migration completed successfully!\n";
    echo "\nNew columns added:\n";
    echo "  • retry_count - Tracks number of retry attempts\n";
    echo "  • last_retry_at - Timestamp of last retry\n";
    echo "  • next_retry_at - When next retry should occur\n";
    echo "  • should_retry - Flag to enable/disable retries\n";
    echo "  • merchant_request_id - M-Pesa request ID for queries\n";
    echo "\n";
    exit(0);
}
?>
