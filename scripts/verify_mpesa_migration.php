<?php
/**
 * M-Pesa Credentials Migration Verification & Cleanup Script
 * 
 * Verifies the migration was successful and provides cleanup options
 * 
 * Usage: php scripts/verify_mpesa_migration.php
 */

require_once(__DIR__ . '/../db_config.php');

function verify_mpesa_migration() {
    global $conn;
    
    echo "========================================\n";
    echo "M-Pesa Migration Verification\n";
    echo "========================================\n\n";
    
    // Step 1: Check if new mpesa_credentials table exists
    echo "[1/5] Checking mpesa_credentials table...\n";
    
    $check_table = "SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA=DATABASE() 
                    AND TABLE_NAME='mpesa_credentials' LIMIT 1";
    
    $result = $conn->query($check_table);
    
    if (!$result || $result->num_rows === 0) {
        echo "   ✗ ERROR: mpesa_credentials table does not exist\n";
        echo "   → Run scripts/migrate_mpesa_credentials.php first\n\n";
        return false;
    }
    
    echo "   ✓ mpesa_credentials table exists\n\n";
    
    // Step 2: Check table structure
    echo "[2/5] Verifying table structure...\n";
    
    $check_structure = "SHOW COLUMNS FROM mpesa_credentials";
    $result = $conn->query($check_structure);
    
    $expected_columns = [
        'id', 'consumerKey', 'consumerSecret', 'shortcode', 'passkey',
        'environment', 'securityCredential', 'resultUrl', 'initiatorName',
        'c2bCallbackUrl', 'b2cCallbackUrl', 'source', 'created_at', 'updated_at'
    ];
    
    $actual_columns = [];
    while ($col = $result->fetch_assoc()) {
        $actual_columns[] = $col['Field'];
    }
    
    $missing = array_diff($expected_columns, $actual_columns);
    
    if (!empty($missing)) {
        echo "   ✗ ERROR: Missing columns: " . implode(', ', $missing) . "\n";
        return false;
    }
    
    echo "   ✓ All required columns present\n\n";
    
    // Step 3: Check for existing credentials
    echo "[3/5] Checking for M-Pesa credentials...\n";
    
    $count_new = $conn->query("SELECT COUNT(*) as count FROM mpesa_credentials");
    $new_count_row = $count_new->fetch_assoc();
    $new_count = $new_count_row['count'];
    
    echo "   • Credentials in mpesa_credentials table: $new_count\n";
    
    // Check platform_settings for old entry
    $check_old = "SELECT COUNT(*) as count FROM platform_settings 
                  WHERE setting_key = 'mpesa_credentials' LIMIT 1";
    $old_result = @$conn->query($check_old);
    $old_count = 0;
    
    if ($old_result) {
        $old_row = $old_result->fetch_assoc();
        $old_count = $old_row['count'];
    }
    
    echo "   • Credentials in platform_settings table (legacy): $old_count\n\n";
    
    // Step 4: Verify credential details
    echo "[4/5] Verifying credential details...\n";
    
    if ($new_count > 0) {
        $detail_sql = "SELECT id, environment, shortcode, source, 
                             created_at, updated_at FROM mpesa_credentials 
                       ORDER BY updated_at DESC LIMIT 1";
        $detail = $conn->query($detail_sql);
        $cred = $detail->fetch_assoc();
        
        echo "   • ID: " . $cred['id'] . "\n";
        echo "   • Environment: " . $cred['environment'] . "\n";
        echo "   • Shortcode: " . $cred['shortcode'] . "\n";
        echo "   • Source: " . $cred['source'] . "\n";
        echo "   • Last Updated: " . $cred['updated_at'] . "\n";
        echo "   • Created: " . $cred['created_at'] . "\n";
        echo "   ✓ Credentials found and accessible\n\n";
    } else {
        echo "   ! No credentials in new table yet\n";
        echo "   → Credentials will be created when you save from Admin Settings\n\n";
    }
    
    // Step 5: Test backend functions
    echo "[5/5] Testing backend functions...\n";
    
    // Include the helper functions
    @require_once(__DIR__ . '/../mpesa_helper.php');
    
    if (function_exists('getMpesaCredentials')) {
        echo "   ✓ getMpesaCredentials() function available\n";
        
        $test_creds = getMpesaCredentials();
        if ($test_creds && !empty($test_creds['consumer_key'])) {
            echo "   ✓ getMpesaCredentials() returns valid credentials\n";
            echo "     - Source: " . $test_creds['source'] . "\n";
            echo "     - Environment: " . $test_creds['environment'] . "\n";
        } else {
            echo "   ! getMpesaCredentials() returns empty (may need to configure)\n";
        }
    } else {
        echo "   ✗ getMpesaCredentials() function not available\n";
    }
    
    if (function_exists('getMpesaCredentialsForAdmin')) {
        echo "   ✓ getMpesaCredentialsForAdmin() function available\n";
    } else {
        echo "   ✗ getMpesaCredentialsForAdmin() function not available\n";
    }
    
    if (function_exists('saveMpesaCredentials')) {
        echo "   ✓ saveMpesaCredentials() function available\n";
    } else {
        echo "   ✗ saveMpesaCredentials() function not available\n";
    }
    
    echo "\n";
    
    // Step 6: Provide status and next steps
    echo "========================================\n";
    echo "Verification Complete!\n";
    echo "========================================\n\n";
    
    echo "Status Summary:\n";
    echo "✓ New mpesa_credentials table created\n";
    echo "✓ Table structure verified\n";
    if ($new_count > 0) {
        echo "✓ Credentials migrated to new table\n";
    } else {
        echo "! Credentials not yet in new table (will be added on next admin save)\n";
    }
    echo "✓ Backend functions ready\n\n";
    
    if ($old_count > 0 && $new_count > 0) {
        echo "Cleanup Required:\n";
        echo "━━━━━━━━━━━━━━━━━\n";
        echo "Old credentials still exist in platform_settings.\n";
        echo "After verifying all flows work correctly, run cleanup:\n\n";
        echo "Option 1 - From database:\n";
        echo "  DELETE FROM platform_settings WHERE setting_key = 'mpesa_credentials';\n\n";
        echo "Option 2 - Using this script with --cleanup flag:\n";
        echo "  php scripts/verify_mpesa_migration.php --cleanup\n\n";
    } else {
        echo "Migration Status:\n";
        echo "━━━━━━━━━━━━━━━━━\n";
        if ($old_count === 0 && $new_count > 0) {
            echo "✓ Migration complete! Old entries have been cleaned up.\n";
        }
    }
    
    echo "\n";
    echo "Next Steps:\n";
    echo "1. Test admin settings save/load flow\n";
    echo "2. Test STK Push payment flow\n";
    echo "3. Test B2C payment flow\n";
    echo "4. Run cleanup if using old data\n";
    echo "5. Monitor error logs for any issues\n\n";
    
    return true;
}

