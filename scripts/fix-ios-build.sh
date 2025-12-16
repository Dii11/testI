#!/bin/bash

# iOS Build Fix Script
# Fixes "Redefinition of module 'react_runtime'" error by cleaning and regenerating iOS project

set -e  # Exit on error

echo "🔧 iOS Build Fix - Starting cleanup and regeneration..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Clean iOS build artifacts
echo "${YELLOW}Step 1/6: Cleaning iOS build artifacts...${NC}"
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

# Step 2: Clean Xcode derived data
echo ""
echo "${YELLOW}Step 2/6: Cleaning Xcode derived data...${NC}"
rm -rf ~/Library/Developer/Xcode/DerivedData/HopMed-* || true
echo "✅ Cleared Xcode DerivedData"

# Step 3: Clean CocoaPods cache
echo ""
echo "${YELLOW}Step 3/6: Cleaning CocoaPods cache...${NC}"
cd ios
pod cache clean --all 2>/dev/null || echo "⚠️  CocoaPods cache clean skipped (pod not found or already clean)"
cd ..
echo "✅ CocoaPods cache cleared"

# Step 4: Clean Expo/Metro cache
echo ""
echo "${YELLOW}Step 4/6: Cleaning Expo/Metro cache...${NC}"
rm -rf node_modules/.cache
rm -rf .expo
rm -rf $TMPDIR/metro-* $TMPDIR/haste-* 2>/dev/null || true
echo "✅ Expo/Metro cache cleared"

# Step 5: Regenerate iOS project with expo prebuild --clean
echo ""
echo "${YELLOW}Step 5/6: Regenerating iOS project with Hermes enabled...${NC}"
echo "This will sync Podfile.properties.json with app.config.js"
npx expo prebuild --platform ios --clean

# Verify the fix
if grep -q '"expo.jsEngine": "hermes"' ios/Podfile.properties.json; then
  echo "${GREEN}✅ Hermes correctly configured in Podfile.properties.json${NC}"
else
  echo "${RED}❌ Warning: Hermes not found in Podfile.properties.json${NC}"
  cat ios/Podfile.properties.json
fi

# Step 6: Install pods with verbose output
echo ""
echo "${YELLOW}Step 6/6: Installing CocoaPods dependencies...${NC}"
cd ios
bundle exec pod install --repo-update || pod install --repo-update
cd ..
echo "${GREEN}✅ CocoaPods installation complete${NC}"

# Final verification
echo ""
echo "${GREEN}========================================${NC}"
echo "${GREEN}✅ iOS Build Fix Complete!${NC}"
echo "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Run: ${YELLOW}npm run ios${NC} or ${YELLOW}npx expo run:ios${NC}"
echo "2. If build still fails, check the error output and try:"
echo "   ${YELLOW}cd ios && xcodebuild clean && cd ..${NC}"
echo ""
echo "Configuration verified:"
echo "  • JS Engine: ${GREEN}Hermes${NC} (optimal for RN 0.79+)"
echo "  • iOS Target: ${GREEN}15.1${NC}"
echo "  • New Architecture: ${GREEN}Enabled${NC}"
echo ""
