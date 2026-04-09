-- ============================================================================
-- MYSQL PRODUCTION DEPLOYMENT SCRIPT
-- Trainer Profile Database Tables
-- ============================================================================
-- 
-- Purpose: Deploy all missing tables required for trainer profile functionality
-- 
-- Tables Created:
-- 1. trainer_availability - Trainer availability slots
-- 2. transactions - Wallet transaction ledger  
-- 3. payout_requests - Trainer payout requests
-- 4. reported_issues - User complaints/support tickets
-- 5. user_wallets - User account balance tracking
-- 6. promotion_requests - Trainer profile promotions
--
-- Naming Conflict Resolution:
-- - If 'issues' table exists, it will be renamed to 'reported_issues' (with data migration)
-- - If 'promotions' table exists, it will be renamed to 'promotion_requests' (with data migration)
--
-- Database: MySQL 5.7+ or MySQL 8.0+
-- Charset: utf8mb4 (supports emojis and special characters)
-- ============================================================================

SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- MIGRATION: Handle existing 'issues' table → 'reported_issues'
-- ============================================================================

-- Step 1: Check if 'issues' table exists and rename it to 'reported_issues_old'
-- (This preserves existing data while we create the new schema)
SET @dbname = DATABASE();
SET @tablename = 'issues';
SET @oldtablename = 'reported_issues_old';

SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLES 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename) > 0,
  CONCAT('ALTER TABLE `', @tablename, '` RENAME TO `', @oldtablename, '`;'),
  'SELECT "No existing issues table to migrate" AS status;'
) INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- MIGRATION: Handle existing 'promotions' table → 'promotion_requests'
-- ============================================================================

SET @tablename = 'promotions';
SET @oldtablename = 'promotions_old';

SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLES 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename) > 0,
  CONCAT('ALTER TABLE `', @tablename, '` RENAME TO `', @oldtablename, '`;'),
  'SELECT "No existing promotions table to migrate" AS status;'
) INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 1. CREATE: trainer_availability
-- ============================================================================
-- Stores trainer available time slots for booking management
-- Structure: Unique per trainer, JSON slots array with {day, startTime, endTime}

