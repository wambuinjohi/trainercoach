<?php
/**
 * Migration: Create bookings table
 * Usage: php scripts/migrate_bookings_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `client_id` VARCHAR(36) NOT NULL,
  `trainer_id` VARCHAR(36) NOT NULL,
  `session_date` DATE NOT NULL,
  `session_time` TIME NOT NULL,
  `duration_hours` INT DEFAULT 1,
  `total_sessions` INT DEFAULT 1,
  `status` VARCHAR(50) DEFAULT 'pending',
  `total_amount` DECIMAL(15, 2) NOT NULL,
  `notes` TEXT,
  `client_location_label` VARCHAR(255),
  `client_location_lat` DECIMAL(10, 8),
  `client_location_lng` DECIMAL(11, 8),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_bookings_client_id`
    FOREIGN KEY (`client_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_bookings_trainer_id`
    FOREIGN KEY (`trainer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  INDEX `idx_client_id` (`client_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_session_date` (`session_date` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: bookings table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
