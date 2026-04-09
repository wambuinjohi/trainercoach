<?php
/**
 * Migration: Create reviews table
 * Usage: php scripts/migrate_reviews_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `booking_id` VARCHAR(36),
  `client_id` VARCHAR(36) NOT NULL,
  `trainer_id` VARCHAR(36) NOT NULL,
  `rating` DECIMAL(3, 2) NOT NULL,
  `comment` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_reviews_booking_id`
    FOREIGN KEY (`booking_id`)
    REFERENCES `bookings`(`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_reviews_client_id`
    FOREIGN KEY (`client_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_trainer_id`
    FOREIGN KEY (`trainer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_client_id` (`client_id`),
  INDEX `idx_rating` (`rating`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: reviews table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