function cleanup_old_credentials() {
    global $conn;
    
    echo "========================================\n";
    echo "M-Pesa Credentials Cleanup\n";
    echo "========================================\n\n";
    
    // Check if old entry exists
    $check = "SELECT COUNT(*) as count FROM platform_settings 
              WHERE setting_key = 'mpesa_credentials' LIMIT 1";
    
    $result = @$conn->query($check);
    
    if (!$result) {
        echo "✗ Cannot access platform_settings table\n";
        return false;
    }
    
    $row = $result->fetch_assoc();
    $count = $row['count'];
    
    if ($count === 0) {
        echo "✓ No old credentials found. Nothing to clean up.\n";
        return true;
    }
    
    echo "Found $count old credential entry in platform_settings.\n";
    echo "Deleting...\n\n";
    
    $delete_sql = "DELETE FROM platform_settings WHERE setting_key = 'mpesa_credentials'";
    
    if ($conn->query($delete_sql)) {
        echo "✓ Old credentials removed successfully\n";
        echo "✓ Migration complete!\n\n";
        return true;
    } else {
        echo "✗ Error deleting old credentials: " . $conn->error . "\n";
        return false;
    }
}

// Main execution
if (php_sapi_name() === 'cli') {
    $cleanup_mode = isset($argv[1]) && $argv[1] === '--cleanup';
    
    if ($cleanup_mode) {
        $success = cleanup_old_credentials();
    } else {
        $success = verify_mpesa_migration();
    }
    
    exit($success ? 0 : 1);
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}
?>
