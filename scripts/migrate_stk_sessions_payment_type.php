<?php
/**
 * Migration: Add payment_type column to stk_push_sessions table
 *
 * This migration adds the payment_type column that was missing from the stk_push_sessions table.
 * The payment_type is crucial for correctly determining which shortcode (paybill vs buygods)
 * to use when querying STK Push status.
 *
 * Without this column, the system was defaulting to paybill shortcode, causing "Invalid BusinessShortCode"
 * errors for Buy Goods (CustomerBuyGoodsOnline) transactions.
 *
 * Default: buygods (CustomerBuyGoodsOnline) - update if your system uses Paybill instead
 *
 * Usage: php scripts/migrate_stk_sessions_payment_type.php
 */

require_once(__DIR__ . '/../connection.php');

echo "[MIGRATION] Adding payment_type column to stk_push_sessions table...\n";

// Check if table exists
$checkTableSql = "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stk_push_sessions'";
$tableExists = $conn->query($checkTableSql);

if (!$tableExists || $tableExists->num_rows === 0) {
    echo "[MIGRATION] stk_push_sessions table does not exist. It will be created automatically on next STK push initiation.\n";
    exit(0);
}

// Check if payment_type column already exists
$checkColumnSql = "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stk_push_sessions' AND COLUMN_NAME = 'payment_type'";
$columnExists = $conn->query($checkColumnSql);

if ($columnExists && $columnExists->num_rows > 0) {
    echo "[MIGRATION] payment_type column already exists in stk_push_sessions. No migration needed.\n";
    exit(0);
}

echo "[MIGRATION] payment_type column not found. Adding it now...\n";

// Add the payment_type column to the table
$addColumnSql = "ALTER TABLE `stk_push_sessions` ADD COLUMN `payment_type` VARCHAR(50) DEFAULT 'buygods' COMMENT 'Payment type: paybill or buygods (CustomerBuyGoodsOnline)' AFTER `merchant_request_id`";

if (!$conn->query($addColumnSql)) {
    echo "[MIGRATION ERROR] Failed to add payment_type column: " . $conn->error . "\n";
    exit(1);
}

echo "[MIGRATION SUCCESS] payment_type column added successfully\n";

// Add index for payment_type if it doesn't exist
$checkIndexSql = "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stk_push_sessions' AND INDEX_NAME = 'idx_payment_type'";
$indexExists = $conn->query($checkIndexSql);

if (!$indexExists || $indexExists->num_rows === 0) {
    echo "[MIGRATION] Adding index for payment_type column...\n";
    $addIndexSql = "ALTER TABLE `stk_push_sessions` ADD INDEX `idx_payment_type` (`payment_type`)";

    if (!$conn->query($addIndexSql)) {
        echo "[MIGRATION WARNING] Failed to add index: " . $conn->error . "\n";
        // This is not critical, continue
    } else {
        echo "[MIGRATION SUCCESS] Index created for payment_type column\n";
    }
} else {
    echo "[MIGRATION] Index for payment_type already exists\n";
}

// Update existing sessions to have correct payment_type based on their credentials
// This is a best-effort approach - default to buygods (CustomerBuyGoodsOnline) for existing sessions
echo "[MIGRATION] Setting payment_type for existing sessions without payment_type...\n";
$updateSql = "UPDATE stk_push_sessions SET payment_type = 'buygods' WHERE payment_type IS NULL OR payment_type = ''";
$result = $conn->query($updateSql);

if (!$result) {
    echo "[MIGRATION WARNING] Failed to update existing sessions: " . $conn->error . "\n";
} else {
    $affectedRows = $conn->affected_rows;
    echo "[MIGRATION SUCCESS] Updated $affectedRows existing sessions to payment_type='buygods' (CustomerBuyGoodsOnline, default)\n";
    echo "[MIGRATION NOTE] If any of these were Paybill transactions, you may need to manually update them\n";
}

echo "[MIGRATION] ========== MIGRATION COMPLETE ==========\n";
echo "[MIGRATION] The stk_push_sessions table now includes payment_type column\n";
echo "[MIGRATION] Future STK Push initiations will automatically store the correct payment_type\n";
echo "[MIGRATION] This fixes the 'Invalid BusinessShortCode' error for Buy Goods payments\n";
?>
