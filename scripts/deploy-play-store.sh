#!/bin/bash
# scripts/deploy-play-store.sh
# HopMed Play Store deployment automation script

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
TRACK="alpha"
BUILD_TYPE="aab"
SKIP_PREBUILD=false
CLEAN_BUILD=false
AUTO_VERSION=true
VERSION_TYPE="patch"
AUTO_COMMIT=true
AUTO_TAG=true
SKIP_VALIDATION=false
FORCE_DEPLOY=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--track)
            TRACK="$2"
            shift 2
            ;;
        -b|--build-type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        --version-type)
            VERSION_TYPE="$2"
            shift 2
            ;;
        --no-auto-version)
            AUTO_VERSION=false
            shift
            ;;
        --no-auto-commit)
            AUTO_COMMIT=false
            shift
            ;;
        --no-auto-tag)
            AUTO_TAG=false
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --force)
            FORCE_DEPLOY=true
            shift
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
            echo "  -t, --track          Play Store track (internal|alpha|beta|production)"
            echo "  -b, --build-type     Build type (apk|aab)"
            echo "  --version-type       Version increment type (patch|minor|major)"
            echo "  --no-auto-version    Skip automatic version increment"
            echo "  --no-auto-commit     Skip automatic git commit of version changes"
            echo "  --no-auto-tag        Skip automatic git tag creation"
            echo "  --skip-prebuild      Skip Expo prebuild step"
            echo "  --skip-validation    Skip pre-deployment validation"
            echo "  --clean              Clean build artifacts before starting"
            echo "  --force              Force deployment even if validation fails"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 -e staging -t alpha -b aab"
            echo "  $0 -e production -t beta --skip-prebuild"
            echo "  $0 -e development -t internal -b apk --clean"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

# Enhanced validation and pre-flight functions
validate_dependencies() {
    echo -e "${YELLOW}🔍 Validating dependencies...${NC}"
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}❌ Node.js not installed${NC}"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "${RED}❌ npm not installed${NC}"
        exit 1
    fi
    
    # Check Expo CLI
    if ! command -v expo >/dev/null 2>&1; then
        echo -e "${YELLOW}📦 Installing Expo CLI...${NC}"
        npm install -g @expo/cli
    fi
    
    # Check Ruby and Bundler
    if ! command -v ruby >/dev/null 2>&1; then
        echo -e "${RED}❌ Ruby not installed${NC}"
        exit 1
    fi
    
    if ! gem list bundler -i >/dev/null 2>&1; then
        echo -e "${YELLOW}📦 Installing Bundler...${NC}"
        gem install bundler
    fi
    
    # Check Java
    if ! java -version >/dev/null 2>&1; then
        echo -e "${RED}❌ Java not installed${NC}"
        exit 1
    fi
    
    # Check Android SDK
    if [ -z "$ANDROID_HOME" ]; then
        echo -e "${RED}❌ ANDROID_HOME not set${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All dependencies validated${NC}"
}

get_current_version_info() {
    BUILD_GRADLE_PATH="android/app/build.gradle"
    
    if [ ! -f "$BUILD_GRADLE_PATH" ]; then
        echo -e "${RED}❌ build.gradle not found${NC}"
        exit 1
    fi
    
    VERSION_NAME=$(grep 'versionName' "$BUILD_GRADLE_PATH" | sed 's/.*versionName "\([^"]*\)".*/\1/')
    VERSION_CODE=$(grep 'versionCode' "$BUILD_GRADLE_PATH" | sed 's/.*versionCode \([0-9]*\).*/\1/')
    
    if [ -z "$VERSION_NAME" ] || [ -z "$VERSION_CODE" ]; then
        echo -e "${RED}❌ Could not extract version information${NC}"
        exit 1
    fi
}

