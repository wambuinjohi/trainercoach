<?php
/**
 * M-Pesa Helper Functions - ENHANCED WITH DETAILED LOGGING
 * 
 * Handles server-side credential management and M-Pesa API integration
 * Credentials are retrieved from admin settings (database), not from client requests
 * Environment variables used only as fallback
 * 
 * ENHANCED: Detailed logging of all M-Pesa API calls and responses
 */

// Get M-Pesa credentials from dedicated table, with fallback to platform_settings and environment
function getMpesaCredentials() {
    global $conn;

    // Try to get from dedicated mpesa_credentials table first
    $sql = "SELECT * FROM mpesa_credentials ORDER BY updated_at DESC LIMIT 1";
    $result = @$conn->query($sql);

    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        if (!empty($row['consumerKey']) && !empty($row['consumerSecret'])) {
            $creds = [
                'consumer_key' => trim($row['consumerKey']),
                'consumer_secret' => trim($row['consumerSecret']),
                'shortcode' => trim($row['shortcode'] ?? ''),
                'passkey' => trim($row['passkey'] ?? ''),
                'environment' => trim($row['environment'] ?? 'sandbox'),
                'result_url' => trim($row['resultUrl'] ?? ''),
                'initiator_name' => trim($row['initiatorName'] ?? ''),
                'security_credential' => trim($row['securityCredential'] ?? ''),
                'c2b_callback_url' => trim($row['c2bCallbackUrl'] ?? ''),
                'b2c_callback_url' => trim($row['b2cCallbackUrl'] ?? ''),
                'source' => 'mpesa_credentials_table'
            ];
            error_log("[MPESA CREDS] Loaded from mpesa_credentials table. Environment: " . $creds['environment'] . ", Source: mpesa_credentials_table");
            return $creds;
        }
    }

    // Fallback to platform_settings table (for backward compatibility with old migrations)
    error_log("[MPESA CREDS] mpesa_credentials table query failed or empty, checking platform_settings...");
    $legacy_sql = "SELECT value FROM platform_settings WHERE setting_key = 'mpesa_credentials' LIMIT 1";
    $legacy_result = @$conn->query($legacy_sql);

    if ($legacy_result && $legacy_result->num_rows > 0) {
        $row = $legacy_result->fetch_assoc();
        $settings = json_decode($row['value'], true);
        if ($settings && !empty($settings['consumerKey']) && !empty($settings['consumerSecret'])) {
            $creds = [
                'consumer_key' => trim($settings['consumerKey']),
                'consumer_secret' => trim($settings['consumerSecret']),
                'shortcode' => trim($settings['shortcode'] ?? ''),
                'passkey' => trim($settings['passkey'] ?? ''),
                'environment' => trim($settings['environment'] ?? 'sandbox'),
                'result_url' => trim($settings['resultUrl'] ?? ''),
                'initiator_name' => trim($settings['initiatorName'] ?? ''),
                'security_credential' => trim($settings['securityCredential'] ?? ''),
                'c2b_callback_url' => trim($settings['c2bCallbackUrl'] ?? ''),
                'b2c_callback_url' => trim($settings['b2cCallbackUrl'] ?? ''),
                'source' => 'platform_settings_legacy'
            ];
            error_log("[MPESA CREDS] Loaded from platform_settings (legacy). Environment: " . $creds['environment'] . ", Source: platform_settings_legacy");
            return $creds;
        }
    }

    // Fallback to environment variables
    error_log("[MPESA CREDS] No credentials in database, checking environment variables...");
    $envCreds = [
        'consumer_key' => trim(getenv('MPESA_CONSUMER_KEY') ?: ''),
        'consumer_secret' => trim(getenv('MPESA_CONSUMER_SECRET') ?: ''),
        'shortcode' => trim(getenv('MPESA_SHORTCODE') ?: ''),
        'passkey' => trim(getenv('MPESA_PASSKEY') ?: ''),
        'environment' => trim(getenv('MPESA_ENVIRONMENT') ?: 'sandbox'),
        'result_url' => trim(getenv('MPESA_RESULT_URL') ?: ''),
        'initiator_name' => trim(getenv('MPESA_INITIATOR_NAME') ?: ''),
        'security_credential' => trim(getenv('MPESA_SECURITY_CREDENTIAL') ?: ''),
        'c2b_callback_url' => trim(getenv('MPESA_C2B_CALLBACK_URL') ?: ''),
        'b2c_callback_url' => trim(getenv('MPESA_B2C_CALLBACK_URL') ?: ''),
        'source' => 'environment'
    ];

    // Only return env credentials if all required fields are present
    if (!empty($envCreds['consumer_key']) && !empty($envCreds['consumer_secret'])) {
        error_log("[MPESA CREDS] Loaded from environment variables. Environment: " . $envCreds['environment']);
        return $envCreds;
    }

    error_log("[MPESA CREDS ERROR] No valid credentials found in mpesa_credentials table, platform_settings, or environment");
    return null;
}

