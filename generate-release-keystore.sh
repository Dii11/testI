#!/bin/bash
# Generate release keystore for HopMed Android

set -e

echo "🔑 Generating release keystore for HopMed..."

# Prompt for keystore details
read -p "Enter keystore password: " -s STORE_PASSWORD
echo
read -p "Enter key password: " -s KEY_PASSWORD
echo
read -p "Enter your name: " CN
read -p "Enter your organization: " O
read -p "Enter your organization unit: " OU
read -p "Enter your city: " L
read -p "Enter your state/province: " S
read -p "Enter your country code (2 letters): " C

# Generate keystore
keytool -genkey -v \
  -keystore release.keystore \
  -alias release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=$CN, OU=$OU, O=$O, L=$L, S=$S, C=$C" \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD"

echo "✅ Release keystore generated: release.keystore"
echo ""
echo "📝 Add these properties to android/gradle.properties:"
echo "HOPMED_RELEASE_STORE_FILE=../release.keystore"
echo "HOPMED_RELEASE_KEY_ALIAS=release"
echo "HOPMED_RELEASE_STORE_PASSWORD=$STORE_PASSWORD"
echo "HOPMED_RELEASE_KEY_PASSWORD=$KEY_PASSWORD"
echo ""
echo "⚠️  Keep these credentials secure and back them up!"
