<?php
/**
 * Migration: Create verification_documents table
 * Usage: php scripts/migrate_verification_documents_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `verification_documents` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `trainer_id` VARCHAR(36) NOT NULL,
  `document_type` VARCHAR(50) NOT NULL,
  `file_url` VARCHAR(500),
  `file_path` VARCHAR(500),
  `status` VARCHAR(50) DEFAULT 'pending',
  `rejection_reason` TEXT,
  `id_number` VARCHAR(50),
  `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME,
  `reviewed_by` VARCHAR(36),
  `expires_at` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_trainer_id (trainer_id),
  INDEX idx_document_type (document_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: verification_documents table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