// Validate that M-Pesa credentials are configured
function validateMpesaCredentialsConfigured() {
    $creds = getMpesaCredentials();
    if (!$creds || empty($creds['consumer_key']) || empty($creds['consumer_secret'])) {
        error_log("[MPESA VALIDATION] FAILED - Credentials not found or incomplete");
        return [
            'valid' => false,
            'error' => 'M-Pesa credentials not configured. Please configure in admin settings.',
            'source' => null
        ];
    }
    error_log("[MPESA VALIDATION] SUCCESS - Source: " . $creds['source'] . ", Environment: " . $creds['environment']);
    return [
        'valid' => true,
        'source' => $creds['source'],
        'environment' => $creds['environment'] ?? 'sandbox'
    ];
}

// Get M-Pesa access token
function getMpesaAccessToken($credentials) {
    $consumer_key = $credentials['consumer_key'];
    $consumer_secret = $credentials['consumer_secret'];
    $environment = $credentials['environment'] ?? 'sandbox';

    $token_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    error_log("[MPESA TOKEN REQUEST] Starting token request");
    error_log("[MPESA TOKEN REQUEST] Environment: $environment");
    error_log("[MPESA TOKEN REQUEST] URL: $token_url");
    error_log("[MPESA TOKEN REQUEST] Consumer Key: " . substr($consumer_key, 0, 10) . "..." . substr($consumer_key, -5));

    $auth_string = base64_encode($consumer_key . ':' . $consumer_secret);
    error_log("[MPESA TOKEN REQUEST] Auth String (base64): " . substr($auth_string, 0, 20) . "...");

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $token_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Basic ' . $auth_string]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    $curl_errno = curl_errno($ch);

    // Capture detailed curl info
    $curl_info = curl_getinfo($ch);
    curl_close($ch);

    error_log("[MPESA TOKEN RESPONSE] ========== SAFARICOM TOKEN RESPONSE ==========");
    error_log("[MPESA TOKEN RESPONSE] HTTP Code: $http_code");
    error_log("[MPESA TOKEN RESPONSE] Content Type: " . ($curl_info['content_type'] ?? 'N/A'));
    error_log("[MPESA TOKEN RESPONSE] Response Time: " . round($curl_info['total_time'], 3) . "s");
    error_log("[MPESA TOKEN RESPONSE] Full Response: " . $response);
    error_log("[MPESA TOKEN RESPONSE] Response Size: " . strlen($response) . " bytes");

    if ($curl_error) {
        error_log("[MPESA TOKEN ERROR] CURL Error [$curl_errno]: $curl_error");
    }

    if ($http_code !== 200) {
        error_log("[MPESA TOKEN ERROR] Token request failed with HTTP $http_code");
        error_log("[MPESA TOKEN ERROR] Response Details: " . json_encode(json_decode($response, true), JSON_PRETTY_PRINT));
        return null;
    }

    $token_response = json_decode($response, true);

    if (!$token_response) {
        error_log("[MPESA TOKEN ERROR] Failed to decode JSON response");
        error_log("[MPESA TOKEN ERROR] Raw response: " . substr($response, 0, 500));
        return null;
    }

    error_log("[MPESA TOKEN RESPONSE FIELDS] Keys: " . implode(", ", array_keys($token_response)));

    $access_token = $token_response['access_token'] ?? null;
    $expires_in = $token_response['expires_in'] ?? null;

    if ($access_token) {
        error_log("[MPESA TOKEN SUCCESS] Token obtained successfully");
        error_log("[MPESA TOKEN SUCCESS] Token: " . substr($access_token, 0, 30) . "..." . substr($access_token, -10));
        error_log("[MPESA TOKEN SUCCESS] Expires in: $expires_in seconds");
        error_log("[MPESA TOKEN SUCCESS] Token will be used for: " . ($environment === 'production' ? 'PRODUCTION' : 'SANDBOX'));
    } else {
        error_log("[MPESA TOKEN ERROR] No access_token in response. Full response: " . json_encode($token_response, JSON_PRETTY_PRINT));
    }

    return $access_token;
}

