<?php
// ======================================
// UNIVERSAL MYSQL API FOR REACT FRONTEND
// TRAINER COACH CONNECT SYSTEM
// ======================================

// Disable output buffering and output directly
if (ob_get_level()) {
    ob_end_clean();
}
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Get the requesting origin
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$corsOrigin = !empty($origin) ? $origin : '*';

// Set headers BEFORE any output - crucial for Apache
if (!headers_sent()) {
    header("Content-Type: application/json; charset=utf-8");

    // CORS Headers - Allow any origin
    header("Access-Control-Allow-Origin: " . $corsOrigin);
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With");
    header("Access-Control-Max-Age: 86400");

    // Cache control headers (prevent browser caching of API responses)
    header("Cache-Control: no-cache, no-store, must-revalidate, max-age=0");
    header("Pragma: no-cache");
    header("Expires: 0");
}

// Set error handler to prevent HTML error output
set_error_handler(function($errno, $errstr, $errfile, $errline) use ($corsOrigin) {
    error_log("PHP Error [$errno]: $errstr in $errfile on line $errline");
    if (!headers_sent()) {
        http_response_code(500);
        header("Content-Type: application/json; charset=utf-8");

        // Add CORS headers to error responses
        header("Access-Control-Allow-Origin: " . $corsOrigin);
        header("Access-Control-Allow-Credentials: true");
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With");
    }
    echo json_encode([
        "status" => "error",
        "message" => "Server error. Please check the logs."
    ]);
    exit;
}, E_ALL);

// Register shutdown function to catch fatal errors
register_shutdown_function(function() use ($corsOrigin) {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            http_response_code(500);
            header("Content-Type: application/json; charset=utf-8");

            // Add CORS headers to fatal error responses
            header("Access-Control-Allow-Origin: " . $corsOrigin);
            header("Access-Control-Allow-Credentials: true");
            header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
            header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With");
        }
        echo json_encode([
            "status" => "error",
            "message" => "Server error: " . $error['message']
        ]);
    }
});

// Include the database connection
include('connection.php');

// Auto-migration: Ensure categories table has correct status columns and fields
function ensureCategoriesSchemaIsCorrect($conn) {
    // List of required columns with their ALTER statements
    $requiredColumns = [
        'status' => "ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `status` ENUM('active', 'pending_approval', 'rejected', 'archived') DEFAULT 'active' COMMENT 'Category status'",
        'created_by_admin' => "ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `created_by_admin` BOOLEAN DEFAULT FALSE COMMENT 'Tracks if admin-created vs trainer-requested'",
        'created_by' => "ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `created_by` VARCHAR(36) COMMENT 'User ID who created this category'",
        'reviewed_by' => "ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `reviewed_by` VARCHAR(36) COMMENT 'Admin user ID who reviewed this category'",
        'rejection_reason' => "ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `rejection_reason` TEXT COMMENT 'Reason for rejecting the category'",
        'reviewed_at' => "ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `reviewed_at` TIMESTAMP NULL COMMENT 'When the category was reviewed'"
    ];

    // Check and add missing columns
    foreach ($requiredColumns as $columnName => $alterStatement) {
        $result = $conn->query("SHOW COLUMNS FROM categories WHERE Field = '$columnName'");
        if ($result && $result->num_rows === 0) {
            if (!$conn->query($alterStatement)) {
                error_log("Warning: Failed to add $columnName column to categories: " . $conn->error);
            }
        }
    }

    // Also ensure status column has correct ENUM values if it exists
    $result = $conn->query("SHOW COLUMNS FROM categories WHERE Field = 'status'");
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $currentType = $row['Type'];

        // Check if the ENUM needs to be updated
        if (strpos($currentType, 'pending_approval') === false || strpos($currentType, 'rejected') === false) {
            $modification = "ALTER TABLE `categories` MODIFY `status` ENUM('active', 'pending_approval', 'rejected', 'archived') DEFAULT 'active'";
            if (!$conn->query($modification)) {
                error_log("Warning: Failed to update categories status ENUM: " . $conn->error);
            }
        }
    }
}

// Run auto-migration on API startup
ensureCategoriesSchemaIsCorrect($conn);

// Include M-Pesa helper functions
include('mpesa_helper.php');

// Include SMS helper functions
include('sms_helper.php');

// Utility function for logging API events
function logEvent($eventType, $details = []) {
    $timestamp = date('Y-m-d H:i:s');
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

    $logEntry = [
        'timestamp' => $timestamp,
        'event_type' => $eventType,
        'client_ip' => $clientIp,
        'user_agent' => substr($userAgent, 0, 200),
    ];

    $logEntry = array_merge($logEntry, $details);

    @error_log(json_encode($logEntry));

    $logFile = __DIR__ . '/api_events.log';
    $logLine = json_encode($logEntry) . PHP_EOL;
    @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
}

// Handle preflight (OPTIONS) requests
// IMPORTANT: OPTIONS requests must return 200 with proper CORS headers
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);

    // Re-add CORS headers for preflight responses
    if (!headers_sent()) {
        header("Access-Control-Allow-Origin: " . $corsOrigin);
        header("Access-Control-Allow-Credentials: true");
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With");
        header("Access-Control-Max-Age: 86400");
    }

    exit;
}

// Utility function for safe JSON response
function respond($status, $message, $data = null, $code = 200) {
    global $corsOrigin;

    if (!headers_sent()) {
        http_response_code($code);
        header("Content-Type: application/json; charset=utf-8");

        // Add CORS headers to all responses
        header("Access-Control-Allow-Origin: " . $corsOrigin);
        header("Access-Control-Allow-Credentials: true");
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor, X-Requested-With");
    }

    $response = ["status" => $status, "message" => $message, "data" => $data];
    $json = json_encode($response);
    if ($json === false) {
        echo json_encode(["status" => "error", "message" => "Response encoding failed"]);
    } else {
        echo $json;
    }
    exit;
}

// Normalize image URLs to absolute URLs
function normalizeImageUrl($imageUrl) {
    if (empty($imageUrl)) {
        return null;
    }

    // If already absolute (starts with http), return as-is
    if (strpos($imageUrl, 'http://') === 0 || strpos($imageUrl, 'https://') === 0) {
        return $imageUrl;
    }

    // If relative, prepend the upload base URL
    $uploadBaseUrl = getenv('UPLOAD_BASE_URL') ?: 'https://trainercoachconnect.com/uploads';
    $uploadBaseUrl = rtrim($uploadBaseUrl, '/');

    // Handle paths like /uploads/file.jpg or uploads/file.jpg
    if (strpos($imageUrl, 'uploads/') !== false) {
        // Extract just the filename
        $fileName = preg_replace('|^.*uploads/|', '', $imageUrl);
        return $uploadBaseUrl . '/' . $fileName;
    }

    // For other relative paths, just prepend the base URL
    return $uploadBaseUrl . '/' . ltrim($imageUrl, '/');
}

// Safe query builder helper
function buildWhereClause($conditions) {
    if (empty($conditions)) return "";
    $parts = [];
    foreach ($conditions as $column => $value) {
        $parts[] = "`" . addslashes($column) . "` = '" . addslashes($value) . "'";
    }
    return "WHERE " . implode(" AND ", $parts);
}

// Validate admin authorization from Bearer token
function validateAdminAuthorization($conn) {
    global $corsOrigin;

    // Get Authorization header
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (empty($authHeader)) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Missing Authorization header",
            "data" => null
        ]);
        exit;
    }

    // Extract Bearer token
    if (strpos($authHeader, 'Bearer ') !== 0) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid Authorization header format",
            "data" => null
        ]);
        exit;
    }

    $token = substr($authHeader, 7);

    // Decode token (base64-encoded JSON)
    $decodedToken = base64_decode($token, true);
    if (!$decodedToken) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid token format",
            "data" => null
        ]);
        exit;
    }

    $tokenData = json_decode($decodedToken, true);
    if (!$tokenData || !isset($tokenData['id']) || !isset($tokenData['exp'])) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid token data",
            "data" => null
        ]);
        exit;
    }

    // Check token expiration
    if ($tokenData['exp'] < time()) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Token has expired",
            "data" => null
        ]);
        exit;
    }

    // Extract user ID from token
    $userId = $tokenData['id'];

    // Verify user is an admin
    $stmt = $conn->prepare("SELECT user_type FROM user_profiles WHERE user_id = ? LIMIT 1");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Database error",
            "data" => null
        ]);
        exit;
    }

    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();

    if ($result->num_rows === 0) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "User not found",
            "data" => null
        ]);
        exit;
    }

    $profile = $result->fetch_assoc();

    // Check if user is an admin
    if ($profile['user_type'] !== 'admin') {
        http_response_code(403);
        echo json_encode([
            "status" => "error",
            "message" => "Insufficient permissions. Admin access required.",
            "data" => null
        ]);
        exit;
    }

    // Return user ID for use in the API endpoint
    return $userId;
}

// Verify admin token from X-Admin-Token header
function verifyAdminToken() {
    global $conn, $corsOrigin;

    // Get the X-Admin-Token header
    $adminToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? null;

    if (empty($adminToken)) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Missing X-Admin-Token header",
            "data" => null
        ]);
        return false;
    }

    // The token should be the admin user ID for now
    // In a more secure implementation, this would be a JWT or similar
    $adminId = $adminToken;

    // Verify the user exists and is an admin
    $stmt = $conn->prepare("SELECT user_type FROM user_profiles WHERE user_id = ? LIMIT 1");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Database error",
            "data" => null
        ]);
        return false;
    }

    $stmt->bind_param("s", $adminId);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();

    if ($result->num_rows === 0) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Admin user not found",
            "data" => null
        ]);
        return false;
    }

    $profile = $result->fetch_assoc();

    // Check if user is an admin
    if ($profile['user_type'] !== 'admin') {
        http_response_code(403);
        echo json_encode([
            "status" => "error",
            "message" => "Insufficient permissions. Admin access required.",
            "data" => null
        ]);
        return false;
    }

    // Return the admin ID for use in the API endpoint
    return $adminId;
}

// Get trainer group pricing for a specific category
function getTrainerGroupPricing($conn, $trainerId, $categoryId) {
    $trainerId = $conn->real_escape_string($trainerId);
    $categoryId = intval($categoryId);

    $stmt = $conn->prepare("
        SELECT id, trainer_id, category_id, pricing_model, tiers, created_at, updated_at
        FROM trainer_group_pricing
        WHERE trainer_id = ? AND category_id = ?
        LIMIT 1
    ");
    $stmt->bind_param("si", $trainerId, $categoryId);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();

    if ($result->num_rows === 0) {
        return null;
    }

    $row = $result->fetch_assoc();

    // Parse tiers JSON
    if (isset($row['tiers']) && is_string($row['tiers'])) {
        $parsed = json_decode($row['tiers'], true);
        if ($parsed !== null) {
            $row['tiers'] = $parsed;
        }
    }

    return $row;
}

// Calculate base amount for group training
function calculateGroupTrainingBase($groupPricing, $tierName, $pricingModel, $groupSize = 1) {
    if (!$groupPricing || !isset($groupPricing['tiers']) || !is_array($groupPricing['tiers'])) {
        return null;
    }

    $tier = null;
    foreach ($groupPricing['tiers'] as $t) {
        if (isset($t['group_size_name']) && $t['group_size_name'] === $tierName) {
            $tier = $t;
            break;
        }
    }

    if (!$tier) {
        return null;
    }

    $tierRate = floatval($tier['rate']);

    // Calculate base amount based on pricing model
    if ($pricingModel === 'per_person') {
        // Per-person pricing: multiply rate by group size
        return $tierRate * intval($groupSize);
    } else {
        // Fixed rate: use the tier rate as is
        return $tierRate;
    }
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance($lat1, $lon1, $lat2, $lon2) {
    $lat1 = floatval($lat1);
    $lon1 = floatval($lon1);
    $lat2 = floatval($lat2);
    $lon2 = floatval($lon2);

    // Validate coordinates
    if (!is_finite($lat1) || !is_finite($lon1) || !is_finite($lat2) || !is_finite($lon2)) {
        return null;
    }
    if ($lat1 < -90 || $lat1 > 90 || $lon1 < -180 || $lon1 > 180 ||
        $lat2 < -90 || $lat2 > 90 || $lon2 < -180 || $lon2 > 180) {
        return null;
    }

    $R = 6371; // Earth's radius in km
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat / 2) * sin($dLat / 2) +
         cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
         sin($dLon / 2) * sin($dLon / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    $distance = $R * $c;

    // Sanity check: max distance between two points on Earth is ~20,000km
    if ($distance > 20000) {
        return null;
    }

    return round($distance, 2);
}

// Calculate transport fee based on distance and pricing tiers
function calculateTransportFee($distanceKm, $hourlyRateByRadius) {
    if ($distanceKm === null) {
        return 0;
    }

    if (empty($hourlyRateByRadius) || !is_array($hourlyRateByRadius)) {
        return 0;
    }

    // Sort tiers by radius_km in ascending order
    usort($hourlyRateByRadius, function($a, $b) {
        $radiusA = floatval($a['radius_km'] ?? $a['radius'] ?? 0);
        $radiusB = floatval($b['radius_km'] ?? $b['radius'] ?? 0);
        return $radiusA <=> $radiusB;
    });

    // Find the matching tier (first tier >= distance)
    foreach ($hourlyRateByRadius as $tier) {
        $tierRadius = floatval($tier['radius_km'] ?? $tier['radius'] ?? 0);
        $tierRate = floatval($tier['rate'] ?? $tier['hourly_rate'] ?? 0);

        if ($distanceKm <= $tierRadius) {
            return round($tierRate, 2);
        }
    }

    // If distance exceeds all tiers, use the highest tier rate
    if (!empty($hourlyRateByRadius)) {
        $lastTier = end($hourlyRateByRadius);
        $rate = floatval($lastTier['rate'] ?? $lastTier['hourly_rate'] ?? 0);
        return round($rate, 2);
    }

    return 0;
}

// Load platform settings with defaults
function loadPlatformSettings() {
    global $conn;

    $defaults = [
        'platformChargeClientPercent' => 15,
        'platformChargeTrainerPercent' => 10,
        'compensationFeePercent' => 10,
        'maintenanceFeePercent' => 15,
    ];

    $settings = $defaults;

    // Try to load from database
    if ($conn) {
        $settingsSql = "SELECT setting_key, value FROM platform_settings WHERE setting_key IN ('platformChargeClientPercent', 'platformChargeTrainerPercent', 'compensationFeePercent', 'maintenanceFeePercent')";
        $result = $conn->query($settingsSql);

        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $key = $row['setting_key'];
                $value = floatval($row['value']);
                if (in_array($key, array_keys($defaults))) {
                    $settings[$key] = $value;
                }
            }
        }
    }

    return $settings;
}

// Calculate fee breakdown using new calculation order
function calculateFeeBreakdown($baseAmount, $settings, $transportFee = 0) {
    $baseAmount = max(0, floatval($baseAmount));
    $transportFee = max(0, floatval($transportFee));

    // Clamp percentages to 0-100
    $clientPct = max(0, min(100, floatval($settings['platformChargeClientPercent'] ?? 15)));
    $trainerPct = max(0, min(100, floatval($settings['platformChargeTrainerPercent'] ?? 10)));
    $compPct = max(0, min(100, floatval($settings['compensationFeePercent'] ?? 10)));
    $maintPct = max(0, min(100, floatval($settings['maintenanceFeePercent'] ?? 15)));

    // Step 1: Calculate all charges on base amount
    $platformChargeClient = round(($baseAmount * $clientPct) / 100, 2);
    $platformChargeTrainer = round(($baseAmount * $trainerPct) / 100, 2);
    $compensationFee = round(($baseAmount * $compPct) / 100, 2);

    // Step 2: Sum all charges
    $sumOfCharges = round($platformChargeClient + $platformChargeTrainer + $compensationFee, 2);

    // Step 3: Apply maintenance fee on the sum of charges
    $maintenanceFee = round(($sumOfCharges * $maintPct) / 100, 2);

    // Step 4: Calculate client total
    // Client pays: base + client charges (platformChargeClient + compensationFee) + transport
    // NOTE: Maintenance fee is NOT charged to client (it's internal platform revenue)
    $clientCharges = $platformChargeClient + $compensationFee;
    $clientTotal = round($baseAmount + $clientCharges + $transportFee, 2);

    // Step 5: Calculate trainer net
    // Trainer receives: base + transport - trainer charges - trainer's share of maintenance
    // Trainer's share of maintenance is proportional to their charges
    $trainerShareOfMaintenance = 0;
    if ($sumOfCharges > 0) {
        $trainerShareOfMaintenance = round(($platformChargeTrainer / $sumOfCharges) * $maintenanceFee, 2);
    }
    $trainerNetAmount = round($baseAmount + $transportFee - $platformChargeTrainer - $trainerShareOfMaintenance, 2);

    return [
        'baseAmount' => $baseAmount,
        'platformChargeClient' => $platformChargeClient,
        'platformChargeTrainer' => $platformChargeTrainer,
        'compensationFee' => $compensationFee,
        'sumOfCharges' => $sumOfCharges,
        'maintenanceFee' => $maintenanceFee,
        'transportFee' => $transportFee,
        'clientTotal' => $clientTotal,
        'trainerNetAmount' => $trainerNetAmount,
    ];
}

// =============================
// GENERIC FILE UPLOAD HANDLER - DISABLED
// =============================
// NOTE: All file uploads are now handled by specific action handlers:
// - verification_document_upload: handles verification document uploads
// - profile_update: handles profile image uploads
// The generic file upload handler below is intentionally disabled.
//
// Original code commented out to prevent execution:
/*
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_FILES)) {
    // ... file upload handling code ...
}
*/

// Read input JSON
$rawInput = file_get_contents("php://input");
$input = null;

if (!empty($rawInput)) {
    $input = json_decode($rawInput, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        respond("error", "Invalid JSON in request body.", null, 400);
    }
} else if (!empty($_POST)) {
    // Handle FormData requests (multipart/form-data)
    $input = $_POST;
} else if (!empty($_GET)) {
    $input = $_GET;
} else {
    $input = [];
}

// Ensure input is an array
if (!is_array($input)) {
    respond("error", "Request must be JSON object.", null, 400);
}

// Verify action parameter
if (empty($input['action'])) {
    respond("error", "Missing action parameter.", null, 400);
}

$action = strtolower(trim($input['action']));

