-- ============================================================================
-- CLIENT PORTAL SAMPLE DATA
-- ============================================================================
-- This SQL file contains sample/test data for the client portal
-- Use this to populate the database with categories, bookings, messages, etc.
--
-- IMPORTANT: Ensure user accounts exist before running this script
-- This assumes the following test users exist in the users table:
--   - admin@skatryk.co.ke (id: should be user_xyz)
--   - trainer@skatryk.co.ke (id: should be trainer_xyz)
--   - client@skatryk.co.ke (id: should be client_xyz)
--
-- Usage: mysql -u root -p trainer_db < database/client_portal_seed_data.sql
-- ============================================================================

-- ============================================================================
-- SAMPLE CATEGORIES
-- ============================================================================
-- Insert training categories/disciplines

INSERT INTO `categories` (`name`, `icon`, `description`, `created_at`, `updated_at`) VALUES
('Yoga', '🧘', 'Yoga training and flexibility exercises', NOW(), NOW()),
('Boxing', '🥊', 'Boxing training and combat sports', NOW(), NOW()),
('CrossFit', '💪', 'High-intensity functional training', NOW(), NOW()),
('Pilates', '🤸', 'Core strength and body conditioning', NOW(), NOW()),
('HIIT', '⚡', 'High-Intensity Interval Training', NOW(), NOW()),
('Running', '🏃', 'Running coaching and endurance training', NOW(), NOW()),
('Swimming', '🏊', 'Swimming lessons and aquatic fitness', NOW(), NOW()),
('Personal Training', '👨‍🏫', 'One-on-one personalized fitness training', NOW(), NOW());

-- ============================================================================
-- SAMPLE BOOKINGS
-- ============================================================================
-- Insert sample training session bookings
-- NOTE: Replace USER_IDS with actual user IDs from your users table

-- Example with placeholder IDs (replace with real UUIDs):
-- INSERT INTO `bookings` (
--   `id`, `client_id`, `trainer_id`, `session_date`, `session_time`,
--   `duration_hours`, `total_sessions`, `status`, `total_amount`,
--   `notes`, `created_at`, `updated_at`
-- ) VALUES
-- ('booking_001', 'client_uuid_1', 'trainer_uuid_1', '2024-12-20', '10:00:00',
--  1, 1, 'confirmed', 1500.00, 'Morning yoga session', NOW(), NOW()),
-- ('booking_002', 'client_uuid_1', 'trainer_uuid_2', '2024-12-22', '14:00:00',
--  1, 4, 'pending', 5000.00, 'Weekly boxing training', NOW(), NOW());

-- ============================================================================
-- SAMPLE PAYMENTS
-- ============================================================================
-- Insert sample payment records

-- INSERT INTO `payments` (
--   `id`, `user_id`, `booking_id`, `amount`, `status`,
--   `method`, `transaction_reference`, `created_at`, `updated_at`
-- ) VALUES
-- ('payment_001', 'client_uuid_1', 'booking_001', 1500.00, 'completed',
--  'mpesa', 'TXN123456789', NOW(), NOW()),
-- ('payment_002', 'client_uuid_1', 'booking_002', 5000.00, 'completed',
--  'mpesa', 'TXN987654321', NOW(), NOW());

-- ============================================================================
-- SAMPLE PAYMENT METHODS
-- ============================================================================
-- Insert sample payment methods for users

-- INSERT INTO `payment_methods` (
--   `id`, `user_id`, `method`, `details`, `created_at`, `updated_at`
-- ) VALUES
-- ('method_001', 'client_uuid_1', 'M-Pesa ****7890', JSON_OBJECT('phone', '254712345678'), NOW(), NOW()),
-- ('method_002', 'client_uuid_1', 'Card ****1234', JSON_OBJECT('last_4', '1234'), NOW(), NOW());

-- ============================================================================
-- SAMPLE MESSAGES
-- ============================================================================
-- Insert sample chat messages between users

-- INSERT INTO `messages` (
--   `id`, `sender_id`, `recipient_id`, `trainer_id`, `client_id`,
--   `content`, `read_by_trainer`, `read_by_client`, `created_at`, `updated_at`
-- ) VALUES
-- ('msg_001', 'client_uuid_1', 'trainer_uuid_1', 'trainer_uuid_1', 'client_uuid_1',
--  'Hi, can we schedule a session for Monday?', FALSE, TRUE, NOW(), NOW()),
-- ('msg_002', 'trainer_uuid_1', 'client_uuid_1', 'trainer_uuid_1', 'client_uuid_1',
--  'Sure! Monday at 10 AM works for me.', TRUE, FALSE, NOW(), NOW());

