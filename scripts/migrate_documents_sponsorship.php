<?php
/**
 * Migration: Add document and sponsorship fields to user_profiles table
 * Usage: php scripts/migrate_documents_sponsorship.php
 */

require_once(__DIR__ . '/../connection.php');

$migrations = [
    // Add document-related columns to user_profiles
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `id_document_url` VARCHAR(500) AFTER `certifications`",
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `id_document_status` VARCHAR(50) DEFAULT 'pending' AFTER `id_document_url`",
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `id_number` VARCHAR(50) AFTER `id_document_status`",
    
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `discipline_certificate_url` VARCHAR(500) AFTER `id_number`",
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `discipline_certificate_status` VARCHAR(50) DEFAULT 'pending' AFTER `discipline_certificate_url`",
    
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `good_conduct_url` VARCHAR(500) AFTER `discipline_certificate_status`",
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `good_conduct_status` VARCHAR(50) DEFAULT 'pending' AFTER `good_conduct_url`",
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `good_conduct_grace_period_start` DATETIME AFTER `good_conduct_status`",
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `good_conduct_grace_period_end` DATETIME AFTER `good_conduct_grace_period_start`",
    
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `sponsorship_reference_url` VARCHAR(500) AFTER `good_conduct_grace_period_end`",
    
    // Add sponsorship columns to user_profiles
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `sponsor_trainer_id` VARCHAR(36) AFTER `sponsorship_reference_url`",
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `account_status` VARCHAR(50) DEFAULT 'registered' AFTER `sponsor_trainer_id`",
    "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `is_verified` BOOLEAN DEFAULT FALSE AFTER `account_status`",
    
    // Add indexes for new columns
    "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_account_status (account_status)",
    "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_sponsor_trainer_id (sponsor_trainer_id)",
    "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_id_document_status (id_document_status)",
    "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_good_conduct_status (good_conduct_status)",
];

$failed = 0;
foreach ($migrations as $sql) {
    if (!$conn->query($sql)) {
        echo "✗ Failed: " . $conn->error . "\n";
        echo "  SQL: " . $sql . "\n";
        $failed++;
    }
}

if ($failed === 0) {
    echo "✓ Migration successful: All document and sponsorship columns added to user_profiles table\n";
    exit(0);
} else {
    echo "✗ Migration failed with " . $failed . " error(s)\n";
    exit(1);
}
?>
