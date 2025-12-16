#!/bin/bash

# iOS Build Fix Script (JavaScriptCore Version)
# Fixes "Redefinition of module 'react_runtime'" error while keeping JSC engine

set -e  # Exit on error

echo "🔧 iOS Build Fix (JSC) - Starting cleanup and regeneration..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Update app.config.js to ensure JSC is set
echo "${YELLOW}Step 1/7: Ensuring JSC configuration in app.config.js...${NC}"
# The file should already have jsEngine: 'jsc' - this is just verification
if grep -q "jsEngine: 'jsc'" app.config.js; then
  echo "✅ JSC already configured in app.config.js"
else
  echo "${RED}❌ Warning: JSC not found in app.config.js - please verify configuration${NC}"
fi

# Step 2: Clean iOS build artifacts
echo ""
echo "${YELLOW}Step 2/7: Cleaning iOS build artifacts...${NC}"
if [ -d "ios/build" ]; then
  rm -rf ios/build
  echo "✅ Removed ios/build"
fi

if [ -d "ios/Pods" ]; then
  rm -rf ios/Pods
  echo "✅ Removed ios/Pods"
fi

if [ -f "ios/Podfile.lock" ]; then
  rm -f ios/Podfile.lock
  echo "✅ Removed ios/Podfile.lock"
fi

# Step 3: Clean Xcode derived data
echo ""
echo "${YELLOW}Step 3/7: Cleaning Xcode derived data...${NC}"
rm -rf ~/Library/Developer/Xcode/DerivedData/HopMed-* || true
echo "✅ Cleared Xcode DerivedData"

# Step 4: Clean CocoaPods cache
echo ""
echo "${YELLOW}Step 4/7: Cleaning CocoaPods cache...${NC}"
cd ios
pod cache clean --all 2>/dev/null || echo "⚠️  CocoaPods cache clean skipped"
cd ..
echo "✅ CocoaPods cache cleared"

# Step 5: Clean Expo/Metro cache
echo ""
echo "${YELLOW}Step 5/7: Cleaning Expo/Metro cache...${NC}"
rm -rf node_modules/.cache
rm -rf .expo
rm -rf $TMPDIR/metro-* $TMPDIR/haste-* 2>/dev/null || true
echo "✅ Expo/Metro cache cleared"

# Step 6: Regenerate iOS project with expo prebuild --clean
echo ""
echo "${YELLOW}Step 6/7: Regenerating iOS project with JSC enabled...${NC}"
npx expo prebuild --platform ios --clean

# Verify the fix
if grep -q '"expo.jsEngine": null' ios/Podfile.properties.json || ! grep -q '"expo.jsEngine"' ios/Podfile.properties.json; then
  echo "${GREEN}✅ JSC correctly configured (jsEngine: null or absent in Podfile.properties.json)${NC}"
elif grep -q '"expo.jsEngine": "jsc"' ios/Podfile.properties.json; then
  echo "${GREEN}✅ JSC explicitly configured in Podfile.properties.json${NC}"
else
  echo "${YELLOW}⚠️  Note: Podfile.properties.json configuration:${NC}"
  grep "expo.jsEngine" ios/Podfile.properties.json || echo "  (jsEngine not specified - defaults to JSC)"
fi

# Step 7: Install pods
echo ""
echo "${YELLOW}Step 7/7: Installing CocoaPods dependencies...${NC}"
cd ios
bundle exec pod install --repo-update || pod install --repo-update
cd ..
echo "${GREEN}✅ CocoaPods installation complete${NC}"

# Final verification
echo ""
echo "${GREEN}========================================${NC}"
echo "${GREEN}✅ iOS Build Fix Complete (JSC)!${NC}"
echo "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Run: ${YELLOW}npm run ios${NC} or ${YELLOW}npx expo run:ios${NC}"
echo ""
echo "${YELLOW}⚠️  Important Note:${NC}"
echo "React Native 0.79+ is optimized for Hermes. If you continue to have issues,"
echo "consider running the Hermes version: ${YELLOW}./scripts/fix-ios-build.sh${NC}"
echo ""
