<?php
// Set JSON header FIRST before any output
header("Content-Type: application/json; charset=utf-8");

// Ensure no output buffering interferes
if (ob_get_level()) {
    ob_clean();
}

// Database configuration with fallback values
// Note: For shared servers using localhost, port specification is not needed
// MySQL defaults to port 3306 when port is 0 or not specified
$server = 'localhost';
$username = 'skatrykc_trainer';
$password = 'Sirgeorge.12';
$database = 'skatrykc_trainer';
$port = 0;  // Use default port (3306) - recommended for shared servers

// Try to load from .env file if it exists
if (file_exists(__DIR__ . '/.env')) {
    $env = parse_ini_file(__DIR__ . '/.env');
    if ($env !== false) {
        $server = $env['DB_HOST'] ?? $server;
        $username = $env['DB_USER'] ?? $username;
        $password = $env['DB_PASS'] ?? $password;
        $database = $env['DB_NAME'] ?? $database;
        $port = isset($env['DB_PORT']) ? (int)$env['DB_PORT'] : $port;
    }
}

// Try to load from environment variables
if (getenv('DB_HOST')) $server = getenv('DB_HOST');
if (getenv('DB_USER')) $username = getenv('DB_USER');
if (getenv('DB_PASS')) $password = getenv('DB_PASS');
if (getenv('DB_NAME')) $database = getenv('DB_NAME');
if (getenv('DB_PORT')) $port = (int)getenv('DB_PORT');

// Suppress mysqli errors and handle them ourselves
@mysqli_report(MYSQLI_REPORT_OFF);

try {
    // Create connection with explicit error handling
    $conn = @new mysqli($server, $username, $password, $database, $port);

    // Check connection
    if (!$conn || $conn->connect_error) {
        error_log("Database connection failed: " . ($conn ? $conn->connect_error : "Connection object creation failed"));
        http_response_code(500);
        die(json_encode([
            "status" => "error",
            "message" => "Database connection failed. Please try again later."
        ]));
    }
    
    // Set charset
    if (!$conn->set_charset("utf8mb4")) {
        error_log("Charset setting failed: " . $conn->error);
        http_response_code(500);
        die(json_encode([
            "status" => "error",
            "message" => "Database configuration error."
        ]));
    }
    
} catch (mysqli_sql_exception $e) {
    error_log("MySQL Exception: " . $e->getMessage());
    http_response_code(500);
    die(json_encode([
        "status" => "error",
        "message" => "Database error: " . $e->getMessage()
    ]));
} catch (Exception $e) {
    error_log("Connection Exception: " . $e->getMessage());
    http_response_code(500);
    die(json_encode([
        "status" => "error",
        "message" => "Connection error: " . $e->getMessage()
    ]));
}

// Connection successful - do NOT output anything here
// The api.php file will handle all responses
?>
