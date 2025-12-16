#!/bin/bash
# scripts/build-play-store-manual.sh
# Build .aab or .apk for manual Play Console upload
# Senior Engineer: Comprehensive build script with proper signing and validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Script configuration
SCRIPT_NAME="build-play-store-manual.sh"
BUILD_TYPE="aab"  # Default to AAB (recommended for Play Store)
ENVIRONMENT="staging"
CLEAN_BUILD=true
SKIP_SENTRY=false
VERBOSE=false

# Help function
show_help() {
    echo -e "${CYAN}🏥 HopMed Play Store Manual Build Script${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE        Build type: aab (default) or apk"
    echo "  -e, --env ENV          Environment: development, staging, production"
    echo "  -c, --clean            Clean build (default: true)"
    echo "  -s, --skip-sentry      Skip Sentry integration"
    echo "  -v, --verbose          Verbose output"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Build AAB for staging"
    echo "  $0 -t apk -e production              # Build APK for production"
    echo "  $0 --type aab --env development      # Build AAB for development"
    echo ""
    echo "Build Types:"
    echo "  aab  - Android App Bundle (recommended for Play Store)"
    echo "  apk  - Android Package Kit (legacy format)"
    echo ""
    echo "Environments:"
    echo "  development - Internal testing track"
    echo "  staging     - Alpha testing track"
    echo "  production  - Beta testing track"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--clean)
            CLEAN_BUILD="$2"
            shift 2
            ;;
        -s|--skip-sentry)
            SKIP_SENTRY=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Validate build type
if [[ "$BUILD_TYPE" != "aab" && "$BUILD_TYPE" != "apk" ]]; then
    echo -e "${RED}❌ Invalid build type: $BUILD_TYPE${NC}"
    echo "Valid types: aab, apk"
    exit 1
fi

# Validate environment
if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo "Valid environments: development, staging, production"
    exit 1
fi

# Header
echo -e "${CYAN}🏥 HopMed Play Store Manual Build${NC}"
echo -e "${BLUE}Build Type: $(echo ${BUILD_TYPE} | tr '[:lower:]' '[:upper:]')${NC}"
echo -e "${BLUE}Environment: $(echo ${ENVIRONMENT} | tr '[:lower:]' '[:upper:]')${NC}"
echo -e "${BLUE}Clean Build: ${CLEAN_BUILD}${NC}"
echo -e "${BLUE}Sentry: $([ "$SKIP_SENTRY" = true ] && echo "Disabled" || echo "Enabled")${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root${NC}"
    exit 1
fi

# Check if Android SDK is set up
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${YELLOW}⚠️  ANDROID_HOME not set. Please run setup-android-macos.sh first${NC}"
    exit 1
fi

# Check required files
echo -e "${YELLOW}🔍 Checking required files...${NC}"

REQUIRED_FILES=(
    "android/app/build.gradle"
    "android/gradle.properties"
    "release.keystore"
    "hopmed-6267f73d2683.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file missing${NC}"
        exit 1
    fi
done

# Set keystore configuration as environment variables (Expo-safe approach)
echo -e "${YELLOW}🔑 Setting keystore configuration...${NC}"
export HOPMED_RELEASE_STORE_FILE="release.keystore"
export HOPMED_RELEASE_KEY_ALIAS="release"
export HOPMED_RELEASE_STORE_PASSWORD="lN\$2025!"
export HOPMED_RELEASE_KEY_PASSWORD="lN\$2025!"
echo -e "${GREEN}✅ Keystore configuration set as environment variables${NC}"

# 🔧 NEW: Set runtime environment for Firebase FCM fix
echo -e "${YELLOW}🌍 Setting runtime environment: ${ENVIRONMENT}${NC}"
export HOPMED_BUILD_ENVIRONMENT="${ENVIRONMENT}"
export NODE_ENV="${ENVIRONMENT}"
echo -e "${GREEN}✅ Runtime environment set as environment variables${NC}"

# Check service account JSON
echo -e "${YELLOW}🎮 Validating Google Play service account...${NC}"
if command -v jq >/dev/null 2>&1; then
    if jq -e '.client_email' hopmed-6267f73d2683.json >/dev/null 2>&1; then
        CLIENT_EMAIL=$(jq -r '.client_email' hopmed-6267f73d2683.json)
        echo -e "${GREEN}✅ Google Play service account: $CLIENT_EMAIL${NC}"
    else
        echo -e "${RED}❌ Invalid service account JSON${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  jq not installed, skipping JSON validation${NC}"
fi

# Get version info from app.config.js (source of truth for Expo)
echo -e "${YELLOW}📱 Getting app version information from app.config.js...${NC}"
if [ ! -f "app.config.js" ]; then
    echo -e "${RED}❌ app.config.js not found${NC}"
    exit 1
fi

# Extract current version from app.config.js
VERSION_NAME=$(grep -E "^\s*version:" app.config.js | sed "s/.*version: '\([^']*\)'.*/\1/")
CURRENT_VERSION_CODE=$(grep -E "^\s*versionCode:" app.config.js | sed 's/.*versionCode: \([0-9]*\).*/\1/')
PACKAGE_NAME="com.lns.hopmed"  # Fixed package name

# Auto-increment versionCode
NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))

