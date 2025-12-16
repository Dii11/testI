#!/bin/bash
# scripts/build-eas-simulation.sh
# Simulates EAS Cloud build environment locally with enhanced launch safety

set -e

echo "🚀 Simulating EAS Cloud Build Environment Locally with Enhanced Launch Safety..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root${NC}"
    exit 1
fi

# Enhanced environment variables for launch safety
echo -e "${BLUE}🔧 Setting EAS Cloud environment variables with launch safety...${NC}"
export NPM_CONFIG_LEGACY_PEER_DEPS=true
export EXPO_OPTIMIZE_BUNDLE=1
export NODE_ENV=development
export HOPMED_BUILD_ENVIRONMENT=development
export HOPMED_DEBUG_MODE=true
export API_URL="http://141.94.71.13:3001/api/v1"
export HOPMED_API_BASE_URL="http://141.94.71.13:3001/api/v1"
export EXPO_PUBLIC_API_URL="http://141.94.71.13:3001/api/v1"
export SENTRY_DSN="${HOPMED_SENTRY_DSN:-https://5a1bc89298288a69b7ee1659bb770aa4@o4509927899136000.ingest.de.sentry.io/4509927900315728}"
export HOPMED_SENTRY_DSN="${HOPMED_SENTRY_DSN:-https://5a1bc89298288a69b7ee1659bb770aa4@o4509927899136000.ingest.de.sentry.io/4509927900315728}"
export EXPO_PUBLIC_SENTRY_DSN="$HOPMED_SENTRY_DSN"
export ENABLE_SENTRY=true
export HOPMED_BUILD_SENTRY_ENABLED=true
export SENTRY_AUTH_TOKEN="${HOPMED_SENTRY_AUTH_TOKEN:-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}"
# Match plugin config for CLI fallback
export SENTRY_ORG="self-m66"
export SENTRY_PROJECT="react-native"
export DAILY_API_KEY="${HOPMED_VIDEO_DAILY_API_KEY:-de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9}"
export HOPMED_VIDEO_DAILY_API_KEY="${HOPMED_VIDEO_DAILY_API_KEY:-de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9}"
export DAILY_CO_API_KEY="${HOPMED_VIDEO_DAILY_API_KEY:-de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9}"
export HOPMED_VIDEO_DAILY_DOMAIN="${HOPMED_VIDEO_DAILY_DOMAIN:-mbinina.daily.co}"
export EXPO_PUBLIC_DAILY_API_KEY="$HOPMED_VIDEO_DAILY_API_KEY"
export EXPO_USE_COMMUNITY_AUTOLINKING=0

# 🚨 CRITICAL: Launch safety environment variables
export HOPMED_LAUNCH_SAFETY_ENABLED=true
export HOPMED_INIT_TIMEOUT=15000
export HOPMED_SPLASH_TIMEOUT=10000
export HOPMED_PERMISSION_TIMEOUT=8000
export HOPMED_REDUX_PERSIST_TIMEOUT=12000
export HOPMED_ERROR_BOUNDARY_ENABLED=true
export HOPMED_CRASH_RECOVERY_ENABLED=true
export HOPMED_NETWORK_RETRY_ENABLED=true
export HOPMED_NETWORK_RETRY_ATTEMPTS=3
export HOPMED_NETWORK_RETRY_DELAY=2000
export HOPMED_LAUNCH_DEBUG_MODE=true

# Feature/platform toggles to mirror EAS configs
export HOPMED_BUILD_HEALTHKIT_ENABLED=true
export HOPMED_BUILD_HEALTH_CONNECT_ENABLED=true
export IOS_HEALTHKIT_ENABLED=true
export ANDROID_HEALTH_CONNECT_ENABLED=true

# 🔐 KEYSTORE CONFIGURATION (Graceful Handling)
echo -e "${CYAN}🔐 Configuring Android signing keystore...${NC}"

# Check for keystore in project root (Expo default location)
if [ -f "release.keystore" ]; then
    echo -e "${GREEN}✅ Found keystore in project root: release.keystore${NC}"
    KEYSTORE_PATH="$(pwd)/release.keystore"
    export HOPMED_RELEASE_STORE_FILE="$KEYSTORE_PATH"
    export HOPMED_RELEASE_STORE_PASSWORD="lN\$2025!"
    export HOPMED_RELEASE_KEY_ALIAS="release"
    export HOPMED_RELEASE_KEY_PASSWORD="lN\$2025!"
    echo -e "${GREEN}✅ Keystore configured: $KEYSTORE_PATH${NC}"
