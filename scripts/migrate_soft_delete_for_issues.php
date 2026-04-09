<?php
/**
 * Migration: Add soft delete (deleted_at) and pagination support to reported_issues table
 * Usage: php scripts/migrate_soft_delete_for_issues.php
 * 
 * This script adds:
 * - deleted_at column for soft deletes
 * - Index on deleted_at for filtering performance
 */

require_once(__DIR__ . '/../connection.php');

echo "=" . str_repeat("=", 70) . "\n";
echo "Migration: Add Soft Delete Support to reported_issues\n";
echo "=" . str_repeat("=", 70) . "\n\n";

// Check if deleted_at column already exists
$checkDeletedAt = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'reported_issues' 
                   AND TABLE_SCHEMA = DATABASE() 
                   AND COLUMN_NAME = 'deleted_at'";

$result = $conn->query($checkDeletedAt);

if ($result && $result->num_rows === 0) {
    echo "Adding deleted_at column to reported_issues table...\n";
    
    $sql = "ALTER TABLE `reported_issues` 
            ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Soft delete timestamp' AFTER `updated_at`";
    
    if ($conn->query($sql)) {
        echo "  ✓ Added deleted_at column\n";
    } else {
        echo "  ✗ Failed to add deleted_at column: " . $conn->error . "\n";
        $conn->close();
        exit(1);
    }
} else {
    echo "✓ deleted_at column already exists in reported_issues table\n";
}

// Check and create index on deleted_at for better query performance
$checkIndex = "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
               WHERE TABLE_NAME = 'reported_issues' 
               AND TABLE_SCHEMA = DATABASE() 
               AND INDEX_NAME = 'idx_deleted_at'";

$result = $conn->query($checkIndex);

if ($result && $result->num_rows === 0) {
    echo "Creating index on deleted_at column for performance...\n";
    
    $sql = "ALTER TABLE `reported_issues` 
            ADD INDEX `idx_deleted_at` (`deleted_at`)";
    
    if ($conn->query($sql)) {
        echo "  ✓ Created idx_deleted_at index\n";
    } else {
        echo "  ✗ Failed to create index: " . $conn->error . "\n";
        $conn->close();
        exit(1);
    }
} else {
    echo "✓ idx_deleted_at index already exists\n";
}

// Verify the changes
echo "\nVerifying schema changes...\n";
$verify = "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'reported_issues' 
           AND TABLE_SCHEMA = DATABASE() 
           AND COLUMN_NAME IN ('deleted_at', 'updated_at')
           ORDER BY COLUMN_NAME";

$result = $conn->query($verify);

if ($result && $result->num_rows > 0) {
    echo "  Column verification:\n";
    while ($row = $result->fetch_assoc()) {
        echo "    ✓ {$row['COLUMN_NAME']}: {$row['COLUMN_TYPE']} " . 
             ($row['IS_NULLABLE'] === 'YES' ? '(nullable)' : '(not null)') . "\n";
    }
} else {
    echo "  ✗ Failed to verify columns\n";
    $conn->close();
    exit(1);
}

$conn->close();

echo "\n" . str_repeat("=", 70) . "\n";
echo "✓ Migration completed successfully!\n";
echo "\nSoft delete is now ready to use:\n";
echo "  - Use UPDATE to set deleted_at = NOW() to soft delete\n";
echo "  - Use WHERE deleted_at IS NULL in queries to fetch non-deleted items\n";
echo "=" . str_repeat("=", 70) . "\n";
?>
