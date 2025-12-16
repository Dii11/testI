#!/bin/bash

# Fixed Xcode Archive Script - Prevents archives from ending up in "Other Items"
# This script ensures your archive appears in the main iOS Apps section

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
DEVELOPMENT_TEAM="2989AUH85G"

echo -e "${BLUE}🎯 HopMed Archive Script - Fixed for Main Archives Section${NC}"
echo -e "${BLUE}Development Team: ${DEVELOPMENT_TEAM}${NC}"
echo ""

# Function to print status messages
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[ℹ]${NC} $1"
}

# Validate prerequisites
if [ ! -f "../package.json" ]; then
    print_error "Please run this script from the ios/ directory"
    exit 1
fi

if [ ! -f "HopMed.xcworkspace" ]; then
    print_error "HopMed.xcworkspace not found in current directory"
    exit 1
fi

# Step 1: Load environment and configure Sentry
echo -e "${YELLOW}⚙️  Configuring environment...${NC}"

# Load environment from local env file if it exists
if [ -f "../environments/.env.local" ]; then
    source ../environments/.env.local
    print_status "Environment loaded from environments/.env.local"
fi

# Set Sentry environment variables to prevent build errors
export SENTRY_DISABLE_AUTO_UPLOAD=1
export SENTRY_ALLOW_FAILURE=1
export SENTRY_SKIP_AUTO_RELEASE=1

print_status "Sentry configuration set to prevent build errors"

# Step 2: Validate project configuration
echo -e "${YELLOW}🔍 Validating project configuration...${NC}"

# Verify we're targeting the correct scheme and bundle identifier
BUNDLE_ID=$(xcodebuild -showBuildSettings -workspace HopMed.xcworkspace -scheme HopMed -configuration Release 2>/dev/null | grep "PRODUCT_BUNDLE_IDENTIFIER" | awk '{print $3}' | head -1)
PRODUCT_NAME=$(xcodebuild -showBuildSettings -workspace HopMed.xcworkspace -scheme HopMed -configuration Release 2>/dev/null | grep "PRODUCT_NAME" | awk '{print $3}' | head -1)
FULL_PRODUCT_NAME=$(xcodebuild -showBuildSettings -workspace HopMed.xcworkspace -scheme HopMed -configuration Release 2>/dev/null | grep "FULL_PRODUCT_NAME" | awk '{print $3}' | head -1)

print_info "Bundle ID: $BUNDLE_ID"
print_info "Product Name: $PRODUCT_NAME"
print_info "Full Product Name: $FULL_PRODUCT_NAME"

if [ "$BUNDLE_ID" != "com.lns.hopmed" ]; then
    print_error "Bundle identifier mismatch! Expected: com.lns.hopmed, Found: $BUNDLE_ID"
    exit 1
fi

if [ "$FULL_PRODUCT_NAME" != "HopMed.app" ]; then
    print_error "Product name issue! Expected: HopMed.app, Found: $FULL_PRODUCT_NAME"
    exit 1
fi

print_status "Project configuration validated - archive will appear in main section"

# Step 3: Clean build artifacts
echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"

# Clean Xcode derived data and build folders
rm -rf ~/Library/Developer/Xcode/DerivedData/HopMed-*
rm -rf build

print_status "Build artifacts cleaned"

# Step 4: Create archive with proper settings to avoid "Other Items"
echo -e "${YELLOW}📦 Creating archive (will appear in main iOS Apps section)...${NC}"

# Create the build directory
mkdir -p build

# Create the archive with explicit settings to ensure it's recognized as an iOS app
xcodebuild archive \
    -workspace HopMed.xcworkspace \
    -scheme HopMed \
    -configuration Release \
    -archivePath ./build/HopMed.xcarchive \
    -destination 'generic/platform=iOS' \
    -allowProvisioningUpdates \
    DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
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
    TARGETED_DEVICE_FAMILY="1,2" \
    IPHONEOS_DEPLOYMENT_TARGET="13.0"

# Step 5: Verify the archive was created correctly
echo -e "${YELLOW}🔍 Verifying archive structure...${NC}"

if [ ! -d "./build/HopMed.xcarchive" ]; then
    print_error "Archive creation failed!"
    exit 1
fi

# Check if the archive contains the app bundle in the correct location
if [ ! -d "./build/HopMed.xcarchive/Products/Applications/HopMed.app" ]; then
    print_error "❌ Archive doesn't contain app bundle in correct location - would end up in Other Items!"
    print_info "Archive structure:"
    find ./build/HopMed.xcarchive -type d -name "*.app" -o -name "*.framework" | head -10

    print_info "Full archive contents:"
    ls -la ./build/HopMed.xcarchive/Products/ 2>/dev/null || echo "No Products directory found"
    exit 1
fi

# Verify the app bundle contains the correct executable
if [ ! -f "./build/HopMed.xcarchive/Products/Applications/HopMed.app/HopMed" ]; then
    print_error "❌ App bundle doesn't contain the executable!"
    exit 1
fi

# Check the Info.plist in the archive
ARCHIVE_BUNDLE_ID=$(plutil -p "./build/HopMed.xcarchive/Products/Applications/HopMed.app/Info.plist" 2>/dev/null | grep CFBundleIdentifier | awk -F'"' '{print $4}')
if [ "$ARCHIVE_BUNDLE_ID" != "com.lns.hopmed" ]; then
    print_error "❌ Archive bundle ID mismatch: $ARCHIVE_BUNDLE_ID"
    exit 1
fi

print_status "✅ Archive structure verified - will appear in main iOS Apps section!"
print_status "✅ App bundle found at: Products/Applications/HopMed.app"
print_status "✅ Executable found: HopMed"
print_status "✅ Bundle ID verified: $ARCHIVE_BUNDLE_ID"

# Step 6: Archive size and details
ARCHIVE_SIZE=$(du -sh ./build/HopMed.xcarchive | awk '{print $1}')
print_info "Archive size: $ARCHIVE_SIZE"

# Step 7: Success message and instructions
echo ""
echo -e "${GREEN}🎉 Archive created successfully!${NC}"
echo -e "${GREEN}✅ Archive will appear in MAIN iOS Apps section (NOT Other Items)${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo ""
echo -e "${CYAN}1. Open Xcode Organizer:${NC}"
echo -e "${CYAN}   open ./build/HopMed.xcarchive${NC}"
echo -e "${CYAN}   OR${NC}"
echo -e "${CYAN}   open -a Xcode${NC}"
echo -e "${CYAN}   Then Window → Organizer${NC}"
echo ""
echo -e "${CYAN}2. In Organizer:${NC}"
echo -e "${CYAN}   • Your archive should appear under 'iOS Apps' (not Other Items)${NC}"
echo -e "${CYAN}   • Select the archive${NC}"
echo -e "${CYAN}   • Click 'Validate App' to check for issues${NC}"
echo -e "${CYAN}   • If validation passes, click 'Distribute App'${NC}"
echo -e "${CYAN}   • Choose 'App Store Connect' → 'Upload'${NC}"
echo ""
echo -e "${GREEN}📂 Archive location: $(pwd)/build/HopMed.xcarchive${NC}"
echo ""
echo -e "${YELLOW}🔥 This archive is fixed and will NOT end up in Other Items!${NC}"