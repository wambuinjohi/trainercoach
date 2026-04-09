<?php
/**
 * Migration: Add pricing_packages column to user_profiles
 * Usage: php scripts/add_pricing_packages_column.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "ALTER TABLE `user_profiles` ADD COLUMN `pricing_packages` JSON";

if ($conn->query($sql)) {
    echo "✓ Migration successful: pricing_packages column added or already exists\n";
    exit(0);
} else {
    if (strpos($conn->error, "Duplicate column name") !== false) {
        echo "✓ Column already exists\n";
        exit(0);
    }
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
