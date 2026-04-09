<?php
/**
 * Migration: Add missing columns to messages and notifications tables
 * 
 * This script adds the following columns:
 * - messages table: sender_id, recipient_id
 * - notifications table: message
 * 
 * Usage: php scripts/migrate_messaging_schema.php
 */

require_once(__DIR__ . '/../connection.php');

$errors = [];
$successes = [];

// ============================================================================
// 1. ADD sender_id AND recipient_id TO messages TABLE
// ============================================================================

echo "Adding sender_id and recipient_id columns to messages table...\n";

$checkSenderId = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME='messages' AND COLUMN_NAME='sender_id' AND TABLE_SCHEMA=DATABASE()";
$result = $conn->query($checkSenderId);

if ($result && $result->num_rows === 0) {
    $sql = "ALTER TABLE `messages` 
            ADD COLUMN `sender_id` VARCHAR(36) COMMENT 'User who sent the message' AFTER `id`,
            ADD CONSTRAINT `fk_messages_sender_id`
                FOREIGN KEY (`sender_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE";
    
    if ($conn->query($sql)) {
        $successes[] = "✓ Added sender_id column to messages table";
    } else {
        $errors[] = "✗ Failed to add sender_id: " . $conn->error;
    }
} else {
    $successes[] = "✓ sender_id column already exists in messages table";
}

$checkRecipientId = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME='messages' AND COLUMN_NAME='recipient_id' AND TABLE_SCHEMA=DATABASE()";
$result = $conn->query($checkRecipientId);

if ($result && $result->num_rows === 0) {
    $sql = "ALTER TABLE `messages` 
            ADD COLUMN `recipient_id` VARCHAR(36) COMMENT 'User who receives the message' AFTER `sender_id`,
            ADD CONSTRAINT `fk_messages_recipient_id`
                FOREIGN KEY (`recipient_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE";
    
    if ($conn->query($sql)) {
        $successes[] = "✓ Added recipient_id column to messages table";
    } else {
        $errors[] = "✗ Failed to add recipient_id: " . $conn->error;
    }
} else {
    $successes[] = "✓ recipient_id column already exists in messages table";
}

// Add indexes for sender_id and recipient_id if they don't exist
$checkSenderIndex = "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_NAME='messages' AND COLUMN_NAME='sender_id' AND TABLE_SCHEMA=DATABASE()";
$result = $conn->query($checkSenderIndex);

if ($result && $result->num_rows === 0) {
    $sql = "ALTER TABLE `messages` ADD INDEX `idx_sender_id` (`sender_id`)";
    if ($conn->query($sql)) {
        $successes[] = "✓ Added idx_sender_id index to messages table";
    } else {
        // Index might already exist with a different name, not critical
        $successes[] = "ℹ idx_sender_id index already exists or skipped";
    }
}

$checkRecipientIndex = "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_NAME='messages' AND COLUMN_NAME='recipient_id' AND TABLE_SCHEMA=DATABASE()";
$result = $conn->query($checkRecipientIndex);

if ($result && $result->num_rows === 0) {
    $sql = "ALTER TABLE `messages` ADD INDEX `idx_recipient_id` (`recipient_id`)";
    if ($conn->query($sql)) {
        $successes[] = "✓ Added idx_recipient_id index to messages table";
    } else {
        // Index might already exist, not critical
        $successes[] = "ℹ idx_recipient_id index already exists or skipped";
    }
}

// ============================================================================
// 2. ADD message COLUMN TO notifications TABLE
// ============================================================================

echo "\nAdding message column to notifications table...\n";

$checkMessage = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME='notifications' AND COLUMN_NAME='message' AND TABLE_SCHEMA=DATABASE()";
$result = $conn->query($checkMessage);

if ($result && $result->num_rows === 0) {
    $sql = "ALTER TABLE `notifications` 
            ADD COLUMN `message` TEXT COMMENT 'Notification message (alternative field)' AFTER `body`";
    
    if ($conn->query($sql)) {
        $successes[] = "✓ Added message column to notifications table";
    } else {
        $errors[] = "✗ Failed to add message column: " . $conn->error;
    }
} else {
    $successes[] = "✓ message column already exists in notifications table";
}

// ============================================================================
// SUMMARY
// ============================================================================

echo "\n" . str_repeat("=", 70) . "\n";
echo "MIGRATION SUMMARY\n";
echo str_repeat("=", 70) . "\n\n";

foreach ($successes as $msg) {
    echo $msg . "\n";
}

if (!empty($errors)) {
    echo "\nErrors encountered:\n";
    foreach ($errors as $msg) {
        echo $msg . "\n";
    }
    exit(1);
} else {
    echo "\n✓ Migration completed successfully!\n";
    exit(0);
}
?>
