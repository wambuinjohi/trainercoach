<?php
/**
 * MySQLi Verification Script for Location Label Fix
 * 
 * This script verifies that the location_label fix is working correctly
 * and provides diagnostic information
 */

// Database configuration
$server = 'localhost';
$username = 'skatrykc_trainer';
$password = 'Sirgeorge.12';
$database = 'skatrykc_trainer';
$port = 3306;

// Try to load from .env file
if (file_exists(__DIR__ . '/../.env')) {
    $env = parse_ini_file(__DIR__ . '/../.env');
    if ($env !== false) {
        $server = $env['DB_HOST'] ?? $server;
        $username = $env['DB_USER'] ?? $username;
        $password = $env['DB_PASS'] ?? $password;
        $database = $env['DB_NAME'] ?? $database;
        $port = isset($env['DB_PORT']) ? (int)$env['DB_PORT'] : $port;
    }
}

// Create connection
$conn = new mysqli($server, $username, $password, $database, $port);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$conn->set_charset("utf8mb4");

echo "=" . str_repeat("=", 80) . "\n";
echo "LOCATION LABEL - VERIFICATION & TESTING SCRIPT\n";
echo "=" . str_repeat("=", 80) . "\n\n";

// ============================================================================
// TEST 1: Column Existence
// ============================================================================
echo "TEST 1: Verify Location Columns Exist\n";
echo str_repeat("-", 80) . "\n";

$requiredColumns = ['location_label', 'location_lat', 'location_lng', 'service_radius'];
$allExist = true;

foreach ($requiredColumns as $colName) {
    $sql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'user_profiles'
              AND TABLE_SCHEMA = ?
              AND COLUMN_NAME = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ss", $database, $colName);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        echo "✓ Column '$colName' exists\n";
    } else {
        echo "✗ Column '$colName' MISSING\n";
        $allExist = false;
    }
    $stmt->close();
}

if ($allExist) {
    echo "\n✓ TEST PASSED: All required columns exist\n";
} else {
    echo "\n✗ TEST FAILED: Some columns are missing\n";
    echo "   Run: scripts/fix_location_label_mysqli.php\n";
}

echo "\n";

// ============================================================================
// TEST 2: Sample Data Load (Simulate API)
// ============================================================================
echo "TEST 2: Simulate API Data Load\n";
echo str_repeat("-", 80) . "\n";

$sql = "SELECT 
            user_id,
            location_label,
            location_lat,
            location_lng,
            service_radius
        FROM user_profiles
        WHERE user_id IN (SELECT id FROM users WHERE user_type = 'trainer')
        LIMIT 1";

$result = $conn->query($sql);

if ($result && $result->num_rows > 0) {
    $profile = $result->fetch_assoc();
    $userId = $profile['user_id'];
    
    echo "Loaded trainer profile:\n";
    echo "  user_id: $userId\n";
    echo "  location_label: " . ($profile['location_label'] ?? 'NULL') . "\n";
    echo "  location_lat: " . ($profile['location_lat'] ?? 'NULL') . "\n";
    echo "  location_lng: " . ($profile['location_lng'] ?? 'NULL') . "\n";
    echo "  service_radius: " . ($profile['service_radius'] ?? 'NULL') . "\n";
    
    if ($profile['location_label'] !== null || $profile['location_lat'] !== null) {
        echo "\n✓ TEST PASSED: Location data loads successfully\n";
    } else {
        echo "\n⚠ No location data set for this trainer (this is OK)\n";
    }
} else {
    echo "⚠ No trainers found in database\n";
}

echo "\n";

// ============================================================================
// TEST 3: Update Test
// ============================================================================
echo "TEST 3: Test Location Label Update\n";
echo str_repeat("-", 80) . "\n";

// Find a trainer to test with
$sql = "SELECT user_id FROM users WHERE user_type = 'trainer' LIMIT 1";
$result = $conn->query($sql);

if ($result && $result->num_rows > 0) {
    $trainerId = $result->fetch_assoc()['user_id'];
    
    // Test update with prepared statement (like the API does)
    $testLabel = "Test Location " . date('Y-m-d H:i:s');
    $testLat = -1.2921;
    $testLng = 36.8219;
    $testRadius = 5;
    
    echo "Attempting to update trainer: $trainerId\n";
    echo "  Setting location_label: '$testLabel'\n";
    echo "  Setting location_lat: $testLat\n";
    echo "  Setting location_lng: $testLng\n";
    echo "  Setting service_radius: $testRadius\n";
    
    $sql = "UPDATE user_profiles 
            SET location_label = ?, 
                location_lat = ?, 
                location_lng = ?, 
                service_radius = ?
            WHERE user_id = ?";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo "✗ Prepare failed: " . $conn->error . "\n";
    } else {
        $stmt->bind_param("sddis", $testLabel, $testLat, $testLng, $testRadius, $trainerId);
        
        if ($stmt->execute()) {
            echo "\n✓ Update executed successfully\n";
            echo "  Rows affected: " . $stmt->affected_rows . "\n";
            
            // Verify the update
            $verifySql = "SELECT location_label, location_lat, location_lng, service_radius
                         FROM user_profiles WHERE user_id = ?";
            $verifyStmt = $conn->prepare($verifySql);
            $verifyStmt->bind_param("s", $trainerId);
            $verifyStmt->execute();
            $verifyResult = $verifyStmt->get_result();
            
            if ($verifyResult->num_rows > 0) {
                $verified = $verifyResult->fetch_assoc();
                echo "\n✓ Verification - Data in database:\n";
                echo "  location_label: " . ($verified['location_label'] ?? 'NULL') . "\n";
                echo "  location_lat: " . ($verified['location_lat'] ?? 'NULL') . "\n";
                echo "  location_lng: " . ($verified['location_lng'] ?? 'NULL') . "\n";
                echo "  service_radius: " . ($verified['service_radius'] ?? 'NULL') . "\n";
                
                if ($verified['location_label'] === $testLabel) {
                    echo "\n✓ TEST PASSED: Update verified in database\n";
                } else {
                    echo "\n✗ TEST FAILED: Data mismatch\n";
                }
            }
            $verifyStmt->close();
        } else {
            echo "\n✗ Execute failed: " . $stmt->error . "\n";
        }
        $stmt->close();
    }
} else {
    echo "⚠ No trainers found to test update\n";
}

