#!/bin/bash

# Skatryk Trainer - Android APK Quick Setup Script
# This script sets up your environment for APK generation

set -e  # Exit on error

echo "🚀 Skatryk Trainer - Android APK Setup"
echo "========================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js"
    exit 1
fi
echo "✅ npm $(npm -v)"

# Check Java
if ! command -v java &> /dev/null; then
    echo "⚠️  Java not found. Capacitor requires JDK 11+"
    echo "   Install from: https://www.oracle.com/java/technologies/downloads/"
    exit 1
fi
JAVA_VERSION=$(java -version 2>&1 | grep -oP 'version "\K[^"]*' | head -1)
echo "✅ Java $JAVA_VERSION"

# Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  ANDROID_HOME not set"
    echo "   Set it: export ANDROID_HOME=/path/to/android-sdk"
    exit 1
fi
echo "✅ ANDROID_HOME=$ANDROID_HOME"

echo ""
echo "📦 Installing npm dependencies..."
npm install

echo ""
echo "🔨 Building web assets..."
npm run build

echo ""
echo "🤖 Setting up Capacitor Android..."
if [ -d "android" ]; then
    echo "   Android platform already exists, skipping setup..."
else
    npm run cap:add:android
fi

echo ""
echo "📱 Syncing with Android platform..."
npm run cap:build:android

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Open Android Studio:"
echo "      npm run cap:open:android"
echo ""
echo "   2. Build Debug APK:"
echo "      - Click Build > Build Bundle(s) / APK(s) > Build APK(s)"
echo "      - APK will be at: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "   3. Build Release APK:"
echo "      - Click Build > Generate Signed Bundle / APK"
echo "      - Select APK, create keystore, build"
echo "      - APK will be at: android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "📚 Documentation:"
echo "   - PWA & APK Guide: see PWA_AND_APK_GENERATION.md"
echo "   - Audit Report: see ANDROID_BUILD_AUDIT.md"
echo "   - App Links Setup: see ANDROID_APP_LINKS_SETUP.md"
echo ""
