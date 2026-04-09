# STK Push Testing & Logging Guide

## Overview

The M-Pesa STK push flow has been enhanced with comprehensive logging at every step, including access token generation, request/response details, and error messages.

## Logging Architecture

### Log Levels & Format

All logs use PHP's `error_log()` function with standardized prefixes for easy filtering:

```
[MPESA TOKEN REQUEST]  - OAuth token request initialization
[MPESA TOKEN RESPONSE] - OAuth token response received
[MPESA TOKEN SUCCESS]  - Access token successfully obtained
[MPESA TOKEN ERROR]    - Token generation failed
[STK PUSH INIT]        - STK push initiation started
[STK PUSH AUTH]        - Authorization header being sent
[STK PUSH REQUEST]     - STK push API endpoint being called
[STK PUSH PAYLOAD]     - Complete STK push request payload
[STK PUSH RESPONSE]    - M-Pesa API response received
[STK PUSH FAIL]        - STK push request failed
[STK PUSH SUCCESS]     - STK push successfully initiated
[STK QUERY]            - Query operation started
[STK QUERY REQUEST]    - Query API endpoint being called
[STK QUERY PAYLOAD]    - Query request payload
[STK QUERY AUTH]       - Authorization for query request
[STK QUERY RESPONSE]   - Query response received
[STK QUERY FAIL]       - Query operation failed
[STK QUERY SUCCESS]    - Query operation successful
```

## Finding the Logs

### Option 1: PHP Error Log (Recommended)

The primary location depends on your PHP configuration:

#### Check PHP Configuration
```bash
php -i | grep "error_log"
# or
php -r "echo ini_get('error_log');"
```

Common locations:
- **Linux/Apache**: `/var/log/apache2/error.log` or `/var/log/httpd/error_log`
- **Nginx**: `/var/log/nginx/error.log`
- **PHP-FPM**: `/var/log/php-fpm.log`
- **Development/Xampp**: `php/logs/php_error.log`
- **cPanel**: `public_html/error_log`

#### View Logs in Real-Time
```bash
# Linux/Mac - Follow the log file
tail -f /var/log/apache2/error.log | grep MPESA

# Or grep for specific operations
grep "STK PUSH" /var/log/apache2/error.log
```

### Option 2: Browser Developer Tools

1. Open Admin Dashboard → M-Pesa STK Push Test
2. Press F12 to open Developer Tools
3. Go to **Network** tab
4. Click "Send STK Push"
5. Click on `/api.php` request
6. Check **Console** tab for any JavaScript errors
7. The PHP logs will appear in the server logs (see Option 1)

### Option 3: Direct File Access (if available)

If you have SSH/FTP access:
```bash
# Connect via SSH and view logs
ssh user@your-server.com
tail -n 100 /var/log/apache2/error.log
```

## Testing STK Push with Logging

### Test 1: Admin Dashboard STK Test (Recommended)

This is the easiest way to test with full logging:

1. **Navigate to Settings**
   - Click Admin Dashboard
   - Click "Settings" in left sidebar
   - Scroll to "M-Pesa Configuration" section

2. **Verify Credentials**
   - Consumer Key: Should be set
   - Consumer Secret: Should be set (masked)
   - Passkey: Should be set (masked)
   - Initiator Name: Set to your name
   - Security Credential: Set to `gichukiwairua` (as configured)
   - Shortcode: Should be set
   - Click "Save M-Pesa Settings"

3. **Run STK Push Test**
   - Scroll down to "M-Pesa STK Push Test" section
   - Phone Number: `254722241745` (or your test number)
   - Amount (KES): `5` (minimum is 5)
   - Click "Send STK Push" button

