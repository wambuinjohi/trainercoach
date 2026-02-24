<?php
/**
 * Migration: Create SMS schema (sms_templates and sms_logs tables)
 * Usage: php scripts/migrate_sms_schema.php
 */

require_once(__DIR__ . '/../connection.php');

$migrations = [
    'sms_templates' => "
        CREATE TABLE IF NOT EXISTS `sms_templates` (
          `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          `name` VARCHAR(255) NOT NULL UNIQUE,
          `event_type` VARCHAR(50) NOT NULL,
          `template_text` LONGTEXT NOT NULL,
          `active` BOOLEAN DEFAULT TRUE,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX `idx_event_type` (`event_type`),
          INDEX `idx_active` (`active`),
          INDEX `idx_name` (`name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'sms_logs' => "
        CREATE TABLE IF NOT EXISTS `sms_logs` (
          `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          `user_id` VARCHAR(36),
          `phone_number` VARCHAR(20) NOT NULL,
          `message` LONGTEXT NOT NULL,
          `template_id` VARCHAR(36),
          `event_type` VARCHAR(50) NOT NULL,
          `event_id` VARCHAR(255),
          `status` VARCHAR(50) DEFAULT 'pending',
          `provider_response` JSON,
          `sent_at` TIMESTAMP NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX `idx_user_id` (`user_id`),
          INDEX `idx_phone_number` (`phone_number`),
          INDEX `idx_event_type` (`event_type`),
          INDEX `idx_status` (`status`),
          INDEX `idx_created_at` (`created_at` DESC),
          INDEX `idx_template_id` (`template_id`),
          FOREIGN KEY (`template_id`) REFERENCES `sms_templates`(`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    "
];

$successCount = 0;
$failureCount = 0;
$messages = [];

foreach ($migrations as $tableName => $sql) {
    if ($conn->query($sql)) {
        $successCount++;
        $messages[] = "✓ $tableName table created";
        echo "✓ Migration successful: $tableName table created or already exists\n";
    } else {
        $failureCount++;
        $messages[] = "✗ $tableName failed: " . $conn->error;
        echo "✗ Migration failed for $tableName: " . $conn->error . "\n";
    }
}

if ($failureCount === 0) {
    echo "\n✓ All SMS migrations completed successfully!\n";
    exit(0);
} else {
    echo "\n✗ Some migrations failed. Check errors above.\n";
    exit(1);
}
?>
