#!/bin/bash

# Complete TestFlight Build Script for HopMed
# This script handles version increment, Fastlane setup, and TestFlight deployment
# Designed specifically for Expo React Native projects

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
APP_IDENTIFIER="com.lns.hopmed"
SCHEME="HopMed"
WORKSPACE="HopMed.xcworkspace"

# Default values
VERSION_INCREMENT="patch"
SKIP_PREBUILD=false
ENVIRONMENT="staging"

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
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Complete TestFlight build script for HopMed iOS app"
            echo ""
            echo "Options:"
            echo "  --version-increment TYPE  Version increment type (patch|minor|major) [default: patch]"
            echo "  --skip-prebuild          Skip Expo prebuild (faster for subsequent builds)"
            echo "  -e, --environment ENV    Environment (development|staging|production) [default: staging]"
            echo "  -h, --help               Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Build staging with patch increment"
            echo "  $0 --version-increment minor          # Build with minor version increment"
            echo "  $0 -e production --version-increment major  # Production build with major increment"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 HopMed Complete TestFlight Build Script${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Version increment: ${VERSION_INCREMENT}${NC}"
echo -e "${BLUE}Skip prebuild: ${SKIP_PREBUILD}${NC}"
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

# Step 1: Validate prerequisites
echo -e "${YELLOW}🔍 Validating prerequisites...${NC}"

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if app.config.js exists
if [ ! -f "app.config.js" ]; then
    print_error "app.config.js not found"
    exit 1
fi

# Check if AuthKey exists
if [ ! -f "AuthKey_37UL292BF8.p8" ]; then
    print_error "AuthKey_37UL292BF8.p8 not found in project root"
    exit 1
fi

print_status "Prerequisites validated"

# Step 2: Increment version in app.config.js
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

print_info "New version: $NEW_VERSION"

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

# Step 3: Set up Fastlane if not already configured
echo -e "${YELLOW}🛠️  Setting up Fastlane...${NC}"

if [ ! -d "ios/fastlane" ]; then
    print_info "Fastlane not configured, setting up..."
    
    # Copy Fastlane templates
    mkdir -p ios/fastlane
    cp fastlane-templates/ios/fastlane/* ios/fastlane/
    
    # Create Gemfile if it doesn't exist
    if [ ! -f "ios/Gemfile" ]; then
        cp fastlane-templates/android/Gemfile ios/Gemfile
    fi
    
    print_status "Fastlane configuration copied"
fi

# Step 4: Set up environment variables
echo -e "${YELLOW}⚙️  Configuring environment...${NC}"

# Load environment variables
if [ -f ".env.fastlane.local" ]; then
    source .env.fastlane.local
    print_status "Loaded .env.fastlane.local"
elif [ -f ".env.fastlane" ]; then
    source .env.fastlane
    print_status "Loaded .env.fastlane"
fi

# Set required environment variables with defaults
export FASTLANE_DEVELOPMENT_TEAM="${FASTLANE_DEVELOPMENT_TEAM:-$DEVELOPMENT_TEAM}"
export FASTLANE_API_ISSUER_ID="${FASTLANE_API_ISSUER_ID:-}"
export FASTLANE_APPLE_ID="${FASTLANE_APPLE_ID:-}"

# Disable Sentry auto-upload to prevent build errors
export SENTRY_DISABLE_AUTO_UPLOAD=1
export SENTRY_ALLOW_FAILURE=1
export SENTRY_SKIP_AUTO_RELEASE=1

print_status "Environment configured"

# Step 5: Install dependencies and prebuild (if needed)
if [ "$SKIP_PREBUILD" = false ]; then
    echo -e "${YELLOW}📦 Installing dependencies and prebuilding...${NC}"
    
    # Install npm dependencies
    npm install
    print_status "NPM dependencies installed"
    
    # Run Expo prebuild
    npx expo prebuild --clean --platform ios
    print_status "Expo prebuild completed"
    
    # Install CocoaPods
    cd ios
    pod install --repo-update
    cd ..
    print_status "CocoaPods installed"
else
    print_info "Skipping prebuild and pod install"
fi

# Step 6: Install Fastlane dependencies
echo -e "${YELLOW}💎 Installing Fastlane dependencies...${NC}"
cd ios

if [ ! -f "Gemfile" ]; then
    print_error "Gemfile not found in ios/ directory"
    exit 1
fi

bundle install
print_status "Fastlane dependencies installed"

# Step 7: Run health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
bundle exec fastlane health_check || {
    print_warning "Health check failed, but continuing..."
}

# Step 8: Build and archive for TestFlight
echo -e "${YELLOW}🏗️  Building and archiving for TestFlight...${NC}"

case "$ENVIRONMENT" in
    development|qa)
        print_info "Building for QA/Development environment"
        bundle exec fastlane deploy_qa
        ;;
    staging)
        print_info "Building for Staging environment"
        bundle exec fastlane deploy_staging  
        ;;
    production)
        print_info "Building for Production environment"
        echo -e "${RED}⚠️  WARNING: This will build for PRODUCTION!${NC}"
        read -p "Are you sure you want to continue? (y/N): " confirm
        if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
            bundle exec fastlane deploy_production
        else
            print_info "Production build cancelled"
            exit 0
        fi
        ;;
    *)
        print_error "Invalid environment: $ENVIRONMENT"
        print_info "Valid environments: development, staging, production"
        exit 1
        ;;
esac

cd ..

# Step 9: Success message and next steps
echo ""
echo -e "${GREEN}✅ TestFlight build completed successfully!${NC}"
echo -e "${PURPLE}🎉 Version $NEW_VERSION is ready for TestFlight!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "${CYAN}   1. Check App Store Connect for build processing status${NC}"
echo -e "${CYAN}   2. Add internal testers to TestFlight groups${NC}"  
echo -e "${CYAN}   3. Send test invitations when build is ready${NC}"
echo ""
echo -e "${YELLOW}💡 Build artifacts location:${NC}"
echo -e "${CYAN}   Archive: ios/build/HopMed.xcarchive${NC}"
echo -e "${CYAN}   IPA: ios/build/HopMed.ipa${NC}"
echo ""
echo -e "${GREEN}🚀 Happy testing!${NC}"