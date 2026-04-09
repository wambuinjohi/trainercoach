<?php
// ============================================================================
// Missing Tables Migration Runner
// Applies scripts/fix_missing_tables.sql to create missing tables
// ============================================================================

// Get the database connection
require_once __DIR__ . '/../connection.php';

echo "========================================\n";
echo "CLIENT PORTAL AUDIT: Fix Missing Tables\n";
echo "========================================\n\n";

// Read the SQL migration file
$sqlFile = __DIR__ . '/fix_missing_tables.sql';

if (!file_exists($sqlFile)) {
    die("Error: Migration file not found at $sqlFile\n");
}

$sqlContent = file_get_contents($sqlFile);

if ($sqlContent === false) {
    die("Error: Could not read migration file\n");
}

// Split SQL statements by semicolon
$statements = array_filter(
    array_map('trim', explode(';', $sqlContent)),
    fn($stmt) => !empty($stmt) && !str_starts_with($stmt, '--')
);

echo "Found " . count($statements) . " SQL statements to execute\n\n";

$successCount = 0;
$failureCount = 0;
$errors = [];

foreach ($statements as $index => $statement) {
    // Skip comments and empty statements
    $statement = trim($statement);
    if (empty($statement) || str_starts_with($statement, '--')) {
        continue;
    }

    echo "Executing statement " . ($successCount + $failureCount + 1) . "...\n";

    if ($conn->query($statement)) {
        $successCount++;
        echo "  ✓ Success\n";
    } else {
        $failureCount++;
        $error = $conn->error;
        $errors[] = [
            'statement' => substr($statement, 0, 100) . (strlen($statement) > 100 ? '...' : ''),
            'error' => $error
        ];
        echo "  ✗ Error: $error\n";
    }
}

echo "\n========================================\n";
echo "Migration Summary\n";
echo "========================================\n";
echo "Statements Executed: " . ($successCount + $failureCount) . "\n";
echo "Successful: $successCount\n";
echo "Failed: $failureCount\n";

if (!empty($errors)) {
    echo "\nErrors encountered:\n";
    foreach ($errors as $err) {
        echo "  - " . $err['statement'] . "\n";
        echo "    Error: " . $err['error'] . "\n";
    }
}

echo "\n========================================\n";

if ($failureCount === 0) {
    echo "✓ All migrations applied successfully!\n";
    echo "\nTables created/verified:\n";
    echo "  ✓ trainer_availability\n";
    echo "  ✓ transactions\n";
    echo "  ✓ payout_requests\n";
    echo "  ✓ reported_issues\n";
    echo "  ✓ user_wallets\n";
    echo "  ✓ promotion_requests\n";
    echo "\nThe client portal should now be fully functional.\n";
} else {
    echo "✗ Some migrations failed. Please review the errors above.\n";
}

echo "========================================\n";

$conn->close();
?>
