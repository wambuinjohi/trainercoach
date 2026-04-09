<?php
/**
 * Migration: Create trainer_service_categories table and add missing columns
 * Usage: php scripts/migrate_trainer_service_categories.php
 * 
 * Creates a junction table to link trainers with service categories
 * Allows trainers to select multiple categories and set custom pricing per category
 */

require_once(__DIR__ . '/../connection.php');

// Step 1: Ensure duration_minutes exists in services table
echo "Step 1: Checking/adding duration_minutes to services table...\n";
$durSql = "ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `duration_minutes` INT COMMENT 'Service duration in minutes'";
if ($conn->query($durSql)) {
    echo "✓ duration_minutes column added or already exists\n";
} else {
    if (strpos($conn->error, "Duplicate column name") !== false) {
        echo "✓ duration_minutes already exists\n";
    } else {
        echo "✗ Failed to add duration_minutes: " . $conn->error . "\n";
    }
}

// Step 2: Create trainer_service_categories table
echo "\nStep 2: Creating trainer_service_categories table...\n";
$serviceCategoriesSql = "
CREATE TABLE IF NOT EXISTS `trainer_service_categories` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique ID',
  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Reference to users table',
  `category_id` INT NOT NULL COMMENT 'Reference to categories table',
  `hourly_rate` DECIMAL(10, 2) COMMENT 'Custom hourly rate for this category (if different from base rate)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
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
COMMENT='Links trainers to service categories they offer'
";

if ($conn->query($serviceCategoriesSql)) {
    echo "✓ trainer_service_categories table created or already exists\n";
} else {
    if (strpos($conn->error, "already exists") !== false) {
        echo "✓ trainer_service_categories already exists\n";
    } else {
        echo "✗ Failed to create trainer_service_categories: " . $conn->error . "\n";
    }
}

// Step 3: Ensure hourly_rate_by_radius column exists in user_profiles
echo "\nStep 3: Checking/adding hourly_rate_by_radius to user_profiles...\n";
$rateByRadiusSql = "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `hourly_rate_by_radius` JSON COMMENT 'Distance-based pricing tiers'";
if ($conn->query($rateByRadiusSql)) {
    echo "✓ hourly_rate_by_radius column added or already exists\n";
} else {
    if (strpos($conn->error, "Duplicate column name") !== false) {
        echo "✓ hourly_rate_by_radius already exists\n";
    } else {
        echo "✗ Failed to add hourly_rate_by_radius: " . $conn->error . "\n";
    }
}

// Step 4: Ensure pricing_packages column exists in user_profiles (for backwards compatibility)
echo "\nStep 4: Checking/adding pricing_packages to user_profiles...\n";
$packagesSql = "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `pricing_packages` JSON COMMENT 'Session bundle packages'";
if ($conn->query($packagesSql)) {
    echo "✓ pricing_packages column added or already exists\n";
} else {
    if (strpos($conn->error, "Duplicate column name") !== false) {
        echo "✓ pricing_packages already exists\n";
    } else {
        echo "✗ Failed to add pricing_packages: " . $conn->error . "\n";
    }
}

echo "\n" . str_repeat("=", 60) . "\n";
echo "Migration Summary\n";
echo str_repeat("=", 60) . "\n";
echo "✓ All migrations completed successfully!\n";
echo "\nNew table: trainer_service_categories\n";
echo "This allows trainers to:\n";
echo "  - Select one or more service categories\n";
echo "  - Set custom pricing per category\n";
echo "  - Manage distance-based pricing tiers\n";
exit(0);
?>