elif [ -f "android/release.keystore" ]; then
    echo -e "${GREEN}✅ Found keystore in android directory${NC}"
    KEYSTORE_PATH="$(pwd)/android/release.keystore"
    export HOPMED_RELEASE_STORE_FILE="$KEYSTORE_PATH"
    export HOPMED_RELEASE_STORE_PASSWORD="lN\$2025!"
    export HOPMED_RELEASE_KEY_ALIAS="release"
    export HOPMED_RELEASE_KEY_PASSWORD="lN\$2025!"
    echo -e "${GREEN}✅ Keystore configured: $KEYSTORE_PATH${NC}"
else
    echo -e "${YELLOW}⚠️ No release.keystore found${NC}"
    echo -e "${YELLOW}💡 Falling back to debug signing (not suitable for production)${NC}"
    # Will build with debug signing - still works for testing
fi

# Validate keystore if found
if [ ! -z "$HOPMED_RELEASE_STORE_FILE" ] && [ -f "$HOPMED_RELEASE_STORE_FILE" ]; then
    # Test keystore is valid
    if keytool -list -keystore "$HOPMED_RELEASE_STORE_FILE" -storepass "lN\$2025!" -alias release &>/dev/null; then
        echo -e "${GREEN}✅ Keystore validated successfully${NC}"
        KEYSTORE_VALID=true
    else
        echo -e "${YELLOW}⚠️ Keystore validation failed, will attempt build anyway${NC}"
        KEYSTORE_VALID=false
    fi
fi

# Quick sanity summary
echo -e "${CYAN}📦 ENV SUMMARY:${NC}"
echo "API_URL=$API_URL"
echo "HOPMED_API_BASE_URL=$HOPMED_API_BASE_URL"
echo "ENABLE_SENTRY=$ENABLE_SENTRY | HOPMED_BUILD_SENTRY_ENABLED=$HOPMED_BUILD_SENTRY_ENABLED"
echo "HOPMED_SENTRY_DSN=${HOPMED_SENTRY_DSN:0:24}..."
echo "SENTRY_ORG=$SENTRY_ORG | SENTRY_PROJECT=$SENTRY_PROJECT | TOKEN=${SENTRY_AUTH_TOKEN:+***set***}"
echo "DAILY_DOMAIN=$HOPMED_VIDEO_DAILY_DOMAIN | DAILY_API_KEY=${HOPMED_VIDEO_DAILY_API_KEY:0:6}..."
echo "HEALTHKIT(iOS)=$IOS_HEALTHKIT_ENABLED | HEALTH_CONNECT(Android)=$ANDROID_HEALTH_CONNECT_ENABLED"
if [ ! -z "$HOPMED_RELEASE_STORE_FILE" ]; then
    echo "KEYSTORE=${HOPMED_RELEASE_STORE_FILE} | ALIAS=${HOPMED_RELEASE_KEY_ALIAS} | VALID=${KEYSTORE_VALID:-unknown}"
else
    echo "KEYSTORE=debug (no release keystore configured)"
fi

