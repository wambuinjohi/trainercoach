#!/bin/bash

# Reset test user passwords script
# Usage: bash scripts/reset_passwords.sh <api_url>
# Example: bash scripts/reset_passwords.sh https://trainercoachconnect.com/api.php

API_URL="${1:-https://trainercoachconnect.com/api.php}"

echo "🔄 Resetting user passwords via API: $API_URL"
echo "📝 Resetting passwords for test users to: Pass1234"
echo ""

# Call the API
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"reset_passwords"}' \
  "$API_URL")

# Parse response
STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
MESSAGE=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" = "error" ]; then
  echo "❌ Error: $MESSAGE"
  exit 1
fi

echo "✅ Success: $MESSAGE"
echo ""
echo "✨ Password reset complete!"
echo "Test user credentials:"
echo "  - admin@skatryk.co.ke / Pass1234"
echo "  - trainer@skatryk.co.ke / Pass1234"
echo "  - client@skatryk.co.ke / Pass1234"

exit 0
