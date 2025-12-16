#!/bin/bash

# Prebuild iOS project with proper configuration for TestFlight
# Run this before building in Xcode

set -e  # Exit on error

echo "🔧 Preparing iOS build for TestFlight..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[i]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Expected bundle identifier
EXPECTED_BUNDLE_ID="com.lns.hopmed"

# Step 1: Clean previous iOS build
print_status "Cleaning iOS folder..."
rm -rf ios

# Step 2: Run Expo prebuild
print_status "Running Expo prebuild with clean iOS folder..."
npx expo prebuild --clean --platform ios

# Step 3: Install CocoaPods
print_status "Installing CocoaPods dependencies..."
cd ios
pod install --repo-update

# Step 4: Apply additional Xcode settings for dSYM generation
print_status "Applying dSYM configuration to Xcode project..."

# Use ruby to modify the Xcode project
ruby << 'RUBY_SCRIPT'
require 'xcodeproj'

project_path = './HopMed.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Apply settings to all targets
project.targets.each do |target|
  target.build_configurations.each do |config|
    # Ensure dSYM generation for all configurations
    config.build_settings['DEBUG_INFORMATION_FORMAT'] = 'dwarf-with-dsym'
    config.build_settings['DWARF_DSYM_FILE_SHOULD_ACCOMPANY_PRODUCT'] = 'YES'
    config.build_settings['GCC_GENERATE_DEBUGGING_SYMBOLS'] = 'YES'

    # For Release configuration, ensure symbols aren't stripped
    if config.name == 'Release'
      config.build_settings['STRIP_INSTALLED_PRODUCT'] = 'NO'
      config.build_settings['COPY_PHASE_STRIP'] = 'NO'
      config.build_settings['DEPLOYMENT_POSTPROCESSING'] = 'NO'
      config.build_settings['STRIP_STYLE'] = 'debugging'
      config.build_settings['ENABLE_BITCODE'] = 'NO'
    end
  end
end

project.save
puts "✓ Xcode project updated with dSYM settings"
RUBY_SCRIPT

cd ..

print_status "Prebuild complete!"
echo ""
print_info "Next steps:"
print_info "1. Open ios/HopMed.xcworkspace in Xcode"
print_info "2. Select 'Any iOS Device (arm64)' as the build target"
print_info "3. Go to Product > Archive"
print_info "4. After archiving, validate and upload to TestFlight"
echo ""
print_info "The following issues have been fixed:"
print_info "✓ BGTaskSchedulerPermittedIdentifiers added for background processing"
print_info "✓ dSYM generation configured for all frameworks"
print_info "✓ Build settings optimized for TestFlight submission"