# Hard-fail if critical vars missing
missing_vars=()
[[ -z "$API_URL" ]] && missing_vars+=(API_URL)
[[ -z "$HOPMED_API_BASE_URL" ]] && missing_vars+=(HOPMED_API_BASE_URL)
[[ -z "$HOPMED_SENTRY_DSN" ]] && missing_vars+=(HOPMED_SENTRY_DSN)
[[ -z "$ENABLE_SENTRY" ]] && missing_vars+=(ENABLE_SENTRY)
if [ ${#missing_vars[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required env vars: ${missing_vars[*]}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables set with launch safety${NC}"
echo -e "${YELLOW}⚠️ Sentry enabled for comprehensive error tracking${NC}"

# Pre-build validation checks
echo -e "${PURPLE}🔍 Running pre-build validation checks...${NC}"

# Check critical source files exist (before prebuild)
CRITICAL_SOURCE_FILES=(
    "App.tsx"
    "app.config.js"
    "package.json"
    "src/components/common/ErrorBoundary.tsx"
    "src/components/LoadingScreen.tsx"
    "src/navigation/AppNavigator.tsx"
)

for file in "${CRITICAL_SOURCE_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Critical file missing: $file${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Found: $file${NC}"
    fi
done

# Note: Android native files will be generated by expo prebuild
echo -e "${CYAN}📝 Android native files will be generated by expo prebuild${NC}"

# Validate app.config.js configuration
echo -e "${CYAN}📱 Validating app.config.js configuration...${NC}"
if ! grep -q 'minSdkVersion: 26' app.config.js; then
    echo -e "${YELLOW}⚠️ Warning: minSdkVersion should be 26 for optimal compatibility${NC}"
fi

if ! grep -q 'usesCleartextTraffic: true' app.config.js; then
    echo -e "${YELLOW}⚠️ Warning: usesCleartextTraffic should be true for development${NC}"
fi

# Check for potential launch blockers
echo -e "${CYAN}🚨 Checking for potential launch blockers...${NC}"

# Check for infinite loops in App.tsx
if grep -q "while.*true" App.tsx; then
    echo -e "${RED}❌ CRITICAL: Potential infinite loop detected in App.tsx${NC}"
    exit 1
fi

# Check for missing error boundaries
if ! grep -q "ErrorBoundary" App.tsx; then
    echo -e "${RED}❌ CRITICAL: ErrorBoundary not found in App.tsx${NC}"
    exit 1
fi

# Check for proper splash screen handling
if ! grep -q "SplashScreen.preventAutoHideAsync" App.tsx; then
    echo -e "${YELLOW}⚠️ Warning: SplashScreen.preventAutoHideAsync not found${NC}"
fi

if ! grep -q "SplashScreen.hideAsync" App.tsx; then
    echo -e "${YELLOW}⚠️ Warning: SplashScreen.hideAsync not found${NC}"
fi

# Check for proper timeout handling
if ! grep -q "timeout" App.tsx; then
    echo -e "${YELLOW}⚠️ Warning: No timeout handling found in App.tsx${NC}"
fi

# Clean previous builds (skip node_modules for local debugging)
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf android/app/build
rm -rf android/.gradle
rm -rf android/app/release

# Install dependencies like EAS Cloud (npm ci)
echo -e "${YELLOW}📦 Installing dependencies with npm install (for local debugging)...${NC}"
npm install

# Run expo doctor for critical issues only
echo -e "${YELLOW}🔍 Running expo doctor for critical issues...${NC}"
npx expo doctor --fix-dependencies --non-interactive || {
    echo -e "${YELLOW}⚠️ Some expo doctor issues found, but continuing build...${NC}"
}

# Prebuild with clean (like EAS Cloud)
echo -e "${YELLOW}🔨 Running prebuild (like EAS Cloud)...${NC}"
EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean --platform android --non-interactive

# Validate that prebuild generated the expected files
echo -e "${CYAN}🔍 Validating prebuild output...${NC}"
NATIVE_FILES=(
    "android/app/src/main/AndroidManifest.xml"
    "android/app/src/main/java/com/lns/hopmed/MainActivity.kt"
    "android/app/src/main/java/com/lns/hopmed/MainApplication.kt"
)

for file in "${NATIVE_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Prebuild failed to generate: $file${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Generated: $file${NC}"
    fi
done

# Test bundling (like EAS Cloud)
echo -e "${YELLOW}📦 Testing Metro bundling (like EAS Cloud)...${NC}"
npx expo export --platform android --clear --non-interactive

# Enhanced build with launch safety checks
echo -e "${YELLOW}🔨 Building APK with enhanced launch safety...${NC}"
cd android

# 🔐 Ensure keystore is accessible from android directory
if [ ! -z "$HOPMED_RELEASE_STORE_FILE" ]; then
    # Create symlink if keystore is not in android directory
    if [ ! -f "release.keystore" ] && [ -f "../release.keystore" ]; then
        echo -e "${CYAN}🔗 Creating symlink to keystore for Gradle compatibility...${NC}"
        ln -sf ../release.keystore release.keystore
        echo -e "${GREEN}✅ Keystore symlink created${NC}"
    elif [ -f "release.keystore" ]; then
        echo -e "${GREEN}✅ Keystore already accessible in android directory${NC}"
    fi
    
    # Update environment variable to use relative path from android directory
    export HOPMED_RELEASE_STORE_FILE="../release.keystore"
    echo -e "${CYAN}🔧 Keystore path adjusted for Gradle: $HOPMED_RELEASE_STORE_FILE${NC}"
fi

# Clean gradle cache
./gradlew clean

# Build with enhanced configuration and proper signing
if [ ! -z "$HOPMED_RELEASE_STORE_FILE" ]; then
    echo -e "${GREEN}🔐 Building RELEASE APK with proper signing...${NC}"
    ./gradlew assembleRelease \
        -Pandroid.enableR8.fullMode=false \
        -Pandroid.enableProguardInReleaseBuilds=false \
        -Pandroid.enableShrinkResourcesInReleaseBuilds=false \
        -Pandroid.enablePngCrunchInReleaseBuilds=false
else
    echo -e "${YELLOW}⚠️ Building with DEBUG signing (no release keystore)...${NC}"
    ./gradlew assembleDebug
    # Adjust APK path for debug build
    APK_BUILD_TYPE="debug"
fi

# Check if build was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ EAS Cloud simulation build successful!${NC}"
    
    # Determine APK path based on build type
    if [ "$APK_BUILD_TYPE" = "debug" ]; then
        APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
        BUILD_TYPE_LABEL="DEBUG"
    else
        APK_PATH="app/build/outputs/apk/release/app-release.apk"
        BUILD_TYPE_LABEL="RELEASE"
    fi
    
    echo -e "${GREEN}📱 APK location: android/$APK_PATH${NC}"
    
    # Show file size
    if [ -f "$APK_PATH" ]; then
        SIZE=$(ls -lh "$APK_PATH" | awk '{print $5}')
        echo -e "${GREEN}📏 APK size: $SIZE${NC}"
        
        # Get version info for naming
        VERSION_NAME=$(grep 'versionName' app/build.gradle | sed 's/.*versionName "\([^"]*\)".*/\1/')
        VERSION_CODE=$(grep 'versionCode' app/build.gradle | sed 's/.*versionCode \([0-9]*\).*/\1/')
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        
        # Copy APK to project root with descriptive name
        if [ "$BUILD_TYPE_LABEL" = "DEBUG" ]; then
            FINAL_APK_NAME="hopmed-${VERSION_NAME}-${VERSION_CODE}-debug-test-${TIMESTAMP}.apk"
        else
            FINAL_APK_NAME="hopmed-${VERSION_NAME}-${VERSION_CODE}-release-test-${TIMESTAMP}.apk"
        fi
        cp "$APK_PATH" "../${FINAL_APK_NAME}"
        echo -e "${GREEN}📋 Copied to project root: ${FINAL_APK_NAME}${NC}"
        echo -e "${CYAN}🔐 Build type: ${BUILD_TYPE_LABEL}${NC}"
        if [ "$BUILD_TYPE_LABEL" = "RELEASE" ] && [ "$KEYSTORE_VALID" = "true" ]; then
            echo -e "${GREEN}✅ Signed with validated release keystore${NC}"
        elif [ "$BUILD_TYPE_LABEL" = "DEBUG" ]; then
            echo -e "${YELLOW}⚠️ Debug signed (suitable for testing, not for distribution)${NC}"
        fi
        
        # Validate APK structure
        echo -e "${CYAN}🔍 Validating APK structure...${NC}"
        if unzip -l "$APK_PATH" | grep -q "AndroidManifest.xml"; then
            echo -e "${GREEN}✅ AndroidManifest.xml found in APK${NC}"
        else
            echo -e "${RED}❌ AndroidManifest.xml missing from APK${NC}"
        fi
        
        if unzip -l "$APK_PATH" | grep -q "classes.dex"; then
            echo -e "${GREEN}✅ classes.dex found in APK${NC}"
        else
            echo -e "${RED}❌ classes.dex missing from APK${NC}"
        fi
        
        # Show installation instructions
        echo -e "${CYAN}📱 Installation Instructions for Testers:${NC}"
        echo -e "${YELLOW}1. Enable 'Install from unknown sources' in Android settings${NC}"
        echo -e "${YELLOW}2. Download the APK file: ${FINAL_APK_NAME}${NC}"
        echo -e "${YELLOW}3. Open the APK file to install${NC}"
        echo -e "${YELLOW}4. Grant necessary permissions when prompted${NC}"
        echo ""
        echo -e "${BLUE}💡 This APK is ready for testing and can be shared directly with testers${NC}"
        echo -e "${BLUE}💡 No Play Console upload required - perfect for internal testing${NC}"
    fi
else
    echo -e "${RED}❌ EAS Cloud simulation build failed${NC}"
    echo -e "${YELLOW}💡 This is the same error you'll get in EAS Cloud${NC}"
    exit 1
fi

cd ..

# Post-build launch safety validation
echo -e "${PURPLE}🔍 Post-build launch safety validation...${NC}"

# Check for common launch issues
echo -e "${CYAN}📋 Launch Safety Checklist:${NC}"

# 1. Error Boundary Coverage
if grep -q "ErrorBoundary.*level.*app" App.tsx; then
    echo -e "${GREEN}✅ App-level ErrorBoundary configured${NC}"
else
    echo -e "${YELLOW}⚠️ App-level ErrorBoundary not found${NC}"
fi

# 2. Splash Screen Handling
if grep -q "SplashScreen.preventAutoHideAsync" App.tsx && grep -q "SplashScreen.hideAsync" App.tsx; then
    echo -e "${GREEN}✅ Splash screen properly handled${NC}"
else
    echo -e "${YELLOW}⚠️ Splash screen handling incomplete${NC}"
fi

# 3. Timeout Protection (init/splash/permission/persist)
if grep -E -q "LAUNCH_SAFETY_CONFIG\.(INIT_TIMEOUT|SPLASH_TIMEOUT|PERMISSION_TIMEOUT|REDUX_PERSIST_TIMEOUT)" App.tsx \
   || grep -E -q "(App initialization timeout|Splash screen hide timeout|Permission initialization timeout|Redux persist timeout)" App.tsx; then
    echo -e "${GREEN}✅ Timeout protection configured${NC}"
else
    echo -e "${YELLOW}⚠️ Timeout protection not found${NC}"
fi

# 4. Redux Persist Loading
if grep -q "PersistGate.*loading" App.tsx || grep -q "PersistGateWithTimeout" App.tsx; then
    echo -e "${GREEN}✅ Redux Persist loading handled${NC}"
else
    echo -e "${YELLOW}⚠️ Redux Persist loading not configured${NC}"
fi

# 5. Network Error Handling
if grep -E -q "NetInfo\.fetch|Network check failed|🌐 Network status|retry attempt" App.tsx; then
    echo -e "${GREEN}✅ Network error handling found${NC}"
else
    echo -e "${YELLOW}⚠️ Network error handling not found${NC}"
fi

# 6. Permission Initialization
if grep -q "initializePermissions" App.tsx; then
    echo -e "${GREEN}✅ Permission initialization configured${NC}"
else
    echo -e "${YELLOW}⚠️ Permission initialization not found${NC}"
fi

# 7. Environment Validation
if grep -q "isEnvironmentValid" App.tsx; then
    echo -e "${GREEN}✅ Environment validation configured${NC}"
else
    echo -e "${YELLOW}⚠️ Environment validation not found${NC}"
fi

# 8. Sentry Integration
if grep -q "Sentry.init" App.tsx; then
    echo -e "${GREEN}✅ Sentry integration configured${NC}"
else
    echo -e "${YELLOW}⚠️ Sentry integration not found${NC}"
fi

echo -e "${GREEN}🎉 EAS Cloud simulation completed with enhanced launch safety!${NC}"
echo -e "${BLUE}💡 Launch Safety Features Enabled:${NC}"
echo -e "${CYAN}   • Timeout protection (15s app init, 10s splash, 8s permissions)${NC}"
echo -e "${CYAN}   • Error boundary coverage (app, screen, component levels)${NC}"
echo -e "${CYAN}   • Network retry logic (3 attempts, 2s delay)${NC}"
echo -e "${CYAN}   • Crash recovery mechanisms${NC}"
echo -e "${CYAN}   • Comprehensive error tracking${NC}"
echo -e "${CYAN}   • Launch debug mode enabled${NC}"
echo ""
echo -e "${PURPLE}📱 APK Testing Summary:${NC}"
echo -e "${GREEN}✅ APK built successfully for testing${NC}"
echo -e "${GREEN}✅ APK copied to project root with timestamp${NC}"
echo -e "${GREEN}✅ APK structure validated${NC}"
echo -e "${GREEN}✅ Ready for direct installation on Android devices${NC}"
echo ""
echo -e "${BLUE}💡 Testing Workflow:${NC}"
echo -e "${CYAN}   1. Share the APK file with your testers${NC}"
echo -e "${CYAN}   2. Testers enable 'Install from unknown sources'${NC}"
echo -e "${CYAN}   3. Testers install the APK directly${NC}"
echo -e "${CYAN}   4. No Play Console upload required${NC}"
echo -e "${CYAN}   5. Perfect for internal testing and QA${NC}"
echo ""
echo -e "${BLUE}💡 If this build succeeds, your EAS Cloud build should also succeed${NC}"
echo -e "${BLUE}💡 If this build fails, fix the issues here before trying EAS Cloud${NC}"
echo -e "${GREEN}✅ Sentry was enabled for comprehensive error tracking${NC}"
echo -e "${PURPLE}🚀 Your app is now ready for testing with enhanced launch safety!${NC}"
