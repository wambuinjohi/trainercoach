<?php
/**
 * Migration: Create contacts table with updated_at column
 * Usage: php scripts/migrate_contacts_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `user_type` ENUM('client', 'trainer') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_phone (phone),
  INDEX idx_user_type (user_type),
  INDEX idx_created_at (created_at),
  UNIQUE KEY unique_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
";

if ($conn->query($sql)) {
    echo "✓ contacts table created or already exists\n";
} else {
    echo "✗ Failed to create contacts table: " . $conn->error . "\n";
    exit(1);
}

// Add updated_at column if it doesn't exist
$checkColumn = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='contacts' AND COLUMN_NAME='updated_at' AND TABLE_SCHEMA='" . $conn->real_escape_string($GLOBALS['database']) . "'";
$result = $conn->query($checkColumn);

if ($result && $result->num_rows === 0) {
    $alterSql = "ALTER TABLE `contacts` ADD COLUMN `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP";
    if ($conn->query($alterSql)) {
        echo "✓ Added updated_at column to contacts table\n";
    } else {
        echo "✗ Failed to add updated_at column: " . $conn->error . "\n";
        exit(1);
    }
} else {
    echo "✓ updated_at column already exists\n";
}

echo "✓ Migration completed successfully\n";
exit(0);
?>
