<?php
/**
 * API Endpoint: Fix Missing Booking IDs
 * 
 * This endpoint can be called from the admin panel to fix bookings with missing IDs.
 * Endpoint: POST /api.php with action=fix_missing_booking_ids
 * Auth: Requires admin user
 * 
 * To integrate into api.php, add this case statement to the main switch:
 * 
 * case 'fix_missing_booking_ids':
 *     if ($user_type !== 'admin') {
 *         respond("error", "Unauthorized: Admin access required", null, 403);
 *     }
 *     fixMissingBookingIds($conn);
 *     break;
 */

function fixMissingBookingIds($conn) {
    // Check how many bookings have missing IDs
    $checkSql = "SELECT COUNT(*) as count FROM bookings WHERE id IS NULL OR id = ''";
    $result = $conn->query($checkSql);
    
    if (!$result) {
        respond("error", "Failed to check bookings: " . $conn->error, null, 500);
        return;
    }
    
    $row = $result->fetch_assoc();
    $missingCount = $row['count'] ?? 0;
    
    if ($missingCount === 0) {
        respond("success", "No bookings with missing IDs found", [
            "affected_rows" => 0,
            "missing_count" => 0
        ]);
        return;
    }
    
    // Start transaction
    $conn->begin_transaction();
    
    try {
        // Generate UUIDs for missing IDs
        $updateSql = "UPDATE bookings 
                     SET id = CONCAT('booking_', REPLACE(UUID(), '-', '')) 
                     WHERE id IS NULL OR id = ''";
        
        if (!$conn->query($updateSql)) {
            throw new Exception("Update failed: " . $conn->error);
        }
        
        $affectedRows = $conn->affected_rows;
        
        // Verify the fix
        $verifySql = "SELECT COUNT(*) as count FROM bookings WHERE id IS NULL OR id = ''";
        $verifyResult = $conn->query($verifySql);
        
        if (!$verifyResult) {
            throw new Exception("Verification failed: " . $conn->error);
        }
        
        $verifyRow = $verifyResult->fetch_assoc();
        $stillMissing = $verifyRow['count'] ?? 0;
        
        if ($stillMissing > 0) {
            throw new Exception("Verification failed: $stillMissing bookings still have missing IDs");
        }
        
        $conn->commit();
        
        respond("success", "Fixed $affectedRows bookings with missing IDs", [
            "affected_rows" => $affectedRows,
            "missing_count" => $missingCount,
            "still_missing" => $stillMissing
        ]);
        
    } catch (Exception $e) {
        $conn->rollback();
        respond("error", "Migration failed: " . $e->getMessage(), null, 500);
    }
}

// Helper function (same as in api.php)
function respond($status, $message, $data = null, $httpCode = 200) {
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}
?>
