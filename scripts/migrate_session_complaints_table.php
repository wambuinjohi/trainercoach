<?php
/**
 * Migration: Create session_complaints table
 * Stores complaints filed by trainers or clients during sessions
 * Usage: php scripts/migrate_session_complaints_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `session_complaints` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `booking_id` VARCHAR(36) NOT NULL,
  `filed_by_trainer` BOOLEAN DEFAULT FALSE,
  `filed_by_client` BOOLEAN DEFAULT FALSE,
  `category` VARCHAR(50) NOT NULL,
  `description` TEXT NOT NULL,
  `attachment_url` VARCHAR(255),
  `status` VARCHAR(50) DEFAULT 'open',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_session_complaints_booking_id`
    FOREIGN KEY (`booking_id`)
    REFERENCES `bookings`(`id`)
    ON DELETE CASCADE,
  INDEX `idx_booking_id` (`booking_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_category` (`category`),
  INDEX `idx_filed_by_trainer` (`filed_by_trainer`),
  INDEX `idx_filed_by_client` (`filed_by_client`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: session_complaints table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
