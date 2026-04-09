-- ============================================================================
-- MySQLi SQL Commands for Location Label Fix
-- ============================================================================
-- This file contains all SQL commands needed to fix the location_label
-- loading issue, organized for use in PHP with MySQLi
-- ============================================================================

-- ============================================================================
-- PART 1: ALTER TABLE - Add Missing Columns
-- ============================================================================
-- Run these to add the location columns to user_profiles table

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS location_label VARCHAR(255) NULL DEFAULT NULL;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(9, 6) NULL DEFAULT NULL;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(9, 6) NULL DEFAULT NULL;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS service_radius INT NULL DEFAULT NULL;

-- ============================================================================
-- PART 2: Add Constraints - Data Validation
-- ============================================================================
-- These ensure only valid coordinates are stored

ALTER TABLE user_profiles
ADD CONSTRAINT IF NOT EXISTS chk_location_lat_range 
  CHECK (location_lat IS NULL OR (location_lat >= -90 AND location_lat <= 90));

ALTER TABLE user_profiles
ADD CONSTRAINT IF NOT EXISTS chk_location_lng_range 
  CHECK (location_lng IS NULL OR (location_lng >= -180 AND location_lng <= 180));

-- ============================================================================
-- PART 3: Create Indexes - Performance Optimization
-- ============================================================================
-- These indexes speed up queries for location-based searches

CREATE INDEX IF NOT EXISTS idx_user_profiles_location_label 
  ON user_profiles(location_label);

CREATE INDEX IF NOT EXISTS idx_user_profiles_location_coords 
  ON user_profiles(location_lat, location_lng);

CREATE INDEX IF NOT EXISTS idx_user_profiles_service_radius 
  ON user_profiles(service_radius);

-- ============================================================================
-- PART 4: Verification Queries - Check if Schema is Correct
-- ============================================================================

-- 4A: Check if all required columns exist
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_profiles'
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN ('location_label', 'location_lat', 'location_lng', 'service_radius')
ORDER BY COLUMN_NAME;

-- Expected result: 4 rows
-- location_label | VARCHAR(255) | YES
-- location_lat   | DECIMAL(9,6) | YES
-- location_lng   | DECIMAL(9,6) | YES
-- service_radius | INT          | YES

-- ============================================================================
-- 4B: Check all columns in user_profiles (full schema)
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_profiles'
  AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;

-- ============================================================================
-- PART 5: Test Queries - Verify Data Operations
-- ============================================================================

-- 5A: Get trainer profile with location (simulates API profile_get)
SELECT 
    user_id,
    location_label,
    location_lat,
    location_lng,
    service_radius
FROM user_profiles
WHERE user_id = 'TRAINER_USER_ID'
LIMIT 1;

-- 5B: Update trainer location (simulates API profile_update with prepared statement)
-- MySQLi Prepared Statement Format:
-- 
-- $sql = "UPDATE user_profiles 
--         SET location_label = ?, location_lat = ?, location_lng = ?, service_radius = ?
--         WHERE user_id = ?";
-- $stmt = $conn->prepare($sql);
-- $stmt->bind_param("sddis", $label, $lat, $lng, $radius, $userId);
-- $stmt->execute();

-- Example with actual values:
UPDATE user_profiles 
SET location_label = 'Nairobi, Kilimani',
    location_lat = -1.2921,
    location_lng = 36.8219,
    service_radius = 10
WHERE user_id = 'trainer_user_id';

-- 5C: Set location_label to NULL (clearing the field)
UPDATE user_profiles 
SET location_label = NULL
WHERE user_id = 'trainer_user_id';

-- 5D: Set multiple location fields to NULL
UPDATE user_profiles 
SET location_label = NULL,
    location_lat = NULL,
    location_lng = NULL,
    service_radius = NULL
WHERE user_id = 'trainer_user_id';

-- ============================================================================
-- PART 6: Data Queries - Check Existing Data
-- ============================================================================

-- 6A: Count trainers with location data
SELECT 
    COUNT(*) as total_trainers,
    SUM(CASE WHEN location_label IS NOT NULL THEN 1 ELSE 0 END) as with_label,
    SUM(CASE WHEN location_lat IS NOT NULL THEN 1 ELSE 0 END) as with_coords,
    SUM(CASE WHEN service_radius IS NOT NULL THEN 1 ELSE 0 END) as with_radius
