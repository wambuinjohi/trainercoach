<?php
/**
 * Migration: Create user_profiles table
 * Usage: php scripts/migrate_user_profiles.php
 */

// Include database connection
require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `user_type` VARCHAR(50) NOT NULL DEFAULT 'client',
  `full_name` VARCHAR(255),
  `phone_number` VARCHAR(20),
  `bio` TEXT,
  `profile_image` VARCHAR(255),
  `disciplines` JSON,
  `certifications` JSON,
  `hourly_rate` DECIMAL(10, 2),
  `service_radius` INT,
  `availability` JSON,
  `rating` DECIMAL(3, 2),
  `total_reviews` INT DEFAULT 0,
  `is_approved` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_user_type (user_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: user_profiles table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