// Initiate STK Push payment
function initiateSTKPush($credentials, $phone, $amount, $account_reference, $callback_url = null) {
    error_log("[STK PUSH INIT] ========== STARTING STK PUSH INITIATION ==========");
    error_log("[STK PUSH INIT] Raw Phone Input: $phone");

    // Validate phone format (should be 254XXXXXXXXX)
    $phonePattern = '/^254[0-9]{9}$/';
    if (!preg_match($phonePattern, $phone)) {
        error_log("[STK PUSH ERROR] Phone number format invalid: $phone. Expected format: 254XXXXXXXXX (11 digits starting with 254)");
    } else {
        error_log("[STK PUSH INIT] Phone format valid: $phone");
    }

    error_log("[STK PUSH INIT] Amount: $amount");
    error_log("[STK PUSH INIT] Account Reference: $account_reference");

    // Validate credentials
    if (!$credentials) {
        error_log("[STK PUSH ERROR] No credentials provided");
        return [
            'success' => false,
            'error' => 'M-Pesa credentials not available'
        ];
    }

    if (empty($credentials['shortcode']) || empty($credentials['passkey'])) {
        error_log("[STK PUSH ERROR] Missing required fields - Shortcode: " . ($credentials['shortcode'] ?? 'MISSING') . ", Passkey: " . ($credentials['passkey'] ?? 'MISSING'));
        return [
            'success' => false,
            'error' => 'M-Pesa shortcode or passkey not configured'
        ];
    }

    $access_token = getMpesaAccessToken($credentials);

    if (!$access_token) {
        error_log("[STK PUSH ERROR] Failed to obtain access token");
        return [
            'success' => false,
            'error' => 'Failed to obtain M-Pesa access token'
        ];
    }

    $environment = $credentials['environment'] ?? 'sandbox';
    $shortcode = $credentials['shortcode'];
    $passkey = $credentials['passkey'];

    error_log("[STK PUSH INIT] Access token obtained successfully");
    error_log("[STK PUSH INIT] Shortcode: $shortcode");
    error_log("[STK PUSH INIT] Environment: $environment");

    // Use default C2B callback URL if not provided (for STK Push payments)
    if (empty($callback_url)) {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
        $host = $_SERVER['HTTP_HOST'] ?? 'trainercoachconnect.com';
        $callback_url = $protocol . $host . '/c2b_callback.php';
    }

    error_log("[STK PUSH INIT] Callback URL: $callback_url");

    $stk_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    error_log("[STK PUSH REQUEST] STK Push URL: $stk_url");

    $timestamp = date('YmdHis');
    $password = base64_encode($shortcode . $passkey . $timestamp);

    error_log("[STK PUSH REQUEST] Timestamp: $timestamp");
    error_log("[STK PUSH REQUEST] Password (base64): " . substr($password, 0, 20) . "...");

    $payload = [
        'BusinessShortCode' => $shortcode,
        'Password' => $password,
        'Timestamp' => $timestamp,
        'TransactionType' => 'CustomerPayBillOnline',
        'Amount' => intval($amount),
        'PartyA' => $phone,
        'PartyB' => $shortcode,
        'PhoneNumber' => $phone,
        'CallBackURL' => $callback_url,
        'AccountReference' => $account_reference,
        'TransactionDesc' => 'Payment for service'
    ];

    error_log("[STK PUSH PAYLOAD] " . json_encode($payload, JSON_PRETTY_PRINT));

    // Detailed payload validation logging
    error_log("[STK PUSH PAYLOAD VALIDATION] ========== PAYLOAD FIELD ANALYSIS ==========");
    error_log("[STK PUSH PAYLOAD VALIDATION] BusinessShortCode: " . $payload['BusinessShortCode'] . " (length: " . strlen($payload['BusinessShortCode']) . ")");
    error_log("[STK PUSH PAYLOAD VALIDATION] Timestamp: " . $payload['Timestamp'] . " (format: YmdHis)");
    error_log("[STK PUSH PAYLOAD VALIDATION] Amount: " . $payload['Amount'] . " (type: " . gettype($payload['Amount']) . ")");
    error_log("[STK PUSH PAYLOAD VALIDATION] PartyA (Phone): " . $payload['PartyA'] . " (length: " . strlen($payload['PartyA']) . ")");
    error_log("[STK PUSH PAYLOAD VALIDATION] PartyB (Shortcode): " . $payload['PartyB'] . " (should match BusinessShortCode: " . ($payload['PartyB'] === $payload['BusinessShortCode'] ? 'YES' : 'NO - MISMATCH!') . ")");
    error_log("[STK PUSH PAYLOAD VALIDATION] TransactionType: " . $payload['TransactionType']);
    error_log("[STK PUSH PAYLOAD VALIDATION] AccountReference: " . $payload['AccountReference'] . " (length: " . strlen($payload['AccountReference']) . ")");
    error_log("[STK PUSH PAYLOAD VALIDATION] PhoneNumber (should match PartyA): " . ($payload['PhoneNumber'] === $payload['PartyA'] ? 'YES' : 'NO - MISMATCH!'));
    error_log("[STK PUSH PAYLOAD VALIDATION] CallBackURL Valid: " . (filter_var($payload['CallBackURL'], FILTER_VALIDATE_URL) ? 'YES' : 'NO - INVALID!'));

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $stk_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $access_token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    $curl_errno = curl_errno($ch);

    // Capture detailed curl info for debugging
    $curl_info = curl_getinfo($ch);
    curl_close($ch);

    error_log("[STK PUSH RESPONSE] ========== SAFARICOM RESPONSE DETAILS ==========");
    error_log("[STK PUSH RESPONSE] HTTP Code: $http_code");
    error_log("[STK PUSH RESPONSE] Content Type: " . ($curl_info['content_type'] ?? 'N/A'));
    error_log("[STK PUSH RESPONSE] Response Time: " . round($curl_info['total_time'], 3) . "s");
    error_log("[STK PUSH RESPONSE] Connection Time: " . round($curl_info['connect_time'], 3) . "s");
    error_log("[STK PUSH RESPONSE] Full Response Body: " . $response);
    error_log("[STK PUSH RESPONSE] Response Size: " . strlen($response) . " bytes");

    if ($curl_error) {
        error_log("[STK PUSH CURL ERROR] [$curl_errno]: $curl_error");
    }

    $response_data = json_decode($response, true);

    if (!$response_data) {
        error_log("[STK PUSH ERROR] Failed to decode JSON response");
        error_log("[STK PUSH ERROR] Raw response was: " . substr($response, 0, 500));
        return [
            'success' => false,
            'error' => 'Invalid response from M-Pesa API'
        ];
    }

    error_log("[STK PUSH RESPONSE DATA] " . json_encode($response_data, JSON_PRETTY_PRINT));
    error_log("[STK PUSH RESPONSE FIELDS] " . "Keys: " . implode(", ", array_keys($response_data)));

    // Log all response fields for debugging
    foreach ($response_data as $key => $value) {
        if (is_string($value) && strlen($value) < 100) {
            error_log("[STK PUSH RESPONSE FIELD] $key: $value");
        } elseif (!is_array($value)) {
            error_log("[STK PUSH RESPONSE FIELD] $key: $value");
        }
    }

    if ($http_code !== 200) {
        error_log("[STK PUSH FAIL] HTTP $http_code - M-Pesa API rejected request");
        error_log("[STK PUSH FAIL] Error Details: " . json_encode($response_data, JSON_PRETTY_PRINT));
        error_log("[STK PUSH FAIL] Response Code: " . ($response_data['ResponseCode'] ?? 'N/A'));
        error_log("[STK PUSH FAIL] Response Description: " . ($response_data['ResponseDescription'] ?? 'N/A'));
        return [
            'success' => false,
            'error' => $response_data['errorMessage'] ?? $response_data['message'] ?? 'Failed to initiate STK Push'
        ];
    }

    if (empty($response_data['CheckoutRequestID'])) {
        error_log("[STK PUSH FAIL] HTTP 200 but no CheckoutRequestID in response");
        error_log("[STK PUSH FAIL] Response: " . json_encode($response_data, JSON_PRETTY_PRINT));
        return [
            'success' => false,
            'error' => 'M-Pesa did not return CheckoutRequestID'
        ];
    }

    error_log("[STK PUSH SUCCESS] ========== STK PUSH INITIATED SUCCESSFULLY ==========");
    error_log("[STK PUSH SUCCESS] CheckoutRequestID: " . $response_data['CheckoutRequestID']);
    error_log("[STK PUSH SUCCESS] MerchantRequestID: " . ($response_data['MerchantRequestID'] ?? 'N/A'));
    error_log("[STK PUSH SUCCESS] ResponseCode: " . ($response_data['ResponseCode'] ?? 'N/A'));
    error_log("[STK PUSH SUCCESS] ResponseDescription: " . ($response_data['ResponseDescription'] ?? 'N/A'));
    error_log("[STK PUSH SUCCESS] CustomerMessage: " . ($response_data['CustomerMessage'] ?? 'N/A'));

    return [
        'success' => true,
        'checkout_request_id' => $response_data['CheckoutRequestID'],
        'merchant_request_id' => $response_data['MerchantRequestID'] ?? null,
        'response_code' => $response_data['ResponseCode'] ?? null,
        'response_description' => $response_data['ResponseDescription'] ?? null
    ];
}

