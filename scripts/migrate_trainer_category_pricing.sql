-- ====================================================================
-- MIGRATION: Trainer Category Pricing
-- ====================================================================
-- Allows trainers to set different prices for different service categories
-- ====================================================================

-- Create trainer_category_pricing table
CREATE TABLE IF NOT EXISTS `trainer_category_pricing` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `trainer_id` VARCHAR(36) NOT NULL,
  `category_id` INT NOT NULL,
  `hourly_rate` DECIMAL(10, 2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_trainer_category_price` (`trainer_id`, `category_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_category_id` (`category_id`),
  INDEX `idx_trainer_category` (`trainer_id`, `category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Migrate existing default hourly_rate to all selected categories
-- (This assumes each trainer has a default rate and is assigned to categories)
-- Uncomment to run after trainers select their categories:
/*
INSERT INTO `trainer_category_pricing` (`trainer_id`, `category_id`, `hourly_rate`)
SELECT 
  tc.trainer_id,
  tc.category_id,
  COALESCE(up.hourly_rate, 1000) AS default_rate
FROM `trainer_categories` tc
LEFT JOIN `user_profiles` up ON tc.trainer_id = up.user_id
ON DUPLICATE KEY UPDATE hourly_rate = hourly_rate;
*/
