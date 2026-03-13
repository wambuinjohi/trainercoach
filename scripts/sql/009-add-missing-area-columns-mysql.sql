-- Migration: Add missing area_of_residence and related columns to user_profiles
-- For MySQL
-- Execute this file against your database to add the missing columns

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `area_of_residence` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Area of residence/service location';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `area_coordinates` JSON NULL DEFAULT NULL COMMENT 'Coordinates of the area {lat, lng}';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `mpesa_number` VARCHAR(20) NULL DEFAULT NULL COMMENT 'M-Pesa number for payments';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `sponsor_id` VARCHAR(36) NULL DEFAULT NULL COMMENT 'Sponsor/referrer user ID';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `account_status` ENUM('registered', 'profile_incomplete', 'pending_approval', 'approved', 'suspended') DEFAULT 'registered' COMMENT 'Account approval status';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `location_lat` DECIMAL(9, 6) NULL DEFAULT NULL COMMENT 'Latitude of user location';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `location_lng` DECIMAL(9, 6) NULL DEFAULT NULL COMMENT 'Longitude of user location';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `location_label` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Human-readable location label';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `hourly_rate_by_radius` JSON NULL DEFAULT NULL COMMENT 'Tiered pricing by distance {radius_km, rate}';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `payout_details` JSON NULL DEFAULT NULL COMMENT 'Payout information';

ALTER TABLE `user_profiles` ADD COLUMN IF NOT EXISTS `timezone` VARCHAR(50) NULL DEFAULT NULL COMMENT 'User timezone';

-- Add indexes for location-based queries
ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS `idx_location_lat_lng` (`location_lat`, `location_lng`);

ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS `idx_location_label` (`location_label`);

ALTER TABLE `user_profiles` ADD INDEX IF NOT EXISTS `idx_account_status` (`account_status`);

-- Add foreign key constraint for sponsor_id if needed (optional)
-- ALTER TABLE `user_profiles` ADD CONSTRAINT `fk_sponsor_id` FOREIGN KEY (`sponsor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL;

-- Verify the migration
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'user_profiles' 
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN (
    'area_of_residence', 
    'area_coordinates', 
    'mpesa_number', 
    'location_lat', 
    'location_lng', 
    'location_label',
    'hourly_rate_by_radius',
    'account_status'
  )
ORDER BY ORDINAL_POSITION;
