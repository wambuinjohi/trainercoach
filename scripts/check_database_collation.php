<?php
/**
 * Database Collation Consistency Checker
 * 
 * This script identifies and fixes collation mismatches across all tables.
 * All tables should use utf8mb4_unicode_ci for consistency.
 */

require_once(__DIR__ . '/../connection.php');

echo "\n" . str_repeat("=", 70) . "\n";
echo "DATABASE COLLATION CONSISTENCY CHECK\n";
echo str_repeat("=", 70) . "\n\n";

try {
    $databaseName = getenv('DB_NAME') ?: 'skatrykc_trainer';
    
    // Get current database collation
    $dbCollationSql = "SELECT DEFAULT_COLLATION_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?";
    $stmt = $conn->prepare($dbCollationSql);
    $stmt->bind_param("s", $databaseName);
    $stmt->execute();
    $dbResult = $stmt->get_result();
    $dbRow = $dbResult->fetch_assoc();
    $dbCollation = $dbRow['DEFAULT_COLLATION_NAME'] ?? 'unknown';
    $stmt->close();
    
    echo "Database: $databaseName\n";
    echo "Default Collation: $dbCollation\n\n";
    
    // Get all tables and their collations
    $tablesSql = "SELECT TABLE_NAME, TABLE_COLLATION 
                  FROM INFORMATION_SCHEMA.TABLES 
                  WHERE TABLE_SCHEMA = ?
                  ORDER BY TABLE_NAME";
    
    $stmt = $conn->prepare($tablesSql);
    $stmt->bind_param("s", $databaseName);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();
    
    $tables = [];
    $collations = [];
    
    echo "TABLE COLLATIONS:\n";
    echo str_repeat("-", 70) . "\n";
    echo sprintf("%-40s | %-25s\n", "TABLE NAME", "COLLATION");
    echo str_repeat("-", 70) . "\n";
    
    while ($row = $result->fetch_assoc()) {
        $tables[] = $row['TABLE_NAME'];
        $collations[$row['TABLE_NAME']] = $row['TABLE_COLLATION'];
        echo sprintf("%-40s | %-25s\n", $row['TABLE_NAME'], $row['TABLE_COLLATION']);
    }
    
    echo str_repeat("-", 70) . "\n\n";
    
    // Check for inconsistencies
    $expectedCollation = 'utf8mb4_unicode_ci';
    $mismatched = [];
    
    foreach ($collations as $tableName => $collation) {
        if ($collation !== $expectedCollation) {
            $mismatched[$tableName] = $collation;
        }
    }
    
    if (empty($mismatched)) {
        echo "✓ All tables have consistent collation: $expectedCollation\n\n";
    } else {
        echo "⚠ Found " . count($mismatched) . " table(s) with mismatched collation:\n";
        echo str_repeat("-", 70) . "\n";
        
        foreach ($mismatched as $tableName => $collation) {
            echo "  • $tableName (currently: $collation)\n";
        }
        
        echo "\n" . str_repeat("=", 70) . "\n";
        echo "FIX SQL - Execute the following to standardize all tables:\n";
        echo str_repeat("=", 70) . "\n\n";
        
        // Generate fix SQL
        foreach ($tables as $tableName) {
            echo "ALTER TABLE `$tableName` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n";
        }
        
        echo "\n";
    }
    
    // Check for column-level collation issues
    echo str_repeat("=", 70) . "\n";
    echo "CHECKING FOR COLUMN-LEVEL COLLATION ISSUES\n";
    echo str_repeat("=", 70) . "\n\n";
    
    $columnCollationSql = "SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME 
                           FROM INFORMATION_SCHEMA.COLUMNS 
                           WHERE TABLE_SCHEMA = ? 
                           AND COLLATION_NAME IS NOT NULL
                           AND COLLATION_NAME != ?
                           ORDER BY TABLE_NAME, COLUMN_NAME";
    
    $stmt = $conn->prepare($columnCollationSql);
    $stmt->bind_param("ss", $databaseName, $expectedCollation);
    $stmt->execute();
    $colResult = $stmt->get_result();
    $stmt->close();
    
    $columnMismatches = 0;
    while ($row = $colResult->fetch_assoc()) {
        echo "  • {$row['TABLE_NAME']}.{$row['COLUMN_NAME']} ({$row['COLLATION_NAME']})\n";
        $columnMismatches++;
    }
    
    if ($columnMismatches === 0) {
        echo "✓ All columns have the expected collation\n\n";
    } else {
        echo "\n⚠ Found $columnMismatches column(s) with mismatched collation\n";
        echo "They will be fixed automatically when you run the table conversion SQL above.\n\n";
    }
    
    echo str_repeat("=", 70) . "\n";
    echo "SUMMARY\n";
    echo str_repeat("=", 70) . "\n";
    echo "Total tables: " . count($tables) . "\n";
    echo "Mismatched tables: " . count($mismatched) . "\n";
    echo "Mismatched columns: " . $columnMismatches . "\n\n";
    
    if (empty($mismatched) && $columnMismatches === 0) {
        echo "✓ Database is consistent!\n";
    } else {
        echo "⚠ Database has inconsistencies. Copy the SQL above and run it to fix.\n";
    }
    
    echo "\n" . str_repeat("=", 70) . "\n\n";
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}

$conn->close();
?>
