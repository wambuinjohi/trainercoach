-- ============================================================================
-- Migration: Add Group Training Support
-- ============================================================================
-- This migration adds:
-- 1. trainer_group_pricing table for storing group pricing per trainer/category
-- 2. Columns to bookings table to track group training bookings
-- ============================================================================

-- Create trainer_group_pricing table
CREATE TABLE IF NOT EXISTS `trainer_group_pricing` (
  `id` VARCHAR(36) PRIMARY KEY,
  `trainer_id` VARCHAR(191) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `category_id` INT NOT NULL,
  `pricing_model` ENUM('fixed', 'per_person') NOT NULL DEFAULT 'fixed',
  `tiers` JSON NOT NULL COMMENT 'Array of {group_size_name, min_size, max_size, rate}',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tgp_trainer_id`
    FOREIGN KEY (`trainer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_tgp_category_id`
    FOREIGN KEY (`category_id`)
    REFERENCES `categories`(`id`)
    ON DELETE CASCADE,
  UNIQUE KEY `uq_trainer_category_group` (`trainer_id`, `category_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_category_id` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add columns to bookings table for group training support
-- (These are ALTER statements in case bookings table already exists)
ALTER TABLE `bookings` 
  ADD COLUMN `is_group_training` BOOLEAN DEFAULT FALSE AFTER `category_id`,
  ADD COLUMN `group_size_tier_name` VARCHAR(50) DEFAULT NULL AFTER `is_group_training`,
  ADD COLUMN `pricing_model_used` ENUM('fixed', 'per_person') DEFAULT NULL AFTER `group_size_tier_name`,
  ADD COLUMN `group_rate_per_unit` DECIMAL(10, 2) DEFAULT NULL AFTER `pricing_model_used`;

-- Create index for filtering group bookings
CREATE INDEX `idx_is_group_training` ON `bookings`(`is_group_training`);
