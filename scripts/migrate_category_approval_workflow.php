<?php
/**
 * Migration: Add category approval workflow fields
 * Adds approval workflow tracking to categories table
 * Enables admin review, rejection, and notes for category submissions
 * Usage: php scripts/migrate_category_approval_workflow.php
 */

require_once(__DIR__ . '/../connection.php');

$columns = [
    'approval_status' => "ALTER TABLE categories ADD COLUMN IF NOT EXISTS `approval_status` ENUM('active', 'pending_approval', 'rejected', 'archived') DEFAULT 'active' COMMENT 'Category approval workflow status'",
    'created_by' => "ALTER TABLE categories ADD COLUMN IF NOT EXISTS `created_by` VARCHAR(36) COMMENT 'User ID who created this category'",
    'reviewed_by' => "ALTER TABLE categories ADD COLUMN IF NOT EXISTS `reviewed_by` VARCHAR(36) COMMENT 'Admin user ID who reviewed this category'",
    'rejection_reason' => "ALTER TABLE categories ADD COLUMN IF NOT EXISTS `rejection_reason` TEXT COMMENT 'Reason for rejecting the category'",
    'reviewed_at' => "ALTER TABLE categories ADD COLUMN IF NOT EXISTS `reviewed_at` TIMESTAMP NULL COMMENT 'When the category was reviewed'",
];

$successCount = 0;
$failureCount = 0;

echo "Adding category approval workflow fields...\n\n";

foreach ($columns as $columnName => $sql) {
    if ($conn->query($sql)) {
        $successCount++;
        echo "✓ Column $columnName added or already exists\n";
    } else {
        if (strpos($conn->error, "Duplicate column name") !== false) {
            $successCount++;
            echo "✓ Column $columnName already exists\n";
        } else {
            $failureCount++;
            echo "✗ Column $columnName: " . $conn->error . "\n";
        }
    }
}

// Add indexes for better query performance
$indexes = [
    'idx_approval_status' => "ALTER TABLE categories ADD INDEX IF NOT EXISTS `idx_approval_status` (`approval_status`)",
    'idx_created_by' => "ALTER TABLE categories ADD INDEX IF NOT EXISTS `idx_created_by` (`created_by`)",
    'idx_reviewed_by' => "ALTER TABLE categories ADD INDEX IF NOT EXISTS `idx_reviewed_by` (`reviewed_by`)",
];

echo "\nAdding indexes for approval workflow...\n";

foreach ($indexes as $indexName => $sql) {
    if ($conn->query($sql)) {
        echo "✓ Index $indexName added or already exists\n";
    } else {
        if (strpos($conn->error, "Duplicate key name") !== false) {
            echo "✓ Index $indexName already exists\n";
        } else {
            echo "⚠ Index $indexName: " . $conn->error . "\n";
        }
    }
}

// Add foreign key constraint for created_by if not exists
$result = $conn->query("SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'categories' AND COLUMN_NAME = 'created_by' AND CONSTRAINT_NAME != 'PRIMARY'");

if ($result->num_rows === 0) {
    $fkSql = "ALTER TABLE categories ADD CONSTRAINT `fk_categories_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL";
    if ($conn->query($fkSql)) {
        echo "✓ Foreign key constraint for created_by added\n";
    } else {
        if (strpos($conn->error, "Duplicate foreign key") !== false) {
            echo "✓ Foreign key constraint for created_by already exists\n";
        } else {
            echo "⚠ Foreign key constraint for created_by: " . $conn->error . "\n";
        }
    }
}

// Add foreign key constraint for reviewed_by if not exists
$result = $conn->query("SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'categories' AND COLUMN_NAME = 'reviewed_by' AND CONSTRAINT_NAME != 'PRIMARY'");

if ($result->num_rows === 0) {
    $fkSql = "ALTER TABLE categories ADD CONSTRAINT `fk_categories_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL";
    if ($conn->query($fkSql)) {
        echo "✓ Foreign key constraint for reviewed_by added\n";
    } else {
        if (strpos($conn->error, "Duplicate foreign key") !== false) {
            echo "✓ Foreign key constraint for reviewed_by already exists\n";
        } else {
            echo "⚠ Foreign key constraint for reviewed_by: " . $conn->error . "\n";
        }
    }
}

echo "\n" . str_repeat("=", 50) . "\n";
echo "Migration Summary\n";
echo str_repeat("=", 50) . "\n";
echo "Added/Verified: $successCount\n";
echo "Failed: $failureCount\n";

if ($failureCount === 0) {
    echo "\n✓ Category approval workflow migration completed successfully!\n";
    exit(0);
} else {
    echo "\n⚠ Some operations had issues. Review the errors above.\n";
    exit(1);
}
?>
