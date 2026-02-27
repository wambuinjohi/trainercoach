-- ============================================================================
-- PAYMENTS TABLE SCHEMA FIX
-- ============================================================================
-- This script fixes the database schema mismatch by adding missing columns
-- to the payments table that are required by the application code.
-- 
-- Issues fixed:
-- - Missing client_id column (needed to identify who paid)
-- - Missing trainer_id column (needed for trainer payment tracking)
-- - Missing description column (for payment notes)
-- - Missing created_at/updated_at timestamps
-- - Missing indexes for performance
-- ============================================================================

-- ============================================================================
-- STEP 1: Add Missing Columns to payments Table
-- ============================================================================

-- Add client_id column
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS client_id VARCHAR(36) NULL AFTER user_id;

-- Add trainer_id column
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS trainer_id VARCHAR(36) NULL AFTER client_id;

-- Add description column
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS description VARCHAR(255) NULL AFTER transaction_reference;

-- Add created_at timestamp
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER description;

-- Add updated_at timestamp
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- ============================================================================
-- STEP 2: Add Indexes to payments Table
-- ============================================================================

-- Index for client_id lookups
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);

-- Index for trainer_id lookups
CREATE INDEX IF NOT EXISTS idx_payments_trainer_id ON payments(trainer_id);

-- Index for booking_id lookups (if not already exists)
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);

-- Index for created_at queries and sorting
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ============================================================================
-- STEP 3: Add Foreign Key Constraints to payments Table
-- ============================================================================

-- Foreign key for client_id
ALTER TABLE payments
ADD CONSTRAINT IF NOT EXISTS fk_payments_client_id 
FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE;

-- Foreign key for trainer_id
ALTER TABLE payments
ADD CONSTRAINT IF NOT EXISTS fk_payments_trainer_id 
FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 4: Fix stk_push_sessions Table (if exists)
-- ============================================================================

-- Add client_id to stk_push_sessions
ALTER TABLE stk_push_sessions
ADD COLUMN IF NOT EXISTS client_id VARCHAR(36) NULL AFTER id;

-- Add trainer_id to stk_push_sessions
ALTER TABLE stk_push_sessions
ADD COLUMN IF NOT EXISTS trainer_id VARCHAR(36) NULL AFTER client_id;

-- Add indexes to stk_push_sessions
CREATE INDEX IF NOT EXISTS idx_stk_client_id ON stk_push_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_stk_trainer_id ON stk_push_sessions(trainer_id);

-- ============================================================================
-- STEP 5: Fix b2c_payments Table (if exists)
-- ============================================================================

-- Add trainer_id to b2c_payments
ALTER TABLE b2c_payments
ADD COLUMN IF NOT EXISTS trainer_id VARCHAR(36) NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify the schema is correct:

-- Show the payments table structure:
-- DESCRIBE payments;

-- Show specific columns:
-- SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME = 'payments'
-- AND COLUMN_NAME IN ('client_id', 'trainer_id', 'description', 'created_at', 'updated_at');

-- Show indexes:
-- SHOW INDEXES FROM payments;

-- ============================================================================
-- EXPECTED RESULT
-- ============================================================================
-- After running these statements:
-- - payments table will have: client_id, trainer_id, description, created_at, updated_at
-- - All necessary indexes will be created
-- - Foreign key constraints will link client_id and trainer_id to users(id)
-- - Payment records can now store trainer and client information
-- - The M-Pesa STK push payment flow will work without schema errors
-- ============================================================================
