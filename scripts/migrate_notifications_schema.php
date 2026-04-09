<?php
/**
 * Migration: Add missing columns to notifications table
 * 
 * This script adds the following columns if they don't exist:
 * - booking_id: for linking notifications to bookings
 * - action_type: for specifying the action type (e.g., 'rate', etc.)
 * 
 * Usage: php scripts/migrate_notifications_schema.php
 */

require_once(__DIR__ . '/../connection.php');

$errors = [];
$successes = [];

// ============================================================================
// 1. ADD booking_id TO notifications TABLE
// ============================================================================

echo "Adding booking_id column to notifications table...\n";

$checkBookingId = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME='notifications' AND COLUMN_NAME='booking_id' AND TABLE_SCHEMA=DATABASE()";
$result = $conn->query($checkBookingId);

if ($result && $result->num_rows === 0) {
    $sql = "ALTER TABLE `notifications` 
            ADD COLUMN `booking_id` VARCHAR(36) COMMENT 'Associated booking ID' AFTER `user_id`,
            ADD CONSTRAINT `fk_notifications_booking_id`
                FOREIGN KEY (`booking_id`)
                REFERENCES `bookings`(`id`)
                ON DELETE SET NULL";
    
    if ($conn->query($sql)) {
        $successes[] = "✓ Added booking_id column to notifications table";
    } else {
        $errors[] = "✗ Failed to add booking_id: " . $conn->error;
    }
} else {
    $successes[] = "✓ booking_id column already exists in notifications table";
}

// Add index for booking_id if it doesn't exist
$checkBookingIndex = "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_NAME='notifications' AND COLUMN_NAME='booking_id' AND TABLE_SCHEMA=DATABASE()";
$result = $conn->query($checkBookingIndex);

if ($result && $result->num_rows === 0) {
    $sql = "ALTER TABLE `notifications` ADD INDEX `idx_booking_id` (`booking_id`)";
    if ($conn->query($sql)) {
        $successes[] = "✓ Added idx_booking_id index to notifications table";
    } else {
        // Index might already exist, not critical
        $successes[] = "ℹ idx_booking_id index already exists or skipped";
    }
}

// ============================================================================
// 2. ADD action_type TO notifications TABLE
// ============================================================================

echo "\nAdding action_type column to notifications table...\n";

$checkActionType = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME='notifications' AND COLUMN_NAME='action_type' AND TABLE_SCHEMA=DATABASE()";
$result = $conn->query($checkActionType);

if ($result && $result->num_rows === 0) {
    $sql = "ALTER TABLE `notifications` 
            ADD COLUMN `action_type` VARCHAR(50) COMMENT 'Action type (e.g., rate, message, etc.)' AFTER `type`";
    
    if ($conn->query($sql)) {
        $successes[] = "✓ Added action_type column to notifications table";
    } else {
        $errors[] = "✗ Failed to add action_type: " . $conn->error;
    }
} else {
    $successes[] = "✓ action_type column already exists in notifications table";
}

// ============================================================================
// SUMMARY
// ============================================================================

echo "\n" . str_repeat("=", 70) . "\n";
echo "MIGRATION SUMMARY\n";
echo str_repeat("=", 70) . "\n\n";

foreach ($successes as $msg) {
    echo $msg . "\n";
}

if (!empty($errors)) {
    echo "\nErrors encountered:\n";
    foreach ($errors as $msg) {
        echo $msg . "\n";
    }
    exit(1);
} else {
    echo "\n✓ Migration completed successfully!\n";
    exit(0);
}
?>
