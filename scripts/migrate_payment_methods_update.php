<?php
/**
 * Migration: Update payment_methods table schema
 * 
 * Converts existing payment_methods table from generic JSON structure
 * to structured payment method tracking with specific fields for different methods
 * 
 * Changes:
 * - Remove: method (VARCHAR), details (JSON)
 * - Add: type, phone_number, card_last_four, bank_account, is_default, is_active
 * 
 * Usage: php scripts/migrate_payment_methods_update.php
 */

require_once(__DIR__ . '/../connection.php');

echo "\n" . str_repeat("=", 70) . "\n";
echo "PAYMENT METHODS TABLE SCHEMA UPDATE\n";
echo str_repeat("=", 70) . "\n\n";

$operations = [];
$errors = [];

// Step 1: Check if table exists
$checkTableSql = "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_methods'";
$tableExists = $conn->query($checkTableSql);

if (!$tableExists || $tableExists->num_rows === 0) {
    echo "Table does not exist. Creating new payment_methods table...\n";
    
    // Create new table with correct schema
    $createTableSql = "
        CREATE TABLE `payment_methods` (
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
    ";
    
    if ($conn->query($createTableSql)) {
        echo "✓ New payment_methods table created successfully\n";
        $operations[] = "✓ Created payment_methods table with new schema";
    } else {
        echo "✗ Failed to create payment_methods table: " . $conn->error . "\n";
        $errors[] = "Failed to create table: " . $conn->error;
    }
} else {
    echo "Table exists. Checking structure for updates...\n\n";
    
    // Step 2: Check if old columns exist
    $checkOldColumnsSql = "
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_methods' 
        AND COLUMN_NAME IN ('method', 'details')
    ";
    
    $oldColumnsResult = $conn->query($checkOldColumnsSql);
    $oldColumnsExist = $oldColumnsResult && $oldColumnsResult->num_rows > 0;
    
    // Step 3: Check if new columns exist
    $checkNewColumnsSql = "
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_methods' 
        AND COLUMN_NAME IN ('type', 'phone_number', 'card_last_four', 'bank_account', 'is_default', 'is_active')
    ";
    
    $newColumnsResult = $conn->query($checkNewColumnsSql);
    $newColumnsCount = $newColumnsResult ? $newColumnsResult->num_rows : 0;
    
    if ($oldColumnsExist && $newColumnsCount < 6) {
        echo "Old schema detected. Performing schema migration...\n\n";
        
        // Backup existing data if method column exists and has data
        echo "Step 1: Backing up existing data...\n";
        $checkDataSql = "SELECT COUNT(*) as cnt FROM payment_methods WHERE method IS NOT NULL";
        $dataResult = $conn->query($checkDataSql);
        $dataRow = $dataResult->fetch_assoc();
        $existingRecords = $dataRow['cnt'];
        
        if ($existingRecords > 0) {
            echo "  Found $existingRecords existing payment method records\n";
            
            // Create backup table
            $backupSql = "CREATE TABLE IF NOT EXISTS `payment_methods_backup` LIKE `payment_methods`";
            if ($conn->query($backupSql)) {
                $backupInsertSql = "INSERT INTO payment_methods_backup SELECT * FROM payment_methods";
                if ($conn->query($backupInsertSql)) {
                    echo "  ✓ Backup created in payment_methods_backup table\n";
                    $operations[] = "✓ Created backup table: payment_methods_backup";
                } else {
                    echo "  ⚠ Warning: Backup insert failed: " . $conn->error . "\n";
                }
            }
        } else {
            echo "  No existing payment method records found\n";
        }
        
        // Drop old columns
        echo "\nStep 2: Removing old columns...\n";
        
        $dropColumns = [
            'method' => "ALTER TABLE `payment_methods` DROP COLUMN IF EXISTS `method`",
            'details' => "ALTER TABLE `payment_methods` DROP COLUMN IF EXISTS `details`"
        ];
        
        foreach ($dropColumns as $colName => $dropSql) {
            echo "  Dropping column: $colName... ";
            if ($conn->query($dropSql)) {
                echo "✓\n";
                $operations[] = "✓ Dropped column: $colName";
            } else {
                if (strpos($conn->error, "can't DROP") !== false || strpos($conn->error, "doesn't exist") !== false) {
                    echo "✓ (already removed)\n";
                    $operations[] = "✓ Column $colName already removed";
                } else {
                    echo "✗\n";
                    $errors[] = "Failed to drop $colName: " . $conn->error;
                }
            }
        }
        
        // Add new columns
        echo "\nStep 3: Adding new columns...\n";
        
        $newColumns = [
            'type' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `type` VARCHAR(50) NOT NULL COMMENT 'mpesa, card, bank' AFTER `user_id`",
            'phone_number' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `phone_number` VARCHAR(20) COMMENT 'M-Pesa phone number' AFTER `type`",
            'card_last_four' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `card_last_four` VARCHAR(4) COMMENT 'Credit card last 4 digits' AFTER `phone_number`",
            'bank_account' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `bank_account` VARCHAR(50) COMMENT 'Bank account identifier' AFTER `card_last_four`",
            'is_default' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `is_default` BOOLEAN DEFAULT FALSE COMMENT 'Default payment method' AFTER `bank_account`",
            'is_active' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `is_active` BOOLEAN DEFAULT TRUE COMMENT 'Active payment method' AFTER `is_default`"
        ];
        
        foreach ($newColumns as $colName => $addSql) {
            echo "  Adding column: $colName... ";
            if ($conn->query($addSql)) {
                echo "✓\n";
                $operations[] = "✓ Added column: $colName";
            } else {
                if (strpos($conn->error, "already exists") !== false || strpos($conn->error, "Duplicate") !== false) {
                    echo "✓ (already exists)\n";
                    $operations[] = "✓ Column $colName already exists";
                } else {
                    echo "✗\n";
                    $errors[] = "Failed to add $colName: " . $conn->error;
                }
            }
        }
        
        // Add indexes
        echo "\nStep 4: Adding indexes...\n";
        
        $indexes = [
            'idx_user_id' => "ALTER TABLE `payment_methods` ADD INDEX IF NOT EXISTS `idx_user_id` (`user_id`)",
            'idx_is_default' => "ALTER TABLE `payment_methods` ADD INDEX IF NOT EXISTS `idx_is_default` (`is_default`)",
            'idx_is_active' => "ALTER TABLE `payment_methods` ADD INDEX IF NOT EXISTS `idx_is_active` (`is_active`)"
        ];
        
        foreach ($indexes as $indexName => $indexSql) {
            echo "  Creating index: $indexName... ";
            if ($conn->query($indexSql)) {
                echo "✓\n";
                $operations[] = "✓ Created index: $indexName";
            } else {
                if (strpos($conn->error, "already exists") !== false) {
                    echo "✓ (already exists)\n";
                    $operations[] = "✓ Index $indexName already exists";
                } else {
                    echo "⚠ (skipped)\n";
                }
            }
        }
        
    } else if ($newColumnsCount === 6) {
        echo "✓ Table already has new schema. No migration needed.\n";
        $operations[] = "✓ payment_methods table already has updated schema";
    } else {
        echo "Table structure is in intermediate state. Completing migration...\n";
        
        // Add any missing columns
        $allNewColumns = [
            'type' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `type` VARCHAR(50) NOT NULL COMMENT 'mpesa, card, bank'",
            'phone_number' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `phone_number` VARCHAR(20)",
            'card_last_four' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `card_last_four` VARCHAR(4)",
            'bank_account' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `bank_account` VARCHAR(50)",
            'is_default' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `is_default` BOOLEAN DEFAULT FALSE",
            'is_active' => "ALTER TABLE `payment_methods` ADD COLUMN IF NOT EXISTS `is_active` BOOLEAN DEFAULT TRUE"
        ];
        
        foreach ($allNewColumns as $colName => $addSql) {
            if ($conn->query($addSql)) {
                $operations[] = "✓ Added/verified column: $colName";
            }
        }
    }
}

// Print summary
echo "\n" . str_repeat("=", 70) . "\n";
echo "MIGRATION SUMMARY\n";
echo str_repeat("=", 70) . "\n\n";

foreach ($operations as $op) {
    echo "$op\n";
}

if (!empty($errors)) {
    echo "\n⚠ ERRORS:\n";
    echo str_repeat("-", 70) . "\n";
    foreach ($errors as $error) {
        echo "  $error\n";
    }
    exit(1);
} else {
    echo "\n✓ Payment methods table migration complete!\n";
    echo "\n📊 UPDATED SCHEMA:\n";
    echo "  • id - UUID primary key\n";
    echo "  • user_id - User reference (FK)\n";
    echo "  • type - Payment type (mpesa, card, bank)\n";
    echo "  • phone_number - M-Pesa phone number\n";
    echo "  • card_last_four - Card last 4 digits\n";
    echo "  • bank_account - Bank account identifier\n";
    echo "  • is_default - Default payment method flag\n";
    echo "  • is_active - Active status flag\n";
    echo "  • created_at - Created timestamp\n";
    echo "  • updated_at - Updated timestamp\n";
    echo "\n";
    exit(0);
}
?>
