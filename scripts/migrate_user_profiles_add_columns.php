<?php
/**
 * Migration: Add missing columns to user_profiles table
 * Usage: php scripts/migrate_user_profiles_add_columns.php
 * 
 * Adds location-related and other client portal fields to user_profiles
 */

require_once(__DIR__ . '/../connection.php');

$columns = [
    'location' => "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS `location` VARCHAR(255)",
    'location_label' => "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS `location_label` VARCHAR(255)",
    'location_lat' => "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS `location_lat` DECIMAL(10, 8)",
    'location_lng' => "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS `location_lng` DECIMAL(11, 8)",
];

$successCount = 0;
$failureCount = 0;
$messages = [];

echo "Adding missing columns to user_profiles table...\n\n";

foreach ($columns as $columnName => $sql) {
    if ($conn->query($sql)) {
        $successCount++;
        $messages[] = "✓ Column $columnName added or already exists";
        echo "✓ $columnName\n";
    } else {
        if (strpos($conn->error, "Duplicate column name") !== false) {
            $successCount++;
            $messages[] = "✓ Column $columnName already exists";
            echo "✓ $columnName (already exists)\n";
        } else {
            $failureCount++;
            $messages[] = "✗ $columnName: " . $conn->error;
            echo "✗ $columnName: " . $conn->error . "\n";
        }
    }
}

echo "\n" . str_repeat("=", 50) . "\n";
echo "Migration Summary\n";
echo str_repeat("=", 50) . "\n";
echo "Added/Verified: $successCount\n";
echo "Failed: $failureCount\n";

if ($failureCount === 0) {
    echo "\n✓ All columns added successfully!\n";
    exit(0);
} else {
    echo "\n⚠ Some operations failed. Review the errors above.\n";
    exit(1);
}
?>
