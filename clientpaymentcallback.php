<?php
/**
 * M-Pesa B2C Payment Callback Handler
 * 
 * This callback is invoked by Safaricom's M-Pesa API when a B2C (Business to Consumer)
 * payment is completed or fails. The platform uses this to send payouts to trainers and clients.
 * 
 * Callback URL: https://trainercoachconnect.com/clientpaymentcallback.php
 * 
 * Expected POST format from M-Pesa:
 * {
 *   "Result": {
 *     "ResultType": 0,
 *     "ResultCode": 0,
 *     "ResultDesc": "The service request has been processed successfully.",
 *     "OriginatorConversationID": "...",
 *     "ConversationID": "...",
 *     "TransactionID": "...",
 *     "ReferenceData": {
 *       "ReferenceItem": [
 *         {
 *           "Key": "TransactionAmount",
 *           "Value": 100.00
 *         },
 *         {
 *           "Key": "ReceiverPartyPublicName",
 *           "Value": "254712345678"
 *         }
 *       ]
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

// Utility function for logging
function logB2CEvent($type, $details = []) {
    $timestamp = date('Y-m-d H:i:s');
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    $logEntry = [
        'timestamp' => $timestamp,
        'event_type' => 'b2c_' . $type,
        'client_ip' => $clientIp,
    ];
    
    $logEntry = array_merge($logEntry, $details);
    error_log(json_encode($logEntry));
    
    $logFile = __DIR__ . '/b2c_callbacks.log';
    $logLine = json_encode($logEntry) . PHP_EOL;
    @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
}

try {
    // Get raw request body
    $rawRequest = file_get_contents('php://input');
    $requestData = json_decode($rawRequest, true);

    if (!$requestData) {
        logB2CEvent('invalid_json', ['raw' => substr($rawRequest, 0, 500)]);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
        exit;
    }

    // Log the incoming request
    logB2CEvent('received', ['request' => $requestData]);

    // Extract callback data - handle both B2C and STK formats
    $result = $requestData['Result'] ?? null;
    $body = $requestData['Body'] ?? null;
    $stkCallback = $body['stkCallback'] ?? null;

    // If this is an STK callback that was sent to B2C endpoint, redirect to proper handling
    if ($stkCallback && !$result) {
        logB2CEvent('received_stk_callback', [
            'checkout_request_id' => $stkCallback['CheckoutRequestID'] ?? null,
            'merchant_request_id' => $stkCallback['MerchantRequestID'] ?? null,
            'result_code' => $stkCallback['ResultCode'] ?? null,
            'message' => 'STK callback received on B2C endpoint - redirecting to proper handler'
        ]);
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'C2B callback should use c2b_callback.php endpoint']);
        exit;
    }

    if (!$result) {
        logB2CEvent('missing_result', ['request' => $requestData]);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing Result object']);
        exit;
    }

    $resultCode = intval($result['ResultCode'] ?? 1);
    $resultDesc = $result['ResultDesc'] ?? 'Unknown error';
    $transactionID = $result['TransactionID'] ?? null;
    $originatorConversationID = $result['OriginatorConversationID'] ?? null;
    $conversationID = $result['ConversationID'] ?? null;
    $merchantRequestId = $result['MerchantRequestID'] ?? null;
    
    // Parse reference data to extract transaction details
    $transactionAmount = null;
    $receiverPhone = null;
    $referenceId = null;
    
    if (isset($result['ReferenceData']['ReferenceItem'])) {
        foreach ($result['ReferenceData']['ReferenceItem'] as $item) {
            $key = $item['Key'] ?? '';
            $value = $item['Value'] ?? '';
            
            if ($key === 'TransactionAmount') {
                $transactionAmount = floatval($value);
            } elseif ($key === 'ReceiverPartyPublicName') {
                $receiverPhone = strval($value);
            } elseif ($key === 'ReferenceID') {
                $referenceId = strval($value);
            }
        }
    }
    
    // Store the callback in the database
    if ($transactionID) {
        $stmt = $conn->prepare("
            INSERT INTO b2c_payment_callbacks (
                transaction_id, originator_conversation_id, conversation_id,
                result_code, result_description, transaction_amount,
                receiver_phone, reference_id, merchant_request_id, raw_response, received_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                result_code = VALUES(result_code),
                result_description = VALUES(result_description),
                transaction_amount = VALUES(transaction_amount),
                receiver_phone = VALUES(receiver_phone),
                reference_id = VALUES(reference_id),
                merchant_request_id = VALUES(merchant_request_id),
                raw_response = VALUES(raw_response),
                received_at = NOW()
        ");

        if ($stmt) {
            $rawJson = json_encode($result);
            $stmt->bind_param(
                "sssissdsss",
                $transactionID,
                $originatorConversationID,
                $conversationID,
                $resultCode,
                $resultDesc,
                $transactionAmount,
                $receiverPhone,
                $referenceId,
                $merchantRequestId,
                $rawJson
            );
            
            if ($stmt->execute()) {
                logB2CEvent('callback_stored', [
                    'transaction_id' => $transactionID,
                    'result_code' => $resultCode,
                    'amount' => $transactionAmount,
                    'phone' => $receiverPhone,
                ]);
                
                // If payment successful, update payment record
                if ($resultCode === 0 && $transactionAmount && $referenceId) {
                    // Try to find and update related payment
                    $updateStmt = $conn->prepare("
                        UPDATE b2c_payments
                        SET status = ?, transaction_id = ?, updated_at = NOW()
                        WHERE reference_id = ?
                    ");
                    
                    if ($updateStmt) {
                        $status = 'completed';
                        $updateStmt->bind_param("sss", $status, $transactionID, $referenceId);
                        $updateStmt->execute();
                        $updateStmt->close();
                        
                        logB2CEvent('payment_completed', [
                            'transaction_id' => $transactionID,
                            'reference_id' => $referenceId,
                            'amount' => $transactionAmount,
                        ]);
                    }
                } elseif ($resultCode !== 0 && $referenceId) {
                    // Payment failed
                    $updateStmt = $conn->prepare("
                        UPDATE b2c_payments
                        SET status = ?, error_description = ?, updated_at = NOW()
                        WHERE reference_id = ?
                    ");
                    
                    if ($updateStmt) {
                        $status = 'failed';
                        $updateStmt->bind_param("sss", $status, $resultDesc, $referenceId);
                        $updateStmt->execute();
                        $updateStmt->close();
                        
                        logB2CEvent('payment_failed', [
                            'reference_id' => $referenceId,
                            'result_code' => $resultCode,
                            'error' => $resultDesc,
                        ]);
                    }
                }
                
                $stmt->close();
            } else {
                logB2CEvent('store_error', ['error' => $conn->error]);
            }
        } else {
            logB2CEvent('prepare_error', ['error' => $conn->error]);
        }
    }
    
    // Always return 200 OK to acknowledge receipt
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Callback received and processed',
        'transaction_id' => $transactionID,
    ]);
    exit;
    
} catch (Exception $e) {
    logB2CEvent('exception', ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
    exit;
}
?>
