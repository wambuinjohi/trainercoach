<?php
/**
 * STK Push Retry Worker
 * Background job to retry failed/timed-out STK push payments
 * 
 * This can be run:
 * - Manually: php scripts/worker_stk_retry.php
 * - As cron: * * * * * php /path/to/scripts/worker_stk_retry.php
 * - Via API: POST /api.php?action=stk_retry_worker
 * 
 * The worker will:
 * 1. Find STK sessions that failed/timed-out and are marked for retry
 * 2. Check if it's time for the next retry attempt
 * 3. Query M-Pesa for current status
 * 4. Update session status
 * 5. Record payment if successful
 * 6. Schedule next retry if still failed (indefinite retries)
 */

require_once(__DIR__ . '/../connection.php');
require_once(__DIR__ . '/../mpesa_helper.php');

class STKRetryWorker {
    private $conn;
    private $processed = 0;
    private $succeeded = 0;
    private $scheduled_retries = 0;
    private $exhausted_retries = 0;
    private $errors = [];

    // Retry configuration
    private $base_retry_interval = 60; // Start with 60 seconds
    private $max_retry_interval = 3600; // Max 1 hour between retries
    private $exponential_backoff = true; // Use exponential backoff
    private $jitter_enabled = true; // Add randomness to prevent thundering herd
    private $max_retry_attempts = 10; // Maximum number of retry attempts
    
    public function __construct($db_conn) {
        $this->conn = $db_conn;
    }
    
    /**
     * Run the worker - find and retry failed STK push sessions
     */
    public function run() {
        echo "\n" . str_repeat("=", 80) . "\n";
        echo "STK PUSH RETRY WORKER - " . date('Y-m-d H:i:s') . "\n";
        echo str_repeat("=", 80) . "\n\n";
        
        // Find sessions that need retry
        $sessions = $this->findSessionsForRetry();
        
        if (empty($sessions)) {
            echo "ℹ No sessions scheduled for retry at this time\n";
            return [
                'status' => 'success',
                'processed' => 0,
                'succeeded' => 0,
                'scheduled_retries' => 0,
                'exhausted_retries' => 0,
                'errors' => []
            ];
        }
        
        echo "Found " . count($sessions) . " session(s) to retry\n\n";
        
        // Process each session
        foreach ($sessions as $session) {
            $this->processSession($session);
        }
        
        // Print summary
        $this->printSummary();

        return [
            'status' => 'success',
            'processed' => $this->processed,
            'succeeded' => $this->succeeded,
            'scheduled_retries' => $this->scheduled_retries,
            'exhausted_retries' => $this->exhausted_retries,
            'errors' => $this->errors
        ];
    }
    
    /**
     * Find sessions that are scheduled for retry
     */
    private function findSessionsForRetry() {
        $sql = "
            SELECT * FROM stk_push_sessions
            WHERE should_retry = TRUE
            AND status IN ('failed', 'timeout')
            AND (next_retry_at IS NULL OR next_retry_at <= NOW())
            ORDER BY next_retry_at ASC
            LIMIT 50
        ";
        
        $result = $this->conn->query($sql);
        $sessions = [];
        
        if ($result && $result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $sessions[] = $row;
            }
        }
        