CREATE TABLE IF NOT EXISTS `trainer_availability` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
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
-- Tracks income, expenses, bonuses, refunds with balance snapshots

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  `user_id` VARCHAR(36) NOT NULL COMMENT 'User who owns the transaction',
  `type` VARCHAR(50) NOT NULL COMMENT 'income, expense, bonus, refund, withdrawal',
  `amount` DECIMAL(15, 2) NOT NULL COMMENT 'Transaction amount (positive or negative)',
  `balance_before` DECIMAL(15, 2) COMMENT 'User balance before transaction',
  `balance_after` DECIMAL(15, 2) COMMENT 'User balance after transaction',
  `reference` VARCHAR(255) COMMENT 'booking_id, payout_id, payment_id, etc.',
  `description` TEXT COMMENT 'Human-readable transaction description',
  `status` VARCHAR(50) DEFAULT 'completed' COMMENT 'pending, completed, failed, reversed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Transaction timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  CONSTRAINT `fk_transactions_user_id` 
    FOREIGN KEY (`user_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_status` (`status`),
  INDEX `idx_reference` (`reference`),
  INDEX `idx_created_at` (`created_at` DESC),
  INDEX `idx_user_created` (`user_id`, `created_at` DESC)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='User wallet transaction ledger and history';


-- ============================================================================
-- 3. CREATE: payout_requests
-- ============================================================================
-- Trainer withdrawal/payout requests and processing history
-- Workflow: pending → processing → completed (or failed/cancelled)

CREATE TABLE IF NOT EXISTS `payout_requests` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Trainer requesting payout',
  `amount` DECIMAL(15, 2) NOT NULL COMMENT 'Payout amount requested',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, processing, completed, failed, cancelled',
  `payment_method_id` VARCHAR(36) COMMENT 'Payment method used for payout',
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When payout was requested',
  `processed_at` TIMESTAMP NULL COMMENT 'When payout was processed',
  `admin_notes` TEXT COMMENT 'Admin notes on the payout request',
  `failure_reason` TEXT COMMENT 'Reason if payout failed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
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
  INDEX `idx_processed_at` (`processed_at`),
  INDEX `idx_trainer_status` (`trainer_id`, `status`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Trainer payout withdrawal requests and processing';


-- ============================================================================
-- 4. CREATE: reported_issues
-- ============================================================================
-- User support tickets and complaints
-- Replaces/renames 'issues' table from migrations.sql
-- Workflow: open → in_progress → resolved → closed

CREATE TABLE IF NOT EXISTS `reported_issues` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  `user_id` VARCHAR(36) NOT NULL COMMENT 'User reporting the issue',
  `trainer_id` VARCHAR(36) COMMENT 'Trainer involved (if applicable)',
  `booking_reference` VARCHAR(100) COMMENT 'Booking ID if issue relates to a booking',
  `complaint_type` VARCHAR(100) COMMENT 'booking_issue, payment_issue, trainer_conduct, quality_concern, other',
  `title` VARCHAR(255) COMMENT 'Brief issue title',
  `description` TEXT NOT NULL COMMENT 'Full issue description',
  `status` VARCHAR(50) DEFAULT 'open' COMMENT 'open, in_progress, resolved, closed, reopened',
  `priority` VARCHAR(50) DEFAULT 'normal' COMMENT 'low, normal, high, critical',
  `attachments` JSON COMMENT 'Array of {url: string, filename: string, type: string}',
  `resolution` TEXT COMMENT 'How the issue was resolved',
  `resolved_at` TIMESTAMP NULL COMMENT 'When issue was resolved',
  `assigned_to` VARCHAR(36) COMMENT 'Admin user assigned to handle this issue',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Issue creation timestamp',
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
  INDEX `idx_created_at` (`created_at` DESC),
  INDEX `idx_resolved_at` (`resolved_at`),
  INDEX `idx_user_status` (`user_id`, `status`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='User complaints, support tickets, and issue reports';


-- ============================================================================
-- 5. CREATE: user_wallets
-- ============================================================================
-- User account balances and wallet state
-- One wallet per user, tracks available and pending balances
-- Note: Complements users.balance with additional tracking

CREATE TABLE IF NOT EXISTS `user_wallets` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  `user_id` VARCHAR(36) NOT NULL UNIQUE COMMENT 'User account',
  `balance` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Available balance for transactions',
  `pending_balance` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Balance pending payout processing',
  `total_earned` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Lifetime earnings (trainers)',
  `total_spent` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Lifetime spending (clients)',
  `total_refunded` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Total refunded to user',
  `currency` VARCHAR(3) DEFAULT 'KES' COMMENT 'Wallet currency code',
  `hold_amount` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Amount on hold for active bookings',
  `last_transaction_at` TIMESTAMP NULL COMMENT 'Timestamp of last transaction',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Wallet creation timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  CONSTRAINT `fk_user_wallets_user_id` 
    FOREIGN KEY (`user_id`) 
    REFERENCES `users`(`id`) 
    ON DELETE CASCADE,
  
  UNIQUE KEY `uq_user_wallet` (`user_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_balance` (`balance`),
  INDEX `idx_updated_at` (`updated_at`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='User wallet accounts and balance tracking';


-- ============================================================================
-- 6. CREATE: promotion_requests
-- ============================================================================
-- Trainer profile promotion/boosting features
-- Replaces/renames 'promotions' table from migrations.sql
-- Tracks promotion campaigns and their status

CREATE TABLE IF NOT EXISTS `promotion_requests` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Trainer requesting promotion',
  `promotion_type` VARCHAR(100) COMMENT 'profile_boost, featured_listing, premium_tier, spotlight',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, approved, active, expired, cancelled, rejected',
  `duration_days` INT COMMENT 'Promotion duration in days',
  `commission_rate` DECIMAL(5, 2) DEFAULT 0 COMMENT 'Additional platform commission (%) during promotion',
  `cost` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Promotion fee if applicable',
  `features` JSON COMMENT 'Array of features included in promotion',
  `approved_by` VARCHAR(36) COMMENT 'Admin user who approved the request',
  `started_at` TIMESTAMP NULL COMMENT 'When promotion became active',
  `expires_at` TIMESTAMP NULL COMMENT 'When promotion expires',
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When request was made',
  `approved_at` TIMESTAMP NULL COMMENT 'When request was approved',
  `rejection_reason` TEXT COMMENT 'Reason for rejection if applicable',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
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
  INDEX `idx_requested_at` (`requested_at` DESC),
  INDEX `idx_created_at` (`created_at` DESC),
  INDEX `idx_trainer_status` (`trainer_id`, `status`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Trainer profile promotion and boosting requests';


-- ============================================================================
-- DATA MIGRATION: Migrate from 'reported_issues_old' if it exists
-- ============================================================================
-- Copy existing data from renamed 'issues' table into new 'reported_issues'

DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS migrate_reported_issues_data()
BEGIN
  DECLARE table_exists INT;
  
  SELECT COUNT(*) INTO table_exists 
  FROM information_schema.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'reported_issues_old';
  
  IF table_exists > 0 THEN
    INSERT INTO `reported_issues` 
    (id, user_id, trainer_id, booking_reference, complaint_type, title, description, 
     status, priority, attachments, resolution, resolved_at, assigned_to, created_at, updated_at)
    SELECT 
      id, user_id, trainer_id, booking_reference, complaint_type, 
      COALESCE(title, description) as title, description,
      COALESCE(status, 'open') as status, COALESCE(priority, 'normal') as priority,
      attachments, resolution, resolved_at, assigned_to, created_at, updated_at
    FROM `reported_issues_old`
    ON DUPLICATE KEY UPDATE updated_at = NOW();
    
    SELECT CONCAT('Migrated ', ROW_COUNT(), ' records from reported_issues_old') AS migration_status;
  END IF;
END$$

DELIMITER ;

CALL migrate_reported_issues_data();
DROP PROCEDURE IF EXISTS migrate_reported_issues_data;


-- ============================================================================
-- DATA MIGRATION: Migrate from 'promotions_old' if it exists
-- ============================================================================
-- Copy existing data from renamed 'promotions' table into new 'promotion_requests'

DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS migrate_promotion_requests_data()
BEGIN
  DECLARE table_exists INT;
  
  SELECT COUNT(*) INTO table_exists 
  FROM information_schema.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'promotions_old';
  
  IF table_exists > 0 THEN
    INSERT INTO `promotion_requests`
    (id, trainer_id, promotion_type, status, duration_days, commission_rate, cost, 
     features, approved_by, started_at, expires_at, requested_at, approved_at, created_at, updated_at)
    SELECT 
      id, trainer_id, 'profile_boost' as promotion_type, COALESCE(status, 'pending') as status,
      30 as duration_days, commission_rate, 0 as cost, NULL as features,
      NULL as approved_by, NULL as started_at, NULL as expires_at, created_at, NULL as approved_at,
      created_at, updated_at
    FROM `promotions_old`
    ON DUPLICATE KEY UPDATE updated_at = NOW();
    
    SELECT CONCAT('Migrated ', ROW_COUNT(), ' records from promotions_old') AS migration_status;
  END IF;
END$$

DELIMITER ;

CALL migrate_promotion_requests_data();
DROP PROCEDURE IF EXISTS migrate_promotion_requests_data;


-- ============================================================================
-- INITIALIZE: Seed user_wallets for existing users
-- ============================================================================
-- Create wallet entries for all existing users that don't have one yet

INSERT IGNORE INTO `user_wallets` 
(id, user_id, balance, total_earned, currency, created_at)
SELECT 
  CONCAT('wallet_', LOWER(HEX(UNHEX(REPLACE(id, '-', ''))))), 
  id, 
  COALESCE(balance, 0),
  0,
  COALESCE(currency, 'KES'),
  NOW()
FROM `users`
WHERE id NOT IN (SELECT DISTINCT user_id FROM `user_wallets`);


-- ============================================================================
-- VERIFICATION: Show table creation status
-- ============================================================================

SELECT 
  TABLE_NAME,
  TABLE_TYPE,
  ENGINE,
  TABLE_ROWS,
  CREATE_TIME,
  UPDATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN (
  'trainer_availability',
  'transactions',
  'payout_requests',
  'reported_issues',
  'user_wallets',
  'promotion_requests'
)
ORDER BY TABLE_NAME;

-- Show if old tables still exist (can be deleted after verification)
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  CONCAT('-- DROP TABLE `', TABLE_NAME, '`;') as cleanup_script
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN ('reported_issues_old', 'promotions_old')
ORDER BY TABLE_NAME;

-- ============================================================================
-- CLEANUP: Optional - Uncomment to remove old tables after verification
-- ============================================================================
-- DROP TABLE IF EXISTS `reported_issues_old`;
-- DROP TABLE IF EXISTS `promotions_old`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- 
-- Summary:
-- ✓ Created trainer_availability table
-- ✓ Created transactions table
-- ✓ Created payout_requests table
-- ✓ Created reported_issues table (with data migration from issues)
-- ✓ Created user_wallets table (with existing users initialized)
-- ✓ Created promotion_requests table (with data migration from promotions)
--
-- Next Steps:
-- 1. Verify all tables were created: SELECT * FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE();
-- 2. Check for old tables: reported_issues_old, promotions_old
-- 3. If migration successful, uncomment DROP statements at bottom to clean up old tables
-- 4. Test trainer profile functionality in application
--
-- ============================================================================
