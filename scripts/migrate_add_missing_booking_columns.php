<?php
/**
 * Migration: Add missing columns to bookings table
 * 
 * This migration adds all the columns needed for:
 * - Multi-session bookings (sessions, session_phase)
 * - Fee breakdown calculations (base_service_amount, transport_fee, platform_fee, vat_amount, trainer_net_amount, client_surcharge)
 * - Group training support (is_group_training, group_size_tier_name, pricing_model_used, group_rate_per_unit)
 * - Category support (category_id)
 * 
 * Usage: php scripts/migrate_add_missing_booking_columns.php
 */

require_once(__DIR__ . '/../connection.php');

// Array of ALTER statements to add missing columns
$alterStatements = [
    // Multi-session columns
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `sessions` JSON NULL COMMENT 'Multi-session booking details: [{date, start_time, end_time, duration_hours}, ...]' AFTER `session_time`",
    
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `session_phase` VARCHAR(50) NULL COMMENT 'Booking session lifecycle state' AFTER `status`",
    
    // Fee breakdown columns
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `base_service_amount` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Base service amount before fees' AFTER `total_amount`",
    
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `transport_fee` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Transport fee based on distance' AFTER `base_service_amount`",
    
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `platform_fee` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Platform fee (25% deducted from trainer)' AFTER `transport_fee`",
    
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `vat_amount` DECIMAL(15, 2) DEFAULT 0 COMMENT 'VAT amount (16% charged to client)' AFTER `platform_fee`",
    
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `trainer_net_amount` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Net amount trainer receives' AFTER `vat_amount`",
    
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `client_surcharge` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Surcharge to client (VAT)' AFTER `trainer_net_amount`",
    
    // Category support
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `category_id` INT NULL COMMENT 'Training category ID' AFTER `trainer_id`",
    
    // Group training columns
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `is_group_training` BOOLEAN DEFAULT FALSE COMMENT 'Whether this is a group training booking' AFTER `client_location_lng`",
    
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `group_size_tier_name` VARCHAR(50) NULL COMMENT 'Name of the group size tier for group training' AFTER `is_group_training`",
    
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `pricing_model_used` VARCHAR(50) NULL COMMENT 'Pricing model used for group training (fixed or per_person)' AFTER `group_size_tier_name`",
    
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `group_rate_per_unit` DECIMAL(10, 2) NULL COMMENT 'Rate per unit for group training' AFTER `pricing_model_used`"
];

$successCount = 0;
$failureCount = 0;
$messages = [];

echo "Adding missing columns to bookings table...\n\n";

foreach ($alterStatements as $sql) {
    if ($conn->query($sql)) {
        $successCount++;
        // Extract column name from ALTER statement
        preg_match('/ADD COLUMN IF NOT EXISTS `(\w+)`/', $sql, $matches);
        $columnName = $matches[1] ?? 'unknown';
        $messages[] = "✓ $columnName";
        echo "✓ $columnName\n";
    } else {
        $failureCount++;
        preg_match('/ADD COLUMN IF NOT EXISTS `(\w+)`/', $sql, $matches);
        $columnName = $matches[1] ?? 'unknown';
        $messages[] = "✗ $columnName: " . $conn->error;
        echo "✗ $columnName: " . $conn->error . "\n";
    }
}

echo "\n" . str_repeat("=", 60) . "\n";
echo "Migration Summary\n";
echo str_repeat("=", 60) . "\n";
echo "Columns Added: $successCount\n";
echo "Failed: $failureCount\n";
echo "\nDetails:\n";
foreach ($messages as $msg) {
    echo "  $msg\n";
}

if ($failureCount === 0) {
    echo "\n✓ All missing columns added successfully!\n";
    echo "\nYou can now use booking_create API action.\n";
    exit(0);
} else {
    echo "\n⚠ Some alterations failed. Review the errors above.\n";
    exit(1);
}
?>
