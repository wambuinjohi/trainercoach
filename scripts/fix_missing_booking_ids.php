<?php
/**
 * Migration Script: Fix Missing Booking IDs
 * 
 * This script updates bookings that have NULL or empty IDs with unique identifiers.
 * Usage: php scripts/fix_missing_booking_ids.php
 */

require_once __DIR__ . '/../connection.php';

if (!$conn) {
    die("Database connection failed\n");
}

echo "[INFO] Starting booking ID migration...\n";

// Check how many bookings have missing IDs
$checkSql = "SELECT COUNT(*) as count FROM bookings WHERE id IS NULL OR id = ''";
$result = $conn->query($checkSql);
$row = $result->fetch_assoc();
$missingCount = $row['count'] ?? 0;

if ($missingCount === 0) {
    echo "[SUCCESS] No bookings with missing IDs found. Migration complete.\n";
    $conn->close();
    exit(0);
}

echo "[INFO] Found $missingCount bookings with missing IDs.\n";
echo "[INFO] Generating unique IDs...\n";

// Fetch all bookings with missing IDs
$fetchSql = "SELECT * FROM bookings WHERE id IS NULL OR id = '' ORDER BY created_at ASC";
$result = $conn->query($fetchSql);

if (!$result) {
    echo "[ERROR] Query failed: " . $conn->error . "\n";
    $conn->close();
    exit(1);
}

$updated = 0;
$failed = 0;

while ($booking = $result->fetch_assoc()) {
    // Generate a unique ID using timestamp + random string
    $uniqueId = 'booking_' . time() . '_' . bin2hex(random_bytes(4));
    
    // Update the booking record
    $updateSql = "UPDATE bookings SET id = ? WHERE created_at = ? AND client_id = ?";
    $stmt = $conn->prepare($updateSql);
    
    if (!$stmt) {
        echo "[ERROR] Prepare failed for booking: " . $booking['created_at'] . " - " . $conn->error . "\n";
        $failed++;
        continue;
    }
    
    $stmt->bind_param(
        'sss',
        $uniqueId,
        $booking['created_at'],
        $booking['client_id']
    );
    
    if ($stmt->execute()) {
        $updated++;
        echo "[OK] Booking from {$booking['client_id']} on {$booking['created_at']} => ID: $uniqueId\n";
    } else {
        echo "[ERROR] Update failed: " . $stmt->error . "\n";
        $failed++;
    }
    
    $stmt->close();
}

echo "\n[SUMMARY]\n";
echo "  Updated: $updated\n";
echo "  Failed: $failed\n";
echo "  Total: " . ($updated + $failed) . "\n";

if ($failed === 0) {
    echo "\n[SUCCESS] All bookings have been updated with IDs!\n";
    $conn->close();
    exit(0);
} else {
    echo "\n[WARNING] Some bookings failed to update. Please review the errors above.\n";
    $conn->close();
    exit(1);
}
?>
