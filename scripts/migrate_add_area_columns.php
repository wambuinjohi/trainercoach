<?php
/**
 * Migration: Add missing area_of_residence and area_coordinates columns to user_profiles
 * Usage: php scripts/migrate_add_area_columns.php
 */

// Include database connection
require_once(__DIR__ . '/../connection.php');

// Array of ALTER TABLE statements to add missing columns
$migrations = [
    // Add area_of_residence if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `area_of_residence` VARCHAR(255) NULL DEFAULT NULL",
    
    // Add area_coordinates if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `area_coordinates` JSON NULL DEFAULT NULL",
    
    // Add mpesa_number if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `mpesa_number` VARCHAR(20) NULL DEFAULT NULL",
    
    // Add sponsor_id if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `sponsor_id` VARCHAR(36) NULL DEFAULT NULL",
    
    // Add account_status if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `account_status` ENUM('registered', 'profile_incomplete', 'pending_approval', 'approved', 'suspended') DEFAULT 'registered'",
    
    // Add location_lat if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `location_lat` DECIMAL(9, 6) NULL DEFAULT NULL",
    
    // Add location_lng if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `location_lng` DECIMAL(9, 6) NULL DEFAULT NULL",
    
    // Add location_label if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `location_label` VARCHAR(255) NULL DEFAULT NULL",
    
    // Add hourly_rate_by_radius if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `hourly_rate_by_radius` JSON NULL DEFAULT NULL",
    
    // Add payout_details if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `payout_details` JSON NULL DEFAULT NULL",
    
    // Add timezone if not exists
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `timezone` VARCHAR(50) NULL DEFAULT NULL"
];

$errors = [];
$successes = [];

foreach ($migrations as $sql) {
    echo "Running: " . substr($sql, 0, 80) . "...\n";
    
    if ($conn->query($sql)) {
        $successes[] = $sql;
        echo "  ✓ Success\n";
    } else {
        $errors[] = [
            'sql' => $sql,
            'error' => $conn->error
        ];
        echo "  ✗ Error: " . $conn->error . "\n";
    }
}

// Add indexes for location columns
$indexStatements = [
    "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS `idx_location_lat_lng` (`location_lat`, `location_lng`)",
    "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS `idx_location_label` (`location_label`)",
    "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS `idx_account_status` (`account_status`)"
];

echo "\n--- Adding Indexes ---\n";

foreach ($indexStatements as $sql) {
    echo "Running: " . substr($sql, 0, 80) . "...\n";
    
    if ($conn->query($sql)) {
        $successes[] = $sql;
        echo "  ✓ Success\n";
    } else {
        // Ignore errors for index creation (they might already exist)
        echo "  ℹ Note: " . $conn->error . "\n";
    }
}

echo "\n--- Migration Summary ---\n";
echo "✓ Successful migrations: " . count($successes) . "\n";
echo "✗ Failed migrations: " . count($errors) . "\n";

if (!empty($errors)) {
    echo "\nErrors:\n";
    foreach ($errors as $err) {
        echo "  SQL: " . substr($err['sql'], 0, 100) . "...\n";
        echo "  Error: " . $err['error'] . "\n\n";
    }
    exit(1);
} else {
    echo "\n✓ All migrations completed successfully!\n";
    exit(0);
}
?>
