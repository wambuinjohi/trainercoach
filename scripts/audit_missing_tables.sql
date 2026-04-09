-- ============================================================================
-- TRAINER PROFILE AUDIT: MISSING DATABASE TABLES
-- ============================================================================
-- This file contains SQL for all tables referenced in the application code
-- but missing from the current database schema.
--
-- Tables to create:
-- 1. trainer_availability - Trainer availability slots management
-- 2. transactions - User transaction history and wallet ledger
-- 3. payout_requests - Trainer payout request tracking
-- 4. reported_issues - User issue/complaint reporting (renamed from 'issues')
-- 5. user_wallets - User wallet/balance accounts
-- 6. promotion_requests - Trainer profile promotion requests (renamed from 'promotions')
--
-- Database Support: Both MySQL and Postgres (with dialect notes)
-- ============================================================================

-- ============================================================================
-- MYSQL VERSION (Recommended for this project)
-- ============================================================================

-- 1. TRAINER AVAILABILITY TABLE
-- Stores available time slots for trainers
CREATE TABLE IF NOT EXISTS `trainer_availability` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `trainer_id` VARCHAR(36) NOT NULL,
  `slots` JSON NOT NULL COMMENT 'Array of availability slots with day, startTime, endTime',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uq_trainer_availability` (`trainer_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. TRANSACTIONS TABLE
