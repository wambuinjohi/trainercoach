<?php
/**
 * M-Pesa C2B Validation URL Handler
 * 
 * This endpoint is called by M-Pesa to validate incoming C2B (STK Push) transactions
 * BEFORE the callback is sent. This provides an extra layer of validation and security.
 * 
 * M-Pesa sends:
 * {
 *   "TransactionType": "Pay Bills Online",
 *   "TransID": "LIB920000485",
 *   "TransTime": "20191219102115",
 *   "TransAmount": "1000",
 *   "BusinessShortCode": "174379",
 *   "BillRefNumber": "invoicenumber",
 *   "InvoiceNumber": "",
 *   "OrgAccountID": "",
 *   "ThirdPartyTransID": "",
 *   "MSISDN": "254729876543",
 *   "FirstName": "John",
 *   "MiddleName": "",
 *   "LastName": "Doe"
 * }
 * 
 * We should respond with:
 * {
 *   "ResultCode": 0,
 *   "ResultDesc": "Validation successful"
 * }
 * 
 * ResultCode values:
 *   0 = Accept/validate
 *   1 = Reject/invalidate
 */

// Set immediate headers
if (!headers_sent()) {
    header("Content-Type: application/json; charset=utf-8");
}

// Disable output buffering
if (ob_get_level()) {
    ob_end_clean();
}

// Turn off error display
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Include database connection
require_once(__DIR__ . '/connection.php');

function logValidation($type, $details = []) {
    $timestamp = date('Y-m-d H:i:s');
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    $logEntry = [
        'timestamp' => $timestamp,
        'event_type' => 'c2b_validation_' . $type,
        'client_ip' => $clientIp
    ];
    
    $logEntry = array_merge($logEntry, $details);
    error_log(json_encode($logEntry));
    
    // Also write to specific validation log
    $logFile = __DIR__ . '/c2b_validations.log';
    $logLine = json_encode($logEntry) . PHP_EOL;
    @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
}

try {
    // Get raw request body
    $rawRequest = file_get_contents('php://input');
    $requestData = json_decode($rawRequest, true);
    
    // Log incoming validation request
    logValidation('received', [
        'transaction_id' => $requestData['TransID'] ?? 'unknown',
        'msisdn' => $requestData['MSISDN'] ?? 'unknown',
        'amount' => $requestData['TransAmount'] ?? 'unknown'
    ]);
    
    if (!$requestData) {
        logValidation('invalid_json', ['raw' => substr($rawRequest, 0, 500)]);
        http_response_code(400);
        echo json_encode([
            'ResultCode' => 1,
            'ResultDesc' => 'Invalid JSON request'
        ]);
        exit;
    }
    
    // Extract validation data
    $transactionId = $requestData['TransID'] ?? null;
    $billRefNumber = $requestData['BillRefNumber'] ?? null;
    $msisdn = $requestData['MSISDN'] ?? null;
    $transAmount = floatval($requestData['TransAmount'] ?? 0);
    $transactionType = $requestData['TransactionType'] ?? null;
    $businessShortCode = $requestData['BusinessShortCode'] ?? null;
    
    // Log validation details
    error_log("[C2B VALIDATION] TransID: $transactionId, BillRef: $billRefNumber, Phone: $msisdn, Amount: $transAmount");
    
    // Validation checks
    $validationPassed = true;
    $validationErrors = [];
    
    // Check 1: Transaction ID present
    if (empty($transactionId)) {
        $validationPassed = false;
        $validationErrors[] = 'Missing TransID';
    }
    
    // Check 2: Phone number valid
    if (empty($msisdn) || !preg_match('/^254\d{9}$/', strval($msisdn))) {
        $validationPassed = false;
        $validationErrors[] = 'Invalid MSISDN format';
    }
    
    // Check 3: Amount is positive
    if ($transAmount <= 0) {
        $validationPassed = false;
        $validationErrors[] = 'Invalid transaction amount';
    }
    
    // Check 4: Bill reference present (account reference)
    if (empty($billRefNumber)) {
        $validationPassed = false;
        $validationErrors[] = 'Missing BillRefNumber (account reference)';
    }
    
    // Check 5: Validate business short code matches configured shortcode (optional, for extra security)
    $credentialsCheck = "SELECT shortcode, buyGoodsShortCode FROM mpesa_credentials ORDER BY updated_at DESC LIMIT 1";
    $credentialsResult = @$conn->query($credentialsCheck);
    if ($credentialsResult && $credentialsResult->num_rows > 0) {
        $credentials = $credentialsResult->fetch_assoc();
        $configuredShortcode = $credentials['buyGoodsShortCode'] ?? $credentials['shortcode'] ?? null;
        
        if ($configuredShortcode && $businessShortCode !== $configuredShortcode) {
            error_log("[C2B VALIDATION WARNING] Shortcode mismatch: $businessShortCode vs configured $configuredShortcode");
            // Don't fail validation, but log it
        }
    }
    
    // Check 6: Check for duplicate transaction (prevent double processing)
    $duplicateCheck = "
        SELECT id FROM c2b_payment_callbacks 
        WHERE mpesa_receipt_number = ? OR 
        (received_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE) AND amount = ? AND phone_number = ?)
        LIMIT 1
    ";
    $dupStmt = $conn->prepare($duplicateCheck);
    if ($dupStmt) {
        $checkTransId = $transactionId;
        $dupStmt->bind_param("sds", $checkTransId, $transAmount, $msisdn);
        $dupStmt->execute();
        $dupResult = $dupStmt->get_result();
        if ($dupResult && $dupResult->num_rows > 0) {
            error_log("[C2B VALIDATION] Potential duplicate transaction: $transactionId");
            // Don't reject, but note it
        }
        $dupStmt->close();
    }
    
    // Respond with validation result
    if ($validationPassed) {
        logValidation('passed', [
            'transaction_id' => $transactionId,
            'amount' => $transAmount,
            'msisdn' => $msisdn
        ]);
        
        error_log("[C2B VALIDATION] ✓ Validation PASSED for TransID: $transactionId");
        
        http_response_code(200);
        echo json_encode([
            'ResultCode' => 0,
            'ResultDesc' => 'Validation successful'
        ]);
    } else {
        logValidation('failed', [
            'transaction_id' => $transactionId,
            'amount' => $transAmount,
            'msisdn' => $msisdn,
            'errors' => $validationErrors
        ]);
        
        error_log("[C2B VALIDATION] ✗ Validation FAILED for TransID: $transactionId - Errors: " . implode(', ', $validationErrors));
        
        http_response_code(200); // Still return 200, but with result code 1
        echo json_encode([
            'ResultCode' => 1,
            'ResultDesc' => 'Validation failed: ' . implode('; ', $validationErrors)
        ]);
    }
    
    exit;
    
} catch (Exception $e) {
    logValidation('exception', [
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
    
    error_log("[C2B VALIDATION EXCEPTION] " . $e->getMessage());
    
    http_response_code(200);
    echo json_encode([
        'ResultCode' => 1,
        'ResultDesc' => 'Server error during validation'
    ]);
    exit;
}
?>