-- ============================================================================
-- SAMPLE NOTIFICATIONS
-- ============================================================================
-- Insert sample in-app notifications

-- INSERT INTO `notifications` (
--   `id`, `user_id`, `title`, `body`, `type`, `read`, `created_at`, `updated_at`
-- ) VALUES
-- ('notif_001', 'client_uuid_1', 'Booking Confirmed', 'Your session with trainer is confirmed for Dec 20', 'success', FALSE, NOW(), NOW()),
-- ('notif_002', 'trainer_uuid_1', 'New Booking Request', 'You have a new booking request from client', 'info', FALSE, NOW(), NOW()),
-- ('notif_003', 'client_uuid_1', 'Session Reminder', 'Your training session starts in 2 hours', 'warning', FALSE, NOW(), NOW());

-- ============================================================================
-- SAMPLE REVIEWS
-- ============================================================================
-- Insert sample trainer reviews and ratings

-- INSERT INTO `reviews` (
--   `id`, `booking_id`, `client_id`, `trainer_id`,
--   `rating`, `comment`, `created_at`, `updated_at`
-- ) VALUES
-- ('review_001', 'booking_001', 'client_uuid_1', 'trainer_uuid_1',
--  4.50, 'Great trainer! Very professional and attentive. Highly recommended.', NOW(), NOW()),
-- ('review_002', 'booking_002', 'client_uuid_2', 'trainer_uuid_2',
--  5.00, 'Excellent boxing techniques and very motivating!', NOW(), NOW());

-- ============================================================================
-- SAMPLE REFERRALS
-- ============================================================================
-- Insert sample referral codes

-- INSERT INTO `referrals` (
--   `id`, `code`, `referrer_id`, `referee_id`,
--   `discount_used`, `discount_amount`, `created_at`, `updated_at`
-- ) VALUES
-- ('referral_001', 'REF-ABC123', 'trainer_uuid_1', NULL,
--  FALSE, 0.00, NOW(), NOW()),
-- ('referral_002', 'REF-XYZ789', 'trainer_uuid_1', 'client_uuid_2',
--  TRUE, 500.00, NOW(), NOW());

-- ============================================================================
-- NOTES FOR POPULATING DATA
-- ============================================================================
-- 
-- 1. Get actual user IDs:
--    SELECT id, email, user_type FROM users LIMIT 10;
--    SELECT user_id, user_type, full_name FROM user_profiles LIMIT 10;
--
-- 2. For testing, you need at least:
--    - 1 admin user
--    - 2-3 trainer users (with user_profiles where user_type='trainer')
--    - 2-3 client users (with user_profiles where user_type='client')
--
-- 3. Replace the placeholders (client_uuid_1, trainer_uuid_1, etc.)
--    with actual user IDs from your database
--
-- 4. Use valid dates (future dates for bookings, past or current for reviews)
--
-- 5. UUIDs can be generated in SQL:
--    SELECT UUID() as new_id;
--
-- ============================================================================

-- ============================================================================
-- UNCOMMENT SECTIONS ABOVE AFTER REPLACING USER IDS
-- ============================================================================
-- To use this file:
-- 1. Edit the SQL statements above and replace user IDs with actual ones
-- 2. Uncomment the INSERT statements
-- 3. Run: mysql -u root -p trainer_db < database/client_portal_seed_data.sql

-- ============================================================================
-- VERIFY INSERTED DATA
-- ============================================================================
-- Run these queries to verify the data was inserted:

-- SELECT COUNT(*) as category_count FROM categories;
-- SELECT COUNT(*) as booking_count FROM bookings;
-- SELECT COUNT(*) as payment_count FROM payments;
-- SELECT COUNT(*) as message_count FROM messages;
-- SELECT COUNT(*) as notification_count FROM notifications;
-- SELECT COUNT(*) as review_count FROM reviews;
-- SELECT COUNT(*) as referral_count FROM referrals;

-- ============================================================================
-- END OF SAMPLE DATA
-- ============================================================================
