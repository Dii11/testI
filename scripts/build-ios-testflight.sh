#!/bin/bash

# Build iOS app for TestFlight submission
# This script ensures proper dSYM generation and validation

set -e  # Exit on error

echo "🚀 Starting iOS build for TestFlight..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Step 1: Clean previous builds
print_status "Cleaning previous builds..."
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/HopMed-*

# Step 2: Install dependencies
print_status "Installing dependencies..."
npm install

# Step 3: Prebuild with Expo
print_status "Running Expo prebuild..."
npx expo prebuild --clean --platform ios

# Step 4: Install pods
print_status "Installing CocoaPods..."
cd ios
pod install --repo-update
cd ..

# Step 5: Generate dSYMs for all frameworks
print_status "Configuring Xcode project for dSYM generation..."
cd ios

# Update the xcodeproj to ensure dSYM generation
xcodebuild -workspace HopMed.xcworkspace \
    -scheme HopMed \
    -configuration Release \
    -archivePath ./build/HopMed.xcarchive \
    -allowProvisioningUpdates \
    archive \
    DEBUG_INFORMATION_FORMAT="dwarf-with-dsym" \
    DWARF_DSYM_FILE_SHOULD_ACCOMPANY_PRODUCT=YES \
    GCC_GENERATE_DEBUGGING_SYMBOLS=YES \
    STRIP_INSTALLED_PRODUCT=NO \
    DEPLOYMENT_POSTPROCESSING=NO \
    COPY_PHASE_STRIP=NO

# Step 6: Check for dSYMs
print_status "Verifying dSYM generation..."
ARCHIVE_PATH="./build/HopMed.xcarchive"
DSYM_PATH="$ARCHIVE_PATH/dSYMs"

if [ -d "$DSYM_PATH" ]; then
    print_status "dSYM folder found at $DSYM_PATH"
    ls -la "$DSYM_PATH"

    # Check for specific framework dSYMs
    if [ -d "$DSYM_PATH/ReactNativeDailyJSScreenShareExtension.framework.dSYM" ]; then
        print_status "ReactNativeDailyJSScreenShareExtension.framework.dSYM found"
    else
        print_warning "ReactNativeDailyJSScreenShareExtension.framework.dSYM not found - generating..."
        # Try to generate missing dSYM
        dsymutil "$ARCHIVE_PATH/Products/Applications/HopMed.app/Frameworks/ReactNativeDailyJSScreenShareExtension.framework/ReactNativeDailyJSScreenShareExtension" \
            -o "$DSYM_PATH/ReactNativeDailyJSScreenShareExtension.framework.dSYM" || true
    fi

    if [ -d "$DSYM_PATH/hermes.framework.dSYM" ]; then
        print_status "hermes.framework.dSYM found"
    else
        print_warning "hermes.framework.dSYM not found - generating..."
        # Try to generate missing dSYM for Hermes
        dsymutil "$ARCHIVE_PATH/Products/Applications/HopMed.app/Frameworks/hermes.framework/hermes" \
            -o "$DSYM_PATH/hermes.framework.dSYM" || true
    fi
else
    print_error "dSYM folder not found!"
    exit 1
fi

# Step 7: Export IPA for App Store
print_status "Exporting IPA for App Store..."

# Create ExportOptions.plist
cat > ExportOptions.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>uploadBitcode</key>
    <false/>
    <key>compileBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
EOF

xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath ./build \
    -exportOptionsPlist ExportOptions.plist \
    -allowProvisioningUpdates

# Step 8: Validate the build
print_status "Validating build for TestFlight..."
xcrun altool --validate-app \
    -f ./build/HopMed.ipa \
    -t ios \
    --apiKey YOUR_API_KEY \
    --apiIssuer YOUR_ISSUER_ID \
    --verbose || {
    print_warning "Validation with altool failed, trying with xcodebuild..."
    xcodebuild -exportArchive \
        -archivePath "$ARCHIVE_PATH" \
        -exportPath ./build \
        -exportOptionsPlist ExportOptions.plist \
        -allowProvisioningUpdates \
        -exportOptionsPlist ExportOptions.plist
}

print_status "Build complete! Archive is ready at: $ARCHIVE_PATH"
print_status "IPA is ready at: ./build/HopMed.ipa"
print_warning "IMPORTANT: Before uploading to TestFlight:"
print_warning "1. Open the archive in Xcode Organizer"
print_warning "2. Click 'Validate App' to check for issues"
print_warning "3. If validation passes, click 'Distribute App' to upload to TestFlight"

# Clean up
rm -f ExportOptions.plist

cd ..

echo ""
print_status "✅ Build process complete!"
echo ""
echo "To open in Xcode Organizer, run:"
echo "  open ios/build/HopMed.xcarchive"