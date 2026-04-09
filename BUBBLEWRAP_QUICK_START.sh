#!/bin/bash

# Bubblewrap/TWA Quick Start for Skatryk Trainer
# This script automates the initial TWA setup

set -e

echo "🚀 Skatryk Trainer - Bubblewrap/TWA Build Assistant"
echo "=================================================="
echo ""

# Step 1: Check prerequisites
echo "✅ Checking prerequisites..."

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

if ! command -v java &> /dev/null; then
    echo "❌ Java not found. Please install JDK 11+."
    echo "   Download from: https://adoptium.net/"
    exit 1
fi

if ! command -v keytool &> /dev/null; then
    echo "❌ keytool not found. Please install JDK properly."
    exit 1
fi

echo "✅ Node.js, Java, and keytool found"
echo ""

# Step 2: Install Bubblewrap CLI
echo "📦 Installing Bubblewrap CLI..."
npm install -g @bubblewrap/cli

echo "✅ Bubblewrap installed"
echo ""

# Step 3: Build web assets
echo "🔨 Building web assets..."
npm run build

echo "✅ Web build complete"
echo ""

# Step 4: Check if keystore exists
echo "🔐 Checking for signing keystore..."
KEYSTORE_PATH="$HOME/skatryk-trainer.jks"

if [ -f "$KEYSTORE_PATH" ]; then
    echo "✅ Keystore found at $KEYSTORE_PATH"
else
    echo "⚠️  No keystore found. Let's create one."
    echo ""
    echo "Follow the prompts below to generate your signing key:"
    echo "(Save this file and password securely - you'll need it for app updates)"
    echo ""
    
    keytool -genkeypair -v \
        -keystore "$KEYSTORE_PATH" \
        -alias skatryk-trainer-key \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000
    
    echo "✅ Keystore created at $KEYSTORE_PATH"
fi

echo ""

# Step 5: Offer to initialize TWA
echo "🎯 Initializing Trusted Web Activity..."
echo ""
echo "This will create a twa-build/ folder with Android project files."
echo "Proceed? (y/n)"
read -r response

if [[ "$response" == "y" || "$response" == "Y" ]]; then
    npm run twa:init
    echo "✅ TWA initialized"
    echo ""
    
    # Step 6: Get SHA-256 fingerprint
    echo "🔑 Extracting SHA-256 fingerprint from keystore..."
    echo ""
    echo "Please enter your keystore password (created above):"
    read -s KEYSTORE_PASSWORD
    
    FINGERPRINT=$(keytool -list -v -keystore "$KEYSTORE_PATH" \
        -alias skatryk-trainer-key \
        -storepass "$KEYSTORE_PASSWORD" 2>/dev/null | grep "SHA-256:" | awk '{print $NF}')
    
    if [ -z "$FINGERPRINT" ]; then
        echo "❌ Failed to extract fingerprint. Check your password."
        exit 1
    fi
    
    # Remove colons from fingerprint
    FINGERPRINT_CLEAN=$(echo "$FINGERPRINT" | sed 's/://g')
    
    echo "✅ SHA-256 Fingerprint:"
    echo "   $FINGERPRINT"
    echo ""
    echo "Clean format (for assetlinks.json):"
    echo "   $FINGERPRINT_CLEAN"
    echo ""
    
    # Step 7: Update assetlinks.json
    echo "📝 Updating assetlinks.json..."
    
    cat > public/.well-known/assetlinks.json << EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "co.skatryk.trainer",
      "sha256_cert_fingerprints": [
        "$FINGERPRINT_CLEAN"
      ]
    }
  }
]
EOF
    
    echo "✅ assetlinks.json updated"
    echo ""
    
    # Step 8: Build debug APK
    echo "🔨 Building debug APK for testing..."
    npm run twa:build
    
    echo "✅ Debug APK built at: twa-build/dist/app-debug.apk"
    echo ""
    
    echo "📱 Next steps:"
    echo "1. Test the debug APK on your device:"
    echo "   adb install twa-build/dist/app-debug.apk"
    echo ""
    echo "2. If testing is successful, build release APK:"
    echo "   npm run twa:build:release"
    echo ""
    echo "3. Deploy assetlinks.json to:"
    echo "   https://trainercoachconnect.com/.well-known/assetlinks.json"
    echo ""
    echo "4. Upload to Google Play Store"
    echo ""
    echo "📖 For detailed instructions, see: BUBBLEWRAP_BUILD_GUIDE.md"
else
    echo "Skipped TWA initialization"
    echo ""
    echo "To initialize later, run:"
    echo "  npm run twa:init"
fi

echo ""
echo "✅ Setup complete!"
