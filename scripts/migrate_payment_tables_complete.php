<?php
/**
 * Comprehensive Payment System Migration
 * Creates all necessary tables for the complete payment system including:
 * - STK Push sessions
 * - Wallets
 * - Wallet transactions
 * - Payment records
 * - B2C payments
 * - Payout requests
 * 
 * Usage: php scripts/migrate_payment_tables_complete.php
 */

require_once(__DIR__ . '/../connection.php');

$tables = [
    'stk_push_sessions' => "
        CREATE TABLE IF NOT EXISTS `stk_push_sessions` (
            `id` VARCHAR(36) PRIMARY KEY,
            `phone_number` VARCHAR(20) NOT NULL,
            `amount` DECIMAL(15, 2) NOT NULL,
            `booking_id` VARCHAR(36),
            `account_reference` VARCHAR(255) NOT NULL,
            `description` TEXT,
            `checkout_request_id` VARCHAR(255) UNIQUE,
            `status` VARCHAR(50) DEFAULT 'initiated' COMMENT 'initiated, pending, success, failed, timeout',
            `result_code` VARCHAR(10),
            `result_description` TEXT,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_phone` (`phone_number`),
            INDEX `idx_status` (`status`),
            INDEX `idx_booking_id` (`booking_id`),
            INDEX `idx_checkout_request_id` (`checkout_request_id`),
            INDEX `idx_created_at` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'user_wallets' => "
        CREATE TABLE IF NOT EXISTS `user_wallets` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `user_id` VARCHAR(36) NOT NULL UNIQUE,
            `balance` DECIMAL(15, 2) DEFAULT 0,
            `available_balance` DECIMAL(15, 2) DEFAULT 0,
            `pending_balance` DECIMAL(15, 2) DEFAULT 0,
            `total_earned` DECIMAL(15, 2) DEFAULT 0,
            `total_withdrawn` DECIMAL(15, 2) DEFAULT 0,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_wallet_user_id`
                FOREIGN KEY (`user_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_updated_at` (`updated_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'wallet_transactions' => "
        CREATE TABLE IF NOT EXISTS `wallet_transactions` (
            `id` VARCHAR(36) PRIMARY KEY,
            `user_id` VARCHAR(36) NOT NULL,
            `type` VARCHAR(50) NOT NULL COMMENT 'deposit, withdrawal, commission, refund, payment',
            `amount` DECIMAL(15, 2) NOT NULL,
            `reference` VARCHAR(255),
            `description` TEXT,
            `balance_before` DECIMAL(15, 2),
            `balance_after` DECIMAL(15, 2),
            `status` VARCHAR(50) DEFAULT 'completed' COMMENT 'pending, completed, failed',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT `fk_wallet_txn_user_id`
                FOREIGN KEY (`user_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_type` (`type`),
            INDEX `idx_created_at` (`created_at` DESC),
            INDEX `idx_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'payments' => "
        CREATE TABLE IF NOT EXISTS `payments` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `user_id` VARCHAR(36),
            `client_id` VARCHAR(36),
            `trainer_id` VARCHAR(36),
            `booking_id` VARCHAR(36),
            `amount` DECIMAL(15, 2) NOT NULL,
            `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, completed, failed, refunded',
            `method` VARCHAR(50) NOT NULL COMMENT 'mpesa, stk, card, bank, wallet, b2c',
            `transaction_reference` VARCHAR(255),
            `description` TEXT,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_payments_user_id`
                FOREIGN KEY (`user_id`)
                REFERENCES `users`(`id`)
                ON DELETE SET NULL,
            CONSTRAINT `fk_payments_booking_id`
                FOREIGN KEY (`booking_id`)
                REFERENCES `bookings`(`id`)
                ON DELETE SET NULL,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_client_id` (`client_id`),
            INDEX `idx_trainer_id` (`trainer_id`),
            INDEX `idx_booking_id` (`booking_id`),
            INDEX `idx_status` (`status`),
            INDEX `idx_method` (`method`),
            INDEX `idx_created_at` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'b2c_payments' => "
        CREATE TABLE IF NOT EXISTS `b2c_payments` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `user_id` VARCHAR(36) NOT NULL,
            `user_type` VARCHAR(20) NOT NULL COMMENT 'trainer, client',
            `phone_number` VARCHAR(20) NOT NULL,
            `amount` DECIMAL(15, 2) NOT NULL,
            `reference_id` VARCHAR(255) UNIQUE NOT NULL COMMENT 'Unique reference for callback matching',
            `transaction_id` VARCHAR(255) UNIQUE COMMENT 'M-Pesa transaction ID',
            `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, initiated, completed, failed',
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
    ",
    
    'payout_requests' => "
        CREATE TABLE IF NOT EXISTS `payout_requests` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `trainer_id` VARCHAR(36) NOT NULL,
            `amount` DECIMAL(15, 2) NOT NULL,
            `commission` DECIMAL(15, 2),
            `net_amount` DECIMAL(15, 2),
            `b2c_payment_id` VARCHAR(36),
            `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, approved, completed, rejected, cancelled',
            `rejection_reason` TEXT,
            `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `approved_at` TIMESTAMP NULL,
            `completed_at` TIMESTAMP NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_payout_requests_trainer_id`
                FOREIGN KEY (`trainer_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE,
            CONSTRAINT `fk_payout_requests_b2c_payment_id`
                FOREIGN KEY (`b2c_payment_id`)
                REFERENCES `b2c_payments`(`id`)
                ON DELETE SET NULL,
            INDEX `idx_trainer_id` (`trainer_id`),
            INDEX `idx_status` (`status`),
            INDEX `idx_requested_at` (`requested_at` DESC),
            INDEX `idx_created_at` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'payment_methods' => "
        CREATE TABLE IF NOT EXISTS `payment_methods` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `user_id` VARCHAR(36) NOT NULL,
            `type` VARCHAR(50) NOT NULL COMMENT 'mpesa, card, bank',
            `phone_number` VARCHAR(20),
            `card_last_four` VARCHAR(4),
            `bank_account` VARCHAR(50),
            `is_default` BOOLEAN DEFAULT FALSE,
            `is_active` BOOLEAN DEFAULT TRUE,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_payment_methods_user_id`
                FOREIGN KEY (`user_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_is_default` (`is_default`),
            INDEX `idx_is_active` (`is_active`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    "
];

echo "\n" . str_repeat("=", 70) . "\n";
echo "COMPREHENSIVE PAYMENT SYSTEM MIGRATION\n";
echo str_repeat("=", 70) . "\n\n";

$successCount = 0;
$failureCount = 0;
$messages = [];

foreach ($tables as $tableName => $sql) {
    echo "➤ Creating/Updating table: $tableName\n";
    
    if ($conn->query($sql)) {
        $successCount++;
        $messages[] = "✓ Table $tableName configured successfully";
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

echo "\n" . str_repeat("=", 70) . "\n";
echo "MIGRATION SUMMARY\n";
echo str_repeat("=", 70) . "\n\n";

foreach ($messages as $msg) {
    echo $msg . "\n";
}

echo "\n";
echo "Created/Updated: $successCount\n";
echo "Failed: $failureCount\n";

if ($failureCount === 0) {
    echo "\n✓ All payment system tables created successfully!\n";
    echo "\n📊 Tables created:\n";
    echo "  • stk_push_sessions - STK Push payment tracking\n";
    echo "  • user_wallets - User wallet balances\n";
    echo "  • wallet_transactions - Wallet transaction history\n";
    echo "  • payments - Payment records\n";
    echo "  • b2c_payments - M-Pesa B2C payments (payouts)\n";
    echo "  • b2c_payment_callbacks - M-Pesa callback data\n";
    echo "  • payout_requests - Trainer payout requests\n";
    echo "  • payment_methods - Saved payment methods\n";
    echo "\n🔌 API Endpoints available:\n";
    echo "  • stk_push_initiate - Initiate STK Push payment\n";
    echo "  • stk_push_query - Query STK Push status\n";
    echo "  • stk_push_callback - Handle STK Push callback\n";
    echo "  • stk_push_history - Get STK Push history\n";
    echo "  • wallet_get - Get wallet balance\n";
    echo "  • wallet_update - Update wallet balance\n";
    echo "  • wallet_transactions_get - Get wallet transactions\n";
    echo "  • payment_insert - Record payment\n";
    echo "  • payout_insert - Create payout request\n";
    echo "  • payout_requests_get - Get payout requests\n";
    echo "  • payout_request_approve - Approve payout and create B2C\n";
    echo "  • b2c_payment_initiate - Initiate B2C payment\n";
    echo "  • b2c_payment_status - Get B2C payment status\n";
    echo "  • b2c_payments_get - Get all B2C payments\n";
    exit(0);
} else {
    echo "\n⚠ Some operations failed. Review the errors above.\n";
    exit(1);
}
?>
