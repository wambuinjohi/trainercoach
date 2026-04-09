<?php
/**
 * Migration: Create sponsor_commissions table
 * Usage: php scripts/migrate_sponsor_commissions_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `sponsor_commissions` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `sponsor_trainer_id` VARCHAR(36) NOT NULL,
  `sponsored_trainer_id` VARCHAR(36) NOT NULL,
  `booking_id` VARCHAR(36) NOT NULL,
  `payment_id` VARCHAR(36),
  `commission_amount` DECIMAL(10, 2) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `paid_at` DATETIME,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sponsor_trainer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sponsored_trainer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  INDEX idx_sponsor_trainer_id (sponsor_trainer_id),
  INDEX idx_sponsored_trainer_id (sponsored_trainer_id),
  INDEX idx_booking_id (booking_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: sponsor_commissions table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
