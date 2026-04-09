<?php
/**
 * Waiting List Migration Script
 * Creates the waiting_list table for Trainer app launch waitlist
 * 
 * Run this script to initialize the waiting list database table
 * Usage: php scripts/migrate_waiting_list_table.php
 */

// Include database connection
require_once(__DIR__ . '/../connection.php');

if (!$conn) {
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed"
    ]);
    exit;
}

// Create waiting_list table
$sql = "
    CREATE TABLE IF NOT EXISTS `waiting_list` (
        `id` VARCHAR(36) PRIMARY KEY,
        `name` VARCHAR(255) NOT NULL,
        `email` VARCHAR(255) NOT NULL UNIQUE,
        `telephone` VARCHAR(20) NOT NULL,
        `is_coach` BOOLEAN DEFAULT FALSE,
        `status` VARCHAR(50) DEFAULT 'pending',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_is_coach (is_coach),
        INDEX idx_created_at (created_at),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo json_encode([
        "status" => "success",
        "message" => "Waiting list table created successfully",
        "table" => "waiting_list",
        "columns" => [
            "id" => "VARCHAR(36) PRIMARY KEY",
            "name" => "VARCHAR(255) NOT NULL",
            "email" => "VARCHAR(255) NOT NULL UNIQUE",
            "telephone" => "VARCHAR(20) NOT NULL",
            "is_coach" => "BOOLEAN DEFAULT FALSE",
            "status" => "VARCHAR(50) DEFAULT 'pending'",
            "created_at" => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "updated_at" => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ]
    ]);
} else {
    echo json_encode([
        "status" => "error",
        "message" => "Failed to create waiting list table: " . $conn->error
    ]);
    exit(1);
}
?>
