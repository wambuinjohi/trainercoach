<?php
/**
 * Migration: Fix categories status ENUM to include all workflow states
 * Updates the status column ENUM to support: active, pending_approval, rejected, archived
 * Usage: php scripts/migrate_fix_categories_status_enum.php
 */

require_once(__DIR__ . '/../connection.php');

echo "Updating categories status column ENUM...\n\n";

// Check current status column
$result = $conn->query("SHOW COLUMNS FROM categories WHERE Field = 'status'");
if ($result->num_rows === 0) {
    echo "✗ Status column does not exist. Please run migrate_categories_enhance.php first.\n";
    exit(1);
}

$row = $result->fetch_assoc();
echo "Current status column definition: " . $row['Type'] . "\n";

// Modify the ENUM to include all required values
$sql = "ALTER TABLE `categories` MODIFY `status` ENUM('active', 'pending_approval', 'rejected', 'archived') DEFAULT 'active' COMMENT 'Category status - active, pending_approval, rejected, or archived'";

if ($conn->query($sql)) {
    echo "✓ Status column ENUM updated successfully\n";
    echo "✓ Status column now supports: active, pending_approval, rejected, archived\n";
    echo "\n✓ Migration completed successfully!\n";
    exit(0);
} else {
    echo "✗ Failed to update status column: " . $conn->error . "\n";
    exit(1);
}
?>
