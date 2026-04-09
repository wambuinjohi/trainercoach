<?php
/**
 * Migration: Add ID Type, Passport Support, and Discipline Certificate features
 * This script adds support for ID/Passport selection and multi-sided document uploads
 * Usage: php scripts/migrate_passport_support.php
 */

require_once(__DIR__ . '/../connection.php');

echo "========================================\n";
echo "Running Passport & ID Type Migration\n";
echo "========================================\n\n";

$migrations = [
    // ======================================
    // 1. Add ID Type and Passport columns to user_profiles
    // ======================================
    [
        'name' => 'Add ID type and passport fields to user_profiles',
        'sqls' => [
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `id_type` VARCHAR(50) DEFAULT 'national_id' COMMENT 'national_id or passport'",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `passport_number` VARCHAR(100) NULL COMMENT 'Passport number if id_type is passport'",
            "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_id_type (id_type)",
        ]
    ],

    // ======================================
    // 2. Add ID side tracking to verification_documents
    // ======================================
    [
        'name' => 'Add ID side and document subtype to verification_documents',
        'sqls' => [
            "ALTER TABLE `verification_documents` ADD COLUMN IF NOT EXISTS `id_side` VARCHAR(20) NULL COMMENT 'front, back, or null for non-ID documents'",
            "ALTER TABLE `verification_documents` ADD COLUMN IF NOT EXISTS `document_subtype` VARCHAR(100) NULL COMMENT 'Additional classification for document variations'",
            "ALTER TABLE `verification_documents` ADD INDEX IF NOT EXISTS idx_id_side (id_side)",
            "ALTER TABLE `verification_documents` ADD INDEX IF NOT EXISTS idx_document_subtype (document_subtype)",
        ]
    ],

    // ======================================
    // 3. Ensure discipline certificate columns exist
    // ======================================
    [
        'name' => 'Ensure discipline certificate columns in user_profiles',
        'sqls' => [
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `discipline_certificate_url` VARCHAR(500) NULL",
            "ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `discipline_certificate_status` VARCHAR(50) DEFAULT 'pending'",
            "ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS idx_discipline_status (discipline_certificate_status)",
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
