# STK Push Logging Verification Checklist

## Overview

The system has **TWO levels of logging** for STK push tests:

1. **Detailed Technical Logs** (in `mpesa_helper.php`)
   - Access token requests/responses
   - M-Pesa API requests/responses
   - Raw HTTP codes and payloads

2. **Event Logs** (in `api.php`)
   - High-level success/failure events
   - Session IDs, phone, amount
   - Credentials source

## Where to Find Logs

### 1. PHP Error Log (Technical Details)

**Location depends on your server:**

```bash
# Determine your log location
php -r "echo ini_get('error_log');"

# Common locations:
/var/log/apache2/error.log          # Apache on Linux
/var/log/nginx/error.log            # Nginx
/var/log/httpd/error_log            # Apache on CentOS
/var/log/php-fpm.log                # PHP-FPM
./storage/logs/error.log            # Some hosting providers
public_html/error_log               # cPanel
```

**Search for the logs:**
```bash
# View real-time logs while testing
tail -f /var/log/apache2/error.log | grep -E "MPESA|STK|stk_push"

# View last 100 lines with M-Pesa activity
grep -E "MPESA|STK|stk_push" /var/log/apache2/error.log | tail -100

# Count all STK activities today
grep "stk_push\|STK PUSH" /var/log/apache2/error.log | wc -l
```

### 2. Application Event Log (Database)

The system also logs to the `activity_log` or similar table:

**Query from database:**
```sql
-- Check if events table exists
SELECT * FROM activity_log 
WHERE event_type LIKE '%mpesa%' 
ORDER BY created_at DESC 
LIMIT 20;

-- Or check for stk_push events
SELECT * FROM activity_log 
WHERE event_type IN ('mpesa_stk_push_initiated', 'mpesa_stk_push_failed') 
ORDER BY created_at DESC 
LIMIT 20;
```

## Step-by-Step Verification

### Step 1: Prepare to Capture Logs

Before running the test, open a terminal window ready to watch logs:

```bash
# Terminal 1: Watch for STK push logs
tail -f /var/log/apache2/error.log | grep -E "STK|stk_push|MPESA"
```

Keep this terminal open while you run the test.

### Step 2: Run the STK Push Test

In the Admin Dashboard:
1. Click **Settings** (left sidebar)
2. Scroll to **M-Pesa Configuration**
3. Verify credentials are set, click **Save M-Pesa Settings**
4. Scroll to **M-Pesa STK Push Test** section
5. Phone: `254722241745`
6. Amount: `5`
7. Click **"Send STK Push"** button
8. Wait for response (should see success card)

### Step 3: Check the Logs

In the terminal watching logs, you should see:

**Expected Log Sequence:**

```
[MPESA TOKEN REQUEST] Environment: sandbox, URL: https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials, Key: [MASKED]...
[MPESA TOKEN RESPONSE] HTTP 200, Response: {"access_token":"...","expires_in":3599}
[MPESA TOKEN SUCCESS] Token obtained: [MASKED]...[MASKED]
[STK PUSH INIT] Starting STK push initiation
[STK PUSH INIT] Phone: 254722241745, Amount: 5, Reference: admin_test
[STK PUSH INIT] Access token obtained, Shortcode: [SHORTCODE], Environment: sandbox
[STK PUSH INIT] Callback URL: https://trainercoachconnect.com/c2b_callback.php
[STK PUSH REQUEST] URL: https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
[STK PUSH PAYLOAD] {"BusinessShortCode":"...","Password":"...","Timestamp":"...","TransactionType":"CustomerPayBillOnline","Amount":5,"PartyA":"254722241745",...}
[STK PUSH AUTH] Using access token: [MASKED]...[MASKED]
[STK PUSH RESPONSE] HTTP 200, Body: {"CheckoutRequestID":"ws_CO_...","MerchantRequestID":"...","ResponseCode":"0","ResponseDescription":"Success. Request accepted for processing"}
[STK PUSH SUCCESS] CheckoutRequestID: ws_CO_..., MerchantRequestID: ..., ResponseCode: 0
```

## Verification Checklist

### Visual Verification (Admin Dashboard)

After clicking "Send STK Push", you should see:

