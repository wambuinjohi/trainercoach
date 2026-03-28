<?php
/**
 * Migration: Create session_reminders table
 * Tracks scheduled session reminders for 2-hour pre-session notifications
 * Usage: php scripts/migrate_session_reminders_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `session_reminders` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `booking_id` VARCHAR(36) NOT NULL,
  `trainer_id` VARCHAR(36) NOT NULL,
  `client_id` VARCHAR(36) NOT NULL,
  `reminder_type` VARCHAR(50) DEFAULT '2hour',
  `scheduled_for` DATETIME NOT NULL,
  `sent_at` DATETIME NULL,
  `status` ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT `fk_session_reminders_booking_id`
    FOREIGN KEY (`booking_id`)
    REFERENCES `bookings`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_session_reminders_trainer_id`
    FOREIGN KEY (`trainer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_session_reminders_client_id`
    FOREIGN KEY (`client_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  
  INDEX `idx_booking_id` (`booking_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_client_id` (`client_id`),
  INDEX `idx_status_scheduled` (`status`, `scheduled_for`),
  INDEX `idx_scheduled_for` (`scheduled_for` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: session_reminders table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
