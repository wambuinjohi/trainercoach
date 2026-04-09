-- ============================================================================
-- Migration: Add trainer service categories table and missing columns
-- ============================================================================
-- 
-- Usage: 
--   MySQL: mysql -u root -p trainer_db < scripts/sql/add-trainer-service-categories.sql
--   Or import via phpMyAdmin/MySQL Workbench
--
-- This migration:
-- 1. Adds duration_minutes column to services table (if missing)
-- 2. Creates trainer_service_categories table (links trainers to service categories)
-- 3. Adds missing columns to user_profiles table
--
-- ============================================================================

-- Step 1: Add duration_minutes to services table (if missing)
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `duration_minutes` INT COMMENT 'Service duration in minutes';

-- Step 2: Create trainer_service_categories table
-- This table links trainers to service categories they offer
-- Allows trainers to select multiple categories and set custom pricing per category
CREATE TABLE IF NOT EXISTS `trainer_service_categories` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique ID (UUID)',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Reference to users table',
  `category_id` INT NOT NULL COMMENT 'Reference to categories table',
  `hourly_rate` DECIMAL(10, 2) COMMENT 'Custom hourly rate for this category (if different from base rate)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When this service category was added',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  CONSTRAINT `fk_trainer_service_categories_trainer_id`
    FOREIGN KEY (`trainer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  
  CONSTRAINT `fk_trainer_service_categories_category_id`
    FOREIGN KEY (`category_id`)
    REFERENCES `categories`(`id`)
    ON DELETE CASCADE,
  
  UNIQUE KEY `uk_trainer_category` (`trainer_id`, `category_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_category_id` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Links trainers to service categories they offer with optional custom pricing';

-- Step 3: Add missing columns to user_profiles table
ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `hourly_rate_by_radius` JSON COMMENT 'Distance-based pricing tiers: [{"radius_km": 5, "rate": 1500}, ...]';
ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `pricing_packages` JSON COMMENT 'Session bundle packages: [{"name": "10 sessions", "price": 8000, "sessions": 10}, ...]';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- 
-- Tables affected:
-- - services: Added duration_minutes column
-- - trainer_service_categories: Created new (links trainers to categories)
-- - user_profiles: Added hourly_rate_by_radius and pricing_packages columns
--
-- ============================================================================
