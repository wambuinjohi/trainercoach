-- ====================================================================
-- MIGRATION: Categories as Primary Training Services
-- ====================================================================
-- This migration transitions the system from using 'disciplines' field
-- to using 'categories' as the authoritative source for training services.
-- ====================================================================

-- Step 1: Ensure categories table exists
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `icon` VARCHAR(50),
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_name` (`name`),
  INDEX `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Ensure trainer_categories relationship table exists
CREATE TABLE IF NOT EXISTS `trainer_categories` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `trainer_id` VARCHAR(36) NOT NULL,
  `category_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_trainer_categories_trainer_id`
    FOREIGN KEY (`trainer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_trainer_categories_category_id`
    FOREIGN KEY (`category_id`)
    REFERENCES `categories`(`id`)
    ON DELETE CASCADE,
  UNIQUE KEY `uq_trainer_category` (`trainer_id`, `category_id`),
  INDEX `idx_trainer_id` (`trainer_id`),
  INDEX `idx_category_id` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Add disciplines column to user_profiles if it doesn't exist (for backward compatibility)
ALTER TABLE `user_profiles` 
ADD COLUMN IF NOT EXISTS `disciplines` JSON DEFAULT NULL;

-- Step 4: Create default categories if they don't exist
INSERT IGNORE INTO `categories` (`name`, `icon`, `description`) VALUES
('Strength Training', '💪', 'Weightlifting, resistance exercises, and muscle building'),
('Cardio', '🏃', 'Running, cycling, HIIT, and cardiovascular fitness'),
('Yoga', '🧘', 'Flexibility, mindfulness, and holistic wellness'),
('Pilates', '✨', 'Core strengthening and body conditioning'),
('CrossFit', '⚡', 'High-intensity functional training'),
('Boxing', '🥊', 'Combat sports and punching techniques'),
('Personal Training', '👥', 'One-on-one customized fitness coaching'),
('Group Fitness', '👫', 'Group classes and team training'),
('Nutrition Coaching', '🥗', 'Dietary guidance and meal planning'),
('Flexibility & Mobility', '🤸', 'Stretching, range of motion, and movement quality'),
('Swimming', '🏊', 'Water-based fitness and aquatic training'),
('Dance Fitness', '💃', 'Zumba, hip-hop dance, and choreography');

-- Step 5: Migrate existing trainer disciplines to categories
-- For each trainer with disciplines, automatically assign matching categories
-- This ensures existing trainers aren't broken by the migration
INSERT INTO `trainer_categories` (`trainer_id`, `category_id`)
SELECT DISTINCT
  up.user_id,
  c.id
FROM `user_profiles` up
CROSS JOIN `categories` c
WHERE up.user_type = 'trainer'
  AND up.disciplines IS NOT NULL
  AND JSON_LENGTH(up.disciplines) > 0
  AND (
    -- Match by discipline names in the JSON array
    JSON_CONTAINS(up.disciplines, JSON_QUOTE(c.name))
    OR JSON_CONTAINS(up.disciplines, JSON_QUOTE('Strength'))
    OR JSON_CONTAINS(up.disciplines, JSON_QUOTE('Cardio'))
    OR JSON_CONTAINS(up.disciplines, JSON_QUOTE('Yoga'))
    OR JSON_CONTAINS(up.disciplines, JSON_QUOTE('Pilates'))
  )
ON DUPLICATE KEY UPDATE created_at = created_at;

-- Step 6: For trainers with disciplines that don't match specific categories,
-- assign them to "Personal Training" as a fallback
INSERT INTO `trainer_categories` (`trainer_id`, `category_id`)
SELECT DISTINCT up.user_id, (SELECT id FROM categories WHERE name = 'Personal Training' LIMIT 1)
FROM `user_profiles` up
WHERE up.user_type = 'trainer'
  AND up.disciplines IS NOT NULL
  AND JSON_LENGTH(up.disciplines) > 0
  AND NOT EXISTS (
    SELECT 1 FROM `trainer_categories` tc
    WHERE tc.trainer_id = up.user_id
  )
ON DUPLICATE KEY UPDATE created_at = created_at;

-- Step 7: Add index for efficient lookups of trainers by category
ALTER TABLE `user_profiles` 
ADD INDEX IF NOT EXISTS `idx_user_type_approved` (`user_type`, `is_approved`);

-- Step 8: Audit - count trainer categories assigned
SELECT 
  'Trainer Categories Migration' AS migration_name,
  COUNT(DISTINCT tc.trainer_id) AS total_trainers_with_categories,
  COUNT(DISTINCT tc.category_id) AS total_categories_used,
  COUNT(*) AS total_trainer_category_assignments
FROM `trainer_categories` tc;

-- Step 9: Identify trainers without categories (if any)
SELECT 
  up.user_id,
  up.full_name,
  up.disciplines,
  'NO CATEGORIES ASSIGNED' AS status
FROM `user_profiles` up
WHERE up.user_type = 'trainer'
  AND NOT EXISTS (
    SELECT 1 FROM `trainer_categories` tc
    WHERE tc.trainer_id = up.user_id
  );

-- Note: The 'disciplines' field in user_profiles is kept for backward compatibility
-- and can be deprecated in a future release after full migration verification.
-- To remove it: ALTER TABLE `user_profiles` DROP COLUMN `disciplines`;
