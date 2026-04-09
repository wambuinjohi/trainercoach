<?php
/**
 * Migration: Add rating fields to bookings table
 * Usage: php scripts/add_rating_fields_to_bookings.php
 */

require_once(__DIR__ . '/../connection.php');

$alterStatements = [
    "ALTER TABLE `bookings` ADD COLUMN `rating_submitted` TINYINT(1) DEFAULT 0 AFTER `status`",
    "ALTER TABLE `bookings` ADD COLUMN `client_rating` INT DEFAULT NULL AFTER `rating_submitted`"
];

foreach ($alterStatements as $sql) {
    // Check if column already exists
    $columnName = strpos($sql, 'rating_submitted') !== false ? 'rating_submitted' : 'client_rating';
    $checkSql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bookings' AND COLUMN_NAME='$columnName'";
    $result = $conn->query($checkSql);
    
    if ($result && $result->num_rows > 0) {
        echo "✓ Column '$columnName' already exists\n";
        continue;
    }
    
    if ($conn->query($sql)) {
        echo "✓ Added column '$columnName' to bookings table\n";
    } else {
        echo "✗ Failed to add column '$columnName': " . $conn->error . "\n";
        exit(1);
    }
}

echo "✓ Migration successful: rating fields added to bookings table\n";
exit(0);
?>