// =============================
// ACTION HANDLERS
// =============================
switch ($action) {

    // CREATE TABLE DYNAMICALLY
    case 'create_table':
        if (!isset($input['table']) || !isset($input['columns'])) {
            respond("error", "Missing table or columns.", null, 400);
        }

        $table = $conn->real_escape_string($input['table']);
        $columns = $input['columns'];
        $columns_sql = implode(", ", $columns);
        $sql = "CREATE TABLE IF NOT EXISTS `$table` ($columns_sql)";

        if ($conn->query($sql)) {
            respond("success", "Table '$table' created successfully.");
        } else {
            respond("error", "Failed to create table: " . $conn->error, null, 500);
        }
        break;

    // INSERT DATA
    case 'insert':
        if (!isset($input['table']) || !isset($input['data'])) {
            respond("error", "Missing table or data.", null, 400);
        }

        $table = $conn->real_escape_string($input['table']);
        $data = $input['data'];
        if (!is_array($data)) {
            respond("error", "Data must be an array.", null, 400);
        }

        $upsert = isset($input['upsert']) && $input['upsert'];
        $onConflict = isset($input['onConflict']) ? $input['onConflict'] : null;

        if ($upsert && $onConflict === 'user_id' && isset($data['user_id'])) {
            $existsResult = $conn->query("SELECT id FROM `$table` WHERE user_id = '" . $conn->real_escape_string($data['user_id']) . "' LIMIT 1");
            if ($existsResult->num_rows > 0) {
                $updates = [];
                foreach ($data as $key => $value) {
                    if ($key === 'user_id') continue;
                    if ($value === null || $value === 'null') {
                        $updates[] = "`" . $conn->real_escape_string($key) . "` = NULL";
                    } else {
                        if (is_array($value) || is_object($value)) {
                            $stringValue = json_encode($value);
                            $updates[] = "`" . $conn->real_escape_string($key) . "` = '" . $conn->real_escape_string($stringValue) . "'";
                        } else {
                            $stringValue = (string)$value;
                            $updates[] = "`" . $conn->real_escape_string($key) . "` = '" . $conn->real_escape_string($stringValue) . "'";
                        }
                    }
                }
                $sql = "UPDATE `$table` SET " . implode(", ", $updates) . " WHERE user_id = '" . $conn->real_escape_string($data['user_id']) . "'";
                if ($conn->query($sql)) {
                    respond("success", "Record upserted successfully.", ["affected_rows" => $conn->affected_rows]);
                } else {
                    respond("error", "Upsert failed: " . $conn->error, null, 500);
                }
            }
        }

        $columns = array_keys($data);
        $placeholders = array_fill(0, count($columns), '?');
        $sql = "INSERT INTO `$table` (`" . implode("`, `", $columns) . "`) VALUES (" . implode(", ", $placeholders) . ")";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            respond("error", "Failed to prepare insert: " . $conn->error, null, 500);
        }

        $types = "";
        $values = [];
        foreach (array_values($data) as $value) {
            if ($value === null || $value === 'null') {
                $values[] = null;
                $types .= "s";
            } else {
                if (is_array($value) || is_object($value)) {
                    $values[] = json_encode($value);
                } else {
                    $values[] = (string)$value;
                }
                $types .= "s";
            }
        }

        $stmt->bind_param($types, ...$values);

        if ($stmt->execute()) {
            $insertId = $stmt->insert_id;
            $stmt->close();
            respond("success", "Record inserted successfully.", ["id" => $insertId]);
        } else {
            $stmt->close();
            respond("error", "Insert failed: " . $conn->error, null, 500);
        }
        break;

    // READ / SELECT DATA
    case 'select':
        if (!isset($input['table'])) {
            respond("error", "Missing table name.", null, 400);
        }

        $table = $conn->real_escape_string($input['table']);
        $where = "";
        $orderBy = "";
        $limit = "";

        if (isset($input['where'])) {
            $where = "WHERE " . $input['where'];
        } else if (isset($input['conditions'])) {
            $where = buildWhereClause($input['conditions']);
        }

        // Add soft delete filter for reported_issues table
        if ($table === 'reported_issues') {
            if ($where) {
                $where .= " AND deleted_at IS NULL";
            } else {
                $where = "WHERE deleted_at IS NULL";
            }
        }

        if (isset($input['order'])) {
            $orderBy = "ORDER BY " . $input['order'];
        }

        if (isset($input['limit'])) {
            $limit = "LIMIT " . intval($input['limit']);
        }

        // Add offset support for pagination
        if (isset($input['offset'])) {
            $limit .= " OFFSET " . intval($input['offset']);
        }

        $sql = "SELECT * FROM `$table` $where $orderBy $limit";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;

        // Parse JSON fields for user_profiles table
        if ($table === 'user_profiles') {
            $jsonFields = ['availability', 'hourly_rate_by_radius', 'pricing_packages', 'skills', 'certifications'];
            foreach ($rows as &$row) {
                // Normalize profile image URL
                if (!empty($row['profile_image'])) {
                    $row['profile_image'] = normalizeImageUrl($row['profile_image']);
                }

                foreach ($jsonFields as $field) {
                    if (isset($row[$field]) && is_string($row[$field]) && !empty($row[$field])) {
                        $parsed = json_decode($row[$field], true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $row[$field] = $parsed;
                        }
                    }
                }
            }
            unset($row);
        }

        $count = null;
        if (isset($input['count']) && $input['count'] === 'exact') {
            $countSql = "SELECT COUNT(*) as cnt FROM `$table` $where";
            $countResult = $conn->query($countSql);
            if ($countResult) {
                $countRow = $countResult->fetch_assoc();
                $count = intval($countRow['cnt']);
            }
        }

        $response = ["data" => $rows];
        if ($count !== null) {
            $response["count"] = $count;
        }

        respond("success", "Data fetched successfully.", $response);
        break;

    // UPDATE DATA
    case 'update':
        if (!isset($input['table']) || !isset($input['data']) || !isset($input['where'])) {
            respond("error", "Missing table, data, or where condition.", null, 400);
        }

        $table = $conn->real_escape_string($input['table']);
        $data = $input['data'];
        $updates = [];
        $types = "";
        $values = [];

        // Auto-calculate service_radius when location is updated for trainers
        $isUserProfilesUpdate = $table === 'user_profiles';
        $hasLocationUpdate = isset($data['location_lat']) || isset($data['location_lng']);

        if ($isUserProfilesUpdate && $hasLocationUpdate && !isset($data['service_radius'])) {
            // Auto-calculate service radius based on trainer tier/default
            // For now, use a default of 10km if not explicitly set
            $data['service_radius'] = 10;
        }

        // Validate registration_path changes - prevent if path_locked is true
        if ($isUserProfilesUpdate && isset($data['registration_path'])) {
            // Extract user_id from WHERE clause to check path_locked status
            if (preg_match('/user_id\s*=\s*["\']?([a-zA-Z0-9_]+)["\']?/i', $input['where'], $matches)) {
                $userId = $matches[1];
                $stmt = $conn->prepare("SELECT path_locked FROM user_profiles WHERE user_id = ? LIMIT 1");
                $stmt->bind_param("s", $userId);
                $stmt->execute();
                $result = $stmt->get_result();
                $row = $result->fetch_assoc();
                $stmt->close();

                if ($row && $row['path_locked']) {
                    respond("error", "Cannot change registration path after documents submitted.", null, 403);
                }
            }
        }

        foreach ($data as $key => $value) {
            $escapedKey = "`" . $conn->real_escape_string($key) . "`";
            if ($value === null || $value === 'null') {
                $updates[] = "$escapedKey = NULL";
            } else {
                $updates[] = "$escapedKey = ?";
                if (is_array($value) || is_object($value)) {
                    $values[] = json_encode($value);
                } else {
                    $values[] = (string)$value;
                }
                $types .= "s";
            }
        }

        $sql = "UPDATE `$table` SET " . implode(", ", $updates) . " WHERE " . $input['where'];

        if (empty($values)) {
            if ($conn->query($sql)) {
                respond("success", "Record updated successfully.", ["affected_rows" => $conn->affected_rows]);
            } else {
                respond("error", "Update failed: " . $conn->error, null, 500);
            }
        } else {
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                respond("error", "Failed to prepare update: " . $conn->error, null, 500);
            }

            $stmt->bind_param($types, ...$values);

            if ($stmt->execute()) {
                $affectedRows = $stmt->affected_rows;
                $stmt->close();
                respond("success", "Record updated successfully.", ["affected_rows" => $affectedRows]);
            } else {
                $stmt->close();
                respond("error", "Update failed: " . $conn->error, null, 500);
            }
        }
        break;

    // DELETE DATA
    case 'delete':
        if (!isset($input['table']) || !isset($input['where'])) {
            respond("error", "Missing table or where condition.", null, 400);
        }

        $table = $conn->real_escape_string($input['table']);
        $sql = "DELETE FROM `$table` WHERE " . $input['where'];

        if ($conn->query($sql)) {
            respond("success", "Record(s) deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            respond("error", "Delete failed: " . $conn->error, null, 500);
        }
        break;

    // SEED TABLE WITH SAMPLE DATA
    case 'seed':
        if (!isset($input['table']) || !isset($input['data'])) {
            respond("error", "Missing table or seed data.", null, 400);
        }

        $table = $conn->real_escape_string($input['table']);
        $rows = $input['data'];
        $inserted = 0;

        foreach ($rows as $data) {
            $columns = implode("`, `", array_keys($data));
            $escapedValues = array_map(function($value) use ($conn) {
                if ($value === null || $value === 'null') {
                    return 'NULL';
                }
                $stringValue = is_array($value) || is_object($value) ? json_encode($value) : (string)$value;
                return "'" . $conn->real_escape_string($stringValue) . "'";
            }, array_values($data));
            $values = implode(", ", $escapedValues);
            $sql = "INSERT INTO `$table` (`$columns`) VALUES ($values)";
            if ($conn->query($sql)) $inserted++;
        }

        respond("success", "$inserted record(s) seeded successfully.");
        break;

    // HEALTH CHECK ACTION
    case 'health_check':
        logEvent('health_check', ['status' => 'success']);
        respond("success", "API is healthy and responding correctly.");
        break;

    // EMERGENCY: RESET ALL PINS TO 1234 (Public endpoint for recovery)
    case 'emergency_reset_pin':
        $newPassword = '1234';
        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);

        $stmt = $conn->prepare("UPDATE users SET password_hash = ?, updated_at = NOW()");
        $stmt->bind_param("s", $passwordHash);

        if ($stmt->execute()) {
            $affectedRows = $conn->affected_rows;
            $stmt->close();
            error_log("EMERGENCY: All user passwords reset to 1234. Affected rows: $affectedRows");
            respond("success", "Emergency reset complete. All users can now login with PIN: 1234", ["updated" => $affectedRows]);
        } else {
            $stmt->close();
            respond("error", "Failed to reset passwords: " . $conn->error, null, 500);
        }
        break;

    // AUTH: LOGIN
    case 'login':
        if (!isset($input['email']) || !isset($input['password'])) {
            logEvent('login_failed', ['reason' => 'missing_credentials']);
            respond("error", "Missing email or password.", null, 400);
        }

        $email = $conn->real_escape_string($input['email']);
        $password = $input['password'];

        logEvent('login_attempt', ['email' => $email]);

        $stmt = $conn->prepare("SELECT id, email, first_name, last_name, password_hash, status FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if (!$result || $result->num_rows === 0) {
            logEvent('login_failed', ['email' => $email, 'reason' => 'user_not_found']);
            respond("error", "Invalid email or password.", null, 401);
        }

        $user = $result->fetch_assoc();
        $stmt->close();

        if (!password_verify($password, $user['password_hash'])) {
            logEvent('login_failed', ['email' => $email, 'reason' => 'invalid_password']);
            respond("error", "Invalid email or password.", null, 401);
        }

        if ($user['status'] !== 'active') {
            logEvent('login_failed', ['email' => $email, 'reason' => 'inactive_account', 'status' => $user['status']]);
            respond("error", "User account is not active.", null, 403);
        }

        $token = base64_encode(json_encode([
            "id" => $user['id'],
            "email" => $user['email'],
            "ts" => time(),
            "exp" => time() + (7 * 24 * 60 * 60)
        ]));

        $now = date('Y-m-d H:i:s');
        $stmt = $conn->prepare("UPDATE users SET last_login = ? WHERE id = ?");
        $stmt->bind_param("ss", $now, $user['id']);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("SELECT user_type FROM user_profiles WHERE user_id = ? LIMIT 1");
        $stmt->bind_param("s", $user['id']);
        $stmt->execute();
        $profileResult = $stmt->get_result();
        $profile = $profileResult->fetch_assoc();
        $stmt->close();

        logEvent('login_success', [
            'email' => $user['email'],
            'user_id' => $user['id'],
            'user_type' => $profile['user_type'] ?? 'client'
        ]);

        respond("success", "Login successful.", [
            "user" => [
                "id" => $user['id'],
                "email" => $user['email'],
                "first_name" => $user['first_name'],
                "last_name" => $user['last_name']
            ],
            "profile" => $profile,
            "session" => [
                "access_token" => $token
            ]
        ]);
        break;

    // AUTH: SIGNUP
    case 'signup':
        if (!isset($input['email']) || !isset($input['password'])) {
            logEvent('signup_failed', ['reason' => 'missing_credentials']);
            respond("error", "Missing email or password.", null, 400);
        }

        $email = $conn->real_escape_string($input['email']);
        $password = $input['password'];

        // Handle both full_name (from frontend) and first_name/last_name (legacy)
        $firstName = '';
        $lastName = '';
        if (isset($input['full_name'])) {
            $fullName = trim($input['full_name']);
            $lastSpacePos = strrpos($fullName, ' ');
            if ($lastSpacePos !== false) {
                $firstName = substr($fullName, 0, $lastSpacePos);
                $lastName = substr($fullName, $lastSpacePos + 1);
            } else {
                $firstName = $fullName;
                $lastName = '';
            }
            $firstName = $conn->real_escape_string($firstName);
            $lastName = $conn->real_escape_string($lastName);
        } else {
            $firstName = isset($input['first_name']) ? $conn->real_escape_string($input['first_name']) : '';
            $lastName = isset($input['last_name']) ? $conn->real_escape_string($input['last_name']) : '';
        }

        // Handle both phone_number (from frontend) and phone (legacy)
        $phone = NULL;
        if (isset($input['phone_number'])) {
            $phone = $conn->real_escape_string($input['phone_number']);
        } elseif (isset($input['phone'])) {
            $phone = $conn->real_escape_string($input['phone']);
        }

        $country = isset($input['country']) ? $conn->real_escape_string($input['country']) : NULL;
        $userType = isset($input['user_type']) ? $conn->real_escape_string($input['user_type']) : 'client';
        $registrationPath = isset($input['registration_path']) ? $conn->real_escape_string($input['registration_path']) : 'direct';

        logEvent('signup_attempt', ['email' => $email, 'user_type' => $userType]);

        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $checkResult = $stmt->get_result();
        if ($checkResult->num_rows > 0) {
            $stmt->close();
            logEvent('signup_failed', ['email' => $email, 'reason' => 'user_already_exists']);
            respond("error", "User already exists.", null, 409);
        }
        $stmt->close();

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        $userId = 'user_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO users (
                id, email, password_hash, first_name, last_name,
                phone, country, status, email_verified, phone_verified,
                currency, kyc_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, 'KES', 'pending', ?, ?)
        ");
        $stmt->bind_param("sssssssss", $userId, $email, $passwordHash, $firstName, $lastName, $phone, $country, $now, $now);

        if (!$stmt->execute()) {
            $error = $stmt->error;
            $stmt->close();
            respond("error", "Failed to create user: " . $error, null, 500);
        }
        $stmt->close();

        $profileId = 'profile_' . uniqid();
        $fullName = trim($firstName . ' ' . $lastName);

        // Extract optional profile fields from signup request
        $areaOfResidence = isset($input['location_label']) ? $conn->real_escape_string($input['location_label']) : (isset($input['location']) ? $conn->real_escape_string($input['location']) : NULL);
        $areaCoordinates = NULL;
        if ((isset($input['location_lat']) && is_numeric($input['location_lat'])) && (isset($input['location_lng']) && is_numeric($input['location_lng']))) {
            $areaCoordinates = json_encode([
                'lat' => floatval($input['location_lat']),
                'lng' => floatval($input['location_lng'])
            ]);
        }
        $profileImage = isset($input['profile_image']) ? $conn->real_escape_string($input['profile_image']) : NULL;
        $bio = isset($input['bio']) ? $conn->real_escape_string($input['bio']) : NULL;

        $stmt = $conn->prepare("
            INSERT INTO user_profiles (
                id, user_id, user_type, full_name, phone_number, registration_path, path_locked,
                area_of_residence, area_coordinates, profile_image, bio, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("sssssssssss", $profileId, $userId, $userType, $fullName, $phone, $registrationPath,
                          $areaOfResidence, $areaCoordinates, $profileImage, $bio, $now);
        $stmt->execute();
        $stmt->close();

        // Send registration SMS (non-blocking)
        if (!empty($phone)) {
            @sendRegistrationSms($phone, [
                'id' => $userId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'phone' => $phone,
                'user_type' => $userType
            ]);
        }

        $token = base64_encode(json_encode([
            "id" => $userId,
            "email" => $email,
            "ts" => time(),
            "exp" => time() + (7 * 24 * 60 * 60)
        ]));

        logEvent('signup_success', [
            'email' => $email,
            'user_id' => $userId,
            'user_type' => $userType
        ]);

        respond("success", "Signup successful.", [
            "user" => [
                "id" => $userId,
                "email" => $email,
                "first_name" => $firstName,
                "last_name" => $lastName
            ],
            "profile" => [
                "user_type" => $userType
            ],
            "session" => [
                "access_token" => $token
            ]
        ]);
        break;

    // MIGRATE: Create users and password_reset_tokens tables
    case 'migrate':
        logEvent('migration_started');
        $sql = "
        CREATE TABLE IF NOT EXISTS `users` (
          `id` VARCHAR(36) PRIMARY KEY,
          `email` VARCHAR(255) NOT NULL UNIQUE,
          `phone` VARCHAR(20),
          `password_hash` VARCHAR(255) NOT NULL,
          `first_name` VARCHAR(100),
          `last_name` VARCHAR(100),
          `date_of_birth` DATE,
          `status` VARCHAR(50) DEFAULT 'active',
          `balance` DECIMAL(15, 2) DEFAULT 0,
          `currency` VARCHAR(3) DEFAULT 'KES',
          `country` VARCHAR(100),
          `email_verified` BOOLEAN DEFAULT FALSE,
          `phone_verified` BOOLEAN DEFAULT FALSE,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          `last_login` TIMESTAMP NULL,
          `kyc_status` VARCHAR(50) DEFAULT 'pending',
          INDEX idx_email (email),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";

        if ($conn->query($sql)) {
            logEvent('migration_success', ['table' => 'users']);
            respond("success", "Migration successful: users table created or already exists.");
        } else {
            logEvent('migration_failed', ['table' => 'users', 'error' => $conn->error]);
            respond("error", "Migration failed: " . $conn->error, null, 500);
        }

        $resetTokensTable = "
        CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
          `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          `user_id` VARCHAR(36) NOT NULL,
          `token` VARCHAR(255) NOT NULL UNIQUE,
          `expires_at` TIMESTAMP NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_token (token),
          INDEX idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";

        if ($conn->query($resetTokensTable)) {
            logEvent('migration_success', ['table' => 'password_reset_tokens']);
            respond("success", "Migration successful: users and password_reset_tokens tables created or already exist.");
        } else {
            logEvent('migration_failed', ['table' => 'password_reset_tokens', 'error' => $conn->error]);
            respond("error", "Migration failed: " . $conn->error, null, 500);
        }
        break;

    // MIGRATE: Create audit-fixed missing tables
    case 'apply_audit_migration':
        logEvent('audit_migration_started');

        $migrations = [
            'trainer_availability' => "
                CREATE TABLE IF NOT EXISTS `trainer_availability` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `trainer_id` VARCHAR(36) NOT NULL,
                  `slots` JSON NOT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_trainer_availability_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  UNIQUE KEY `uq_trainer_availability` (`trainer_id`),
                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_updated_at` (`updated_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'transactions' => "
                CREATE TABLE IF NOT EXISTS `transactions` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `user_id` VARCHAR(36) NOT NULL,
                  `type` VARCHAR(50) NOT NULL,
                  `amount` DECIMAL(15, 2) NOT NULL,
                  `balance_before` DECIMAL(15, 2),
                  `balance_after` DECIMAL(15, 2),
                  `reference` VARCHAR(255),
                  `description` TEXT,
                  `status` VARCHAR(50) DEFAULT 'completed',
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_transactions_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_user_id` (`user_id`),
                  INDEX `idx_type` (`type`),
                  INDEX `idx_created_at` (`created_at` DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'payout_requests' => "
                CREATE TABLE IF NOT EXISTS `payout_requests` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `trainer_id` VARCHAR(36) NOT NULL,
                  `amount` DECIMAL(15, 2) NOT NULL,
                  `status` VARCHAR(50) DEFAULT 'pending',
                  `payment_method_id` VARCHAR(36),
                  `notes` TEXT,
                  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `processed_at` TIMESTAMP NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_payout_requests_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'reported_issues' => "
                CREATE TABLE IF NOT EXISTS `reported_issues` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `user_id` VARCHAR(36) NOT NULL,
                  `trainer_id` VARCHAR(36),
                  `booking_reference` VARCHAR(100),
                  `complaint_type` VARCHAR(100),
                  `title` VARCHAR(255),
                  `description` TEXT NOT NULL,
                  `status` VARCHAR(50) DEFAULT 'open',
                  `priority` VARCHAR(50) DEFAULT 'normal',
                  `attachments` JSON,
                  `resolution` TEXT,
                  `resolved_at` TIMESTAMP NULL,
                  `assigned_to` VARCHAR(36),
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_reported_issues_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_user_id` (`user_id`),
                  INDEX `idx_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'user_wallets' => "
                CREATE TABLE IF NOT EXISTS `user_wallets` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `user_id` VARCHAR(36) NOT NULL UNIQUE,
                  `balance` DECIMAL(15, 2) DEFAULT 0,
                  `pending_balance` DECIMAL(15, 2) DEFAULT 0,
                  `total_earned` DECIMAL(15, 2) DEFAULT 0,
                  `total_spent` DECIMAL(15, 2) DEFAULT 0,
                  `total_refunded` DECIMAL(15, 2) DEFAULT 0,
                  `currency` VARCHAR(3) DEFAULT 'KES',
                  `last_transaction_at` TIMESTAMP NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_user_wallets_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_user_id` (`user_id`),
                  INDEX `idx_balance` (`balance`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'promotion_requests' => "
                CREATE TABLE IF NOT EXISTS `promotion_requests` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `trainer_id` VARCHAR(36) NOT NULL,
                  `promotion_type` VARCHAR(100),
                  `status` VARCHAR(50) DEFAULT 'pending',
                  `duration_days` INT,
                  `commission_rate` DECIMAL(5, 2) DEFAULT 0,
                  `cost` DECIMAL(15, 2) DEFAULT 0,
                  `features` JSON,
                  `approved_by` VARCHAR(36),
                  `started_at` TIMESTAMP NULL,
                  `expires_at` TIMESTAMP NULL,
                  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `approved_at` TIMESTAMP NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_promotion_requests_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'trainer_categories' => "
                CREATE TABLE IF NOT EXISTS `trainer_categories` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `trainer_id` VARCHAR(36) NOT NULL,
                  `category_id` INT NOT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_trainer_categories_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  CONSTRAINT `fk_trainer_categories_category_id`
                    FOREIGN KEY (`category_id`)
                    REFERENCES `categories`(`id`)
                    ON DELETE CASCADE,
                  UNIQUE KEY `uq_trainer_category` (`trainer_id`, `category_id`),
                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_category_id` (`category_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'trainer_category_pricing' => "
                CREATE TABLE IF NOT EXISTS `trainer_category_pricing` (
                  `id` VARCHAR(36) PRIMARY KEY,
                  `trainer_id` VARCHAR(36) NOT NULL,
                  `category_id` INT NOT NULL,
                  `hourly_rate` DECIMAL(10, 2) NOT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_trainer_category_pricing_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  CONSTRAINT `fk_trainer_category_pricing_category_id`
                    FOREIGN KEY (`category_id`)
                    REFERENCES `categories`(`id`)
                    ON DELETE CASCADE,
                  UNIQUE KEY `uq_trainer_category_pricing` (`trainer_id`, `category_id`),
                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_category_id` (`category_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'categories' => "
                CREATE TABLE IF NOT EXISTS `categories` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `name` VARCHAR(255) NOT NULL UNIQUE,
                  `icon` VARCHAR(50),
                  `description` TEXT,
                  `status` ENUM('active', 'archived') DEFAULT 'active' COMMENT 'Category status - active or archived',
                  `created_by_admin` BOOLEAN DEFAULT FALSE COMMENT 'Tracks if admin-created vs trainer-requested',
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX `idx_name` (`name`),
                  INDEX `idx_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'discipline_requests' => "
                CREATE TABLE IF NOT EXISTS `discipline_requests` (
                  `id` VARCHAR(36) PRIMARY KEY COMMENT 'Unique discipline request ID (UUID)',
                  `trainer_id` VARCHAR(36) NOT NULL COMMENT 'Trainer who submitted the request',
                  `category_name` VARCHAR(100) NOT NULL COMMENT 'Requested discipline name',
                  `category_icon` VARCHAR(50) COMMENT 'Suggested icon for the discipline',
                  `category_description` TEXT COMMENT 'Description of the discipline',
                  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Request status',
                  `admin_notes` TEXT COMMENT 'Admin notes when approving or rejecting',
                  `approved_category_id` INT COMMENT 'ID of the created category when approved',
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `reviewed_at` TIMESTAMP NULL COMMENT 'When the request was reviewed',
                  `reviewed_by_admin_id` VARCHAR(36) COMMENT 'Which admin reviewed this request',

                  CONSTRAINT `fk_discipline_requests_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  CONSTRAINT `fk_discipline_requests_category_id`
                    FOREIGN KEY (`approved_category_id`)
                    REFERENCES `categories`(`id`)
                    ON DELETE SET NULL,
                  CONSTRAINT `fk_discipline_requests_admin_id`
                    FOREIGN KEY (`reviewed_by_admin_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE SET NULL,

                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_status` (`status`),
                  INDEX `idx_created_at` (`created_at` DESC),
                  INDEX `idx_trainer_status` (`trainer_id`, `status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'services' => "
                CREATE TABLE IF NOT EXISTS `services` (
                  `id` VARCHAR(36) PRIMARY KEY,
                  `trainer_id` VARCHAR(36) NOT NULL,
                  `title` VARCHAR(255) NOT NULL,
                  `description` TEXT,
                  `price` DECIMAL(15, 2) NOT NULL,
                  `duration_minutes` INT,
                  `is_active` BOOLEAN DEFAULT TRUE,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_services_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_is_active` (`is_active`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            "
        ];

        $successCount = 0;
        $failureCount = 0;
        $messages = [];

        foreach ($migrations as $tableName => $sql) {
            if ($conn->query($sql)) {
                $successCount++;
                $messages[] = "✓ $tableName created";
                logEvent('audit_migration_success', ['table' => $tableName]);
            } else {
                $failureCount++;
                $messages[] = "✗ $tableName failed: " . $conn->error;
                logEvent('audit_migration_failed', ['table' => $tableName, 'error' => $conn->error]);
            }
        }

        // Enhance existing categories table with new columns if they don't exist
        $alterStatements = [
            "ALTER TABLE `categories` ADD COLUMN `status` ENUM('active', 'pending_approval', 'archived', 'rejected') DEFAULT 'active' COMMENT 'Category status - active, pending_approval, archived, or rejected'",
            "ALTER TABLE `categories` ADD COLUMN `created_by_admin` BOOLEAN DEFAULT FALSE COMMENT 'Tracks if admin-created vs trainer-requested'",
            "ALTER TABLE `categories` ADD COLUMN `created_by` VARCHAR(36) COMMENT 'UUID of admin who created this category'",
            "ALTER TABLE `categories` ADD COLUMN `reviewed_by` VARCHAR(36) COMMENT 'UUID of admin who reviewed/approved this category'",
            "ALTER TABLE `categories` ADD COLUMN `rejection_reason` TEXT COMMENT 'Reason for category rejection'",
            "ALTER TABLE `categories` ADD COLUMN `reviewed_at` TIMESTAMP NULL COMMENT 'When this category was reviewed/approved/rejected'",
            "ALTER TABLE `categories` ADD INDEX `idx_status` (`status`)",
            "ALTER TABLE `categories` ADD INDEX `idx_created_by` (`created_by`)",
            "ALTER TABLE `categories` ADD INDEX `idx_reviewed_by` (`reviewed_by`)"
        ];

        foreach ($alterStatements as $alterSql) {
            // Check if column exists before altering
            if (strpos($alterSql, 'ADD COLUMN') !== false && strpos($alterSql, 'idx_') === false) {
                $columnName = preg_match('/`(\w+)`/', $alterSql, $matches) ? $matches[1] : null;
                if ($columnName) {
                    $checkResult = @$conn->query("SHOW COLUMNS FROM categories LIKE '$columnName'");
                    if ($checkResult && $checkResult->num_rows === 0) {
                        if ($conn->query($alterSql)) {
                            $messages[] = "✓ Enhanced categories table with $columnName";
                        } else {
                            $messages[] = "⚠ Could not add $columnName: " . $conn->error;
                        }
                    }
                }
            } else if (strpos($alterSql, 'ADD INDEX') !== false) {
                // Extract index name
                $indexName = preg_match('/`idx_(\w+)`/', $alterSql, $matches) ? 'idx_' . $matches[1] : null;
                if ($indexName) {
                    $indexResult = @$conn->query("SHOW INDEX FROM categories WHERE Key_name = '$indexName'");
                    if (!$indexResult || $indexResult->num_rows === 0) {
                        if ($conn->query($alterSql)) {
                            $messages[] = "✓ Added index $indexName to categories table";
                        } else {
                            $messages[] = "⚠ Could not add index $indexName: " . $conn->error;
                        }
                    }
                }
            }
        }

        // Enhance discipline_requests table with submission tracking fields
        $disciplineAlterStatements = [
            "ALTER TABLE `discipline_requests` ADD COLUMN `submitted_by` VARCHAR(36) COMMENT 'Trainer ID who submitted the request (alias for trainer_id)'",
            "ALTER TABLE `discipline_requests` ADD COLUMN `submitted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the discipline was submitted'",
            "ALTER TABLE `discipline_requests` ADD INDEX `idx_submitted_by` (`submitted_by`)",
            "ALTER TABLE `discipline_requests` ADD INDEX `idx_reviewed_at` (`reviewed_at`)"
        ];

        foreach ($disciplineAlterStatements as $alterSql) {
            if (strpos($alterSql, 'ADD COLUMN') !== false) {
                $columnName = preg_match('/`(\w+)`/', $alterSql, $matches) ? $matches[1] : null;
                if ($columnName) {
                    $checkResult = @$conn->query("SHOW COLUMNS FROM discipline_requests LIKE '$columnName'");
                    if ($checkResult && $checkResult->num_rows === 0) {
                        if ($conn->query($alterSql)) {
                            $messages[] = "✓ Enhanced discipline_requests table with $columnName";
                        } else {
                            $messages[] = "⚠ Could not add $columnName to discipline_requests: " . $conn->error;
                        }
                    }
                }
            } else if (strpos($alterSql, 'ADD INDEX') !== false) {
                $indexName = preg_match('/`idx_(\w+)`/', $alterSql, $matches) ? 'idx_' . $matches[1] : null;
                if ($indexName) {
                    $indexResult = @$conn->query("SHOW INDEX FROM discipline_requests WHERE Key_name = '$indexName'");
                    if (!$indexResult || $indexResult->num_rows === 0) {
                        if ($conn->query($alterSql)) {
                            $messages[] = "✓ Added index $indexName to discipline_requests table";
                        } else {
                            $messages[] = "⚠ Could not add index $indexName: " . $conn->error;
                        }
                    }
                }
            }
        }

        // Enhance user_profiles table with location columns for distance calculation
        $userProfileAlterStatements = [
            "ALTER TABLE `user_profiles` ADD COLUMN `location_lat` DECIMAL(10, 8) COMMENT 'Trainer latitude coordinate'",
            "ALTER TABLE `user_profiles` ADD COLUMN `location_lng` DECIMAL(11, 8) COMMENT 'Trainer longitude coordinate'",
            "ALTER TABLE `user_profiles` ADD COLUMN `location_label` VARCHAR(255) COMMENT 'Location name/address'",
            "ALTER TABLE `user_profiles` ADD COLUMN `location_updated_at` TIMESTAMP NULL COMMENT 'When location was last updated'",
            "ALTER TABLE `user_profiles` ADD COLUMN `service_radius` FLOAT DEFAULT 10 COMMENT 'Service radius in kilometers'",
            "ALTER TABLE `user_profiles` ADD COLUMN `auto_service_radius` BOOLEAN DEFAULT FALSE COMMENT 'Whether radius was auto-calculated'",
            "ALTER TABLE `user_profiles` ADD INDEX `idx_location_lat_lng` (`location_lat`, `location_lng`)"
        ];

        foreach ($userProfileAlterStatements as $alterSql) {
            if (strpos($alterSql, 'ADD COLUMN') !== false) {
                $columnName = preg_match('/`(\w+)`/', $alterSql, $matches) ? $matches[1] : null;
                if ($columnName) {
                    $checkResult = @$conn->query("SHOW COLUMNS FROM user_profiles LIKE '$columnName'");
                    if ($checkResult && $checkResult->num_rows === 0) {
                        if ($conn->query($alterSql)) {
                            $messages[] = "✓ Enhanced user_profiles table with $columnName";
                        } else {
                            $messages[] = "⚠ Could not add $columnName to user_profiles: " . $conn->error;
                        }
                    }
                }
            } else if (strpos($alterSql, 'ADD INDEX') !== false) {
                $indexName = preg_match('/`idx_(\w+)`/', $alterSql, $matches) ? 'idx_' . $matches[1] : null;
                if ($indexName) {
                    $indexResult = @$conn->query("SHOW INDEX FROM user_profiles WHERE Key_name = '$indexName'");
                    if (!$indexResult || $indexResult->num_rows === 0) {
                        if ($conn->query($alterSql)) {
                            $messages[] = "✓ Added index $indexName to user_profiles table";
                        } else {
                            $messages[] = "⚠ Could not add index $indexName: " . $conn->error;
                        }
                    }
                }
            }
        }

        if ($failureCount === 0) {
            respond("success", "All audit migrations applied successfully.", [
                "created" => $successCount,
                "failed" => $failureCount,
                "messages" => $messages
            ]);
        } else {
            respond("success", "Audit migration completed with $failureCount error(s).", [
                "created" => $successCount,
                "failed" => $failureCount,
                "messages" => $messages
            ]);
        }
        break;

    // SEED_USERS: Create test users
    case 'seed_users':
        logEvent('seed_users_started');
        $testUsers = [
            [
                'email' => 'admin@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Admin',
                'last_name' => 'User',
                'phone' => '+254712345601',
                'country' => 'Kenya',
            ],
            [
                'email' => 'trainer@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Trainer',
                'last_name' => 'User',
                'phone' => '+254712345602',
                'country' => 'Kenya',
            ],
            [
                'email' => 'client@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Client',
                'last_name' => 'User',
                'phone' => '+254712345603',
                'country' => 'Kenya',
            ],
        ];

        $seeded = 0;
        $skipped = 0;
        $errors = [];

        foreach ($testUsers as $user) {
            $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $stmt->bind_param("s", $user['email']);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result && $result->num_rows > 0) {
                $stmt->close();
                $skipped++;
                continue;
            }
            $stmt->close();

            $id = 'user_' . uniqid();
            $passwordHash = password_hash($user['password'], PASSWORD_BCRYPT);

            $stmt = $conn->prepare("
                INSERT INTO users (
                    id, email, phone, password_hash,
                    first_name, last_name, country,
                    status, email_verified, phone_verified,
                    currency, kyc_status, created_at
                ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    'active', 1, 0,
                    'KES', 'pending', NOW()
                )
            ");
            $stmt->bind_param("sssssss", $id, $user['email'], $user['phone'], $passwordHash, $user['first_name'], $user['last_name'], $user['country']);

            if ($stmt->execute()) {
                $seeded++;
            } else {
                $errors[] = "{$user['email']}: " . $stmt->error;
            }
            $stmt->close();
        }

        $message = "Seeding complete: $seeded created, $skipped already exist.";
        if (!empty($errors)) {
            respond("success", $message . " Errors: " . implode("; ", $errors), ["seeded" => $seeded, "skipped" => $skipped]);
        } else {
            respond("success", $message, ["seeded" => $seeded, "skipped" => $skipped]);
        }
        break;

    // GET ALL USERS WITH PROFILES
    case 'get_users':
        $sql = "
            SELECT
                u.id, u.email, u.phone, u.first_name, u.last_name, u.status,
                u.created_at, u.updated_at,
                up.user_id, up.user_type, up.full_name, up.phone_number, up.bio,
                up.profile_image, up.hourly_rate, up.rating, up.total_reviews,
                up.is_approved
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            ORDER BY u.created_at DESC
        ";

        $result = $conn->query($sql);
        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $users = [];
        while ($row = $result->fetch_assoc()) {
            // Normalize image URLs
            if (!empty($row['profile_image'])) {
                $row['profile_image'] = normalizeImageUrl($row['profile_image']);
            }
            $users[] = $row;
        }

        respond("success", "Users fetched successfully.", ["data" => $users]);
        break;

    // SEED ALL TEST USERS
    case 'seed_all_users':
        $createProfilesTable = "
            CREATE TABLE IF NOT EXISTS `user_profiles` (
                `id` VARCHAR(36) PRIMARY KEY,
                `user_id` VARCHAR(36) NOT NULL UNIQUE,
                `user_type` VARCHAR(50) NOT NULL DEFAULT 'client',
                `full_name` VARCHAR(255),
                `phone_number` VARCHAR(20),
                `bio` TEXT,
                `profile_image` VARCHAR(255),
                `disciplines` JSON,
                `certifications` JSON,
                `hourly_rate` DECIMAL(10, 2),
                `service_radius` INT DEFAULT 5,
                `availability` JSON,
                `rating` DECIMAL(3, 2),
                `total_reviews` INT DEFAULT 0,
                `is_approved` BOOLEAN DEFAULT FALSE,
                `account_status` ENUM('registered', 'profile_incomplete', 'pending_approval', 'approved', 'suspended') DEFAULT 'registered',
                `registration_path` ENUM('direct', 'sponsored') DEFAULT 'direct' NOT NULL,
                `path_locked` BOOLEAN DEFAULT 0,
                `area_of_residence` VARCHAR(255),
                `area_coordinates` JSON,
                `mpesa_number` VARCHAR(20),
                `sponsor_id` VARCHAR(36),
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_user_type (user_type),
                INDEX idx_account_status (account_status),
                INDEX idx_registration_path (registration_path),
                INDEX idx_path_locked (path_locked),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->query($createProfilesTable);

        // Create verification_documents table
        $createVerificationTable = "
            CREATE TABLE IF NOT EXISTS `verification_documents` (
                `id` VARCHAR(36) PRIMARY KEY,
                `trainer_id` VARCHAR(36) NOT NULL,
                `document_type` ENUM('national_id', 'proof_of_residence', 'certificate_of_good_conduct', 'discipline_certificate', 'sponsor_reference') NOT NULL,
                `file_url` VARCHAR(500),
                `file_path` VARCHAR(500),
                `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                `rejection_reason` TEXT,
                `id_number` VARCHAR(50),
                `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `reviewed_at` TIMESTAMP NULL,
                `reviewed_by` VARCHAR(36),
                `expires_at` TIMESTAMP NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_trainer_id (trainer_id),
                INDEX idx_document_type (document_type),
                INDEX idx_status (status),
                UNIQUE KEY unique_trainer_doc_type (trainer_id, document_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->query($createVerificationTable);

        // Create discipline_recommendations table
        $createDisciplineRecommendationsTable = "
            CREATE TABLE IF NOT EXISTS `discipline_recommendations` (
                `id` VARCHAR(36) PRIMARY KEY,
                `trainer_id` VARCHAR(36) NOT NULL,
                `discipline_name` VARCHAR(255) NOT NULL,
                `description` TEXT,
                `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                `admin_notes` TEXT,
                `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `reviewed_at` TIMESTAMP NULL,
                `reviewed_by` VARCHAR(36),
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_trainer_id (trainer_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->query($createDisciplineRecommendationsTable);

        // Create sponsor_commissions table
        $createSponsorCommissionsTable = "
            CREATE TABLE IF NOT EXISTS `sponsor_commissions` (
                `id` VARCHAR(36) PRIMARY KEY,
                `sponsor_trainer_id` VARCHAR(36) NOT NULL,
                `sponsored_trainer_id` VARCHAR(36) NOT NULL,
                `booking_id` VARCHAR(36),
                `payment_id` VARCHAR(36),
                `commission_amount` DECIMAL(15, 2) NOT NULL,
                `status` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `paid_at` TIMESTAMP NULL,
                FOREIGN KEY (sponsor_trainer_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (sponsored_trainer_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_sponsor_trainer_id (sponsor_trainer_id),
                INDEX idx_sponsored_trainer_id (sponsored_trainer_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->query($createSponsorCommissionsTable);

        $testUsers = [
            [
                'email' => 'admin@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Admin',
                'last_name' => 'User',
                'user_type' => 'admin',
                'phone' => '+254712345601',
            ],
            [
                'email' => 'trainer@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Trainer',
                'last_name' => 'User',
                'user_type' => 'trainer',
                'phone' => '+254712345602',
            ],
            [
                'email' => 'client@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Client',
                'last_name' => 'User',
                'user_type' => 'client',
                'phone' => '+254712345603',
            ],
        ];

        $seeded = 0;
        $skipped = 0;
        $errors = [];
        $now = date('Y-m-d H:i:s');

        foreach ($testUsers as $user) {
            $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $stmt->bind_param("s", $user['email']);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result && $result->num_rows > 0) {
                $stmt->close();
                $skipped++;
                continue;
            }
            $stmt->close();

            $userId = 'user_' . uniqid();
            $profileId = 'profile_' . uniqid();
            $passwordHash = password_hash($user['password'], PASSWORD_BCRYPT);
            $fullName = trim($user['first_name'] . ' ' . $user['last_name']);

            $stmt = $conn->prepare("
                INSERT INTO users (
                    id, email, phone, password_hash,
                    first_name, last_name, status,
                    email_verified, phone_verified,
                    currency, kyc_status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, 0, 'KES', 'pending', ?)
            ");
            $stmt->bind_param("sssssss", $userId, $user['email'], $user['phone'], $passwordHash, $user['first_name'], $user['last_name'], $now);

            if ($stmt->execute()) {
                $stmt->close();

                $stmt = $conn->prepare("
                    INSERT INTO user_profiles (
                        id, user_id, user_type, full_name, phone_number, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->bind_param("ssssss", $profileId, $userId, $user['user_type'], $fullName, $user['phone'], $now);

                if ($stmt->execute()) {
                    $seeded++;
                } else {
                    $errors[] = "Profile creation failed for {$user['email']}: " . $stmt->error;
                    $seeded++;
                }
                $stmt->close();
            } else {
                $errors[] = "User creation failed for {$user['email']}: " . $stmt->error;
                $stmt->close();
            }
        }

        $message = "Seeding complete: $seeded created, $skipped already exist.";
        if (!empty($errors)) {
            respond("success", $message . " (with " . count($errors) . " warning(s))", [
                "seeded" => $seeded,
                "skipped" => $skipped,
                "errors" => $errors
            ]);
        } else {
            respond("success", $message, [
                "seeded" => $seeded,
                "skipped" => $skipped
            ]);
        }
        break;

    // GET CURRENT USER TYPE
    case 'get_user_type':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $sql = "SELECT user_type FROM user_profiles WHERE user_id = '$userId' LIMIT 1";
        $result = $conn->query($sql);

        if ($result->num_rows === 0) {
            respond("success", "User type fetched (default: client).", ["user_type" => "client"]);
        }

        $row = $result->fetch_assoc();
        respond("success", "User type fetched.", ["user_type" => $row['user_type'] ?? 'client']);
        break;

    // CHECK IF EMAIL EXISTS
    case 'check_email_exists':
        if (!isset($input['email'])) {
            respond("error", "Email is required.", null, 400);
        }

        $email = $conn->real_escape_string($input['email']);
        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        $exists = $result->num_rows > 0;
        respond("success", "Email check complete.", ["exists" => $exists]);
        break;

    // CHECK IF PHONE EXISTS
    case 'check_phone_exists':
        if (!isset($input['phone_number'])) {
            respond("error", "Phone number is required.", null, 400);
        }

        $phone = $conn->real_escape_string($input['phone_number']);
        $stmt = $conn->prepare("SELECT id FROM users WHERE phone = ? LIMIT 1");
        $stmt->bind_param("s", $phone);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        $exists = $result->num_rows > 0;
        respond("success", "Phone check complete.", ["exists" => $exists]);
        break;

    // REQUEST PASSWORD RESET
    case 'request_password_reset':
        if (!isset($input['email'])) {
            respond("error", "Email is required.", null, 400);
        }

        $email = $conn->real_escape_string($input['email']);

        $stmt = $conn->prepare("SELECT id, email, first_name FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if (!$result || $result->num_rows === 0) {
            error_log("Password reset requested for non-existent email: " . $email);
            respond("success", "If an account exists with this email, you will receive a password reset link.");
        }

        $user = $result->fetch_assoc();
        $stmt->close();

        $resetToken = bin2hex(random_bytes(32));
        $tokenExpiry = date('Y-m-d H:i:s', strtotime('+1 hour'));

        $stmt = $conn->prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, NOW())");
        $stmt->bind_param("sss", $user['id'], $resetToken, $tokenExpiry);

        if ($stmt->execute()) {
            error_log("Password reset token generated for: " . $email);
            $stmt->close();

            respond("success", "Password reset link has been sent to your email.", [
                "email" => $email,
                "token" => $resetToken
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to generate reset link. Please try again.", null, 500);
        }
        break;

    // RESET PASSWORD WITH TOKEN
    case 'reset_password_with_token':
        if (!isset($input['email']) || !isset($input['token']) || !isset($input['new_password'])) {
            respond("error", "Email, token, and new password are required.", null, 400);
        }

        $email = $conn->real_escape_string($input['email']);
        $token = $conn->real_escape_string($input['token']);
        $newPassword = $input['new_password'];

        if (strlen($newPassword) < 8) {
            respond("error", "Password must be at least 8 characters long.", null, 400);
        }

        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $userResult = $stmt->get_result();

        if (!$userResult || $userResult->num_rows === 0) {
            respond("error", "User not found.", null, 404);
        }

        $user = $userResult->fetch_assoc();
        $stmt->close();

        $now = date('Y-m-d H:i:s');
        $stmt = $conn->prepare("SELECT id FROM password_reset_tokens WHERE user_id = ? AND token = ? AND expires_at > ? LIMIT 1");
        $stmt->bind_param("sss", $user['id'], $token, $now);
        $stmt->execute();
        $tokenResult = $stmt->get_result();

        if (!$tokenResult || $tokenResult->num_rows === 0) {
            error_log("Invalid or expired password reset token for: " . $email);
            respond("error", "Reset link is invalid or has expired.", null, 401);
        }

        $stmt->close();

        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);

        $stmt = $conn->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
        $stmt->bind_param("ss", $passwordHash, $user['id']);

        if (!$stmt->execute()) {
            $stmt->close();
            respond("error", "Failed to update password. Please try again.", null, 500);
        }

        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM password_reset_tokens WHERE user_id = ? AND token = ?");
        $stmt->bind_param("ss", $user['id'], $token);
        $stmt->execute();
        $stmt->close();

        error_log("Password reset successful for: " . $email);
        respond("success", "Password has been reset successfully.");
        break;

    // RESET PASSWORDS: Reset all test user passwords
    case 'reset_passwords':
        $newPassword = isset($input['password']) ? $input['password'] : 'Test123';

        if (strlen($newPassword) < 6) {
            respond("error", "Password must be at least 6 characters long.", null, 400);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);

        $testEmails = ['admin@skatryk.co.ke', 'trainer@skatryk.co.ke', 'client@skatryk.co.ke'];
        $updated = 0;
        $errors = [];

        foreach ($testEmails as $email) {
            $stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
            $stmt->bind_param("ss", $passwordHash, $email);

            if ($stmt->execute()) {
                $updated++;
                error_log("Password reset for: " . $email);
            } else {
                $errors[] = "{$email}: " . $stmt->error;
            }
            $stmt->close();
        }

        if (!empty($errors)) {
            respond("success", "Password reset complete: $updated users updated. Errors: " . implode("; ", $errors), ["updated" => $updated, "errors" => $errors]);
        } else {
            respond("success", "Password reset complete: $updated users updated to '$newPassword'.", ["updated" => $updated]);
        }
        break;

    // RESET ALL USER PASSWORDS - Admin only
    case 'reset_all_user_passwords':
        validateAdminAuthorization($conn);

        $newPassword = isset($input['password']) ? $input['password'] : '1234';

        // Hash the password
        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);

        // Update all users
        $stmt = $conn->prepare("UPDATE users SET password_hash = ?, updated_at = NOW()");
        $stmt->bind_param("s", $passwordHash);

        if ($stmt->execute()) {
            $affectedRows = $conn->affected_rows;
            $stmt->close();
            error_log("Admin reset all user passwords. Affected rows: $affectedRows");
            respond("success", "All user passwords reset successfully.", ["updated" => $affectedRows, "password" => $newPassword]);
        } else {
            $stmt->close();
            respond("error", "Failed to reset passwords: " . $conn->error, null, 500);
        }
        break;

    // SEND AUDIT LOG
    case 'audit':
        $action = isset($input['action']) ? $conn->real_escape_string($input['action']) : 'unknown';
        $target = isset($input['target']) ? $conn->real_escape_string($input['target']) : null;
        $details = isset($input['details']) ? json_encode($input['details']) : null;
        $actor = isset($_SERVER['HTTP_X_ADMIN_ACTOR']) ? $conn->real_escape_string($_SERVER['HTTP_X_ADMIN_ACTOR']) : null;

        $now = date('Y-m-d H:i:s');
        $sql = "INSERT INTO audit_logs (action, target_id, details, actor, created_at)
                VALUES ('$action', '$target', '$details', '$actor', '$now')";

        $conn->query($sql);
        respond("success", "Audit logged.");
        break;

    // APPROVE TRAINER
    case 'approve_trainer':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $stmt = $conn->prepare("UPDATE user_profiles SET is_approved = 1 WHERE user_id = ?");
        $stmt->bind_param("s", $userId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_approved', ['user_id' => $userId]);
            respond("success", "Trainer approved successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to approve trainer: " . $conn->error, null, 500);
        }
        break;

    // REJECT TRAINER
    case 'reject_trainer':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);

        $stmt = $conn->prepare("DELETE FROM user_profiles WHERE user_id = ?");
        $stmt->bind_param("s", $userId);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("s", $userId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_rejected', ['user_id' => $userId]);
            respond("success", "Trainer rejected and deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to reject trainer: " . $conn->error, null, 500);
        }
        break;

    // DELETE USER
    case 'delete_user':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);

        $stmt = $conn->prepare("DELETE FROM user_profiles WHERE user_id = ?");
        $stmt->bind_param("s", $userId);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("s", $userId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('user_deleted', ['user_id' => $userId]);
            respond("success", "User deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to delete user: " . $conn->error, null, 500);
        }
        break;

    // UPDATE USER TYPE
    case 'update_user_type':
        if (!isset($input['user_id']) || !isset($input['user_type'])) {
            respond("error", "Missing user_id or user_type.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $userType = $conn->real_escape_string($input['user_type']);

        $stmt = $conn->prepare("UPDATE user_profiles SET user_type = ? WHERE user_id = ?");
        $stmt->bind_param("ss", $userType, $userId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('user_type_updated', ['user_id' => $userId, 'new_type' => $userType]);
            respond("success", "User type updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to update user type: " . $conn->error, null, 500);
        }
        break;

    // CHECK TRAINER PROFILE COMPLETION
    case 'trainer_check_profile_completion':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $stmt = $conn->prepare("
            SELECT
                user_id,
                CASE WHEN profile_image IS NOT NULL AND profile_image != '' THEN 1 ELSE 0 END as has_image,
                CASE WHEN disciplines IS NOT NULL AND JSON_LENGTH(disciplines) > 0 THEN 1 ELSE 0 END as has_disciplines,
                CASE WHEN bio IS NOT NULL AND bio != '' THEN 1 ELSE 0 END as has_bio,
                CASE WHEN hourly_rate > 0 THEN 1 ELSE 0 END as has_rate,
                CASE WHEN area_of_residence IS NOT NULL AND area_of_residence != '' THEN 1 ELSE 0 END as has_area,
                CASE WHEN service_radius > 0 THEN 1 ELSE 0 END as has_radius,
                CASE WHEN mpesa_number IS NOT NULL AND mpesa_number != '' THEN 1 ELSE 0 END as has_mpesa
            FROM user_profiles
            WHERE user_id = ?
        ");
        $stmt->bind_param("s", $userId);

        if ($stmt->execute()) {
            $result = $stmt->get_result();
            if ($result->num_rows === 0) {
                $stmt->close();
                respond("error", "User profile not found.", null, 404);
            }

            $row = $result->fetch_assoc();
            $stmt->close();

            $allComplete = ($row['has_image'] && $row['has_disciplines'] && $row['has_bio'] &&
                          $row['has_rate'] && $row['has_area'] && $row['has_radius'] && $row['has_mpesa']);

            // Auto-update status if profile is complete and not already updated
            if ($allComplete) {
                $updateStmt = $conn->prepare("
                    UPDATE user_profiles
                    SET account_status = 'profile_incomplete'
                    WHERE user_id = ? AND account_status = 'registered'
                ");
                $updateStmt->bind_param("s", $userId);
                $updateStmt->execute();
                $updateStmt->close();
            }

            respond("success", "Profile completion check done.", [
                "profile_complete" => $allComplete,
                "fields" => $row
            ]);
        } else {
            $stmt->close();
            respond("error", "Query failed: " . $conn->error, null, 500);
        }
        break;

    // CHECK TRAINER DOCUMENTS SUBMISSION
    case 'trainer_check_documents_submission':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);

        // Get trainer's registration path and sponsor info
        $stmt = $conn->prepare("
            SELECT registration_path, sponsor_trainer_id, path_locked
            FROM user_profiles
            WHERE user_id = ?
        ");
        $stmt->bind_param("s", $userId);
        $stmt->execute();
        $profileResult = $stmt->get_result();
        $profile = $profileResult->fetch_assoc();
        $stmt->close();

        if (!$profile) {
            respond("error", "User profile not found.", null, 404);
        }

        $registrationPath = $profile['registration_path'];
        $sponsorTrainerId = $profile['sponsor_trainer_id'];

        // Determine required docs based on registration path
        if ($registrationPath === 'sponsored') {
            $requiredDocs = ['national_id', 'proof_of_residence', 'certificate_of_good_conduct'];

            // For sponsored path, sponsor_trainer_id must be set and valid
            if (!$sponsorTrainerId) {
                respond("error", "Sponsored trainers must select a sponsor trainer.", null, 400);
            }

            // Verify sponsor exists and is approved
            $stmt = $conn->prepare("SELECT is_approved FROM user_profiles WHERE user_id = ? LIMIT 1");
            $stmt->bind_param("s", $sponsorTrainerId);
            $stmt->execute();
            $sponsorResult = $stmt->get_result();
            $sponsor = $sponsorResult->fetch_assoc();
            $stmt->close();

            if (!$sponsor || !$sponsor['is_approved']) {
                respond("error", "Selected sponsor trainer is not approved.", null, 400);
            }
        } else {
            // Direct registration requires all 5 documents
            $requiredDocs = ['national_id', 'proof_of_residence', 'certificate_of_good_conduct', 'discipline_certificate', 'sponsor_reference'];
        }

        // Get submitted documents
        $stmt = $conn->prepare("
            SELECT
                document_type,
                status,
                uploaded_at
            FROM verification_documents
            WHERE trainer_id = ?
        ");
        $stmt->bind_param("s", $userId);

        if ($stmt->execute()) {
            $result = $stmt->get_result();
            $documents = [];
            $submittedDocs = [];

            while ($row = $result->fetch_assoc()) {
                $documents[] = $row;
                if ($row['status'] === 'pending' || $row['status'] === 'approved') {
                    $submittedDocs[] = $row['document_type'];
                }
            }
            $stmt->close();

            // Check if all required docs are submitted (at least pending)
            $allSubmitted = count(array_intersect($requiredDocs, $submittedDocs)) === count($requiredDocs);

            // Auto-update status and lock path if all docs submitted and not already updated
            if ($allSubmitted) {
                $updateStmt = $conn->prepare("
                    UPDATE user_profiles
                    SET account_status = 'pending_approval', path_locked = 1
                    WHERE user_id = ? AND account_status = 'profile_incomplete'
                ");
                $updateStmt->bind_param("s", $userId);
                $updateStmt->execute();
                $updateStmt->close();
            }

            respond("success", "Documents submission check done.", [
                "all_submitted" => $allSubmitted,
                "registration_path" => $registrationPath,
                "required_docs" => $requiredDocs,
                "submitted_docs" => $submittedDocs,
                "documents" => $documents
            ]);
        } else {
            $stmt->close();
            respond("error", "Query failed: " . $conn->error, null, 500);
        }
        break;

    // SET TRAINER ACCOUNT STATUS (Admin only)
    case 'trainer_set_account_status':
        $adminId = verifyAdminToken();
        if (!$adminId) exit; // verifyAdminToken handles the response

        if (!isset($input['user_id']) || !isset($input['status'])) {
            respond("error", "Missing user_id or status.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $status = $conn->real_escape_string($input['status']);

        // Validate status enum
        $validStatuses = ['registered', 'profile_incomplete', 'pending_approval', 'approved', 'suspended'];
        if (!in_array($status, $validStatuses)) {
            respond("error", "Invalid status value.", null, 400);
        }

        $stmt = $conn->prepare("
            UPDATE user_profiles
            SET account_status = ?, updated_at = NOW()
            WHERE user_id = ?
        ");
        $stmt->bind_param("ss", $status, $userId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_status_set', ['user_id' => $userId, 'status' => $status, 'admin_id' => $adminId]);
            respond("success", "Trainer account status updated.", ["status" => $status]);
        } else {
            $stmt->close();
            respond("error", "Failed to update status: " . $conn->error, null, 500);
        }
        break;

    // GENERIC FILE UPLOAD (for profile images and other files)
    case 'file_upload':
        $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $uploadDir = 'uploads/';

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $uploaded = [];
        $errors = [];

        if (isset($_FILES['files'])) {
            // Handle both single and multiple file uploads
            $fileCount = is_array($_FILES['files']['name']) ? count($_FILES['files']['name']) : 1;

            for ($i = 0; $i < $fileCount; $i++) {
                $file = [];
                if (is_array($_FILES['files']['name'])) {
                    $file = [
                        'name' => $_FILES['files']['name'][$i],
                        'tmp_name' => $_FILES['files']['tmp_name'][$i],
                        'size' => $_FILES['files']['size'][$i],
                        'type' => $_FILES['files']['type'][$i],
                        'error' => $_FILES['files']['error'][$i]
                    ];
                } else {
                    $file = $_FILES['files'];
                }

                if ($file['error'] !== 0) {
                    $errors[] = $file['name'] . ': Upload error';
                    continue;
                }

                if ($file['size'] > 5 * 1024 * 1024) {
                    $errors[] = $file['name'] . ': File too large (max 5MB)';
                    continue;
                }

                if (!in_array($file['type'], $allowedMimes)) {
                    $errors[] = $file['name'] . ': Invalid file type. Only JPG, PNG, GIF allowed';
                    continue;
                }

                $fileName = uniqid() . '_' . basename($file['name']);
                $filePath = $uploadDir . $fileName;
                $uploadBase = getenv('UPLOAD_BASE_URL') ?: 'https://trainercoachconnect.com/uploads/';
                $fileUrl = rtrim($uploadBase, '/') . '/' . $fileName;

                if (move_uploaded_file($file['tmp_name'], $filePath)) {
                    $uploaded[] = [
                        'originalName' => $file['name'],
                        'fileName' => $fileName,
                        'url' => $fileUrl,
                        'size' => $file['size'],
                        'mimeType' => $file['type'],
                        'uploadedAt' => date('Y-m-d H:i:s')
                    ];
                } else {
                    $errors[] = $file['name'] . ': Failed to save file';
                }
            }
        } else {
            $errors[] = 'No files provided';
        }

        respond("success", "File upload completed", [
            'uploaded' => $uploaded,
            'errors' => $errors,
            'count' => count($uploaded)
        ]);
        break;

    // UPLOAD VERIFICATION DOCUMENT
    case 'verification_document_upload':
        // Debug logging
        error_log('[VERIFICATION_DOCUMENT_UPLOAD] REQUEST RECEIVED');
        error_log('[VERIFICATION_DOCUMENT_UPLOAD] $_FILES keys: ' . json_encode(array_keys($_FILES)));
        error_log('[VERIFICATION_DOCUMENT_UPLOAD] $_POST keys: ' . json_encode(array_keys($_POST)));
        error_log('[VERIFICATION_DOCUMENT_UPLOAD] $input keys: ' . json_encode(array_keys($input)));
        error_log('[VERIFICATION_DOCUMENT_UPLOAD] Full $_FILES: ' . json_encode($_FILES, JSON_PARTIAL_OUTPUT_ON_ERROR));

        if (!isset($input['trainer_id']) || !isset($input['document_type'])) {
            respond("error", "Missing trainer_id or document_type.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $documentType = $conn->real_escape_string($input['document_type']);
        $idNumber = isset($input['id_number']) ? $conn->real_escape_string($input['id_number']) : null;
        $idSide = isset($input['id_side']) ? $conn->real_escape_string($input['id_side']) : null;

        error_log("[VERIFICATION_DOCUMENT_UPLOAD] trainerId: $trainerId, documentType: $documentType, idSide: $idSide");

        // Validate document upload based on registration path
        $stmt = $conn->prepare("SELECT registration_path FROM user_profiles WHERE user_id = ? LIMIT 1");
        $stmt->bind_param("s", $trainerId);
        $stmt->execute();
        $profileResult = $stmt->get_result();
        $profile = $profileResult->fetch_assoc();
        $stmt->close();

        // Validate document type - only these are allowed
        $allowedDocTypes = ['national_id', 'passport', 'proof_of_residence', 'certificate_of_good_conduct', 'discipline_certificate'];
        if (!in_array($documentType, $allowedDocTypes)) {
            respond("error", "Invalid document type. Document uploads are not allowed.", null, 403);
        }

        // Special handling for proof_of_residence - it uses GPS location from profile, not file upload
        if ($documentType === 'proof_of_residence') {
            // Get the trainer's location coordinates from profile
            $stmt = $conn->prepare("SELECT location_lat, location_lng, area_of_residence FROM user_profiles WHERE user_id = ? LIMIT 1");
            $stmt->bind_param("s", $trainerId);
            $stmt->execute();
            $profileResult = $stmt->get_result();
            $profileData = $profileResult->fetch_assoc();
            $stmt->close();

            // GPS location is optional - proceed even if not set
            $hasLocation = $profileData && $profileData['location_lat'] && $profileData['location_lng'];
            $documentStatus = $hasLocation ? 'approved' : 'pending';
            $fileUrl = $hasLocation
                ? json_encode(['lat' => $profileData['location_lat'], 'lng' => $profileData['location_lng'], 'area' => $profileData['area_of_residence']])
                : null;

            // Check if proof_of_residence document already exists
            $sql = "SELECT id FROM verification_documents WHERE trainer_id = ? AND document_type = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("ss", $trainerId, $documentType);
            $stmt->execute();
            $existingDoc = $stmt->get_result();
            $stmt->close();

            if ($existingDoc->num_rows > 0) {
                // Update existing document
                $doc = $existingDoc->fetch_assoc();
                $docId = $doc['id'];

                $sql = "
                    UPDATE verification_documents
                    SET file_url = ?, id_number = ?, status = ?, updated_at = NOW()
                    WHERE id = ?
                ";

                $stmt = $conn->prepare($sql);
                if ($stmt === false) {
                    respond("error", "Prepare failed: " . $conn->error, null, 500);
                    break;
                }

                if (!$stmt->bind_param("ssss", $fileUrl, $idNumber, $documentStatus, $docId)) {
                    $stmt->close();
                    respond("error", "Bind failed: " . $stmt->error, null, 500);
                    break;
                }

                if ($stmt->execute()) {
                    $stmt->close();
                    logEvent('verification_document_uploaded', ['trainer_id' => $trainerId, 'document_type' => $documentType]);
                    $message = $hasLocation ? "Proof of residence confirmed from GPS location." : "Proof of residence document created. Add location in profile settings to auto-approve.";
                    respond("success", $message, ["id" => $docId, "file_url" => $fileUrl]);
                } else {
                    $stmt->close();
                    respond("error", "Execute failed: " . $conn->error, null, 500);
                }
            } else {
                // Create new document
                $docId = 'doc_' . uniqid();

                $sql = "
                    INSERT INTO verification_documents (id, trainer_id, document_type, file_url, id_number, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                ";

                $stmt = $conn->prepare($sql);
                if ($stmt === false) {
                    respond("error", "Prepare failed: " . $conn->error, null, 500);
                    break;
                }

                if (!$stmt->bind_param("ssssss", $docId, $trainerId, $documentType, $fileUrl, $idNumber, $documentStatus)) {
                    $stmt->close();
                    respond("error", "Bind failed: " . $stmt->error, null, 500);
                    break;
                }

                if ($stmt->execute()) {
                    $stmt->close();
                    logEvent('verification_document_uploaded', ['trainer_id' => $trainerId, 'document_type' => $documentType]);
                    $message = $hasLocation ? "Proof of residence confirmed from GPS location." : "Proof of residence document created. Add location in profile settings to auto-approve.";
                    respond("success", $message, ["id" => $docId, "file_url" => $fileUrl]);
                } else {
                    $stmt->close();
                    respond("error", "Execute failed: " . $conn->error, null, 500);
                }
            }
            break;
        }

        // Handle file upload for other documents
        $fileUrl = null;
        $filePath = null;

        error_log('[VERIFICATION_DOCUMENT_UPLOAD] Checking for $_FILES["file"]: ' . (isset($_FILES['file']) ? 'YES' : 'NO'));
        if (isset($_FILES['file'])) {
            error_log('[VERIFICATION_DOCUMENT_UPLOAD] File received: ' . json_encode($_FILES['file'], JSON_PARTIAL_OUTPUT_ON_ERROR));
            $file = $_FILES['file'];

            // Check for upload errors
            if ($file['error'] !== 0) {
                $errorMessages = [
                    UPLOAD_ERR_INI_SIZE => 'File exceeds php.ini upload_max_filesize',
                    UPLOAD_ERR_FORM_SIZE => 'File exceeds form MAX_FILE_SIZE',
                    UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
                    UPLOAD_ERR_NO_FILE => 'No file was uploaded',
                    UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
                    UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
                    UPLOAD_ERR_EXTENSION => 'File upload stopped by extension'
                ];
                $errorMsg = $errorMessages[$file['error']] ?? 'Unknown upload error';
                respond("error", $errorMsg, null, 400);
            }

            // Check file size (5MB max)
            if ($file['size'] > 5 * 1024 * 1024) {
                respond("error", "File too large (max 5MB).", null, 400);
            }

            // Use same uploads directory as profile images
            $uploadDir = 'uploads/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $fileName = $trainerId . '_' . $documentType . '_' . time() . '.' . pathinfo($file['name'], PATHINFO_EXTENSION);
            $filePath = $uploadDir . $fileName;
            $uploadBase = getenv('UPLOAD_BASE_URL') ?: 'https://trainercoachconnect.com/uploads/';
            $fileUrl = rtrim($uploadBase, '/') . '/' . $fileName;

            if (!move_uploaded_file($file['tmp_name'], $filePath)) {
                respond("error", "Failed to upload file.", null, 500);
            }
        }

        // Check if document already exists
        // For ID documents, include id_side in the check
        $sql = "SELECT id FROM verification_documents WHERE trainer_id = ? AND document_type = ?";
        $params = [$trainerId, $documentType];
        $types = "ss";

        if (in_array($documentType, ['national_id', 'passport']) && $idSide) {
            $sql .= " AND id_side = ?";
            $params[] = $idSide;
            $types .= "s";
        }

        $stmt = $conn->prepare($sql);
        if ($stmt === false) {
            respond("error", "Prepare failed: " . $conn->error . " | SQL: " . $sql, null, 500);
            break;
        }

        if (!$stmt->bind_param($types, ...$params)) {
            $stmt->close();
            respond("error", "Bind failed: " . $stmt->error, null, 500);
            break;
        }

        if (!$stmt->execute()) {
            $stmt->close();
            respond("error", "Execute failed: " . $conn->error, null, 500);
            break;
        }

        $existingDoc = $stmt->get_result();
        $stmt->close();

        if ($existingDoc->num_rows > 0) {
            // Update existing document
            $doc = $existingDoc->fetch_assoc();
            $docId = $doc['id'];

            $expiresAt = null;
            if ($documentType === 'certificate_of_good_conduct') {
                // Good conduct certificate expires in 90 days
                $expiresAt = date('Y-m-d H:i:s', time() + (90 * 24 * 60 * 60));
            }

            $sql = "
                UPDATE verification_documents
                SET file_url = ?, file_path = ?, id_number = ?, id_side = ?, status = 'pending', expires_at = ?, updated_at = NOW()
                WHERE id = ?
            ";

            $stmt = $conn->prepare($sql);
            if ($stmt === false) {
                respond("error", "Prepare failed: " . $conn->error . " | SQL: " . $sql, null, 500);
                break;
            }

            if (!$stmt->bind_param("ssssss", $fileUrl, $filePath, $idNumber, $idSide, $expiresAt, $docId)) {
                $stmt->close();
                respond("error", "Bind failed: " . $stmt->error, null, 500);
                break;
            }

            if ($stmt->execute()) {
                $stmt->close();
                error_log("[VERIFICATION_DOCUMENT_UPLOAD] UPDATE successful. docId: $docId, fileUrl: " . (is_null($fileUrl) ? 'NULL' : $fileUrl));
                logEvent('verification_document_uploaded', ['trainer_id' => $trainerId, 'document_type' => $documentType]);
                respond("success", "Document uploaded successfully.", ["id" => $docId, "file_url" => $fileUrl]);
            } else {
                $stmt->close();
                respond("error", "Execute failed: " . $conn->error, null, 500);
            }
        } else {
            // Create new document
            $docId = 'doc_' . uniqid();
            $expiresAt = null;
            if ($documentType === 'certificate_of_good_conduct') {
                // Good conduct certificate expires in 90 days
                $expiresAt = date('Y-m-d H:i:s', time() + (90 * 24 * 60 * 60));
            }

            $sql = "
                INSERT INTO verification_documents (id, trainer_id, document_type, file_url, file_path, id_number, id_side, expires_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ";

            $stmt = $conn->prepare($sql);
            if ($stmt === false) {
                respond("error", "Prepare failed: " . $conn->error . " | SQL: " . $sql, null, 500);
                break;
            }

            if (!$stmt->bind_param("ssssssss", $docId, $trainerId, $documentType, $fileUrl, $filePath, $idNumber, $idSide, $expiresAt)) {
                $stmt->close();
                respond("error", "Bind failed: " . $stmt->error, null, 500);
                break;
            }

            if ($stmt->execute()) {
                $stmt->close();
                error_log("[VERIFICATION_DOCUMENT_UPLOAD] INSERT successful. docId: $docId, fileUrl: " . (is_null($fileUrl) ? 'NULL' : $fileUrl));
                logEvent('verification_document_uploaded', ['trainer_id' => $trainerId, 'document_type' => $documentType]);
                respond("success", "Document uploaded successfully.", ["id" => $docId, "file_url" => $fileUrl]);
            } else {
                $stmt->close();
                respond("error", "Execute failed: " . $conn->error, null, 500);
            }
        }
        break;

    // GET TRAINER VERIFICATION DOCUMENTS
    case 'verification_documents_get':
        if (!isset($input['trainer_id'])) {
            respond("error", "Missing trainer_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $sql = "
            SELECT id, trainer_id, document_type, file_url, file_path, status, rejection_reason, id_number, id_side, uploaded_at, reviewed_at, expires_at
            FROM verification_documents
            WHERE trainer_id = ?
            ORDER BY uploaded_at DESC
        ";

        $stmt = $conn->prepare($sql);
        if ($stmt === false) {
            respond("error", "Prepare failed: " . $conn->error . " | SQL: " . $sql, null, 500);
            break;
        }

        if (!$stmt->bind_param("s", $trainerId)) {
            $stmt->close();
            respond("error", "Bind failed: " . $stmt->error, null, 500);
            break;
        }

        if ($stmt->execute()) {
            $result = $stmt->get_result();
            $documents = [];
            while ($row = $result->fetch_assoc()) {
                // Normalize file URLs
                if (!empty($row['file_url']) && !filter_var($row['file_url'], FILTER_VALIDATE_URL)) {
                    $uploadBase = getenv('UPLOAD_BASE_URL') ?: '/uploads/';
                    $row['file_url'] = $uploadBase . $row['file_url'];
                }
                $documents[] = $row;
            }
            $stmt->close();
            respond("success", "Verification documents fetched.", $documents);
        } else {
            $stmt->close();
            respond("error", "Execute failed: " . $conn->error, null, 500);
        }
        break;

    // LIST ALL VERIFICATION DOCUMENTS (Admin only)
    case 'verification_documents_list':
        $adminId = validateAdminAuthorization($conn);
        if (!$adminId) exit;

        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : null;

        $sql = "
            SELECT
                vd.id, vd.trainer_id, vd.document_type, vd.file_url, vd.status,
                vd.rejection_reason, vd.uploaded_at, vd.reviewed_at, vd.reviewed_by,
                up.full_name, up.user_type
            FROM verification_documents vd
            LEFT JOIN user_profiles up ON vd.trainer_id = up.user_id
        ";

        if ($status) {
            $sql .= " WHERE vd.status = '$status'";
        }

        $sql .= " ORDER BY vd.uploaded_at DESC";

        $result = $conn->query($sql);
        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $documents = [];
        while ($row = $result->fetch_assoc()) {
            if (!empty($row['file_url']) && !filter_var($row['file_url'], FILTER_VALIDATE_URL)) {
                $uploadBase = getenv('UPLOAD_BASE_URL') ?: '/uploads/';
                $row['file_url'] = $uploadBase . $row['file_url'];
            }
            $documents[] = $row;
        }

        respond("success", "Verification documents list fetched.", $documents);
        break;

    // VERIFY/APPROVE/REJECT VERIFICATION DOCUMENT (Admin only)
    case 'verification_document_verify':
        $adminId = validateAdminAuthorization($conn);
        if (!$adminId) exit;

        if (!isset($input['document_id']) || !isset($input['status'])) {
            respond("error", "Missing document_id or status.", null, 400);
        }

        $docId = $conn->real_escape_string($input['document_id']);
        $status = $conn->real_escape_string($input['status']);
        $rejectionReason = isset($input['rejection_reason']) ? $conn->real_escape_string($input['rejection_reason']) : null;

        $validStatuses = ['approved', 'rejected'];
        if (!in_array($status, $validStatuses)) {
            respond("error", "Invalid status value. Must be 'approved' or 'rejected'.", null, 400);
        }

        $sql = "
            UPDATE verification_documents
            SET status = ?, rejection_reason = ?, reviewed_at = NOW(), reviewed_by = ?, updated_at = NOW()
            WHERE id = ?
        ";

        $stmt = $conn->prepare($sql);
        if ($stmt === false) {
            respond("error", "Prepare failed: " . $conn->error . " | SQL: " . $sql, null, 500);
            break;
        }

        if (!$stmt->bind_param("ssss", $status, $rejectionReason, $adminId, $docId)) {
            $stmt->close();
            respond("error", "Bind failed: " . $stmt->error, null, 500);
            break;
        }

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('verification_document_reviewed', ['document_id' => $docId, 'status' => $status, 'admin_id' => $adminId]);
            respond("success", "Document verification completed.", ["status" => $status]);
        } else {
            $stmt->close();
            respond("error", "Execute failed: " . $conn->error, null, 500);
        }
        break;

    // VALIDATE SPONSOR (check if sponsor is approved trainer)
    case 'validate_sponsor':
        if (!isset($input['sponsor_id'])) {
            respond("error", "Missing sponsor_id.", null, 400);
        }

        $sponsorId = $conn->real_escape_string($input['sponsor_id']);
        $stmt = $conn->prepare("
            SELECT up.user_id, up.full_name, up.user_type, up.is_approved
            FROM user_profiles up
            WHERE up.user_id = ? AND up.user_type = 'trainer' AND up.is_approved = 1
        ");
        $stmt->bind_param("s", $sponsorId);

        if ($stmt->execute()) {
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                $sponsor = $result->fetch_assoc();
                $stmt->close();
                respond("success", "Sponsor is valid.", $sponsor);
            } else {
                $stmt->close();
                respond("error", "Sponsor not found or not approved.", null, 404);
            }
        } else {
            $stmt->close();
            respond("error", "Validation query failed: " . $conn->error, null, 500);
        }
        break;

    // GET CATEGORIES
    case 'get_categories':
        $stmt = $conn->prepare("SELECT id, name, icon, description, created_at FROM categories ORDER BY created_at DESC");

        if ($stmt->execute()) {
            $result = $stmt->get_result();
            $categories = [];
            while ($row = $result->fetch_assoc()) {
                $categories[] = $row;
            }
            $stmt->close();
            respond("success", "Categories fetched successfully.", $categories);
        } else {
            $stmt->close();
            respond("error", "Failed to fetch categories: " . $conn->error, null, 500);
        }
        break;

    // ADD CATEGORY
    case 'add_category':
        if (!isset($input['name'])) {
            respond("error", "Missing name.", null, 400);
        }

        $name = $conn->real_escape_string($input['name']);
        $icon = isset($input['icon']) ? $conn->real_escape_string($input['icon']) : '';
        $description = isset($input['description']) ? $conn->real_escape_string($input['description']) : '';
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("INSERT INTO categories (name, icon, description, created_at) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $name, $icon, $description, $now);

        if ($stmt->execute()) {
            $categoryId = $conn->insert_id;
            $stmt->close();
            logEvent('category_added', ['category_id' => $categoryId, 'name' => $name]);
            respond("success", "Category added successfully.", ["id" => $categoryId]);
        } else {
            $stmt->close();
            respond("error", "Failed to add category: " . $conn->error, null, 500);
        }
        break;

    // UPDATE CATEGORY
    case 'update_category':
        if (!isset($input['id'])) {
            respond("error", "Missing id.", null, 400);
        }

        $categoryId = $conn->real_escape_string($input['id']);
        $name = isset($input['name']) ? $conn->real_escape_string($input['name']) : null;
        $icon = isset($input['icon']) ? $conn->real_escape_string($input['icon']) : null;
        $description = isset($input['description']) ? $conn->real_escape_string($input['description']) : null;

        $updates = [];
        $params = [];
        $types = "";

        if ($name !== null) {
            $updates[] = "name = ?";
            $params[] = $name;
            $types .= "s";
        }
        if ($icon !== null) {
            $updates[] = "icon = ?";
            $params[] = $icon;
            $types .= "s";
        }
        if ($description !== null) {
            $updates[] = "description = ?";
            $params[] = $description;
            $types .= "s";
        }

        if (empty($updates)) {
            respond("error", "No fields to update.", null, 400);
        }

        $params[] = $categoryId;
        $types .= "i";

        $sql = "UPDATE categories SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = $conn->prepare($sql);

        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('category_updated', ['category_id' => $categoryId]);
            respond("success", "Category updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to update category: " . $conn->error, null, 500);
        }
        break;

    // DELETE CATEGORY
    case 'delete_category':
        if (!isset($input['id'])) {
            respond("error", "Missing id.", null, 400);
        }

        $categoryId = $conn->real_escape_string($input['id']);

        $stmt = $conn->prepare("DELETE FROM categories WHERE id = ?");
        $stmt->bind_param("i", $categoryId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('category_deleted', ['category_id' => $categoryId]);
            respond("success", "Category deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to delete category: " . $conn->error, null, 500);
        }
        break;

    // =============================
    // ADMIN DISCIPLINE MANAGEMENT
    // =============================

    // ADMIN: CREATE CATEGORY (Admin-created disciplines)
    case 'admin_category_create':
        validateAdminAuthorization($conn);

        if (!isset($input['name'])) {
            respond("error", "Missing name.", null, 400);
        }

        // Extract admin ID from authorization header
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $adminId = null;
        if (!empty($authHeader) && strpos($authHeader, 'Bearer ') === 0) {
            $token = substr($authHeader, 7);
            $decodedToken = base64_decode($token, true);
            $tokenData = json_decode($decodedToken, true);
            if ($tokenData && isset($tokenData['id'])) {
                $adminId = $tokenData['id'];
            }
        }

        $name = $conn->real_escape_string($input['name']);
        $icon = isset($input['icon']) ? $conn->real_escape_string($input['icon']) : '';
        $description = isset($input['description']) ? $conn->real_escape_string($input['description']) : '';
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("INSERT INTO categories (name, icon, description, status, created_by_admin, created_by, created_at, updated_at) VALUES (?, ?, ?, 'active', TRUE, ?, ?, ?)");
        $stmt->bind_param("ssssss", $name, $icon, $description, $adminId, $now, $now);

        if ($stmt->execute()) {
            $categoryId = $conn->insert_id;
            $stmt->close();
            logEvent('admin_category_created', ['category_id' => $categoryId, 'name' => $name, 'created_by' => $adminId]);
            respond("success", "Category created successfully by admin.", ["id" => $categoryId, "name" => $name]);
        } else {
            $stmt->close();
            respond("error", "Failed to create category: " . $conn->error, null, 500);
        }
        break;

    // ADMIN: UPDATE CATEGORY
    case 'admin_category_update':
        validateAdminAuthorization($conn);

        if (!isset($input['id'])) {
            respond("error", "Missing id.", null, 400);
        }

        $categoryId = intval($input['id']);
        $name = isset($input['name']) ? $conn->real_escape_string($input['name']) : null;
        $icon = isset($input['icon']) ? $conn->real_escape_string($input['icon']) : null;
        $description = isset($input['description']) ? $conn->real_escape_string($input['description']) : null;

        $updates = [];
        $params = [];
        $types = "";

        if ($name !== null) {
            $updates[] = "name = ?";
            $params[] = $name;
            $types .= "s";
        }
        if ($icon !== null) {
            $updates[] = "icon = ?";
            $params[] = $icon;
            $types .= "s";
        }
        if ($description !== null) {
            $updates[] = "description = ?";
            $params[] = $description;
            $types .= "s";
        }

        if (empty($updates)) {
            respond("error", "No fields to update.", null, 400);
        }

        $updates[] = "updated_at = NOW()";
        $params[] = $categoryId;
        $types .= "i";

        $sql = "UPDATE categories SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = $conn->prepare($sql);

        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('admin_category_updated', ['category_id' => $categoryId]);
            respond("success", "Category updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to update category: " . $conn->error, null, 500);
        }
        break;

    // ADMIN: ARCHIVE CATEGORY (soft delete)
    case 'admin_category_archive':
        validateAdminAuthorization($conn);

        if (!isset($input['id'])) {
            respond("error", "Missing id.", null, 400);
        }

        $categoryId = intval($input['id']);
        $stmt = $conn->prepare("UPDATE categories SET status = 'archived', updated_at = NOW() WHERE id = ?");
        $stmt->bind_param("i", $categoryId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('admin_category_archived', ['category_id' => $categoryId]);
            respond("success", "Category archived successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to archive category: " . $conn->error, null, 500);
        }
        break;

    // ADMIN: DELETE CATEGORY (hard delete)
    case 'admin_category_delete':
        validateAdminAuthorization($conn);

        if (!isset($input['id'])) {
            respond("error", "Missing id.", null, 400);
        }

        $categoryId = intval($input['id']);

        // Check if category is used by any trainers
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM trainer_categories WHERE category_id = ?");
        $stmt->bind_param("i", $categoryId);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();

        if ($row['count'] > 0) {
            respond("error", "Cannot delete category that is used by trainers. Archive it instead.", null, 400);
        }

        $stmt = $conn->prepare("DELETE FROM categories WHERE id = ?");
        $stmt->bind_param("i", $categoryId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('admin_category_deleted', ['category_id' => $categoryId]);
            respond("success", "Category deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to delete category: " . $conn->error, null, 500);
        }
        break;

    // ADMIN: LIST CATEGORIES (with filtering)
    case 'admin_category_list':
        validateAdminAuthorization($conn);

        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'all';
        $sortBy = isset($input['sortBy']) ? $conn->real_escape_string($input['sortBy']) : 'created_at';

        if ($sortBy !== 'name' && $sortBy !== 'created_at') {
            $sortBy = 'created_at';
        }

        $whereClause = "";
        if ($status === 'active') {
            $whereClause = "WHERE c.status = 'active'";
        } else if ($status === 'pending_approval') {
            $whereClause = "WHERE c.status = 'pending_approval'";
        } else if ($status === 'rejected') {
            $whereClause = "WHERE c.status = 'rejected'";
        } else if ($status === 'archived') {
            $whereClause = "WHERE c.status = 'archived'";
        }

        $orderClause = $sortBy === 'name' ? "ORDER BY c.name ASC" : "ORDER BY c.created_at DESC";

        $sql = "
            SELECT
                c.id, c.name, c.icon, c.description, c.status, c.created_by_admin, c.created_by, c.reviewed_by, c.rejection_reason, c.reviewed_at, c.created_at, c.updated_at,
                COUNT(tc.trainer_id) as trainer_count
            FROM categories c
            LEFT JOIN trainer_categories tc ON c.id = tc.category_id
            $whereClause
            GROUP BY c.id
            $orderClause
        ";

        $result = $conn->query($sql);
        if (!$result) {
            respond("error", "Failed to fetch categories: " . $conn->error, null, 500);
        }

        $categories = [];
        while ($row = $result->fetch_assoc()) {
            $categories[] = $row;
        }

        respond("success", "Categories fetched successfully.", $categories);
        break;

    // ADMIN: APPROVE CATEGORY
    case 'admin_category_approve':
        validateAdminAuthorization($conn);

        $categoryId = isset($input['category_id']) ? intval($input['category_id']) : null;
        $reviewedBy = isset($input['reviewed_by']) ? $conn->real_escape_string($input['reviewed_by']) : null;

        if (!$categoryId || !$reviewedBy) {
            respond("error", "Missing required fields: category_id, reviewed_by", null, 400);
        }

        // Update category status to active with reviewer info
        $sql = "
            UPDATE categories
            SET status = 'active', reviewed_by = ?, reviewed_at = NOW()
            WHERE id = ?
        ";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            respond("error", "Database prepare failed: " . $conn->error, null, 500);
        }

        $stmt->bind_param("si", $reviewedBy, $categoryId);
        if ($stmt->execute()) {
            $stmt->close();
            logEvent('admin_category_approved', ['category_id' => $categoryId, 'reviewed_by' => $reviewedBy]);
            respond("success", "Category approved successfully.", ["category_id" => $categoryId]);
        } else {
            $stmt->close();
            respond("error", "Failed to approve category: " . $conn->error, null, 500);
        }
        break;

    // ADMIN: REJECT CATEGORY
    case 'admin_category_reject':
        validateAdminAuthorization($conn);

        $categoryId = isset($input['category_id']) ? intval($input['category_id']) : null;
        $reviewedBy = isset($input['reviewed_by']) ? $conn->real_escape_string($input['reviewed_by']) : null;
        $rejectionReason = isset($input['rejection_reason']) ? $conn->real_escape_string($input['rejection_reason']) : null;

        if (!$categoryId || !$reviewedBy) {
            respond("error", "Missing required fields: category_id, reviewed_by", null, 400);
        }

        // Update category status to rejected with reviewer info and reason
        $sql = "
            UPDATE categories
            SET status = 'rejected', reviewed_by = ?, rejection_reason = ?, reviewed_at = NOW()
            WHERE id = ?
        ";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            respond("error", "Database prepare failed: " . $conn->error, null, 500);
        }

        $stmt->bind_param("ssi", $reviewedBy, $rejectionReason, $categoryId);
        if ($stmt->execute()) {
            $stmt->close();
            logEvent('admin_category_rejected', ['category_id' => $categoryId, 'reviewed_by' => $reviewedBy, 'reason' => $rejectionReason]);
            respond("success", "Category rejected successfully.", ["category_id" => $categoryId]);
        } else {
            $stmt->close();
            respond("error", "Failed to reject category: " . $conn->error, null, 500);
        }
        break;

    // =============================
    // DISCIPLINE REQUESTS MANAGEMENT
    // =============================

    // TRAINER: SUBMIT DISCIPLINE REQUEST
    case 'discipline_request_create':
        // Get trainer ID from auth token
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (empty($authHeader) || strpos($authHeader, 'Bearer ') !== 0) {
            respond("error", "Missing or invalid authorization header", null, 401);
        }

        $token = substr($authHeader, 7);
        $decodedToken = base64_decode($token, true);
        $tokenData = json_decode($decodedToken, true);

        if (!$tokenData || !isset($tokenData['id'])) {
            respond("error", "Invalid token", null, 401);
        }

        $trainerId = $tokenData['id'];

        if (!isset($input['category_name'])) {
            respond("error", "Missing category_name.", null, 400);
        }

        $categoryName = $conn->real_escape_string($input['category_name']);
        $categoryIcon = isset($input['category_icon']) ? $conn->real_escape_string($input['category_icon']) : '🏋️';
        $categoryDescription = isset($input['category_description']) ? $conn->real_escape_string($input['category_description']) : '';
        $requestId = 'req_' . uniqid();
        $now = date('Y-m-d H:i:s');

        // Check if trainer already has a pending request for this category
        $checkStmt = $conn->prepare("SELECT id FROM discipline_requests WHERE trainer_id = ? AND category_name = ? AND status = 'pending' LIMIT 1");
        $checkStmt->bind_param("ss", $trainerId, $categoryName);
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();
        $checkStmt->close();

        if ($checkResult->num_rows > 0) {
            respond("error", "You already have a pending request for this discipline.", null, 400);
        }

        $stmt = $conn->prepare("
            INSERT INTO discipline_requests (id, trainer_id, category_name, category_icon, category_description, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        ");
        $stmt->bind_param("ssssss", $requestId, $trainerId, $categoryName, $categoryIcon, $categoryDescription, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('discipline_request_created', ['request_id' => $requestId, 'trainer_id' => $trainerId, 'category' => $categoryName]);
            respond("success", "Discipline request submitted for admin approval.", ["id" => $requestId]);
        } else {
            $stmt->close();
            respond("error", "Failed to submit request: " . $conn->error, null, 500);
        }
        break;

    // ADMIN: LIST DISCIPLINE REQUESTS
    case 'discipline_request_list':
        validateAdminAuthorization($conn);

        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'all';
        $sortBy = isset($input['sortBy']) ? $conn->real_escape_string($input['sortBy']) : 'created_at';

        if ($sortBy !== 'trainer_name' && $sortBy !== 'created_at') {
            $sortBy = 'created_at';
        }

        $whereClause = "";
        if ($status === 'pending') {
            $whereClause = "WHERE dr.status = 'pending'";
        } else if ($status === 'approved') {
            $whereClause = "WHERE dr.status = 'approved'";
        } else if ($status === 'rejected') {
            $whereClause = "WHERE dr.status = 'rejected'";
        }

        $orderClause = $sortBy === 'trainer_name'
            ? "ORDER BY u.first_name ASC, u.last_name ASC"
            : "ORDER BY dr.created_at DESC";

        $sql = "
            SELECT
                dr.id, dr.trainer_id, dr.category_name, dr.category_icon, dr.category_description,
                dr.status, dr.admin_notes, dr.approved_category_id, dr.created_at, dr.reviewed_at,
                u.email, u.first_name, u.last_name, u.phone,
                up.full_name, up.rating, up.total_reviews,
                c.id as category_id, c.name as approved_category_name
            FROM discipline_requests dr
            LEFT JOIN users u ON dr.trainer_id = u.id
            LEFT JOIN user_profiles up ON dr.trainer_id = up.user_id
            LEFT JOIN categories c ON dr.approved_category_id = c.id
            $whereClause
            $orderClause
        ";

        $result = $conn->query($sql);
        if (!$result) {
            respond("error", "Failed to fetch requests: " . $conn->error, null, 500);
        }

        $requests = [];
        while ($row = $result->fetch_assoc()) {
            $requests[] = $row;
        }

        respond("success", "Discipline requests fetched successfully.", $requests);
        break;

    // ADMIN: APPROVE DISCIPLINE REQUEST
    case 'discipline_request_approve':
        $adminId = validateAdminAuthorization($conn);

        if (!isset($input['request_id'])) {
            respond("error", "Missing request_id.", null, 400);
        }

        $requestId = $conn->real_escape_string($input['request_id']);

        // Get the request
        $stmt = $conn->prepare("SELECT * FROM discipline_requests WHERE id = ? LIMIT 1");
        $stmt->bind_param("s", $requestId);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        if ($result->num_rows === 0) {
            respond("error", "Request not found.", null, 404);
        }

        $request = $result->fetch_assoc();

        // Use provided values or defaults from request
        $categoryName = isset($input['category_name']) ? $conn->real_escape_string($input['category_name']) : $request['category_name'];
        $categoryIcon = isset($input['category_icon']) ? $conn->real_escape_string($input['category_icon']) : $request['category_icon'];
        $categoryDescription = isset($input['category_description']) ? $conn->real_escape_string($input['category_description']) : $request['category_description'];
        $now = date('Y-m-d H:i:s');

        // Create new category or get existing one with same name
        $checkStmt = $conn->prepare("SELECT id FROM categories WHERE name = ? LIMIT 1");
        $checkStmt->bind_param("s", $categoryName);
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();
        $checkStmt->close();

        if ($checkResult->num_rows > 0) {
            $existing = $checkResult->fetch_assoc();
            $categoryId = $existing['id'];
        } else {
            // Create new category
            $insertStmt = $conn->prepare("INSERT INTO categories (name, icon, description, status, created_by_admin, created_at, updated_at) VALUES (?, ?, ?, 'active', FALSE, ?, ?)");
            $insertStmt->bind_param("sssss", $categoryName, $categoryIcon, $categoryDescription, $now, $now);

            if (!$insertStmt->execute()) {
                $insertStmt->close();
                respond("error", "Failed to create category: " . $conn->error, null, 500);
            }

            $categoryId = $conn->insert_id;
            $insertStmt->close();
        }

        // Update request
        $updateStmt = $conn->prepare("
            UPDATE discipline_requests
            SET status = 'approved', approved_category_id = ?, reviewed_at = ?, reviewed_by_admin_id = ?
            WHERE id = ?
        ");
        $updateStmt->bind_param("isss", $categoryId, $now, $adminId, $requestId);

        if ($updateStmt->execute()) {
            $updateStmt->close();
            logEvent('discipline_request_approved', ['request_id' => $requestId, 'category_id' => $categoryId, 'admin_id' => $adminId]);
            respond("success", "Discipline request approved. New category created.", [
                "category_id" => $categoryId,
                "category_name" => $categoryName,
                "category_icon" => $categoryIcon
            ]);
        } else {
            $updateStmt->close();
            respond("error", "Failed to approve request: " . $conn->error, null, 500);
        }
        break;

    // ADMIN: REJECT DISCIPLINE REQUEST
    case 'discipline_request_reject':
        $adminId = validateAdminAuthorization($conn);

        if (!isset($input['request_id'])) {
            respond("error", "Missing request_id.", null, 400);
        }

        $requestId = $conn->real_escape_string($input['request_id']);
        $adminNotes = isset($input['admin_notes']) ? $conn->real_escape_string($input['admin_notes']) : 'Rejected by admin';
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            UPDATE discipline_requests
            SET status = 'rejected', admin_notes = ?, reviewed_at = ?, reviewed_by_admin_id = ?
            WHERE id = ?
        ");
        $stmt->bind_param("ssss", $adminNotes, $now, $adminId, $requestId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('discipline_request_rejected', ['request_id' => $requestId, 'admin_id' => $adminId]);
            respond("success", "Discipline request rejected.", ["status" => "rejected"]);
        } else {
            $stmt->close();
            respond("error", "Failed to reject request: " . $conn->error, null, 500);
        }
        break;

    // =============================
    // TRAINER CATEGORIES MANAGEMENT
    // =============================

    // GET TRAINER CATEGORIES
    case 'trainer_categories_get':
        if (!isset($input['trainer_id'])) {
            respond("error", "Missing trainer_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $stmt = $conn->prepare("
            SELECT tc.id, tc.trainer_id, tc.category_id, c.id as cat_id, c.name, c.icon, c.description, tc.created_at
            FROM trainer_categories tc
            LEFT JOIN categories c ON tc.category_id = c.id
            WHERE tc.trainer_id = ?
            ORDER BY c.name ASC
        ");
        $stmt->bind_param("s", $trainerId);

        if ($stmt->execute()) {
            $result = $stmt->get_result();
            $categories = [];
            while ($row = $result->fetch_assoc()) {
                $categories[] = $row;
            }
            $stmt->close();
            respond("success", "Trainer categories fetched successfully.", ["data" => $categories]);
        } else {
            $stmt->close();
            respond("error", "Failed to fetch trainer categories: " . $conn->error, null, 500);
        }
        break;

    // ADD TRAINER CATEGORY
    case 'trainer_category_add':
        if (!isset($input['trainer_id']) || !isset($input['category_id'])) {
            respond("error", "Missing trainer_id or category_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $categoryId = intval($input['category_id']);
        $assignmentId = 'tc_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO trainer_categories (id, trainer_id, category_id, created_at)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->bind_param("ssis", $assignmentId, $trainerId, $categoryId, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_category_added', ['trainer_id' => $trainerId, 'category_id' => $categoryId]);
            respond("success", "Category added to trainer successfully.", ["id" => $assignmentId]);
        } else {
            $stmt->close();
            if (strpos($conn->error, 'Duplicate entry') !== false) {
                respond("error", "Trainer already has this category.", null, 409);
            } else {
                respond("error", "Failed to add category to trainer: " . $conn->error, null, 500);
            }
        }
        break;

    // REMOVE TRAINER CATEGORY
    case 'trainer_category_remove':
        if (!isset($input['trainer_id']) || !isset($input['category_id'])) {
            respond("error", "Missing trainer_id or category_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $categoryId = intval($input['category_id']);

        $stmt = $conn->prepare("
            DELETE FROM trainer_categories
            WHERE trainer_id = ? AND category_id = ?
        ");
        $stmt->bind_param("si", $trainerId, $categoryId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_category_removed', ['trainer_id' => $trainerId, 'category_id' => $categoryId]);
            respond("success", "Category removed from trainer successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to remove category from trainer: " . $conn->error, null, 500);
        }
        break;

    // GET TRAINERS BY CATEGORY
    case 'trainers_by_category':
        if (!isset($input['category_id'])) {
            respond("error", "Missing category_id.", null, 400);
        }

        $categoryId = intval($input['category_id']);
        $stmt = $conn->prepare("
            SELECT DISTINCT up.*
            FROM trainer_categories tc
            INNER JOIN user_profiles up ON tc.trainer_id = up.user_id
            WHERE tc.category_id = ? AND up.user_type = 'trainer' AND up.is_approved = 1
            ORDER BY up.rating DESC, up.full_name ASC
        ");
        $stmt->bind_param("i", $categoryId);

        if ($stmt->execute()) {
            $result = $stmt->get_result();
            $trainers = [];
            while ($row = $result->fetch_assoc()) {
                $trainers[] = $row;
            }
            $stmt->close();
            respond("success", "Trainers fetched successfully.", ["data" => $trainers]);
        } else {
            $stmt->close();
            respond("error", "Failed to fetch trainers: " . $conn->error, null, 500);
        }
        break;

    // SET TRAINER CATEGORY PRICING
    case 'trainer_category_pricing_set':
        if (!isset($input['trainer_id']) || !isset($input['category_id']) || !isset($input['hourly_rate'])) {
            respond("error", "Missing trainer_id, category_id, or hourly_rate.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $categoryId = intval($input['category_id']);
        $hourlyRate = floatval($input['hourly_rate']);

        if ($hourlyRate < 0) {
            respond("error", "Hourly rate cannot be negative.", null, 400);
        }

        $pricingId = $conn->real_escape_string(bin2hex(random_bytes(18)));
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO trainer_category_pricing (id, trainer_id, category_id, hourly_rate, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE hourly_rate = ?, updated_at = NOW()
        ");
        $stmt->bind_param("ssidsd", $pricingId, $trainerId, $categoryId, $hourlyRate, $now, $hourlyRate);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_category_pricing_set', ['trainer_id' => $trainerId, 'category_id' => $categoryId, 'hourly_rate' => $hourlyRate]);
            respond("success", "Trainer category pricing updated successfully.", ["trainer_id" => $trainerId, "category_id" => $categoryId, "hourly_rate" => $hourlyRate]);
        } else {
            $stmt->close();
            respond("error", "Failed to update trainer category pricing: " . $conn->error, null, 500);
        }
        break;

    // GET TRAINER CATEGORY PRICING
    case 'trainer_category_pricing_get':
        if (!isset($input['trainer_id'])) {
            respond("error", "Missing trainer_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $stmt = $conn->prepare("
            SELECT tc.id, tc.trainer_id, tc.category_id, c.id as cat_id, c.name, c.icon, c.description,
                   tc.hourly_rate, tc.created_at
            FROM trainer_categories tc
            LEFT JOIN categories c ON tc.category_id = c.id
            WHERE tc.trainer_id = ?
            ORDER BY c.name ASC
        ");
        $stmt->bind_param("s", $trainerId);

        if ($stmt->execute()) {
            $result = $stmt->get_result();
            $categories = [];
            while ($row = $result->fetch_assoc()) {
                $categories[] = $row;
            }
            $stmt->close();
            respond("success", "Trainer category pricing fetched successfully.", ["data" => $categories]);
        } else {
            $stmt->close();
            respond("error", "Failed to fetch trainer category pricing: " . $conn->error, null, 500);
        }
        break;

    // =============================
    // GROUP TRAINING PRICING SERVICES
    // =============================

    // SET TRAINER GROUP PRICING
    case 'trainer_group_pricing_set':
        if (!isset($input['trainer_id']) || !isset($input['category_id']) || !isset($input['pricing_model']) || !isset($input['tiers'])) {
            respond("error", "Missing trainer_id, category_id, pricing_model, or tiers.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $categoryId = intval($input['category_id']);
        $pricingModel = $conn->real_escape_string($input['pricing_model']);

        // Validate pricing model
        if (!in_array($pricingModel, ['fixed', 'per_person'])) {
            respond("error", "Invalid pricing_model. Must be 'fixed' or 'per_person'.", null, 400);
        }

        // Parse tiers - can be JSON string or array
        $tiers = $input['tiers'];
        if (is_string($tiers)) {
            $tiersDecoded = json_decode($tiers, true);
            if ($tiersDecoded === null) {
                respond("error", "Invalid tiers JSON.", null, 400);
            }
            $tiers = $tiersDecoded;
        }

        // Validate tiers structure
        if (!is_array($tiers) || empty($tiers)) {
            respond("error", "Tiers must be a non-empty array.", null, 400);
        }

        // Validate each tier
        foreach ($tiers as $idx => $tier) {
            if (!isset($tier['group_size_name']) || !isset($tier['min_size']) || !isset($tier['max_size']) || !isset($tier['rate'])) {
                respond("error", "Each tier must have group_size_name, min_size, max_size, and rate.", null, 400);
            }
            if (floatval($tier['rate']) < 0) {
                respond("error", "Tier rates cannot be negative.", null, 400);
            }

            // Validate numeric bounds for tier ranges
            $minSize = intval($tier['min_size']);
            $maxSize = intval($tier['max_size']);
            if ($minSize < 1) {
                respond("error", "Tier " . ($idx + 1) . " '" . $tier['group_size_name'] . "': min_size must be >= 1.", null, 400);
            }
            if ($maxSize < $minSize) {
                respond("error", "Tier " . ($idx + 1) . " '" . $tier['group_size_name'] . "': max_size must be >= min_size.", null, 400);
            }
        }

        $pricingId = 'gp_' . bin2hex(random_bytes(18));
        $now = date('Y-m-d H:i:s');
        $tiersJson = json_encode($tiers);

        $stmt = $conn->prepare("
            INSERT INTO trainer_group_pricing (id, trainer_id, category_id, pricing_model, tiers, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE pricing_model = ?, tiers = ?, updated_at = NOW()
        ");
        $stmt->bind_param("ssisssss", $pricingId, $trainerId, $categoryId, $pricingModel, $tiersJson, $now, $now, $pricingModel, $tiersJson);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_group_pricing_set', ['trainer_id' => $trainerId, 'category_id' => $categoryId, 'pricing_model' => $pricingModel]);
            respond("success", "Group training pricing updated successfully.", ["trainer_id" => $trainerId, "category_id" => $categoryId, "pricing_model" => $pricingModel]);
        } else {
            $stmt->close();
            respond("error", "Failed to update group training pricing: " . $conn->error, null, 500);
        }
        break;

    // GET TRAINER GROUP PRICING
    case 'trainer_group_pricing_get':
        if (!isset($input['trainer_id'])) {
            respond("error", "Missing trainer_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $categoryId = isset($input['category_id']) ? intval($input['category_id']) : null;

        if ($categoryId) {
            $stmt = $conn->prepare("
                SELECT id, trainer_id, category_id, pricing_model, tiers, created_at, updated_at
                FROM trainer_group_pricing
                WHERE trainer_id = ? AND category_id = ?
                LIMIT 1
            ");
            $stmt->bind_param("si", $trainerId, $categoryId);
        } else {
            $stmt = $conn->prepare("
                SELECT id, trainer_id, category_id, pricing_model, tiers, created_at, updated_at
                FROM trainer_group_pricing
                WHERE trainer_id = ?
                ORDER BY category_id ASC
            ");
            $stmt->bind_param("s", $trainerId);
        }

        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        $rows = [];
        while ($row = $result->fetch_assoc()) {
            // Parse tiers JSON
            if (isset($row['tiers']) && is_string($row['tiers'])) {
                $parsed = json_decode($row['tiers'], true);
                if ($parsed !== null) {
                    $row['tiers'] = $parsed;
                }
            }
            $rows[] = $row;
        }

        if ($categoryId && empty($rows)) {
            respond("success", "No group training pricing found for this category.", ["data" => null]);
        } else {
            respond("success", "Group training pricing fetched successfully.", ["data" => $rows]);
        }
        break;

    // DELETE TRAINER GROUP PRICING
    case 'trainer_group_pricing_delete':
        if (!isset($input['trainer_id']) || !isset($input['category_id'])) {
            respond("error", "Missing trainer_id or category_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $categoryId = intval($input['category_id']);

        $stmt = $conn->prepare("
            DELETE FROM trainer_group_pricing
            WHERE trainer_id = ? AND category_id = ?
        ");
        $stmt->bind_param("si", $trainerId, $categoryId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_group_pricing_delete', ['trainer_id' => $trainerId, 'category_id' => $categoryId]);
            respond("success", "Group training pricing deleted successfully.");
        } else {
            $stmt->close();
            respond("error", "Failed to delete group training pricing: " . $conn->error, null, 500);
        }
        break;

    // =============================
    // CUSTOM ACTIONS: Client Portal
    // =============================

    // INSERT REPORTED ISSUE
    case 'issue_insert':
        if (!isset($input['user_id']) || !isset($input['description'])) {
            respond("error", "Missing user_id or description.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $trainerId = isset($input['trainer_id']) && !empty($input['trainer_id']) ? $conn->real_escape_string($input['trainer_id']) : NULL;
        $bookingReference = isset($input['booking_reference']) && !empty($input['booking_reference']) ? $conn->real_escape_string($input['booking_reference']) : NULL;
        $complaintType = isset($input['complaint_type']) && !empty($input['complaint_type']) ? $conn->real_escape_string($input['complaint_type']) : NULL;
        $title = isset($input['title']) ? $conn->real_escape_string($input['title']) : 'Support Issue';
        $description = $conn->real_escape_string($input['description']);
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'open';
        $priority = isset($input['priority']) ? $conn->real_escape_string($input['priority']) : 'normal';
        $attachments = NULL;
        if (isset($input['attachments']) && !empty($input['attachments'])) {
            if (is_array($input['attachments']) || is_object($input['attachments'])) {
                $attachments = json_encode($input['attachments'], JSON_UNESCAPED_SLASHES);
            } else {
                $attachments = $input['attachments'];
                if (!json_decode($attachments)) {
                    $attachments = json_encode(['error' => 'Invalid attachment format']);
                }
            }
        }
        $issueId = 'issue_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $conn->query("
            CREATE TABLE IF NOT EXISTS `reported_issues` (
                `id` VARCHAR(36) PRIMARY KEY,
                `user_id` VARCHAR(36) NOT NULL,
                `trainer_id` VARCHAR(36),
                `booking_reference` VARCHAR(100),
                `complaint_type` VARCHAR(100),
                `title` VARCHAR(255),
                `description` TEXT NOT NULL,
                `status` VARCHAR(50) DEFAULT 'open',
                `priority` VARCHAR(50) DEFAULT 'normal',
                `attachments` JSON,
                `resolution` TEXT,
                `resolved_at` TIMESTAMP NULL,
                `assigned_to` VARCHAR(36),
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT `fk_reported_issues_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_status` (`status`)
            )
        ");

        $sql = "
            INSERT INTO reported_issues (
                id, user_id, trainer_id, booking_reference, complaint_type,
                title, description, status, priority, attachments, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            respond("error", "Failed to prepare statement: " . $conn->error, null, 500);
        }

        $stmt->bind_param(
            "ssssssssssss",
            $issueId, $userId, $trainerId, $bookingReference, $complaintType,
            $title, $description, $status, $priority, $attachments, $now, $now
        );

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('issue_reported', ['issue_id' => $issueId, 'user_id' => $userId, 'has_attachments' => !is_null($attachments)]);
            respond("success", "Issue reported successfully.", ["id" => $issueId]);
        } else {
            $stmt->close();
            respond("error", "Failed to report issue: " . $conn->error, null, 500);
        }
        break;

    // INSERT REVIEW
    case 'review_insert':
        if (!isset($input['trainer_id']) || !isset($input['client_id']) || !isset($input['rating'])) {
            respond("error", "Missing trainer_id, client_id, or rating.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $clientId = $conn->real_escape_string($input['client_id']);
        $rating = floatval($input['rating']);
        $comment = isset($input['comment']) ? $conn->real_escape_string($input['comment']) : '';
        $bookingId = isset($input['booking_id']) ? $conn->real_escape_string($input['booking_id']) : NULL;
        $reviewId = 'review_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO reviews (
                id, trainer_id, client_id, booking_id, rating, comment, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssdsss", $reviewId, $trainerId, $clientId, $bookingId, $rating, $comment, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();

            // Update booking's rating_submitted flag if booking_id is provided
            if ($bookingId) {
                $updateBookingStmt = $conn->prepare("
                    UPDATE bookings SET rating_submitted = 1 WHERE id = ?
                ");
                $updateBookingStmt->bind_param("s", $bookingId);
                $updateBookingStmt->execute();
                $updateBookingStmt->close();
            }

            logEvent('review_added', ['review_id' => $reviewId, 'trainer_id' => $trainerId]);
            respond("success", "Review added successfully.", ["id" => $reviewId]);
        } else {
            $stmt->close();
            respond("error", "Failed to add review: " . $conn->error, null, 500);
        }
        break;

    // INSERT PAYOUT REQUEST
    case 'payout_insert':
        if (!isset($input['trainer_id']) || !isset($input['amount'])) {
            respond("error", "Missing trainer_id or amount.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $amount = floatval($input['amount']);
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'pending';
        $payoutId = 'payout_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO payout_requests (
                id, trainer_id, amount, status, requested_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("sdsssss", $payoutId, $trainerId, $amount, $status, $now, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('payout_requested', ['payout_id' => $payoutId, 'trainer_id' => $trainerId, 'amount' => $amount]);
            respond("success", "Payout request submitted successfully.", ["id" => $payoutId]);
        } else {
            $stmt->close();
            respond("error", "Failed to submit payout request: " . $conn->error, null, 500);
        }
        break;

    // GET PAYMENTS (for earnings)
    case 'payments_get':
        if (!isset($input['trainer_id'])) {
            respond("error", "Missing trainer_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);

        // Get all completed payments for this trainer with fee breakdown
        $sql = "
            SELECT
                id, booking_id, amount, trainer_net_amount,
                base_service_amount, transport_fee, platform_fee, vat_amount,
                status, method, transaction_reference, created_at, updated_at
            FROM payments
            WHERE trainer_id = '$trainerId'
              AND status = 'completed'
            ORDER BY created_at DESC
        ";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $payments = [];
        while ($row = $result->fetch_assoc()) {
            $payments[] = $row;
        }

        // Calculate total trainer earnings from completed payments
        $sumSql = "
            SELECT
                SUM(trainer_net_amount) as total_earnings,
                COUNT(*) as payment_count,
                SUM(transport_fee) as total_transport_earned
            FROM payments
            WHERE trainer_id = '$trainerId'
              AND status = 'completed'
        ";
        $sumResult = $conn->query($sumSql);
        $summary = [];
        if ($sumResult && $sumResult->num_rows > 0) {
            $summary = $sumResult->fetch_assoc();
        }

        respond("success", "Payments fetched successfully.", [
            "data" => $payments,
            "summary" => [
                "total_earnings" => floatval($summary['total_earnings'] ?? 0),
                "payment_count" => intval($summary['payment_count'] ?? 0),
                "total_transport_earned" => floatval($summary['total_transport_earned'] ?? 0)
            ]
        ]);
        break;

    // INSERT PAYMENT
    case 'payment_insert':
        if (!isset($input['client_id']) && !isset($input['user_id'])) {
            respond("error", "Missing client_id or user_id.", null, 400);
        }
        if (!isset($input['trainer_id']) || !isset($input['amount'])) {
            respond("error", "Missing trainer_id or amount.", null, 400);
        }

        $clientId = $conn->real_escape_string($input['client_id'] ?? $input['user_id']);
        $userId = $clientId; // Map to user_id as well
        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $amount = floatval($input['amount']);
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'completed';
        $method = isset($input['method']) ? $conn->real_escape_string($input['method']) : 'mpesa';
        $bookingId = isset($input['booking_id']) ? $conn->real_escape_string($input['booking_id']) : NULL;
        $baseServiceAmount = isset($input['base_service_amount']) ? floatval($input['base_service_amount']) : $amount;
        $transportFee = isset($input['transport_fee']) ? floatval($input['transport_fee']) : 0;
        $platformFee = isset($input['platform_fee']) ? floatval($input['platform_fee']) : 0;
        $vatAmount = isset($input['vat_amount']) ? floatval($input['vat_amount']) : 0;
        $trainerNetAmount = isset($input['trainer_net_amount']) ? floatval($input['trainer_net_amount']) : $amount;
        $transactionReference = isset($input['transaction_reference']) ? $conn->real_escape_string($input['transaction_reference']) : NULL;
        $paymentId = 'payment_' . uniqid();
        $now = date('Y-m-d H:i:s');

        // Ensure payments table has all required columns
        $columnsToAdd = [
            'base_service_amount' => 'DECIMAL(15, 2) DEFAULT 0',
            'transport_fee' => 'DECIMAL(15, 2) DEFAULT 0',
            'platform_fee' => 'DECIMAL(15, 2) DEFAULT 0',
            'vat_amount' => 'DECIMAL(15, 2) DEFAULT 0',
            'trainer_net_amount' => 'DECIMAL(15, 2) DEFAULT 0',
            'transaction_reference' => 'VARCHAR(255)'
        ];

        // Check which columns exist
        $existingColumns = [];
        $columnsResult = @$conn->query("SHOW COLUMNS FROM payments");
        if ($columnsResult) {
            while ($colRow = $columnsResult->fetch_assoc()) {
                $existingColumns[] = $colRow['Field'];
            }
        }

        // Add missing columns one by one
        foreach ($columnsToAdd as $colName => $colDefinition) {
            if (!in_array($colName, $existingColumns)) {
                $alterSQL = "ALTER TABLE payments ADD COLUMN $colName $colDefinition";
                @$conn->query($alterSQL);
            }
        }

        $stmt = $conn->prepare("
            INSERT INTO payments (
                id, user_id, client_id, trainer_id, booking_id, amount,
                base_service_amount, transport_fee, platform_fee, vat_amount, trainer_net_amount,
                status, method, transaction_reference, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param(
            "sssssddddddsssss",
            $paymentId, $userId, $clientId, $trainerId, $bookingId, $amount,
            $baseServiceAmount, $transportFee, $platformFee, $vatAmount, $trainerNetAmount,
            $status, $method, $transactionReference, $now, $now
        );

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('payment_recorded', ['payment_id' => $paymentId, 'amount' => $amount]);
            respond("success", "Payment recorded successfully.", ["id" => $paymentId]);
        } else {
            $stmt->close();
            respond("error", "Failed to record payment: " . $conn->error, null, 500);
        }
        break;

    // GET PROFILE (custom wrapper)
    case 'profile_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $sql = "SELECT * FROM user_profiles WHERE user_id = '$userId' LIMIT 1";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        if ($result->num_rows === 0) {
            respond("success", "Profile not found.", null);
        }

        $profile = $result->fetch_assoc();

        // Fill in missing name and phone from users table if not in profile
        if (empty($profile['full_name']) || empty($profile['phone_number'])) {
            $userSql = "SELECT first_name, last_name, phone FROM users WHERE id = '$userId' LIMIT 1";
            $userResult = $conn->query($userSql);
            if ($userResult && $userResult->num_rows > 0) {
                $userData = $userResult->fetch_assoc();
                if (empty($profile['full_name']) && !empty($userData['first_name'])) {
                    $profile['full_name'] = trim($userData['first_name'] . ' ' . $userData['last_name']);
                }
                if (empty($profile['phone_number']) && !empty($userData['phone'])) {
                    $profile['phone_number'] = $userData['phone'];
                }
            }
        }

        // Normalize profile image URL
        if (!empty($profile['profile_image'])) {
            $profile['profile_image'] = normalizeImageUrl($profile['profile_image']);
        }

        // Parse JSON fields for proper response format
        $jsonFields = ['availability', 'hourly_rate_by_radius', 'pricing_packages', 'skills', 'certifications'];
        foreach ($jsonFields as $field) {
            if (isset($profile[$field]) && is_string($profile[$field]) && !empty($profile[$field])) {
                $parsed = json_decode($profile[$field], true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $profile[$field] = $parsed;
                }
            }
        }

        respond("success", "Profile fetched successfully.", $profile);
        break;

    // UPDATE PROFILE (custom wrapper)
    case 'profile_update':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $updates = [];
        $params = [];
        $types = "";

        // Track if we need to update the users table
        $userUpdates = [];
        $userParams = [];
        $userTypes = "";

        foreach ($input as $key => $value) {
            if ($key === 'user_id' || $key === 'action') continue;

            $safeKey = $conn->real_escape_string($key);

            // Allow setting location_label and similar fields to null
            if ($value === null) {
                $updates[] = "`$safeKey` = NULL";
                continue;
            }

            if (is_array($value) || is_object($value)) {
                $updates[] = "`$safeKey` = ?";
                $params[] = json_encode($value);
                $types .= "s";
            } else {
                $updates[] = "`$safeKey` = ?";
                $params[] = $value;
                $types .= is_numeric($value) && strpos($value, '.') === false ? "i" : "s";
            }

            // Sync full_name to users table as first_name and last_name
            if ($key === 'full_name') {
                $fullName = trim($value);
                $lastSpacePos = strrpos($fullName, ' ');
                $firstName = '';
                $lastName = '';
                if ($lastSpacePos !== false) {
                    $firstName = substr($fullName, 0, $lastSpacePos);
                    $lastName = substr($fullName, $lastSpacePos + 1);
                } else {
                    $firstName = $fullName;
                    $lastName = '';
                }

                $userUpdates[] = "`first_name` = ?";
                $userParams[] = $firstName;
                $userTypes .= "s";

                $userUpdates[] = "`last_name` = ?";
                $userParams[] = $lastName;
                $userTypes .= "s";
            }

            // Sync phone_number to users table as phone
            if ($key === 'phone_number') {
                $userUpdates[] = "`phone` = ?";
                $userParams[] = $value;
                $userTypes .= "s";
            }
        }

        if (empty($updates)) {
            respond("error", "No fields to update.", null, 400);
        }

        $params[] = $userId;
        $types .= "s";

        $sql = "UPDATE user_profiles SET " . implode(", ", $updates) . " WHERE user_id = ?";
        $stmt = $conn->prepare($sql);

        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }

        if ($stmt->execute()) {
            $stmt->close();

            // Also update the users table if there are any changes to sync
            if (!empty($userUpdates)) {
                $userParams[] = $userId;
                $userTypes .= "s";

                $userSql = "UPDATE users SET " . implode(", ", $userUpdates) . " WHERE id = ?";
                $userStmt = $conn->prepare($userSql);

                if (count($userParams) > 0) {
                    $userStmt->bind_param($userTypes, ...$userParams);
                }

                $userStmt->execute();
                $userStmt->close();
            }

            logEvent('profile_updated', ['user_id' => $userId]);
            respond("success", "Profile updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to update profile: " . $conn->error, null, 500);
        }
        break;

    // GET SERVICES
    case 'services_get':
    case 'service_get':
        if (!isset($input['trainer_id'])) {
            respond("error", "Missing trainer_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $sql = "SELECT * FROM services WHERE trainer_id = '$trainerId' ORDER BY created_at DESC";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $services = [];
        while ($row = $result->fetch_assoc()) {
            $services[] = $row;
        }

        respond("success", "Services fetched successfully.", $services);
        break;

    // INSERT SERVICE
    case 'services_insert':
    case 'service_insert':
        if (!isset($input['trainer_id']) || !isset($input['title']) || !isset($input['price'])) {
            respond("error", "Missing trainer_id, title, or price.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $title = $conn->real_escape_string($input['title']);
        $description = isset($input['description']) ? $conn->real_escape_string($input['description']) : NULL;
        $price = floatval($input['price']);
        $durationMinutes = isset($input['duration_minutes']) ? intval($input['duration_minutes']) : NULL;
        $isActive = isset($input['is_active']) ? intval($input['is_active']) : 1;
        $serviceId = 'service_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO services (
                id, trainer_id, title, description, price, duration_minutes, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssdiii", $serviceId, $trainerId, $title, $description, $price, $durationMinutes, $isActive, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('service_created', ['service_id' => $serviceId, 'trainer_id' => $trainerId]);
            respond("success", "Service created successfully.", ["id" => $serviceId]);
        } else {
            $stmt->close();
            respond("error", "Failed to create service: " . $conn->error, null, 500);
        }
        break;

    // UPDATE SERVICE
    case 'services_update':
    case 'service_update':
        if (!isset($input['id'])) {
            respond("error", "Missing service id.", null, 400);
        }

        $serviceId = $conn->real_escape_string($input['id']);
        $updates = [];
        $params = [];
        $types = "";

        foreach ($input as $key => $value) {
            if ($key === 'id' || $key === 'action') continue;
            if ($value === null) continue;

            $safeKey = $conn->real_escape_string($key);
            $updates[] = "`$safeKey` = ?";

            if (in_array($key, ['price', 'duration_minutes', 'is_active'])) {
                if ($key === 'price') {
                    $params[] = floatval($value);
                    $types .= "d";
                } else {
                    $params[] = intval($value);
                    $types .= "i";
                }
            } else {
                $params[] = $value;
                $types .= "s";
            }
        }

        if (empty($updates)) {
            respond("error", "No fields to update.", null, 400);
        }

        $params[] = $serviceId;
        $types .= "s";
        $updates[] = "`updated_at` = NOW()";

        $sql = "UPDATE services SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('service_updated', ['service_id' => $serviceId]);
            respond("success", "Service updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to update service: " . $conn->error, null, 500);
        }
        break;

    // DELETE SERVICE
    case 'services_delete':
    case 'service_delete':
        if (!isset($input['id'])) {
            respond("error", "Missing service id.", null, 400);
        }

        $serviceId = $conn->real_escape_string($input['id']);
        $sql = "DELETE FROM services WHERE id = '$serviceId'";

        if ($conn->query($sql)) {
            logEvent('service_deleted', ['service_id' => $serviceId]);
            respond("success", "Service deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            respond("error", "Failed to delete service: " . $conn->error, null, 500);
        }
        break;

    // GET PAYMENT METHODS
    case 'payment_methods_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $sql = "SELECT * FROM payment_methods WHERE user_id = '$userId' ORDER BY created_at DESC";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $methods = [];
        while ($row = $result->fetch_assoc()) {
            $methods[] = $row;
        }

        respond("success", "Payment methods fetched successfully.", ["data" => $methods]);
        break;

    // GET MESSAGES (supports both trainer_id/client_id and user_id formats)
    case 'messages_get':
        if (!isset($input['user_id']) && !isset($input['trainer_id']) && !isset($input['client_id'])) {
            respond("error", "Missing user_id, trainer_id, or client_id.", null, 400);
        }

        $trainerId = isset($input['trainer_id']) ? $conn->real_escape_string($input['trainer_id']) : null;
        $clientId = isset($input['client_id']) ? $conn->real_escape_string($input['client_id']) : null;
        $userId = isset($input['user_id']) ? $conn->real_escape_string($input['user_id']) : null;

        $where = "1=1";
        if ($trainerId && $clientId) {
            $where = "(trainer_id = '$trainerId' AND client_id = '$clientId') OR (trainer_id = '$clientId' AND client_id = '$trainerId')";
        } else if ($trainerId) {
            $where = "(trainer_id = '$trainerId' OR sender_id = '$trainerId' OR recipient_id = '$trainerId')";
        } else if ($clientId) {
            $where = "(client_id = '$clientId' OR sender_id = '$clientId' OR recipient_id = '$clientId')";
        } else if ($userId) {
            $where = "sender_id = '$userId' OR recipient_id = '$userId'";
        }

        $sql = "SELECT * FROM messages WHERE $where ORDER BY created_at DESC LIMIT 100";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $messages = [];
        while ($row = $result->fetch_assoc()) {
            $messages[] = $row;
        }

        respond("success", "Messages fetched successfully.", ["data" => $messages]);
        break;

    // INSERT MESSAGE (supports both trainer_id/client_id and sender_id/recipient_id formats)
    case 'message_insert':
        if (!isset($input['content'])) {
            respond("error", "Missing content.", null, 400);
        }

        $senderId = null;
        $recipientId = null;
        $trainerId = null;
        $clientId = null;

        if (isset($input['sender_id']) && isset($input['recipient_id'])) {
            $senderId = $conn->real_escape_string($input['sender_id']);
            $recipientId = $conn->real_escape_string($input['recipient_id']);
        } else if (isset($input['trainer_id']) && isset($input['client_id'])) {
            $trainerId = $conn->real_escape_string($input['trainer_id']);
            $clientId = $conn->real_escape_string($input['client_id']);

            // Determine sender based on read_by_trainer/read_by_client flags
            // If trainer sent it: read_by_trainer=true, read_by_client=false
            // If client sent it: read_by_trainer=false, read_by_client=true
            $rbt = isset($input['read_by_trainer']) ? intval($input['read_by_trainer']) : 0;
            $rbc = isset($input['read_by_client']) ? intval($input['read_by_client']) : 0;

            if ($rbt && !$rbc) {
                // Trainer sent this message
                $senderId = $trainerId;
                $recipientId = $clientId;
            } else if ($rbc && !$rbt) {
                // Client sent this message
                $senderId = $clientId;
                $recipientId = $trainerId;
            } else {
                // Fallback: use trainer as sender
                $senderId = $trainerId;
                $recipientId = $clientId;
            }
        } else {
            respond("error", "Missing sender_id/recipient_id or trainer_id/client_id.", null, 400);
        }

        $content = $conn->real_escape_string($input['content']);
        $readByTrainer = isset($input['read_by_trainer']) ? intval($input['read_by_trainer']) : 0;
        $readByClient = isset($input['read_by_client']) ? intval($input['read_by_client']) : 0;
        $messageId = 'msg_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO messages (
                id, sender_id, recipient_id, trainer_id, client_id, content,
                read_by_trainer, read_by_client, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssssssss", $messageId, $senderId, $recipientId, $trainerId, $clientId, $content, $readByTrainer, $readByClient, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('message_sent', ['message_id' => $messageId, 'sender_id' => $senderId]);
            respond("success", "Message sent successfully.", ["id" => $messageId]);
        } else {
            $stmt->close();
            respond("error", "Failed to send message: " . $conn->error, null, 500);
        }
        break;

    // GET NOTIFICATIONS
    case 'notifications_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $sql = "SELECT * FROM notifications WHERE user_id = '$userId' ORDER BY created_at DESC LIMIT 50";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $notifications = [];
        while ($row = $result->fetch_assoc()) {
            $notifications[] = $row;
        }

        respond("success", "Notifications fetched successfully.", ["data" => $notifications]);
        break;

    // INSERT NOTIFICATIONS
    case 'notifications_insert':
        if (!isset($input['notifications']) || !is_array($input['notifications'])) {
            respond("error", "Missing notifications array.", null, 400);
        }

        $notifications = $input['notifications'];
        $inserted = 0;
        $now = date('Y-m-d H:i:s');

        // Check which columns exist in notifications table (cache for performance)
        static $columnsCache = null;
        if ($columnsCache === null) {
            $columnsCache = ['hasBookingId' => false, 'hasActionType' => false];

            $result = @$conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME='notifications' AND TABLE_SCHEMA=DATABASE()");
            if ($result) {
                while ($row = $result->fetch_assoc()) {
                    if ($row['COLUMN_NAME'] === 'booking_id') $columnsCache['hasBookingId'] = true;
                    if ($row['COLUMN_NAME'] === 'action_type') $columnsCache['hasActionType'] = true;
                }
            }
        }

        foreach ($notifications as $notif) {
            $userId = isset($notif['user_id']) ? $conn->real_escape_string($notif['user_id']) : null;
            $title = isset($notif['title']) ? $conn->real_escape_string($notif['title']) : '';
            $message = isset($notif['message']) ? $conn->real_escape_string($notif['message']) : '';
            $body = isset($notif['body']) ? $conn->real_escape_string($notif['body']) : $message;
            $type = isset($notif['type']) ? $conn->real_escape_string($notif['type']) : 'info';
            $notifId = 'notif_' . uniqid();

            if (!$userId) continue;

            // Build INSERT statement based on available columns
            $sql = "INSERT INTO notifications (id, user_id";
            $params = "ss";
            $values = [$notifId, $userId];

            if ($columnsCache['hasBookingId']) {
                $sql .= ", booking_id";
                $params .= "s";
                $values[] = isset($notif['booking_id']) ? $conn->real_escape_string($notif['booking_id']) : null;
            }

            $sql .= ", title, body, message, type";
            $params .= "ssss";
            $values[] = $title;
            $values[] = $body;
            $values[] = $body;
            $values[] = $type;

            if ($columnsCache['hasActionType']) {
                $sql .= ", action_type";
                $params .= "s";
                $values[] = isset($notif['action_type']) ? $conn->real_escape_string($notif['action_type']) : null;
            }

            $sql .= ", created_at) VALUES (";
            $placeholders = array_fill(0, count($values) + 1, "?");
            $sql .= implode(",", $placeholders) . ")";
            $params .= "s";
            $values[] = $now;

            $stmt = $conn->prepare($sql);
            if ($stmt) {
                $stmt->bind_param($params, ...$values);
                if ($stmt->execute()) {
                    $inserted++;
                } else {
                    error_log("Failed to insert notification: " . $stmt->error);
                }
                $stmt->close();
            } else {
                error_log("Failed to prepare notification insert statement: " . $conn->error);
            }
        }

        respond("success", "Notifications created successfully.", ["inserted" => $inserted]);
        break;

    // MARK NOTIFICATIONS AS READ
    case 'notifications_mark_read':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $notificationIds = isset($input['notification_ids']) && is_array($input['notification_ids']) ? $input['notification_ids'] : [];

        if (empty($notificationIds)) {
            // Mark all notifications for this user as read
            $sql = "UPDATE notifications SET `read` = TRUE WHERE user_id = '$userId'";
            if ($conn->query($sql)) {
                respond("success", "All notifications marked as read.", ["affected_rows" => $conn->affected_rows]);
            } else {
                respond("error", "Failed to mark notifications as read: " . $conn->error, null, 500);
            }
        } else {
            // Mark specific notifications as read
            $escapedIds = array_map(function($id) use ($conn) {
                return "'" . $conn->real_escape_string($id) . "'";
            }, $notificationIds);
            $idList = implode(',', $escapedIds);

            $sql = "UPDATE notifications SET `read` = TRUE WHERE id IN ($idList) AND user_id = '$userId'";
            if ($conn->query($sql)) {
                respond("success", "Notifications marked as read.", ["affected_rows" => $conn->affected_rows]);
            } else {
                respond("error", "Failed to mark notifications as read: " . $conn->error, null, 500);
            }
        }
        break;


    // INSERT BOOKING (custom action wrapper)
    // CREATE BOOKING WITH TRANSPORT FEE CALCULATION
    case 'booking_create':
        if (!isset($input['client_id']) || !isset($input['trainer_id']) || !isset($input['session_date']) || !isset($input['session_time'])) {
            respond("error", "Missing required booking fields (client_id, trainer_id, session_date, session_time).", null, 400);
        }

        $clientId = $conn->real_escape_string($input['client_id']);
        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $sessionDate = $conn->real_escape_string($input['session_date']);
        $sessionTime = $conn->real_escape_string($input['session_time']);
        $durationHours = isset($input['duration_hours']) ? intval($input['duration_hours']) : 1;
        $totalSessions = isset($input['total_sessions']) ? intval($input['total_sessions']) : 1;
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'pending';
        $baseServiceAmount = isset($input['base_service_amount']) ? floatval($input['base_service_amount']) : 0;
        $notes = isset($input['notes']) ? $conn->real_escape_string($input['notes']) : NULL;
        $categoryId = isset($input['category_id']) ? intval($input['category_id']) : NULL;
        $skipValidation = isset($input['skip_availability_validation']) && $input['skip_availability_validation'];

        // Group training parameters
        $isGroupTraining = isset($input['is_group_training']) && $input['is_group_training'] === true;
        $groupSize = isset($input['group_size']) ? intval($input['group_size']) : 1;
        $groupSizeTierName = isset($input['group_size_tier_name']) ? $conn->real_escape_string($input['group_size_tier_name']) : NULL;
        $pricingModelUsed = NULL;
        $groupRatePerUnit = NULL;

        // Client location
        $clientLocationLabel = isset($input['client_location_label']) ? $conn->real_escape_string($input['client_location_label']) : NULL;
        $clientLocationLat = isset($input['client_location_lat']) ? floatval($input['client_location_lat']) : NULL;
        $clientLocationLng = isset($input['client_location_lng']) ? floatval($input['client_location_lng']) : NULL;

        // Get trainer profile for location and rates
        $trainerProfileSql = "SELECT location_lat, location_lng, timezone, availability FROM user_profiles WHERE user_id = '$trainerId' LIMIT 1";
        $trainerProfileResult = $conn->query($trainerProfileSql);
        if (!$trainerProfileResult || $trainerProfileResult->num_rows === 0) {
            respond("error", "Trainer not found.", null, 404);
        }

        $trainerProfile = $trainerProfileResult->fetch_assoc();
        $trainerLat = floatval($trainerProfile['location_lat'] ?? 0);
        $trainerLng = floatval($trainerProfile['location_lng'] ?? 0);

        // Validate availability
        if (!$skipValidation && !empty($trainerProfile['availability'])) {
            $availability = json_decode($trainerProfile['availability'], true);
            if (is_array($availability)) {
                try {
                    $bookingDateTime = new DateTime($sessionDate . ' ' . $sessionTime);
                    $dayName = strtolower($bookingDateTime->format('l'));
                    $bookingTime = $bookingDateTime->format('H:i');

                    $dayAvailable = false;
                    $timeSlotAvailable = false;

                    if (isset($availability[$dayName]) && is_array($availability[$dayName])) {
                        $dayAvailable = true;
                        foreach ($availability[$dayName] as $slot) {
                            if (is_string($slot)) {
                                $parts = explode('-', $slot);
                                if (count($parts) === 2) {
                                    $slotStart = trim($parts[0]);
                                    $slotEnd = trim($parts[1]);
                                    if ($bookingTime >= $slotStart && $bookingTime < $slotEnd) {
                                        $timeSlotAvailable = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    if (!$timeSlotAvailable) {
                        $dayLabel = $bookingDateTime->format('l');
                        respond("error", "The trainer is not available on $dayLabel at $bookingTime. Please choose a different time from their availability.", null, 400);
                    }
                } catch (Exception $e) {
                    respond("error", "Invalid date/time format.", null, 400);
                }
            }
        }

        // Handle group training pricing
        if ($isGroupTraining) {
            if (!$categoryId) {
                respond("error", "Category ID is required for group training bookings.", null, 400);
            }

            if (!$groupSizeTierName) {
                respond("error", "Group size tier name is required for group training bookings.", null, 400);
            }

            // Load group pricing for this trainer and category
            $groupPricing = getTrainerGroupPricing($conn, $trainerId, $categoryId);

            if (!$groupPricing) {
                respond("error", "This trainer does not offer group training for this category.", null, 400);
            }

            // Validate that the tier exists and get the rate
            $groupBaseAmount = calculateGroupTrainingBase($groupPricing, $groupSizeTierName, $groupPricing['pricing_model'], $groupSize);

            if ($groupBaseAmount === null) {
                respond("error", "Invalid group size tier selected.", null, 400);
            }

            // Find the tier to get the per-unit rate and validate group size matches tier range
            $tierRate = null;
            $selectedTier = null;
            foreach ($groupPricing['tiers'] as $tier) {
                if (isset($tier['group_size_name']) && $tier['group_size_name'] === $groupSizeTierName) {
                    $tierRate = floatval($tier['rate']);
                    $selectedTier = $tier;
                    break;
                }
            }

            // Validate that the provided group size falls within the selected tier's range
            if ($selectedTier) {
                $tierMinSize = intval($selectedTier['min_size'] ?? 1);
                $tierMaxSize = intval($selectedTier['max_size'] ?? 999999);
                if ($groupSize < $tierMinSize || $groupSize > $tierMaxSize) {
                    respond("error", "Group size {$groupSize} does not match selected tier '{$groupSizeTierName}' (valid range: {$tierMinSize}-{$tierMaxSize})", null, 400);
                }
            }

            // Set base service amount from group pricing
            $baseServiceAmount = $groupBaseAmount;
            $pricingModelUsed = $groupPricing['pricing_model'];
            $groupRatePerUnit = $tierRate;
        }

        // Calculate transport fee
        $transportFee = 0;
        if ($clientLocationLat !== null && $clientLocationLng !== null && $trainerLat !== 0 && $trainerLng !== 0) {
            $distanceKm = calculateDistance($trainerLat, $trainerLng, $clientLocationLat, $clientLocationLng);
            if ($distanceKm !== null && is_array($hourlyRateByRadius) && !empty($hourlyRateByRadius)) {
                $transportFee = calculateTransportFee($distanceKm, $hourlyRateByRadius);
            }
        }

        // Load settings and calculate fees using new calculation order
        $settings = loadPlatformSettings();
        $feeBreakdown = calculateFeeBreakdown($baseServiceAmount, $settings, $transportFee);

        // Extract calculated values
        $platformChargeClient = $feeBreakdown['platformChargeClient'];
        $platformChargeTrainer = $feeBreakdown['platformChargeTrainer'];
        $compensationFee = $feeBreakdown['compensationFee'];
        $maintenanceFee = $feeBreakdown['maintenanceFee'];
        $totalAmount = $feeBreakdown['clientTotal'];
        $trainerNetAmount = $feeBreakdown['trainerNetAmount'];

        // Client surcharge shown to client (charges that client directly pays)
        // Does NOT include maintenance fee (which is internal platform revenue)
        $clientSurcharge = $platformChargeClient + $compensationFee;

        // For backward compatibility with VAT field (if needed)
        $vatAmount = 0;

        // Generate booking ID
        $bookingId = 'booking_' . uniqid();
        $now = date('Y-m-d H:i:s');

        // Prepare statement with all fee breakdown columns and group training fields
        $stmt = $conn->prepare("
            INSERT INTO bookings (
                id, client_id, trainer_id, category_id, session_date, session_time, duration_hours,
                total_sessions, status, total_amount, base_service_amount, transport_fee, platform_fee,
                vat_amount, trainer_net_amount, client_surcharge, notes, client_location_label,
                client_location_lat, client_location_lng, is_group_training, group_size_tier_name,
                pricing_model_used, group_rate_per_unit, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        // For backward compatibility, use the new fee breakdown values
        $platformFeeForDb = $clientSurcharge; // Store total client charges as platform_fee for now
        $vatAmountForDb = 0; // No VAT in new calculation

        $stmt->bind_param(
            "sssisiiisddddddssddiissds",
            $bookingId, $clientId, $trainerId, $categoryId, $sessionDate, $sessionTime, $durationHours,
            $totalSessions, $status, $totalAmount, $baseServiceAmount, $transportFee, $platformFeeForDb,
            $vatAmountForDb, $trainerNetAmount, $clientSurcharge, $notes, $clientLocationLabel,
            $clientLocationLat, $clientLocationLng, $isGroupTraining, $groupSizeTierName,
            $pricingModelUsed, $groupRatePerUnit, $now
        );

        if ($stmt->execute()) {
            $stmt->close();

            // Send booking confirmation SMS (non-blocking)
            try {
                $clientStmt = $conn->prepare("SELECT phone FROM users WHERE id = ? LIMIT 1");
                $trainerStmt = $conn->prepare("SELECT full_name FROM user_profiles WHERE user_id = ? LIMIT 1");

                if ($clientStmt && $trainerStmt) {
                    $clientStmt->bind_param("s", $clientId);
                    $clientStmt->execute();
                    $clientResult = $clientStmt->get_result();

                    $trainerStmt->bind_param("s", $trainerId);
                    $trainerStmt->execute();
                    $trainerResult = $trainerStmt->get_result();

                    $clientPhone = null;
                    $trainerName = "Your Trainer";

                    if ($clientResult && $clientRow = $clientResult->fetch_assoc()) {
                        $clientPhone = $clientRow['phone'];
                    }

                    if ($trainerResult && $trainerRow = $trainerResult->fetch_assoc()) {
                        $trainerName = $trainerRow['full_name'];
                    }

                    $clientStmt->close();
                    $trainerStmt->close();

                    if ($clientPhone) {
                        @sendBookingSms($clientId, $clientPhone, [
                            'id' => $bookingId,
                            'trainer_name' => $trainerName,
                            'date' => $sessionDate,
                            'time' => $sessionTime,
                            'amount' => $totalAmount
                        ]);
                    }
                }
            } catch (Exception $e) {
                error_log("[BOOKING SMS ERROR] Failed to send booking SMS: " . $e->getMessage());
            }

            $eventData = [
                'booking_id' => $bookingId,
                'client_id' => $clientId,
                'trainer_id' => $trainerId,
                'base_service_amount' => $baseServiceAmount,
                'transport_fee' => $transportFee,
                'platform_fee' => $platformFeeForDb,
                'total_amount' => $totalAmount,
                'trainer_net' => $trainerNetAmount
            ];
            if ($categoryId) {
                $eventData['category_id'] = $categoryId;
            }
            if ($isGroupTraining) {
                $eventData['is_group_training'] = true;
                $eventData['group_size_tier'] = $groupSizeTierName;
                $eventData['pricing_model'] = $pricingModelUsed;
            }
            logEvent('booking_created_with_fees', $eventData);

            respond("success", "Booking created successfully with fee breakdown.", [
                "booking_id" => $bookingId,
                "base_service_amount" => $baseServiceAmount,
                "transport_fee" => $transportFee,
                "platform_charge_client" => $platformChargeClient,
                "platform_charge_trainer" => $platformChargeTrainer,
                "compensation_fee" => $compensationFee,
                "maintenance_fee" => $maintenanceFee,
                "sum_of_charges" => $feeBreakdown['sumOfCharges'],
                "trainer_net_amount" => $trainerNetAmount,
                "client_surcharge" => $clientSurcharge,
                "total_amount" => $totalAmount
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to create booking: " . $conn->error, null, 500);
        }
        break;

    case 'booking_insert':
        if (!isset($input['client_id']) || !isset($input['trainer_id']) || !isset($input['session_date']) || !isset($input['session_time'])) {
            respond("error", "Missing required booking fields (client_id, trainer_id, session_date, session_time).", null, 400);
        }

        $clientId = $conn->real_escape_string($input['client_id']);
        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $sessionDate = $conn->real_escape_string($input['session_date']);
        $sessionTime = $conn->real_escape_string($input['session_time']);
        $durationHours = isset($input['duration_hours']) ? intval($input['duration_hours']) : 1;
        $totalSessions = isset($input['total_sessions']) ? intval($input['total_sessions']) : 1;
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'pending';
        $totalAmount = isset($input['total_amount']) ? floatval($input['total_amount']) : 0;
        $notes = isset($input['notes']) ? $conn->real_escape_string($input['notes']) : NULL;
        $clientLocationLabel = isset($input['client_location_label']) ? $conn->real_escape_string($input['client_location_label']) : NULL;
        $clientLocationLat = isset($input['client_location_lat']) ? floatval($input['client_location_lat']) : NULL;
        $clientLocationLng = isset($input['client_location_lng']) ? floatval($input['client_location_lng']) : NULL;
        $categoryId = isset($input['category_id']) ? intval($input['category_id']) : NULL;
        $skipValidation = isset($input['skip_availability_validation']) && $input['skip_availability_validation'];
        $bookingId = 'booking_' . uniqid();
        $now = date('Y-m-d H:i:s');

        if (!$skipValidation) {
            $profileSql = "SELECT availability, timezone FROM user_profiles WHERE user_id = '$trainerId' LIMIT 1";
            $profileResult = $conn->query($profileSql);
            if ($profileResult && $profileResult->num_rows > 0) {
                $profile = $profileResult->fetch_assoc();
                $availabilityJson = $profile['availability'];

                if (!empty($availabilityJson)) {
                    $availability = json_decode($availabilityJson, true);
                    if (is_array($availability)) {
                        // Use trainer's timezone if available, otherwise default to UTC
                        $trainerTimezone = $profile['timezone'] ?: 'UTC';
                        try {
                            $tz = new DateTimeZone($trainerTimezone);
                        } catch (Exception $e) {
                            $tz = new DateTimeZone('UTC');
                        }

                        $bookingDateTime = new DateTime($sessionDate . ' ' . $sessionTime, $tz);
                        $dayName = strtolower($bookingDateTime->format('l'));
                        $bookingTime = $bookingDateTime->format('H:i');

                        $dayAvailable = false;
                        $timeSlotAvailable = false;

                        if (isset($availability[$dayName]) && is_array($availability[$dayName])) {
                            $dayAvailable = true;
                            foreach ($availability[$dayName] as $slot) {
                                if (is_string($slot)) {
                                    $parts = explode('-', $slot);
                                    if (count($parts) === 2) {
                                        $slotStart = trim($parts[0]);
                                        $slotEnd = trim($parts[1]);
                                        if ($bookingTime >= $slotStart && $bookingTime < $slotEnd) {
                                            $timeSlotAvailable = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        if (!$timeSlotAvailable) {
                            $dayLabel = $bookingDateTime->format('l');
                            respond("error", "The trainer is not available on $dayLabel at $bookingTime. Please choose a different time from their availability.", null, 400);
                        }
                    }
                }
            }
        }

        $stmt = $conn->prepare("
            INSERT INTO bookings (
                id, client_id, trainer_id, category_id, session_date, session_time, duration_hours,
                total_sessions, status, total_amount, notes, client_location_label,
                client_location_lat, client_location_lng, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("sssisiiisddsss", $bookingId, $clientId, $trainerId, $categoryId, $sessionDate, $sessionTime, $durationHours, $totalSessions, $status, $totalAmount, $notes, $clientLocationLabel, $clientLocationLat, $clientLocationLng, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            $eventData = ['booking_id' => $bookingId, 'client_id' => $clientId, 'trainer_id' => $trainerId];
            if ($categoryId) {
                $eventData['category_id'] = $categoryId;
            }
            logEvent('booking_created', $eventData);
            respond("success", "Booking created successfully.", ["id" => $bookingId]);
        } else {
            $stmt->close();
            respond("error", "Failed to create booking: " . $conn->error, null, 500);
        }
        break;

    // UPDATE BOOKING STATUS
    case 'booking_update':
        if (!isset($input['id'])) {
            respond("error", "Missing booking id.", null, 400);
        }

        $bookingId = $conn->real_escape_string($input['id']);
        $updates = [];
        $params = [];
        $types = "";

        // List of allowed fields to update
        $allowedFields = ['status', 'notes', 'client_location_label', 'client_location_lat', 'client_location_lng'];

        foreach ($allowedFields as $field) {
            if (isset($input[$field])) {
                $updates[] = "`$field` = ?";
                if ($field === 'client_location_lat' || $field === 'client_location_lng') {
                    $params[] = floatval($input[$field]);
                    $types .= "d";
                } else {
                    $params[] = $conn->real_escape_string($input[$field]);
                    $types .= "s";
                }
            }
        }

        if (empty($updates)) {
            respond("error", "No fields to update.", null, 400);
        }

        $updates[] = "`updated_at` = ?";
        $params[] = date('Y-m-d H:i:s');
        $types .= "s";
        $params[] = $bookingId;
        $types .= "s";

        $sql = "UPDATE bookings SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = $conn->prepare($sql);

        if (!$stmt) {
            respond("error", "Failed to prepare statement: " . $conn->error, null, 500);
        }

        $stmt->bind_param($types, ...$params);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('booking_updated', ['booking_id' => $bookingId]);
            respond("success", "Booking updated successfully.", ["id" => $bookingId]);
        } else {
            $stmt->close();
            respond("error", "Failed to update booking: " . $conn->error, null, 500);
        }
        break;

    // COMPLETE BOOKING AND TRACK SPONSOR COMMISSION
    case 'booking_complete':
        if (!isset($input['booking_id'])) {
            respond("error", "Missing booking_id.", null, 400);
        }

        $bookingId = $conn->real_escape_string($input['booking_id']);

        // Get booking details
        $bookingStmt = $conn->prepare("
            SELECT id, trainer_id, trainer_net_amount, status
            FROM bookings
            WHERE id = ?
        ");
        $bookingStmt->bind_param("s", $bookingId);
        $bookingStmt->execute();
        $bookingResult = $bookingStmt->get_result();

        if ($bookingResult->num_rows === 0) {
            $bookingStmt->close();
            respond("error", "Booking not found.", null, 404);
        }

        $booking = $bookingResult->fetch_assoc();
        $bookingStmt->close();

        // Skip if already completed
        if ($booking['status'] === 'completed') {
            respond("success", "Booking already completed.", ["id" => $bookingId]);
        }

        $trainerId = $booking['trainer_id'];
        $trainerNetAmount = floatval($booking['trainer_net_amount'] ?? 0);

        // Update booking status to completed
        $updateStmt = $conn->prepare("
            UPDATE bookings
            SET status = 'completed', updated_at = NOW()
            WHERE id = ?
        ");
        $updateStmt->bind_param("s", $bookingId);
        $updateStmt->execute();
        $updateStmt->close();

        // Get sponsor for this trainer
        $sponsorStmt = $conn->prepare("
            SELECT sponsor_id
            FROM user_profiles
            WHERE user_id = ?
        ");
        $sponsorStmt->bind_param("s", $trainerId);
        $sponsorStmt->execute();
        $sponsorResult = $sponsorStmt->get_result();
        $sponsorStmt->close();

        if ($sponsorResult->num_rows > 0) {
            $trainerProfile = $sponsorResult->fetch_assoc();
            $sponsorId = $trainerProfile['sponsor_id'];

            // If trainer has a sponsor, calculate and record commission
            if (!empty($sponsorId)) {
                // Get commission rate from settings (default 5%)
                $settingsStmt = $conn->prepare("
                    SELECT value FROM settings WHERE key = 'sponsor_commission_rate'
                ");
                $settingsStmt->execute();
                $settingsResult = $settingsStmt->get_result();
                $commissionRate = 10; // Default 10%

                if ($settingsResult->num_rows > 0) {
                    $settings = $settingsResult->fetch_assoc();
                    $commissionRate = floatval($settings['value'] ?? 10);
                }
                $settingsStmt->close();

                $commissionAmount = ($trainerNetAmount * $commissionRate) / 100;

                // Insert into sponsor_commissions table
                $commissionId = 'sc_' . uniqid();
                $insertStmt = $conn->prepare("
                    INSERT INTO sponsor_commissions (id, sponsor_trainer_id, sponsored_trainer_id, booking_id, commission_amount, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'completed', NOW())
                ");
                $insertStmt->bind_param("ssssd", $commissionId, $sponsorId, $trainerId, $bookingId, $commissionAmount);
                $insertStmt->execute();
                $insertStmt->close();

                logEvent('sponsor_commission_recorded', [
                    'booking_id' => $bookingId,
                    'sponsor_id' => $sponsorId,
                    'trainer_id' => $trainerId,
                    'commission_amount' => $commissionAmount
                ]);

                respond("success", "Booking completed with commission tracked.", [
                    "booking_id" => $bookingId,
                    "commission_recorded" => true,
                    "commission_amount" => $commissionAmount,
                    "sponsor_id" => $sponsorId
                ]);
            } else {
                // No sponsor, just update booking
                logEvent('booking_completed_no_sponsor', ['booking_id' => $bookingId, 'trainer_id' => $trainerId]);
                respond("success", "Booking completed (no sponsor commission).", [
                    "booking_id" => $bookingId,
                    "commission_recorded" => false
                ]);
            }
        } else {
            respond("error", "Failed to verify trainer profile.", null, 500);
        }
        break;

    // MARK MESSAGES AS READ
    case 'messages_mark_read':
        $trainerId = isset($input['trainer_id']) ? $conn->real_escape_string($input['trainer_id']) : null;
        $clientId = isset($input['client_id']) ? $conn->real_escape_string($input['client_id']) : null;
        $markReadByTrainer = isset($input['read_by_trainer']) ? intval($input['read_by_trainer']) : 0;
        $markReadByClient = isset($input['read_by_client']) ? intval($input['read_by_client']) : 0;

        if (!$trainerId && !$clientId) {
            respond("error", "Missing trainer_id or client_id.", null, 400);
        }

        $sql = "UPDATE messages SET ";
        $updates = [];

        if ($markReadByTrainer) {
            $updates[] = "read_by_trainer = 1";
        }
        if ($markReadByClient) {
            $updates[] = "read_by_client = 1";
        }

        if (empty($updates)) {
            respond("error", "No read status specified.", null, 400);
        }

        $sql .= implode(", ", $updates) . " WHERE ";
        $conditions = [];

        if ($trainerId) {
            $conditions[] = "(trainer_id = '$trainerId' OR sender_id = '$trainerId' OR recipient_id = '$trainerId')";
        }
        if ($clientId) {
            $conditions[] = "(client_id = '$clientId' OR sender_id = '$clientId' OR recipient_id = '$clientId')";
        }

        $sql .= implode(" OR ", $conditions);

        if ($conn->query($sql)) {
            logEvent('messages_marked_read', ['trainer_id' => $trainerId, 'client_id' => $clientId]);
            respond("success", "Messages marked as read successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            respond("error", "Failed to mark messages as read: " . $conn->error, null, 500);
        }
        break;

    // INSERT PAYMENT METHOD
    case 'payment_method_insert':
        if (!isset($input['user_id']) || !isset($input['method'])) {
            respond("error", "Missing user_id or method.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $method = $conn->real_escape_string($input['method']);
        $details = isset($input['details']) ? json_encode($input['details']) : NULL;
        $methodId = 'method_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO payment_methods (
                id, user_id, method, details, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssss", $methodId, $userId, $method, $details, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('payment_method_added', ['method_id' => $methodId, 'user_id' => $userId]);
            respond("success", "Payment method added successfully.", ["id" => $methodId]);
        } else {
            $stmt->close();
            respond("error", "Failed to add payment method: " . $conn->error, null, 500);
        }
        break;

    // GET PROFILES BY USER TYPE
    case 'profiles_get_by_type':
        if (!isset($input['user_type'])) {
            respond("error", "Missing user_type.", null, 400);
        }

        $userType = $conn->real_escape_string($input['user_type']);
        $sql = "SELECT * FROM user_profiles WHERE user_type = '$userType' ORDER BY created_at DESC";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $profiles = [];
        while ($row = $result->fetch_assoc()) {
            $profiles[] = $row;
        }

        respond("success", "Profiles fetched successfully.", ["data" => $profiles]);
        break;

    // GET PAYOUT REQUESTS (for admin)
    case 'payout_requests_get':
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'pending';
        $page = isset($input['page']) ? max(1, intval($input['page'])) : 1;
        $limit = isset($input['limit']) ? max(1, min(100, intval($input['limit']))) : 20;
        $offset = ($page - 1) * $limit;

        $countSql = "SELECT COUNT(*) as total FROM payout_requests WHERE status = '$status'";
        $countResult = $conn->query($countSql);
        $totalCount = $countResult ? $countResult->fetch_assoc()['total'] : 0;

        $sql = "SELECT pr.*, up.full_name, up.phone_number, up.location_label FROM payout_requests pr
                LEFT JOIN user_profiles up ON pr.trainer_id = up.user_id
                WHERE pr.status = '$status'
                ORDER BY pr.requested_at DESC
                LIMIT $limit OFFSET $offset";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $requests = [];
        while ($row = $result->fetch_assoc()) {
            $requests[] = $row;
        }

        respond("success", "Payout requests fetched successfully.", [
            "data" => $requests,
            "page" => $page,
            "limit" => $limit,
            "total" => $totalCount,
            "totalPages" => ceil($totalCount / $limit)
        ]);
        break;

    // APPROVE PAYOUT REQUEST AND INITIATE B2C
    case 'payout_request_approve':
        if (!isset($input['payout_request_id'])) {
            respond("error", "Missing payout_request_id.", null, 400);
        }

        $payoutRequestId = $conn->real_escape_string($input['payout_request_id']);
        $commissionPercentage = isset($input['commission_percentage']) ? floatval($input['commission_percentage']) : 0;

        $sql = "SELECT * FROM payout_requests WHERE id = '$payoutRequestId' LIMIT 1";
        $result = $conn->query($sql);

        if (!$result || $result->num_rows === 0) {
            respond("error", "Payout request not found.", null, 404);
        }

        $request = $result->fetch_assoc();
        $trainerId = $request['trainer_id'];
        $requestedAmount = floatval($request['amount']);

        // FIXED: Do not apply commission to trainer_net_amount
        // The trainer_net_amount already has platform_fee deducted at booking time
        // Transport fees are not subject to any additional commission or fees
        // Only apply commission if there's a separate B2C processing fee (if applicable)
        // For now, set commission to 0 since trainer_net is already net of all deductions
        $commission = 0;
        $netAmount = $requestedAmount - $commission;

        $phoneQuery = $conn->query("SELECT phone FROM user_profiles WHERE user_id = '$trainerId'");
        if (!$phoneQuery || $phoneQuery->num_rows === 0) {
            respond("error", "Trainer phone not found.", null, 404);
        }

        $trainerData = $phoneQuery->fetch_assoc();
        $phoneNumber = $trainerData['phone'];

        $b2cId = 'b2c_' . uniqid();
        $referenceId = 'payout_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO b2c_payments (
                id, user_id, user_type, phone_number, amount, reference_id, status, initiated_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $userType = 'trainer';
        $status = 'pending';

        $stmt->bind_param("ssssdssss", $b2cId, $trainerId, $userType, $phoneNumber, $netAmount, $referenceId, $status, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();

            $updateStmt = $conn->prepare("
                UPDATE payout_requests
                SET status = ?, b2c_payment_id = ?, commission = ?, net_amount = ?, updated_at = NOW()
                WHERE id = ?
            ");

            $approvedStatus = 'approved';
            $updateStmt->bind_param("ssdds", $approvedStatus, $b2cId, $commission, $netAmount, $payoutRequestId);
            $updateStmt->execute();
            $updateStmt->close();

            logEvent('payout_request_approved', [
                'payout_request_id' => $payoutRequestId,
                'trainer_id' => $trainerId,
                'b2c_payment_id' => $b2cId,
                'net_amount' => $netAmount,
                'commission' => $commission
            ]);

            respond("success", "Payout request approved. B2C payment created.", [
                "b2c_payment_id" => $b2cId,
                "reference_id" => $referenceId,
                "net_amount" => $netAmount,
                "commission" => $commission
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to approve payout: " . $conn->error, null, 500);
        }
        break;

    // GENERATE INVOICE FROM BOOKING
    case 'invoice_generate':
        if (!isset($input['booking_id'])) {
            respond("error", "Missing booking_id.", null, 400);
        }

        $bookingId = $conn->real_escape_string($input['booking_id']);

        // Fetch booking details
        $bookingSql = "SELECT * FROM bookings WHERE id = '$bookingId' LIMIT 1";
        $bookingResult = $conn->query($bookingSql);
        if (!$bookingResult || $bookingResult->num_rows === 0) {
            respond("error", "Booking not found.", null, 404);
        }

        $booking = $bookingResult->fetch_assoc();
        $clientId = $booking['client_id'];
        $trainerId = $booking['trainer_id'];
        $baseServiceAmount = floatval($booking['base_service_amount'] ?? 0);
        $transportFee = floatval($booking['transport_fee'] ?? 0);
        $platformFee = floatval($booking['platform_fee'] ?? 0);
        $vatAmount = floatval($booking['vat_amount'] ?? 0);
        $clientSurcharge = floatval($booking['client_surcharge'] ?? 0);
        $totalAmount = floatval($booking['total_amount'] ?? 0);
        $trainerNetAmount = floatval($booking['trainer_net_amount'] ?? 0);

        // Generate invoice number
        $invoiceNumber = 'INV-' . date('Ymd') . '-' . uniqid();
        $invoiceId = 'invoice_' . uniqid();
        $now = date('Y-m-d H:i:s');
        $subtotal = round($baseServiceAmount + $transportFee, 2);

        // Insert invoice record
        $stmt = $conn->prepare("
            INSERT INTO invoices (
                id, booking_id, client_id, trainer_id, invoice_number,
                base_service_amount, transport_fee, subtotal, platform_fee, vat_amount,
                client_surcharge, total_amount, trainer_net_amount, status, generated_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $status = 'pending';
        $stmt->bind_param(
            "sssssdddddddddsss",
            $invoiceId, $bookingId, $clientId, $trainerId, $invoiceNumber,
            $baseServiceAmount, $transportFee, $subtotal, $platformFee, $vatAmount,
            $clientSurcharge, $totalAmount, $trainerNetAmount, $status, $now, $now, $now
        );

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('invoice_generated', [
                'invoice_id' => $invoiceId,
                'invoice_number' => $invoiceNumber,
                'booking_id' => $bookingId,
                'total_amount' => $totalAmount,
                'trainer_net' => $trainerNetAmount
            ]);

            respond("success", "Invoice generated successfully.", [
                "invoice_id" => $invoiceId,
                "invoice_number" => $invoiceNumber,
                "booking_id" => $bookingId,
                "base_service_amount" => $baseServiceAmount,
                "transport_fee" => $transportFee,
                "subtotal" => $subtotal,
                "platform_fee" => $platformFee,
                "vat_amount" => $vatAmount,
                "total_amount" => $totalAmount,
                "trainer_net_amount" => $trainerNetAmount,
                "generated_at" => $now
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to generate invoice: " . $conn->error, null, 500);
        }
        break;

    // INITIATE AUTOMATIC TRAINER PAYOUT AFTER SESSION COMPLETION
    case 'trainer_payout_initiate':
        if (!isset($input['booking_id'])) {
            respond("error", "Missing booking_id.", null, 400);
        }

        $bookingId = $conn->real_escape_string($input['booking_id']);

        // 1. Validate booking exists and is completed
        $bookingSql = "SELECT * FROM bookings WHERE id = '$bookingId' LIMIT 1";
        $bookingResult = $conn->query($bookingSql);
        if (!$bookingResult || $bookingResult->num_rows === 0) {
            respond("error", "Booking not found.", null, 404);
        }

        $booking = $bookingResult->fetch_assoc();
        if ($booking['status'] !== 'completed') {
            respond("error", "Payout can only be initiated for completed bookings. Current status: " . $booking['status'], null, 400);
        }

        $trainerId = $booking['trainer_id'];
        $trainerNetAmount = floatval($booking['trainer_net_amount'] ?? 0);

        if ($trainerNetAmount <= 0) {
            respond("error", "Trainer net amount must be greater than zero for payout.", null, 400);
        }

        // 2. Ensure trainer has MPESA number in payout_details or profile
        $profileSql = "SELECT payout_details, phone FROM user_profiles WHERE user_id = '$trainerId' LIMIT 1";
        $profileResult = $conn->query($profileSql);
        if (!$profileResult || $profileResult->num_rows === 0) {
            respond("error", "Trainer profile not found.", null, 404);
        }

        $profile = $profileResult->fetch_assoc();
        $payoutDetails = json_decode($profile['payout_details'] ?? '{}', true);

        // Check multiple possible locations for mpesa number
        $mpesaNumber = $payoutDetails['mpesa_number'] ?? $profile['phone'] ?? null;

        if (empty($mpesaNumber)) {
            respond("error", "Trainer MPESA number not found in payout details or profile.", null, 400);
        }

        // Normalize phone number for MPESA B2C (254XXXXXXXXX)
        $mpesaNumber = preg_replace('/[^0-9]/', '', $mpesaNumber);
        if (strlen($mpesaNumber) === 10 && $mpesaNumber[0] === '0') {
            $mpesaNumber = '254' . substr($mpesaNumber, 1);
        } elseif (strlen($mpesaNumber) === 9) {
            $mpesaNumber = '254' . $mpesaNumber;
        }

        // 3. Create b2c_payments record
        $b2cId = 'b2c_' . uniqid();
        $referenceId = 'payout_' . $bookingId;
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO b2c_payments (
                id, user_id, user_type, phone_number, amount, reference_id, status, initiated_at, updated_at
            ) VALUES (?, ?, 'trainer', ?, ?, ?, 'pending', ?, ?)
        ");

        if (!$stmt) {
             respond("error", "Failed to prepare B2C payment statement: " . $conn->error, null, 500);
        }

        $stmt->bind_param("sssdsss", $b2cId, $trainerId, $mpesaNumber, $trainerNetAmount, $referenceId, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();

            // 4. Call initiateB2CPayment() from mpesa_helper.php
            if (function_exists('getMpesaCredentials') && function_exists('initiateB2CPayment')) {
                $creds = getMpesaCredentials();
                if ($creds) {
                    $b2cResult = initiateB2CPayment($creds, $mpesaNumber, $trainerNetAmount, 'BusinessPayment', "Payout for booking $bookingId");
                    if ($b2cResult['success']) {
                        // Update booking to indicate payout initiated
                        $conn->query("UPDATE bookings SET payout_status = 'initiated', updated_at = NOW() WHERE id = '$bookingId'");

                        logEvent('trainer_payout_initiated', [
                            'booking_id' => $bookingId,
                            'trainer_id' => $trainerId,
                            'amount' => $trainerNetAmount,
                            'b2c_payment_id' => $b2cId
                        ]);

                        respond("success", "Trainer payout initiated successfully.", [
                            "b2c_payment_id" => $b2cId,
                            "conversation_id" => $b2cResult['conversation_id'] ?? null
                        ]);
                    } else {
                        // Mark B2C payment as failed
                        $conn->query("UPDATE b2c_payments SET status = 'failed', updated_at = NOW() WHERE id = '$b2cId'");
                        respond("error", "M-Pesa B2C initiation failed: " . ($b2cResult['error'] ?? 'Unknown error'), null, 500);
                    }
                } else {
                    respond("error", "M-Pesa credentials not configured.", null, 500);
                }
            } else {
                respond("error", "M-Pesa helper functions not available.", null, 500);
            }
        } else {
            $stmt->close();
            respond("error", "Failed to create B2C payment record: " . $conn->error, null, 500);
        }
        break;

    // AUTO B2C PAYOUT WHEN PAYMENT COMPLETED
    // Called automatically when a payment is completed (not manual request)
    case 'trainer_payout_auto_b2c':
        if (!isset($input['booking_id']) || !isset($input['trainer_id'])) {
            respond("error", "Missing booking_id or trainer_id.", null, 400);
        }

        $bookingId = $conn->real_escape_string($input['booking_id']);
        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $amount = floatval($input['amount'] ?? 0);
        $reason = $conn->real_escape_string($input['reason'] ?? 'payment_completed');

        if ($amount <= 0) {
            respond("error", "Amount must be greater than zero.", null, 400);
        }

        // 1. Validate booking exists and trainer matches
        $bookingSql = "SELECT * FROM bookings WHERE id = '$bookingId' LIMIT 1";
        $bookingResult = $conn->query($bookingSql);
        if (!$bookingResult || $bookingResult->num_rows === 0) {
            respond("error", "Booking not found.", null, 404);
        }

        $booking = $bookingResult->fetch_assoc();
        if ($booking['trainer_id'] !== $trainerId) {
            respond("error", "Trainer does not match booking trainer.", null, 400);
        }

        // 2. Ensure trainer has MPESA number in payout_details or profile
        $profileSql = "SELECT payout_details, phone FROM user_profiles WHERE user_id = '$trainerId' LIMIT 1";
        $profileResult = $conn->query($profileSql);
        if (!$profileResult || $profileResult->num_rows === 0) {
            error_log("[B2C AUTO] Trainer profile not found for: $trainerId - skipping auto payout");
            respond("error", "Trainer profile not found.", null, 404);
        }

        $profile = $profileResult->fetch_assoc();
        $payoutDetails = json_decode($profile['payout_details'] ?? '{}', true);
        $mpesaNumber = $payoutDetails['mpesa_number'] ?? $profile['phone'] ?? null;

        if (empty($mpesaNumber)) {
            error_log("[B2C AUTO] No MPESA number found for trainer $trainerId - skipping auto payout");
            respond("error", "Trainer MPESA number not configured. Cannot auto-pay.", null, 400);
        }

        // Normalize phone number for MPESA B2C (254XXXXXXXXX)
        $mpesaNumber = preg_replace('/[^0-9]/', '', $mpesaNumber);
        if (strlen($mpesaNumber) === 10 && $mpesaNumber[0] === '0') {
            $mpesaNumber = '254' . substr($mpesaNumber, 1);
        } elseif (strlen($mpesaNumber) === 9) {
            $mpesaNumber = '254' . $mpesaNumber;
        }

        // 3. Create b2c_payments record
        $b2cId = 'b2c_' . uniqid();
        $referenceId = 'payout_' . $bookingId;
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO b2c_payments (
                id, user_id, user_type, phone_number, amount, reference_id, status, initiated_at, updated_at
            ) VALUES (?, ?, 'trainer', ?, ?, ?, 'pending', ?, ?)
        ");

        if (!$stmt) {
            respond("error", "Failed to prepare B2C payment statement: " . $conn->error, null, 500);
        }

        $stmt->bind_param("sssdsss", $b2cId, $trainerId, $mpesaNumber, $amount, $referenceId, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();

            // 4. Call initiateB2CPayment() from mpesa_helper.php
            if (function_exists('getMpesaCredentials') && function_exists('initiateB2CPayment')) {
                $creds = getMpesaCredentials();
                if ($creds) {
                    $b2cResult = initiateB2CPayment($creds, $mpesaNumber, $amount, 'BusinessPayment', "Automatic payout for booking $bookingId ($reason)");
                    if ($b2cResult['success']) {
                        // Update b2c_payments to 'initiated' status
                        $conn->query("UPDATE b2c_payments SET status = 'initiated', updated_at = NOW() WHERE id = '$b2cId'");

                        logEvent('trainer_auto_b2c_initiated', [
                            'booking_id' => $bookingId,
                            'trainer_id' => $trainerId,
                            'amount' => $amount,
                            'b2c_payment_id' => $b2cId,
                            'reason' => $reason
                        ]);

                        error_log("[B2C AUTO] Successfully initiated payout for trainer $trainerId: Ksh " . number_format($amount, 2) . " for booking $bookingId");

                        respond("success", "Trainer auto-payout initiated successfully.", [
                            "b2c_payment_id" => $b2cId,
                            "conversation_id" => $b2cResult['conversation_id'] ?? null
                        ]);
                    } else {
                        // Mark B2C payment as failed
                        $conn->query("UPDATE b2c_payments SET status = 'failed', updated_at = NOW() WHERE id = '$b2cId'");
                        error_log("[B2C AUTO ERROR] Failed to initiate B2C: " . ($b2cResult['error'] ?? 'Unknown error'));
                        respond("error", "M-Pesa B2C initiation failed: " . ($b2cResult['error'] ?? 'Unknown error'), null, 500);
                    }
                } else {
                    error_log("[B2C AUTO ERROR] M-Pesa credentials not configured");
                    respond("error", "M-Pesa credentials not configured.", null, 500);
                }
            } else {
                error_log("[B2C AUTO ERROR] M-Pesa helper functions not available");
                respond("error", "M-Pesa helper functions not available.", null, 500);
            }
        } else {
            $stmt->close();
            respond("error", "Failed to create B2C payment record: " . $conn->error, null, 500);
        }
        break;

    // SAVE ADMIN SETTINGS (including M-Pesa credentials)
    case 'settings_save':
        try {
            $adminToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? null;

            if (isset($input['settings']) && is_array($input['settings'])) {
                $settings = $input['settings'];
                $savedSettings = [];

                // Ensure platform_settings table exists
                $tableCheck = @$conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME='platform_settings' AND TABLE_SCHEMA=DATABASE() LIMIT 1");
                if (!$tableCheck || $tableCheck->num_rows == 0) {
                    $conn->query("CREATE TABLE IF NOT EXISTS `platform_settings` (
                        `setting_key` VARCHAR(255) PRIMARY KEY,
                        `value` LONGTEXT,
                        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )");
                }

                // Save Platform Settings (non-M-Pesa)
                $platformFields = [
                    'platformName', 'supportEmail', 'timezone', 'currency',
                    'commissionRate', 'taxRate', 'payoutSchedule',
                    'emailNotifications', 'maintenanceMode',
                    'cancellationHours', 'rescheduleHours', 'maxDailySessionsPerTrainer',
                    'platformChargeTrainerPercent', 'platformChargeClientPercent',
                    'compensationFeePercent', 'maintenanceFeePercent'
                ];

                $platformSettingsChanged = false;
                foreach ($platformFields as $field) {
                    if (isset($settings[$field])) {
                        try {
                            $saveQuery = "INSERT INTO platform_settings (setting_key, value, updated_at)
                                         VALUES (?, ?, NOW())
                                         ON DUPLICATE KEY UPDATE value=?, updated_at=NOW()";
                            $stmt = $conn->prepare($saveQuery);

                            // Convert value to string for storage
                            $rawValue = $settings[$field];
                            if (is_bool($rawValue)) {
                                $settingValue = $rawValue ? 'true' : 'false';
                            } elseif (is_array($rawValue)) {
                                $settingValue = json_encode($rawValue);
                            } elseif (is_numeric($rawValue)) {
                                $settingValue = (string)$rawValue;
                            } else {
                                $settingValue = (string)$rawValue;
                            }

                            $stmt->bind_param('sss', $field, $settingValue, $settingValue);
                            if ($stmt->execute()) {
                                $savedSettings[$field] = $settings[$field];
                                $platformSettingsChanged = true;
                            }
                            $stmt->close();
                        } catch (Exception $e) {
                            error_log("Error saving setting $field: " . $e->getMessage());
                        }
                    }
                }

                // Log platform settings update if any changes were made
                if ($platformSettingsChanged) {
                    logEvent('admin_settings_updated', [
                        'setting' => 'platform_settings',
                        'fields' => implode(',', array_keys($savedSettings))
                    ]);
                }

                // Save M-Pesa Settings
                if (isset($settings['mpesa']) && is_array($settings['mpesa'])) {
                    $mpesaCreds = $settings['mpesa'];

                    if (empty($mpesaCreds['consumerKey']) || empty($mpesaCreds['consumerSecret'])) {
                        respond("error", "M-Pesa credentials incomplete: consumerKey and consumerSecret required.", null, 400);
                    }

                    // Get current M-Pesa settings to check if anything changed
                    $currentMpesa = null;
                    if (function_exists('getMpesaCredentialsForAdmin')) {
                        $currentMpesa = @getMpesaCredentialsForAdmin();
                    }

                    // Check if M-Pesa settings actually changed
                    $mpesaChanged = true;
                    if (is_array($currentMpesa)) {
                        // Compare key fields to determine if there was a real change
                        // Note: currentMpesa has masked secrets, so we can't compare those directly
                        // Instead, compare non-sensitive fields and other indicators
                        $mpesaChanged = (
                            ($currentMpesa['environment'] ?? '') !== ($mpesaCreds['environment'] ?? '') ||
                            ($currentMpesa['paymentType'] ?? 'paybill') !== ($mpesaCreds['paymentType'] ?? 'paybill') ||
                            ($currentMpesa['shortcode'] ?? '') !== ($mpesaCreds['shortcode'] ?? '') ||
                            ($currentMpesa['buyGoodsShortCode'] ?? '') !== ($mpesaCreds['buyGoodsShortCode'] ?? '') ||
                            ($currentMpesa['buyGoodsMerchantCode'] ?? '') !== ($mpesaCreds['buyGoodsMerchantCode'] ?? '')
                        );
                    }

                    $saveResult = saveMpesaCredentials($mpesaCreds);
                    if (!$saveResult) {
                        respond("error", "Failed to save M-Pesa credentials to database.", null, 500);
                    }

                    // Only log if M-Pesa settings actually changed
                    if ($mpesaChanged) {
                        logEvent('admin_settings_updated', [
                            'setting' => 'mpesa_credentials',
                            'environment' => $mpesaCreds['environment'] ?? 'unknown',
                            'payment_type' => $mpesaCreds['paymentType'] ?? 'paybill',
                            'shortcode' => $mpesaCreds['shortcode'] ?? 'unknown'
                        ]);
                    }
                }

                respond("success", "Settings saved successfully.", [
                    "saved_at" => date('Y-m-d H:i:s'),
                    "platform_settings_saved" => count($savedSettings) > 0,
                    "mpesa_configured" => !empty($settings['mpesa']['consumerKey'])
                ]);
            } else {
                respond("error", "Invalid settings format.", null, 400);
            }
        } catch (Exception $e) {
            logEvent('settings_save_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to save settings: " . $e->getMessage(), null, 500);
        }
        break;

    // GET ADMIN SETTINGS (retrieve all settings including M-Pesa credentials)
    case 'settings_get':
        try {
            $platformSettings = [];
            $mpesaCreds = null;

            // Retrieve platform settings from database
            if ($conn) {
                $result = @$conn->query("SELECT setting_key, value FROM platform_settings");
                if ($result) {
                    while ($row = $result->fetch_assoc()) {
                        $key = $row['setting_key'];
                        $value = $row['value'];

                        // Convert boolean-like values
                        if ($value === 'true') {
                            $platformSettings[$key] = true;
                        } elseif ($value === 'false') {
                            $platformSettings[$key] = false;
                        } else {
                            // Try to decode JSON values
                            $decoded = @json_decode($value, true);
                            // Try to convert numeric strings to numbers
                            $platformSettings[$key] = $decoded !== null ? $decoded : (is_numeric($value) ? (strpos($value, '.') !== false ? floatval($value) : intval($value)) : $value);
                        }
                    }
                }
            }

            // Retrieve M-Pesa credentials
            if (function_exists('getMpesaCredentialsForAdmin')) {
                $mpesaCreds = @getMpesaCredentialsForAdmin();
            }

            if (!is_array($mpesaCreds)) {
                $mpesaCreds = null;
            }

            respond("success", "Settings retrieved.", [
                "platformSettings" => $platformSettings,
                "mpesa" => $mpesaCreds,
                "mpesa_source" => $mpesaCreds && isset($mpesaCreds['source']) ? $mpesaCreds['source'] : null
            ]);
        } catch (Exception $e) {
            logEvent('settings_get_error', ['error' => $e->getMessage()]);
            respond("success", "Settings retrieved (with defaults).", [
                "platformSettings" => [],
                "mpesa" => null,
                "mpesa_source" => null
            ]);
        }
        break;

    // SMS: SAVE SMS SETTINGS
    case 'settings_sms_save':
        try {
            // Validate admin authorization
            $adminUserId = validateAdminAuthorization($conn);

            // Accept settings data directly (not wrapped in sms_settings)
            $settings = $input;

            // Validate required fields (without sms_ prefix)
            if (empty($settings['api_key']) || empty($settings['client_id']) || empty($settings['access_key'])) {
                respond("error", "Missing required SMS credentials: api_key, client_id, access_key.", null, 400);
            }

            // Save SMS credentials
            $saveResult = saveSmsCredentials($settings);
            if (!$saveResult) {
                respond("error", "Failed to save SMS credentials.", null, 500);
            }

            logEvent('admin_settings_updated', ['setting' => 'sms_credentials']);

            respond("success", "SMS settings saved successfully.", [
                "saved_at" => date('Y-m-d H:i:s'),
                "sms_enabled" => $settings['enabled'] ?? true
            ]);
        } catch (Exception $e) {
            logEvent('settings_sms_save_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to save SMS settings: " . $e->getMessage(), null, 500);
        }
        break;

    // SMS: TEST SMS CONNECTION
    case 'settings_sms_test':
        try {
            // Validate admin authorization
            $adminUserId = validateAdminAuthorization($conn);

            // Get credentials from request (for testing before saving)
            $testCreds = [
                'api_key' => $input['api_key'] ?? null,
                'client_id' => $input['client_id'] ?? null,
                'access_key' => $input['access_key'] ?? null,
                'sender_id' => $input['sender_id'] ?? 'TRAINER LTD',
                'enabled' => true
            ];

            // Validate required fields
            if (empty($testCreds['api_key']) || empty($testCreds['client_id']) || empty($testCreds['access_key'])) {
                respond("error", "Missing required credentials for testing.", null, 400);
            }

            // Send a test SMS with minimal payload to validate credentials
            $testResult = sendSmsViaOnfonmedia(['254712345678'], "Test message from Trainer Coach Connect", $testCreds);

            if ($testResult['success']) {
                respond("success", "SMS service connection is working correctly.", [
                    "success" => true,
                    "message" => "Connection test successful",
                    "provider_response" => $testResult['provider_response'] ?? null
                ]);
            } else {
                respond("error", "Connection test failed: " . ($testResult['error'] ?? 'Unknown error'), null, 500);
            }
        } catch (Exception $e) {
            logEvent('settings_sms_test_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to test SMS connection: " . $e->getMessage(), null, 500);
        }
        break;

    // SMS: GET SMS SETTINGS
    case 'settings_sms_get':
        try {
            // Validate admin authorization
            $adminUserId = validateAdminAuthorization($conn);

            $smsCreds = getSmsCredentials();

            if (!$smsCreds) {
                respond("success", "SMS settings retrieved (not configured).", [
                    "sms_configured" => false,
                    "sender_id" => "TRAINER LTD"
                ]);
            }

            respond("success", "SMS settings retrieved.", [
                "sms_configured" => true,
                "sms_enabled" => $smsCreds['enabled'],
                "sms_sender_id" => $smsCreds['sender_id'],
                "sms_admin_phone" => $smsCreds['admin_phone'] ?? '',
                "sms_source" => $smsCreds['source'],
                "api_key_exists" => !empty($smsCreds['api_key']),
                "client_id_exists" => !empty($smsCreds['client_id']),
                "access_key_exists" => !empty($smsCreds['access_key'])
            ]);
        } catch (Exception $e) {
            logEvent('settings_sms_get_error', ['error' => $e->getMessage()]);
            respond("success", "SMS settings retrieved (error).", [
                "sms_configured" => false
            ]);
        }
        break;

    // SMS TEMPLATES: GET ALL TEMPLATES
    case 'sms_templates_get':
        try {
            // Validate admin authorization
            $adminUserId = validateAdminAuthorization($conn);

            // Ensure table exists
            $tableCheck = @$conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME='sms_templates' AND TABLE_SCHEMA=DATABASE() LIMIT 1");
            if (!$tableCheck || $tableCheck->num_rows == 0) {
                respond("success", "No SMS templates found.", ["data" => []]);
            }

            $result = $conn->query("
                SELECT id, name, event_type, template_text, active, created_at, updated_at
                FROM sms_templates
                ORDER BY event_type, name
            ");

            if (!$result) {
                respond("error", "Failed to fetch templates.", null, 500);
            }

            $templates = [];
            while ($row = $result->fetch_assoc()) {
                $templates[] = $row;
            }

            respond("success", "SMS templates fetched successfully.", ["data" => $templates]);
        } catch (Exception $e) {
            logEvent('sms_templates_get_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to fetch SMS templates: " . $e->getMessage(), null, 500);
        }
        break;

    // SMS TEMPLATES: CREATE OR UPDATE TEMPLATE
    case 'sms_templates_save':
        try {
            // Validate admin authorization
            $adminUserId = validateAdminAuthorization($conn);

            if (!isset($input['template']) || !is_array($input['template'])) {
                respond("error", "Invalid template format.", null, 400);
            }

            $template = $input['template'];

            if (empty($template['name']) || empty($template['event_type']) || empty($template['template_text'])) {
                respond("error", "Missing required fields: name, event_type, template_text.", null, 400);
            }

            // Ensure table exists
            @$conn->query("
                CREATE TABLE IF NOT EXISTS `sms_templates` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `name` VARCHAR(255) NOT NULL UNIQUE,
                  `event_type` VARCHAR(50) NOT NULL,
                  `template_text` LONGTEXT NOT NULL,
                  `active` BOOLEAN DEFAULT TRUE,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX `idx_event_type` (`event_type`),
                  INDEX `idx_active` (`active`),
                  INDEX `idx_name` (`name`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            $id = $template['id'] ?? null;
            $name = $conn->real_escape_string($template['name']);
            $eventType = $conn->real_escape_string($template['event_type']);
            $templateText = $conn->real_escape_string($template['template_text']);
            $active = $template['active'] ?? true ? 1 : 0;

            if ($id) {
                // Update existing template
                $stmt = $conn->prepare("
                    UPDATE sms_templates
                    SET name=?, event_type=?, template_text=?, active=?, updated_at=NOW()
                    WHERE id=?
                ");
                $stmt->bind_param("sssss", $name, $eventType, $templateText, $active, $id);
            } else {
                // Create new template
                $id = bin2hex(random_bytes(18));
                $stmt = $conn->prepare("
                    INSERT INTO sms_templates (id, name, event_type, template_text, active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
                ");
                $stmt->bind_param("sssss", $id, $name, $eventType, $templateText, $active);
            }

            if (!$stmt->execute()) {
                respond("error", "Failed to save template: " . $stmt->error, null, 500);
            }

            $stmt->close();
            logEvent('sms_template_saved', ['template_id' => $id, 'name' => $name]);

            respond("success", ($template['id'] ? "Template updated" : "Template created") . " successfully.", [
                "template_id" => $id,
                "name" => $name,
                "event_type" => $eventType
            ]);
        } catch (Exception $e) {
            logEvent('sms_templates_save_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to save SMS template: " . $e->getMessage(), null, 500);
        }
        break;

    // SMS TEMPLATES: DELETE TEMPLATE
    case 'sms_templates_delete':
        try {
            // Validate admin authorization
            $adminUserId = validateAdminAuthorization($conn);

            if (!isset($input['template_id'])) {
                respond("error", "Missing template_id.", null, 400);
            }

            $templateId = $conn->real_escape_string($input['template_id']);

            $stmt = $conn->prepare("DELETE FROM sms_templates WHERE id=?");
            $stmt->bind_param("s", $templateId);

            if (!$stmt->execute()) {
                respond("error", "Failed to delete template.", null, 500);
            }

            $stmt->close();
            logEvent('sms_template_deleted', ['template_id' => $templateId]);

            respond("success", "Template deleted successfully.", ["template_id" => $templateId]);
        } catch (Exception $e) {
            logEvent('sms_templates_delete_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to delete SMS template: " . $e->getMessage(), null, 500);
        }
        break;

    // SMS: SEND MANUAL SMS
    case 'sms_send_manual':
        try {
            // Validate admin authorization
            $adminUserId = validateAdminAuthorization($conn);

            $message = '';
            $templateId = null;
            $templateData = [];

            // Support both template-based and raw message sending
            if (!empty($input['template_id'])) {
                // Template-based sending
                $templateId = $conn->real_escape_string($input['template_id']);
                $template = getSmsTemplate($templateId, false, true); // Search by ID

                if (!$template) {
                    respond("error", "SMS template not found.", null, 400);
                }

                // Get template data from request
                if (isset($input['template_data']) && is_array($input['template_data'])) {
                    $templateData = $input['template_data'];
                }

                // Replace placeholders in template
                $message = replaceTemplatePlaceholders($template['template_text'], $templateData);
                $templateId = $template['id'];
            } elseif (!empty($input['message'])) {
                // Raw message sending
                $message = $conn->real_escape_string($input['message']);
            } else {
                respond("error", "Missing message content or template_id.", null, 400);
            }

            $phoneNumbers = [];
            $userIds = [];
            $userPhoneMap = []; // Map user IDs to their phone numbers for personalized templates

            // Get phone numbers from direct list or from users
            if (isset($input['phone_numbers']) && is_array($input['phone_numbers'])) {
                $phoneNumbers = array_filter($input['phone_numbers']);
            } elseif (isset($input['user_ids']) && is_array($input['user_ids'])) {
                $userIds = array_filter($input['user_ids']);
                // Fetch phone numbers and user data for users
                foreach ($userIds as $userId) {
                    $stmt = $conn->prepare("SELECT id, phone, CONCAT(first_name, ' ', last_name) as user_name, first_name, email FROM users WHERE id=? LIMIT 1");
                    $stmt->bind_param("s", $userId);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    if ($result && $row = $result->fetch_assoc()) {
                        if (!empty($row['phone'])) {
                            $phoneNumbers[] = $row['phone'];
                            $userPhoneMap[$row['phone']] = $row;
                        }
                    }
                    $stmt->close();
                }
            } elseif (isset($input['user_group'])) {
                // Send to user group
                $group = $conn->real_escape_string($input['user_group']);

                if ($group === 'all') {
                    $result = $conn->query("SELECT id, phone, CONCAT(first_name, ' ', last_name) as user_name, first_name, email FROM users WHERE phone IS NOT NULL AND phone != '' LIMIT 10000");
                } elseif ($group === 'trainers') {
                    $result = $conn->query("
                        SELECT u.id, u.phone, CONCAT(u.first_name, ' ', u.last_name) as user_name, u.first_name, u.email
                        FROM users u
                        INNER JOIN user_profiles up ON u.id = up.user_id
                        WHERE up.user_type='trainer' AND u.phone IS NOT NULL AND u.phone != '' LIMIT 10000
                    ");
                } elseif ($group === 'clients') {
                    $result = $conn->query("
                        SELECT u.id, u.phone, CONCAT(u.first_name, ' ', u.last_name) as user_name, u.first_name, u.email
                        FROM users u
                        INNER JOIN user_profiles up ON u.id = up.user_id
                        WHERE up.user_type='client' AND u.phone IS NOT NULL AND u.phone != '' LIMIT 10000
                    ");
                } else {
                    respond("error", "Invalid user group.", null, 400);
                }

                if ($result) {
                    while ($row = $result->fetch_assoc()) {
                        $phoneNumbers[] = $row['phone'];
                        $userIds[] = $row['id'];
                        $userPhoneMap[$row['phone']] = $row;
                    }
                }
            } else {
                respond("error", "Missing recipient information (phone_numbers, user_ids, or user_group).", null, 400);
            }

            if (empty($phoneNumbers)) {
                respond("error", "No valid phone numbers to send SMS to.", null, 400);
            }

            // Send SMS
            $credentials = getSmsCredentials();
            if (!$credentials || !$credentials['enabled']) {
                respond("error", "SMS service not configured.", null, 500);
            }

            $result = sendSmsViaOnfonmedia($phoneNumbers, $message, $credentials);

            if (!$result['success']) {
                respond("error", "Failed to send SMS: " . $result['error'], null, 500);
            }

            // Log SMS sends with personalization if using template
            $smsLogIds = [];
            foreach ($phoneNumbers as $phone) {
                $finalMessage = $message;
                $userId = null;

                // If template-based and we have user data, personalize the message
                if (!empty($templateId) && isset($userPhoneMap[$phone])) {
                    $userData = $userPhoneMap[$phone];
                    $userData = array_merge($userData, $templateData); // Merge with any additional template data
                    $finalMessage = replaceTemplatePlaceholders($message, $userData);
                    $userId = $userData['id'];
                }

                $logId = logSmsEvent($userId, $phone, $finalMessage, $templateId, 'admin_manual', null, 'sent', $result['provider_response'] ?? null);
                if ($logId) {
                    $smsLogIds[] = $logId;
                }
            }

            logEvent('sms_bulk_sent', [
                'count' => count($phoneNumbers),
                'group' => $input['user_group'] ?? 'manual',
                'template_id' => $templateId,
                'admin_id' => $adminUserId
            ]);

            respond("success", "SMS sent to " . count($phoneNumbers) . " recipient(s).", [
                "sent_count" => count($phoneNumbers),
                "sms_log_ids" => $smsLogIds,
                "template_id" => $templateId
            ]);
        } catch (Exception $e) {
            logEvent('sms_send_manual_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to send SMS: " . $e->getMessage(), null, 500);
        }
        break;

    // SMS LOGS: GET SMS HISTORY
    case 'sms_logs_get':
        try {
            // Validate admin authorization
            $adminUserId = validateAdminAuthorization($conn);

            $tableCheck = @$conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME='sms_logs' AND TABLE_SCHEMA=DATABASE() LIMIT 1");
            if (!$tableCheck || $tableCheck->num_rows == 0) {
                respond("success", "No SMS logs found.", ["data" => []]);
            }

            // Build query with filters
            $where = [];
            $params = [];
            $types = '';

            if (isset($input['event_type']) && !empty($input['event_type'])) {
                $where[] = "event_type = ?";
                $params[] = $conn->real_escape_string($input['event_type']);
                $types .= 's';
            }

            if (isset($input['status']) && !empty($input['status'])) {
                $where[] = "status = ?";
                $params[] = $conn->real_escape_string($input['status']);
                $types .= 's';
            }

            if (isset($input['user_id']) && !empty($input['user_id'])) {
                $where[] = "user_id = ?";
                $params[] = $conn->real_escape_string($input['user_id']);
                $types .= 's';
            }

            if (isset($input['date_from']) && !empty($input['date_from'])) {
                $where[] = "created_at >= ?";
                $params[] = $conn->real_escape_string($input['date_from']);
                $types .= 's';
            }

            if (isset($input['date_to']) && !empty($input['date_to'])) {
                $where[] = "created_at <= ?";
                $params[] = $conn->real_escape_string($input['date_to']);
                $types .= 's';
            }

            $whereClause = empty($where) ? '' : 'WHERE ' . implode(' AND ', $where);

            // Get total count
            $countSql = "SELECT COUNT(*) as total FROM sms_logs $whereClause";
            $countResult = $conn->query($countSql);
            $totalCount = $countResult ? $countResult->fetch_assoc()['total'] : 0;

            // Pagination
            $limit = $input['limit'] ?? 50;
            $offset = $input['offset'] ?? 0;
            $limit = min($limit, 1000);

            $sql = "
                SELECT id, user_id, phone_number, message, template_id, event_type, event_id, status, sent_at, created_at
                FROM sms_logs
                $whereClause
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ";

            $stmt = $conn->prepare($sql);
            if ($types) {
                $params[] = $limit;
                $params[] = $offset;
                $types .= 'ii';

                $stmt->bind_param($types, ...$params);
            } else {
                $stmt->bind_param('ii', $limit, $offset);
            }

            if (!$stmt->execute()) {
                respond("error", "Failed to fetch SMS logs.", null, 500);
            }

            $result = $stmt->get_result();
            $logs = [];
            while ($row = $result->fetch_assoc()) {
                $logs[] = $row;
            }
            $stmt->close();

            respond("success", "SMS logs fetched successfully.", [
                "data" => $logs,
                "total" => $totalCount,
                "limit" => $limit,
                "offset" => $offset
            ]);
        } catch (Exception $e) {
            logEvent('sms_logs_get_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to fetch SMS logs: " . $e->getMessage(), null, 500);
        }
        break;

    // SMS LOGS: DELETE OLD LOGS
    case 'sms_logs_delete':
        try {
            if (!isset($input['days'])) {
                $days = 90; // Default: delete logs older than 90 days
            } else {
                $days = intval($input['days']);
            }

            if ($days < 1) {
                respond("error", "Days must be at least 1.", null, 400);
            }

            $stmt = $conn->prepare("DELETE FROM sms_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)");
            $stmt->bind_param("i", $days);

            if (!$stmt->execute()) {
                respond("error", "Failed to delete SMS logs.", null, 500);
            }

            $deletedCount = $conn->affected_rows;
            $stmt->close();

            logEvent('sms_logs_deleted', ['days' => $days, 'count' => $deletedCount]);

            respond("success", "Deleted $deletedCount old SMS log(s).", [
                "deleted_count" => $deletedCount,
                "older_than_days" => $days
            ]);
        } catch (Exception $e) {
            logEvent('sms_logs_delete_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to delete SMS logs: " . $e->getMessage(), null, 500);
        }
        break;

    // INITIATE B2C PAYMENT
    case 'b2c_payment_initiate':
        if (!isset($input['b2c_payment_id']) || !isset($input['phone_number']) || !isset($input['amount'])) {
            respond("error", "Missing required fields: b2c_payment_id, phone_number, amount.", null, 400);
        }

        $credValidation = validateMpesaCredentialsConfigured();
        if (!$credValidation['valid']) {
            respond("error", $credValidation['error'], null, 500);
        }

        $b2cPaymentId = $conn->real_escape_string($input['b2c_payment_id']);
        $phoneNumber = $conn->real_escape_string($input['phone_number']);
        $amount = floatval($input['amount']);

        $phoneNumber = str_replace(['+', ' ', '-'], '', $phoneNumber);
        if (substr($phoneNumber, 0, 1) !== '2') {
            $phoneNumber = '254' . substr($phoneNumber, -9);
        }

        if (strlen($phoneNumber) !== 12 || !is_numeric($phoneNumber)) {
            respond("error", "Invalid phone number format.", null, 400);
        }

        $refQuery = $conn->query("SELECT reference_id FROM b2c_payments WHERE id = '$b2cPaymentId'");
        if (!$refQuery || $refQuery->num_rows === 0) {
            respond("error", "B2C payment not found.", null, 404);
        }

        $refData = $refQuery->fetch_assoc();
        $referenceId = $refData['reference_id'];

        $mpesaCreds = getMpesaCredentials();
        if (!$mpesaCreds) {
            respond("error", "M-Pesa credentials not properly configured.", null, 500);
        }

        $resultUrl = $mpesaCreds['result_url'] ?? null;
        $queueTimeoutUrl = $mpesaCreds['result_url'] ?? null;

        $b2cResult = initiateB2CPayment(
            $mpesaCreds,
            $phoneNumber,
            $amount,
            'BusinessPayment',
            'Payout: ' . $referenceId,
            $queueTimeoutUrl,
            $resultUrl
        );

        if (!$b2cResult['success']) {
            logPaymentEvent('b2c_payment_failed', [
                'b2c_payment_id' => $b2cPaymentId,
                'phone' => $phoneNumber,
                'amount' => $amount,
                'error' => $b2cResult['error']
            ]);
            respond("error", $b2cResult['error'], null, 500);
        }

        $conversationId = $b2cResult['conversation_id'];
        $originatorConversationId = $b2cResult['originator_conversation_id'];
        $initiatedStatus = 'initiated';

        $updateStmt = $conn->prepare("
            UPDATE b2c_payments
            SET status = ?, conversation_id = ?, originator_conversation_id = ?, updated_at = NOW()
            WHERE id = ?
        ");

        if (!$updateStmt) {
            respond("error", "Failed to update payment: " . $conn->error, null, 500);
        }

        $updateStmt->bind_param("ssss", $initiatedStatus, $conversationId, $originatorConversationId, $b2cPaymentId);

        if (!$updateStmt->execute()) {
            $updateStmt->close();
            respond("error", "Failed to update B2C payment status: " . $conn->error, null, 500);
        }
        $updateStmt->close();

        logPaymentEvent('b2c_payment_initiated', [
            'b2c_payment_id' => $b2cPaymentId,
            'reference_id' => $referenceId,
            'amount' => $amount,
            'phone' => $phoneNumber,
            'conversation_id' => $conversationId,
            'credentials_source' => $mpesaCreds['source']
        ]);

        respond("success", "B2C payment initiated successfully. Waiting for M-Pesa callback.", [
            "b2c_payment_id" => $b2cPaymentId,
            "reference_id" => $referenceId,
            "conversation_id" => $conversationId,
            "status" => "initiated"
        ]);
        break;

    // GET B2C PAYMENT STATUS
    case 'b2c_payment_status':
        if (!isset($input['b2c_payment_id'])) {
            respond("error", "Missing b2c_payment_id.", null, 400);
        }

        $b2cPaymentId = $conn->real_escape_string($input['b2c_payment_id']);
        $sql = "SELECT bp.*, bc.result_code, bc.result_description, bc.transaction_id
                FROM b2c_payments bp
                LEFT JOIN b2c_payment_callbacks bc ON bp.reference_id = bc.reference_id
                WHERE bp.id = '$b2cPaymentId' LIMIT 1";

        $result = $conn->query($sql);

        if (!$result || $result->num_rows === 0) {
            respond("error", "B2C payment not found.", null, 404);
        }

        $payment = $result->fetch_assoc();
        respond("success", "B2C payment status fetched.", ["data" => $payment]);
        break;

    // GET B2C PAYMENTS (for admin or trainer)
    case 'b2c_payments_get':
        $trainerId = isset($input['trainer_id']) ? $conn->real_escape_string($input['trainer_id']) : null;
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : null;
        $page = isset($input['page']) ? max(1, intval($input['page'])) : 1;
        $limit = isset($input['limit']) ? max(1, min(100, intval($input['limit']))) : 20;
        $offset = ($page - 1) * $limit;

        $where = "1=1";
        if ($trainerId) {
            $where .= " AND bp.user_id = '$trainerId'";
        }
        if ($status) {
            $where .= " AND bp.status = '$status'";
        }

        $countSql = "SELECT COUNT(*) as total FROM b2c_payments bp WHERE $where";
        $countResult = $conn->query($countSql);
        $totalCount = $countResult ? $countResult->fetch_assoc()['total'] : 0;

        $sql = "SELECT bp.*, bc.result_code, bc.result_description, bc.transaction_id
                FROM b2c_payments bp
                LEFT JOIN b2c_payment_callbacks bc ON bp.reference_id = bc.reference_id
                WHERE $where
                ORDER BY bp.initiated_at DESC
                LIMIT $limit OFFSET $offset";

        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $payments = [];
        while ($row = $result->fetch_assoc()) {
            $payments[] = $row;
        }

        respond("success", "B2C payments fetched.", [
            "data" => $payments,
            "page" => $page,
            "limit" => $limit,
            "total" => $totalCount,
            "totalPages" => ceil($totalCount / $limit)
        ]);
        break;

    // ============================================================================
    // STK PUSH PAYMENT ENDPOINTS
    // ============================================================================

    // INITIATE STK PUSH PAYMENT
    case 'mpesa_stk_initiate':
    case 'stk_push_initiate':
        error_log("[API STK PUSH] === STK PUSH INITIATE REQUEST START ===");
        error_log("[API STK PUSH] Request input: phone=" . ($input['phone'] ?? 'N/A') . ", amount=" . ($input['amount'] ?? 'N/A') . ", booking_id=" . ($input['booking_id'] ?? 'none'));

        if (!isset($input['phone']) || !isset($input['amount'])) {
            respond("error", "Missing required fields: phone, amount.", null, 400);
        }

        $credValidation = validateMpesaCredentialsConfigured();
        if (!$credValidation['valid']) {
            error_log("[API STK PUSH ERROR] M-Pesa credentials validation failed: " . $credValidation['error']);
            respond("error", $credValidation['error'], null, 500);
        }
        error_log("[API STK PUSH] Credentials validation passed");

        $phone = $conn->real_escape_string($input['phone']);
        $amount = floatval($input['amount']);
        $bookingId = isset($input['booking_id']) ? $conn->real_escape_string($input['booking_id']) : null;
        $clientId = isset($input['client_id']) ? $conn->real_escape_string($input['client_id']) : ($user['id'] ?? null);
        $trainerId = isset($input['trainer_id']) ? $conn->real_escape_string($input['trainer_id']) : null;
        $accountReference = isset($input['account_reference']) ? $conn->real_escape_string($input['account_reference']) : 'payment_' . uniqid();
        $description = isset($input['transaction_description']) ? $conn->real_escape_string($input['transaction_description']) : 'Service Payment';

        $phone = str_replace(['+', ' ', '-'], '', $phone);
        if (substr($phone, 0, 1) !== '2') {
            $phone = '254' . substr($phone, -9);
        }
        error_log("[API STK PUSH] Phone normalized: original=" . $input['phone'] . ", normalized=" . $phone);

        if (strlen($phone) !== 12 || !is_numeric($phone)) {
            error_log("[API STK PUSH ERROR] Invalid phone number format: " . $phone);
            respond("error", "Invalid phone number format.", null, 400);
        }

        if ($amount < 5 || $amount > 150000) {
            error_log("[API STK PUSH ERROR] Amount validation failed: amount=" . $amount);
            respond("error", "Amount must be between 5 and 150000.", null, 400);
        }
        error_log("[API STK PUSH] Amount validated: " . $amount);

        $mpesaCreds = getMpesaCredentials();
        if (!$mpesaCreds) {
            error_log("[API STK PUSH ERROR] Failed to retrieve M-Pesa credentials from database");
            respond("error", "M-Pesa credentials not properly configured.", null, 500);
        }
        error_log("[API STK PUSH] M-Pesa credentials retrieved, environment: " . ($mpesaCreds['environment'] ?? 'sandbox') . ", shortcode: " . ($mpesaCreds['shortcode'] ?? 'N/A'));

        $callbackUrl = null;
        if (!empty($mpesaCreds['result_url'])) {
            $callbackUrl = $mpesaCreds['result_url'];
        }
        error_log("[API STK PUSH] Callback URL configured: " . ($callbackUrl ?? 'default'));

        error_log("[API STK PUSH] Calling initiateSTKPush() with: phone=" . $phone . ", amount=" . $amount . ", reference=" . $accountReference . ", force_payment_type=buygods");
        // Force Buy Goods algorithm for client bookings - ensures CustomerBuyGoodsOnline transaction type
        $stkResult = initiateSTKPush($mpesaCreds, $phone, $amount, $accountReference, $callbackUrl, 'buygods');

        if (!$stkResult['success']) {
            error_log("[API STK PUSH ERROR] STK push failed: " . $stkResult['error']);
            logPaymentEvent('stk_push_failed', [
                'phone' => $phone,
                'amount' => $amount,
                'error' => $stkResult['error']
            ]);
            respond("error", $stkResult['error'], null, 500);
        }
        error_log("[API STK PUSH] STK push succeeded, CheckoutRequestID: " . ($stkResult['checkout_request_id'] ?? 'N/A') . ", MerchantRequestID: " . ($stkResult['merchant_request_id'] ?? 'N/A'));

        $sessionId = 'stk_' . uniqid();
        $now = date('Y-m-d H:i:s');
        $checkoutRequestId = $stkResult['checkout_request_id'];
        $initStatus = 'initiated';

        $createTableSql = "
            CREATE TABLE IF NOT EXISTS `stk_push_sessions` (
                `id` VARCHAR(36) PRIMARY KEY,
                `client_id` VARCHAR(36),
                `trainer_id` VARCHAR(36),
                `phone_number` VARCHAR(20) NOT NULL,
                `amount` DECIMAL(15, 2) NOT NULL,
                `booking_id` VARCHAR(36),
                `account_reference` VARCHAR(255) NOT NULL,
                `description` TEXT,
                `checkout_request_id` VARCHAR(255) UNIQUE,
                `merchant_request_id` VARCHAR(255),
                `status` VARCHAR(50) DEFAULT 'initiated',
                `result_code` VARCHAR(10),
                `result_description` TEXT,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_phone` (`phone_number`),
                INDEX `idx_status` (`status`),
                INDEX `idx_checkout` (`checkout_request_id`),
                INDEX `idx_booking_id` (`booking_id`),
                INDEX `idx_client_id` (`client_id`),
                INDEX `idx_trainer_id` (`trainer_id`),
                INDEX `idx_created_at` (`created_at` DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->query($createTableSql);

        $stmt = $conn->prepare("
            INSERT INTO stk_push_sessions (
                id, client_id, trainer_id, phone_number, amount, booking_id, account_reference, description, checkout_request_id, merchant_request_id, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        if (!$stmt) {
            respond("error", "Failed to create session record: " . $conn->error, null, 500);
        }

        $merchantRequestId = $stkResult['merchant_request_id'] ?? '';
        $stmt->bind_param("ssssdssssssss", $sessionId, $clientId, $trainerId, $phone, $amount, $bookingId, $accountReference, $description, $checkoutRequestId, $merchantRequestId, $initStatus, $now, $now);

        if (!$stmt->execute()) {
            $stmt->close();
            respond("error", "Failed to save session: " . $conn->error, null, 500);
        }
        $stmt->close();
        error_log("[API STK PUSH] Session created: session_id=" . $sessionId . ", checkout_request_id=" . $checkoutRequestId);

        logPaymentEvent('stk_push_initiated', [
            'session_id' => $sessionId,
            'phone' => $phone,
            'amount' => $amount,
            'checkout_request_id' => $checkoutRequestId,
            'credentials_source' => $mpesaCreds['source']
        ]);
        error_log("[API STK PUSH] === STK PUSH INITIATE REQUEST END - SUCCESS ===");

        respond("success", "STK push initiated successfully.", [
            "session_id" => $sessionId,
            "checkout_request_id" => $checkoutRequestId,
            "merchant_request_id" => $stkResult['merchant_request_id'] ?? '',
            "response_code" => $stkResult['response_code'] ?? '',
            "response_description" => $stkResult['response_description'] ?? '',
            "phone" => $phone,
            "amount" => $amount
        ]);
        break;

    // QUERY STK PUSH STATUS
    case 'mpesa_stk_query':
    case 'stk_push_query':
        error_log("[API STK QUERY] === STK QUERY REQUEST START ===");
        error_log("[API STK QUERY] Request input: checkout_request_id=" . ($input['checkout_request_id'] ?? 'N/A'));

        if (!isset($input['checkout_request_id'])) {
            respond("error", "Missing checkout_request_id.", null, 400);
        }

        $credValidation = validateMpesaCredentialsConfigured();
        if (!$credValidation['valid']) {
            error_log("[API STK QUERY ERROR] Credentials validation failed: " . $credValidation['error']);
            respond("error", $credValidation['error'], null, 500);
        }
        error_log("[API STK QUERY] Credentials validation passed");

        $checkoutRequestId = $conn->real_escape_string($input['checkout_request_id']);

        $sql = "SELECT * FROM stk_push_sessions WHERE checkout_request_id = ? LIMIT 1";
        $stmt = $conn->prepare($sql);

        if (!$stmt) {
            respond("error", "Table does not exist yet. Initialize payments first.", null, 500);
        }

        $stmt->bind_param("s", $checkoutRequestId);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        if ($result->num_rows === 0) {
            respond("error", "Session not found.", null, 404);
        }

        $session = $result->fetch_assoc();

        $mpesaCreds = getMpesaCredentials();
        if (!$mpesaCreds) {
            error_log("[API STK QUERY ERROR] Failed to retrieve M-Pesa credentials");
            respond("error", "M-Pesa credentials not configured.", null, 500);
        }
        error_log("[API STK QUERY] M-Pesa credentials retrieved, environment: " . ($mpesaCreds['environment'] ?? 'sandbox'));

        error_log("[API STK QUERY] Calling querySTKPushStatus() for checkout_request_id=" . $checkoutRequestId);
        $queryResult = querySTKPushStatus($mpesaCreds, $checkoutRequestId);
        error_log("[API STK QUERY] Query result: success=" . ($queryResult['success'] ? 'true' : 'false') . ", result_code=" . ($queryResult['result_code'] ?? 'N/A'));

        if ($queryResult['success'] && $queryResult['result_code'] === '0') {
            // Record payment if not already recorded (via helper)
            recordMpesaPayment($conn, $session, $queryResult['result_code'], $queryResult['result_description']);

            // Also update session status in DB if needed
            if ($session['status'] !== 'success') {
                $conn->query("UPDATE stk_push_sessions SET status = 'success', result_code = '0', updated_at = NOW() WHERE checkout_request_id = '$checkoutRequestId'");
            }
        }

        if (!$queryResult['success']) {
            error_log("[API STK QUERY] Query failed, returning cached data");
            logPaymentEvent('stk_push_query_failed', [
                'checkout_request_id' => $checkoutRequestId,
                'error' => $queryResult['error']
            ]);

            respond("success", "STK push status retrieved (cached).", [
                "session_id" => $session['id'],
                "status" => $session['status'],
                "result_code" => $session['result_code'],
                "result_description" => $session['result_description'],
                "amount" => $session['amount'],
                "phone" => $session['phone_number'],
                "cached" => true
            ]);
        }

        error_log("[API STK QUERY] === STK QUERY REQUEST END - SUCCESS ===");
        respond("success", "STK push status retrieved.", [
            "session_id" => $session['id'],
            "status" => $queryResult['result_code'] === '0' ? 'success' : 'pending',
            "result_code" => $queryResult['result_code'],
            "result_description" => $queryResult['result_description'],
            "amount" => $session['amount'],
            "phone" => $session['phone_number']
        ]);
        break;

    // COMPLETE STK PUSH PAYMENT (callback from M-Pesa)
    case 'stk_push_callback':
        if (!isset($input['checkout_request_id'])) {
            respond("error", "Missing checkout_request_id.", null, 400);
        }

        $checkoutRequestId = $conn->real_escape_string($input['checkout_request_id']);
        $resultCode = isset($input['result_code']) ? $conn->real_escape_string($input['result_code']) : null;
        $resultDescription = isset($input['result_description']) ? $conn->real_escape_string($input['result_description']) : null;
        $merchantRequestId = isset($input['merchant_request_id']) ? $conn->real_escape_string($input['merchant_request_id']) : null;

        $status = 'failed';
        if ($resultCode === '0' || $resultCode === 0) {
            $status = 'success';
        } elseif ($resultCode === '1032' || $resultCode === 1032) {
            $status = 'timeout';
        }

        $stmt = $conn->prepare("
            UPDATE stk_push_sessions
            SET status = ?, result_code = ?, result_description = ?, updated_at = NOW()
            WHERE checkout_request_id = ?
        ");

        $stmt->bind_param("ssss", $status, $resultCode, $resultDescription, $checkoutRequestId);

        if ($stmt->execute()) {
            $stmt->close();

            logEvent('stk_push_completed', [
                'checkout_request_id' => $checkoutRequestId,
                'status' => $status,
                'result_code' => $resultCode
            ]);

            respond("success", "STK push status updated.", [
                "status" => $status,
                "checkout_request_id" => $checkoutRequestId
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to update STK push: " . $conn->error, null, 500);
        }
        break;

    // GET STK PUSH HISTORY
    case 'stk_push_history':
        $limit = isset($input['limit']) ? intval($input['limit']) : 50;
        $offset = isset($input['offset']) ? intval($input['offset']) : 0;

        if ($limit > 100) $limit = 100;
        if ($offset < 0) $offset = 0;

        $sql = "SELECT * FROM stk_push_sessions ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $stmt = $conn->prepare($sql);

        if (!$stmt) {
            respond("error", "Table does not exist yet.", null, 500);
        }

        $stmt->bind_param("ii", $limit, $offset);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        $sessions = [];
        while ($row = $result->fetch_assoc()) {
            $sessions[] = $row;
        }

        respond("success", "STK push history retrieved.", ["data" => $sessions]);
        break;

    // ============================================================================
    // WALLET MANAGEMENT ENDPOINTS
    // ============================================================================

    // GET WALLET BALANCE
    case 'wallet_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);

        $conn->query("
            CREATE TABLE IF NOT EXISTS `user_wallets` (
                `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                `user_id` VARCHAR(36) NOT NULL UNIQUE,
                `balance` DECIMAL(15, 2) DEFAULT 0,
                `available_balance` DECIMAL(15, 2) DEFAULT 0,
                `pending_balance` DECIMAL(15, 2) DEFAULT 0,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT `fk_wallet_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                INDEX `idx_user_id` (`user_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $sql = "SELECT * FROM user_wallets WHERE user_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        if ($result->num_rows === 0) {
            $walletId = uniqid();
            $now = date('Y-m-d H:i:s');
            $stmt = $conn->prepare("
                INSERT INTO user_wallets (id, user_id, balance, available_balance, pending_balance, created_at, updated_at)
                VALUES (?, ?, 0, 0, 0, ?, ?)
            ");
            $stmt->bind_param("ssss", $walletId, $userId, $now, $now);
            $stmt->execute();
            $stmt->close();

            $wallet = [
                'id' => $walletId,
                'user_id' => $userId,
                'balance' => 0,
                'available_balance' => 0,
                'pending_balance' => 0,
                'created_at' => $now,
                'updated_at' => $now
            ];
        } else {
            $wallet = $result->fetch_assoc();
        }

        respond("success", "Wallet fetched successfully.", ["data" => $wallet]);
        break;

    // UPDATE WALLET BALANCE
    case 'wallet_update':
        if (!isset($input['user_id']) || !isset($input['amount']) || !isset($input['transaction_type'])) {
            respond("error", "Missing user_id, amount, or transaction_type.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $amount = floatval($input['amount']);
        $transactionType = $conn->real_escape_string($input['transaction_type']);
        $reference = isset($input['reference']) ? $conn->real_escape_string($input['reference']) : null;
        $description = isset($input['description']) ? $conn->real_escape_string($input['description']) : null;

        $walletQuery = $conn->query("SELECT * FROM user_wallets WHERE user_id = '$userId'");
        if ($walletQuery->num_rows === 0) {
            respond("error", "Wallet not found. Create wallet first.", null, 404);
        }

        $wallet = $walletQuery->fetch_assoc();
        $currentBalance = floatval($wallet['balance']);
        $newBalance = $currentBalance + $amount;

        if ($newBalance < 0 && $transactionType === 'withdrawal') {
            respond("error", "Insufficient balance.", null, 400);
        }

        $stmt = $conn->prepare("
            UPDATE user_wallets
            SET balance = ?, available_balance = ?, updated_at = NOW()
            WHERE user_id = ?
        ");

        $stmt->bind_param("dss", $newBalance, $newBalance, $userId);

        if ($stmt->execute()) {
            $stmt->close();

            $transactionId = 'txn_' . uniqid();
            $now = date('Y-m-d H:i:s');

            $txnStmt = $conn->prepare("
                INSERT INTO wallet_transactions (id, user_id, type, amount, reference, description, balance_after, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $txnStmt->bind_param("sssdssss", $transactionId, $userId, $transactionType, $amount, $reference, $description, $newBalance, $now);
            $txnStmt->execute();
            $txnStmt->close();

            logEvent('wallet_updated', [
                'user_id' => $userId,
                'transaction_type' => $transactionType,
                'amount' => $amount,
                'new_balance' => $newBalance
            ]);

            respond("success", "Wallet updated successfully.", [
                "user_id" => $userId,
                "old_balance" => $currentBalance,
                "amount" => $amount,
                "new_balance" => $newBalance,
                "transaction_id" => $transactionId
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to update wallet: " . $conn->error, null, 500);
        }
        break;

    // GET WALLET TRANSACTIONS
    case 'wallet_transactions_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $limit = isset($input['limit']) ? intval($input['limit']) : 50;
        $offset = isset($input['offset']) ? intval($input['offset']) : 0;

        if ($limit > 100) $limit = 100;

        $conn->query("
            CREATE TABLE IF NOT EXISTS `wallet_transactions` (
                `id` VARCHAR(36) PRIMARY KEY,
                `user_id` VARCHAR(36) NOT NULL,
                `type` VARCHAR(50) NOT NULL,
                `amount` DECIMAL(15, 2) NOT NULL,
                `reference` VARCHAR(255),
                `description` TEXT,
                `balance_after` DECIMAL(15, 2),
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT `fk_wallet_txn_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_created_at` (`created_at` DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $sql = "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("sii", $userId, $limit, $offset);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        $transactions = [];
        while ($row = $result->fetch_assoc()) {
            $transactions[] = $row;
        }

        respond("success", "Wallet transactions retrieved.", ["data" => $transactions]);
        break;

    // ============================================================================
    // PROMOTION REQUESTS MANAGEMENT ENDPOINTS
    // ============================================================================

    // GET PROMOTION REQUESTS (for admin)
    case 'promotion_requests_get':
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'pending';
        $sql = "SELECT pr.*, up.full_name, up.phone_number FROM promotion_requests pr
                LEFT JOIN user_profiles up ON pr.trainer_id = up.user_id
                WHERE pr.status = '$status'
                ORDER BY pr.requested_at DESC";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $requests = [];
        while ($row = $result->fetch_assoc()) {
            $requests[] = $row;
        }

        respond("success", "Promotion requests fetched successfully.", ["data" => $requests]);
        break;

    // APPROVE PROMOTION REQUEST
    case 'promotion_request_approve':
        if (!isset($input['promotion_request_id'])) {
            respond("error", "Missing promotion_request_id.", null, 400);
        }

        $promotionRequestId = $conn->real_escape_string($input['promotion_request_id']);
        $adminId = isset($input['admin_id']) ? $conn->real_escape_string($input['admin_id']) : null;

        $sql = "SELECT * FROM promotion_requests WHERE id = '$promotionRequestId' LIMIT 1";
        $result = $conn->query($sql);

        if (!$result || $result->num_rows === 0) {
            respond("error", "Promotion request not found.", null, 404);
        }

        $request = $result->fetch_assoc();
        $trainerId = $request['trainer_id'];
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            UPDATE promotion_requests
            SET status = ?, approved_by = ?, approved_at = ?, updated_at = NOW()
            WHERE id = ?
        ");

        $approvedStatus = 'approved';
        $stmt->bind_param("ssss", $approvedStatus, $adminId, $now, $promotionRequestId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('promotion_request_approved', [
                'promotion_request_id' => $promotionRequestId,
                'trainer_id' => $trainerId,
                'admin_id' => $adminId
            ]);

            respond("success", "Promotion request approved successfully.", [
                "promotion_request_id" => $promotionRequestId,
                "trainer_id" => $trainerId,
                "approved_at" => $now
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to approve promotion request: " . $conn->error, null, 500);
        }
        break;

    // REJECT PROMOTION REQUEST
    case 'promotion_request_reject':
        if (!isset($input['promotion_request_id'])) {
            respond("error", "Missing promotion_request_id.", null, 400);
        }

        $promotionRequestId = $conn->real_escape_string($input['promotion_request_id']);
        $adminId = isset($input['admin_id']) ? $conn->real_escape_string($input['admin_id']) : null;

        $sql = "SELECT * FROM promotion_requests WHERE id = '$promotionRequestId' LIMIT 1";
        $result = $conn->query($sql);

        if (!$result || $result->num_rows === 0) {
            respond("error", "Promotion request not found.", null, 404);
        }

        $request = $result->fetch_assoc();
        $trainerId = $request['trainer_id'];
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            UPDATE promotion_requests
            SET status = ?, approved_by = ?, updated_at = NOW()
            WHERE id = ?
        ");

        $rejectedStatus = 'rejected';
        $stmt->bind_param("sss", $rejectedStatus, $adminId, $promotionRequestId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('promotion_request_rejected', [
                'promotion_request_id' => $promotionRequestId,
                'trainer_id' => $trainerId,
                'admin_id' => $adminId
            ]);

            respond("success", "Promotion request rejected successfully.", [
                "promotion_request_id" => $promotionRequestId,
                "trainer_id" => $trainerId
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to reject promotion request: " . $conn->error, null, 500);
        }
        break;

    // ANNOUNCEMENTS SYSTEM
    // ============================================================================

    // CREATE ANNOUNCEMENT
    case 'announcement_create':
        if (!isset($input['title']) || !isset($input['message'])) {
            respond("error", "Missing required fields: title, message.", null, 400);
        }

        $title = $conn->real_escape_string($input['title']);
        $message = $conn->real_escape_string($input['message']);
        $target = isset($input['target']) ? $conn->real_escape_string($input['target']) : 'all';
        $createdBy = isset($input['created_by']) ? $conn->real_escape_string($input['created_by']) : null;
        $isActive = isset($input['is_active']) ? (intval($input['is_active']) ? 1 : 0) : 1;
        $startsAt = isset($input['starts_at']) ? $conn->real_escape_string($input['starts_at']) : null;
        $endsAt = isset($input['ends_at']) ? $conn->real_escape_string($input['ends_at']) : null;

        if (!in_array($target, ['all', 'clients', 'trainers', 'admins'])) {
            respond("error", "Invalid target. Must be: all, clients, trainers, or admins.", null, 400);
        }

        $announcementId = 'ann_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO announcements (id, title, message, target_audience, created_by, is_active, starts_at, ends_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        if (!$stmt) {
            respond("error", "Failed to prepare statement: " . $conn->error, null, 500);
        }

        $stmt->bind_param("sssssisss", $announcementId, $title, $message, $target, $createdBy, $isActive, $startsAt, $endsAt, $now, $now);

        if (!$stmt->execute()) {
            $stmt->close();
            respond("error", "Failed to create announcement: " . $conn->error, null, 500);
        }
        $stmt->close();

        logEvent('announcement_created', [
            'announcement_id' => $announcementId,
            'target' => $target,
            'created_by' => $createdBy,
            'title' => $title
        ]);

        respond("success", "Announcement created successfully.", [
            "announcement_id" => $announcementId,
            "title" => $title,
            "target" => $target
        ]);
        break;

    // GET ANNOUNCEMENTS FOR USER
    case 'announcements_get':
        if (!isset($input['user_type'])) {
            respond("error", "Missing required field: user_type.", null, 400);
        }

        $userType = $conn->real_escape_string($input['user_type']);
        $limit = isset($input['limit']) ? intval($input['limit']) : 50;
        $offset = isset($input['offset']) ? intval($input['offset']) : 0;
        $now = date('Y-m-d H:i:s');

        $sql = "
            SELECT a.* FROM announcements a
            WHERE a.is_active = 1
            AND (a.target_audience = 'all' OR a.target_audience = ?)
            AND (a.starts_at IS NULL OR a.starts_at <= ?)
            AND (a.ends_at IS NULL OR a.ends_at >= ?)
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        ";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            respond("error", "Failed to prepare statement: " . $conn->error, null, 500);
        }

        $stmt->bind_param("sssii", $userType, $now, $now, $limit, $offset);
        if (!$stmt->execute()) {
            $stmt->close();
            respond("error", "Failed to fetch announcements: " . $conn->error, null, 500);
        }

        $result = $stmt->get_result();
        $announcements = [];
        while ($row = $result->fetch_assoc()) {
            $announcements[] = $row;
        }
        $stmt->close();

        respond("success", "Announcements retrieved successfully.", [
            "announcements" => $announcements,
            "count" => count($announcements)
        ]);
        break;

    // MARK ANNOUNCEMENT AS READ
    case 'announcement_mark_read':
        if (!isset($input['announcement_id'])) {
            respond("error", "Missing required field: announcement_id.", null, 400);
        }

        $announcementId = $conn->real_escape_string($input['announcement_id']);
        $userId = isset($input['user_id']) ? $conn->real_escape_string($input['user_id']) : null;

        logEvent('announcement_read', [
            'announcement_id' => $announcementId,
            'user_id' => $userId
        ]);

        respond("success", "Announcement marked as read.", [
            "announcement_id" => $announcementId
        ]);
        break;

    // WAITING LIST: SUBMIT FORM
    case 'waitlist_submit':
        if (!isset($input['name']) || !isset($input['email']) || !isset($input['telephone'])) {
            respond("error", "Missing required fields: name, email, telephone.", null, 400);
        }

        $name = $conn->real_escape_string(trim($input['name']));
        $email = $conn->real_escape_string(trim($input['email']));
        $telephone = $conn->real_escape_string(trim($input['telephone']));
        $isCoach = isset($input['is_coach']) ? intval($input['is_coach']) : 0;
        $categoryId = isset($input['category_id']) ? intval($input['category_id']) : null;

        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond("error", "Invalid email address.", null, 400);
        }

        // Check if email already exists in waitlist
        $checkSql = "SELECT id FROM waiting_list WHERE email = '$email' LIMIT 1";
        $checkResult = $conn->query($checkSql);
        if ($checkResult && $checkResult->num_rows > 0) {
            respond("error", "This email is already on the waiting list.", null, 409);
        }

        $waitlistId = 'waitlist_' . uniqid();
        $now = date('Y-m-d H:i:s');

        if ($categoryId !== null) {
            $stmt = $conn->prepare("
                INSERT INTO waiting_list (id, name, email, telephone, is_coach, category_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");

            if (!$stmt) {
                respond("error", "Failed to prepare statement: " . $conn->error, null, 500);
            }

            $stmt->bind_param("sssissss", $waitlistId, $name, $email, $telephone, $isCoach, $categoryId, $now, $now);
        } else {
            $stmt = $conn->prepare("
                INSERT INTO waiting_list (id, name, email, telephone, is_coach, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");

            if (!$stmt) {
                respond("error", "Failed to prepare statement: " . $conn->error, null, 500);
            }

            $stmt->bind_param("sssisss", $waitlistId, $name, $email, $telephone, $isCoach, $now, $now);
        }

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('waitlist_submitted', [
                'waitlist_id' => $waitlistId,
                'email' => $email,
                'is_coach' => $isCoach,
                'category_id' => $categoryId
            ]);

            respond("success", "Successfully added to waiting list!", [
                "waitlist_id" => $waitlistId,
                "email" => $email,
                "category_id" => $categoryId,
                "message" => "Welcome! We'll notify you when Trainer launches in April 2026."
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to add to waiting list: " . $conn->error, null, 500);
        }
        break;

    // WAITING LIST: GET ALL ENTRIES
    case 'waitlist_get':
        $limit = isset($input['limit']) ? intval($input['limit']) : 50;
        $offset = isset($input['offset']) ? intval($input['offset']) : 0;
        $sortBy = isset($input['sort_by']) ? $conn->real_escape_string($input['sort_by']) : 'created_at';
        $sortOrder = isset($input['sort_order']) && strtoupper($input['sort_order']) === 'ASC' ? 'ASC' : 'DESC';

        // Select all columns including category_id to ensure it's in the response
        $sql = "SELECT id, name, email, telephone, is_coach, category_id, status, created_at, updated_at FROM waiting_list ORDER BY $sortBy $sortOrder LIMIT $limit OFFSET $offset";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $entries = [];
        while ($row = $result->fetch_assoc()) {
            // Ensure category_id is properly typed (null if not set)
            if ($row['category_id']) {
                $row['category_id'] = intval($row['category_id']);
            } else {
                $row['category_id'] = null;
            }
            $entries[] = $row;
        }

        // Get total count
        $countSql = "SELECT COUNT(*) as total FROM waiting_list";
        $countResult = $conn->query($countSql);
        $countRow = $countResult->fetch_assoc();
        $totalCount = intval($countRow['total']);

        respond("success", "Waiting list entries fetched successfully.", [
            "data" => $entries,
            "total" => $totalCount,
            "count" => count($entries),
            "page" => intval($offset / $limit) + 1,
            "limit" => $limit
        ]);
        logEvent('waitlist_get_success', ['count' => count($entries), 'total' => $totalCount]);
        break;

    // WAITING LIST: DELETE ENTRY
    case 'waitlist_delete':
        if (!isset($input['waitlist_id'])) {
            respond("error", "Missing waitlist_id.", null, 400);
        }

        $waitlistId = $conn->real_escape_string($input['waitlist_id']);
        $sql = "DELETE FROM waiting_list WHERE id = '$waitlistId'";

        if ($conn->query($sql)) {
            logEvent('waitlist_deleted', ['waitlist_id' => $waitlistId]);
            respond("success", "Entry deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            respond("error", "Failed to delete entry: " . $conn->error, null, 500);
        }
        break;

    // WAITING LIST: MIGRATION/CREATE TABLE
    case 'waitlist_migration':
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
            logEvent('waitlist_migration_success');
            respond("success", "Waiting list table created successfully.", [
                "table" => "waiting_list",
                "message" => "Database is ready for waiting list submissions"
            ]);
        } else {
            logEvent('waitlist_migration_failed', ['error' => $conn->error]);
            respond("error", "Failed to create waiting list table: " . $conn->error, null, 500);
        }
        break;

    // SEED CATEGORIES
    case 'seed_categories':
        $testCategories = [
            [
                'name' => 'Strength Training',
                'icon' => '💪',
                'description' => 'Build muscle and increase strength'
            ],
            [
                'name' => 'Cardio',
                'icon' => '🏃',
                'description' => 'Improve cardiovascular fitness'
            ],
            [
                'name' => 'Yoga',
                'icon' => '🧘',
                'description' => 'Flexibility and mindfulness'
            ],
            [
                'name' => 'HIIT',
                'icon' => '⚡',
                'description' => 'High-intensity interval training'
            ],
            [
                'name' => 'Pilates',
                'icon' => '🤸',
                'description' => 'Core strength and flexibility'
            ],
            [
                'name' => 'Dance Fitness',
                'icon' => '💃',
                'description' => 'Fun and energetic fitness through dance'
            ],
            [
                'name' => 'Swimming',
                'icon' => '🏊',
                'description' => 'Full-body low-impact exercise'
            ],
            [
                'name' => 'Boxing',
                'icon' => '🥊',
                'description' => 'Combat training and fitness'
            ]
        ];

        $inserted = 0;
        $skipped = 0;

        foreach ($testCategories as $category) {
            $name = $conn->real_escape_string($category['name']);
            $icon = $conn->real_escape_string($category['icon']);
            $description = $conn->real_escape_string($category['description']);
            $now = date('Y-m-d H:i:s');

            // Check if category already exists
            $checkSql = "SELECT id FROM categories WHERE name = '$name' LIMIT 1";
            $checkResult = $conn->query($checkSql);

            if ($checkResult && $checkResult->num_rows > 0) {
                $skipped++;
                continue;
            }

            $stmt = $conn->prepare("INSERT INTO categories (name, icon, description, created_at) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("ssss", $name, $icon, $description, $now);

            if ($stmt->execute()) {
                $inserted++;
            }
            $stmt->close();
        }

        respond("success", "Categories seeded successfully.", [
            "inserted" => $inserted,
            "skipped" => $skipped,
            "total" => count($testCategories)
        ]);
        break;

    // WAITING LIST: ALTER TABLE TO ADD CATEGORY
    case 'waitlist_alter_table':
        $errors = [];

        // 1️⃣ Add column if it does not exist
        $checkColumn = "
            SELECT COUNT(*) AS cnt
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'waiting_list'
              AND COLUMN_NAME = 'category_id'
        ";
        $result = $conn->query($checkColumn)->fetch_assoc();

        if ($result['cnt'] == 0) {
            if (!$conn->query("ALTER TABLE waiting_list ADD COLUMN category_id INT NULL")) {
                $errors[] = $conn->error;
            }
        }

        // 2️⃣ Add index if it does not exist
        $checkIndex = "
            SELECT COUNT(*) AS cnt
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'waiting_list'
              AND INDEX_NAME = 'idx_category_id'
        ";
        $result = $conn->query($checkIndex)->fetch_assoc();

        if ($result['cnt'] == 0) {
            if (!$conn->query("CREATE INDEX idx_category_id ON waiting_list (category_id)")) {
                $errors[] = $conn->error;
            }
        }

        // 3️⃣ Add foreign key if it does not exist
        $checkFK = "
            SELECT COUNT(*) AS cnt
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'waiting_list'
              AND CONSTRAINT_NAME = 'fk_waiting_list_category_id'
        ";
        $result = $conn->query($checkFK)->fetch_assoc();

        if ($result['cnt'] == 0) {
            $fkSql = "
                ALTER TABLE waiting_list
                ADD CONSTRAINT fk_waiting_list_category_id
                FOREIGN KEY (category_id)
                REFERENCES categories(id)
                ON DELETE SET NULL
            ";
            if (!$conn->query($fkSql)) {
                $errors[] = $conn->error;
            }
        }

        // ✅ Final response
        if (empty($errors)) {
            logEvent('waitlist_alter_table_success');
            respond("success", "Waiting list table altered successfully.", [
                "table" => "waiting_list",
                "message" => "Category column, index, and foreign key ensured"
            ]);
        } else {
            logEvent('waitlist_alter_table_failed', ['errors' => $errors]);
            respond("error", "Failed to alter waiting list table.", $errors, 500);
        }
        break;

    // ============================================================================
    // M-PESA STK PUSH PAYMENT ENDPOINTS
    // ============================================================================


    // UNKNOWN ACTION
    default:
        respond("error", "Invalid action '$action'.", null, 400);
}
?>
