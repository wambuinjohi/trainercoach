<?php
/**
 * Seeder: Insert test users
 * Usage: php scripts/seed_test_users.php
 */

// Include database connection
require_once(__DIR__ . '/../connection.php');

$testUsers = [
    [
        'email' => 'admin@skatryk.co.ke',
        'password' => 'Test1234',
        'first_name' => 'Admin',
        'last_name' => 'User',
        'user_type' => 'admin',
        'phone' => '+254712345601',
        'country' => 'Kenya',
    ],
    [
        'email' => 'trainer@skatryk.co.ke',
        'password' => 'Test1234',
        'first_name' => 'Trainer',
        'last_name' => 'User',
        'user_type' => 'trainer',
        'phone' => '+254712345602',
        'country' => 'Kenya',
    ],
    [
        'email' => 'client@skatryk.co.ke',
        'password' => 'Test1234',
        'first_name' => 'Client',
        'last_name' => 'User',
        'user_type' => 'client',
        'phone' => '+254712345603',
        'country' => 'Kenya',
    ],
];

$seeded = 0;
$skipped = 0;

foreach ($testUsers as $user) {
    // Check if user already exists
    $checkEmail = $conn->real_escape_string($user['email']);
    $checkSql = "SELECT id FROM users WHERE email = '$checkEmail' LIMIT 1";
    $result = $conn->query($checkSql);

    if ($result && $result->num_rows > 0) {
        echo "⊘ Skipped: {$user['email']} (already exists)\n";
        $skipped++;
        continue;
    }

    // Generate unique ID
    $id = 'user_' . uniqid();
    
    // Hash password
    $passwordHash = password_hash($user['password'], PASSWORD_BCRYPT);
    
    // Prepare insert
    $id = $conn->real_escape_string($id);
    $email = $conn->real_escape_string($user['email']);
    $phone = $conn->real_escape_string($user['phone']);
    $passwordHash = $conn->real_escape_string($passwordHash);
    $firstName = $conn->real_escape_string($user['first_name']);
    $lastName = $conn->real_escape_string($user['last_name']);
    $country = $conn->real_escape_string($user['country']);
    
    $insertSql = "
        INSERT INTO users (
            id, email, phone, password_hash, 
            first_name, last_name, country, 
            status, email_verified, phone_verified, 
            currency, kyc_status, created_at
        ) VALUES (
            '$id', '$email', '$phone', '$passwordHash',
            '$firstName', '$lastName', '$country',
            'active', 1, 0,
            'KES', 'pending', NOW()
        )
    ";

    if ($conn->query($insertSql)) {
        // Create corresponding user_profiles entry
        $profileId = 'profile_' . uniqid();
        $profileId = $conn->real_escape_string($profileId);
        $userType = $conn->real_escape_string($user['user_type']);
        $fullName = $conn->real_escape_string($user['first_name'] . ' ' . $user['last_name']);

        $profileSql = "
            INSERT INTO user_profiles (
                id, user_id, user_type, full_name, phone_number, created_at
            ) VALUES (
                '$profileId', '$id', '$userType', '$fullName', '$phone', NOW()
            )
        ";

        if ($conn->query($profileSql)) {
            echo "✓ Seeded: {$user['email']} (Type: {$user['user_type']})\n";
            $seeded++;
        } else {
            echo "✓ Seeded user but profile failed: {$user['email']} - " . $conn->error . "\n";
            $seeded++;
        }
    } else {
        echo "✗ Failed: {$user['email']} - " . $conn->error . "\n";
    }
}

echo "\nSummary: {$seeded} seeded, {$skipped} skipped\n";
exit($seeded > 0 ? 0 : 1);
?>
