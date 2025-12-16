#!/bin/bash
# scripts/deploy-testflight.sh
# HopMed TestFlight deployment automation script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Default values
ENVIRONMENT="staging"
SKIP_PREBUILD=false
CLEAN_BUILD=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-prebuild)
            SKIP_PREBUILD=true
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment    Environment (development|staging|production)"
            echo "  --skip-prebuild      Skip Expo prebuild step"
            echo "  --clean              Clean build artifacts before starting"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 HopMed TestFlight Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Skip prebuild: ${SKIP_PREBUILD}${NC}"
echo -e "${BLUE}Clean build: ${CLEAN_BUILD}${NC}"

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Check if required files exist
if [ ! -f "AuthKey_37UL292BF8.p8" ]; then
    echo -e "${RED}❌ AuthKey_37UL292BF8.p8 not found in project root${NC}"
    exit 1
fi

if [ ! -f "ios/fastlane/Fastfile" ]; then
    echo -e "${RED}❌ Fastlane not configured. Run setup first.${NC}"
    exit 1
fi

# Check environment variables
if [ -z "$FASTLANE_DEVELOPMENT_TEAM" ]; then
    echo -e "${YELLOW}⚠️  FASTLANE_DEVELOPMENT_TEAM not set${NC}"
    echo -e "${YELLOW}Please set your Apple Developer Team ID:${NC}"
    echo -e "${YELLOW}export FASTLANE_DEVELOPMENT_TEAM=your-team-id${NC}"
fi

if [ -z "$FASTLANE_API_ISSUER_ID" ]; then
    echo -e "${YELLOW}⚠️  FASTLANE_API_ISSUER_ID not set${NC}"  
    echo -e "${YELLOW}Please set your App Store Connect API Issuer ID:${NC}"
    echo -e "${YELLOW}export FASTLANE_API_ISSUER_ID=your-issuer-id${NC}"
fi

# Clean build artifacts if requested
if [ "$CLEAN_BUILD" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"
    cd ios
    bundle exec fastlane clean
    cd ..
fi

# Navigate to iOS directory
cd ios

# Install/update Fastlane dependencies
echo -e "${YELLOW}📦 Installing Fastlane dependencies...${NC}"
bundle install

# Run health check
echo -e "${YELLOW}🏥 Running project health check...${NC}"
bundle exec fastlane health_check

# Deploy based on environment and options
case "$ENVIRONMENT" in
    development|qa)
        echo -e "${GREEN}🧪 Deploying to TestFlight (QA/Development)${NC}"
        if [ "$SKIP_PREBUILD" = true ]; then
            bundle exec fastlane quick_testflight
        else
            bundle exec fastlane deploy_qa
        fi
        ;;
    staging)
        echo -e "${BLUE}🎯 Deploying to TestFlight (Staging)${NC}"
        if [ "$SKIP_PREBUILD" = true ]; then
            bundle exec fastlane quick_testflight
        else
            bundle exec fastlane deploy_staging  
        fi
        ;;
    production)
        echo -e "${PURPLE}🚀 Deploying to TestFlight (Production)${NC}"
        read -p "Are you sure you want to deploy to production? (y/N): " confirm
        if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
            if [ "$SKIP_PREBUILD" = true ]; then
                bundle exec fastlane quick_testflight
            else
                bundle exec fastlane deploy_production
            fi
        else
            echo -e "${YELLOW}Deployment cancelled${NC}"
            exit 0
        fi
        ;;
    *)
        echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
        echo -e "${YELLOW}Valid environments: development, staging, production${NC}"
        exit 1
        ;;
esac

cd ..

echo -e "${GREEN}✅ TestFlight deployment completed!${NC}"
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "${CYAN}   1. Check App Store Connect for build processing status${NC}"
echo -e "${CYAN}   2. Add internal testers to 'Internal Testers' group${NC}"  
echo -e "${CYAN}   3. Send test invitation when ready${NC}"