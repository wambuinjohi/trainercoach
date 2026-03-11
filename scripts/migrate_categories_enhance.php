<?php
/**
 * Migration: Enhance categories table with admin and status tracking
 * Adds columns for tracking admin-created categories and archive status
 * Usage: php scripts/migrate_categories_enhance.php
 */

require_once(__DIR__ . '/../connection.php');

// Check if status column exists
$result = $conn->query("SHOW COLUMNS FROM categories LIKE 'status'");
if ($result->num_rows === 0) {
    // Add status column
    $sql1 = "ALTER TABLE `categories` ADD COLUMN `status` ENUM('active', 'archived') DEFAULT 'active' COMMENT 'Category status - active or archived'";
    if (!$conn->query($sql1)) {
        echo "✗ Failed to add status column: " . $conn->error . "\n";
        exit(1);
    }
    echo "✓ Added status column to categories table\n";
} else {
    echo "✓ status column already exists\n";
}

// Check if created_by_admin column exists
$result = $conn->query("SHOW COLUMNS FROM categories LIKE 'created_by_admin'");
if ($result->num_rows === 0) {
    // Add created_by_admin column
    $sql2 = "ALTER TABLE `categories` ADD COLUMN `created_by_admin` BOOLEAN DEFAULT FALSE COMMENT 'Tracks if admin-created vs trainer-requested'";
    if (!$conn->query($sql2)) {
        echo "✗ Failed to add created_by_admin column: " . $conn->error . "\n";
        exit(1);
    }
    echo "✓ Added created_by_admin column to categories table\n";
} else {
    echo "✓ created_by_admin column already exists\n";
}

// Add index on status for faster filtering
$result = $conn->query("SHOW INDEX FROM categories WHERE Key_name = 'idx_status'");
if ($result->num_rows === 0) {
    $sql3 = "ALTER TABLE `categories` ADD INDEX `idx_status` (`status`)";
    if (!$conn->query($sql3)) {
        echo "✗ Failed to add index on status: " . $conn->error . "\n";
        exit(1);
    }
    echo "✓ Added index on status column\n";
} else {
    echo "✓ index on status already exists\n";
}

echo "✓ Migration successful: categories table enhanced\n";
exit(0);
?>
