#!/bin/bash

# Launch Xcode with proper environment variables to prevent Sentry upload errors

echo "🎯 Launching Xcode with Sentry uploads disabled..."

# Set environment variables
export SENTRY_DISABLE_AUTO_UPLOAD=true
export SENTRY_ALLOW_FAILURE=true
export SENTRY_SKIP_AUTO_RELEASE=true

# Launch Xcode with environment
open ios/HopMed.xcworkspace

echo "✅ Xcode launched with Sentry uploads disabled"
echo ""
echo "📱 In Xcode:"
echo "   1. Select 'Any iOS Device (arm64)' as build target"
echo "   2. Product → Archive"
echo "   3. After archiving: Validate App → Distribute App"
echo ""
echo "🚀 The Sentry CLI error should now be resolved!"