# M-Pesa Credentials Migration Documentation

## Overview

This document describes the migration of M-Pesa credentials from a JSON blob stored in the `platform_settings` table to a dedicated `mpesa_credentials` table.

**Migration Date**: 2025-01-23  
**Status**: Completed  

## Why This Change?

### Security Improvements
- **Separation of Concerns**: Credentials are now in a dedicated table instead of mixed with other platform settings
- **Reduced Attack Surface**: Accessing M-Pesa credentials no longer requires accessing the generic settings table
- **Audit Trail Ready**: The dedicated table structure makes it easier to add encryption or audit logging in the future

### Maintainability
- **Structured Storage**: Each credential field is now a column instead of nested in JSON
- **Better Indexing**: Can optimize queries on specific fields (environment, created_at, updated_at)
- **Cleaner Code**: Backend functions work with native database types instead of JSON parsing

## New Table Structure

### Table: `mpesa_credentials`

```sql
CREATE TABLE `mpesa_credentials` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `consumerKey` VARCHAR(255) NOT NULL,
    `consumerSecret` VARCHAR(255) NOT NULL,
    `shortcode` VARCHAR(20) NOT NULL,
    `passkey` VARCHAR(255) NOT NULL,
    `environment` VARCHAR(50) DEFAULT 'production',
    `securityCredential` VARCHAR(500),
    `resultUrl` TEXT,
    `initiatorName` VARCHAR(255),
    `commandId` VARCHAR(100) DEFAULT 'BusinessPayment',
    `transactionType` VARCHAR(100) DEFAULT 'BusinessPayment',
    `c2bCallbackUrl` TEXT,
    `b2cCallbackUrl` TEXT,
    `queueTimeoutUrl` TEXT,
    `source` VARCHAR(100) DEFAULT 'admin_settings',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Column Descriptions

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `id` | INT | Auto-incrementing primary key | - |
| `consumerKey` | VARCHAR(255) | M-Pesa OAuth consumer key | Required |
| `consumerSecret` | VARCHAR(255) | M-Pesa OAuth consumer secret | Required |
| `shortcode` | VARCHAR(20) | Business shortcode for STK Push | Required |
| `passkey` | VARCHAR(255) | Passkey for generating STK Push password | Required |
| `environment` | VARCHAR(50) | 'production' or 'sandbox' | Default: 'production' |
| `securityCredential` | VARCHAR(500) | Encrypted credential for B2C payments | Optional |
| `resultUrl` | TEXT | Callback URL for B2C results | Optional |
| `initiatorName` | VARCHAR(255) | Name of the B2C initiator | Optional |
| `commandId` | VARCHAR(100) | B2C command type | Default: 'BusinessPayment' |
| `transactionType` | VARCHAR(100) | Transaction type identifier | Default: 'BusinessPayment' |
| `c2bCallbackUrl` | TEXT | C2B/STK callback URL | Optional |
| `b2cCallbackUrl` | TEXT | B2C callback URL | Optional |
| `queueTimeoutUrl` | TEXT | Queue timeout callback URL | Optional |
| `source` | VARCHAR(100) | Where credentials came from | Default: 'admin_settings' |
| `created_at` | TIMESTAMP | Record creation time | Auto |
| `updated_at` | TIMESTAMP | Last update time | Auto |

## Migration Process

### Step 1: Run Migration Script

Execute the migration script to create the new table and transfer existing credentials:

```bash
php scripts/migrate_mpesa_credentials.php
```

**What it does:**
1. Creates the `mpesa_credentials` table
2. Checks for existing credentials in `platform_settings`
3. Parses and validates the JSON credentials
4. Inserts credentials into the new table
5. Verifies the migration was successful

### Step 2: Verify Migration

Run the verification script to ensure everything is working:

```bash
php scripts/verify_mpesa_migration.php
```

**Output includes:**
- ✓ Table exists and has correct structure
- ✓ Credentials count in new table
- ✓ Credentials count in old location
- ✓ Backend function availability
- Next steps for cleanup

### Step 3: Test Functionality

Test all M-Pesa flows to ensure they work correctly:

1. **Admin Settings**: Save M-Pesa settings from Admin Dashboard
2. **STK Push**: Initiate a test payment
3. **B2C Payment**: Test a payout flow
4. **Callbacks**: Verify callback handlers work correctly

### Step 4: Cleanup (Optional)

After verifying all flows work, remove the old credentials entry:

**Option 1 - Using cleanup script:**
```bash
php scripts/verify_mpesa_migration.php --cleanup
```

**Option 2 - Direct SQL:**
```sql
DELETE FROM platform_settings WHERE setting_key = 'mpesa_credentials';
```

> ⚠️ Only run cleanup after thorough testing. Keep the old entry as backup until you're confident in the new system.

## Backward Compatibility

The implementation includes a graceful fallback mechanism:

```
1. Try to read from mpesa_credentials table (new)
2. If not found, try platform_settings JSON (legacy)
3. If not found, use environment variables
4. If not found, return null/error
```

This ensures that:
- Existing deployments continue to work during migration
- No downtime is required
- You can roll back by skipping cleanup

### Write Behavior

When credentials are saved (via Admin Settings):
- **Old behavior**: Writes to `platform_settings` table as JSON
- **New behavior**: Writes to `mpesa_credentials` table as structured columns

All new credentials go directly to the new table. The fallback only applies to reads.

## Backend Functions

### `getMpesaCredentials()`

Retrieves M-Pesa credentials from the database or environment.

**Returns:**
```php
[
    'consumer_key' => 'OWp...IHG',
    'consumer_secret' => 'N2T...Rem',
    'shortcode' => '9512956',
    'passkey' => '9f0...3a7',
    'environment' => 'production',
    'result_url' => 'https://...',
    'initiator_name' => 'gichukiwairua',
    'security_credential' => '•...•',
    'c2b_callback_url' => 'https://...',
    'b2c_callback_url' => 'https://...',
    'source' => 'mpesa_credentials_table'
]
```

**Sources (in priority order):**
1. `mpesa_credentials` table (new)
2. `platform_settings` table with key 'mpesa_credentials' (legacy)
3. Environment variables (`MPESA_CONSUMER_KEY`, etc.)

### `saveMpesaCredentials($credentials)`

Saves M-Pesa credentials to the `mpesa_credentials` table.

**Input:**
```php
[
    'consumerKey' => '...',
    'consumerSecret' => '...',
    'shortcode' => '...',
    'passkey' => '...',
    'environment' => 'production',
    'securityCredential' => '...',
    'resultUrl' => '...',
    'initiatorName' => '...',
    'c2bCallbackUrl' => '...',
    'b2cCallbackUrl' => '...',
    'source' => 'admin_settings'
]
```

**Behavior:**
- Creates table if it doesn't exist
- Deletes any previous credentials
- Inserts new credentials
- Logs the update via `logEvent()`

### `getMpesaCredentialsForAdmin()`

Retrieves credentials with masked secrets for display in Admin UI.

**Returns:** Same as `getMpesaCredentials()` but with secrets masked:
```php
'consumerKey' => 'OWp...IHG',  // First 3 and last 3 chars visible
'consumerSecret' => 'N2T...Rem'
'passkey' => '9f0...3a7'
'securityCredential' => '•...•'
```

## Environment Variables (Fallback)

If credentials aren't configured in the database, the system falls back to environment variables:

- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_ENVIRONMENT` (default: 'sandbox')
- `MPESA_RESULT_URL`
- `MPESA_INITIATOR_NAME`
- `MPESA_SECURITY_CREDENTIAL`
- `MPESA_C2B_CALLBACK_URL`
- `MPESA_B2C_CALLBACK_URL`

