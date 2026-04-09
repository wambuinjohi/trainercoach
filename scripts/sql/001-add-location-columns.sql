-- Migration: add location fields to user_profiles
-- Adds free-text label and latitude/longitude columns, with basic constraints and indexes

BEGIN;

-- Add text fields for locality
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS location_label text;

-- Add numeric latitude/longitude (precision: 6 decimal places ~ 0.11m)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS location_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS location_lng numeric(9,6);

-- Add basic range checks for coordinates
ALTER TABLE public.user_profiles
  ADD CONSTRAINT IF NOT EXISTS chk_user_profiles_lat_range CHECK (location_lat IS NULL OR (location_lat BETWEEN -90 AND 90)),
  ADD CONSTRAINT IF NOT EXISTS chk_user_profiles_lng_range CHECK (location_lng IS NULL OR (location_lng BETWEEN -180 AND 180));

-- Create simple btree index on text location for exact-match/filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_location ON public.user_profiles (location);

-- Create composite index on latitude+longitude for bounding-box queries (useful for simple proximity filtering)
CREATE INDEX IF NOT EXISTS idx_user_profiles_lat_lng ON public.user_profiles (location_lat, location_lng);

-- Optionally create trigram index for fast ILIKE/partial-text searches on location (requires pg_trgm extension)
-- This extension is commonly available on hosted Postgres (e.g., Supabase). If not available, the CREATE EXTENSION will be ignored with an error.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    -- ignore if extension cannot be created
    RAISE NOTICE 'pg_trgm extension not available: %', SQLERRM;
  END;
END$$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_location_trgm ON public.user_profiles USING gin (location gin_trgm_ops);

COMMIT;
