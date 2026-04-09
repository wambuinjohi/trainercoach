-- Migration: Ensure location_label column exists in user_profiles table (MySQL)
-- This fixes the issue where location_label is not being loaded in ServiceAreaEditor

BEGIN;

-- 1. Add location_label column if it doesn't exist
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS location_label VARCHAR(255) NULL DEFAULT NULL;

-- 2. Ensure location_lat and location_lng columns exist with proper types
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(9, 6) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(9, 6) NULL DEFAULT NULL;

-- 3. Add constraint to validate latitude range (-90 to 90)
ALTER TABLE user_profiles
ADD CONSTRAINT IF NOT EXISTS chk_location_lat_range 
  CHECK (location_lat IS NULL OR (location_lat >= -90 AND location_lat <= 90));

-- 4. Add constraint to validate longitude range (-180 to 180)
ALTER TABLE user_profiles
ADD CONSTRAINT IF NOT EXISTS chk_location_lng_range 
  CHECK (location_lng IS NULL OR (location_lng >= -180 AND location_lng <= 180));

-- 5. Create index on location_label for faster searches
CREATE INDEX IF NOT EXISTS idx_user_profiles_location_label 
  ON user_profiles(location_label);

-- 6. Create composite index on lat/lng for proximity queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_location_coords 
  ON user_profiles(location_lat, location_lng);

-- 7. Ensure service_radius column exists
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS service_radius INT NULL DEFAULT NULL;

-- 8. Add index on service_radius for filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_service_radius 
  ON user_profiles(service_radius);

COMMIT;
