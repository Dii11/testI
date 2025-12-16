#!/bin/bash
# scripts/setup-fastlane-android.sh
# HopMed Android Fastlane setup and configuration script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}🛠️  HopMed Android Fastlane Setup${NC}"

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check if Java is installed
if ! java -version >/dev/null 2>&1; then
    echo -e "${RED}❌ Java not installed${NC}"
    echo -e "${YELLOW}Please install Java 17 or later${NC}"
    exit 1
fi

# Check if Android SDK is set up
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${YELLOW}⚠️  ANDROID_HOME not set${NC}"
    echo -e "${YELLOW}Please set up Android SDK and ANDROID_HOME environment variable${NC}"
else
    echo -e "${GREEN}✅ ANDROID_HOME: $ANDROID_HOME${NC}"
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

echo -e "${GREEN}✅ Prerequisites check completed${NC}"

# Navigate to Android directory
cd android

# Install Fastlane dependencies
echo -e "${YELLOW}📦 Installing Fastlane dependencies...${NC}"
bundle install

cd ..

# Create Google Play Console service account instructions
echo -e "${YELLOW}🎮 Setting up Google Play Console API...${NC}"
cat > google-play-setup-instructions.md << 'EOF'
# Google Play Console API Setup Instructions

## Step 1: Enable Google Play Android Developer API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the "Google Play Android Developer API"

## Step 2: Create Service Account
1. Go to IAM & Admin → Service Accounts
2. Click "Create Service Account"
3. Enter service account details:
   - Name: `hopmed-play-store-deploy`
   - Description: `Service account for HopMed Play Store deployments`