FROM user_profiles
WHERE user_id IN (SELECT id FROM users WHERE user_type = 'trainer');

-- 6B: Show sample trainers with location data
SELECT 
    u.id as user_id,
    u.name,
    up.location_label,
    up.location_lat,
    up.location_lng,
    up.service_radius
FROM user_profiles up
JOIN users u ON up.user_id = u.id
WHERE u.user_type = 'trainer'
LIMIT 10;

-- 6C: Find trainers without location set
SELECT 
    u.id,
    u.name
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.user_type = 'trainer'
  AND (up.location_label IS NULL 
       AND up.location_lat IS NULL 
       AND up.location_lng IS NULL)
LIMIT 20;

-- ============================================================================
-- PART 7: Data Integrity Checks
-- ============================================================================

-- 7A: Find invalid coordinates
SELECT 
    user_id,
    location_lat,
    location_lng
FROM user_profiles
WHERE (location_lat IS NOT NULL AND (location_lat < -90 OR location_lat > 90))
   OR (location_lng IS NOT NULL AND (location_lng < -180 OR location_lng > 180));

-- Expected result: 0 rows (no invalid data)

-- 7B: Check for orphaned location data (trainer deleted but profile remains)
SELECT 
    up.user_id,
    up.location_label,
    up.location_lat,
    up.location_lng
FROM user_profiles up
LEFT JOIN users u ON up.user_id = u.id
WHERE u.id IS NULL
  AND (up.location_label IS NOT NULL 
       OR up.location_lat IS NOT NULL 
       OR up.location_lng IS NOT NULL);

-- Expected result: 0 rows (no orphaned data)

-- ============================================================================
-- PART 8: Index Verification
-- ============================================================================

-- Check if indexes were created successfully
SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_NAME = 'user_profiles'
  AND TABLE_SCHEMA = DATABASE()
  AND (INDEX_NAME LIKE '%location%' OR INDEX_NAME LIKE '%radius%')
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Expected result: 3 indexes
-- idx_user_profiles_location_coords (composite: location_lat, location_lng)
-- idx_user_profiles_location_label (single: location_label)
-- idx_user_profiles_service_radius (single: service_radius)

-- ============================================================================
-- PART 9: MySQLi PHP Examples
-- ============================================================================
-- These are example PHP code using MySQLi prepared statements

-- Example 1: Get trainer profile (profile_get API action)
/*
$userId = 'trainer_123';
$sql = "SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $userId);
$stmt->execute();
$result = $stmt->get_result();
$profile = $result->fetch_assoc();

// Now $profile contains all fields including:
// $profile['location_label']
// $profile['location_lat']
// $profile['location_lng']
// $profile['service_radius']

$stmt->close();
*/

-- Example 2: Update trainer profile (profile_update API action)
/*
$userId = 'trainer_123';
$label = 'Nairobi, Kilimani';
$lat = -1.2921;
$lng = 36.8219;
$radius = 10;

$sql = "UPDATE user_profiles 
        SET location_label = ?, location_lat = ?, location_lng = ?, service_radius = ?
        WHERE user_id = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("sddis", $label, $lat, $lng, $radius, $userId);

if ($stmt->execute()) {
    // Success!
    $affected = $stmt->affected_rows; // Should be 1
} else {
    // Error
    $error = $stmt->error;
}

$stmt->close();
*/

-- Example 3: Set field to NULL
/*
$userId = 'trainer_123';
$sql = "UPDATE user_profiles SET location_label = NULL WHERE user_id = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $userId);
$stmt->execute();
$stmt->close();
*/

-- ============================================================================
-- PART 10: Complete Backup & Restore
-- ============================================================================

-- 10A: Backup all location data before changes
-- Run this BEFORE applying fixes
SELECT 
    user_id,
    location_label,
    location_lat,
    location_lng,
    service_radius,
    NOW() as backup_timestamp
INTO OUTFILE '/tmp/location_backup.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
FROM user_profiles
WHERE user_id IN (SELECT id FROM users WHERE user_type = 'trainer');

-- 10B: Restore from backup if needed
-- LOAD DATA INFILE '/tmp/location_backup.csv'
-- INTO TABLE user_profiles
-- FIELDS TERMINATED BY ','
-- ENCLOSED BY '"'
-- LINES TERMINATED BY '\n'
-- (user_id, location_label, location_lat, location_lng, service_radius);

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
