<?php
/**
 * M-Pesa Buy Goods Migration Script
 * 
 * Adds support for M-Pesa Buy Goods (CustomerBuyGoodsOnline) in addition to Paybill
 * Alters the mpesa_credentials table to support both payment types
 * 
 * Usage: php scripts/migrate_mpesa_buygods_support.php
 */

// Include database connection
require_once(__DIR__ . '/../db_config.php');

function migrate_mpesa_buygods_support() {
    global $conn;
    
    echo "========================================\n";
    echo "M-Pesa Buy Goods Support Migration\n";
    echo "========================================\n\n";
    
    // Step 1: Check if mpesa_credentials table exists
    echo "[1/3] Checking mpesa_credentials table...\n";
    
    $check_table_sql = "SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
                        WHERE TABLE_SCHEMA=DATABASE() 
                        AND TABLE_NAME='mpesa_credentials' LIMIT 1";
    
    $result = $conn->query($check_table_sql);
    if (!$result || $result->num_rows === 0) {
        echo "   ✗ mpesa_credentials table does not exist\n";
        echo "   → Please run migrate_mpesa_credentials.php first\n\n";
        return false;
    }
    
    echo "   ✓ Table exists\n\n";
    
    // Step 2: Add new columns for Buy Goods support
    echo "[2/3] Adding Buy Goods support columns...\n";
    
    $columns_to_add = [
        [
            'name' => 'paymentType',
            'definition' => "VARCHAR(50) DEFAULT 'paybill' COMMENT 'Payment type: paybill or buygods'",
            'after' => 'shortcode'
        ],
        [
            'name' => 'buyGoodsShortCode',
            'definition' => "VARCHAR(20) COMMENT 'Business short code for Buy Goods (CustomerBuyGoodsOnline)'",
            'after' => 'paymentType'
        ],
        [
            'name' => 'buyGoodsMerchantCode',
            'definition' => "VARCHAR(20) COMMENT 'Merchant/Till code (PartyB) for Buy Goods transactions'",
            'after' => 'buyGoodsShortCode'
        ]
    ];
    
    foreach ($columns_to_add as $column) {
        // Check if column already exists
        $check_col_sql = "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                          WHERE TABLE_SCHEMA=DATABASE() 
                          AND TABLE_NAME='mpesa_credentials' 
                          AND COLUMN_NAME='{$column['name']}' LIMIT 1";
        
        $col_result = $conn->query($check_col_sql);
        
        if ($col_result && $col_result->num_rows > 0) {
            echo "   ! Column '{$column['name']}' already exists, skipping...\n";
            continue;
        }
        
        $alter_sql = "ALTER TABLE mpesa_credentials ADD COLUMN {$column['name']} {$column['definition']} AFTER {$column['after']}";
        
        if ($conn->query($alter_sql)) {
            echo "   ✓ Column '{$column['name']}' added successfully\n";
        } else {
            echo "   ✗ Error adding column '{$column['name']}': " . $conn->error . "\n";
            return false;
        }
    }
    
    echo "\n";
    
    // Step 3: Verify schema
    echo "[3/3] Verifying table structure...\n";
    
    $verify_sql = "DESCRIBE mpesa_credentials";
    $verify_result = $conn->query($verify_sql);
    
    if ($verify_result) {
        $required_columns = ['id', 'consumerKey', 'consumerSecret', 'shortcode', 'passkey', 
                            'paymentType', 'buyGoodsShortCode', 'buyGoodsMerchantCode', 
                            'environment', 'created_at', 'updated_at'];
        $found_columns = [];
        
        while ($row = $verify_result->fetch_assoc()) {
            $found_columns[] = $row['Field'];
        }
        
        echo "   Current columns:\n";
        foreach ($found_columns as $col) {
            $required = in_array($col, $required_columns) ? '✓' : '  ';
            echo "   $required $col\n";
        }
        
        // Check for Buy Goods columns
        $has_payment_type = in_array('paymentType', $found_columns);
        $has_buygods_code = in_array('buyGoodsShortCode', $found_columns);
        $has_buygods_merchant = in_array('buyGoodsMerchantCode', $found_columns);
        
        if ($has_payment_type && $has_buygods_code && $has_buygods_merchant) {
            echo "\n   ✓ All Buy Goods columns present\n\n";
        } else {
            echo "\n   ✗ Some Buy Goods columns missing\n";
            echo "   - paymentType: " . ($has_payment_type ? "✓" : "✗") . "\n";
            echo "   - buyGoodsShortCode: " . ($has_buygods_code ? "✓" : "✗") . "\n";
            echo "   - buyGoodsMerchantCode: " . ($has_buygods_merchant ? "✓" : "✗") . "\n";
            return false;
        }
    } else {
        echo "   ✗ Error verifying table: " . $conn->error . "\n";
        return false;
    }
    
    // Migration complete
    echo "========================================\n";
    echo "Migration Complete!\n";
    echo "========================================\n\n";
    echo "Summary:\n";
    echo "✓ Added Buy Goods support columns\n";
    echo "✓ Schema verified\n\n";
    echo "Next steps:\n";
    echo "1. Deploy the updated mpesa_helper.php with Buy Goods support\n";
    echo "2. Update admin settings UI to configure Buy Goods credentials\n";
    echo "3. Test M-Pesa flows with both Paybill and Buy Goods\n\n";
    echo "Buy Goods Format Reference:\n";
    echo "- paymentType: 'buygods'\n";
    echo "- TransactionType: 'CustomerBuyGoodsOnline'\n";
    echo "- PartyB (merchant code): stored in buyGoodsMerchantCode\n";
    echo "- BusinessShortCode: stored in buyGoodsShortCode\n\n";
    
    return true;
}

// Run migration
if (php_sapi_name() === 'cli') {
    $success = migrate_mpesa_buygods_support();
    exit($success ? 0 : 1);
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}
?>
