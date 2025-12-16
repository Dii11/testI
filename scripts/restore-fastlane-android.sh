#!/bin/bash
# scripts/restore-fastlane-android.sh
# Automatically restore Fastlane configuration after Expo prebuild
# This solves the issue of Expo recreating the android folder

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 Restoring HopMed Android Fastlane Configuration${NC}"

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Check if android folder exists (should exist after prebuild)
if [ ! -d "android" ]; then
    echo -e "${RED}❌ Android folder not found. Run 'expo prebuild' first.${NC}"
    exit 1
fi

# Check if template folder exists
if [ ! -d "fastlane-templates/android" ]; then
    echo -e "${RED}❌ Fastlane templates not found. Setup may be incomplete.${NC}"
    exit 1
fi

echo -e "${YELLOW}📂 Copying Fastlane configuration...${NC}"

# Create fastlane directory in android folder
mkdir -p android/fastlane

# Copy template files
cp -r fastlane-templates/android/* android/
echo -e "${GREEN}✅ Fastlane files copied${NC}"

# Navigate to android directory
cd android

# Install Fastlane dependencies
echo -e "${YELLOW}📦 Installing Fastlane dependencies...${NC}"
bundle install

# Configure release signing in build.gradle if not already done
BUILD_GRADLE="app/build.gradle"
if [ -f "$BUILD_GRADLE" ]; then
    # Check if release signing is already configured
    if grep -q "HOPMED_RELEASE_STORE_FILE" "$BUILD_GRADLE"; then
        echo -e "${GREEN}✅ Release signing already configured${NC}"
    else
        echo -e "${YELLOW}⚙️  Configuring release signing...${NC}"
        
        # Create backup
        cp "$BUILD_GRADLE" "${BUILD_GRADLE}.backup"
        
        # Add release signing configuration
        # Find the signingConfigs section and add release config
        sed -i '' '/signingConfigs {/,/}/c\
    signingConfigs {\
        debug {\
            storeFile file('\''debug.keystore'\'')\
            storePassword '\''android'\''\
            keyAlias '\''androiddebugkey'\''\
            keyPassword '\''android'\''\
        }\
        release {\
            if (project.hasProperty('\''HOPMED_RELEASE_STORE_FILE'\'')) {\
                storeFile file(HOPMED_RELEASE_STORE_FILE)\
                storePassword HOPMED_RELEASE_STORE_PASSWORD\
                keyAlias HOPMED_RELEASE_KEY_ALIAS\
                keyPassword HOPMED_RELEASE_KEY_PASSWORD\
            } else {\
                storeFile file('\''debug.keystore'\'')\
                storePassword '\''android'\''\
                keyAlias '\''androiddebugkey'\''\
                keyPassword '\''android'\''\
            }\
        }\
    }' "$BUILD_GRADLE"
        
        # Update release buildType to use release signing
        sed -i '' '/release {/,/}/s/signingConfig signingConfigs.debug/signingConfig signingConfigs.release/' "$BUILD_GRADLE"
        
        echo -e "${GREEN}✅ Release signing configured${NC}"
    fi
fi

# Configure gradle.properties for release signing
GRADLE_PROPS="gradle.properties"
if [ -f "$GRADLE_PROPS" ]; then
    # Check if release properties are already configured
    if grep -q "HOPMED_RELEASE_STORE_FILE" "$GRADLE_PROPS"; then
        echo -e "${GREEN}✅ Release properties already configured in gradle.properties${NC}"
    else
        echo -e "${YELLOW}⚙️  Adding release signing properties to gradle.properties...${NC}"
        
        # Add release signing properties
        cat >> "$GRADLE_PROPS" << EOF

# HopMed Release Signing Configuration
# Configure these values for production builds
HOPMED_RELEASE_STORE_FILE=../release.keystore
HOPMED_RELEASE_KEY_ALIAS=release
HOPMED_RELEASE_STORE_PASSWORD=hopmed2024secure!
HOPMED_RELEASE_KEY_PASSWORD=hopmed2024secure!
EOF
        
        echo -e "${GREEN}✅ Release properties added to gradle.properties${NC}"
        echo -e "${YELLOW}⚠️  Update the keystore passwords in gradle.properties with your actual values${NC}"
    fi
fi

cd ..

# Run health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
cd android
bundle exec fastlane health_check
cd ..

echo -e "${GREEN}✅ Fastlane Android configuration restored successfully!${NC}"
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "${CYAN}   1. Update keystore passwords in android/gradle.properties${NC}"
echo -e "${CYAN}   2. Run deployment: npm run deploy:playstore:qa${NC}"
echo -e "${CYAN}   3. For quick deploys: npm run deploy:playstore:quick${NC}"

echo -e "${PURPLE}🚀 Your Fastlane setup is now Expo-prebuild compatible!${NC}"