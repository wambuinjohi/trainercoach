<?php
/**
 * Migration: Fix payments table schema
 * 
 * Adds missing columns for fee breakdown and updates status enum to include 'pending_verification'
 * These columns are needed for proper payment fee tracking and receipt validation
 * 
 * Usage: php scripts/migrate_payments_table_fix.php
 */

require_once(__DIR__ . '/../connection.php');

echo "\n" . str_repeat("=", 70) . "\n";
echo "PAYMENT TABLE SCHEMA FIX MIGRATION\n";
echo str_repeat("=", 70) . "\n\n";

$operations = [];
$errors = [];

// Step 1: Add missing columns if they don't exist
$columnChanges = [
    'base_service_amount' => "ADD COLUMN IF NOT EXISTS `base_service_amount` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Base service amount before fees' AFTER `amount`",
    'transport_fee' => "ADD COLUMN IF NOT EXISTS `transport_fee` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Transport fee' AFTER `base_service_amount`",
    'platform_fee' => "ADD COLUMN IF NOT EXISTS `platform_fee` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Platform commission fee' AFTER `transport_fee`",
    'vat_amount' => "ADD COLUMN IF NOT EXISTS `vat_amount` DECIMAL(15, 2) DEFAULT 0 COMMENT 'VAT amount' AFTER `platform_fee`",
    'trainer_net_amount' => "ADD COLUMN IF NOT EXISTS `trainer_net_amount` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Net amount paid to trainer' AFTER `vat_amount`"
];

echo "Step 1: Adding missing columns to payments table\n";
echo str_repeat("-", 70) . "\n";

foreach ($columnChanges as $columnName => $alterStatement) {
    echo "  Adding column: $columnName... ";
    
    $sql = "ALTER TABLE `payments` $alterStatement";
    
    if ($conn->query($sql)) {
        echo "✓\n";
        $operations[] = "✓ Added column: $columnName";
    } else {
        // Check if it's just a duplicate column error (column already exists)
        if (strpos($conn->error, "already exists") !== false || 
            strpos($conn->error, "Duplicate column") !== false) {
            echo "✓ (already exists)\n";
            $operations[] = "✓ Column $columnName already exists";
        } else {
            echo "✗\n";
            $errors[] = "Failed to add $columnName: " . $conn->error;
        }
    }
}

// Step 2: Modify status column to include 'pending_verification'
echo "\nStep 2: Updating status column enum values\n";
echo str_repeat("-", 70) . "\n";

$statusValues = "pending, completed, failed, refunded, pending_verification";
echo "  Current status values: $statusValues\n";

// Check current status column definition
$checkStatusSql = "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'status' AND TABLE_SCHEMA = DATABASE()";
$statusResult = $conn->query($checkStatusSql);

if ($statusResult && $statusResult->num_rows > 0) {
    $statusRow = $statusResult->fetch_assoc();
    $currentType = $statusRow['COLUMN_TYPE'];
    echo "  Current type: $currentType\n";
    
    // Modify the status column to support all required values
    $modifyStatusSql = "ALTER TABLE `payments` CHANGE COLUMN `status` `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, completed, failed, refunded, pending_verification'";
    
    echo "  Updating status column... ";
    if ($conn->query($modifyStatusSql)) {
        echo "✓\n";
        $operations[] = "✓ Updated status column to support pending_verification";
    } else {
        // If it's already a VARCHAR(50), no need to change
        if (strpos($conn->error, "Identical") !== false) {
            echo "✓ (already VARCHAR)\n";
            $operations[] = "✓ Status column already supports all values";
        } else {
            echo "✗\n";
            $errors[] = "Failed to update status column: " . $conn->error;
        }
    }
} else {
    echo "  ⚠ Could not check status column type\n";
}

// Step 3: Create indexes for new columns if they don't exist
echo "\nStep 3: Adding indexes for better query performance\n";
echo str_repeat("-", 70) . "\n";

$indexes = [
    ['column' => 'method', 'name' => 'idx_method'],
    ['column' => 'status', 'name' => 'idx_status'],
    ['column' => 'created_at', 'name' => 'idx_created_at'],
    ['column' => 'trainer_id', 'name' => 'idx_trainer_id'],
    ['column' => 'client_id', 'name' => 'idx_client_id']
];

foreach ($indexes as $idx) {
    echo "  Ensuring index on {$idx['column']}... ";
    
    // Check if index exists
    $checkIndexSql = "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'payments' AND INDEX_NAME = '{$idx['name']}' AND TABLE_SCHEMA = DATABASE()";
    $indexResult = $conn->query($checkIndexSql);
    
    if ($indexResult && $indexResult->num_rows > 0) {
        echo "✓ (exists)\n";
        $operations[] = "✓ Index {$idx['name']} already exists";
    } else {
        // Try to create index
        $createIndexSql = "ALTER TABLE `payments` ADD INDEX `{$idx['name']}` (`{$idx['column']}`)";
        if ($conn->query($createIndexSql)) {
            echo "✓\n";
            $operations[] = "✓ Created index {$idx['name']}";
        } else {
            // Skip index creation errors as they might already exist with different names
            echo "⚠ (skipped)\n";
            $operations[] = "⚠ Skipped index {$idx['name']}";
        }
    }
}

// Print summary
echo "\n" . str_repeat("=", 70) . "\n";
echo "MIGRATION SUMMARY\n";
echo str_repeat("=", 70) . "\n\n";

foreach ($operations as $op) {
    echo "$op\n";
}

if (!empty($errors)) {
    echo "\n⚠ ERRORS ENCOUNTERED:\n";
    echo str_repeat("-", 70) . "\n";
    foreach ($errors as $error) {
        echo "  $error\n";
    }
    echo "\n";
    exit(1);
} else {
    echo "\n✓ All payment table schema fixes applied successfully!\n";
    echo "\n📊 UPDATED SCHEMA:\n";
    echo "  • amount - Total payment amount\n";
    echo "  • base_service_amount - Service amount before fees\n";
    echo "  • transport_fee - Transport fee\n";
    echo "  • platform_fee - Platform commission\n";
    echo "  • vat_amount - VAT amount\n";
    echo "  • trainer_net_amount - Net amount to trainer\n";
    echo "\n📋 SUPPORTED STATUS VALUES:\n";
    echo "  • pending - Payment awaiting processing\n";
    echo "  • completed - Payment successfully received\n";
    echo "  • failed - Payment failed\n";
    echo "  • refunded - Payment refunded\n";
    echo "  • pending_verification - Payment received but receipt not captured (manual review needed)\n";
    echo "\n";
    exit(0);
}
?>
