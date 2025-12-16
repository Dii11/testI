#!/bin/bash

# 🚀 HopMed Play Console Deployment Script
# This script handles the complete deployment process to Play Console alpha track

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KEYSTORE_PASSWORD="lN\$2025!"
KEY_PASSWORD="lN\$2025!"  # Same as keystore password since no separate key password
PROJECT_ROOT="/Users/rochelhasina/Documents/hopmed/hopmed-mobile"
ANDROID_DIR="$PROJECT_ROOT/android"
FASTLANE_DIR="$ANDROID_DIR/fastlane"

echo -e "${BLUE}🚀 HopMed Play Console Deployment Script${NC}"
echo -e "${BLUE}==========================================${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if we're in the right directory
check_directory() {
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        print_error "Not in HopMed project root. Please run from: $PROJECT_ROOT"
        exit 1
    fi
}

# Function to update keystore passwords
update_keystore_passwords() {
    print_info "Updating keystore passwords in gradle.properties..."
    
    local gradle_props="$ANDROID_DIR/gradle.properties"
    
    if [ ! -f "$gradle_props" ]; then
        print_error "gradle.properties not found at $gradle_props"
        exit 1
    fi
    
    # Update or add keystore passwords
    if grep -q "HOPMED_RELEASE_STORE_PASSWORD" "$gradle_props"; then
        sed -i '' "s/HOPMED_RELEASE_STORE_PASSWORD=.*/HOPMED_RELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD/" "$gradle_props"
    else
        echo "HOPMED_RELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD" >> "$gradle_props"
    fi
    
    if grep -q "HOPMED_RELEASE_KEY_PASSWORD" "$gradle_props"; then
        sed -i '' "s/HOPMED_RELEASE_KEY_PASSWORD=.*/HOPMED_RELEASE_KEY_PASSWORD=$KEY_PASSWORD/" "$gradle_props"
    else
        echo "HOPMED_RELEASE_KEY_PASSWORD=$KEY_PASSWORD" >> "$gradle_props"
    fi
    
    print_status "Keystore passwords updated"
}

# Function to ensure keystore exists
ensure_keystore() {
    print_info "Ensuring keystore is in the correct location..."
    
    local keystore_source="$PROJECT_ROOT/release.keystore"
    local keystore_dest="$ANDROID_DIR/release.keystore"
    
    if [ ! -f "$keystore_source" ]; then
        print_error "Release keystore not found at $keystore_source"
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

# Function to run prebuild if needed
run_prebuild_if_needed() {
    print_info "Checking if prebuild is needed..."
    
    if [ ! -d "$ANDROID_DIR/app" ] || [ ! -f "$ANDROID_DIR/app/build.gradle" ]; then
        print_warning "Android folder missing or incomplete. Running prebuild..."
        cd "$PROJECT_ROOT"
        npx expo prebuild --clean --platform android
        print_status "Prebuild completed"
    else
        print_status "Android folder exists, skipping prebuild"
    fi
}

# Function to restore fastlane configuration
restore_fastlane() {
    print_info "Restoring fastlane configuration..."
    cd "$PROJECT_ROOT"
    ./scripts/restore-fastlane-android.sh
    print_status "Fastlane configuration restored"
}

# Function to run deployment
run_deployment() {
    print_info "Starting Play Console deployment..."
    
    # Set environment variables
    export HOPMED_RELEASE_STORE_FILE="../release.keystore"
    export HOPMED_RELEASE_KEY_ALIAS="release"
    export HOPMED_BUILD_ENVIRONMENT="staging"
    export HOPMED_API_BASE_URL="https://api.hopmed.com"
    
    # Change to android directory and run fastlane
    cd "$ANDROID_DIR"
    
    print_info "Running fastlane deploy_staging..."
    bundle exec fastlane deploy_staging
    
    print_status "Deployment completed successfully!"
}

# Function to cleanup
cleanup() {
    print_info "Cleaning up temporary files..."
    # Remove keystore from android directory for security
    if [ -f "$ANDROID_DIR/release.keystore" ]; then
        rm "$ANDROID_DIR/release.keystore"
        print_status "Temporary keystore removed"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Starting deployment process...${NC}"
    
    # Check if we're in the right directory
    check_directory
    
    # Step 1: Run prebuild if needed
    run_prebuild_if_needed
    
    # Step 2: Restore fastlane configuration
    restore_fastlane
    
    # Step 3: Update keystore passwords
    update_keystore_passwords
    
    # Step 4: Ensure keystore is in the right place
    ensure_keystore
    
    # Step 5: Run deployment
    run_deployment
    
    # Step 6: Cleanup
    cleanup
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${GREEN}📱 New version should be available on Play Console alpha track${NC}"
    echo -e "${BLUE}💡 Check Play Console for the new build: 1.0.7 (version code 32)${NC}"
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"