increment_version() {
    local version_type="$1"
    local current_version="$VERSION_NAME"
    
    # Parse semantic version (major.minor.patch)
    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    local major=${VERSION_PARTS[0]:-0}
    local minor=${VERSION_PARTS[1]:-0}
    local patch=${VERSION_PARTS[2]:-0}
    
    case "$version_type" in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
        *)
            echo -e "${RED}❌ Invalid version type: $version_type${NC}"
            exit 1
            ;;
    esac
    
    NEW_VERSION_NAME="$major.$minor.$patch"
    NEW_VERSION_CODE=$((VERSION_CODE + 1))
    
    echo -e "${BLUE}📱 Version update: ${VERSION_NAME} (${VERSION_CODE}) → ${NEW_VERSION_NAME} (${NEW_VERSION_CODE})${NC}"
}

update_version_in_files() {
    local build_gradle="android/app/build.gradle"
    local package_json="package.json"
    
    # Update build.gradle
    sed -i.bak "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION_NAME\"/g" "$build_gradle"
    sed -i.bak "s/versionCode [0-9]*/versionCode $NEW_VERSION_CODE/g" "$build_gradle"
    
    # Update package.json
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION_NAME\"/g" "$package_json"
    
    # Remove backup files
    rm -f "${build_gradle}.bak" "${package_json}.bak"
    
    echo -e "${GREEN}✅ Version files updated${NC}"
}

commit_version_changes() {
    if [ "$AUTO_COMMIT" = false ]; then
        return 0
    fi
    
    # Check if git is initialized and clean
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Git not initialized, skipping commit${NC}"
        return 0
    fi
    
    # Stage version changes
    git add android/app/build.gradle package.json
    
    # Commit changes
    git commit -m "chore: bump version to ${NEW_VERSION_NAME} (${NEW_VERSION_CODE})

🤖 Auto-generated version bump for deployment
- Version Name: ${VERSION_NAME} → ${NEW_VERSION_NAME}
- Version Code: ${VERSION_CODE} → ${NEW_VERSION_CODE}
- Environment: ${ENVIRONMENT}
- Track: ${TRACK}"
    
    echo -e "${GREEN}✅ Version changes committed${NC}"
    
    # Create git tag if enabled
    if [ "$AUTO_TAG" = true ]; then
        local tag_name="v${NEW_VERSION_NAME}-${ENVIRONMENT}"
        git tag -a "$tag_name" -m "Release ${NEW_VERSION_NAME} for ${ENVIRONMENT} environment"
        echo -e "${GREEN}✅ Created git tag: ${tag_name}${NC}"
    fi
}

validate_play_store_config() {
    echo -e "${YELLOW}🎮 Validating Play Store configuration...${NC}"
    
    # Check service account JSON
    if [ ! -f "hopmed-6267f73d2683.json" ]; then
        echo -e "${RED}❌ Google Play service account JSON not found${NC}"
        echo -e "${YELLOW}💡 Download from: Google Play Console → Setup → API access${NC}"
        exit 1
    fi
    
    # Validate JSON content
    if command -v jq >/dev/null 2>&1; then
        if ! jq -e '.client_email' hopmed-6267f73d2683.json >/dev/null 2>&1; then
            echo -e "${RED}❌ Invalid service account JSON format${NC}"
            exit 1
        fi
        local client_email=$(jq -r '.client_email' hopmed-6267f73d2683.json)
        echo -e "${GREEN}✅ Service account: ${client_email}${NC}"
    fi
    
    # Check keystore
    if [ ! -f "release.keystore" ]; then
        echo -e "${RED}❌ Release keystore not found${NC}"
        echo -e "${YELLOW}💡 Generate with: ./generate-release-keystore.sh${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Play Store configuration validated${NC}"
}

echo -e "${BLUE}🚀 HopMed Play Store Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Track: ${TRACK}${NC}"
echo -e "${BLUE}Build type: ${BUILD_TYPE}${NC}"
echo -e "${BLUE}Version type: ${VERSION_TYPE}${NC}"
echo -e "${BLUE}Auto version: ${AUTO_VERSION}${NC}"
echo -e "${BLUE}Auto commit: ${AUTO_COMMIT}${NC}"
echo -e "${BLUE}Auto tag: ${AUTO_TAG}${NC}"
echo -e "${BLUE}Skip prebuild: ${SKIP_PREBUILD}${NC}"
echo -e "${BLUE}Clean build: ${CLEAN_BUILD}${NC}"

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Run comprehensive validation unless skipped
if [ "$SKIP_VALIDATION" = false ]; then
    validate_dependencies
    validate_play_store_config
