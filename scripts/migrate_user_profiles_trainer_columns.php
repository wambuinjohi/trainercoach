<?php
/**
 * Migration: Add trainer-specific columns to user_profiles table
 * Usage: php scripts/migrate_user_profiles_trainer_columns.php
 * 
 * Adds hourly_rate_by_radius and payout_details columns for trainer profile management
 */

require_once(__DIR__ . '/../connection.php');

$columns = [
    'hourly_rate_by_radius' => "ALTER TABLE `user_profiles` ADD COLUMN `hourly_rate_by_radius` JSON",
    'payout_details' => "ALTER TABLE `user_profiles` ADD COLUMN `payout_details` JSON",
    'timezone' => "ALTER TABLE `user_profiles` ADD COLUMN `timezone` VARCHAR(255) DEFAULT 'UTC'",
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
