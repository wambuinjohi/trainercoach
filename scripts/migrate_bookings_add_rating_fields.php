<?php
/**
 * Migration: Add rating fields to bookings table
 * 
 * Adds fields for:
 * - app_rating: client's rating of the app (1-5)
 * - review: client's review/recommendations
 * - app_rating_submitted: track if app rating was submitted
 * 
 * Usage: php scripts/migrate_bookings_add_rating_fields.php
 */

require_once(__DIR__ . '/../connection.php');

$alterQueries = [
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `app_rating` INT COMMENT 'Client rating of the app (1-5)' AFTER `rating_submitted`",
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `app_review` TEXT COMMENT 'Client review/recommendations about the app' AFTER `app_rating`",
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `coach_rating` DECIMAL(3, 2) COMMENT 'Coach rating (1-5)' AFTER `app_review`",
    "ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `coach_review` TEXT COMMENT 'Coach review text' AFTER `coach_rating`",
];

$allSuccess = true;

foreach ($alterQueries as $sql) {
    if (!$conn->query($sql)) {
        echo "✗ Migration failed: " . $conn->error . "\nQuery: $sql\n";
        $allSuccess = false;
    }
}

if ($allSuccess) {
    echo "✓ Migration successful: bookings table columns added or already exist\n";
    exit(0);
} else {
    exit(1);
}
?>