4. **Check Logs**
   - Open your server logs (see "Finding the Logs" above)
   - You should see this flow:
     ```
     [MPESA TOKEN REQUEST] Environment: sandbox, URL: https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials, Key: [CONSUMER_KEY_FIRST_4]...
     [MPESA TOKEN RESPONSE] HTTP 200, Response: {"access_token":"xxxxx...","expires_in":3599}
     [MPESA TOKEN SUCCESS] Token obtained: xxxxx...xxxxx
     [STK PUSH INIT] Starting STK push initiation
     [STK PUSH INIT] Phone: 254722241745, Amount: 5, Reference: admin_test
     [STK PUSH INIT] Access token obtained, Shortcode: [SHORTCODE], Environment: sandbox
     [STK PUSH INIT] Callback URL: https://trainercoachconnect.com/c2b_callback.php
     [STK PUSH REQUEST] URL: https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
     [STK PUSH PAYLOAD] {"BusinessShortCode":"...", "Password":"...", ...}
     [STK PUSH AUTH] Using access token: xxxxx...xxxxx
     [STK PUSH RESPONSE] HTTP 200, Body: {"CheckoutRequestID":"ws_...", "MerchantRequestID":"..."}
     [STK PUSH SUCCESS] CheckoutRequestID: ws_..., MerchantRequestID: ..., ResponseCode: 0
     ```

5. **Verify Admin Dashboard Response**
   - After clicking "Send STK Push", you should see a success card with:
     - Phone: 254722241745
     - Amount: KES 5
     - Checkout Request ID: (actual value, not N/A)
     - Merchant Request ID: (actual value, not N/A)
     - Response Code: 0 (or other valid code)
     - Description: (M-Pesa response description)

### Test 2: Booking Form Integration

1. **Create a Booking with M-Pesa**
   - Navigate to client/trainer side
   - Create or search for a booking
   - Select M-Pesa as payment method
   - This will trigger:
     - `/payments/mpesa/stk-initiate` endpoint (dev mode) or `/api.php` (prod)
     - Access token request
     - STK push request

2. **Check Logs for Full Flow**
   ```
   [STK PUSH INIT] Starting STK push initiation
   [STK PUSH INIT] Phone: 254xxxxxxxxx, Amount: [AMOUNT], Reference: [BOOKING_ID]
   ...
   [STK QUERY] Starting query for CheckoutRequestID: ws_...
   [MPESA TOKEN REQUEST] ...
   [STK QUERY REQUEST] URL: https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query
   [STK QUERY PAYLOAD] {"BusinessShortCode":"...", "CheckoutRequestID":"ws_..."}
   [STK QUERY RESPONSE] HTTP 200, Body: {"ResultCode":0, "ResultDesc":"The service request is being processed"}
   [STK QUERY SUCCESS] ResultCode: 0, ResultDesc: The service request is being processed
   ```

### Test 3: Error Scenarios

**Wrong Credentials**
- Update Security Credential to incorrect value
- Try to send STK push
- Expected logs:
  ```
  [MPESA TOKEN REQUEST] ...
  [MPESA TOKEN ERROR] HTTP 401 - {"error":"invalid_grant","error_description":"The OAuth client was not recognised"}
  ```

**Missing Phone Number**
- Leave phone empty in STK test
- Expected frontend error before logs

**Invalid Amount**
- Set amount to less than 5 KES
- Expected frontend validation error

## Understanding the Logs

### Access Token Section
```
[MPESA TOKEN REQUEST] Environment: sandbox, URL: https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials, Key: BXsx...
```
- Shows which environment (sandbox/production) is being used
- Consumer key is shown with only first 4 characters for security
- This step must succeed before STK push can proceed

### STK Push Request Section
```
[STK PUSH PAYLOAD] {"BusinessShortCode":"174379","Password":"MDAwMDAwMDAwMDAxMzk2MzoyMDI1MDIxMDIwNDAxOA==","Timestamp":"20250210204018",...}
```
- Shows complete payload being sent to M-Pesa
- Password is base64-encoded (contains shortcode + passkey + timestamp)
- All required fields should be present

### STK Push Response Section
```
[STK PUSH SUCCESS] CheckoutRequestID: ws_CO_28022025204018854747845, MerchantRequestID: 28022-2045000-1, ResponseCode: 0
```
- `CheckoutRequestID`: Unique identifier for this STK push session (saved in database)
- `MerchantRequestID`: M-Pesa's internal request ID
- `ResponseCode: 0`: Success code

## Response Codes Reference

### STK Push Response Codes
```
0        = Success
1        = Insufficient funds
1032     = User cancelled transaction
1037     = Transaction timeout
100      = Generic error
```