// Query STK Push status
function querySTKPushStatus($credentials, $checkout_request_id) {
    error_log("[STK QUERY] ========== STARTING STK QUERY ==========");
    error_log("[STK QUERY] CheckoutRequestID: $checkout_request_id");

    if (!$credentials) {
        error_log("[STK QUERY ERROR] No credentials provided");
        return [
            'success' => false,
            'error' => 'M-Pesa credentials not available'
        ];
    }

    $access_token = getMpesaAccessToken($credentials);

    if (!$access_token) {
        error_log("[STK QUERY ERROR] Failed to obtain access token");
        return [
            'success' => false,
            'error' => 'Failed to obtain M-Pesa access token'
        ];
    }
    
    $environment = $credentials['environment'] ?? 'sandbox';
    $shortcode = $credentials['shortcode'];
    $passkey = $credentials['passkey'];

    $query_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';

    error_log("[STK QUERY REQUEST] URL: $query_url");
    error_log("[STK QUERY REQUEST] Environment: $environment");

    $timestamp = date('YmdHis');
    $password = base64_encode($shortcode . $passkey . $timestamp);

    $payload = [
        'BusinessShortCode' => $shortcode,
        'Password' => $password,
        'Timestamp' => $timestamp,
        'CheckoutRequestID' => $checkout_request_id
    ];

    error_log("[STK QUERY PAYLOAD] " . json_encode($payload, JSON_PRETTY_PRINT));

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $query_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $access_token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    $curl_errno = curl_errno($ch);

    // Capture detailed curl info for debugging
    $curl_info = curl_getinfo($ch);
    curl_close($ch);

    error_log("[STK QUERY RESPONSE] ========== SAFARICOM QUERY RESPONSE DETAILS ==========");
    error_log("[STK QUERY RESPONSE] HTTP Code: $http_code");
    error_log("[STK QUERY RESPONSE] Content Type: " . ($curl_info['content_type'] ?? 'N/A'));
    error_log("[STK QUERY RESPONSE] Response Time: " . round($curl_info['total_time'], 3) . "s");
    error_log("[STK QUERY RESPONSE] Full Response: " . $response);
    error_log("[STK QUERY RESPONSE] Response Size: " . strlen($response) . " bytes");

    if ($curl_error) {
        error_log("[STK QUERY CURL ERROR] [$curl_errno]: $curl_error");
    }

    $response_data = json_decode($response, true);

    if (!$response_data) {
        error_log("[STK QUERY ERROR] Failed to decode JSON response");
        error_log("[STK QUERY ERROR] Raw response: " . substr($response, 0, 500));
        return [
            'success' => false,
            'error' => 'Invalid response from M-Pesa API'
        ];
    }

    error_log("[STK QUERY RESPONSE DATA] " . json_encode($response_data, JSON_PRETTY_PRINT));
    error_log("[STK QUERY RESPONSE FIELDS] Keys: " . implode(", ", array_keys($response_data)));

    // Log all response fields for debugging
    foreach ($response_data as $key => $value) {
        if (is_string($value) && strlen($value) < 200) {
            error_log("[STK QUERY RESPONSE FIELD] $key: $value");
        } elseif (!is_array($value)) {
            error_log("[STK QUERY RESPONSE FIELD] $key: $value");
        }
    }

    if ($http_code !== 200) {
        error_log("[STK QUERY FAIL] HTTP $http_code - " . json_encode($response_data, JSON_PRETTY_PRINT));
        return [
            'success' => false,
            'error' => 'Failed to query STK Push status'
        ];
    }

    error_log("[STK QUERY RESPONSE ANALYSIS] ========== ANALYZING RESULT ==========");
    error_log("[STK QUERY RESPONSE ANALYSIS] ResponseCode: " . ($response_data['ResponseCode'] ?? 'N/A'));
    error_log("[STK QUERY RESPONSE ANALYSIS] ResponseDescription: " . ($response_data['ResponseDescription'] ?? 'N/A'));
    error_log("[STK QUERY RESPONSE ANALYSIS] ResultCode: " . ($response_data['ResultCode'] ?? 'N/A'));
    error_log("[STK QUERY RESPONSE ANALYSIS] ResultDesc: " . ($response_data['ResultDesc'] ?? 'N/A'));
    error_log("[STK QUERY RESPONSE ANALYSIS] MerchantRequestID: " . ($response_data['MerchantRequestID'] ?? 'N/A'));
    error_log("[STK QUERY RESPONSE ANALYSIS] CheckoutRequestID: " . ($response_data['CheckoutRequestID'] ?? 'N/A'));

    // Check for error result codes
    $result_code = $response_data['ResultCode'] ?? null;
    if ($result_code && $result_code !== '0' && $result_code !== 0) {
        error_log("[STK QUERY ERROR ANALYSIS] Non-zero ResultCode detected: $result_code");
        error_log("[STK QUERY ERROR ANALYSIS] Description: " . ($response_data['ResultDesc'] ?? 'No description'));
        error_log("[STK QUERY ERROR ANALYSIS] This indicates the STK push failed on M-Pesa side");
    }

    error_log("[STK QUERY SUCCESS] ResultCode: " . ($response_data['ResultCode'] ?? 'N/A'));
    error_log("[STK QUERY SUCCESS] ResultDesc: " . ($response_data['ResultDesc'] ?? 'N/A'));

    return [
        'success' => true,
        'result_code' => $response_data['ResultCode'],
        'result_description' => $response_data['ResultDesc'],
        'merchant_request_id' => $response_data['MerchantRequestID'] ?? null,
        'checkout_request_id' => $response_data['CheckoutRequestID'] ?? null
    ];
}

