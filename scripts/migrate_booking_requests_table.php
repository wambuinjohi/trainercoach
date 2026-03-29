<?php
/**
 * Migration: Create booking_requests table
 * 
 * This table tracks all booking-related requests:
 * - Change trainer requests
 * - Reschedule requests
 * - Transfer booking requests
 * - Refund requests
 * 
 * Usage: php scripts/migrate_booking_requests_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `booking_requests` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `booking_id` VARCHAR(36) NOT NULL COMMENT 'Associated booking',
  `request_type` VARCHAR(50) NOT NULL COMMENT 'trainer_change, reschedule, transfer, refund',
  `requested_by` VARCHAR(36) NOT NULL COMMENT 'User who made the request (client_id)',
  `target_trainer_id` VARCHAR(36) COMMENT 'For trainer_change: new trainer ID',
  `target_date` DATE COMMENT 'For reschedule: new session date',
  `target_time` TIME COMMENT 'For reschedule: new session time',
  `target_user_id` VARCHAR(36) COMMENT 'For transfer: recipient client user ID',
  `reason` TEXT COMMENT 'Reason for request (optional)',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, approved, declined, cancelled',
  `admin_notes` TEXT COMMENT 'Notes from admin/trainer',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL COMMENT 'When the request was approved/declined',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT `fk_booking_requests_booking_id`
    FOREIGN KEY (`booking_id`)
    REFERENCES `bookings`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_booking_requests_requested_by`
    FOREIGN KEY (`requested_by`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  
  INDEX `idx_booking_id` (`booking_id`),
  INDEX `idx_request_type` (`request_type`),
  INDEX `idx_status` (`status`),
  INDEX `idx_requested_by` (`requested_by`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: booking_requests table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
