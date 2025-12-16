#!/bin/bash

# Enable TestFlight uploads in fastlane configuration
# This script uncomments the upload_to_testflight calls

set -e

echo "🚀 Enabling TestFlight uploads in fastlane configuration..."

# Setup fastlane first
./scripts/setup-fastlane-ios.sh

# Copy fastlane templates to ios directory
mkdir -p ios/fastlane
cp fastlane-templates/ios/fastlane/Fastfile ios/fastlane/

# Create Gemfile for iOS
cat > ios/Gemfile << 'EOF'
source "https://rubygems.org"

gem "fastlane", ">= 2.220.0"

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
ruby '>= 2.6.10'
EOF

# Enable TestFlight uploads by uncommenting them
echo "✅ Enabling TestFlight uploads..."
sed -i '' 's/^    # upload_to_testflight(/    upload_to_testflight(/g' ios/fastlane/Fastfile
sed -i '' 's/^    #   api_key_path:/      api_key_path:/g' ios/fastlane/Fastfile
sed -i '' 's/^    #   skip_waiting_for_build_processing:/      skip_waiting_for_build_processing:/g' ios/fastlane/Fastfile
sed -i '' 's/^    #   changelog:/      changelog:/g' ios/fastlane/Fastfile
sed -i '' 's/^    # )/    )/g' ios/fastlane/Fastfile

# Remove safety comments
sed -i '' '/puts "✅ iOS .* build completed - IPA ready for local testing"/d' ios/fastlane/Fastfile
sed -i '' '/puts "📱 TestFlight upload is commented out"/d' ios/fastlane/Fastfile
sed -i '' '/puts "💡 Uncomment upload_to_testflight .* when ready to publish"/d' ios/fastlane/Fastfile

# Set required environment variables
echo "⚙️ Setting up environment variables..."
cat > .env.fastlane.local << 'EOF'
# HopMed Fastlane Environment Configuration
# Apple Developer Team ID (from Xcode project settings)
FASTLANE_DEVELOPMENT_TEAM=2989AUH85G

# App Store Connect API Issuer ID (from your deployment scripts)
FASTLANE_API_ISSUER_ID=28746465-8e11-4b07-af43-33343b82fb8c

# Apple Developer Account Email (from your deployment scripts)
FASTLANE_APPLE_ID=mbinintsoarochelhasiniaina@gmail.com

# Skip waiting for build processing (speeds up uploads)
FASTLANE_SKIP_WAITING_FOR_BUILD_PROCESSING=true
EOF

chmod +x scripts/enable-testflight-upload.sh

echo "✅ TestFlight upload enabled!"
echo ""
echo "🚀 Ready to deploy with:"
echo "   source .env.fastlane.local"
echo "   ./scripts/deploy-testflight.sh -e staging"
echo ""
echo "📱 This will build and automatically upload to TestFlight!"