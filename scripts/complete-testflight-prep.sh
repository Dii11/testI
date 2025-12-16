#!/bin/bash

# Complete TestFlight Preparation Script
# This script does EVERYTHING needed for a flawless TestFlight upload
# Prevents Sentry errors AND ensures archive appears in main section (not Other Items)

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
VERSION_INCREMENT="patch"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version-increment)
            VERSION_INCREMENT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Complete TestFlight preparation and archive"
            echo ""
            echo "Options:"
            echo "  --version-increment TYPE  Version increment (patch|minor|major) [default: patch]"
            echo "  -h, --help               Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 Complete HopMed TestFlight Preparation${NC}"
echo -e "${BLUE}• Prevents Sentry build errors${NC}"
echo -e "${BLUE}• Ensures archive appears in main section (not Other Items)${NC}"
echo -e "${BLUE}• Version increment: ${VERSION_INCREMENT}${NC}"
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
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Step 1: Increment version
echo -e "${YELLOW}📈 Step 1: Incrementing version...${NC}"

CURRENT_VERSION=$(node -e "
const fs = require('fs');
const content = fs.readFileSync('app.config.js', 'utf8');
const versionMatch = content.match(/version:\s*['\"]([^'\"]+)['\"]/);
const version = versionMatch ? versionMatch[1] : '1.0.0';
console.log(version);
")

print_info "Current version: $CURRENT_VERSION"

NEW_VERSION=$(node -e "
const current = '$CURRENT_VERSION';
const [major, minor, patch] = current.split('.').map(Number);
const increment = '$VERSION_INCREMENT';

switch(increment) {
  case 'major':
    console.log(\`\${major + 1}.0.0\`);
    break;
  case 'minor':
    console.log(\`\${major}.\${minor + 1}.0\`);
    break;
  case 'patch':
  default:
    console.log(\`\${major}.\${minor}.\${patch + 1}\`);
    break;
}
")

node -e "
const fs = require('fs');
const content = fs.readFileSync('app.config.js', 'utf8');
const newContent = content.replace(
  /version:\s*['\"]$CURRENT_VERSION['\"]/,
  'version: \'$NEW_VERSION\''
);
fs.writeFileSync('app.config.js', newContent);
"

print_status "Version updated to $NEW_VERSION"

# Step 2: Environment setup
echo -e "${YELLOW}⚙️  Step 2: Setting up environment...${NC}"

if [ -f "environments/.env.local" ]; then
    source environments/.env.local
    print_status "Environment loaded"
fi

export SENTRY_DISABLE_AUTO_UPLOAD=1
export SENTRY_ALLOW_FAILURE=1
export SENTRY_SKIP_AUTO_RELEASE=1

print_status "Sentry uploads disabled to prevent build errors"

# Step 3: Dependencies and prebuild
echo -e "${YELLOW}📦 Step 3: Installing dependencies and prebuilding...${NC}"

npm install
print_status "NPM dependencies installed"

npx expo prebuild --clean --platform ios
print_status "Expo prebuild completed"

cd ios
pod install --repo-update
print_status "CocoaPods installed"

# Step 4: Configure Xcode project
echo -e "${YELLOW}🔧 Step 4: Configuring Xcode project...${NC}"

ruby << 'RUBY_SCRIPT'
require 'xcodeproj'

project_path = './HopMed.xcodeproj'
project = Xcodeproj::Project.open(project_path)

project.targets.each do |target|
  target.build_configurations.each do |config|
    config.build_settings['DEBUG_INFORMATION_FORMAT'] = 'dwarf-with-dsym'
    config.build_settings['DWARF_DSYM_FILE_SHOULD_ACCOMPANY_PRODUCT'] = 'YES'
    config.build_settings['GCC_GENERATE_DEBUGGING_SYMBOLS'] = 'YES'

    if config.name == 'Release'
      config.build_settings['STRIP_INSTALLED_PRODUCT'] = 'NO'
      config.build_settings['COPY_PHASE_STRIP'] = 'NO'
      config.build_settings['DEPLOYMENT_POSTPROCESSING'] = 'NO'
      config.build_settings['STRIP_STYLE'] = 'debugging'
      config.build_settings['ENABLE_BITCODE'] = 'NO'
    end
  end
end

project.save
RUBY_SCRIPT

print_status "Xcode project configured for dSYM generation"

# Step 5: Clean build artifacts
echo -e "${YELLOW}🧹 Step 5: Cleaning build artifacts...${NC}"

rm -rf ~/Library/Developer/Xcode/DerivedData/HopMed-*
rm -rf build

print_status "Build artifacts cleaned"

# Step 6: Validate project configuration
echo -e "${YELLOW}🔍 Step 6: Validating project configuration...${NC}"

# Get bundle ID from the project file directly since it's correctly set there
BUNDLE_ID=$(grep -r "PRODUCT_BUNDLE_IDENTIFIER = " ios/HopMed.xcodeproj/project.pbxproj | head -1 | awk -F'= ' '{print $2}' | tr -d ';')
PRODUCT_NAME="HopMed"

print_info "Bundle ID: $BUNDLE_ID"
print_info "Product Name: $PRODUCT_NAME"

if [ "$BUNDLE_ID" != "com.lns.hopmed" ]; then
    print_error "Bundle identifier issue: $BUNDLE_ID"
    exit 1
fi

print_status "Project configuration validated"

# Step 7: Create the archive (FIXED to prevent Other Items)
echo -e "${YELLOW}📦 Step 7: Creating archive (fixed for main section)...${NC}"

mkdir -p build

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

# Step 8: Verify archive structure
echo -e "${YELLOW}🔍 Step 8: Verifying archive...${NC}"

if [ ! -d "./build/HopMed.xcarchive" ]; then
    print_error "Archive creation failed!"
    exit 1
fi

if [ ! -d "./build/HopMed.xcarchive/Products/Applications/HopMed.app" ]; then
    print_error "❌ Archive structure issue - would end up in Other Items!"
    find ./build/HopMed.xcarchive -name "*.app" | head -5
    exit 1
fi

if [ ! -f "./build/HopMed.xcarchive/Products/Applications/HopMed.app/HopMed" ]; then
    print_error "❌ App executable missing!"
    exit 1
fi

ARCHIVE_BUNDLE_ID=$(plutil -p "./build/HopMed.xcarchive/Products/Applications/HopMed.app/Info.plist" 2>/dev/null | grep CFBundleIdentifier | awk -F'"' '{print $4}')
if [ "$ARCHIVE_BUNDLE_ID" != "com.lns.hopmed" ]; then
    print_error "❌ Archive bundle ID mismatch: $ARCHIVE_BUNDLE_ID"
    exit 1
fi

print_status "✅ Archive structure verified - will appear in main iOS Apps section!"

# Step 9: Go back to project root
cd ..

# Step 10: Success message
echo ""
echo -e "${GREEN}🎉 COMPLETE SUCCESS! Everything is ready for TestFlight!${NC}"
echo -e "${PURPLE}📱 Version $NEW_VERSION prepared${NC}"
echo ""
echo -e "${GREEN}✅ ISSUES FIXED:${NC}"
echo -e "${CYAN}   • Sentry build errors prevented${NC}"
echo -e "${CYAN}   • Archive will appear in main iOS Apps section (NOT Other Items)${NC}"
echo -e "${CYAN}   • dSYM generation configured${NC}"
echo -e "${CYAN}   • Build artifacts cleaned${NC}"
echo ""
echo -e "${BLUE}📋 NEXT STEPS - Follow exactly:${NC}"
echo ""
echo -e "${CYAN}1. Open the archive:${NC}"
echo -e "${CYAN}   open ios/build/HopMed.xcarchive${NC}"
echo ""
echo -e "${CYAN}2. In Xcode Organizer:${NC}"
echo -e "${CYAN}   • Archive will be in 'iOS Apps' section (NOT Other Items)${NC}"
echo -e "${CYAN}   • Click 'Validate App' first${NC}"
echo -e "${CYAN}   • If validation passes, click 'Distribute App'${NC}"
echo -e "${CYAN}   • Choose 'App Store Connect' → 'Upload'${NC}"
echo ""
echo -e "${GREEN}🔥 Your archive will NOT end up in Other Items anymore!${NC}"
echo -e "${GREEN}🚀 Ready for flawless TestFlight upload!${NC}"