echo -e "${GREEN}📦 Package: $PACKAGE_NAME${NC}"
echo -e "${GREEN}🏷️  Version Name: $VERSION_NAME${NC}"
echo -e "${BLUE}🔢 Current Version Code: $CURRENT_VERSION_CODE${NC}"
echo -e "${CYAN}🚀 New Version Code: $NEW_VERSION_CODE (auto-incremented)${NC}"

# Update app.config.js with new versionCode
echo -e "${YELLOW}📝 Updating app.config.js with new versionCode...${NC}"
sed -i.bak "s/versionCode: $CURRENT_VERSION_CODE,/versionCode: $NEW_VERSION_CODE,/" app.config.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ app.config.js updated: versionCode $CURRENT_VERSION_CODE → $NEW_VERSION_CODE${NC}"
    rm -f app.config.js.bak
else
    echo -e "${RED}❌ Failed to update app.config.js${NC}"
    exit 1
fi

# Store version code for gradle
VERSION_CODE=$NEW_VERSION_CODE

# 🔧 CRITICAL: Always prebuild to sync app.config.js changes to Android native files
echo -e "${YELLOW}📦 Running expo prebuild to sync version and configuration...${NC}"
echo -e "${BLUE}   This ensures gradle files reflect the updated versionCode ($VERSION_CODE)${NC}"
npx expo prebuild --platform android --clean
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Prebuild completed successfully${NC}"
else
    echo -e "${RED}❌ Prebuild failed${NC}"
    exit 1
fi

# 🔐 CRITICAL: Copy keystore to android directory (prebuild may have cleaned it)
echo -e "${YELLOW}🔐 Copying keystore to android directory...${NC}"
cp release.keystore android/release.keystore
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Keystore copied to android/release.keystore${NC}"
else
    echo -e "${RED}❌ Failed to copy keystore${NC}"
    exit 1
fi

# Change to android directory
cd android

