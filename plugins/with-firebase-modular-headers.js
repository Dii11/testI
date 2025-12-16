/**
 * Expo Config Plugin: Firebase Modular Headers
 * 
 * Fixes the Firebase pod installation error by enabling modular headers
 * 
 * Error solved:
 * "The Swift pod `FirebaseCoreInternal` depends upon `GoogleUtilities`, 
 *  which does not define modules."
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.log('⚠️  Podfile not found, skipping Firebase modular headers fix');
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      // Check if use_modular_headers! is already present
      if (podfileContent.includes('use_modular_headers!')) {
        console.log('✅ Firebase modular headers already enabled');
        return config;
      }

      // Add use_modular_headers! after the platform line
      // Find the right place to insert (after require_relative and platform)
      const lines = podfileContent.split('\n');
      let insertIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        // Find the target block after basic setup
        if (lines[i].includes('target ') || lines[i].includes('use_expo_modules!')) {
          insertIndex = i;
          break;
        }
      }

      if (insertIndex === -1) {
        // Fallback: insert after platform line
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("platform :ios")) {
            insertIndex = i + 1;
            break;
          }
        }
      }

      if (insertIndex !== -1) {
        // Insert use_modular_headers! with proper indentation
        lines.splice(insertIndex, 0, '');
        lines.splice(insertIndex + 1, 0, '  # Enable modular headers for Firebase compatibility');
        lines.splice(insertIndex + 2, 0, '  use_modular_headers!');
        lines.splice(insertIndex + 3, 0, '');

        podfileContent = lines.join('\n');
        fs.writeFileSync(podfilePath, podfileContent, 'utf8');

        console.log('✅ Firebase modular headers enabled in Podfile');
      } else {
        console.warn('⚠️  Could not find insertion point for modular headers');
      }

      return config;
    },
  ]);
};
