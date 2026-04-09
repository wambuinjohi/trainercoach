<?php
header("Content-Type: application/json; charset=utf-8");

$results = [
    "php_version" => phpversion(),
    "mysqli_enabled" => extension_loaded('mysqli') ? "Yes" : "No",
    "files_present" => [
        "api.php" => file_exists(__DIR__ . '/api.php'),
        "connection.php" => file_exists(__DIR__ . '/connection.php'),
    ],
    "connection_test" => null,
    "error" => null
];

// Test database connection using localhost without explicit port (uses default 3306)
try {
    $conn = new mysqli('localhost', 'skatrykc_trainer', 'Sirgeorge.12', 'skatrykc_trainer');

    if ($conn->connect_error) {
        $results["connection_test"] = "Failed: " . $conn->connect_error;
        $results["error"] = $conn->connect_error;
    } else {
        $results["connection_test"] = "Success";

        // Try a simple query
        $result = $conn->query("SELECT 1 as test");
        if ($result) {
            $results["query_test"] = "Success";
            $result->free();
        } else {
            $results["query_test"] = "Failed: " . $conn->error;
        }

        $conn->close();
    }
} catch (Exception $e) {
    $results["connection_test"] = "Exception: " . $e->getMessage();
    $results["error"] = $e->getMessage();
}

echo json_encode($results, JSON_PRETTY_PRINT);
?>
