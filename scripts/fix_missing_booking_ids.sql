-- Migration: Fix Missing Booking IDs
-- Purpose: Generate unique IDs for bookings that have NULL or empty id values
-- 
-- This script should be executed in phpMyAdmin or via mysql command line
-- After execution, verify the results with: SELECT COUNT(*) FROM bookings WHERE id IS NULL OR id = '';

-- Check current status
SELECT 'Current Status' as status;
SELECT COUNT(*) as bookings_missing_id FROM bookings WHERE id IS NULL OR id = '';

-- Start transaction
START TRANSACTION;

-- Option 1: Simple UUID-based approach (recommended for MariaDB/MySQL 8.0+)
UPDATE bookings 
SET id = CONCAT('booking_', REPLACE(UUID(), '-', ''))
WHERE id IS NULL OR id = '';

-- Option 2: If the above doesn't work, use timestamp-based IDs (fallback)
-- UPDATE bookings 
-- SET id = CONCAT('booking_', UNIX_TIMESTAMP(), '_', LPAD(RAND() * 10000, 5, '0'))
-- WHERE id IS NULL OR id = '';

-- Verify the fix
SELECT 'Migration Complete' as status;
SELECT COUNT(*) as bookings_with_id FROM bookings WHERE id IS NOT NULL AND id != '';
SELECT COUNT(*) as bookings_still_missing FROM bookings WHERE id IS NULL OR id = '';

-- Commit changes
COMMIT;

-- Final verification query (run this after to confirm)
-- SELECT * FROM bookings WHERE id IS NULL OR id = '' LIMIT 10;
