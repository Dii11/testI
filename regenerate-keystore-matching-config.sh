#!/bin/bash
# Regenerate release keystore matching gradle.properties configuration
# ⚠️  WARNING: Only run this if you haven't published to Play Store yet!

set -e

echo "🔑 Regenerating HopMed Release Keystore"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will replace your existing keystore!"
echo "⚠️  If you've already published to Google Play, DO NOT run this!"
echo ""
read -p "Have you already published this app to Google Play? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ STOP! You must find the original keystore password."
    echo "📧 Contact whoever created the original keystore."
    echo "🔍 Check your password manager, notes, or backup files."
    exit 1
fi

echo ""
read -p "Are you SURE you want to generate a NEW keystore? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Backup existing keystore if it exists
if [ -f "release.keystore" ]; then
    echo "📦 Backing up existing keystore..."
    mv release.keystore "release.keystore.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Configuration from gradle.properties
STORE_PASSWORD="hopmed123"
KEY_PASSWORD="hopmed123"
KEY_ALIAS="hopmed"

echo ""
echo "📝 Keystore Configuration:"
echo "   Alias: $KEY_ALIAS"
echo "   Password: $STORE_PASSWORD"
echo ""

# Generate keystore with exact credentials from gradle.properties
keytool -genkey -v \
  -keystore release.keystore \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=HopMed, OU=Mobile Development, O=LaNewScience, L=Paris, S=IDF, C=FR" \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD"

echo ""
echo "✅ Release keystore generated successfully!"
echo ""
echo "📍 Location: $(pwd)/release.keystore"
echo ""
echo "🔍 Verifying keystore..."
keytool -list -v -keystore release.keystore -storepass "$STORE_PASSWORD" -alias "$KEY_ALIAS" | head -20

echo ""
echo "✅ Keystore verification successful!"
echo ""
echo "📋 Your gradle.properties is already configured correctly:"
echo "   HOPMED_RELEASE_STORE_FILE=../release.keystore"
echo "   HOPMED_RELEASE_KEY_ALIAS=hopmed"
echo "   HOPMED_RELEASE_STORE_PASSWORD=hopmed123"
echo "   HOPMED_RELEASE_KEY_PASSWORD=hopmed123"
echo ""
echo "⚠️  IMPORTANT: Back up this keystore and passwords securely!"
echo "⚠️  You CANNOT publish updates without the SAME keystore!"
echo ""
echo "🚀 You can now run: ./scripts/build-play-store-manual.sh"

