-- Verification Query: Check if location_label column exists in user_profiles table

-- 1. Check if location_label column exists
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_profiles'
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN ('location_label', 'location_lat', 'location_lng', 'location')
ORDER BY COLUMN_NAME;

-- 2. Show all columns in user_profiles (to see full schema)
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_profiles'
  AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;

-- 3. Check sample data - see what's actually stored
SELECT 
    user_id, 
    location_label, 
    location_lat, 
    location_lng,
    location,
    service_radius
FROM user_profiles
LIMIT 10;

-- 4. Check for trainers with location data (if any exists)
SELECT 
    user_id,
    location_label,
    location_lat,
    location_lng,
    service_radius
FROM user_profiles
WHERE location_label IS NOT NULL 
   OR location_lat IS NOT NULL
LIMIT 20;