else
    echo -e "${YELLOW}⚠️  Skipping validation (--skip-validation flag)${NC}"
fi

# Get current version information
get_current_version_info
echo -e "${BLUE}📱 Current version: ${VERSION_NAME} (${VERSION_CODE})${NC}"

# Handle automatic versioning
if [ "$AUTO_VERSION" = true ]; then
    increment_version "$VERSION_TYPE"
    update_version_in_files
    
    # Update global variables for use by Fastlane
    VERSION_NAME="$NEW_VERSION_NAME"
    VERSION_CODE="$NEW_VERSION_CODE"
fi

# Check if Android Fastlane is configured
if [ ! -f "android/fastlane/Fastfile" ]; then
    echo -e "${RED}❌ Android Fastlane not configured. Run setup first.${NC}"
    exit 1
fi

# Validate track parameter
case "$TRACK" in
    internal|alpha|beta|production)
        ;;
    *)
        echo -e "${RED}❌ Invalid track: $TRACK${NC}"
        echo -e "${YELLOW}Valid tracks: internal, alpha, beta, production${NC}"
        exit 1
        ;;
esac

# Validate build type
case "$BUILD_TYPE" in
    apk|aab)
        ;;
    *)
        echo -e "${RED}❌ Invalid build type: $BUILD_TYPE${NC}"
        echo -e "${YELLOW}Valid build types: apk, aab${NC}"
        exit 1
        ;;
esac

# Warning for production track
if [ "$TRACK" = "production" ]; then
    echo -e "${RED}⚠️  WARNING: You are deploying to PRODUCTION track!${NC}"
    echo -e "${YELLOW}This will make the app available to all users.${NC}"
    read -p "Are you sure you want to continue? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deployment cancelled${NC}"
        exit 0
    fi
fi

# Clean build artifacts if requested
if [ "$CLEAN_BUILD" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"
    cd android
    bundle exec fastlane clean
    cd ..
fi

# Ensure Fastlane configuration is in place (auto-restore after expo prebuild)
echo -e "${YELLOW}🔄 Ensuring Fastlane configuration is in place...${NC}"
if [ ! -f "android/fastlane/Fastfile" ] || [ ! -f "android/Gemfile" ]; then
    echo -e "${YELLOW}⚠️  Fastlane configuration missing, restoring from templates...${NC}"
    ./scripts/restore-fastlane-android.sh
else
    echo -e "${GREEN}✅ Fastlane configuration found${NC}"
fi

# Navigate to Android directory
cd android

# Install/update Fastlane dependencies
echo -e "${YELLOW}📦 Installing/updating Fastlane dependencies...${NC}"
bundle install

# Run health check
echo -e "${YELLOW}🏥 Running project health check...${NC}"
bundle exec fastlane health_check

# Commit version changes before deployment
cd ..
if [ "$AUTO_VERSION" = true ]; then
    commit_version_changes
fi
cd android

# Deploy based on environment and options
echo -e "${YELLOW}🚀 Starting deployment...${NC}"
DEPLOYMENT_START_TIME=$(date +%s)
case "$ENVIRONMENT" in
    development|qa)
        echo -e "${GREEN}🧪 Deploying to Play Store (QA/Development)${NC}"
        if [ "$SKIP_PREBUILD" = true ]; then
            bundle exec fastlane quick_play_store track:$TRACK build_type:$BUILD_TYPE
        else
            bundle exec fastlane deploy_qa
        fi
        ;;
    staging)
        echo -e "${BLUE}🎯 Deploying to Play Store (Staging)${NC}"
        if [ "$SKIP_PREBUILD" = true ]; then
            bundle exec fastlane quick_play_store track:$TRACK build_type:$BUILD_TYPE
        else
            bundle exec fastlane deploy_staging
        fi
        ;;
    production)
        echo -e "${PURPLE}🚀 Deploying to Play Store (Production)${NC}"
        if [ "$TRACK" = "production" ]; then
            bundle exec fastlane release_production
        elif [ "$SKIP_PREBUILD" = true ]; then
            bundle exec fastlane quick_play_store track:$TRACK build_type:$BUILD_TYPE
        else
            bundle exec fastlane deploy_production
        fi
        ;;
    *)
        echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
        echo -e "${YELLOW}Valid environments: development, staging, production${NC}"
        exit 1
        ;;