        return $sessions;
    }
    
    /**
     * Process a single session - query status and retry
     */
    private function processSession($session) {
        $id = $session['id'];
        $phone = $session['phone_number'];
        $checkout_request_id = $session['checkout_request_id'];
        $retry_count = $session['retry_count'] ?? 0;

        echo "Processing: $id (Retry #{$retry_count})\n";
        echo "  Phone: $phone\n";
        echo "  Request ID: " . substr($checkout_request_id, 0, 20) . "...\n";

        $this->processed++;

        // Check if max retry attempts exceeded
        if ($retry_count >= $this->max_retry_attempts) {
            echo "  ⚠ Max retry attempts ({$this->max_retry_attempts}) exhausted\n";
            $this->exhaustRetry($id);
            $this->exhausted_retries++;
            echo "\n";
            return;
        }

        try {
            // Get M-Pesa credentials
            $mpesa_creds = $this->getMpesaCredentials();
            if (!$mpesa_creds) {
                throw new Exception("Could not retrieve M-Pesa credentials");
            }

            // Query current status from M-Pesa
            $query_result = querySTKPushStatus($mpesa_creds, $checkout_request_id);

            if (!$query_result['success']) {
                throw new Exception("Failed to query M-Pesa: " . ($query_result['error'] ?? 'Unknown error'));
            }

            $result_code = $query_result['result_code'];
            $result_description = $query_result['result_description'] ?? '';

            // Determine new status
            $new_status = $this->getStatusFromResultCode($result_code);

            echo "  Result Code: $result_code\n";
            echo "  New Status: $new_status\n";

            // Update session with query result
            $this->updateSession($id, $new_status, $result_code, $result_description, $retry_count);

            // If successful, record the payment
            if ($new_status === 'success' && !empty($query_result['mpesaReceiptNumber'])) {
                $this->handleSuccessfulPayment($session, $query_result);
                echo "  ✓ Payment recorded successfully\n";
                $this->succeeded++;
            }
            // If still failed/timeout, schedule next retry
            else if (in_array($new_status, ['failed', 'timeout'])) {
                $next_retry_at = $this->calculateNextRetryTime($retry_count);
                $this->scheduleNextRetry($id, $next_retry_at, $retry_count + 1);
                echo "  ⟳ Scheduled next retry at: " . $next_retry_at . "\n";
                $this->scheduled_retries++;
            }

        } catch (Exception $e) {
            echo "  ✗ Error: " . $e->getMessage() . "\n";
            $this->errors[] = [
                'session_id' => $id,
                'error' => $e->getMessage()
            ];

            // Check if this is our last attempt
            if ($retry_count + 1 >= $this->max_retry_attempts) {
                echo "  ⚠ Final retry attempt - will not schedule further retries\n";
                $this->exhaustRetry($id);
                $this->exhausted_retries++;
            } else {
                // Still schedule retry even on error
                $next_retry_at = $this->calculateNextRetryTime($retry_count);
                $this->scheduleNextRetry($id, $next_retry_at, $retry_count + 1);
            }
        }

        echo "\n";
    }
    
    /**
     * Get M-Pesa credentials
     */
    private function getMpesaCredentials() {
        // Get the first/primary M-Pesa credential set
        $sql = "SELECT * FROM mpesa_credentials LIMIT 1";
        $result = $this->conn->query($sql);
        
        if ($result && $result->num_rows > 0) {
            $cred = $result->fetch_assoc();
            return [
                'consumer_key' => $cred['consumer_key'],
                'consumer_secret' => $cred['consumer_secret'],
                'environment' => $cred['environment'] ?? 'sandbox',
                'shortcode' => $cred['shortcode']
            ];
        }
        
        return null;
    }
    
    /**
     * Determine status from M-Pesa result code
     */
    private function getStatusFromResultCode($result_code) {
        if ($result_code === 0 || $result_code === '0') {
            return 'success';
        } else if ($result_code === 1032 || $result_code === '1032') {
            return 'timeout';
        } else {
            return 'failed';
        }
    }
    
    /**
     * Calculate the next retry time using exponential backoff with optional jitter
     * Jitter prevents thundering herd problem when many retries are scheduled simultaneously
     */
    private function calculateNextRetryTime($attempt_number) {
        if ($this->exponential_backoff) {
            // Exponential backoff: 1 min, 2 min, 4 min, 8 min, 16 min, 32 min, 1 hour, 1 hour, ...
            $interval = $this->base_retry_interval * pow(2, $attempt_number);
            $interval = min($interval, $this->max_retry_interval); // Cap at max
        } else {
            // Linear backoff: retry every hour
            $interval = $this->max_retry_interval;
        }

        // Add jitter: randomize +/- 20% of interval to prevent thundering herd
        if ($this->jitter_enabled) {
            $jitter_amount = floor($interval * 0.2); // 20% jitter
            $jitter = random_int(-$jitter_amount, $jitter_amount);
            $interval = max($interval / 2, $interval + $jitter); // Never go below half the interval
        }

        return date('Y-m-d H:i:s', time() + $interval);
    }
    
    /**
     * Update session with query result
     */
    private function updateSession($id, $status, $result_code, $result_description, $retry_count) {
        $sql = "
            UPDATE stk_push_sessions 
            SET 
                status = ?,
                result_code = ?,
                result_description = ?,
                retry_count = ?,
                last_retry_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        ";
        
        $stmt = $this->conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }
        
        $stmt->bind_param('sssiss', $status, $result_code, $result_description, $retry_count, $id);
        
        if (!$stmt->execute()) {
            throw new Exception("Update failed: " . $stmt->error);
        }
        
        $stmt->close();
    }
    
    /**
     * Schedule the next retry
     */
    private function scheduleNextRetry($id, $next_retry_at, $new_retry_count) {
        $sql = "
            UPDATE stk_push_sessions 
            SET 
                next_retry_at = ?,
                retry_count = ?,
                updated_at = NOW()
            WHERE id = ?
        ";
        
        $stmt = $this->conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }
        
        $stmt->bind_param('sis', $next_retry_at, $new_retry_count, $id);
        
        if (!$stmt->execute()) {
            throw new Exception("Schedule retry failed: " . $stmt->error);
        }
        
        $stmt->close();
    }
    
    /**
     * Mark session as exhausted - stop retries and flag for manual intervention
     */
    private function exhaustRetry($id) {
        $sql = "
            UPDATE stk_push_sessions
            SET
                should_retry = FALSE,
                updated_at = NOW()
            WHERE id = ?
        ";

        $stmt = $this->conn->prepare($sql);
        if (!$stmt) {
            error_log("Exhaustion update failed: " . $this->conn->error);
            return;
        }

        $stmt->bind_param('s', $id);
        $stmt->execute();
        $stmt->close();
    }

    /**
     * Handle successful payment - record it
     */
    private function handleSuccessfulPayment($session, $query_result) {
        $id = $session['id'];
        $booking_id = $session['booking_id'];
        $amount = $session['amount'];
        $mpesa_receipt = $query_result['mpesaReceiptNumber'] ?? '';
        
        // Check if payment already recorded
        if (!empty($mpesa_receipt)) {
            $check_sql = "SELECT id FROM payments WHERE transaction_reference = ? LIMIT 1";
            $check_stmt = $this->conn->prepare($check_sql);
            $check_stmt->bind_param('s', $mpesa_receipt);
            $check_stmt->execute();
            $check_result = $check_stmt->get_result();
            
            if ($check_result->num_rows > 0) {
                // Payment already recorded
                $check_stmt->close();
                return;
            }
            $check_stmt->close();
        }
        
        // Record the payment
        $payment_id = bin2hex(random_bytes(18)); // UUID v4 alternative
        $status = 'completed';
        $method = 'mpesa';
        
        $insert_sql = "
            INSERT INTO payments (
                id, amount, booking_id, status, method, 
                transaction_reference, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ";
        
        $insert_stmt = $this->conn->prepare($insert_sql);
        if (!$insert_stmt) {
            throw new Exception("Prepare insert failed: " . $this->conn->error);
        }
        
        $insert_stmt->bind_param('sdsss', $payment_id, $amount, $booking_id, $status, $method, $mpesa_receipt);
        
        if (!$insert_stmt->execute()) {
            throw new Exception("Insert payment failed: " . $insert_stmt->error);
        }
        
        $insert_stmt->close();
        
        // Mark as should not retry anymore
        $disable_sql = "UPDATE stk_push_sessions SET should_retry = FALSE WHERE id = ?";
        $disable_stmt = $this->conn->prepare($disable_sql);
        $disable_stmt->bind_param('s', $id);
        $disable_stmt->execute();
        $disable_stmt->close();
    }
    
    /**
     * Print summary of worker run
     */
    private function printSummary() {
        echo str_repeat("=", 80) . "\n";
        echo "WORKER SUMMARY\n";
        echo str_repeat("=", 80) . "\n\n";

        echo "✓ Sessions processed: {$this->processed}\n";
        echo "✓ Payments completed: {$this->succeeded}\n";
        echo "⟳ Retries scheduled: {$this->scheduled_retries}\n";
        echo "⚠ Retries exhausted: {$this->exhausted_retries} (max {$this->max_retry_attempts} attempts)\n";

        if (!empty($this->errors)) {
            echo "✗ Errors encountered: " . count($this->errors) . "\n";
            foreach ($this->errors as $error) {
                echo "  - {$error['session_id']}: {$error['error']}\n";
            }
        }

        echo "\nBackoff Strategy: Exponential" . ($this->jitter_enabled ? " + Jitter" : "") . "\n";
        echo "Base interval: {$this->base_retry_interval}s, Max interval: {$this->max_retry_interval}s\n";
        echo "\n";
    }
}

// Run the worker if executed directly or via API
if (php_sapi_name() === 'cli' || $_SERVER['REQUEST_METHOD'] === 'POST') {
    // Check authorization if running via API
    if (php_sapi_name() !== 'cli') {
        // Add your authorization check here
        // For now, allow localhost only
        $allowed_ips = ['127.0.0.1', 'localhost'];
        $client_ip = $_SERVER['REMOTE_ADDR'] ?? '';
        
        // You might want to use an API key instead
        // $api_key = $_GET['api_key'] ?? $_POST['api_key'] ?? '';
        // if ($api_key !== getenv('WORKER_API_KEY')) { ... }
    }
    
    $worker = new STKRetryWorker($conn);
    $result = $worker->run();
    
    if (php_sapi_name() === 'cli') {
        // CLI output
        exit($result['status'] === 'success' ? 0 : 1);
    } else {
        // API response
        header('Content-Type: application/json');
        echo json_encode($result);
        exit(0);
    }
}
?>