// Initiate B2C payment (payout)
function initiateB2CPayment($credentials, $phone, $amount, $command_id = null, $remarks = null, $queue_timeout_url = null, $result_url = null) {
    error_log("[B2C INIT] Starting B2C payment - Phone: $phone, Amount: $amount");
    
    $access_token = getMpesaAccessToken($credentials);

    if (!$access_token) {
        error_log("[B2C ERROR] Failed to obtain access token");
        return [
            'success' => false,
            'error' => 'Failed to obtain M-Pesa access token'
        ];
    }

    $environment = $credentials['environment'] ?? 'sandbox';
    $shortcode = $credentials['shortcode'];
    $initiator_name = $credentials['initiator_name'];
    $security_credential = $credentials['security_credential'];

    error_log("[B2C REQUEST] Environment: $environment, Shortcode: $shortcode, InitiatorName: $initiator_name");

    // Use default B2C callback URLs if not provided (for payouts)
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'] ?? 'trainercoachconnect.com';
    $default_callback = $protocol . $host . '/b2c_callback.php';

    if (empty($queue_timeout_url)) {
        $queue_timeout_url = $default_callback;
    }
    if (empty($result_url)) {
        $result_url = $default_callback;
    }

    $b2c_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest';

    error_log("[B2C REQUEST] URL: $b2c_url");

    $payload = [
        'InitiatorName' => $initiator_name,
        'SecurityCredential' => $security_credential,
        'CommandID' => $command_id ?? 'BusinessPayment',
        'Amount' => intval($amount),
        'PartyA' => $shortcode,
        'PartyB' => $phone,
        'Remarks' => $remarks ?? 'Payout',
        'QueueTimeOutURL' => $queue_timeout_url,
        'ResultURL' => $result_url
    ];

    error_log("[B2C PAYLOAD] " . json_encode($payload, JSON_PRETTY_PRINT));
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $b2c_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $access_token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    error_log("[B2C RESPONSE] HTTP Code: $http_code");
    error_log("[B2C RESPONSE] Full Response: " . $response);
    
    if ($curl_error) {
        error_log("[B2C CURL ERROR] $curl_error");
    }
    
    $response_data = json_decode($response, true);
    
    if ($http_code !== 200 || empty($response_data['ConversationID'])) {
        error_log("[B2C ERROR] HTTP $http_code - " . json_encode($response_data, JSON_PRETTY_PRINT));
        return [
            'success' => false,
            'error' => $response_data['errorMessage'] ?? 'Failed to initiate B2C payment'
        ];
    }
    
    error_log("[B2C SUCCESS] ConversationID: " . $response_data['ConversationID']);
    
    return [
        'success' => true,
        'conversation_id' => $response_data['ConversationID'],
        'originator_conversation_id' => $response_data['OriginatorConversationID'],
        'response_code' => $response_data['ResponseCode'],
        'response_description' => $response_data['ResponseDescription']
    ];
}

