#!/bin/bash

# Notifee + Firebase Installation Script
# Run this to install all required dependencies for the migration

set -e  # Exit on error

echo "📦 Installing Notifee + React Native Firebase..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Run this script from the project root."
  exit 1
fi

echo "${YELLOW}Step 1: Installing core dependencies${NC}"
npm install @notifee/react-native@^9.0.0 \
  @react-native-firebase/app@^21.0.0 \
  @react-native-firebase/messaging@^21.0.0

echo ""
echo "${YELLOW}Step 2: Installing iOS VoIP push (optional but recommended)${NC}"
npm install react-native-voip-push-notification@^3.3.2

echo ""
echo "${YELLOW}Step 3: Installing pods (iOS)${NC}"
cd ios && pod install && cd ..

echo ""
echo "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Update app.config.js to include Notifee plugin"
echo "2. Run: npx expo prebuild --clean"
echo "3. Build app: npm run android or npm run ios"
echo ""
echo "See NOTIFEE_MIGRATION_GUIDE.md for detailed setup instructions."