echo "\n";

// ============================================================================
// TEST 4: NULL Handling
// ============================================================================
echo "TEST 4: Test NULL Value Handling\n";
echo str_repeat("-", 80) . "\n";

$sql = "SELECT user_id FROM users WHERE user_type = 'trainer' LIMIT 1";
$result = $conn->query($sql);

if ($result && $result->num_rows > 0) {
    $trainerId = $result->fetch_assoc()['user_id'];
    
    echo "Attempting to SET location_label to NULL for trainer: $trainerId\n";
    
    // Test setting to NULL (as the API would)
    $sql = "UPDATE user_profiles 
            SET location_label = NULL
            WHERE user_id = ?";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo "✗ Prepare failed: " . $conn->error . "\n";
    } else {
        $stmt->bind_param("s", $trainerId);
        
        if ($stmt->execute()) {
            echo "✓ NULL update executed\n";
            
            // Verify
            $verifySql = "SELECT location_label FROM user_profiles WHERE user_id = ?";
            $verifyStmt = $conn->prepare($verifySql);
            $verifyStmt->bind_param("s", $trainerId);
            $verifyStmt->execute();
            $verifyResult = $verifyStmt->get_result();
            
            if ($verifyResult->num_rows > 0) {
                $row = $verifyResult->fetch_assoc();
                if ($row['location_label'] === null) {
                    echo "✓ TEST PASSED: NULL value handled correctly\n";
                } else {
                    echo "✗ TEST FAILED: location_label is not null\n";
                }
            }
            $verifyStmt->close();
        } else {
            echo "✗ Execute failed: " . $stmt->error . "\n";
        }
        $stmt->close();
    }
} else {
    echo "⚠ No trainers found\n";
}

echo "\n";

// ============================================================================
// TEST 5: Data Integrity
// ============================================================================
echo "TEST 5: Data Integrity Check\n";
echo str_repeat("-", 80) . "\n";

// Check for invalid coordinates
$sql = "SELECT user_id, location_lat, location_lng
        FROM user_profiles
        WHERE (location_lat IS NOT NULL AND (location_lat < -90 OR location_lat > 90))
           OR (location_lng IS NOT NULL AND (location_lng < -180 OR location_lng > 180))";

$result = $conn->query($sql);

if ($result->num_rows > 0) {
    echo "✗ Found " . $result->num_rows . " records with invalid coordinates:\n";
    while ($row = $result->fetch_assoc()) {
        echo "  user_id: " . $row['user_id'] . "\n";
        echo "    lat: " . $row['location_lat'] . " lng: " . $row['location_lng'] . "\n";
    }
} else {
    echo "✓ All coordinates are within valid ranges\n";
}

echo "\n";

// ============================================================================
// TEST 6: Indexes
// ============================================================================
echo "TEST 6: Verify Indexes Exist\n";
echo str_repeat("-", 80) . "\n";

$sql = "SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_NAME = 'user_profiles'
          AND TABLE_SCHEMA = ?
          AND (INDEX_NAME LIKE '%location%' OR INDEX_NAME LIKE '%radius%')";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $database);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    echo "✓ Found " . $result->num_rows . " location-related indexes:\n";
    while ($row = $result->fetch_assoc()) {
        echo "  - " . $row['INDEX_NAME'] . "\n";
    }
} else {
    echo "⚠ No location-related indexes found\n";
    echo "  Run: scripts/fix_location_label_mysqli.php\n";
}
$stmt->close();

echo "\n";

// ============================================================================
// SUMMARY
// ============================================================================
echo "=" . str_repeat("=", 80) . "\n";
echo "SUMMARY\n";
echo "=" . str_repeat("=", 80) . "\n";

$allTests = true;

// Re-run quick check
$sql = "SELECT COUNT(*) as col_count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'user_profiles'
          AND TABLE_SCHEMA = ?
          AND COLUMN_NAME IN ('location_label', 'location_lat', 'location_lng', 'service_radius')";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $database);
$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();
$stmt->close();

if ($row['col_count'] == 4) {
    echo "✓ All 4 location columns exist\n";
} else {
    echo "✗ Missing columns (found " . $row['col_count'] . "/4)\n";
    $allTests = false;
}

if ($allTests) {
    echo "✓ Database schema is correct\n";
    echo "✓ API should now load location_label correctly\n";
    echo "\nTo test:\n";
    echo "1. Open ServiceAreaEditor in browser\n";
    echo "2. Check browser console (F12) for debug messages\n";
    echo "3. Verify location_label field loads\n";
    echo "4. Edit and save\n";
} else {
    echo "✗ Some checks failed\n";
    echo "Run: php scripts/fix_location_label_mysqli.php\n";
}

$conn->close();
echo "\n";
?>
