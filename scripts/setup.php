<?php
/**
 * Setup Script: Runs migration and seeding
 * Usage: php scripts/setup.php
 */

echo "╔════════════════════════════════════════╗\n";
echo "║   Database Setup & Seeding              ║\n";
echo "╚════════════════════════════════════════╝\n\n";

// Step 1: Run migration
echo "Step 1: Creating users table...\n";
$migrationOutput = shell_exec('php ' . __DIR__ . '/migrate_users_table.php');
echo $migrationOutput . "\n";

// Step 2: Run seed
echo "Step 2: Seeding test users...\n";
$seedOutput = shell_exec('php ' . __DIR__ . '/seed_test_users.php');
echo $seedOutput . "\n";

echo "╔════════════════════════════════════════╗\n";
echo "║   Setup Complete!                       ║\n";
echo "╚════════════════════════════════════════╝\n\n";

echo "Test Accounts:\n";
echo "  • Email: admin@skatryk.co.ke (Admin)\n";
echo "  • Email: trainer@skatryk.co.ke (Trainer)\n";
echo "  • Email: client@skatryk.co.ke (Client)\n";
echo "  • Password: Test1234 (all accounts)\n\n";

echo "Login endpoint: POST /api.php\n";
echo "Payload: {\"action\": \"login\", \"email\": \"...\", \"password\": \"...\"}\n";
?>
