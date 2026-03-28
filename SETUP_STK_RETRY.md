# STK Push Persistent Retry System Setup

This document explains how to set up and use the new persistent retry system for M-Pesa STK push payments.

## Overview

The STK push persistent retry system ensures that failed or timed-out payments are automatically retried indefinitely until successful. The system includes:

1. **Automatic Background Retries** - A worker process that automatically retries failed payments at exponential intervals
2. **Manual Retry Button** - Users can manually trigger a retry through the UI at any time
3. **Retry Tracking** - All retry attempts are tracked with retry counts and next retry timestamps

## Installation & Setup

### Step 1: Run the Migration

Run the migration to add retry tracking columns to the database:

```bash
php scripts/migrate_stk_retry_tracking.php
```

This adds the following columns to `stk_push_sessions`:
- `retry_count` - Number of retry attempts made
- `last_retry_at` - Timestamp of the last retry attempt
- `next_retry_at` - When the next retry should be attempted
- `should_retry` - Boolean flag to enable/disable automatic retries
- `merchant_request_id` - M-Pesa merchant request ID for status queries

### Step 2: Set Up Background Worker (Optional but Recommended)

The background worker automatically retries failed payments. You can run it in three ways:

#### Option A: Run Manually (Testing)
```bash
php scripts/worker_stk_retry.php
```

#### Option B: Cron Job (Recommended for Production)

Add this to your server's crontab to run the worker every minute:

```bash
* * * * * php /path/to/project/scripts/worker_stk_retry.php >> /var/log/stk_worker.log 2>&1
```

Or every 5 minutes (less frequent but still responsive):

```bash
*/5 * * * * php /path/to/project/scripts/worker_stk_retry.php >> /var/log/stk_worker.log 2>&1
```

#### Option C: API Endpoint (For automated systems)

Trigger the worker via HTTP request:

```bash
curl -X POST https://yourapp.com/api.php \
  -H "Content-Type: application/json" \
  -H "X-Worker-Token: YOUR_WORKER_API_KEY" \
  -d '{
    "action": "stk_retry_worker"
  }'
```

Or from localhost (no token required):

```bash
curl -X POST http://localhost/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "action": "stk_retry_worker"
  }'
```

### Step 3: Environment Variables (Optional)

For added security with the API endpoint, set a worker API key:

```bash
WORKER_API_KEY=your_secure_key_here
```

## How It Works

### Payment Flow

1. **Initial Payment Attempt**
   - User initiates STK push payment
   - System creates `stk_push_sessions` record with `should_retry=TRUE` and `retry_count=0`

2. **Polling Phase** (First 60 seconds)
   - Client polls the payment status for up to 20 times (60 seconds total)
   - If successful within this window, payment is completed
   - If failed/timeout or no response, user is notified

3. **Automatic Retry** (Background Worker)
   - Worker finds all sessions with `should_retry=TRUE` and status in ('failed', 'timeout')
   - Worker checks if `next_retry_at` has passed
   - Worker queries M-Pesa for current payment status
   - If successful, payment is recorded and `should_retry` is set to FALSE
   - If still failed/timeout, next retry is scheduled with exponential backoff

4. **Manual Retry** (User Action)
   - User clicks "Retry Payment" button in the UI
   - This calls `stk_push_retry` API endpoint
   - Endpoint sets `next_retry_at=NOW()` to prioritize it
   - Worker picks it up on next run

### Retry Schedule

The system uses exponential backoff to avoid overwhelming the server:

- Retry 1: 1 minute after failure
- Retry 2: 2 minutes after failure
- Retry 3: 4 minutes after failure
- Retry 4: 8 minutes after failure
- Retry 5: 16 minutes after failure
- Retry 6: 32 minutes after failure
- Retries 7+: 1 hour apart (indefinite)

This means a failed payment will be retried:
- Within 1 minute automatically
- Within 3 minutes (1 + 2)
- Within 7 minutes (1 + 2 + 4)
- Within 15 minutes
- Within 31 minutes
- Within 63 minutes
- Then every hour indefinitely

### API Endpoints

#### Manual Retry Endpoint

**Request:**
```
POST /api.php
Content-Type: application/json

{
  "action": "stk_push_retry",
  "checkout_request_id": "THE_CHECKOUT_ID_FROM_INITIAL_PAYMENT"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Retry scheduled successfully. The system will attempt the payment again.",
  "data": {
    "session_id": "stk_...",
    "status": "retry_scheduled",
    "phone": "254...",
    "amount": 1000,
    "retry_count": 0
  }
}
```

#### Worker Endpoint

**Request:**
```
POST /api.php
Content-Type: application/json
X-Worker-Token: YOUR_WORKER_API_KEY (optional if localhost)

{
  "action": "stk_retry_worker"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Retry worker completed.",
  "data": {
    "status": "success",
    "processed": 5,
    "succeeded": 2,
    "scheduled_retries": 3,
    "errors": []
  }
}
```

## UI Components

### STKPushTracker Component

The `STKPushTracker` component in `src/components/client/STKPushTracker.tsx` shows:

- **Retry Count** - Number of retry attempts for each payment
- **Next Retry Time** - When the next retry is scheduled (if applicable)
- **Retry Button** - Manual button to trigger immediate retry (for failed/timeout payments)
- **Retry Status** - Indicates if a retry is in progress

### Features

- Failed/timeout payments show a "Retry Payment" button
- Users can trigger retries at any time
- Shows next scheduled retry time
- Displays total retry count

## Monitoring & Troubleshooting

### Check Payment Status

View recent STK sessions:

```bash
# Check via API
curl -X POST http://localhost/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "action": "stk_push_history",
    "limit": 20,
    "offset": 0
  }'
```

### Database Queries

Check failed payments:
```sql
SELECT id, phone_number, amount, status, retry_count, next_retry_at 
FROM stk_push_sessions 
WHERE status IN ('failed', 'timeout') 
AND should_retry = TRUE
ORDER BY next_retry_at ASC;
```

Check recent retries:
```sql
SELECT id, status, retry_count, last_retry_at, next_retry_at
FROM stk_push_sessions
WHERE retry_count > 0
ORDER BY last_retry_at DESC
LIMIT 20;
```

### Worker Logs

If running via cron, check the logs:

```bash
tail -f /var/log/stk_worker.log
```

## Disabling Retries

To disable automatic retries for a specific payment:

```sql
UPDATE stk_push_sessions 
SET should_retry = FALSE 
WHERE checkout_request_id = 'CHECKOUT_ID';
```

To disable for all payments:

```sql
UPDATE stk_push_sessions 
SET should_retry = FALSE;
```

## Best Practices

1. **Run Worker Frequently** - Run the worker every 1-5 minutes via cron for responsive retries
2. **Monitor Logs** - Regularly check worker logs for errors
3. **Set Timeout** - Ensure worker processes complete within your PHP max_execution_time
4. **Database Backups** - Backup before running migration
5. **Test First** - Test the migration and worker on a staging environment first

## Support

For issues or questions, check:
- Worker logs for detailed error messages
- Database logs for query issues
- M-Pesa callback logs in `c2b_callback.php`
- API response messages for specific errors

## Configuration

Edit `scripts/worker_stk_retry.php` to customize:

```php
// At the top of the STKRetryWorker class:
private $base_retry_interval = 60;      // Start interval in seconds
private $max_retry_interval = 3600;     // Max interval between retries
private $exponential_backoff = true;    // Use exponential backoff
```

Change `$exponential_backoff = false` to use fixed 1-hour intervals instead of exponential backoff.