- [ ] **Success notification** at top of page
- [ ] **Green success box** showing:
  - [ ] Phone: 254722241745
  - [ ] Amount: KES 5
  - [ ] Checkout Request ID: (NOT "N/A" - actual value like "ws_CO_...")
  - [ ] Merchant Request ID: (NOT "N/A" - actual value)
  - [ ] Response Code: (NOT "N/A" - value like "0")
  - [ ] Description: (NOT "N/A" - actual M-Pesa message)

### Log Verification (Terminal/Server)

Check that ALL these logs appear (in order):

- [ ] `[MPESA TOKEN REQUEST]` - Token request initiated
- [ ] `[MPESA TOKEN RESPONSE]` - Token response received (HTTP 200)
- [ ] `[MPESA TOKEN SUCCESS]` - Token was obtained successfully
- [ ] `[STK PUSH INIT]` - STK push process started
- [ ] `[STK PUSH INIT]` - Phone and amount logged
- [ ] `[STK PUSH INIT]` - Callback URL logged
- [ ] `[STK PUSH REQUEST]` - API endpoint logged
- [ ] `[STK PUSH PAYLOAD]` - Full request payload visible
- [ ] `[STK PUSH AUTH]` - Access token confirmed
- [ ] `[STK PUSH RESPONSE]` - Response received (HTTP 200)
- [ ] `[STK PUSH SUCCESS]` - Successful completion with IDs

### Database Verification (Optional)

Check the STK push session was recorded:

```sql
SELECT * FROM stk_push_sessions 
ORDER BY created_at DESC 
LIMIT 1;
```

Expected columns should have:
- `session_id`: stk_[unique_id]
- `phone_number`: 254722241745
- `amount`: 5.00
- `account_reference`: admin_test
- `checkout_request_id`: ws_CO_...
- `merchant_request_id`: actual value (not null)
- `status`: initiated
- `created_at`: current timestamp

## Troubleshooting

### Case 1: No Logs Appearing

**Problem**: You don't see any logs in the terminal

**Solutions**:
1. Check log file exists:
   ```bash
   ls -la /var/log/apache2/error.log
   ```

2. Check permissions:
   ```bash
   ls -la /var/log/apache2/ | grep error
   # Should show: -rw-r--r--
   ```

3. Verify PHP error logging is enabled:
   ```bash
   php -r "echo 'error_log = ' . ini_get('error_log');"
   php -r "echo 'error_reporting = ' . ini_get('error_reporting');"
   ```

4. Try different log location:
   ```bash
   tail -f /var/log/php-fpm.log
   tail -f /var/log/httpd/error_log
   ```

5. Check if logs are being rotated:
   ```bash
   ls -la /var/log/apache2/error.log*
   # Check if error.log.1, error.log.2 exist
   ```

### Case 2: Admin Dashboard Shows Success but No Logs

**Possible Causes:**
- Vite dev server is being used instead of PHP backend
- Logs are going to a different file
- Log rotation is happening in background

**Check vite.config.ts is working (dev mode):**
```bash
grep "STK PUSH" /var/log/apache2/error.log
# If nothing, your dev server might be intercepting it
```

### Case 3: Logs Show HTTP 401 (Unauthorized)

**Problem**: `[MPESA TOKEN ERROR] HTTP 401 - {"error":"invalid_grant"...}`

**Solution:**
1. Consumer Key is wrong
2. Consumer Secret is wrong
3. Credentials not saved to database

**Fix:**
```bash
# Go to Admin Dashboard → Settings → M-Pesa Configuration
# Verify all fields are correct
# Click "Save M-Pesa Settings"
# Try test again
```

### Case 4: Logs Show HTTP 400 (Bad Request)

**Problem**: `[STK PUSH FAIL] HTTP 400 - ...`

**Check in logs:**
1. Phone number format - should be 254...
2. Amount >= 5
3. Shortcode configured
4. Passkey configured

### Case 5: Logs Show Token Success but No STK Push Logs

**Problem**: Token obtained but no `[STK PUSH INIT]` logs

**Cause:**
- PHP error between token and STK push
- Check for PHP warnings/notices

**Debug:**
```bash
# Look for PHP errors
grep -B5 "STK PUSH SUCCESS\|STK PUSH FAIL" /var/log/apache2/error.log | head -20

# Check for warnings
grep "Warning\|Fatal" /var/log/apache2/error.log | tail -20
```