// Save M-Pesa credentials to dedicated mpesa_credentials table
function saveMpesaCredentials($credentials) {
    global $conn;

    error_log("[MPESA SAVE] Saving credentials to database");

    // Ensure mpesa_credentials table exists
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";

    if (!$conn->query($create_table_sql)) {
        error_log("[MPESA SAVE ERROR] Failed to create mpesa_credentials table: " . $conn->error);
        return false;
    }

    // Delete existing credentials and insert new ones (keeps history clean)
    $delete_sql = "DELETE FROM mpesa_credentials";
    if (!$conn->query($delete_sql)) {
        error_log("[MPESA SAVE WARNING] Failed to delete old credentials: " . $conn->error);
        // Don't return false, continue with insert
    }

    $sql = "
        INSERT INTO mpesa_credentials (
            consumerKey, consumerSecret, shortcode, passkey, environment,
            securityCredential, resultUrl, initiatorName, commandId, transactionType,
            c2bCallbackUrl, b2cCallbackUrl, queueTimeoutUrl, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log("[MPESA SAVE ERROR] Prepare failed: " . $conn->error);
        return false;
    }

    // Extract values into variables for bind_param
    $consumerKey = $credentials['consumerKey'];
    $consumerSecret = $credentials['consumerSecret'];
    $shortcode = $credentials['shortcode'];
    $passkey = $credentials['passkey'];
    $environment = $credentials['environment'] ?? 'production';
    $securityCredential = $credentials['securityCredential'] ?? null;
    $resultUrl = $credentials['resultUrl'] ?? null;
    $initiatorName = $credentials['initiatorName'] ?? null;
    $commandId = $credentials['commandId'] ?? 'BusinessPayment';
    $transactionType = $credentials['transactionType'] ?? 'BusinessPayment';
    $c2bCallbackUrl = $credentials['c2bCallbackUrl'] ?? null;
    $b2cCallbackUrl = $credentials['b2cCallbackUrl'] ?? null;
    $queueTimeoutUrl = $credentials['queueTimeoutUrl'] ?? null;
    $source = $credentials['source'] ?? 'admin_settings';

    $stmt->bind_param(
        "ssssssssssssss",
        $consumerKey,
        $consumerSecret,
        $shortcode,
        $passkey,
        $environment,
        $securityCredential,
        $resultUrl,
        $initiatorName,
        $commandId,
        $transactionType,
        $c2bCallbackUrl,
        $b2cCallbackUrl,
        $queueTimeoutUrl,
        $source
    );

    $result = $stmt->execute();
    $stmt->close();

    if (!$result) {
        error_log("[MPESA SAVE ERROR] Execute failed: " . $conn->error);
        return false;
    }

    error_log("[MPESA SAVE SUCCESS] Credentials saved to mpesa_credentials table");

    // Log credential change
    logEvent('mpesa_credentials_updated', [
        'source' => $credentials['source'] ?? 'admin_settings',
        'environment' => $credentials['environment'] ?? 'unknown'
    ]);

    return true;
}