# Clean build if requested
if [ "$CLEAN_BUILD" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
    ./gradlew clean
    echo -e "${GREEN}✅ Clean completed${NC}"
fi

# Set Sentry environment variables
if [ "$SKIP_SENTRY" = true ]; then
    echo -e "${YELLOW}🔧 Disabling Sentry for this build...${NC}"
    export SENTRY_DISABLE=1
    export ENABLE_SENTRY=false
    SENTRY_FLAGS="-PsentryEnabled=false"
else
    echo -e "${GREEN}🔧 Sentry enabled for this build${NC}"
    SENTRY_FLAGS=""
fi

# Build the app
echo -e "${YELLOW}🔨 Building $(echo ${BUILD_TYPE} | tr '[:lower:]' '[:upper:]') for $(echo ${ENVIRONMENT} | tr '[:lower:]' '[:upper:]')...${NC}"

if [ "$BUILD_TYPE" = "aab" ]; then
    echo -e "${BLUE}📦 Building Android App Bundle (AAB) with versionCode=$VERSION_CODE...${NC}"
    ./gradlew bundleRelease $SENTRY_FLAGS --stacktrace
    
    # Check if build was successful
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ AAB built successfully!${NC}"
        
        # Find the AAB file
        AAB_PATH=$(find app/build/outputs/bundle/release -name "*.aab" | head -1)
        if [ -n "$AAB_PATH" ]; then
            SIZE=$(ls -lh "$AAB_PATH" | awk '{print $5}')
            echo -e "${GREEN}📱 AAB location: $AAB_PATH${NC}"
            echo -e "${GREEN}📏 AAB size: $SIZE${NC}"
            
            # Copy to project root for easy access
            cp "$AAB_PATH" "../hopmed-${VERSION_NAME}-${VERSION_CODE}-${ENVIRONMENT}.aab"
            echo -e "${GREEN}📋 Copied to: hopmed-${VERSION_NAME}-${VERSION_CODE}-${ENVIRONMENT}.aab${NC}"
        else
            echo -e "${RED}❌ AAB file not found${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ AAB build failed${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}📦 Building Android Package (APK)...${NC}"
    ./gradlew assembleRelease $SENTRY_FLAGS --stacktrace
    
    # Check if build was successful
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ APK built successfully!${NC}"
        
        # Find the APK file
        APK_PATH="app/build/outputs/apk/release/app-release.apk"
        if [ -f "$APK_PATH" ]; then
            SIZE=$(ls -lh "$APK_PATH" | awk '{print $5}')
            echo -e "${GREEN}📱 APK location: $APK_PATH${NC}"
            echo -e "${GREEN}📏 APK size: $SIZE${NC}"
            
            # Copy to project root for easy access
            cp "$APK_PATH" "../hopmed-${VERSION_NAME}-${VERSION_CODE}-${ENVIRONMENT}.apk"
            echo -e "${GREEN}📋 Copied to: hopmed-${VERSION_NAME}-${VERSION_CODE}-${ENVIRONMENT}.apk${NC}"
        else
            echo -e "${RED}❌ APK file not found${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ APK build failed${NC}"
        exit 1
    fi
fi

# Return to project root
cd ..

# Final summary
echo ""
echo -e "${CYAN}🎉 Build Summary${NC}"
echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo -e "${BLUE}📱 Build Type: $(echo ${BUILD_TYPE} | tr '[:lower:]' '[:upper:]')${NC}"
echo -e "${BLUE}🌍 Environment: $(echo ${ENVIRONMENT} | tr '[:lower:]' '[:upper:]')${NC}"
echo -e "${BLUE}📦 Package: $PACKAGE_NAME${NC}"
echo -e "${BLUE}🏷️  Version: $VERSION_NAME ($VERSION_CODE)${NC}"

if [ "$BUILD_TYPE" = "aab" ]; then
    echo -e "${GREEN}📋 AAB File: hopmed-${VERSION_NAME}-${VERSION_CODE}-${ENVIRONMENT}.aab${NC}"
    echo ""
    echo -e "${YELLOW}💡 Next Steps:${NC}"
    echo -e "   1. Upload the AAB file to Google Play Console"
    echo -e "   2. Go to: https://play.google.com/console/developers"
    echo -e "   3. Select your app: $PACKAGE_NAME"
    echo -e "   4. Go to 'Production' → 'Create new release'"
    echo -e "   5. Upload the AAB file and fill in release notes"
    echo -e "   6. Review and roll out to your desired track"
else
    echo -e "${GREEN}📋 APK File: hopmed-${VERSION_NAME}-${VERSION_CODE}-${ENVIRONMENT}.apk${NC}"
    echo ""
    echo -e "${YELLOW}💡 Next Steps:${NC}"
    echo -e "   1. Upload the APK file to Google Play Console"
    echo -e "   2. Go to: https://play.google.com/console/developers"
    echo -e "   3. Select your app: $PACKAGE_NAME"
    echo -e "   4. Go to 'Testing' → 'Internal testing' or 'Closed testing'"
    echo -e "   5. Upload the APK file and create a new release"
    echo -e "   6. Add testers and roll out"
fi

echo ""
echo -e "${PURPLE}🔧 Build Configuration:${NC}"
echo -e "   • Clean Build: $CLEAN_BUILD"
echo -e "   • Sentry: $([ "$SKIP_SENTRY" = true ] && echo "Disabled" || echo "Enabled")"
echo -e "   • Keystore: release.keystore"
echo -e "   • Service Account: hopmed-6267f73d2683.json"

echo ""
echo -e "${GREEN}🎯 Ready for Play Console upload!${NC}"
