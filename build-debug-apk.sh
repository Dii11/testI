#!/bin/bash

# Simple Android Debug APK build script (bypasses Sentry issues)
# This script builds a debug APK that you can use for testing

set -e

echo "🔨 Building HopMed Android Debug APK..."

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
    echo "❌ Error: app.json not found. Please run this script from the project root."
    exit 1
fi

# Check if Android directory exists
if [ ! -d "android" ]; then
    echo "❌ Error: android directory not found. Please run 'npx expo prebuild --platform android' first."
    exit 1
fi

# Go to Android directory
cd android

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean

# Build debug APK (this should bypass Sentry issues)
echo "🔨 Building debug APK..."
./gradlew assembleDebug

# Check if APK was built successfully
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo ""
    echo "✅ Debug APK built successfully!"
    echo "📱 APK path: $APK_PATH"
    echo "📏 APK size: $APK_SIZE"
    echo ""
    echo "🎯 This is a DEBUG APK that can be used for testing:"
    echo "1. Install it directly on Android devices (enable 'Install from unknown sources')"
    echo "2. Share the APK file with your testers"
    echo "3. Testers can install it directly on their devices"
    echo ""
    echo "⚠️  Note: This is a debug build, not a release build"
    echo "💡 For Play Store distribution, you'll need to resolve the Sentry configuration first"
    echo ""
    echo "📋 How testers can install:"
    echo "- Enable 'Install from unknown sources' in Android settings"
    echo "- Download the APK file: $APK_PATH"
    echo "- Open the APK file to install"
    echo ""
    echo "🔧 To fix Sentry for release builds later:"
    echo "1. Set up proper Sentry authentication"
    echo "2. Restore the Sentry configuration files"
    echo "3. Use the release build script"
else
    echo "❌ Error: Debug APK not found at expected path: $APK_PATH"
    exit 1
fi

echo "🎉 Debug build completed successfully!"
echo "📱 Your testers can now install and test the app!"
