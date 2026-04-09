-- Migration: Add trainer tracking and earnings breakdown to payments table
-- Purpose: Fix trainer earnings not being recorded and prevent double commission on transport

BEGIN;

-- 1. Add trainer tracking columns to payments table
ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS trainer_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS trainer_net_amount DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_service_amount DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_fee DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(15, 2) DEFAULT 0;

-- 2. Add foreign key constraint for trainer_id
ALTER TABLE IF EXISTS payments
  ADD CONSTRAINT IF NOT EXISTS fk_payments_trainer_id 
    FOREIGN KEY (trainer_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;

-- 3. Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_trainer_id ON payments(trainer_id);
CREATE INDEX IF NOT EXISTS idx_payments_trainer_status ON payments(trainer_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_booking_trainer ON payments(booking_id, trainer_id);

-- 4. Ensure stk_push_sessions has client_id column for payment linking
ALTER TABLE IF EXISTS stk_push_sessions
  ADD COLUMN IF NOT EXISTS client_id VARCHAR(36);

-- 5. Create index for stk_push_sessions client lookups
CREATE INDEX IF NOT EXISTS idx_stk_push_sessions_client ON stk_push_sessions(client_id);

COMMIT;
