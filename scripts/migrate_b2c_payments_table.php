<?php
/**
 * Migration: Create B2C Payment Tables
 * Usage: php scripts/migrate_b2c_payments_table.php
 * 
 * Creates tables for handling M-Pesa B2C (Business to Consumer) payments.
 * Used for platform payouts to trainers and clients.
 * 
 * Tables:
 * - b2c_payments: Tracks B2C payment requests initiated by the platform
 * - b2c_payment_callbacks: Stores callback responses from M-Pesa API
 */

require_once(__DIR__ . '/../connection.php');

$tables = [
    'b2c_payments' => "
        CREATE TABLE IF NOT EXISTS `b2c_payments` (
          `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          `user_id` VARCHAR(36) NOT NULL,
          `user_type` VARCHAR(20) NOT NULL COMMENT 'trainer, client',
          `phone_number` VARCHAR(20) NOT NULL,
          `amount` DECIMAL(15, 2) NOT NULL,
          `reference_id` VARCHAR(255) UNIQUE NOT NULL COMMENT 'Unique reference for callback matching',
          `transaction_id` VARCHAR(255) UNIQUE COMMENT 'M-Pesa transaction ID',
          `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, completed, failed',
          `error_description` TEXT COMMENT 'Error message if failed',
          `reason_code` VARCHAR(100) COMMENT 'M-Pesa result code',
          `initiated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `completed_at` TIMESTAMP NULL,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT `fk_b2c_payments_user_id`
            FOREIGN KEY (`user_id`)
            REFERENCES `users`(`id`)
            ON DELETE CASCADE,
          INDEX `idx_user_id` (`user_id`),
          INDEX `idx_reference_id` (`reference_id`),
          INDEX `idx_transaction_id` (`transaction_id`),
          INDEX `idx_status` (`status`),
          INDEX `idx_initiated_at` (`initiated_at` DESC),
          INDEX `idx_phone` (`phone_number`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'b2c_payment_callbacks' => "
        CREATE TABLE IF NOT EXISTS `b2c_payment_callbacks` (
          `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          `transaction_id` VARCHAR(255) UNIQUE NOT NULL,
          `originator_conversation_id` VARCHAR(255),
          `conversation_id` VARCHAR(255),
          `result_code` INT COMMENT 'M-Pesa result code (0 = success)',
          `result_description` TEXT COMMENT 'M-Pesa result description',
          `transaction_amount` DECIMAL(15, 2),
          `receiver_phone` VARCHAR(20),
          `reference_id` VARCHAR(255) COMMENT 'Links back to b2c_payments.reference_id',
          `raw_response` LONGTEXT COMMENT 'Full JSON response from M-Pesa',
          `received_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT `fk_b2c_callbacks_reference_id`
            FOREIGN KEY (`reference_id`)
            REFERENCES `b2c_payments`(`reference_id`)
            ON DELETE CASCADE,
          INDEX `idx_transaction_id` (`transaction_id`),
          INDEX `idx_reference_id` (`reference_id`),
          INDEX `idx_result_code` (`result_code`),
          INDEX `idx_received_at` (`received_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    "
];

$successCount = 0;
$failureCount = 0;
$messages = [];

echo "\nMigrating B2C Payment Tables...\n";
echo str_repeat("=", 60) . "\n";

foreach ($tables as $tableName => $sql) {
    echo "\n➤ Creating table: $tableName\n";
    
    if ($conn->query($sql)) {
        $successCount++;
        $messages[] = "✓ Table $tableName created or already exists";
        echo "  ✓ Success\n";
    } else {
        if (strpos($conn->error, "already exists") !== false || 
            strpos($conn->error, "Duplicate") !== false) {
            $successCount++;
            $messages[] = "✓ Table $tableName already exists";
            echo "  ✓ Already exists\n";
        } else {
            $failureCount++;
            $messages[] = "✗ $tableName: " . $conn->error;
            echo "  ✗ Error: " . $conn->error . "\n";
        }
    }
}

echo "\n" . str_repeat("=", 60) . "\n";
echo "Migration Summary\n";
echo str_repeat("=", 60) . "\n";

foreach ($messages as $msg) {
    echo $msg . "\n";
}

echo "\nCreated: $successCount\n";
echo "Failed: $failureCount\n";

if ($failureCount === 0) {
    echo "\n✓ All B2C payment tables created successfully!\n";
    echo "\nUsage:\n";
    echo "- b2c_payments: Stores B2C payment requests\n";
    echo "- b2c_payment_callbacks: Stores M-Pesa callback responses\n";
    echo "\nCallback Handler: /b2c_callback.php\n";
    exit(0);
} else {
    echo "\n⚠ Some operations failed. Review the errors above.\n";
    exit(1);
}
?>
