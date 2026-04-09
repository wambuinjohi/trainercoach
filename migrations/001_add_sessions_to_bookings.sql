-- Migration: Add sessions JSON column to bookings table
-- Description: Adds support for multi-session bookings with flexible scheduling
-- Date: 2024-01-15

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS sessions JSON NULL COMMENT 'Multi-session booking details: [{date, start_time, end_time, duration_hours}, ...]' AFTER session_time;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS session_phase VARCHAR(50) NULL COMMENT 'Booking session lifecycle state' AFTER status;

-- Index for faster querying if needed in the future
-- ALTER TABLE bookings ADD INDEX idx_sessions (sessions(255));

-- Optional: Set default value for existing rows (all NULL for backwards compatibility)
-- UPDATE bookings SET sessions = NULL WHERE sessions IS NULL;
