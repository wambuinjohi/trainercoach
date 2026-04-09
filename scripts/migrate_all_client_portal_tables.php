<?php
/**
 * Master Migration: Create all client portal tables
 * Usage: php scripts/migrate_all_client_portal_tables.php
 * 
 * This script creates all missing tables required for the client portal:
 * - bookings
 * - payments
 * - payment_methods
 * - messages
 * - notifications
 * - reviews
 * - referrals
 * - categories
 */

require_once(__DIR__ . '/../connection.php');

$migrations = [
    'categories' => "
        CREATE TABLE IF NOT EXISTS `categories` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `name` VARCHAR(100) NOT NULL UNIQUE,
          `icon` VARCHAR(50),
          `description` TEXT,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX `idx_name` (`name`),
          INDEX `idx_created_at` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'bookings' => "
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
    ",
    'payments' => "
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
    ",
    'payment_methods' => "
        CREATE TABLE IF NOT EXISTS `payment_methods` (
          `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          `user_id` VARCHAR(36) NOT NULL,
          `method` VARCHAR(255) NOT NULL,
          `details` JSON,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT `fk_payment_methods_user_id`
            FOREIGN KEY (`user_id`)
            REFERENCES `users`(`id`)
            ON DELETE CASCADE,
          INDEX `idx_user_id` (`user_id`),
          INDEX `idx_created_at` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'messages' => "
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
    ",
    'notifications' => "
        CREATE TABLE IF NOT EXISTS `notifications` (
          `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          `user_id` VARCHAR(36) NOT NULL,
          `title` VARCHAR(255),
          `body` TEXT,
          `message` TEXT,
          `type` VARCHAR(50) DEFAULT 'info',
          `read` BOOLEAN DEFAULT FALSE,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT `fk_notifications_user_id`
            FOREIGN KEY (`user_id`)
            REFERENCES `users`(`id`)
            ON DELETE CASCADE,
          INDEX `idx_user_id` (`user_id`),
          INDEX `idx_read` (`read`),
          INDEX `idx_created_at` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'reviews' => "
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
    ",
    'referrals' => "
        CREATE TABLE IF NOT EXISTS `referrals` (
          `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          `code` VARCHAR(50) NOT NULL UNIQUE,
          `referrer_id` VARCHAR(36) NOT NULL,
          `referee_id` VARCHAR(36),
          `discount_used` BOOLEAN DEFAULT FALSE,
          `discount_amount` DECIMAL(15, 2) DEFAULT 0,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT `fk_referrals_referrer_id`
            FOREIGN KEY (`referrer_id`)
            REFERENCES `users`(`id`)
            ON DELETE CASCADE,
          CONSTRAINT `fk_referrals_referee_id`
            FOREIGN KEY (`referee_id`)
            REFERENCES `users`(`id`)
            ON DELETE SET NULL,
          INDEX `idx_referrer_id` (`referrer_id`),
          INDEX `idx_referee_id` (`referee_id`),
          INDEX `idx_code` (`code`),
          INDEX `idx_discount_used` (`discount_used`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    "
];

$successCount = 0;
$failureCount = 0;
$messages = [];

echo "Starting client portal migrations...\n\n";

foreach ($migrations as $tableName => $sql) {
    if ($conn->query($sql)) {
        $successCount++;
        $messages[] = "✓ $tableName";
        echo "✓ $tableName\n";
    } else {
        $failureCount++;
        $messages[] = "✗ $tableName: " . $conn->error;
        echo "✗ $tableName: " . $conn->error . "\n";
    }
}

echo "\n" . str_repeat("=", 50) . "\n";
echo "Migration Summary\n";
echo str_repeat("=", 50) . "\n";
echo "Created: $successCount\n";
echo "Failed: $failureCount\n";
echo "\nMessages:\n";
foreach ($messages as $msg) {
    echo "  $msg\n";
}

if ($failureCount === 0) {
    echo "\n✓ All client portal migrations completed successfully!\n";
    exit(0);
} else {
    echo "\n⚠ Some migrations failed. Review the errors above.\n";
    exit(1);
}
?>
