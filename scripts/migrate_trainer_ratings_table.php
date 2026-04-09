<?php
/**
 * Migration: Create trainer_ratings table
 * Stores trainers' ratings of clients and the app after session completion
 * Usage: php scripts/migrate_trainer_ratings_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `trainer_ratings` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `booking_id` VARCHAR(36) NOT NULL,
  `trainer_id` VARCHAR(36) NOT NULL,
  `client_rating` INT NOT NULL,
  `app_rating` INT NOT NULL,
  `review` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_trainer_ratings_booking_id`
    FOREIGN KEY (`booking_id`)
    REFERENCES `bookings`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_trainer_ratings_trainer_id`
    FOREIGN KEY (`trainer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  INDEX `idx_booking_id` (`booking_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: trainer_ratings table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