esac

cd ..

# Calculate deployment time
DEPLOYMENT_END_TIME=$(date +%s)
DEPLOYMENT_DURATION=$((DEPLOYMENT_END_TIME - DEPLOYMENT_START_TIME))
DEPLOYMENT_MINUTES=$((DEPLOYMENT_DURATION / 60))
DEPLOYMENT_SECONDS=$((DEPLOYMENT_DURATION % 60))

# Check deployment status
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "${BLUE}⏱️  Deployment time: ${DEPLOYMENT_MINUTES}m ${DEPLOYMENT_SECONDS}s${NC}"
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo -e "${YELLOW}🔄 Consider rolling back version changes if needed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Play Store deployment completed!${NC}"
echo -e "${BLUE}📱 Version deployed: ${VERSION_NAME} (${VERSION_CODE})${NC}"
echo -e "${BLUE}🎯 Environment: ${ENVIRONMENT} → Track: ${TRACK}${NC}"
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "${CYAN}   1. Check Google Play Console for build processing status${NC}"
echo -e "${CYAN}   2. Review and approve the release in Play Console${NC}"
echo -e "${CYAN}   3. Add internal testers if using internal track${NC}"
echo -e "${CYAN}   4. Monitor crash reports and user feedback${NC}"
echo -e "${CYAN}   5. Push git changes: git push origin $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")${NC}"
echo -e "${CYAN}   6. Push git tags: git push origin --tags${NC}"

# Track-specific next steps
case "$TRACK" in
    internal)
        echo -e "${CYAN}   • Internal track: Add testers via email addresses${NC}"
        ;;
    alpha)
        echo -e "${CYAN}   • Alpha track: Create opt-in URL for testers${NC}"
        echo -e "${CYAN}   • Share URL: https://play.google.com/apps/testing/com.lns.hopmed${NC}"
        ;;
    beta)
        echo -e "${CYAN}   • Beta track: Create opt-in URL or open testing${NC}"
        echo -e "${CYAN}   • Share URL: https://play.google.com/apps/testing/com.lns.hopmed${NC}"
        ;;
    production)
        echo -e "${PURPLE}   🚀 Production track: App will be available to all users!${NC}"
        echo -e "${PURPLE}   📊 Monitor Play Console for rollout status${NC}"
        ;;
esac

echo -e "${BLUE}🔗 Useful links:${NC}"
echo -e "${CYAN}   • Play Console: https://play.google.com/console/developers${NC}"
echo -e "${CYAN}   • App Dashboard: https://play.google.com/console/developers${NC}"
echo -e "${CYAN}   • Release Management: https://play.google.com/console/developers${NC}"

echo -e "${GREEN}🎯 Deployment summary:${NC}"
echo -e "${BLUE}📱 App: HopMed (com.lns.hopmed)${NC}"
echo -e "${BLUE}🏷️  Version: ${VERSION_NAME} (${VERSION_CODE})${NC}"
echo -e "${BLUE}🌍 Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}🛤️  Track: ${TRACK}${NC}"
echo -e "${BLUE}📦 Build Type: ${BUILD_TYPE}${NC}"
echo -e "${BLUE}⏱️  Duration: ${DEPLOYMENT_MINUTES}m ${DEPLOYMENT_SECONDS}s${NC}"
echo -e "${BLUE}📅 Timestamp: $(date)${NC}"
echo -e "${GREEN}🎉 HopMed deployment automation completed successfully!${NC}"