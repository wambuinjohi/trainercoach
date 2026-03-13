<?php
/**
 * Migration: Fix verification_documents foreign key constraint
 * Changes trainer_id foreign key from trainer_profiles(id) to users(id)
 * 
 * Run this script once to update your database schema
 */

require_once __DIR__ . '/../connection.php';

if (!$conn) {
    die("Database connection failed: " . mysqli_connect_error());
}

echo "[Migration] Starting verification_documents foreign key fix...\n";

try {
    // Step 1: Drop the old foreign key constraint
    echo "[Migration] Step 1: Dropping old foreign key constraint...\n";
    $dropFKSQL = "ALTER TABLE `verification_documents` DROP FOREIGN KEY `verification_documents_ibfk_1`";
    
    if ($conn->query($dropFKSQL)) {
        echo "[Migration] ✓ Old foreign key dropped successfully\n";
    } else {
        // FK might have different name, let's check
        $error = $conn->error;
        if (strpos($error, 'check that column/key exists') !== false) {
            echo "[Migration] ! Constraint not found (may have already been fixed). Continuing...\n";
        } else {
            throw new Exception("Failed to drop foreign key: " . $error);
        }
    }

    // Step 2: Add the new foreign key constraint
    echo "[Migration] Step 2: Adding new foreign key constraint...\n";
    $addFKSQL = "ALTER TABLE `verification_documents` ADD CONSTRAINT `verification_documents_ibfk_1` FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE";
    
    if ($conn->query($addFKSQL)) {
        echo "[Migration] ✓ New foreign key added successfully\n";
    } else {
        throw new Exception("Failed to add foreign key: " . $conn->error);
    }

    // Step 3: Verify the constraint
    echo "[Migration] Step 3: Verifying constraint...\n";
    $verifySQL = "SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
                   FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                   WHERE TABLE_NAME = 'verification_documents' AND COLUMN_NAME = 'trainer_id'";
    
    $result = $conn->query($verifySQL);
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        echo "[Migration] ✓ Constraint verified:\n";
        echo "   - Constraint: " . $row['CONSTRAINT_NAME'] . "\n";
        echo "   - Table: " . $row['TABLE_NAME'] . "\n";
        echo "   - Column: " . $row['COLUMN_NAME'] . "\n";
        echo "   - References: " . $row['REFERENCED_TABLE_NAME'] . "(" . $row['REFERENCED_COLUMN_NAME'] . ")\n";
    } else {
        throw new Exception("Failed to verify constraint");
    }

    echo "\n[Migration] ✓ Migration completed successfully!\n";
    echo "[Migration] verification_documents table now correctly references users(id)\n";

} catch (Exception $e) {
    echo "\n[Migration] ✗ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}

$conn->close();
?>