// Get M-Pesa credentials for admin display (with masked secrets)
function getMpesaCredentialsForAdmin() {
    global $conn;

    // Try to get from dedicated mpesa_credentials table first
    $sql = "SELECT * FROM mpesa_credentials ORDER BY updated_at DESC LIMIT 1";
    $result = @$conn->query($sql);

    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        if (!empty($row['consumerKey']) && !empty($row['consumerSecret'])) {
            // Return with masked secrets for display
            return [
                'environment' => $row['environment'] ?? 'production',
                'consumerKey' => maskSecret($row['consumerKey']),
                'consumerSecret' => maskSecret($row['consumerSecret']),
                'shortcode' => $row['shortcode'] ?? '',
                'passkey' => maskSecret($row['passkey']),
                'resultUrl' => $row['resultUrl'] ?? '',
                'initiatorName' => $row['initiatorName'] ?? '',
                'securityCredential' => maskSecret($row['securityCredential'] ?? ''),
                'commandId' => $row['commandId'] ?? 'BusinessPayment',
                'transactionType' => $row['transactionType'] ?? 'BusinessPayment',
                'c2bCallbackUrl' => $row['c2bCallbackUrl'] ?? '',
                'b2cCallbackUrl' => $row['b2cCallbackUrl'] ?? '',
                'queueTimeoutUrl' => $row['queueTimeoutUrl'] ?? '',
                'source' => $row['source'] ?? 'admin_settings'
            ];
        }
    }

    // Fallback to using the full getMpesaCredentials() function for backward compatibility
    error_log("[MPESA ADMIN] mpesa_credentials table query failed or empty, using getMpesaCredentials fallback...");
    $creds = getMpesaCredentials();
    if (!$creds) {
        return null;
    }

    // Return with masked secrets for display
    return [
        'environment' => $creds['environment'],
        'consumerKey' => maskSecret($creds['consumer_key']),
        'consumerSecret' => maskSecret($creds['consumer_secret']),
        'shortcode' => $creds['shortcode'],
        'passkey' => maskSecret($creds['passkey']),
        'resultUrl' => $creds['result_url'],
        'initiatorName' => $creds['initiator_name'],
        'securityCredential' => maskSecret($creds['security_credential']),
        'c2bCallbackUrl' => $creds['c2b_callback_url'] ?? '',
        'b2cCallbackUrl' => $creds['b2c_callback_url'] ?? '',
        'source' => $creds['source']
    ];
}

// Mask secrets for display (show only first and last 3 chars)
function maskSecret($secret) {
    if (empty($secret) || strlen($secret) < 8) {
        return '••••••••';
    }
    $visible = strlen($secret) <= 6 ? 3 : 3;
    return substr($secret, 0, $visible) . '...' . substr($secret, -3);
}