## Understanding Log Entries

### Token Request Entry
```
[MPESA TOKEN REQUEST] Environment: sandbox, URL: https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials, Key: BXsx...
```
- Shows OAuth endpoint being called
- Shows environment (sandbox or production)
- Consumer key is masked (security)

### Token Response Entry
```
[MPESA TOKEN RESPONSE] HTTP 200, Response: {"access_token":"eyJhbGc...","expires_in":3599}
```
- HTTP 200 = success
- Shows token is in response
- expires_in = 3599 seconds (about 1 hour)

### STK Push Payload Entry
```
[STK PUSH PAYLOAD] {"BusinessShortCode":"174379","Password":"MDAwMDAwMDAwMDAxMzk2MzoyMDI1MDIxMDIwNDAxOA==",...}
```
- **BusinessShortCode**: Your M-Pesa shortcode
- **Password**: base64(shortcode + passkey + timestamp)
- **Amount**: 5
- **PartyA**: 254722241745 (phone)
- **CallBackURL**: Where M-Pesa sends results

### STK Push Response Entry
```
[STK PUSH SUCCESS] CheckoutRequestID: ws_CO_28022025204018854747845, MerchantRequestID: 28022-2045000-1, ResponseCode: 0
```
- **CheckoutRequestID**: Unique session ID (saved in DB)
- **MerchantRequestID**: M-Pesa's internal ID
- **ResponseCode**: 0 = Success

## Quick Log Filtering Commands

```bash
# Just today's STK activities
grep "STK PUSH\|stk_push" /var/log/apache2/error.log | grep "$(date +%b\ %d)"

# Count by status
echo "Successful: $(grep -c 'STK PUSH SUCCESS' /var/log/apache2/error.log)"
echo "Failed: $(grep -c 'STK PUSH FAIL' /var/log/apache2/error.log)"
echo "Token Errors: $(grep -c 'MPESA TOKEN ERROR' /var/log/apache2/error.log)"

# Show last 5 complete flows
grep "STK PUSH SUCCESS" /var/log/apache2/error.log | tail -5

# Show all errors
grep "ERROR\|FAIL" /var/log/apache2/error.log | grep -E "MPESA|STK|stk_push"

# Follow logs in real-time
tail -f /var/log/apache2/error.log | grep -E "MPESA|STK|stk_push" --line-buffered
```

## Performance Expectations

When you click "Send STK Push":

1. **Token Request** → HTTP 200 with access token (1-2 seconds)
2. **STK Push Request** → HTTP 200 with CheckoutRequestID (1-2 seconds)
3. **Admin Dashboard displays response** (instant)
4. **Total time**: 2-4 seconds

If taking longer:
- Check network latency to M-Pesa servers
- Check server CPU/memory usage
- Verify curl timeout is 10 seconds (in mpesa_helper.php)

## Success Indicators

✅ **System is logging correctly if you see ALL of these:**

1. **In Admin Dashboard:**
   - Green success notification appears
   - Response shows actual values (not N/A)
   - Session ID is saved to database

2. **In PHP Error Log:**
   - `[MPESA TOKEN SUCCESS]` appears
   - `[STK PUSH SUCCESS]` appears
   - Response codes are visible
   - No ERROR entries

3. **In Database:**
   - New row in `stk_push_sessions` table
   - `checkout_request_id` populated
   - `merchant_request_id` populated
   - `status` = 'initiated'

## Next Steps

1. **Run the test** following "Step-by-Step Verification" above
2. **Check the logs** using the commands provided
3. **Verify all checkboxes** in the checklist
4. **Document any errors** you see for debugging
5. **Monitor production** - Keep these logs for 30 days minimum

---

## Files Modified for Logging

- `mpesa_helper.php` - Detailed technical logging
- `api.php` - High-level event logging (already in place)
- `vite.config.ts` - STK endpoint logging (if using dev server)

## References

- **Log Location**: Determined by `php -i | grep error_log`
- **Event Logging Function**: `logPaymentEvent()` in `api.php`
- **Helper Logging**: `error_log()` in `mpesa_helper.php`
- **Database Table**: `stk_push_sessions` stores all sessions
