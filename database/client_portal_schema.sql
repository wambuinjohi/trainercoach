-- ============================================================================
-- CLIENT PORTAL DATABASE SCHEMA
-- ============================================================================
-- This SQL file creates all database tables required for the client portal
-- including bookings, payments, messages, notifications, reviews, referrals,
-- payment methods, and categories.
--
-- Usage: 
--   MySQL: mysql -u root -p trainer_db < database/client_portal_schema.sql
--   Or import via phpMyAdmin/MySQL Workbench
--
-- Database: trainer_db (or your configured database name)
-- Charset: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- ============================================================================

-- ============================================================================
-- NOTE: Assumes users and user_profiles tables already exist
-- ============================================================================

-- ============================================================================
-- 1. CATEGORIES TABLE
-- ============================================================================
-- Stores training categories/disciplines available on the platform
-- ============================================================================

DROP TABLE IF EXISTS `categories`;

CREATE TABLE `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE COMMENT 'Category name (e.g., Yoga, Boxing, CrossFit)',
  `icon` VARCHAR(50) COMMENT 'Emoji or icon identifier',
  `description` TEXT COMMENT 'Category description',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_name` (`name`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. BOOKINGS TABLE
-- ============================================================================
-- Stores training session bookings between clients and trainers
-- ============================================================================

DROP TABLE IF EXISTS `bookings`;

CREATE TABLE `bookings` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique booking ID (UUID)',
  `client_id` VARCHAR(36) NOT NULL COMMENT 'Client user ID',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Trainer user ID',
  `session_date` DATE NOT NULL COMMENT 'Date of training session',
  `session_time` TIME NOT NULL COMMENT 'Start time of training session',
  `duration_hours` INT DEFAULT 1 COMMENT 'Session duration in hours',
  `total_sessions` INT DEFAULT 1 COMMENT 'Number of sessions booked',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, confirmed, in_session, completed, cancelled, rescheduled',
  `total_amount` DECIMAL(15, 2) NOT NULL COMMENT 'Total amount to be paid',
  `notes` TEXT COMMENT 'Optional booking notes',
  `client_location_label` VARCHAR(255) COMMENT 'Client location name',
  `client_location_lat` DECIMAL(10, 8) COMMENT 'Latitude coordinate',
  `client_location_lng` DECIMAL(11, 8) COMMENT 'Longitude coordinate',
  `in_session_at` TIMESTAMP NULL COMMENT 'Timestamp when session was marked as in_session',
  `completed_at` TIMESTAMP NULL COMMENT 'Timestamp when session was marked as completed',
  `rating_submitted` BOOLEAN DEFAULT FALSE COMMENT 'Whether client has submitted a rating for this session',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. PAYMENTS TABLE
-- ============================================================================
-- Stores payment transactions for bookings
-- ============================================================================

DROP TABLE IF EXISTS `payments`;

CREATE TABLE `payments` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique payment ID (UUID)',
  `user_id` VARCHAR(36) NOT NULL COMMENT 'User who made the payment',
  `booking_id` VARCHAR(36) COMMENT 'Associated booking ID (nullable)',
  `amount` DECIMAL(15, 2) NOT NULL COMMENT 'Payment amount',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, completed, failed, refunded',
  `method` VARCHAR(50) NOT NULL COMMENT 'Payment method (mpesa, card, mock, etc)',
  `transaction_reference` VARCHAR(255) COMMENT 'External transaction ID',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. PAYMENT_METHODS TABLE
-- ============================================================================
-- Stores user's saved payment methods
-- ============================================================================

DROP TABLE IF EXISTS `payment_methods`;

CREATE TABLE `payment_methods` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique payment method ID (UUID)',
  `user_id` VARCHAR(36) NOT NULL COMMENT 'User who owns this payment method',
  `method` VARCHAR(255) NOT NULL COMMENT 'Payment method description (e.g., "M-Pesa ****1234")',
  `details` JSON COMMENT 'Additional payment details (optional)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT `fk_payment_methods_user_id`
    FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. MESSAGES TABLE
-- ============================================================================
-- Stores chat messages between users
-- ============================================================================

DROP TABLE IF EXISTS `messages`;

CREATE TABLE `messages` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique message ID (UUID)',
  `sender_id` VARCHAR(36) NOT NULL COMMENT 'User who sent the message',
  `recipient_id` VARCHAR(36) NOT NULL COMMENT 'User who receives the message',
  `trainer_id` VARCHAR(36) COMMENT 'Trainer ID (for compatibility with Chat component)',
  `client_id` VARCHAR(36) COMMENT 'Client ID (for compatibility with Chat component)',
  `content` TEXT NOT NULL COMMENT 'Message content',
  `read_by_trainer` BOOLEAN DEFAULT FALSE COMMENT 'Whether trainer has read the message',
  `read_by_client` BOOLEAN DEFAULT FALSE COMMENT 'Whether client has read the message',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. NOTIFICATIONS TABLE
-- ============================================================================
-- Stores in-app notifications for users
-- ============================================================================

DROP TABLE IF EXISTS `notifications`;

CREATE TABLE `notifications` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique notification ID (UUID)',
  `user_id` VARCHAR(36) NOT NULL COMMENT 'User receiving the notification',
  `booking_id` VARCHAR(36) COMMENT 'Associated booking ID (for action links)',
  `title` VARCHAR(255) COMMENT 'Notification title',
  `body` TEXT COMMENT 'Notification body/message',
  `message` TEXT COMMENT 'Notification message (alternative field)',
  `type` VARCHAR(50) DEFAULT 'info' COMMENT 'Notification type: info, warning, success, error',
  `action_type` VARCHAR(50) COMMENT 'Action type: rate, confirm, reschedule, etc.',
  `read` BOOLEAN DEFAULT FALSE COMMENT 'Whether the notification has been read',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT `fk_notifications_user_id`
    FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_read` (`read`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. REVIEWS TABLE
-- ============================================================================
-- Stores trainer reviews and ratings from clients
-- ============================================================================

DROP TABLE IF EXISTS `reviews`;

CREATE TABLE `reviews` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique review ID (UUID)',
  `booking_id` VARCHAR(36) COMMENT 'Associated booking ID (nullable)',
  `client_id` VARCHAR(36) NOT NULL COMMENT 'Client who submitted the review',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Trainer being reviewed',
  `rating` DECIMAL(3, 2) NOT NULL COMMENT 'Rating score (0.00 to 5.00)',
  `comment` TEXT COMMENT 'Review comment/text',
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
  INDEX `idx_booking_id` (`booking_id`),
  INDEX `idx_rating` (`rating`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VERIFY: Show all created tables
-- ============================================================================

-- Run this to verify all tables were created successfully:
-- SHOW TABLES LIKE '%';
-- DESCRIBE categories;
-- DESCRIBE bookings;
-- DESCRIBE payments;
-- DESCRIBE payment_methods;
-- DESCRIBE messages;
-- DESCRIBE notifications;
-- DESCRIBE reviews;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
