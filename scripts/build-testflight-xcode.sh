#!/bin/bash

# Alternative TestFlight Build Script using Xcode directly
# Use this if the Fastlane version has issues
# Based on the existing xcode-archive.sh but with version increment and better automation

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
SKIP_PREBUILD=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version-increment)
            VERSION_INCREMENT="$2"
            shift 2
            ;;
        --skip-prebuild)
            SKIP_PREBUILD=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Alternative TestFlight build using Xcode directly"
            echo ""
            echo "Options:"
            echo "  --version-increment TYPE  Version increment type (patch|minor|major) [default: patch]"
            echo "  --skip-prebuild          Skip Expo prebuild"
            echo "  -h, --help               Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 HopMed Alternative TestFlight Build (Xcode Direct)${NC}"
echo -e "${BLUE}Version increment: ${VERSION_INCREMENT}${NC}"
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
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

if [ ! -f "app.config.js" ]; then
    print_error "app.config.js not found"
    exit 1
fi

# Step 1: Increment version
echo -e "${YELLOW}📈 Incrementing version...${NC}"

# Get current version from app.config.js
CURRENT_VERSION=$(node -e "
const fs = require('fs');
const content = fs.readFileSync('app.config.js', 'utf8');
const versionMatch = content.match(/version:\s*['\"]([^'\"]+)['\"]/);
const version = versionMatch ? versionMatch[1] : '1.0.0';
console.log(version);
")

print_info "Current version: $CURRENT_VERSION"

# Calculate new version
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

print_info "New version will be: $NEW_VERSION"

# Update version in app.config.js
node -e "
const fs = require('fs');
const content = fs.readFileSync('app.config.js', 'utf8');
const newContent = content.replace(
  /version:\s*['\"]$CURRENT_VERSION['\"]/,
  'version: \'$NEW_VERSION\''
);
fs.writeFileSync('app.config.js', newContent);
console.log('Version updated in app.config.js');
"

print_status "Version incremented to $NEW_VERSION"

# Step 2: Load environment and disable Sentry uploads
echo -e "${YELLOW}⚙️  Configuring environment...${NC}"

# Load environment from local env file if it exists
if [ -f "environments/.env.local" ]; then
    source environments/.env.local
fi

# Disable Sentry uploads to prevent build errors
export SENTRY_DISABLE_AUTO_UPLOAD=1
export SENTRY_ALLOW_FAILURE=1
export SENTRY_SKIP_AUTO_RELEASE=1

print_status "Environment configured - Sentry auto-upload disabled"

# Step 3: Install dependencies and prebuild (if needed)
if [ "$SKIP_PREBUILD" = false ]; then
    echo -e "${YELLOW}📦 Installing dependencies and prebuilding...${NC}"
    
    npm install
    print_status "NPM dependencies installed"
    
    npx expo prebuild --clean --platform ios
    print_status "Expo prebuild completed"
    
    cd ios
    pod install --repo-update
    cd ..
    print_status "CocoaPods installed"
else
    print_info "Skipping prebuild and pod install"
fi

# Step 4: Navigate to iOS directory and clean
echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"
cd ios

# Clean build folder and derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/HopMed-*
rm -rf build

print_status "Build artifacts cleaned"

# Step 5: Create archive
echo -e "${YELLOW}📦 Creating Xcode archive...${NC}"

xcodebuild archive \
    -workspace HopMed.xcworkspace \
    -scheme HopMed \
    -configuration Release \
    -archivePath ./build/HopMed.xcarchive \
    -destination 'generic/platform=iOS' \
    -allowProvisioningUpdates \
    DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
    SENTRY_DISABLE_AUTO_UPLOAD=YES \
    SENTRY_ALLOW_FAILURE=YES \
    DEBUG_INFORMATION_FORMAT="dwarf-with-dsym" \
    DWARF_DSYM_FILE_SHOULD_ACCOMPANY_PRODUCT=YES \
    GCC_GENERATE_DEBUGGING_SYMBOLS=YES

print_status "Archive created successfully!"

# Step 6: Create export options
echo -e "${YELLOW}📤 Creating export options...${NC}"

cat > ExportOptions.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>$DEVELOPMENT_TEAM</string>
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

# Step 7: Export IPA
echo -e "${YELLOW}📦 Exporting IPA for App Store...${NC}"

xcodebuild -exportArchive \
    -archivePath ./build/HopMed.xcarchive \
    -exportPath ./build \
    -exportOptionsPlist ExportOptions.plist \
    -allowProvisioningUpdates

print_status "IPA exported successfully!"

# Clean up
rm -f ExportOptions.plist

cd ..

# Step 8: Success message
echo ""
echo -e "${GREEN}✅ Archive and IPA created successfully!${NC}"
echo -e "${PURPLE}🎉 Version $NEW_VERSION is ready!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "${CYAN}   1. Open the archive in Xcode Organizer:${NC}"
echo -e "${CYAN}      open ios/build/HopMed.xcarchive${NC}"
echo ""
echo -e "${CYAN}   2. Or open Xcode Organizer directly:${NC}"
echo -e "${CYAN}      open -a Xcode${NC}"
echo -e "${CYAN}      Then go to Window → Organizer${NC}"
echo ""
echo -e "${CYAN}   3. In Organizer:${NC}"
echo -e "${CYAN}      • Select your archive${NC}"
echo -e "${CYAN}      • Click 'Validate App' to check for issues${NC}"
echo -e "${CYAN}      • If validation passes, click 'Distribute App'${NC}"
echo -e "${CYAN}      • Choose 'App Store Connect' → 'Upload'${NC}"
echo ""
echo -e "${YELLOW}📂 Build artifacts:${NC}"
echo -e "${CYAN}   Archive: ios/build/HopMed.xcarchive${NC}"
echo -e "${CYAN}   IPA: ios/build/HopMed.ipa${NC}"
echo ""
echo -e "${GREEN}🚀 Ready for TestFlight upload!${NC}"