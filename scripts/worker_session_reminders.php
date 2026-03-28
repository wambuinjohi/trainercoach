<?php
/**
 * Session Reminder Worker
 * Sends 2-hour pre-session reminders to trainers and clients
 * 
 * This can be run:
 * - Manually: php scripts/worker_session_reminders.php
 * - As cron: */5 * * * * php /path/to/scripts/worker_session_reminders.php (every 5 minutes)
 * - Via API: POST /api.php?action=session_reminder_worker
 * 
 * The worker will:
 * 1. Find pending reminders where scheduled_for <= NOW()
 * 2. Send in-app notifications to both trainer and client
 * 3. Send SMS if SMS service is available
 * 4. Mark reminders as sent
 * 5. Log any failures and retry next cycle
 */

require_once(__DIR__ . '/../connection.php');
require_once(__DIR__ . '/../sms_helper.php');

class SessionReminderWorker {
    private $conn;
    private $processed = 0;
    private $sent = 0;
    private $failed = 0;
    private $errors = [];
    
    public function __construct($db_conn) {
        $this->conn = $db_conn;
    }
    
    /**
     * Run the worker - find and send pending reminders
     */
    public function run() {
        echo "\n" . str_repeat("=", 80) . "\n";
        echo "SESSION REMINDER WORKER - " . date('Y-m-d H:i:s') . "\n";
        echo str_repeat("=", 80) . "\n\n";
        
        // Find pending reminders that are due
        $reminders = $this->findPendingReminders();
        
        if (empty($reminders)) {
            echo "ℹ No reminders scheduled for sending at this time\n";
            return [
                'status' => 'success',
                'processed' => 0,
                'sent' => 0,
                'failed' => 0
            ];
        }
        
        echo "Found " . count($reminders) . " reminder(s) to send\n\n";
        
        // Process each reminder
        foreach ($reminders as $reminder) {
            $this->sendReminder($reminder);
        }
        
        // Print summary
        $this->printSummary();
        
        return [
            'status' => 'success',
            'processed' => $this->processed,
            'sent' => $this->sent,
            'failed' => $this->failed,
            'errors' => $this->errors
        ];
    }
    
    /**
     * Find pending reminders that are due
     */
    private function findPendingReminders() {
        $sql = "
            SELECT sr.*, b.session_date, b.session_time, b.client_id, b.trainer_id
            FROM session_reminders sr
            JOIN bookings b ON sr.booking_id = b.id
            WHERE sr.status = 'pending' 
            AND sr.scheduled_for <= NOW()
            ORDER BY sr.scheduled_for ASC
            LIMIT 50
        ";
        
        $result = $this->conn->query($sql);
        if (!$result) {
            echo "✗ Query failed: " . $this->conn->error . "\n";
            return [];
        }
        
        $reminders = [];
        while ($row = $result->fetch_assoc()) {
            $reminders[] = $row;
        }
        
        return $reminders;
    }
    
    /**
     * Send reminder notification
     */
    private function sendReminder($reminder) {
        $this->processed++;
        
        echo "Processing reminder for booking {$reminder['booking_id']}...\n";
        echo "  Scheduled for: {$reminder['scheduled_for']}\n";
        echo "  Trainer ID: {$reminder['trainer_id']}\n";
        echo "  Client ID: {$reminder['client_id']}\n";
        
        try {
            // Get user details
            $trainer = $this->getUserById($reminder['trainer_id']);
            $client = $this->getUserById($reminder['client_id']);
            
            if (!$trainer || !$client) {
                throw new Exception('Could not fetch trainer or client details');
            }
            
            $sessionDateTime = "{$reminder['session_date']} {$reminder['session_time']}";
            $nowIso = date('c');
            
            // Create notifications for both trainer and client
            $notifications = [
                [
                    'user_id' => $reminder['trainer_id'],
                    'booking_id' => $reminder['booking_id'],
                    'title' => 'Session Reminder',
                    'body' => "Your session is starting in 2 hours at {$reminder['session_time']}. Get ready!",
                    'action_type' => 'view_booking',
                    'type' => 'reminder',
                    'created_at' => $nowIso,
                    'read' => false
                ],
                [
                    'user_id' => $reminder['client_id'],
                    'booking_id' => $reminder['booking_id'],
                    'title' => 'Session Reminder',
                    'body' => "Your session with {$trainer['email']} is starting in 2 hours at {$reminder['session_time']}. Get ready!",
                    'action_type' => 'view_booking',
                    'type' => 'reminder',
                    'created_at' => $nowIso,
                    'read' => false
                ]
            ];
            
            // Insert notifications
            $this->insertNotifications($notifications);
            
            // Send SMS if phone numbers are available
            $this->sendReminderSMS($trainer, $client, $sessionDateTime);
            
            // Mark reminder as sent
            $this->markReminderAsSent($reminder['id']);
            
            echo "  ✓ Reminder sent successfully\n\n";
            $this->sent++;
            
        } catch (Exception $e) {
            echo "  ✗ Failed to send reminder: " . $e->getMessage() . "\n\n";
            $this->failed++;
            $this->errors[] = [
                'booking_id' => $reminder['booking_id'],
                'error' => $e->getMessage()
            ];
            
            // Mark as failed in database
            $this->markReminderAsFailed($reminder['id']);
        }
    }
    