## Frontend (No Changes Required)

The frontend (`AdminDashboard.tsx`) requires no changes:

1. **Saving**: POST to `api.php` with `action: 'settings_save'` and the `mpesa` object
2. **Backend**: `api.php` calls `saveMpesaCredentials()` automatically
3. **Storage**: Credentials go to the new `mpesa_credentials` table

## Audit Trail

The migration logs all credential changes:

```php
logEvent('mpesa_credentials_updated', [
    'source' => 'admin_settings',
    'environment' => 'production'
]);
```

Check your application logs for `[mpesa_credentials_updated]` entries.

## Security Best Practices

### Production Deployment

1. **Database Access Control**:
   ```sql
   -- Restrict access to mpesa_credentials table
   GRANT SELECT, INSERT, UPDATE, DELETE ON dbname.mpesa_credentials TO 'app_user'@'localhost';
   REVOKE SELECT ON dbname.mpesa_credentials FROM 'other_user'@'localhost';
   ```

2. **Backups**: Ensure the mpesa_credentials table is included in regular backups

3. **Log Rotation**: Monitor error logs for credential exposure:
   ```bash
   grep "MPESA_CREDS\|consumerKey\|consumerSecret" /var/log/php-errors.log
   ```

4. **Monitoring**: Set up alerts for failed credential saves:
   - Database errors
   - Missing required fields
   - Frequent update attempts

### Future Enhancements

- Add field-level encryption for sensitive columns
- Implement access logs per credential operation
- Add role-based access control for credential management
- Rotate credentials automatically
- Store backup credentials for failover

## Troubleshooting

### Credentials Not Loading

**Symptom**: "M-Pesa credentials not configured" error

**Check:**
1. Verify table exists: `SELECT COUNT(*) FROM mpesa_credentials;`
2. Check if credentials in legacy table: `SELECT value FROM platform_settings WHERE setting_key = 'mpesa_credentials';`
3. Check environment variables: `echo $MPESA_CONSUMER_KEY`

### Migration Failed

**Symptom**: Error during migration script

**Check:**
1. Database permissions: `SHOW GRANTS FOR CURRENT_USER;`
2. Database space: `SHOW TABLE STATUS LIKE 'mpesa_credentials';`
3. Existing table: `DESC mpesa_credentials;`

### Admin Settings Not Saving

**Symptom**: Settings appear to save but don't persist

**Check:**
1. Check error logs for `[MPESA SAVE ERROR]`
2. Verify table structure: `DESC mpesa_credentials;`
3. Check database permissions for INSERT/UPDATE

## Rollback Procedure

If you need to revert to the old system:

1. **Stop using new code** (revert `mpesa_helper.php` to previous version)
2. **Keep the table** (`mpesa_credentials` remains as backup)
3. **Continue reading from old location**:
   ```php
   // Fallback to platform_settings happens automatically
   $creds = getMpesaCredentials(); // Will use platform_settings if table unavailable
   ```

## Files Modified

- `mpesa_helper.php` - Updated credential functions (getMpesaCredentials, saveMpesaCredentials, getMpesaCredentialsForAdmin)
- `scripts/migrate_mpesa_credentials.php` - NEW migration script
- `scripts/verify_mpesa_migration.php` - NEW verification script

## Files Not Modified

- `api.php` - Already calls saveMpesaCredentials
- `AdminDashboard.tsx` - No frontend changes needed
- `src/lib/settings.ts` - No changes needed

## Support

For issues or questions:

1. Check error logs: `tail -f error.log | grep MPESA`
2. Run verification: `php scripts/verify_mpesa_migration.php`
3. Check database: `SELECT * FROM mpesa_credentials\G`

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-23 | Initial implementation - separate credentials table with backward compatibility |

---

**Last Updated**: 2025-01-23  
**Maintained By**: Development Team
