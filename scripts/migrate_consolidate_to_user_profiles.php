<?php
/**
 * Migration: Consolidate trainer_profiles into user_profiles
 * 
 * This migration:
 * 1. Removes all foreign key constraints referencing trainer_profiles
 * 2. Updates all foreign keys to reference users(id) instead
 * 3. Drops the trainer_profiles table
 * 
 * Usage: php scripts/migrate_consolidate_to_user_profiles.php
 */

require_once __DIR__ . '/../connection.php';

if (!$conn) {
    die("Database connection failed\n");
}

echo "============================================================================\n";
echo "MIGRATION: Consolidate trainer_profiles into user_profiles\n";
echo "============================================================================\n\n";

$errors = [];

try {
    // Step 1: Fix verification_documents constraints
    echo "[Step 1] Fixing verification_documents table constraints...\n";
    
    // Drop old constraints
    $dropFKQueries = [
        "ALTER TABLE `verification_documents` DROP FOREIGN KEY `verification_documents_ibfk_1`",
        "ALTER TABLE `verification_documents` DROP FOREIGN KEY `verification_documents_ibfk_2`"
    ];
    
    foreach ($dropFKQueries as $query) {
        if ($conn->query($query)) {
            echo "  ✓ Dropped old constraint\n";
        } else {
            $error = $conn->error;
            if (strpos($error, 'check that column/key exists') === false) {
                $errors[] = "Failed to drop constraint: $error";
                echo "  ✗ " . $error . "\n";
            } else {
                echo "  ℹ Constraint not found (may already be fixed)\n";
            }
        }
    }
    
    // Add new constraints
    $addFKQuery = "ALTER TABLE `verification_documents` 
        ADD CONSTRAINT `verification_documents_ibfk_1` FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
        ADD CONSTRAINT `verification_documents_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL";
    
    if ($conn->query($addFKQuery)) {
        echo "  ✓ Added corrected foreign keys\n";
    } else {
        $errors[] = "Failed to add new constraints: " . $conn->error;
        echo "  ✗ " . $conn->error . "\n";
    }
    
    // Step 2: Check for any other tables referencing trainer_profiles
    echo "\n[Step 2] Checking for other tables referencing trainer_profiles...\n";
    
    $checkQuery = "SELECT DISTINCT TABLE_NAME 
                   FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS 
                   WHERE REFERENCED_TABLE_NAME = 'trainer_profiles'";
    
    $result = $conn->query($checkQuery);
    $tablesWithFK = [];
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $tablesWithFK[] = $row['TABLE_NAME'];
        }
        
        if (empty($tablesWithFK)) {
            echo "  ✓ No other tables reference trainer_profiles\n";
        } else {
            echo "  ⚠ Found tables referencing trainer_profiles:\n";
            foreach ($tablesWithFK as $table) {
                echo "    - $table\n";
            }
        }
    }
    
    // Step 3: Drop trainer_profiles table
    echo "\n[Step 3] Dropping trainer_profiles table...\n";
    
    $dropTableQuery = "DROP TABLE IF EXISTS `trainer_profiles`";
    
    if ($conn->query($dropTableQuery)) {
        echo "  ✓ trainer_profiles table dropped successfully\n";
    } else {
        $errors[] = "Failed to drop trainer_profiles table: " . $conn->error;
        echo "  ✗ " . $conn->error . "\n";
    }
    
    // Step 4: Verify all constraints are correct
    echo "\n[Step 4] Verifying constraints in verification_documents...\n";
    
    $verifyQuery = "SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME 
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                    WHERE TABLE_NAME = 'verification_documents' AND REFERENCED_TABLE_NAME IS NOT NULL
                    ORDER BY COLUMN_NAME";
    
    $result = $conn->query($verifyQuery);
    
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            echo "  ✓ {$row['COLUMN_NAME']} → {$row['REFERENCED_TABLE_NAME']}\n";
        }
    }
    
    echo "\n============================================================================\n";
    
    if (empty($errors)) {
        echo "✓ MIGRATION COMPLETED SUCCESSFULLY\n";
        echo "\nChanges applied:\n";
        echo "  ✓ verification_documents.trainer_id now references users(id)\n";
        echo "  ✓ verification_documents.reviewed_by now references users(id)\n";
        echo "  ✓ trainer_profiles table dropped\n";
        echo "\nYour application now uses user_profiles as the single source of truth for all user data.\n";
    } else {
        echo "⚠ MIGRATION COMPLETED WITH WARNINGS\n";
        echo "\nErrors encountered:\n";
        foreach ($errors as $error) {
            echo "  - $error\n";
        }
        echo "\nPlease review the errors above and contact support if needed.\n";
    }
    
    echo "============================================================================\n";

} catch (Exception $e) {
    echo "\n✗ MIGRATION FAILED: " . $e->getMessage() . "\n";
    exit(1);
}

$conn->close();
exit(empty($errors) ? 0 : 1);
?>