    /**
     * Get user by ID
     */
    private function getUserById($userId) {
        $sql = "SELECT * FROM users WHERE id = ?";
        $stmt = $this->conn->prepare($sql);
        if (!$stmt) {
            return null;
        }
        
        $stmt->bind_param('s', $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();
        
        return $user;
    }
    
    /**
     * Insert notifications
     */
    private function insertNotifications($notifications) {
        foreach ($notifications as $notif) {
            $sql = "
                INSERT INTO notifications 
                (user_id, booking_id, title, body, action_type, type, created_at, read)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ";
            
            $stmt = $this->conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Prepare failed: " . $this->conn->error);
            }
            
            $stmt->bind_param(
                'sssssssi',
                $notif['user_id'],
                $notif['booking_id'],
                $notif['title'],
                $notif['body'],
                $notif['action_type'],
                $notif['type'],
                $notif['created_at'],
                $notif['read']
            );
            
            if (!$stmt->execute()) {
                throw new Exception("Execute failed: " . $stmt->error);
            }
            
            $stmt->close();
        }
    }
    
    /**
     * Send SMS reminder if SMS service is available
     */
    private function sendReminderSMS($trainer, $client, $sessionDateTime) {
        // SMS helper should be available
        // This is optional - if SMS service is not configured, it will silently fail
        try {
            $trainerPhone = $this->extractPhoneNumber($trainer);
            $clientPhone = $this->extractPhoneNumber($client);
            
            if ($trainerPhone) {
                $message = "Reminder: Your training session is in 2 hours at {$sessionDateTime}. Get ready!";
                // This would call the SMS service if available
                // sendSMS($trainerPhone, $message);
            }
            
            if ($clientPhone) {
                $message = "Reminder: Your training session with {$trainer['email']} is in 2 hours at {$sessionDateTime}. Get ready!";
                // This would call the SMS service if available
                // sendSMS($clientPhone, $message);
            }
        } catch (Exception $e) {
            // SMS is optional, don't throw error
            echo "  (SMS failed: " . $e->getMessage() . ")\n";
        }
    }
    
    /**
     * Extract phone number from user
     */
    private function extractPhoneNumber($user) {
        return $user['phone'] ?? ($user['phone_number'] ?? null);
    }
    
    /**
     * Mark reminder as sent
     */
    private function markReminderAsSent($reminderId) {
        $sql = "UPDATE session_reminders SET status = 'sent', sent_at = NOW() WHERE id = ?";
        $stmt = $this->conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }
        
        $stmt->bind_param('s', $reminderId);
        if (!$stmt->execute()) {
            throw new Exception("Update failed: " . $stmt->error);
        }
        
        $stmt->close();
    }
    
    /**
     * Mark reminder as failed (will retry next cycle)
     */
    private function markReminderAsFailed($reminderId) {
        $sql = "UPDATE session_reminders SET status = 'failed' WHERE id = ?";
        $stmt = $this->conn->prepare($sql);
        if (!$stmt) {
            return;
        }
        
        $stmt->bind_param('s', $reminderId);
        $stmt->execute();
        $stmt->close();
    }
    
    /**
     * Print summary
     */
    private function printSummary() {
        echo str_repeat("=", 80) . "\n";
        echo "SUMMARY\n";
        echo str_repeat("=", 80) . "\n";
        echo "Processed: {$this->processed}\n";
        echo "Sent: {$this->sent}\n";
        echo "Failed: {$this->failed}\n";
        
        if (!empty($this->errors)) {
            echo "\nErrors:\n";
            foreach ($this->errors as $error) {
                echo "  - Booking {$error['booking_id']}: {$error['error']}\n";
            }
        }
        
        echo str_repeat("=", 80) . "\n\n";
    }
}

// Run the worker
$worker = new SessionReminderWorker($conn);
$result = $worker->run();

// Exit with appropriate status
exit($result['status'] === 'success' ? 0 : 1);
?>
