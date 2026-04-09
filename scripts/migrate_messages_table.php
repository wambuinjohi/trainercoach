<?php
/**
 * Migration: Create messages table
 * Usage: php scripts/migrate_messages_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `messages` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `sender_id` VARCHAR(36) NOT NULL,
  `recipient_id` VARCHAR(36) NOT NULL,
  `trainer_id` VARCHAR(36),
  `client_id` VARCHAR(36),
  `content` TEXT NOT NULL,
  `read_by_trainer` BOOLEAN DEFAULT FALSE,
  `read_by_client` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_messages_sender_id`
    FOREIGN KEY (`sender_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_messages_recipient_id`
    FOREIGN KEY (`recipient_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  INDEX `idx_sender_id` (`sender_id`),
  INDEX `idx_recipient_id` (`recipient_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_client_id` (`client_id`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: messages table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