// Record M-Pesa payment from session data
function recordMpesaPayment($conn, $session, $resultCode, $resultDesc, $amount = null, $receipt = null) {
    if ($resultCode !== 0 && $resultCode !== '0') {
        error_log("[MPESA RECORD] Skipping record for non-zero ResultCode: $resultCode");
        return false;
    }

    $checkoutRequestId = $session['checkout_request_id'] ?? null;
    $bookingId = $session['booking_id'] ?? null;
    $clientId = $session['client_id'] ?? null;
    $trainerId = $session['trainer_id'] ?? null;
    $amount = $amount ?? $session['amount'] ?? 0;

    // Check for existing payment by receipt
    if (!empty($receipt)) {
        $checkStmt = $conn->prepare("SELECT id FROM payments WHERE transaction_reference = ? LIMIT 1");
        if ($checkStmt) {
            $checkStmt->bind_param("s", $receipt);
            $checkStmt->execute();
            $checkRes = $checkStmt->get_result();
            if ($checkRes && $checkRes->num_rows > 0) {
                error_log("[MPESA RECORD] Duplicate payment for receipt: $receipt");
                $checkStmt->close();
                return true; // Already recorded
            }
            $checkStmt->close();
        }
    }

    // Check for existing payment for this booking
    if ($bookingId) {
        $checkSessionStmt = $conn->prepare("SELECT id FROM payments WHERE booking_id = ? AND status = 'completed' LIMIT 1");
        if ($checkSessionStmt) {
            $checkSessionStmt->bind_param("s", $bookingId);
            $checkSessionStmt->execute();
            $checkRes = $checkSessionStmt->get_result();
            if ($checkRes && $checkRes->num_rows > 0) {
                 error_log("[MPESA RECORD] Payment already exists for booking: $bookingId");
                 $checkSessionStmt->close();
                 return true;
            }
            $checkSessionStmt->close();
        }
    }

    // Fetch booking details if available to get fee breakdown
    $baseServiceAmount = $amount;
    $transportFee = 0;
    $platformFee = 0;
    $vatAmount = 0;
    $trainerNetAmount = $amount;

    if ($bookingId) {
        $bookingStmt = $conn->prepare("SELECT trainer_id, base_service_amount, transport_fee, platform_fee, vat_amount, trainer_net_amount FROM bookings WHERE id = ? LIMIT 1");
        if ($bookingStmt) {
            $bookingStmt->bind_param("s", $bookingId);
            $bookingStmt->execute();
            $bookingResult = $bookingStmt->get_result();
            if ($bookingResult && $bookingResult->num_rows > 0) {
                $booking = $bookingResult->fetch_assoc();
                $trainerId = $trainerId ?? $booking['trainer_id'];
                $baseServiceAmount = floatval($booking['base_service_amount'] ?? $amount);
                $transportFee = floatval($booking['transport_fee'] ?? 0);
                $platformFee = floatval($booking['platform_fee'] ?? 0);
                $vatAmount = floatval($booking['vat_amount'] ?? 0);
                $trainerNetAmount = floatval($booking['trainer_net_amount'] ?? $amount);
            }
            $bookingStmt->close();
        }
    }

    $paymentId = 'payment_' . uniqid();
    $now = date('Y-m-d H:i:s');
    $status = 'completed';
    $method = 'stk';

    $paymentStmt = $conn->prepare("
        INSERT INTO payments (
            id, user_id, client_id, trainer_id, booking_id, amount,
            base_service_amount, transport_fee, platform_fee, vat_amount, trainer_net_amount,
            status, method, transaction_reference, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    if ($paymentStmt) {
        $paymentStmt->bind_param(
            "sssssddddddsssss",
            $paymentId, $clientId, $clientId, $trainerId, $bookingId, $amount,
            $baseServiceAmount, $transportFee, $platformFee, $vatAmount, $trainerNetAmount,
            $status, $method, $receipt, $now, $now
        );
        $res = $paymentStmt->execute();
        $paymentStmt->close();

        if ($res && $bookingId) {
             // Update booking status
             $conn->query("UPDATE bookings SET status = 'confirmed' WHERE id = '$bookingId' AND (status = 'pending' OR status = 'confirmed')");
        }

        // Send payment confirmation SMS if SMS helper is available
        if ($res && $clientId) {
            try {
                $userStmt = $conn->prepare("SELECT phone FROM users WHERE id = ? LIMIT 1");
                if ($userStmt) {
                    $userStmt->bind_param("s", $clientId);
                    $userStmt->execute();
                    $userResult = $userStmt->get_result();
                    if ($userResult && $row = $userResult->fetch_assoc()) {
                        if (!empty($row['phone']) && function_exists('sendPaymentSms')) {
                            @sendPaymentSms($clientId, $row['phone'], [
                                'id' => $paymentId,
                                'amount' => $amount,
                                'transaction_reference' => $receipt,
                                'booking_id' => $bookingId
                            ]);
                        }
                    }
                    $userStmt->close();
                }
            } catch (Exception $e) {
                error_log("[MPESA SMS ERROR] Failed to send payment SMS: " . $e->getMessage());
            }
        }

        error_log("[MPESA RECORD] Payment recorded: id=$paymentId, booking=$bookingId, amount=$amount");
        return $res;
    }

    error_log("[MPESA RECORD ERROR] Failed to prepare payment insert statement: " . $conn->error);
    return false;
}

// Log payment event
function logPaymentEvent($action, $details = []) {
    logEvent('mpesa_' . $action, array_merge($details, [
        'timestamp' => date('Y-m-d H:i:s'),
        'php_pid' => getmypid()
    ]));
}
?>
