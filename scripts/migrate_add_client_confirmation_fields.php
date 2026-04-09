<?php
/**
 * Migration: Add client confirmation fields to bookings table
 * Adds: client_confirmed_start, session_start_confirmed_at, completed_at
 * Usage: php scripts/migrate_add_client_confirmation_fields.php
 */

require_once(__DIR__ . '/../connection.php');

$migrations = [
    // Add client_confirmed_start column
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `client_confirmed_start` BOOLEAN DEFAULT FALSE AFTER `trainer_marked_start`",
    
    // Add session_start_confirmed_at column
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `session_start_confirmed_at` TIMESTAMP NULL AFTER `client_confirmed_start`",
    
    // Add completed_at column
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `completed_at` TIMESTAMP NULL AFTER `client_confirmed_completion`",
    
    // Add index for client_confirmed_start
    "ALTER TABLE `bookings` ADD INDEX IF NOT EXISTS `idx_client_confirmed_start` (`client_confirmed_start`)",
];

$failed = false;

foreach ($migrations as $index => $sql) {
    if ($conn->query($sql)) {
        echo "✓ Migration " . ($index + 1) . " successful\n";
    } else {
        echo "✗ Migration " . ($index + 1) . " failed: " . $conn->error . "\n";
        $failed = true;
    }
}

if (!$failed) {
    echo "\n✓ All migrations successful: Client confirmation fields added to bookings table\n";
    exit(0);
} else {
    echo "\n✗ Some migrations failed\n";
    exit(1);
}
?>
