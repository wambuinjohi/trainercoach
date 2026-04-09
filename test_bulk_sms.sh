#!/bin/bash

# Bulk SMS Testing Script using curl
# Tests all SMS functionality with Onfonmedia integration

API_URL="http://localhost/api.php"  # Update this to your actual API URL

echo "=== BULK SMS TESTING WITH CURL ==="
echo ""

# TEST 1: Save SMS Credentials
echo "TEST 1: Saving SMS Credentials"
echo "=============================="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "settings_sms_save",
    "sms_settings": {
      "sms_api_key": "WeO21uB08jalUFdrzHDofvV3hnbR4t7qNX9LKCY5E6imJwIZ",
      "sms_client_id": "trainerltd",
      "sms_access_key": "trainerltd",
      "sms_sender_id": "Skatryk",
      "enabled": true
    }
  }' | jq .
echo ""
echo ""

# TEST 2: Get SMS Settings
echo "TEST 2: Retrieving SMS Settings"
echo "==============================="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"action": "settings_sms_get"}' | jq .
echo ""
echo ""

# TEST 3: Send Bulk SMS to Specific Phone Numbers
echo "TEST 3: Send Bulk SMS to Specific Phone Numbers"
echo "==============================================="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sms_send_manual",
    "message": "Test bulk SMS from Trainer Coach Connect. This SMS is being sent to verify bulk SMS functionality.",
    "phone_numbers": [
      "254712345678",
      "+254712345679",
      "0712345680"
    ]
  }' | jq .
echo ""
echo ""

# TEST 4: Send to All Users
echo "TEST 4: Send SMS to All Users (if any exist)"
echo "============================================="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sms_send_manual",
    "message": "Hello from Trainer Coach Connect. This is a system notification.",
    "user_group": "all"
  }' | jq .
echo ""
echo ""

# TEST 5: Send to All Trainers
echo "TEST 5: Send SMS to All Trainers"
echo "================================"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sms_send_manual",
    "message": "Hello trainers! This is a notification for all trainers.",
    "user_group": "trainers"
  }' | jq .
echo ""
echo ""

# TEST 6: Send to All Clients
echo "TEST 6: Send SMS to All Clients"
echo "==============================="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sms_send_manual",
    "message": "Hello clients! This is a notification for all clients.",
    "user_group": "clients"
  }' | jq .
echo ""
echo ""

# TEST 7: Get SMS Logs
echo "TEST 7: Retrieve SMS Logs"
echo "========================="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sms_logs_get",
    "limit": 20,
    "status": "all",
    "event_type": "all"
  }' | jq .
echo ""
echo ""

# TEST 8: Create SMS Template
echo "TEST 8: Create SMS Template"
echo "==========================="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sms_templates_save",
    "template": {
      "name": "test_template",
      "event_type": "custom",
      "template_text": "Hello {{user_name}}, this is a test template for {{event_name}}.",
      "active": true
    }
  }' | jq .
echo ""
echo ""

# TEST 9: Get All SMS Templates
echo "TEST 9: Retrieve All SMS Templates"
echo "=================================="
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"action": "sms_templates_get"}' | jq .
echo ""
echo ""

echo "=== TESTING COMPLETE ==="
