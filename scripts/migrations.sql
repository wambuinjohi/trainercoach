BEGIN;

-- Ensure pgcrypto available for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Alter user_profiles to add trainer fields if missing
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS disciplines jsonb,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS hourly_rate_by_radius jsonb,
  ADD COLUMN IF NOT EXISTS service_radius integer,
  ADD COLUMN IF NOT EXISTS availability jsonb,
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_details jsonb,
  ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_lat numeric,
  ADD COLUMN IF NOT EXISTS location_lng numeric,
  ADD COLUMN IF NOT EXISTS location_label text;

-- Services table
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  title text NOT NULL,
  price numeric DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  trainer_id uuid NOT NULL,
  session_date date,
  session_time text,
  duration_hours numeric DEFAULT 1,
  total_sessions integer DEFAULT 1,
  status text DEFAULT 'pending',
  total_amount numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid,
  client_id uuid,
  content text,
  created_at timestamptz DEFAULT now(),
  read_by_trainer boolean DEFAULT false,
  read_by_client boolean DEFAULT false
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid,
  user_id uuid,
  trainer_id uuid,
  amount numeric DEFAULT 0,
  status text DEFAULT 'pending',
  method text,
  created_at timestamptz DEFAULT now()
);

-- Payouts
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid,
  amount numeric DEFAULT 0,
  status text,
  requested_at timestamptz,
  paid_at timestamptz
);

-- Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid,
  referee_id uuid,
  referrer_type text,
  code text UNIQUE,
  discount_used boolean DEFAULT false,
  discount_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid UNIQUE,
  client_id uuid,
  trainer_id uuid,
  rating integer,
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  icon text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  body text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Payment methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  method text,
  created_at timestamptz DEFAULT now()
);

-- Promotions (trainer profile boosting requests)
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid,
  commission_rate numeric DEFAULT 0,
  status text,
  created_at timestamptz DEFAULT now()
);

-- Issues (help/support)
CREATE TABLE IF NOT EXISTS public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  trainer_id uuid,
  description text,
  status text,
  created_at timestamptz DEFAULT now()
);

-- Additional admin/audit migrations: issues metadata, attachments table, indexes

-- Ensure phone_number and payout_details exist on user_profiles
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS payout_details jsonb;

-- Enhance issues table with complaint metadata and attachments
ALTER TABLE IF EXISTS public.issues
  ADD COLUMN IF NOT EXISTS complaint_type text,
  ADD COLUMN IF NOT EXISTS booking_reference text,
  ADD COLUMN IF NOT EXISTS attachments jsonb;

-- Lightweight attachments table to store uploaded file references
CREATE TABLE IF NOT EXISTS public.issues_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
  url text NOT NULL,
  filename text,
  content_type text,
  created_at timestamptz DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON public.issues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_booking_reference ON public.issues (booking_reference);

-- Ensure referrals referrer_type exists and add indexes
ALTER TABLE IF EXISTS public.referrals
  ADD COLUMN IF NOT EXISTS referrer_type text;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals (referrer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_code_unique ON public.referrals (code);

COMMIT;

-- Admin dashboard views

CREATE OR REPLACE VIEW public.admin_overview AS
SELECT
  (SELECT COUNT(*) FROM public.user_profiles WHERE user_type = 'client') AS total_clients,
  (SELECT COUNT(*) FROM public.user_profiles WHERE user_type = 'trainer') AS total_trainers,
  (SELECT COUNT(*) FROM public.bookings) AS total_bookings,
  (SELECT COALESCE(SUM(total_amount),0) FROM public.bookings WHERE status IN ('confirmed','completed')) AS total_revenue,
  (SELECT COUNT(*) FROM public.user_profiles WHERE user_type = 'trainer' AND is_approved IS NOT TRUE) AS pending_approvals,
  (SELECT COUNT(*) FROM public.issues WHERE status IS DISTINCT FROM 'resolved') AS active_issues,
  (SELECT COALESCE(SUM(total_amount),0) FROM public.bookings WHERE status IN ('confirmed','completed') AND session_date >= (CURRENT_DATE - INTERVAL '30 days')) AS revenue_30d,
  (SELECT COUNT(*) FROM public.bookings WHERE session_date >= (CURRENT_DATE - INTERVAL '30 days')) AS bookings_30d;

CREATE OR REPLACE VIEW public.monthly_revenue AS
SELECT
  to_char(date_trunc('month', session_date)::date, 'YYYY-MM') AS month,
  COUNT(*) FILTER (WHERE status IN ('confirmed','completed')) AS bookings,
  COALESCE(SUM(total_amount) FILTER (WHERE status IN ('confirmed','completed')),0) AS revenue
FROM public.bookings
WHERE session_date IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.recent_activity AS
SELECT id::text, 'booking' AS type, session_date AS occurred_at, jsonb_build_object(
  'booking_id', id, 'client_id', client_id, 'trainer_id', trainer_id, 'total_amount', total_amount, 'status', status
) AS payload
FROM public.bookings
UNION ALL
SELECT id::text, 'issue' AS type, created_at AS occurred_at, jsonb_build_object(
  'issue_id', id, 'user_id', user_id, 'complaint_type', complaint_type, 'status', status
) AS payload
FROM public.issues
UNION ALL
SELECT id::text, 'referral' AS type, created_at AS occurred_at, jsonb_build_object(
  'referral_id', id, 'referrer_id', referrer_id, 'code', code
) AS payload
FROM public.referrals
ORDER BY occurred_at DESC
LIMIT 200;

CREATE OR REPLACE VIEW public.top_trainers_90d AS
SELECT
  up.user_id,
  up.full_name,
  COUNT(b.id) AS bookings_count,
  COALESCE(SUM(b.total_amount),0) AS revenue
FROM public.bookings b
JOIN public.user_profiles up ON up.user_id = b.trainer_id
WHERE b.status IN ('confirmed','completed') AND b.session_date >= (CURRENT_DATE - INTERVAL '90 days')
GROUP BY up.user_id, up.full_name
ORDER BY revenue DESC
LIMIT 50;

-- End of admin views

-- Platform secrets storage for service credentials (MPesa, SMTP, etc.)
CREATE TABLE IF NOT EXISTS public.platform_secrets (
  id serial PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now()
);
