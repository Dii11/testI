#!/bin/bash
# scripts/setup-fastlane-ios.sh
# HopMed iOS Fastlane setup and configuration script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}🛠️  HopMed iOS Fastlane Setup${NC}"

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check if Xcode is installed
if ! xcodebuild -version >/dev/null 2>&1; then
    echo -e "${RED}❌ Xcode not installed or command line tools missing${NC}"
    echo -e "${YELLOW}Please install Xcode and run: xcode-select --install${NC}"
    exit 1
fi

# Check if Ruby is installed
if ! ruby -v >/dev/null 2>&1; then
    echo -e "${RED}❌ Ruby not installed${NC}"
    exit 1
fi

# Check if Bundler is installed
if ! gem list bundler -i >/dev/null 2>&1; then
    echo -e "${YELLOW}📦 Installing Bundler...${NC}"
    gem install bundler
fi

# Check if CocoaPods is installed
if ! command -v pod >/dev/null 2>&1; then
    echo -e "${YELLOW}📦 Installing CocoaPods...${NC}"
    gem install cocoapods
fi

echo -e "${GREEN}✅ Prerequisites check completed${NC}"

# Navigate to iOS directory
cd ios

# Install Fastlane dependencies
echo -e "${YELLOW}📦 Installing Fastlane dependencies...${NC}"
bundle install

# Initialize Fastlane match if not already done
echo -e "${YELLOW}🔐 Setting up code signing...${NC}"
echo -e "${BLUE}💡 You'll need to configure match for code signing automation${NC}"
echo -e "${CYAN}Run this command later if you want to set up match:${NC}"
echo -e "${CYAN}cd ios && bundle exec fastlane match init${NC}"

cd ..

# Create environment configuration file
echo -e "${YELLOW}⚙️  Creating environment configuration...${NC}"
cat > .env.fastlane << EOF
# HopMed Fastlane Environment Configuration
# Copy this to .env.fastlane.local and fill in your values

# Apple Developer Team ID (required)
# Find this in Apple Developer Portal -> Membership
FASTLANE_DEVELOPMENT_TEAM=your-team-id-here

# App Store Connect API Issuer ID (required)  
# Find this in App Store Connect -> Users and Roles -> Keys
FASTLANE_API_ISSUER_ID=your-issuer-id-here

# App Store Connect Team ID (optional, if different from development team)
FASTLANE_ITC_TEAM_ID=your-itc-team-id-here

# Apple Developer Account Email
FASTLANE_APPLE_ID=your-apple-id@email.com

# Skip waiting for build processing (speeds up uploads)
FASTLANE_SKIP_WAITING_FOR_BUILD_PROCESSING=false

# Fastlane session (optional, for 2FA)
# FASTLANE_SESSION=your-session-here

# Match configuration (if using match for code signing)
# MATCH_GIT_URL=your-certificates-repo-url
# MATCH_PASSWORD=your-match-password
EOF

# Make deploy script executable
chmod +x scripts/deploy-testflight.sh
chmod +x scripts/setup-fastlane-ios.sh

# Create .gitignore entries for sensitive files
if ! grep -q ".env.fastlane.local" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Fastlane" >> .gitignore
    echo ".env.fastlane.local" >> .gitignore
    echo "ios/report.xml" >> .gitignore
    echo "ios/build/" >> .gitignore
    echo "ios/fastlane/report.xml" >> .gitignore
    echo "ios/fastlane/Preview.html" >> .gitignore
    echo "ios/fastlane/screenshots/" >> .gitignore
    echo "ios/fastlane/test_output/" >> .gitignore
fi

echo -e "${GREEN}✅ Fastlane iOS setup completed!${NC}"
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "${CYAN}1. Copy .env.fastlane to .env.fastlane.local${NC}"
echo -e "${CYAN}2. Edit .env.fastlane.local with your Apple Developer credentials${NC}" 
echo -e "${CYAN}3. Source the environment: source .env.fastlane.local${NC}"
echo -e "${CYAN}4. Run health check: cd ios && bundle exec fastlane health_check${NC}"
echo -e "${CYAN}5. Deploy to TestFlight: ./scripts/deploy-testflight.sh -e staging${NC}"

echo -e "${YELLOW}💡 Commands available:${NC}"
echo -e "${CYAN}   ./scripts/deploy-testflight.sh -e development  # QA build${NC}"
echo -e "${CYAN}   ./scripts/deploy-testflight.sh -e staging      # Staging build${NC}"
echo -e "${CYAN}   ./scripts/deploy-testflight.sh -e production   # Production build${NC}"
echo -e "${CYAN}   ./scripts/deploy-testflight.sh --skip-prebuild # Quick build (skip Expo prebuild)${NC}"

echo -e "${PURPLE}🎯 Your iOS deployment automation is ready!${NC}"