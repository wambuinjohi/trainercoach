BEGIN;

-- Add fee breakdown columns to bookings table for proper financial tracking
ALTER TABLE IF EXISTS public.bookings
  ADD COLUMN IF NOT EXISTS base_service_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trainer_net_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_surcharge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category_id integer,
  ADD COLUMN IF NOT EXISTS client_location_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS client_location_lng numeric(9,6),
  ADD COLUMN IF NOT EXISTS client_location_label text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add fee breakdown to payments table for reconciliation
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS fee_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create an invoices table to store generated receipts
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  trainer_id uuid NOT NULL,
  invoice_number text UNIQUE NOT NULL,
  base_service_amount numeric NOT NULL DEFAULT 0,
  transport_fee numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  client_surcharge numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  trainer_net_amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'pending',
  generated_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices (booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_trainer_id ON public.invoices (trainer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON public.bookings (client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trainer_id ON public.bookings (trainer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);

COMMIT;
