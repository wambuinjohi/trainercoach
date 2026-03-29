<?php
/**
 * M-Pesa C2B (STK Push) Payment Callback Handler
 * 
 * This callback is invoked by Safaricom's M-Pesa API when an STK Push payment
 * (customer-to-business) is completed or fails. Used for client payments.
 * 
 * Callback URL: https://trainercoachconnect.com/c2b_callback.php
 * 
 * Expected POST format from M-Pesa (STK Push):
 * {
 *   "Body": {
 *     "stkCallback": {
 *       "MerchantCheckoutID": "WS_CO_191220191020375644",
 *       "CheckoutRequestID": "WS_CO_191220191020375644",
 *       "ResultCode": 0,
 *       "ResultDesc": "The service request has been processed successfully.",
 *       "CallbackMetadata": {
 *         "Item": [
 *           {
 *             "Name": "Amount",
 *             "Value": 1000
 *           },
 *           {
 *             "Name": "MpesaReceiptNumber",
 *             "Value": "NLJ7RT61SV"
 *           },
 *           {
 *             "Name": "TransactionDate",
 *             "Value": 20191219102115
 *           },
 *           {
 *             "Name": "PhoneNumber",
 *             "Value": 254729876543
 *           }
 *         ]
 *       }
 *     }
 *   }
 * }
 */

// Disable output buffering and output directly
if (ob_get_level()) {
    ob_end_clean();
}
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Set headers BEFORE any output
if (!headers_sent()) {
    header("Content-Type: application/json; charset=utf-8");
}

// Include database connection
require_once(__DIR__ . '/connection.php');

// Include M-Pesa helper for recording payments
include_once(__DIR__ . '/mpesa_helper.php');

// Include SMS helper if available
@include_once(__DIR__ . '/sms_helper.php');

// Utility function for logging
function logC2BEvent($type, $details = []) {
    $timestamp = date('Y-m-d H:i:s');
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    $logEntry = [
        'timestamp' => $timestamp,
        'event_type' => 'c2b_' . $type,
        'client_ip' => $clientIp,
    ];
    
    $logEntry = array_merge($logEntry, $details);
    error_log(json_encode($logEntry));
    
    $logFile = __DIR__ . '/c2b_callbacks.log';
    $logLine = json_encode($logEntry) . PHP_EOL;
    @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
}

try {
    // Get raw request body
    $rawRequest = file_get_contents('php://input');
    $requestData = json_decode($rawRequest, true);
    
    if (!$requestData) {
        logC2BEvent('invalid_json', ['raw' => substr($rawRequest, 0, 500)]);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
        exit;
    }
    
    // Log the incoming request
    logC2BEvent('received', ['request_keys' => array_keys($requestData)]);
    
    // Extract STK callback data
    $body = $requestData['Body'] ?? null;
    $stkCallback = $body['stkCallback'] ?? null;
    
    if (!$stkCallback) {
        logC2BEvent('missing_stkcallback', ['request' => $requestData]);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing stkCallback object']);
        exit;
    }
    
    $resultCode = intval($stkCallback['ResultCode'] ?? 1);
    $resultDesc = $stkCallback['ResultDesc'] ?? 'Unknown error';
    $checkoutRequestId = $stkCallback['CheckoutRequestID'] ?? null;
    $merchantCheckoutId = $stkCallback['MerchantCheckoutID'] ?? null;
    $merchantRequestId = $stkCallback['MerchantRequestID'] ?? null;
    
    // Parse callback metadata
    $amount = null;
    $mpesaReceiptNumber = null;
    $transactionDate = null;
    $phoneNumber = null;
    
    if (isset($stkCallback['CallbackMetadata']['Item'])) {
        foreach ($stkCallback['CallbackMetadata']['Item'] as $item) {
            $name = $item['Name'] ?? '';
            $value = $item['Value'] ?? '';
            
            if ($name === 'Amount') {
                $amount = floatval($value);
            } elseif ($name === 'MpesaReceiptNumber') {
                $mpesaReceiptNumber = strval($value);
            } elseif ($name === 'TransactionDate') {
                $transactionDate = strval($value);
            } elseif ($name === 'PhoneNumber') {
                $phoneNumber = strval($value);
            }
        }
    }
    
    // Find the STK Push session
    if ($checkoutRequestId) {
        error_log("[C2B CALLBACK] Looking for session with CheckoutRequestID: $checkoutRequestId");

        $stmt = $conn->prepare("SELECT * FROM stk_push_sessions WHERE checkout_request_id = ? LIMIT 1");

        if ($stmt) {
            $stmt->bind_param("s", $checkoutRequestId);
            $stmt->execute();
            $result = $stmt->get_result();
            $stmt->close();

            error_log("[C2B CALLBACK] Query returned " . ($result ? $result->num_rows : 0) . " rows");

            if ($result && $result->num_rows > 0) {
                $session = $result->fetch_assoc();
                
                // Determine status based on result code
                $status = 'success';
                if ($resultCode === 0 || $resultCode == 0) {
                    $status = 'success';
                } elseif ($resultCode === 1032 || $resultCode == 1032) {
                    $status = 'timeout';
                } elseif ($resultCode !== '0' && $resultCode !== 0) {
                    $status = 'failed';
                }
                
                // Update the STK session
                $updateStmt = $conn->prepare("
                    UPDATE stk_push_sessions
                    SET status = ?, result_code = ?, result_description = ?, updated_at = NOW()
                    WHERE checkout_request_id = ?
                ");

                if ($updateStmt) {
                    $updateStmt->bind_param("ssss", $status, $resultCode, $resultDesc, $checkoutRequestId);
                    $updateStmt->execute();
                    $updateStmt->close();
                    
                    logC2BEvent('session_updated', [
                        'checkout_request_id' => $checkoutRequestId,
                        'merchant_request_id' => $merchantRequestId,
                        'status' => $status,
                        'result_code' => $resultCode,
                        'amount' => $amount,
                        'phone' => $phoneNumber,
                        'receipt' => $mpesaReceiptNumber
                    ]);

                    // If payment successful, record payment
                    if ($status === 'success') {
                        $recorded = recordMpesaPayment($conn, $session, $resultCode, $resultDesc, $amount, $mpesaReceiptNumber);
                        if ($recorded) {
                            logC2BEvent('payment_processed', ['checkout_request_id' => $checkoutRequestId]);
                        }
                    } elseif (($status === 'failed' || $status === 'timeout') && $session['id']) {
                        // Update booking payment status to failed if booking exists
                        if ($session['booking_id']) {
                            $conn->query("UPDATE bookings SET payment_status = 'failed' WHERE id = '" . $conn->real_escape_string($session['booking_id']) . "'");
                        }
                        logC2BEvent('payment_failed', [
                            'checkout_request_id' => $checkoutRequestId,
                            'booking_id' => $session['booking_id'],
                            'status' => $status,
                            'result_code' => $resultCode,
                            'error' => $resultDesc
                        ]);
                    }
                }
            } else {
                logC2BEvent('session_not_found', ['checkout_request_id' => $checkoutRequestId]);
            }
        } else {
            logC2BEvent('prepare_error', ['error' => $conn->error]);
        }
    }
    
    // Always return 200 OK to acknowledge receipt
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'C2B callback received and processed',
        'checkout_request_id' => $checkoutRequestId,
    ]);
    exit;
    
} catch (Exception $e) {
    logC2BEvent('exception', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
    exit;
}
?>
