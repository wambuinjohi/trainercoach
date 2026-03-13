<?php
/**
 * Comprehensive Migration: Add all document and sponsorship features
 * This script runs all necessary migrations for the new document verification and sponsorship system
 * Usage: php scripts/migrate_all_document_features.php
 */

require_once(__DIR__ . '/../connection.php');

echo "========================================\n";
echo "Running Document & Sponsorship Migrations\n";
echo "========================================\n\n";

$migrations = [
    // ======================================
    // 1. Add columns to user_profiles table
    // ======================================
    [
        'name' => 'Add document columns to user_profiles',
        'sqls' => [
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `id_document_url` VARCHAR(500)",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `id_document_status` VARCHAR(50) DEFAULT 'pending'",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `id_number` VARCHAR(50)",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `discipline_certificate_url` VARCHAR(500)",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `discipline_certificate_status` VARCHAR(50) DEFAULT 'pending'",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `good_conduct_url` VARCHAR(500)",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `good_conduct_status` VARCHAR(50) DEFAULT 'pending'",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `good_conduct_grace_period_start` DATETIME",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `good_conduct_grace_period_end` DATETIME",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `sponsorship_reference_url` VARCHAR(500)",
        ]
    ],
    [
        'name' => 'Add sponsorship columns to user_profiles',
        'sqls' => [
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `sponsor_trainer_id` VARCHAR(36)",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `account_status` VARCHAR(50) DEFAULT 'registered'",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `is_verified` BOOLEAN DEFAULT FALSE",
        ]
    ],
    [
        'name' => 'Add indexes to user_profiles',
        'sqls' => [
            "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_account_status (account_status)",
            "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_sponsor_trainer_id (sponsor_trainer_id)",
            "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_id_document_status (id_document_status)",
            "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_good_conduct_status (good_conduct_status)",
        ]
    ],

    // ======================================
    // 2. Create verification_documents table
    // ======================================
    [
        'name' => 'Create verification_documents table',
        'sqls' => [
            "CREATE TABLE IF NOT EXISTS `verification_documents` (
                `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                `trainer_id` VARCHAR(36) NOT NULL,
                `document_type` VARCHAR(50) NOT NULL,
                `file_url` VARCHAR(500),
                `file_path` VARCHAR(500),
                `status` VARCHAR(50) DEFAULT 'pending',
                `rejection_reason` TEXT,
                `id_number` VARCHAR(50),
                `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `reviewed_at` DATETIME,
                `reviewed_by` VARCHAR(36),
                `expires_at` DATETIME,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_trainer_id (trainer_id),
                INDEX idx_document_type (document_type),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        ]
    ],

    // ======================================
    // 3. Create sponsor_commissions table
    // ======================================
    [
        'name' => 'Create sponsor_commissions table',
        'sqls' => [
            "CREATE TABLE IF NOT EXISTS `sponsor_commissions` (
                `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                `sponsor_trainer_id` VARCHAR(36) NOT NULL,
                `sponsored_trainer_id` VARCHAR(36) NOT NULL,
                `booking_id` VARCHAR(36) NOT NULL,
                `payment_id` VARCHAR(36),
                `commission_amount` DECIMAL(10, 2) NOT NULL,
                `status` VARCHAR(50) DEFAULT 'pending',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `paid_at` DATETIME,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (sponsor_trainer_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (sponsored_trainer_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
                INDEX idx_sponsor_trainer_id (sponsor_trainer_id),
                INDEX idx_sponsored_trainer_id (sponsored_trainer_id),
                INDEX idx_booking_id (booking_id),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        ]
    ],
];

$totalErrors = 0;
$completedMigrations = 0;

foreach ($migrations as $migration) {
    echo "Running: {$migration['name']}\n";
    $migrationErrors = 0;

    foreach ($migration['sqls'] as $sql) {
        if (!$conn->query($sql)) {
            echo "  ✗ Error: " . $conn->error . "\n";
            echo "    SQL: " . substr($sql, 0, 100) . "...\n";
            $migrationErrors++;
            $totalErrors++;
        }
    }

    if ($migrationErrors === 0) {
        echo "  ✓ Success\n\n";
        $completedMigrations++;
    } else {
        echo "  ✗ Failed with {$migrationErrors} error(s)\n\n";
    }
}

echo "========================================\n";
echo "Migration Summary\n";
echo "========================================\n";
echo "Completed: {$completedMigrations}/" . count($migrations) . "\n";
echo "Errors: {$totalErrors}\n";

if ($totalErrors === 0) {
    echo "\n✓ All migrations completed successfully!\n";
    exit(0);
} else {
    echo "\n✗ Some migrations failed. Please review errors above.\n";
    exit(1);
}
?>
