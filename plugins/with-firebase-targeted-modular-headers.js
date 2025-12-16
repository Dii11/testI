/**
 * Expo Config Plugin: Targeted Modular Headers for Firebase
 *
 * Avoids global `use_modular_headers!` by enabling modular headers only for
 * pods that require it when building Swift static libraries.
 *
 * Specifically sets `:modular_headers => true` for GoogleUtilities and related
 * Firebase pods which otherwise do not define modules, causing
 * "does not define modules" CocoaPods errors.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function insertTargetedModularHeaders(podfileContent) {
  // Lines we want to ensure exist inside the primary target block
  const desired = [
    "  # Targeted modular headers for Firebase/Google pods (Swift static libs)",
    "  pod 'GoogleUtilities', :modular_headers => true",
    "  pod 'FirebaseCoreInternal', :modular_headers => true",
    "  pod 'GoogleAppMeasurement', :modular_headers => true",
    "  pod 'FirebaseCore', :modular_headers => true",
    "  pod 'FirebaseInstallations', :modular_headers => true",
    "  pod 'GoogleDataTransport', :modular_headers => true",
    "  pod 'PromisesObjC', :modular_headers => true",
    '',
  ];

  const lines = podfileContent.split('\n');

  // Find first target block
  const targetStart = lines.findIndex((l) => /\btarget\s+'[^']+'\s+do/.test(l));
  if (targetStart === -1) return podfileContent;

  // Locate insertion point inside the target
  let insertIndex = -1;
  for (let i = targetStart + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*end\s*$/.test(line)) break; // end of target block
    if (line.includes('use_expo_modules!') || line.includes('use_native_modules!')) {
      insertIndex = i + 1;
      break;
    }
  }
  if (insertIndex === -1) insertIndex = targetStart + 1;

  // Compute which desired lines are missing within the current target block
  const targetEnd = lines.slice(insertIndex).findIndex((l) => /^\s*end\s*$/.test(l));
  const searchEnd = targetEnd === -1 ? lines.length : insertIndex + targetEnd;
  const targetBlock = lines.slice(insertIndex, searchEnd).join('\n');

  const missing = desired.filter((l) => l && !targetBlock.includes(l));
  if (missing.length === 0) return podfileContent; // nothing to do

  lines.splice(insertIndex, 0, ...missing);
  return lines.join('\n');
}

module.exports = function withFirebaseTargetedModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        console.log('⚠️  Podfile not found, skipping targeted modular headers fix');
        return config;
      }

      let content = fs.readFileSync(podfilePath, 'utf8');

      // If the file already has a global use_modular_headers!, do nothing (or consider removing).
      if (content.includes('use_modular_headers!')) {
        console.log('ℹ️  Global use_modular_headers! detected; targeted fix not applied');
        return config;
      }

      const updated = insertTargetedModularHeaders(content);
      if (updated !== content) {
        fs.writeFileSync(podfilePath, updated, 'utf8');
        console.log('✅ Added targeted modular headers for Firebase/Google pods');
      } else {
        console.log('ℹ️  Targeted modular headers already present');
      }

      return config;
    },
  ]);
};
