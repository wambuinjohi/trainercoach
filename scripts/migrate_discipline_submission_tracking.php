<?php
/**
 * Migration: Create/enhance disciplines table with submission tracking
 * Adds fields to track discipline submission, review, and admin notes
 * This enables admin workflow for discipline management
 * Usage: php scripts/migrate_discipline_submission_tracking.php
 */

require_once(__DIR__ . '/../connection.php');

// First, create the disciplines table if it doesn't exist
$createTableSql = "
CREATE TABLE IF NOT EXISTS `disciplines` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique discipline ID (UUID)',
  `category_id` INT COMMENT 'Parent category ID',
  `name` VARCHAR(100) NOT NULL COMMENT 'Discipline name',
  `icon` VARCHAR(50) COMMENT 'Discipline icon',
  `description` TEXT COMMENT 'Discipline description',
  `status` ENUM('approved', 'pending_approval', 'rejected') DEFAULT 'approved' COMMENT 'Discipline status',
  `submitted_by` VARCHAR(36) COMMENT 'User ID who submitted this discipline',
  `reviewed_by` VARCHAR(36) COMMENT 'Admin user ID who reviewed this discipline',
  `admin_notes` TEXT COMMENT 'Admin notes when reviewing the discipline',
  `submitted_at` TIMESTAMP NULL COMMENT 'When the discipline was submitted',
  `reviewed_at` TIMESTAMP NULL COMMENT 'When the discipline was reviewed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT `fk_disciplines_category_id`
    FOREIGN KEY (`category_id`)
    REFERENCES `categories`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_disciplines_submitted_by`
    FOREIGN KEY (`submitted_by`)
    REFERENCES `users`(`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_disciplines_reviewed_by`
    FOREIGN KEY (`reviewed_by`)
    REFERENCES `users`(`id`)
    ON DELETE SET NULL,
  
  INDEX `idx_category_id` (`category_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_submitted_by` (`submitted_by`),
  INDEX `idx_created_at` (`created_at` DESC),
  INDEX `idx_category_status` (`category_id`, `status`),
  UNIQUE KEY `uq_category_name` (`category_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($createTableSql)) {
    echo "✓ Disciplines table created or already exists\n";
} else {
    echo "✗ Failed to create disciplines table: " . $conn->error . "\n";
    exit(1);
}

// Now add missing columns to disciplines table if it already existed
$columns = [
    'status' => "ALTER TABLE disciplines ADD COLUMN IF NOT EXISTS `status` ENUM('approved', 'pending_approval', 'rejected') DEFAULT 'approved' COMMENT 'Discipline status'",
    'submitted_by' => "ALTER TABLE disciplines ADD COLUMN IF NOT EXISTS `submitted_by` VARCHAR(36) COMMENT 'User ID who submitted this discipline'",
    'reviewed_by' => "ALTER TABLE disciplines ADD COLUMN IF NOT EXISTS `reviewed_by` VARCHAR(36) COMMENT 'Admin user ID who reviewed this discipline'",
    'admin_notes' => "ALTER TABLE disciplines ADD COLUMN IF NOT EXISTS `admin_notes` TEXT COMMENT 'Admin notes when reviewing the discipline'",
    'submitted_at' => "ALTER TABLE disciplines ADD COLUMN IF NOT EXISTS `submitted_at` TIMESTAMP NULL COMMENT 'When the discipline was submitted'",
    'reviewed_at' => "ALTER TABLE disciplines ADD COLUMN IF NOT EXISTS `reviewed_at` TIMESTAMP NULL COMMENT 'When the discipline was reviewed'",
];

echo "\nAdding/verifying discipline submission tracking fields...\n";

$successCount = 0;
$failureCount = 0;

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
    'idx_status' => "ALTER TABLE disciplines ADD INDEX IF NOT EXISTS `idx_status` (`status`)",
    'idx_submitted_by' => "ALTER TABLE disciplines ADD INDEX IF NOT EXISTS `idx_submitted_by` (`submitted_by`)",
    'idx_reviewed_by' => "ALTER TABLE disciplines ADD INDEX IF NOT EXISTS `idx_reviewed_by` (`reviewed_by`)",
    'idx_created_at' => "ALTER TABLE disciplines ADD INDEX IF NOT EXISTS `idx_created_at` (`created_at` DESC)",
];

echo "\nAdding indexes for submission tracking...\n";

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

// Add foreign key constraints if they don't exist
$constraints = [
    'fk_disciplines_submitted_by' => "ALTER TABLE disciplines ADD CONSTRAINT `fk_disciplines_submitted_by` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL",
    'fk_disciplines_reviewed_by' => "ALTER TABLE disciplines ADD CONSTRAINT `fk_disciplines_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL",
];

echo "\nAdding foreign key constraints...\n";

foreach ($constraints as $constraintName => $sql) {
    if ($conn->query($sql)) {
        echo "✓ Constraint $constraintName added\n";
    } else {
        if (strpos($conn->error, "Duplicate foreign key") !== false) {
            echo "✓ Constraint $constraintName already exists\n";
        } else {
            echo "⚠ Constraint $constraintName: " . $conn->error . "\n";
        }
    }
}

echo "\n" . str_repeat("=", 50) . "\n";
echo "Migration Summary\n";
echo str_repeat("=", 50) . "\n";
echo "Added/Verified: $successCount\n";
echo "Failed: $failureCount\n";

if ($failureCount === 0) {
    echo "\n✓ Discipline submission tracking migration completed successfully!\n";
    exit(0);
} else {
    echo "\n⚠ Some operations had issues. Review the errors above.\n";
    exit(1);
}
?>
