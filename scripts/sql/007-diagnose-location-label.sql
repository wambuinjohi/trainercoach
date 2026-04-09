-- Diagnostic script to identify and fix location_label loading issue

-- ============================================================================
-- STEP 1: Check current column structure
-- ============================================================================

-- Check if location_label column exists
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_profiles'
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN ('location_label', 'location_lat', 'location_lng', 'service_radius')
ORDER BY COLUMN_NAME;

-- ============================================================================
-- STEP 2: List ALL columns in user_profiles to see current structure
-- ============================================================================

SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_profiles'
  AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;

-- ============================================================================
-- STEP 3: Check sample data - what's actually stored
-- ============================================================================

-- Get first 5 trainers with whatever location fields exist
SELECT 
    user_id,
    -- These columns may or may not exist yet
    location_label,
    location_lat,
    location_lng,
    service_radius
FROM user_profiles
WHERE user_id IN (
    SELECT id FROM users WHERE user_type = 'trainer' LIMIT 5
);

-- ============================================================================
-- STEP 4: APPLY THE FIX - Run this if columns are missing
-- ============================================================================

-- Uncomment the lines below if location_label column doesn't exist:

-- ALTER TABLE user_profiles
-- ADD COLUMN IF NOT EXISTS location_label VARCHAR(255) NULL DEFAULT NULL,
-- ADD COLUMN IF NOT EXISTS location_lat DECIMAL(9, 6) NULL DEFAULT NULL,
-- ADD COLUMN IF NOT EXISTS location_lng DECIMAL(9, 6) NULL DEFAULT NULL,
-- ADD COLUMN IF NOT EXISTS service_radius INT NULL DEFAULT NULL;

-- ============================================================================
-- STEP 5: Verify the fix - location_label should now be populated
-- ============================================================================

-- After running the ALTER TABLE above, check if columns were added:
SELECT 
    COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_profiles'
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME = 'location_label';

-- ============================================================================
-- STEP 6: Check trainer profiles with location info
-- ============================================================================

-- This should return trainers with location data
SELECT 
    up.user_id,
    u.name as trainer_name,
    up.location_label,
    up.location_lat,
    up.location_lng,
    up.service_radius
FROM user_profiles up
LEFT JOIN users u ON up.user_id = u.id
WHERE u.user_type = 'trainer'
  AND (up.location_label IS NOT NULL 
       OR up.location_lat IS NOT NULL 
       OR up.location_lng IS NOT NULL)
LIMIT 20;

-- ============================================================================
-- STEP 7: Count trainers by location setup status
-- ============================================================================

SELECT 
    CASE 
        WHEN location_label IS NOT NULL OR location_lat IS NOT NULL THEN 'Has Location'
        ELSE 'No Location Set'
    END as status,
    COUNT(*) as trainer_count
FROM user_profiles
WHERE user_id IN (SELECT id FROM users WHERE user_type = 'trainer')
GROUP BY status;
