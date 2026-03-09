<?php
/**
 * SMS Helper Functions for Onfonmedia Bulk SMS API
 * Provides functions for sending SMS, managing templates, and logging
 */

/**
 * Get or generate the encryption key for SMS credentials
 * Uses SMS_ENCRYPTION_KEY environment variable or generates a default one
 */
function getEncryptionKey() {
    $key = getenv('SMS_ENCRYPTION_KEY');

    // If no key in environment, use a derived key from a base secret or configuration
    if (!$key) {
        // Use the first 32 characters of a hash-based derivation
        // In production, SMS_ENCRYPTION_KEY should always be set
        $key = substr(hash('sha256', 'sms_creds_encryption_v1'), 0, 32);
    }

    // Ensure key is exactly 32 bytes for AES-256-CBC
    return substr($key, 0, 32);
}

/**
 * Encrypt sensitive SMS credential value
 */
function encryptSmsValue($value) {
    if (empty($value)) {
        return $value;
    }

    $key = getEncryptionKey();
    $iv = openssl_random_pseudo_bytes(16);
    $encrypted = openssl_encrypt($value, 'AES-256-CBC', $key, 0, $iv);

    if ($encrypted === false) {
        error_log("SMS encryption failed: " . openssl_error_string());
        return $value; // Return plaintext as fallback
    }

    // Return base64-encoded: iv:encrypted_data
    return base64_encode($iv . $encrypted);
}

/**
 * Decrypt SMS credential value
 */
function decryptSmsValue($encrypted_value) {
    if (empty($encrypted_value)) {
        return $encrypted_value;
    }

    try {
        $key = getEncryptionKey();
        $decoded = base64_decode($encrypted_value, true);

        if ($decoded === false || strlen($decoded) < 16) {
            // Not properly encrypted or already plaintext
            return $encrypted_value;
        }

        $iv = substr($decoded, 0, 16);
        $encrypted = substr($decoded, 16);

        $decrypted = openssl_decrypt($encrypted, 'AES-256-CBC', $key, 0, $iv);

        if ($decrypted === false) {
            error_log("SMS decryption failed: " . openssl_error_string());
            return $encrypted_value; // Return as-is if decryption fails
        }

        return $decrypted;
    } catch (Exception $e) {
        error_log("SMS decryption exception: " . $e->getMessage());
        return $encrypted_value; // Return as-is if exception occurs
    }
}

/**
 * Get SMS credentials from platform settings
 */
