<?php
/**
 * Migration: Create payments table
 * Usage: php scripts/migrate_payments_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `booking_id` VARCHAR(36),
  `amount` DECIMAL(15, 2) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'pending',
  `method` VARCHAR(50) NOT NULL,
  `transaction_reference` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_payments_user_id`
    FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_payments_booking_id`
    FOREIGN KEY (`booking_id`)
    REFERENCES `bookings`(`id`)
    ON DELETE SET NULL,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_booking_id` (`booking_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: payments table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
