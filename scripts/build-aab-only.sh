#!/bin/bash

# 🚀 HopMed AAB Build Script (No Upload)
# This script builds the AAB file for manual upload to Play Console

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/Users/rochelhasina/Documents/hopmed/hopmed-mobile"
ANDROID_DIR="$PROJECT_ROOT/android"

echo -e "${BLUE}🚀 HopMed AAB Build Script${NC}"
echo -e "${BLUE}===========================${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if we're in the right directory
check_directory() {
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        echo -e "${RED}❌ Not in HopMed project root. Please run from: $PROJECT_ROOT${NC}"
        exit 1
    fi
}

# Function to ensure keystore exists
ensure_keystore() {
    print_info "Ensuring keystore is in the correct location..."
    
    local keystore_source="$PROJECT_ROOT/release.keystore"
    local keystore_dest="$ANDROID_DIR/release.keystore"
    
    if [ ! -f "$keystore_source" ]; then
        echo -e "${RED}❌ Release keystore not found at $keystore_source${NC}"
        exit 1
    fi
    
    # Copy keystore to android directory if not already there
    if [ ! -f "$keystore_dest" ]; then
        cp "$keystore_source" "$keystore_dest"
        print_status "Keystore copied to android directory"
    else
        print_status "Keystore already exists in android directory"
    fi
}

# Function to build AAB
build_aab() {
    print_info "Building AAB file..."
    
    # Set environment variables
    export HOPMED_RELEASE_STORE_FILE="../release.keystore"
    export HOPMED_RELEASE_KEY_ALIAS="release"
    export HOPMED_BUILD_ENVIRONMENT="staging"
    export HOPMED_API_BASE_URL="https://api.hopmed.com"
    
    # Change to android directory and build
    cd "$ANDROID_DIR"
    
    print_info "Running gradle bundleRelease..."
    ./gradlew bundleRelease
    
    print_status "AAB build completed successfully!"
}

# Function to show file location
show_file_location() {
    local aab_file="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
    
    if [ -f "$aab_file" ]; then
        echo -e "${GREEN}🎉 AAB file created successfully!${NC}"
        echo -e "${BLUE}📁 File location: $aab_file${NC}"
        echo -e "${BLUE}📊 File size: $(du -h "$aab_file" | cut -f1)${NC}"
        echo -e "${YELLOW}💡 You can now upload this file manually to Play Console${NC}"
        echo -e "${YELLOW}🔗 Go to: https://play.google.com/console${NC}"
        echo -e "${YELLOW}📱 Upload to: Alpha track${NC}"
    else
        echo -e "${RED}❌ AAB file not found at expected location${NC}"
        exit 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Starting AAB build process...${NC}"
    
    # Check if we're in the right directory
    check_directory
    
    # Ensure keystore is in the right place
    ensure_keystore
    
    # Build AAB
    build_aab
    
    # Show file location
    show_file_location
}

# Run main function
main "$@"