function getSmsCredentials() {
    global $conn;
    
    // Try to get from database first
    $result = @$conn->query("
        SELECT setting_key, value FROM platform_settings 
        WHERE setting_key IN ('sms_api_key', 'sms_client_id', 'sms_access_key', 'sms_sender_id', 'sms_enabled')
    ");
    
    if ($result && $result->num_rows > 0) {
        $creds = [];
        while ($row = $result->fetch_assoc()) {
            $creds[$row['setting_key']] = $row['value'];
        }

        if (!empty($creds['sms_api_key']) && !empty($creds['sms_client_id']) && !empty($creds['sms_access_key'])) {
            return [
                'api_key' => decryptSmsValue($creds['sms_api_key']),
                'client_id' => decryptSmsValue($creds['sms_client_id']),
                'access_key' => decryptSmsValue($creds['sms_access_key']),
                'sender_id' => $creds['sms_sender_id'] ?? 'TRAINER LTD',
                'admin_phone' => $creds['sms_admin_phone'] ?? '',
                'enabled' => $creds['sms_enabled'] === 'true' || $creds['sms_enabled'] === true,
                'source' => 'database'
            ];
        }
    }
    
    // Try environment variables as fallback
    $env_creds = [
        'api_key' => $_ENV['SMS_API_KEY'] ?? getenv('SMS_API_KEY'),
        'client_id' => $_ENV['SMS_CLIENT_ID'] ?? getenv('SMS_CLIENT_ID'),
        'access_key' => $_ENV['SMS_ACCESS_KEY'] ?? getenv('SMS_ACCESS_KEY'),
        'sender_id' => $_ENV['SMS_SENDER_ID'] ?? getenv('SMS_SENDER_ID') ?? 'TRAINER LTD',
    ];
    
    if (!empty($env_creds['api_key']) && !empty($env_creds['client_id']) && !empty($env_creds['access_key'])) {
        $env_creds['enabled'] = true;
        $env_creds['source'] = 'environment';
        return $env_creds;
    }
    
    return null;
}

/**
 * Save SMS credentials to platform settings
 */
function saveSmsCredentials($credentials) {
    global $conn;
    
    if (!isset($credentials['api_key']) || !isset($credentials['client_id']) || !isset($credentials['access_key'])) {
        return false;
    }
    
    // Ensure platform_settings table exists
    @$conn->query("CREATE TABLE IF NOT EXISTS `platform_settings` (
        `setting_key` VARCHAR(255) PRIMARY KEY,
        `value` LONGTEXT,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
    
    $fields = [
        'sms_api_key' => encryptSmsValue($credentials['api_key']),
        'sms_client_id' => encryptSmsValue($credentials['client_id']),
        'sms_access_key' => encryptSmsValue($credentials['access_key']),
        'sms_sender_id' => $credentials['sender_id'] ?? 'TRAINER LTD',
        'sms_admin_phone' => $credentials['admin_phone'] ?? '',
        'sms_enabled' => isset($credentials['enabled']) ? ($credentials['enabled'] ? 'true' : 'false') : 'true'
    ];
    
    foreach ($fields as $key => $value) {
        $stmt = $conn->prepare("
            INSERT INTO platform_settings (setting_key, value, updated_at) 
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE value=?, updated_at=NOW()
        ");
        
        if (!$stmt) {
            error_log("Failed to prepare statement for $key: " . $conn->error);
            return false;
        }
        
        $stmt->bind_param('sss', $key, $value, $value);
        if (!$stmt->execute()) {
            error_log("Failed to save SMS credential $key: " . $stmt->error);
            $stmt->close();
            return false;
        }
        $stmt->close();
    }
    
    return true;
}

/**
 * Send SMS via Onfonmedia API
 */
function sendSmsViaOnfonmedia($phone_numbers, $message, $credentials = null) {
    if ($credentials === null) {
        $credentials = getSmsCredentials();
    }
    
    if (!$credentials || !$credentials['enabled']) {
        error_log("SMS sending disabled or credentials not configured");
        return [
            'success' => false,
            'error' => 'SMS service not configured'
        ];
    }
    
    // Normalize phone numbers to array
    if (!is_array($phone_numbers)) {
        $phone_numbers = [$phone_numbers];
    }
    
    // Build message parameters
    $messageParameters = [];
    foreach ($phone_numbers as $phone) {
        // Normalize phone number
        $phone = str_replace(['+', ' ', '-'], '', $phone);
        if (substr($phone, 0, 1) !== '2') {
            $phone = '254' . substr($phone, -9);
        }
        
        $messageParameters[] = [
            "Number" => $phone,
            "Text" => $message
        ];
    }
    
    // Build request payload
    $payload = [
        "SenderId" => $credentials['sender_id'],
        "MessageParameters" => $messageParameters,
        "ApiKey" => $credentials['api_key'],
        "ClientId" => $credentials['client_id']
    ];
    
    // Make API request
    $ch = curl_init('https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'AccessKey: ' . $credentials['access_key'],
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        error_log("SMS API CURL Error: " . $curlError);
        return [
            'success' => false,
            'error' => 'Network error: ' . $curlError
        ];
    }
    
    // Parse response
    $responseData = json_decode($response, true);
    
    if ($httpCode >= 200 && $httpCode < 300 && $responseData) {
        return [
            'success' => true,
            'provider_response' => $responseData,
            'http_code' => $httpCode
        ];
    } else {
        error_log("SMS API Error (HTTP $httpCode): " . $response);
        return [
            'success' => false,
            'error' => 'SMS API error: ' . ($responseData['message'] ?? 'Unknown error'),
            'http_code' => $httpCode,
            'provider_response' => $responseData
        ];
    }
}

/**
 * Replace template placeholders with actual values
 */
function replaceTemplatePlaceholders($template, $data) {
    $replacements = [];
    
    // Standard placeholders
    if (isset($data['user_name'])) {
        $replacements['{{user_name}}'] = $data['user_name'];
    }
    if (isset($data['first_name'])) {
        $replacements['{{first_name}}'] = $data['first_name'];
    }
    if (isset($data['amount'])) {
        $replacements['{{amount}}'] = $data['amount'];
    }
    if (isset($data['reference'])) {
        $replacements['{{reference}}'] = $data['reference'];
    }
    if (isset($data['booking_id'])) {
        $replacements['{{booking_id}}'] = $data['booking_id'];
    }
    if (isset($data['trainer_name'])) {
        $replacements['{{trainer_name}}'] = $data['trainer_name'];
    }
    if (isset($data['date'])) {
        $replacements['{{date}}'] = $data['date'];
    }
    if (isset($data['time'])) {
        $replacements['{{time}}'] = $data['time'];
    }
    if (isset($data['payout_amount'])) {
        $replacements['{{payout_amount}}'] = $data['payout_amount'];
    }
    
    // Dynamic placeholders - any key from data can be used as {{key}}
    foreach ($data as $key => $value) {
        if (!in_array($key, ['user_name', 'first_name', 'amount', 'reference', 'booking_id', 'trainer_name', 'date', 'time', 'payout_amount'])) {
            $replacements['{{' . $key . '}}'] = $value;
        }
    }
    
    return strtr($template, $replacements);
}

/**
 * Log SMS sending
 */
function logSmsEvent($user_id, $phone_number, $message, $template_id, $event_type, $event_id, $status, $provider_response = null) {
    global $conn;
    
    // Ensure sms_logs table exists
    $tableCheck = @$conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME='sms_logs' AND TABLE_SCHEMA=DATABASE() LIMIT 1");
    if (!$tableCheck || $tableCheck->num_rows == 0) {
        @$conn->query("
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
              INDEX `idx_created_at` (`created_at` DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }
    
    $id = bin2hex(random_bytes(18));
    $providerJson = $provider_response ? json_encode($provider_response) : null;
    $sentAt = ($status === 'sent') ? date('Y-m-d H:i:s') : null;
    
    $stmt = $conn->prepare("
        INSERT INTO sms_logs (id, user_id, phone_number, message, template_id, event_type, event_id, status, provider_response, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    if ($stmt) {
        $stmt->bind_param('ssssssssss', $id, $user_id, $phone_number, $message, $template_id, $event_type, $event_id, $status, $providerJson, $sentAt);
        $stmt->execute();
        $stmt->close();
        return $id;
    }
    
    return null;
}

/**
 * Get SMS template by name or event type
 */
function getSmsTemplate($name_or_event_type, $byEvent = false) {
    global $conn;
    
    $tableCheck = @$conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME='sms_templates' AND TABLE_SCHEMA=DATABASE() LIMIT 1");
    if (!$tableCheck || $tableCheck->num_rows == 0) {
        return null;
    }
    
    if ($byEvent) {
        $stmt = $conn->prepare("SELECT id, name, template_text FROM sms_templates WHERE event_type = ? AND active = TRUE LIMIT 1");
    } else {
        $stmt = $conn->prepare("SELECT id, name, template_text FROM sms_templates WHERE name = ? AND active = TRUE LIMIT 1");
    }
    
    if ($stmt) {
        $stmt->bind_param('s', $name_or_event_type);
        $stmt->execute();
        $result = $stmt->get_result();
        $template = $result->fetch_assoc();
        $stmt->close();
        return $template;
    }
    
    return null;
}

/**
 * Send Admin Notification SMS
 */
function sendAdminNotification($message, $credentials = null) {
    if ($credentials === null) {
        $credentials = getSmsCredentials();
    }

    if (!$credentials || empty($credentials['admin_phone']) || !$credentials['enabled']) {
        return false;
    }

    return sendSmsViaOnfonmedia($credentials['admin_phone'], "[ADMIN] " . $message, $credentials);
}

/**
 * Auto-send registration SMS
 */
function sendRegistrationSms($phone_number, $user_data) {
    global $conn;
    
    $credentials = getSmsCredentials();
    if (!$credentials || !$credentials['enabled']) {
        return false;
    }
    
    // Get registration template
    $template = getSmsTemplate('registration_welcome');
    if (!$template) {
        // Use default template if none exists
        $message = "Welcome to Trainer Coach Connect, " . ($user_data['first_name'] ?? 'User') . "! Your account has been created successfully.";
    } else {
        $message = replaceTemplatePlaceholders($template['template_text'], $user_data);
    }
    
    // Send SMS
    $result = sendSmsViaOnfonmedia($phone_number, $message, $credentials);

    // Notify admin
    if ($result['success']) {
        sendAdminNotification("New registration: " . ($user_data['first_name'] ?? 'User') . " (" . $phone_number . ")", $credentials);
    }

    // Log the attempt
    $status = $result['success'] ? 'sent' : 'failed';
    $template_id = $template ? $template['id'] : null;
    $user_id = $user_data['id'] ?? null;
    
    logSmsEvent($user_id, $phone_number, $message, $template_id, 'registration', $user_id, $status, $result['provider_response'] ?? null);
    
    return $result['success'];
}

/**
 * Auto-send payment confirmation SMS
 */
function sendPaymentSms($user_id, $phone_number, $payment_data) {
    global $conn;
    
    $credentials = getSmsCredentials();
    if (!$credentials || !$credentials['enabled']) {
        return false;
    }
    
    // Get payment template
    $template = getSmsTemplate('payment_confirmation');
    if (!$template) {
        // Use default template
        $amount = $payment_data['amount'] ?? 0;
        $reference = $payment_data['transaction_reference'] ?? 'N/A';
        $message = "Payment confirmation: KES " . $amount . " received. Reference: " . $reference . ". Thank you!";
    } else {
        $message = replaceTemplatePlaceholders($template['template_text'], $payment_data);
    }
    
    // Send SMS
    $result = sendSmsViaOnfonmedia($phone_number, $message, $credentials);

    // Notify admin
    if ($result['success']) {
        sendAdminNotification("New registration: " . ($user_data['first_name'] ?? 'User') . " (" . $phone_number . ")", $credentials);
    }

    // Log the attempt
    $status = $result['success'] ? 'sent' : 'failed';
    $template_id = $template ? $template['id'] : null;
    $payment_id = $payment_data['id'] ?? $payment_data['transaction_reference'] ?? null;
    
    logSmsEvent($user_id, $phone_number, $message, $template_id, 'payment', $payment_id, $status, $result['provider_response'] ?? null);
    
    return $result['success'];
}

/**
 * Auto-send booking confirmation SMS
 */
function sendBookingSms($user_id, $phone_number, $booking_data) {
    global $conn;
    
    $credentials = getSmsCredentials();
    if (!$credentials || !$credentials['enabled']) {
        return false;
    }
    
    // Get booking template
    $template = getSmsTemplate('booking_confirmation');
    if (!$template) {
        // Use default template
        $booking_id = $booking_data['id'] ?? 'N/A';
        $trainer_name = $booking_data['trainer_name'] ?? 'Your Trainer';
        $date = $booking_data['date'] ?? 'Soon';
        $message = "Booking confirmed! ID: " . $booking_id . " with " . $trainer_name . " on " . $date . ".";
    } else {
        $message = replaceTemplatePlaceholders($template['template_text'], $booking_data);
    }
    
    // Send SMS
    $result = sendSmsViaOnfonmedia($phone_number, $message, $credentials);

    // Notify admin
    if ($result['success']) {
        sendAdminNotification("New booking: " . ($booking_data['trainer_name'] ?? 'Trainer') . " with client (" . $phone_number . ")", $credentials);
    }

    // Log the attempt
    $status = $result['success'] ? 'sent' : 'failed';
    $template_id = $template ? $template['id'] : null;
    $booking_id = $booking_data['id'] ?? null;

    logSmsEvent($user_id, $phone_number, $message, $template_id, 'booking', $booking_id, $status, $result['provider_response'] ?? null);

    return $result['success'];
}

/**
 * Auto-send payout completion SMS
 */
function sendPayoutSms($user_id, $phone_number, $payout_data) {
    global $conn;

    $credentials = getSmsCredentials();
    if (!$credentials || !$credentials['enabled']) {
        return false;
    }

    // Get payout template
    $template = getSmsTemplate('payout_confirmation');
    if (!$template) {
        // Use default template
        $amount = $payout_data['amount'] ?? 0;
        $message = "Payout successful! KES " . $amount . " has been sent to your registered M-Pesa account.";
    } else {
        $message = replaceTemplatePlaceholders($template['template_text'], $payout_data);
    }

    // Send SMS
    $result = sendSmsViaOnfonmedia($phone_number, $message, $credentials);

    // Notify admin
    if ($result['success']) {
        sendAdminNotification("Payout processed: KES " . ($payout_data['amount'] ?? '0') . " to trainer (" . $phone_number . ")", $credentials);
    }

    // Log the attempt
    $status = $result['success'] ? 'sent' : 'failed';
    $template_id = $template ? $template['id'] : null;
    $payout_id = $payout_data['id'] ?? null;
    
    logSmsEvent($user_id, $phone_number, $message, $template_id, 'payout', $payout_id, $status, $result['provider_response'] ?? null);
    
    return $result['success'];
}
?>
