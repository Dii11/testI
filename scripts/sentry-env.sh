#!/bin/bash

# Export Sentry environment variables for Xcode builds
# This prevents Sentry CLI upload errors during archive

export SENTRY_DISABLE_AUTO_UPLOAD=1
export SENTRY_ALLOW_FAILURE=1
export SENTRY_SKIP_AUTO_RELEASE=1

echo "✓ Sentry upload disabled for build"