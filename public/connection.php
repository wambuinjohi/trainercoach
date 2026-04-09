<?php
// Set JSON content type BEFORE any code execution
if (!headers_sent()) {
    header("Content-Type: application/json; charset=utf-8");
}

// Set error handler to prevent HTML output
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if (!headers_sent()) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Server error. Please check the logs."
        ]);
    }
    error_log("PHP Error [$errno]: $errstr in $errfile on line $errline");
    exit;
}, E_ALL);

// Set fatal error handler for PHP7+
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            http_response_code(500);
            header("Content-Type: application/json; charset=utf-8");
            echo json_encode([
                "status" => "error",
                "message" => "Server error. Please check the logs."
            ]);
        }
    }
});

// Database connection settings from environment variables
$server = getenv('DB_HOST') ?: 'localhost';
$username = getenv('DB_USER') ?: 'skatrykc_trainer';
$password = getenv('DB_PASS') ?: 'Sirgeorge.12';
$database = getenv('DB_NAME') ?: 'skatrykc_trainer';
$port = (int)(getenv('DB_PORT') ?: 3306);

// Load from .env if it exists
if (file_exists(__DIR__ . '/.env')) {
    $env = parse_ini_file(__DIR__ . '/.env');
    if ($env) {
        $server = $env['DB_HOST'] ?? $server;
        $username = $env['DB_USER'] ?? $username;
        $password = $env['DB_PASS'] ?? $password;
        $database = $env['DB_NAME'] ?? $database;
        $port = isset($env['DB_PORT']) ? (int)$env['DB_PORT'] : $port;
    }
}

// Create connection
$conn = new mysqli($server, $username, $password, $database, $port);

// Check connection
if ($conn->connect_error) {
    http_response_code(500);
    error_log("Database connection error: " . $conn->connect_error);
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed. Please try again later."
    ]);
    exit;
}

// Set charset to utf8mb4
$conn->set_charset("utf8mb4");

// Do NOT echo anything here - api.php will handle the response
?>
