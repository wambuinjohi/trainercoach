-- ============================================================================
-- CREATE TEST USER ACCOUNTS
-- ============================================================================
-- This script creates test users for development and testing
-- PIN: 1234 (4-digit PIN as per the application requirements)

-- Create Admin Test User
INSERT INTO `users` (
  `id`, `email`, `password`, `user_type`, `phone_number`, 
  `is_approved`, `is_suspended`, `created_at`, `updated_at`
) VALUES (
  'user_admin_test', 
  'admin@skatryk.co.ke', 
  '1234',  -- PIN-based auth (4 digits)
  'admin',
  '254712345678',
  true,
  false,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Create Trainer Test User
INSERT INTO `users` (
  `id`, `email`, `password`, `user_type`, `phone_number`,
  `is_approved`, `is_suspended`, `created_at`, `updated_at`
) VALUES (
  'user_trainer_test',
  'trainer@skatryk.co.ke',
  '1234',  -- PIN-based auth (4 digits)
  'trainer',
  '254712345679',
  true,
  false,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Create Client Test User
INSERT INTO `users` (
  `id`, `email`, `password`, `user_type`, `phone_number`,
  `is_approved`, `is_suspended`, `created_at`, `updated_at`
) VALUES (
  'user_client_test',
  'client@skatryk.co.ke',
  '1234',  -- PIN-based auth (4 digits)
  'client',
  '254712345680',
  false,
  false,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Create user profiles for the test accounts
INSERT INTO `user_profiles` (
  `user_id`, `full_name`, `profile_image`, `bio`, `location`,
  `location_lat`, `location_lng`, `phone`, `created_at`, `updated_at`
) VALUES
(
  'user_admin_test',
  'Admin Test',
  NULL,
  'Test admin account',
  'Nairobi',
  -1.2921,
  36.8219,
  '254712345678',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW(),
(
  'user_trainer_test',
  'Trainer Test',
  NULL,
  'Professional fitness trainer',
  'Nairobi',
  -1.2921,
  36.8219,
  '254712345679',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW(),
(
  'user_client_test',
  'Client Test',
  NULL,
  'Fitness enthusiast',
  'Nairobi',
  -1.2921,
  36.8219,
  '254712345680',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Add basic trainer profile data if needed
INSERT INTO `trainer_profiles` (
  `user_id`, `hourly_rate`, `is_approved`, `account_status`,
  `created_at`, `updated_at`
) VALUES (
  'user_trainer_test',
  2500,
  true,
  'approved',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Verify the accounts were created
SELECT 'Test users created:' as message;
SELECT `id`, `email`, `user_type`, `phone_number`, `is_approved` FROM `users` 
WHERE `email` IN ('admin@skatryk.co.ke', 'trainer@skatryk.co.ke', 'client@skatryk.co.ke');