4. Click "Create and Continue"
5. Skip granting roles for now (we'll do this in Play Console)
6. Click "Done"

## Step 3: Generate JSON Key
1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create New Key"
4. Select "JSON" format
5. Download the JSON file
6. Rename it to `google-play-service-account.json`
7. Place it in the project root directory

## Step 4: Link to Google Play Console
1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app
3. Go to Setup → API access
4. Click "Link a Google Cloud project"
5. Select the project you created/used in Step 1
6. Click "Link project"

## Step 5: Grant Permissions
1. In API access page, find your service account
2. Click "Grant access"
3. Select these permissions:
   - ✅ Release apps to testing tracks
   - ✅ Manage app releases
   - ✅ View app information and download bulk reports
   - ✅ Manage store listing
4. Click "Apply"

## Step 6: Test Setup
Run: `cd android && bundle exec fastlane health_check`

Your Google Play Console API is now ready! 🎉
EOF

echo -e "${GREEN}✅ Created Google Play setup instructions${NC}"

# Create environment configuration file
echo -e "${YELLOW}⚙️  Creating Android environment configuration...${NC}"
cat > .env.fastlane.android << EOF
# HopMed Android Fastlane Environment Configuration
# Copy this to .env.fastlane.android.local and fill in your values

# Google Play Console Service Account JSON path (required)
HOPMED_GOOGLE_PLAY_JSON_KEY=./google-play-service-account.json

# Default Play Store track for deployments
HOPMED_DEFAULT_TRACK=alpha

# Release keystore configuration (required for production)
HOPMED_RELEASE_STORE_FILE=../release.keystore
HOPMED_RELEASE_KEY_ALIAS=release
HOPMED_RELEASE_STORE_PASSWORD=your-store-password
HOPMED_RELEASE_KEY_PASSWORD=your-key-password

# Build optimization
ANDROID_ENABLE_PROGUARD_RELEASE=true
ANDROID_ENABLE_SHRINK_RESOURCES_RELEASE=true
ANDROID_ENABLE_PNG_CRUNCH_RELEASE=true
EOF

# Generate release keystore helper
echo -e "${YELLOW}🔑 Creating keystore generation helper...${NC}"
cat > generate-release-keystore.sh << 'EOF'
#!/bin/bash
# Generate release keystore for HopMed Android

set -e

echo "🔑 Generating release keystore for HopMed..."

# Prompt for keystore details
read -p "Enter keystore password: " -s STORE_PASSWORD
echo
read -p "Enter key password: " -s KEY_PASSWORD
echo
read -p "Enter your name: " CN
read -p "Enter your organization: " O
read -p "Enter your organization unit: " OU
read -p "Enter your city: " L
read -p "Enter your state/province: " S
read -p "Enter your country code (2 letters): " C

# Generate keystore
keytool -genkey -v \
  -keystore release.keystore \
  -alias release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=$CN, OU=$OU, O=$O, L=$L, S=$S, C=$C" \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD"

echo "✅ Release keystore generated: release.keystore"
echo ""
echo "📝 Add these properties to android/gradle.properties:"
echo "HOPMED_RELEASE_STORE_FILE=../release.keystore"
echo "HOPMED_RELEASE_KEY_ALIAS=release"
echo "HOPMED_RELEASE_STORE_PASSWORD=$STORE_PASSWORD"
echo "HOPMED_RELEASE_KEY_PASSWORD=$KEY_PASSWORD"
echo ""
echo "⚠️  Keep these credentials secure and back them up!"
EOF

chmod +x generate-release-keystore.sh
chmod +x scripts/deploy-play-store.sh

# Update .gitignore for Android-specific files
if ! grep -q "google-play-service-account.json" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Android Fastlane" >> .gitignore
    echo "google-play-service-account.json" >> .gitignore
    echo "release.keystore" >> .gitignore
    echo ".env.fastlane.android.local" >> .gitignore
    echo "google-play-setup-instructions.md" >> .gitignore
    echo "generate-release-keystore.sh" >> .gitignore
    echo "android/fastlane/report.xml" >> .gitignore
    echo "android/fastlane/Preview.html" >> .gitignore
    echo "android/build/" >> .gitignore
    echo "android/app/build/" >> .gitignore
    echo "android/.gradle/" >> .gitignore
fi

echo -e "${GREEN}✅ Fastlane Android setup completed!${NC}"
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "${CYAN}1. Follow instructions in google-play-setup-instructions.md${NC}"
echo -e "${CYAN}2. Download google-play-service-account.json to project root${NC}"
echo -e "${CYAN}3. Generate release keystore: ./generate-release-keystore.sh${NC}"
echo -e "${CYAN}4. Update android/gradle.properties with keystore config${NC}"
echo -e "${CYAN}5. Run health check: cd android && bundle exec fastlane health_check${NC}"
echo -e "${CYAN}6. Deploy to Play Store: ./scripts/deploy-play-store.sh -e staging -t alpha${NC}"

echo -e "${YELLOW}💡 Commands available:${NC}"
echo -e "${CYAN}   ./scripts/deploy-play-store.sh -e development -t internal  # QA build${NC}"
echo -e "${CYAN}   ./scripts/deploy-play-store.sh -e staging -t alpha         # Staging build${NC}"
echo -e "${CYAN}   ./scripts/deploy-play-store.sh -e production -t beta       # Production build${NC}"
echo -e "${CYAN}   ./scripts/deploy-play-store.sh --skip-prebuild             # Quick build${NC}"

echo -e "${BLUE}🎯 Build types:${NC}"
echo -e "${CYAN}   -b aab    # Android App Bundle (recommended for Play Store)${NC}"
echo -e "${CYAN}   -b apk    # APK file (for testing)${NC}"

echo -e "${BLUE}🚀 Play Store tracks:${NC}"
echo -e "${CYAN}   internal    # Internal testing (up to 100 testers)${NC}"
echo -e "${CYAN}   alpha       # Closed testing (opt-in via URL)${NC}"
echo -e "${CYAN}   beta        # Open testing (public opt-in)${NC}"
echo -e "${CYAN}   production  # Full release to all users${NC}"

echo -e "${PURPLE}🎯 Your Android deployment automation is ready!${NC}"