### Query Response Codes
```
0        = Success (transaction completed)
1        = Insufficient funds
1032     = User cancelled
1037     = Transaction timeout
```

## Troubleshooting

### No Logs Appearing?

1. **Check log file permissions**
   ```bash
   ls -la /var/log/apache2/error.log
   # Should show: -rw-r--r--
   ```

2. **Check PHP error logging is enabled**
   ```bash
   php -r "echo ini_get('error_reporting');"
   # Should show: 32767 (or similar high number)
   ```

3. **Verify log rotation isn't hiding new logs**
   ```bash
   tail -f /var/log/apache2/error.log  # Live follow
   ```

### Logs Show HTTP 401 (Unauthorized)?

- Consumer Key or Secret is incorrect
- Verify in Admin Settings → M-Pesa Configuration
- Ensure they match M-Pesa portal credentials

### Logs Show HTTP 400 (Bad Request)?

- Check the payload format in logs
- Verify phone number format: `254...` (country code included)
- Verify amount is >= 5 KES

### Logs Show HTTP 500 (Server Error)?

- M-Pesa servers may be down (check M-Pesa status)
- CURL timeout might be too short
- Network connectivity issue from server

## Extracting Useful Data from Logs

### Get Today's STK Push Activity
```bash
grep "STK PUSH" /var/log/apache2/error.log | grep "$(date +%b\ %d)"
```

### Get All Failed Attempts
```bash
grep "STK PUSH FAIL\|STK PUSH ERROR\|MPESA TOKEN ERROR" /var/log/apache2/error.log
```

### Get Access Token Details
```bash
grep "MPESA TOKEN" /var/log/apache2/error.log
```

### Get Successful STK Pushes with IDs
```bash
grep "STK PUSH SUCCESS" /var/log/apache2/error.log
```

### Create a Log Summary
```bash
# Count successful vs failed
echo "=== STK PUSH SUMMARY ==="
echo "Successful: $(grep -c 'STK PUSH SUCCESS' /var/log/apache2/error.log)"
echo "Failed: $(grep -c 'STK PUSH FAIL' /var/log/apache2/error.log)"
echo "Token Errors: $(grep -c 'MPESA TOKEN ERROR' /var/log/apache2/error.log)"
```

## Performance Notes

### Expected Response Times
- OAuth Token Request: 1-2 seconds
- STK Push Initiation: 1-2 seconds
- STK Query: 1-2 seconds
- **Total time for test**: 2-4 seconds

If responses are slower:
- Check network latency to M-Pesa servers
- Verify PHP curl timeout settings (currently set to 10s)
- Check server CPU/memory usage

## Security Considerations

### What's Logged
- Access tokens (first 20 + last 10 chars only, masked)
- Consumer key (first 4 chars only, masked)
- Full request payloads (for debugging)
- M-Pesa API responses

### What's NOT Logged
- Consumer secret (never logged)
- Full access token (partially masked)
- Payment PIN or sensitive user data
- Database credentials

### Log Retention
- Configure log rotation to prevent disk space issues
- Archive logs older than 30 days
- Example logrotate config:
  ```
  /var/log/apache2/error.log {
      daily
      rotate 30
      compress
      missingok
      notifempty
  }
  ```

## Next Steps

1. **Run Admin STK Test** - Verify basic functionality
2. **Check logs** - Confirm all steps are logged
3. **Test with real phone** - Verify SMS prompt appears
4. **Monitor in production** - Keep logs for debugging
5. **Set up log aggregation** - Consider Datadog, LogRocket, etc.

---

## Quick Reference

**Files Modified:**
- `mpesa_helper.php` - Enhanced logging throughout

**Log Prefix Filters:**
```bash
# Token only
grep "MPESA TOKEN" /var/log/apache2/error.log

# STK Push only
grep "STK PUSH" /var/log/apache2/error.log

# STK Query only
grep "STK QUERY" /var/log/apache2/error.log

# All M-Pesa
grep -E "MPESA|STK" /var/log/apache2/error.log
```

**Success Indicators:**
- `[MPESA TOKEN SUCCESS]` appears in logs
- `[STK PUSH SUCCESS]` with valid CheckoutRequestID
- Admin dashboard shows response data (not N/A values)
- Mobile phone receives STK push prompt
