<?php
/**
 * M-Pesa Settings Verification Script
 * Use this to check if M-Pesa credentials are saved in the database
 */

header("Content-Type: application/json; charset=utf-8");

$verification = [
    "timestamp" => date('Y-m-d H:i:s'),
    "database" => [
        "host" => "localhost",
        "username" => "skatrykc_trainer",
        "database" => "skatrykc_trainer"
    ],
    "table_exists" => false,
    "mpesa_data_exists" => false,
    "mpesa_credentials" => null,
    "parsed_credentials" => null,
    "errors" => []
];

try {
    // Connect to database
    $conn = @new mysqli('localhost', 'skatrykc_trainer', 'Sirgeorge.12', 'skatrykc_trainer');
    
    if ($conn->connect_error) {
        $verification["errors"][] = "Database connection failed: " . $conn->connect_error;
        http_response_code(500);
        echo json_encode($verification, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }
    
    $conn->set_charset("utf8mb4");
    
    // Check if platform_settings table exists
    $tableCheck = @$conn->query("SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
                                  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='platform_settings' LIMIT 1");
    
    if ($tableCheck && $tableCheck->num_rows > 0) {
        $verification["table_exists"] = true;
    } else {
        $verification["errors"][] = "platform_settings table does not exist";
        echo json_encode($verification, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $conn->close();
        exit;
    }
    
    // Check for M-Pesa credentials
    $query = "SELECT setting_key, value, updated_at FROM platform_settings 
              WHERE setting_key = 'mpesa_credentials' LIMIT 1";
    
    $result = @$conn->query($query);
    
    if ($result && $result->num_rows > 0) {
        $verification["mpesa_data_exists"] = true;
        $row = $result->fetch_assoc();
        
        $verification["mpesa_credentials"] = [
            "setting_key" => $row['setting_key'],
            "value_length" => strlen($row['value']) . " characters",
            "updated_at" => $row['updated_at'],
            "raw_value" => $row['value']
        ];
        
        // Try to parse the JSON
        $parsed = json_decode($row['value'], true);
        if ($parsed !== null) {
            $verification["parsed_credentials"] = [
                "consumerKey" => isset($parsed['consumerKey']) ? substr($parsed['consumerKey'], 0, 4) . "..." . substr($parsed['consumerKey'], -2) : "NOT SET",
                "consumerSecret" => isset($parsed['consumerSecret']) ? "••••••••" : "NOT SET",
                "shortcode" => $parsed['shortcode'] ?? "NOT SET",
                "passkey" => isset($parsed['passkey']) ? "••••••••" : "NOT SET",
                "initiatorName" => $parsed['initiatorName'] ?? "NOT SET",
                "environment" => $parsed['environment'] ?? "NOT SET",
                "resultUrl" => $parsed['resultUrl'] ?? "NOT SET",
                "c2bCallbackUrl" => $parsed['c2bCallbackUrl'] ?? "NOT SET",
                "b2cCallbackUrl" => $parsed['b2cCallbackUrl'] ?? "NOT SET",
                "securityCredential" => isset($parsed['securityCredential']) ? "••••••••" : "NOT SET"
            ];
            
            // Check if all required fields are present
            $required = ['consumerKey', 'consumerSecret', 'shortcode', 'passkey'];
            $missing = [];
            foreach ($required as $field) {
                if (empty($parsed[$field])) {
                    $missing[] = $field;
                }
            }
            
            if (empty($missing)) {
                $verification["status"] = "✅ VALID - All required M-Pesa credentials are present and saved";
            } else {
                $verification["status"] = "⚠️ INCOMPLETE - Missing fields: " . implode(", ", $missing);
                $verification["errors"][] = "Missing required fields: " . implode(", ", $missing);
            }
        } else {
            $verification["errors"][] = "JSON parsing failed for M-Pesa credentials";
            $verification["status"] = "❌ ERROR - Could not parse stored M-Pesa data";
        }
    } else {
        $verification["status"] = "❌ NOT FOUND - M-Pesa credentials not saved in database";
        $verification["errors"][] = "No M-Pesa credentials found in platform_settings table";
    }
    
    // List all settings in platform_settings table
    $allSettings = @$conn->query("SELECT setting_key, CHAR_LENGTH(value) as value_length, updated_at 
                                  FROM platform_settings 
                                  ORDER BY updated_at DESC");
    
    if ($allSettings && $allSettings->num_rows > 0) {
        $verification["all_platform_settings"] = [];
        while ($row = $allSettings->fetch_assoc()) {
            $verification["all_platform_settings"][] = [
                "setting_key" => $row['setting_key'],
                "value_length" => $row['value_length'] . " chars",
                "updated_at" => $row['updated_at']
            ];
        }
    } else {
        $verification["all_platform_settings"] = [];
    }
    
    $conn->close();
    
} catch (Exception $e) {
    $verification["errors"][] = "Exception: " . $e->getMessage();
    $verification["status"] = "❌ ERROR - " . $e->getMessage();
}

http_response_code(200);
echo json_encode($verification, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
?>
