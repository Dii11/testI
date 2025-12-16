#!/bin/bash

# Test automated FastLane build
# This creates a complete build and uploads to TestFlight

set -e

echo "🚀 Testing automated FastLane build..."

# Set environment variables
export FASTLANE_DEVELOPMENT_TEAM=2989AUH85G
export FASTLANE_API_ISSUER_ID=28746465-8e11-4b07-af43-33343b82fb8c
export FASTLANE_APPLE_ID=mbinintsoarochelhasiniaina@gmail.com
export SENTRY_DISABLE_AUTO_UPLOAD=1
export SENTRY_ALLOW_FAILURE=1

echo "✅ Environment variables set"

# Run FastLane build
cd ios
echo "📦 Running FastLane build only (no upload)..."
bundle exec fastlane build_only

echo ""
echo "✅ Automated build complete!"
echo ""
echo "📱 To upload to TestFlight, run:"
echo "   cd ios && bundle exec fastlane deploy_testflight"
echo ""
echo "🎯 The IPA file is ready for manual distribution!"

cd ..