-- Ledger for all wallet transactions (income, expenses, refunds)
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `type` VARCHAR(50) NOT NULL COMMENT 'income, expense, bonus, refund',
  `amount` DECIMAL(15, 2) NOT NULL,
  `balance_before` DECIMAL(15, 2),
  `balance_after` DECIMAL(15, 2),
  `reference` VARCHAR(255) COMMENT 'booking_id, payout_id, etc',
  `description` TEXT,
  `status` VARCHAR(50) DEFAULT 'completed' COMMENT 'pending, completed, failed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_created_at` (`created_at` DESC),
  INDEX `idx_reference` (`reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. PAYOUT REQUESTS TABLE
-- Tracks trainer requests for payment withdrawals
CREATE TABLE IF NOT EXISTS `payout_requests` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `trainer_id` VARCHAR(36) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, processing, completed, failed, cancelled',
  `payment_method_id` VARCHAR(36),
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `processed_at` TIMESTAMP NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL,
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_requested_at` (`requested_at` DESC),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. REPORTED ISSUES TABLE
-- User complaints and support tickets (preferred name for 'issues')
CREATE TABLE IF NOT EXISTS `reported_issues` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `trainer_id` VARCHAR(36),
  `booking_reference` VARCHAR(100),
  `complaint_type` VARCHAR(100) COMMENT 'booking_issue, payment_issue, trainer_conduct, quality_concern, other',
  `title` VARCHAR(255),
  `description` TEXT NOT NULL,
  `status` VARCHAR(50) DEFAULT 'open' COMMENT 'open, in_progress, resolved, closed',
  `priority` VARCHAR(50) DEFAULT 'normal' COMMENT 'low, normal, high, critical',
  `attachments` JSON COMMENT 'Array of file URLs or metadata',
  `resolution` TEXT,
  `resolved_at` TIMESTAMP NULL,
  `assigned_to` VARCHAR(36),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_priority` (`priority`),
  INDEX `idx_booking_reference` (`booking_reference`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. USER WALLETS TABLE
-- Tracks account balance for each user
CREATE TABLE IF NOT EXISTS `user_wallets` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `balance` DECIMAL(15, 2) DEFAULT 0,
  `pending_balance` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Balance awaiting payout processing',
  `total_earned` DECIMAL(15, 2) DEFAULT 0,
  `total_spent` DECIMAL(15, 2) DEFAULT 0,
  `total_refunded` DECIMAL(15, 2) DEFAULT 0,
  `currency` VARCHAR(3) DEFAULT 'KES',
  `last_transaction_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_balance` (`balance`),
  INDEX `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 6. PROMOTION REQUESTS TABLE
-- Tracks trainer profile promotion/boosting requests (preferred name for 'promotions')
CREATE TABLE IF NOT EXISTS `promotion_requests` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `trainer_id` VARCHAR(36) NOT NULL,
  `promotion_type` VARCHAR(100) COMMENT 'profile_boost, featured_listing, premium_tier',
  `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, approved, active, expired, cancelled',
  `duration_days` INT COMMENT 'How long the promotion lasts',
  `commission_rate` DECIMAL(5, 2) DEFAULT 0 COMMENT 'Additional platform commission during promotion',
  `cost` DECIMAL(15, 2) DEFAULT 0 COMMENT 'Promotion fee if applicable',
  `features` JSON COMMENT 'Array of features included in promotion',
  `approved_by` VARCHAR(36),
  `started_at` TIMESTAMP NULL,
  `expires_at` TIMESTAMP NULL,
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `approved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_expires_at` (`expires_at`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- POSTGRES VERSION (If migrating to Postgres)
-- ============================================================================
-- Uncomment and use these if your deployment switches to PostgreSQL

/*
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TRAINER AVAILABILITY TABLE (Postgres)
CREATE TABLE IF NOT EXISTS public.trainer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  slots jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_trainer_availability_trainer_id FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT uq_trainer_availability UNIQUE (trainer_id)
);
CREATE INDEX IF NOT EXISTS idx_trainer_availability_trainer_id ON public.trainer_availability (trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_availability_updated_at ON public.trainer_availability (updated_at);


-- 2. TRANSACTIONS TABLE (Postgres)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric DEFAULT 0,
  balance_before numeric,
  balance_after numeric,
  reference text,
  description text,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_transactions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions (reference);


-- 3. PAYOUT REQUESTS TABLE (Postgres)
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'pending',
  payment_method_id uuid,
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_payout_requests_trainer_id FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payout_requests_payment_method_id FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payout_requests_trainer_id ON public.payout_requests (trainer_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests (status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_requested_at ON public.payout_requests (requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON public.payout_requests (created_at DESC);


-- 4. REPORTED ISSUES TABLE (Postgres)
CREATE TABLE IF NOT EXISTS public.reported_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trainer_id uuid,
  booking_reference text,
  complaint_type text,
  title text,
  description text NOT NULL,
  status text DEFAULT 'open',
  priority text DEFAULT 'normal',
  attachments jsonb,
  resolution text,
  resolved_at timestamptz,
  assigned_to uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_reported_issues_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reported_issues_trainer_id FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_reported_issues_user_id ON public.reported_issues (user_id);
CREATE INDEX IF NOT EXISTS idx_reported_issues_trainer_id ON public.reported_issues (trainer_id);
CREATE INDEX IF NOT EXISTS idx_reported_issues_status ON public.reported_issues (status);
CREATE INDEX IF NOT EXISTS idx_reported_issues_priority ON public.reported_issues (priority);
CREATE INDEX IF NOT EXISTS idx_reported_issues_booking_reference ON public.reported_issues (booking_reference);
CREATE INDEX IF NOT EXISTS idx_reported_issues_created_at ON public.reported_issues (created_at DESC);


-- 5. USER WALLETS TABLE (Postgres)
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric DEFAULT 0,
  pending_balance numeric DEFAULT 0,
  total_earned numeric DEFAULT 0,
  total_spent numeric DEFAULT 0,
  total_refunded numeric DEFAULT 0,
  currency text DEFAULT 'KES',
  last_transaction_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user_wallets_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON public.user_wallets (user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_balance ON public.user_wallets (balance);
CREATE INDEX IF NOT EXISTS idx_user_wallets_updated_at ON public.user_wallets (updated_at);


-- 6. PROMOTION REQUESTS TABLE (Postgres)
CREATE TABLE IF NOT EXISTS public.promotion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  promotion_type text,
  status text DEFAULT 'pending',
  duration_days integer,
  commission_rate numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  features jsonb,
  approved_by uuid,
  started_at timestamptz,
  expires_at timestamptz,
  requested_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_promotion_requests_trainer_id FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotion_requests_approved_by FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_promotion_requests_trainer_id ON public.promotion_requests (trainer_id);
CREATE INDEX IF NOT EXISTS idx_promotion_requests_status ON public.promotion_requests (status);
CREATE INDEX IF NOT EXISTS idx_promotion_requests_expires_at ON public.promotion_requests (expires_at);
CREATE INDEX IF NOT EXISTS idx_promotion_requests_created_at ON public.promotion_requests (created_at DESC);
*/
