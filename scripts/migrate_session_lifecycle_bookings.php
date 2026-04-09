<?php
/**
 * Migration: Add session lifecycle fields to bookings table
 * Adds: started_at, ended_at, trainer_marked_start, trainer_marked_end, 
 *       client_confirmed_completion, session_duration_minutes, session_phase
 * Usage: php scripts/migrate_session_lifecycle_bookings.php
 */

require_once(__DIR__ . '/../connection.php');

$migrations = [
    // Add trainer_marked_start column
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `trainer_marked_start` BOOLEAN DEFAULT FALSE AFTER `status`",
    
    // Add trainer_marked_end column
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `trainer_marked_end` BOOLEAN DEFAULT FALSE AFTER `trainer_marked_start`",
    
    // Add client_confirmed_completion column
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `client_confirmed_completion` BOOLEAN DEFAULT FALSE AFTER `trainer_marked_end`",
    
    // Add started_at column
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `started_at` TIMESTAMP NULL AFTER `client_confirmed_completion`",
    
    // Add ended_at column
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `ended_at` TIMESTAMP NULL AFTER `started_at`",
    
    // Add session_duration_minutes column
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `session_duration_minutes` INT DEFAULT NULL AFTER `ended_at`",
    
    // Add session_phase column (waiting_start, session_active, awaiting_completion, completed)
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `session_phase` VARCHAR(50) DEFAULT 'waiting_start' AFTER `session_duration_minutes`",
    
    // Add index for session_phase
    "ALTER TABLE `bookings` ADD INDEX IF NOT EXISTS `idx_session_phase` (`session_phase`)",
    
    // Add index for started_at
    "ALTER TABLE `bookings` ADD INDEX IF NOT EXISTS `idx_started_at` (`started_at`)",
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
    echo "\n✓ All migrations successful: Session lifecycle fields added to bookings table\n";
    exit(0);
} else {
    echo "\n✗ Some migrations failed\n";
    exit(1);
}
?>
