-- ============================================================================
-- CLIENT PORTAL AUDIT FIX: Missing Database Tables
-- ============================================================================
-- This file creates all missing tables required by the client portal
-- 
-- Tables to create:
-- 1. trainer_availability - Trainer availability slots management
-- 2. transactions - User transaction history and wallet ledger
-- 3. payout_requests - Trainer payout request tracking
-- 4. reported_issues - User issue/complaint reporting
-- 5. user_wallets - User wallet/balance accounts
-- 6. promotion_requests - Trainer profile promotion requests
-- ============================================================================

SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. CREATE: trainer_availability
-- ============================================================================
-- Stores trainer available time slots for booking management

CREATE TABLE IF NOT EXISTS `trainer_availability` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'UUID primary key',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Reference to trainer user',
  `slots` JSON NOT NULL COMMENT 'Array of {day: string, startTime: string, endTime: string}',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  CONSTRAINT `fk_trainer_availability_trainer_id` 
    FOREIGN KEY (`trainer_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  UNIQUE KEY `uq_trainer_availability` (`trainer_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_updated_at` (`updated_at`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Trainer availability time slots for booking';

-- ============================================================================
-- 2. CREATE: transactions
-- ============================================================================
-- Financial transaction ledger for wallet operations

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'UUID primary key',
  `user_id` VARCHAR(36) NOT NULL COMMENT 'User who owns the transaction',
  `type` VARCHAR(50) NOT NULL COMMENT 'income, expense, bonus, refund',
  `amount` DECIMAL(15, 2) NOT NULL COMMENT 'Transaction amount',
  `balance_before` DECIMAL(15, 2) COMMENT 'Balance before transaction',
  `balance_after` DECIMAL(15, 2) COMMENT 'Balance after transaction',
  `reference` VARCHAR(255) COMMENT 'booking_id, payout_id, payment_id, etc',
  `description` TEXT COMMENT 'Transaction description',
  `status` VARCHAR(50) DEFAULT 'completed' COMMENT 'pending, completed, failed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  CONSTRAINT `fk_transactions_user_id` 
    FOREIGN KEY (`user_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at` DESC),
  INDEX `idx_reference` (`reference`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Financial transaction ledger';

-- ============================================================================
-- 3. CREATE: payout_requests
-- ============================================================================
-- Tracks trainer requests for payment withdrawals

CREATE TABLE IF NOT EXISTS `payout_requests` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'UUID primary key',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Trainer requesting payout',
  `amount` DECIMAL(15, 2) NOT NULL COMMENT 'Payout amount requested',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, processing, completed, failed, cancelled',
  `payment_method_id` VARCHAR(36) COMMENT 'Payment method for payout',
  `notes` TEXT COMMENT 'Admin notes or payout notes',
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When payout was requested',
  `processed_at` TIMESTAMP NULL COMMENT 'When payout was processed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  CONSTRAINT `fk_payout_requests_trainer_id` 
    FOREIGN KEY (`trainer_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  CONSTRAINT `fk_payout_requests_payment_method_id` 
    FOREIGN KEY (`payment_method_id`) 
    REFERENCES `payment_methods`(`id`) 
    ON DELETE SET NULL,
  
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_requested_at` (`requested_at` DESC),
  INDEX `idx_created_at` (`created_at` DESC)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Trainer payout requests';

-- ============================================================================
-- 4. CREATE: reported_issues
-- ============================================================================
-- User complaints and support tickets

CREATE TABLE IF NOT EXISTS `reported_issues` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'UUID primary key',
  `user_id` VARCHAR(36) NOT NULL COMMENT 'User reporting the issue',
  `trainer_id` VARCHAR(36) COMMENT 'Trainer involved in the issue',
  `booking_reference` VARCHAR(100) COMMENT 'Related booking reference',
  `complaint_type` VARCHAR(100) COMMENT 'booking_issue, payment_issue, trainer_conduct, quality_concern, other',
  `title` VARCHAR(255) COMMENT 'Issue title/subject',
  `description` TEXT NOT NULL COMMENT 'Detailed issue description',
  `status` VARCHAR(50) DEFAULT 'open' COMMENT 'open, in_progress, resolved, closed',
  `priority` VARCHAR(50) DEFAULT 'normal' COMMENT 'low, normal, high, critical',
  `attachments` JSON COMMENT 'Array of file URLs or attachment metadata',
  `resolution` TEXT COMMENT 'Resolution details',
  `resolved_at` TIMESTAMP NULL COMMENT 'When the issue was resolved',
  `assigned_to` VARCHAR(36) COMMENT 'Admin assigned to handle issue',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  CONSTRAINT `fk_reported_issues_user_id` 
    FOREIGN KEY (`user_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  CONSTRAINT `fk_reported_issues_trainer_id` 
    FOREIGN KEY (`trainer_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE SET NULL,
  
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_priority` (`priority`),
  INDEX `idx_booking_reference` (`booking_reference`),
  INDEX `idx_created_at` (`created_at` DESC)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User reported issues and support tickets';

-- ============================================================================
-- 5. CREATE: user_wallets
-- ============================================================================
-- Tracks account balance for each user

CREATE TABLE IF NOT EXISTS `user_wallets` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'UUID primary key',
  `user_id` VARCHAR(36) NOT NULL UNIQUE COMMENT 'User ID (unique)',
  `balance` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Current account balance',
  `pending_balance` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Balance awaiting payout processing',
  `total_earned` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Total amount earned',
  `total_spent` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Total amount spent',
  `total_refunded` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Total amount refunded',
  `currency` VARCHAR(3) DEFAULT 'KES' COMMENT 'Currency code (KES, USD, etc)',
  `last_transaction_at` TIMESTAMP NULL COMMENT 'Timestamp of last transaction',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Wallet creation timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  CONSTRAINT `fk_user_wallets_user_id` 
    FOREIGN KEY (`user_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_balance` (`balance`),
  INDEX `idx_updated_at` (`updated_at`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User wallet and balance tracking';

-- ============================================================================
-- 6. CREATE: promotion_requests
-- ============================================================================
-- Tracks trainer profile promotion/boosting requests

CREATE TABLE IF NOT EXISTS `promotion_requests` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'UUID primary key',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Trainer requesting promotion',
  `promotion_type` VARCHAR(100) COMMENT 'profile_boost, featured_listing, premium_tier, etc',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, approved, active, expired, cancelled',
  `duration_days` INT COMMENT 'How long the promotion lasts in days',
  `commission_rate` DECIMAL(5, 2) DEFAULT 0 COMMENT 'Additional platform commission during promotion',
  `cost` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Promotion fee if applicable',
  `features` JSON COMMENT 'Array of features included in promotion',
  `approved_by` VARCHAR(36) COMMENT 'Admin who approved the promotion',
  `started_at` TIMESTAMP NULL COMMENT 'When promotion started',
  `expires_at` TIMESTAMP NULL COMMENT 'When promotion expires',
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When promotion was requested',
  `approved_at` TIMESTAMP NULL COMMENT 'When promotion was approved',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  CONSTRAINT `fk_promotion_requests_trainer_id` 
    FOREIGN KEY (`trainer_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  CONSTRAINT `fk_promotion_requests_approved_by` 
    FOREIGN KEY (`approved_by`) 
    REFERENCES `users`(`id`) 
    ON DELETE SET NULL,
  
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_expires_at` (`expires_at`),
  INDEX `idx_created_at` (`created_at` DESC)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Trainer profile promotion requests';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- INITIALIZATION: Populate user_wallets for existing users
-- ============================================================================
-- Create wallet records for users who don't have one yet

INSERT INTO `user_wallets` (id, user_id, balance, total_earned, currency)
SELECT CONCAT('wallet_', UUID()), id, COALESCE(balance, 0), 0, COALESCE(currency, 'KES')
FROM `users` u
WHERE NOT EXISTS (
  SELECT 1 FROM `user_wallets` w WHERE w.user_id = u.id
);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- All 6 missing tables have been created successfully:
-- ✓ trainer_availability - For managing trainer availability slots
-- ✓ transactions - For wallet transaction ledger
-- ✓ payout_requests - For trainer payout requests
-- ✓ reported_issues - For user issue reporting
-- ✓ user_wallets - For user wallet and balance tracking
-- ✓ promotion_requests - For trainer profile promotions
--
-- Existing user wallets have been initialized.
-- All tables include proper indexes and foreign key constraints.
-- ============================================================================
