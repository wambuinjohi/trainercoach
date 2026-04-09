<?php
/**
 * Migration: Create discipline_requests table
 * This table tracks trainer-submitted discipline requests for admin approval
 * Usage: php scripts/migrate_discipline_requests_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `discipline_requests` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique discipline request ID (UUID)',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Trainer who submitted the request',
  `category_name` VARCHAR(100) NOT NULL COMMENT 'Requested discipline name',
  `category_icon` VARCHAR(50) COMMENT 'Suggested icon for the discipline',
  `category_description` TEXT COMMENT 'Description of the discipline',
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Request status',
  `admin_notes` TEXT COMMENT 'Admin notes when approving or rejecting',
  `approved_category_id` INT COMMENT 'ID of the created category when approved',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL COMMENT 'When the request was reviewed',
  `reviewed_by_admin_id` VARCHAR(36) COMMENT 'Which admin reviewed this request',
  
  CONSTRAINT `fk_discipline_requests_trainer_id`
    FOREIGN KEY (`trainer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_discipline_requests_category_id`
    FOREIGN KEY (`approved_category_id`)
    REFERENCES `categories`(`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_discipline_requests_admin_id`
    FOREIGN KEY (`reviewed_by_admin_id`)
    REFERENCES `users`(`id`)
    ON DELETE SET NULL,
  
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at` DESC),
  INDEX `idx_trainer_status` (`trainer_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: discipline_requests table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
