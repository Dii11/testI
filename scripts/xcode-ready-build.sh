#!/bin/bash

# Complete Xcode Ready Build Script for TestFlight
# This script prepares everything for a seamless Xcode archive process

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
            echo "Complete Xcode ready build for TestFlight"
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

echo -e "${BLUE}🚀 HopMed Xcode Ready Build for TestFlight${NC}"
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

# Step 2: Load environment and configure Sentry
echo -e "${YELLOW}⚙️  Configuring environment...${NC}"

# Load environment from local env file if it exists
if [ -f "environments/.env.local" ]; then
    source environments/.env.local
    print_status "Environment loaded from environments/.env.local"
else
    print_warning "No environments/.env.local found"
fi

# Set Sentry environment variables to prevent build errors
export SENTRY_DISABLE_AUTO_UPLOAD=1
export SENTRY_ALLOW_FAILURE=1
export SENTRY_SKIP_AUTO_RELEASE=1

print_status "Sentry configuration set to prevent build errors"

# Step 3: Install dependencies and prebuild (if needed)
if [ "$SKIP_PREBUILD" = false ]; then
    echo -e "${YELLOW}📦 Installing dependencies and prebuilding...${NC}"

    print_info "Installing NPM dependencies..."
    npm install
    print_status "NPM dependencies installed"

    print_info "Running Expo prebuild..."
    npx expo prebuild --clean --platform ios
    print_status "Expo prebuild completed"

    print_info "Installing CocoaPods..."
    cd ios
    pod install --repo-update
    cd ..
    print_status "CocoaPods installed"

    # Apply Xcode project settings for dSYM generation
    print_info "Configuring Xcode project for dSYM generation..."
    cd ios

    # Use ruby to modify the Xcode project
    ruby << 'RUBY_SCRIPT'
require 'xcodeproj'

project_path = './HopMed.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Apply settings to all targets
project.targets.each do |target|
  target.build_configurations.each do |config|
    # Ensure dSYM generation for all configurations
    config.build_settings['DEBUG_INFORMATION_FORMAT'] = 'dwarf-with-dsym'
    config.build_settings['DWARF_DSYM_FILE_SHOULD_ACCOMPANY_PRODUCT'] = 'YES'
    config.build_settings['GCC_GENERATE_DEBUGGING_SYMBOLS'] = 'YES'

    # For Release configuration, ensure symbols aren't stripped
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
puts "✓ Xcode project updated with dSYM settings"
RUBY_SCRIPT

    cd ..
    print_status "Xcode project configured for dSYM generation"
else
    print_info "Skipping prebuild and pod install"
fi

# Step 4: Clean build artifacts
echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"

# Clean Xcode derived data and build folders
rm -rf ~/Library/Developer/Xcode/DerivedData/HopMed-*
if [ -d "ios/build" ]; then
    rm -rf ios/build
fi

print_status "Build artifacts cleaned"

# Step 5: Write environment variables to Xcode environment files
echo -e "${YELLOW}📝 Writing Xcode environment configuration...${NC}"

# Create .xcode.env file with Sentry configuration
cat > ios/.xcode.env << EOF
# Xcode Environment Variables
# This file is loaded by Xcode during build

# Sentry Configuration - Disable uploads to prevent build errors
export SENTRY_DISABLE_AUTO_UPLOAD=1
export SENTRY_ALLOW_FAILURE=1
export SENTRY_SKIP_AUTO_RELEASE=1

# Load additional environment from local file if it exists
if [ -f "../environments/.env.local" ]; then
    source "../environments/.env.local"
fi
EOF

print_status "Xcode environment file updated"

# Step 6: Final preparation
echo -e "${YELLOW}🎯 Final preparation...${NC}"

# Ensure proper file permissions
chmod +x ios/.xcode.env

print_status "File permissions set correctly"

# Step 7: Success message and instructions
echo ""
echo -e "${GREEN}✅ Project is ready for Xcode archive!${NC}"
echo -e "${PURPLE}🎉 Version $NEW_VERSION prepared!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps - Follow these exactly:${NC}"
echo ""
echo -e "${CYAN}1. Open the workspace in Xcode:${NC}"
echo -e "${CYAN}   open ios/HopMed.xcworkspace${NC}"
echo ""
echo -e "${CYAN}2. In Xcode:${NC}"
echo -e "${CYAN}   • Select 'Any iOS Device (arm64)' as the build target${NC}"
echo -e "${CYAN}   • Go to Product → Archive${NC}"
echo ""
echo -e "${CYAN}3. After archiving completes:${NC}"
echo -e "${CYAN}   • Xcode Organizer will open automatically${NC}"
echo -e "${CYAN}   • Select your new archive${NC}"
echo -e "${CYAN}   • Click 'Validate App' first${NC}"
echo -e "${CYAN}   • If validation passes, click 'Distribute App'${NC}"
echo -e "${CYAN}   • Choose 'App Store Connect' → 'Upload'${NC}"
echo ""
echo -e "${GREEN}🔧 Configuration Summary:${NC}"
echo -e "${CYAN}   ✓ Sentry uploads disabled${NC}"
echo -e "${CYAN}   ✓ dSYM generation enabled${NC}"
echo -e "${CYAN}   ✓ Environment variables loaded${NC}"
echo -e "${CYAN}   ✓ Development team: $DEVELOPMENT_TEAM${NC}"
echo -e "${CYAN}   ✓ Version: $NEW_VERSION${NC}"
echo ""
echo -e "${YELLOW}🚨 Important Notes:${NC}"
echo -e "${CYAN}   • All Sentry-related build errors should be resolved${NC}"
echo -e "${CYAN}   • The archive process should complete without errors${NC}"
echo -e "${CYAN}   • Validation should pass successfully${NC}"
echo ""
echo -e "${GREEN}🚀 Ready for a flawless TestFlight upload!${NC}"