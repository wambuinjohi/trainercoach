<?php
/**
 * Bulk SMS Testing Script for Onfonmedia Integration
 * Tests all SMS functionality with provided credentials
 */

// Include necessary files
require_once 'connection.php';
require_once 'sms_helper.php';

// Test credentials provided by user
$test_credentials = [
    'api_key' => 'WeO21uB08jalUFdrzHDofvV3hnbR4t7qNX9LKCY5E6imJwIZ',
    'client_id' => 'trainerltd',
    'access_key' => 'trainerltd',
    'sender_id' => 'trainerltd',
    'enabled' => true
];

// Test phone numbers
$test_phones = [
    '0722241745',    // User's primary test recipient
    '254722241745',  // Valid Kenyan number
    '+254722241745', // With country code
];

echo "=== BULK SMS TESTING SCRIPT ===\n\n";

// TEST 1: Save credentials
echo "TEST 1: Saving SMS Credentials\n";
echo "================================\n";
$saved = saveSmsCredentials($test_credentials);
if ($saved) {
    echo "✓ Credentials saved successfully to database\n";
} else {
    echo "✗ Failed to save credentials\n";
}
echo "\n";

// TEST 2: Retrieve credentials
echo "TEST 2: Retrieving SMS Credentials\n";
echo "===================================\n";
$retrieved_creds = getSmsCredentials();
if ($retrieved_creds && $retrieved_creds['api_key'] === $test_credentials['api_key']) {
    echo "✓ Credentials retrieved successfully\n";
    echo "  - Source: " . $retrieved_creds['source'] . "\n";
    echo "  - Enabled: " . ($retrieved_creds['enabled'] ? 'Yes' : 'No') . "\n";
    echo "  - Sender ID: " . $retrieved_creds['sender_id'] . "\n";
} else {
    echo "✗ Failed to retrieve credentials\n";
}
echo "\n";

// TEST 3: Test SMS API connection
echo "TEST 3: Testing Onfonmedia API Connection\n";
echo "==========================================\n";
echo "Sending test SMS to: " . implode(', ', $test_phones) . "\n";

$test_message = "Test SMS from Trainer Coach Connect. This is a test of bulk SMS functionality. Reply STOP to unsubscribe.";
$result = sendSmsViaOnfonmedia($test_phones, $test_message, $retrieved_creds);

if ($result['success']) {
    echo "✓ SMS sent successfully!\n";
    echo "  - Provider Response: " . json_encode($result['provider_response'], JSON_PRETTY_PRINT) . "\n";
} else {
    echo "✗ Failed to send SMS\n";
    echo "  - Error: " . $result['error'] . "\n";
    if (isset($result['provider_response'])) {
        echo "  - Provider Response: " . json_encode($result['provider_response'], JSON_PRETTY_PRINT) . "\n";
    }
}
echo "\n";

// TEST 4: Verify SMS Logs
echo "TEST 4: Checking SMS Logs\n";
echo "=========================\n";
$logs = @$conn->query("
    SELECT id, phone_number, message, status, created_at 
    FROM sms_logs 
    ORDER BY created_at DESC 
    LIMIT 10
");

if ($logs && $logs->num_rows > 0) {
    echo "✓ SMS logs found (showing last 10):\n";
    while ($row = $logs->fetch_assoc()) {
        echo "  - Phone: {$row['phone_number']}, Status: {$row['status']}, Created: {$row['created_at']}\n";
    }
} else {
    echo "✗ No SMS logs found\n";
}
echo "\n";

// TEST 5: Test different sending methods
echo "TEST 5: Testing Different Sending Methods\n";
echo "==========================================\n";

// Method 1: Single phone number as string
echo "\n5a) Sending to single phone as string\n";
$result = sendSmsViaOnfonmedia('254722241745', 'Test single number', $retrieved_creds);
echo ($result['success'] ? "✓" : "✗") . " Single number send: " . ($result['success'] ? "Success" : $result['error']) . "\n";

// Method 2: Multiple phone numbers as array
echo "\n5b) Sending to multiple phones as array\n";
$result = sendSmsViaOnfonmedia(['254722241745', '254722241745', '254722241745'], 'Test multiple numbers', $retrieved_creds);
echo ($result['success'] ? "✓" : "✗") . " Multiple numbers send: " . ($result['success'] ? "Success - sent to 3 recipients" : $result['error']) . "\n";

// TEST 6: Test phone number normalization
echo "\n\nTEST 6: Phone Number Normalization\n";
echo "===================================\n";

$test_formats = [
    '254722241745' => 'Standard format',
    '+254722241745' => 'With + prefix',
    '0722241745' => 'With 0 prefix',
    '722241745' => 'Without country code',
];

foreach ($test_formats as $phone => $description) {
    echo "Testing: $phone ($description)\n";
    // Simulate normalization
    $normalized = str_replace(['+', ' ', '-'], '', $phone);
    if (substr($normalized, 0, 1) !== '2') {
        $normalized = '254' . substr($normalized, -9);
    }
    echo "  → Normalized: $normalized\n";
}
echo "\n";

// TEST 7: Database status
echo "TEST 7: Database Configuration\n";
echo "===============================\n";

// Check platform_settings table
$table_check = @$conn->query("SELECT COUNT(*) as count FROM platform_settings WHERE setting_key LIKE 'sms_%'");
if ($table_check) {
    $row = $table_check->fetch_assoc();
    echo "✓ SMS settings stored: " . $row['count'] . " settings\n";
} else {
    echo "✗ Cannot access platform_settings table\n";
}

// Check sms_logs table
$logs_check = @$conn->query("SELECT COUNT(*) as count FROM sms_logs");
if ($logs_check) {
    $row = $logs_check->fetch_assoc();
    echo "✓ SMS logs table exists: " . $row['count'] . " total logs\n";
} else {
    echo "✗ SMS logs table not found\n";
}

echo "\n=== TESTING COMPLETE ===\n";
?>
