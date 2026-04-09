<?php
/**
 * Migration: Create payout_requests table
 * Usage: php scripts/migrate_payout_requests_table.php
 * 
 * Creates table for tracking trainer payout requests and approvals
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `payout_requests` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `trainer_id` VARCHAR(36) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL COMMENT 'Requested amount before commission',
  `commission` DECIMAL(15, 2) COMMENT 'Commission deducted',
  `net_amount` DECIMAL(15, 2) COMMENT 'Amount after commission',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, approved, completed, rejected',
  `b2c_payment_id` VARCHAR(36) COMMENT 'Links to b2c_payments table',
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `approved_at` TIMESTAMP NULL,
  `completed_at` TIMESTAMP NULL,
  `rejection_reason` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_payout_requests_trainer_id`
    FOREIGN KEY (`trainer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_payout_requests_b2c_payment_id`
    FOREIGN KEY (`b2c_payment_id`)
    REFERENCES `b2c_payments`(`id`)
    ON DELETE SET NULL,
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_requested_at` (`requested_at` DESC),
  INDEX `idx_b2c_payment_id` (`b2c_payment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: payout_requests table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
