<?php
/**
 * Migration: Add merchant_request_id column to b2c_payment_callbacks table
 * 
 * This script adds the merchant_request_id column to b2c_payment_callbacks table
 * to support tracking M-Pesa merchant request IDs in callback responses.
 */

require_once(__DIR__ . '/../connection.php');

echo "\n" . str_repeat("=", 60) . "\n";
echo "Adding merchant_request_id to b2c_payment_callbacks\n";
echo str_repeat("=", 60) . "\n\n";

try {
    // Check if column already exists
    $checkSql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_NAME = 'b2c_payment_callbacks' 
                 AND COLUMN_NAME = 'merchant_request_id'
                 AND TABLE_SCHEMA = '" . $conn->real_escape_string(getenv('DB_NAME') ?: 'skatrykc_trainer') . "'";
    
    $result = $conn->query($checkSql);
    
    if ($result && $result->num_rows > 0) {
        echo "✓ Column 'merchant_request_id' already exists in b2c_payment_callbacks\n";
    } else {
        // Add the column
        $alterSql = "ALTER TABLE `b2c_payment_callbacks` 
                     ADD COLUMN `merchant_request_id` VARCHAR(255) 
                     COMMENT 'M-Pesa merchant request ID from callback'
                     AFTER `conversation_id`";
        
        if ($conn->query($alterSql)) {
            echo "✓ Column 'merchant_request_id' added successfully to b2c_payment_callbacks\n";
            
            // Add index for merchant_request_id
            $indexSql = "ALTER TABLE `b2c_payment_callbacks` 
                        ADD INDEX `idx_merchant_request_id` (`merchant_request_id`)";
            
            if ($conn->query($indexSql)) {
                echo "✓ Index 'idx_merchant_request_id' created successfully\n";
            } else {
                echo "⚠ Warning: Could not create index: " . $conn->error . "\n";
            }
        } else {
            echo "✗ Error adding column: " . $conn->error . "\n";
            exit(1);
        }
    }
    
    echo "\n" . str_repeat("=", 60) . "\n";
    echo "Migration completed successfully!\n";
    echo str_repeat("=", 60) . "\n\n";
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}

$conn->close();
?>
