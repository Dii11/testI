#!/bin/bash

# Archive iOS app with proper environment variables for TestFlight
# This prevents Sentry upload errors during build

set -e

echo "🚀 Starting Xcode archive with proper environment..."

# Load environment variables
source /Users/rochelhasina/Documents/hopmed/hopmed-mobile/environments/.env.local

# Export Sentry variables to prevent upload errors
export SENTRY_DISABLE_AUTO_UPLOAD=1
export SENTRY_ALLOW_FAILURE=1
export SENTRY_SKIP_AUTO_RELEASE=1

echo "✓ Sentry auto-upload disabled"
echo "✓ Environment variables loaded"

# Navigate to iOS directory
cd /Users/rochelhasina/Documents/hopmed/hopmed-mobile/ios

# Clean build folder
echo "🧹 Cleaning build artifacts..."
rm -rf ~/Library/Developer/Xcode/DerivedData/HopMed-*
rm -rf build

# Archive with xcodebuild - Fixed to prevent "Other Items" issue
echo "📦 Creating archive (will appear in main iOS Apps section)..."

# Ensure build directory exists
mkdir -p build

xcodebuild archive \
    -workspace HopMed.xcworkspace \
    -scheme HopMed \
    -configuration Release \
    -archivePath ./build/HopMed.xcarchive \
    -destination 'generic/platform=iOS' \
    -allowProvisioningUpdates \
    DEVELOPMENT_TEAM="2989AUH85G" \
    PRODUCT_BUNDLE_IDENTIFIER="com.lns.hopmed" \
    PRODUCT_NAME="HopMed" \
    EXECUTABLE_NAME="HopMed" \
    SENTRY_DISABLE_AUTO_UPLOAD=YES \
    SENTRY_ALLOW_FAILURE=YES \
    DEBUG_INFORMATION_FORMAT="dwarf-with-dsym" \
    DWARF_DSYM_FILE_SHOULD_ACCOMPANY_PRODUCT=YES \
    GCC_GENERATE_DEBUGGING_SYMBOLS=YES \
    SKIP_INSTALL=NO \
    INSTALL_PATH="/Applications" \
    TARGETED_DEVICE_FAMILY="1,2"

# Verify archive structure to ensure it won't end up in Other Items
if [ ! -d "./build/HopMed.xcarchive/Products/Applications/HopMed.app" ]; then
    echo "❌ WARNING: Archive may end up in Other Items - app bundle not found in expected location"
    echo "Archive contents:"
    find ./build/HopMed.xcarchive -name "*.app" | head -5
else
    echo "✅ Archive verified - will appear in main iOS Apps section!"
fi

echo "✅ Archive created successfully!"
echo ""
echo "📱 Next steps:"
echo "1. Open the archive in Xcode:"
echo "   open ./build/HopMed.xcarchive"
echo ""
echo "2. Or open Xcode Organizer directly:"
echo "   open -a Xcode"
echo "   Then go to Window → Organizer"
echo ""
echo "3. Select your archive and click 'Validate App'"
echo "4. After validation, click 'Distribute App' → 'App Store Connect'"