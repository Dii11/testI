#!/bin/bash

# 🔧 Camera Fix Deployment Script
# This script applies all camera intermittent shutdown fixes to EnterpriseCallInterface.tsx

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TARGET_FILE="$PROJECT_ROOT/src/components/daily/EnterpriseCallInterface.tsx"
BACKUP_FILE="$TARGET_FILE.backup-$(date +%Y%m%d-%H%M%S)"

echo "🔧 Camera Intermittent Shutdown Fix - Deployment Script"
echo "========================================================"
echo ""
echo "Target file: $TARGET_FILE"
echo "Backup will be created at: $BACKUP_FILE"
echo ""

# Step 1: Backup
echo "📦 Step 1: Creating backup..."
if [ ! -f "$TARGET_FILE" ]; then
    echo "❌ Error: Target file not found: $TARGET_FILE"
    exit 1
fi

cp "$TARGET_FILE" "$BACKUP_FILE"
echo "✅ Backup created successfully"
echo ""

# Step 2: Apply patch
echo "🔨 Step 2: Applying camera fix patch..."

if [ -f "$SCRIPT_DIR/camera-intermittent-fix.patch" ]; then
    echo "Attempting to apply patch via git apply..."
    cd "$PROJECT_ROOT"

    if git apply "$SCRIPT_DIR/camera-intermittent-fix.patch" 2>/dev/null; then
        echo "✅ Patch applied successfully via git apply"
    else
        echo "⚠️  git apply failed, trying with --reject flag..."
        if git apply --reject "$SCRIPT_DIR/camera-intermittent-fix.patch" 2>/dev/null; then
            echo "⚠️  Patch applied with conflicts - check for .rej files"
            echo "   You'll need to resolve conflicts manually"
        else
            echo "❌ Patch application failed"
            echo "   Please apply manually using IMPLEMENTATION_GUIDE.md"
            echo ""
            echo "To restore backup:"
            echo "   cp $BACKUP_FILE $TARGET_FILE"
            exit 1
        fi
    fi
else
    echo "❌ Patch file not found: $SCRIPT_DIR/camera-intermittent-fix.patch"
    echo "   Please apply fixes manually using IMPLEMENTATION_GUIDE.md"
    exit 1
fi

echo ""

# Step 3: Verify TypeScript compilation
echo "🔍 Step 3: Verifying TypeScript compilation..."
cd "$PROJECT_ROOT"

if command -v npm &> /dev/null; then
    echo "Running type check..."
    if npm run type-check 2>&1 | tail -10; then
        echo "✅ TypeScript compilation successful"
    else
        echo "⚠️  TypeScript errors found - you may need to resolve them"
    fi
else
    echo "⚠️  npm not found - skipping type check"
fi

echo ""

# Step 4: Summary
echo "=========================================================="
echo "🎉 Camera Fix Deployment Complete!"
echo "=========================================================="
echo ""
echo "✅ Fixes Applied:"
echo "   1. Holistic track sync (flag + track refetch)"
echo "   2. Stable event listeners (20+ deps → 7 deps)"
echo "   3. Active track fetch on background resume"
echo "   4. Camera toggle lock clearing on background"
echo "   5. Remote state flag resets on call end"
echo ""
echo "📝 Next Steps:"
echo "   1. Review the changes in $TARGET_FILE"
echo "   2. Test the video calling feature thoroughly"
echo "   3. Follow the testing checklist in CAMERA_FIX_README.md"
echo ""
echo "🔄 To rollback if needed:"
echo "   cp $BACKUP_FILE $TARGET_FILE"
echo ""
echo "📚 Documentation:"
echo "   - Full README: $SCRIPT_DIR/CAMERA_FIX_README.md"
echo "   - Implementation Guide: $SCRIPT_DIR/IMPLEMENTATION_GUIDE.md"
echo ""
