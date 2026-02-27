<?php
/**
 * M-Pesa Credentials Migration Script
 * 
 * Migrates M-Pesa credentials from JSON blob in platform_settings table
 * to a dedicated mpesa_credentials table.
 * 
 * Usage: php scripts/migrate_mpesa_credentials.php
 */

// Include database connection
require_once(__DIR__ . '/../db_config.php');

function migrate_mpesa_credentials() {
    global $conn;
    
    echo "========================================\n";
    echo "M-Pesa Credentials Migration\n";
    echo "========================================\n\n";
    
    // Step 1: Create the new mpesa_credentials table
    echo "[1/4] Creating mpesa_credentials table...\n";
    
    $create_table_sql = "
    CREATE TABLE IF NOT EXISTS `mpesa_credentials` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `consumerKey` VARCHAR(255) NOT NULL,
        `consumerSecret` VARCHAR(255) NOT NULL,
        `shortcode` VARCHAR(20) NOT NULL,
        `passkey` VARCHAR(255) NOT NULL,
        `environment` VARCHAR(50) DEFAULT 'production',
        `securityCredential` VARCHAR(500),
        `resultUrl` TEXT,
        `initiatorName` VARCHAR(255),
        `commandId` VARCHAR(100) DEFAULT 'BusinessPayment',
        `transactionType` VARCHAR(100) DEFAULT 'BusinessPayment',
        `c2bCallbackUrl` TEXT,
        `b2cCallbackUrl` TEXT,
        `queueTimeoutUrl` TEXT,
        `source` VARCHAR(100) DEFAULT 'admin_settings',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    
    if ($conn->query($create_table_sql)) {
        echo "   ✓ Table created successfully\n\n";
    } else {
        echo "   ✗ Error creating table: " . $conn->error . "\n";
        return false;
    }
    
    // Step 2: Check if platform_settings table exists and has mpesa_credentials entry
    echo "[2/4] Checking for existing M-Pesa credentials in platform_settings...\n";
    
    $check_table_sql = "SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
                        WHERE TABLE_SCHEMA=DATABASE() 
                        AND TABLE_NAME='platform_settings' LIMIT 1";
    
    $result = $conn->query($check_table_sql);
    if (!$result || $result->num_rows === 0) {
        echo "   ! platform_settings table does not exist. Skipping data migration.\n";
        echo "   → New table created. You can start using mpesa_credentials directly.\n\n";
        return true;
    }
    
    $select_creds_sql = "SELECT value FROM platform_settings 
                         WHERE setting_key = 'mpesa_credentials' LIMIT 1";
    
    $result = $conn->query($select_creds_sql);
    
    if (!$result) {
        echo "   ✗ Error querying platform_settings: " . $conn->error . "\n";
        return false;
    }
    
    if ($result->num_rows === 0) {
        echo "   ! No M-Pesa credentials found in platform_settings.\n";
        echo "   → Table created. You can start using mpesa_credentials directly.\n\n";
        return true;
    }
    
    $row = $result->fetch_assoc();
    $credentials_json = $row['value'];
    
    echo "   ✓ Found existing M-Pesa credentials in platform_settings\n\n";
    
    // Step 3: Parse and validate the JSON credentials
    echo "[3/4] Parsing and validating credentials...\n";
    
    $credentials = json_decode($credentials_json, true);
    
    if (!$credentials || !is_array($credentials)) {
        echo "   ✗ Invalid JSON in mpesa_credentials: " . json_last_error_msg() . "\n";
        return false;
    }
    
    // Validate required fields
    $required_fields = ['consumerKey', 'consumerSecret', 'shortcode', 'passkey'];
    $missing_fields = [];
    
    foreach ($required_fields as $field) {
        if (empty($credentials[$field])) {
            $missing_fields[] = $field;
        }
    }
    
    if (!empty($missing_fields)) {
        echo "   ✗ Missing required fields: " . implode(', ', $missing_fields) . "\n";
        return false;
    }
    
    echo "   ✓ Credentials validated\n";
    echo "   Fields found:\n";
    echo "   - Environment: " . ($credentials['environment'] ?? 'production') . "\n";
    echo "   - Shortcode: " . $credentials['shortcode'] . "\n";
    echo "   - Source: " . ($credentials['source'] ?? 'admin_settings') . "\n\n";
    
    // Step 4: Insert credentials into new table
    echo "[4/4] Migrating credentials to mpesa_credentials table...\n";
    
    $insert_sql = "
    INSERT INTO mpesa_credentials (
        consumerKey, consumerSecret, shortcode, passkey, environment,
        securityCredential, resultUrl, initiatorName, commandId, transactionType,
        c2bCallbackUrl, b2cCallbackUrl, queueTimeoutUrl, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";
    
    $stmt = $conn->prepare($insert_sql);
    if (!$stmt) {
        echo "   ✗ Prepare failed: " . $conn->error . "\n";
        return false;
    }
    
    $stmt->bind_param(
        "ssssssssssssss",
        $credentials['consumerKey'],
        $credentials['consumerSecret'],
        $credentials['shortcode'],
        $credentials['passkey'],
        $credentials['environment'] ?? 'production',
        $credentials['securityCredential'] ?? null,
        $credentials['resultUrl'] ?? null,
        $credentials['initiatorName'] ?? null,
        $credentials['commandId'] ?? 'BusinessPayment',
        $credentials['transactionType'] ?? 'BusinessPayment',
        $credentials['c2bCallbackUrl'] ?? null,
        $credentials['b2cCallbackUrl'] ?? null,
        $credentials['queueTimeoutUrl'] ?? null,
        $credentials['source'] ?? 'admin_settings'
    );
    
    if ($stmt->execute()) {
        echo "   ✓ Credentials migrated successfully\n\n";
        $stmt->close();
    } else {
        echo "   ✗ Insert failed: " . $conn->error . "\n";
        $stmt->close();
        return false;
    }
    
    // Step 5: Verify migration
    echo "[5/5] Verifying migration...\n";
    
    $verify_sql = "SELECT COUNT(*) as count FROM mpesa_credentials LIMIT 1";
    $verify_result = $conn->query($verify_sql);
    
    if ($verify_result) {
        $count_row = $verify_result->fetch_assoc();
        $count = $count_row['count'];
        
        if ($count > 0) {
            echo "   ✓ Verification successful: $count credential(s) in new table\n\n";
        } else {
            echo "   ✗ Verification failed: No credentials in new table\n";
            return false;
        }
    }
    
    // Migration complete
    echo "========================================\n";
    echo "Migration Complete!\n";
    echo "========================================\n\n";
    echo "Summary:\n";
    echo "✓ Created mpesa_credentials table\n";
    echo "✓ Migrated existing credentials\n";
    echo "✓ Data verified\n\n";
    echo "Next steps:\n";
    echo "1. Deploy the updated backend code (mpesa_helper.php)\n";
    echo "2. Test M-Pesa flows (STK Push, B2C, Admin Settings)\n";
    echo "3. After verification, run cleanup to remove old entry:\n";
    echo "   DELETE FROM platform_settings WHERE setting_key = 'mpesa_credentials';\n\n";
    
    return true;
}

// Run migration
if (php_sapi_name() === 'cli') {
    $success = migrate_mpesa_credentials();
    exit($success ? 0 : 1);
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}
?>
