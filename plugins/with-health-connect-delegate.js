// Expo config plugin to add Health Connect Permission Delegate to MainActivity
// This is CRITICAL for react-native-health-connect to work properly on Android 10+
// Without this, the app will crash when permissions are not granted
const { withMainActivity } = require('expo/config-plugins');

/**
 * Adds the Health Connect permission delegate setup to MainActivity.onCreate()
 * This allows the library to properly handle permission request results
 */
module.exports = function withHealthConnectDelegate(config) {
  return withMainActivity(config, cfg => {
    const { contents } = cfg.modResults;

    // 1. Add import for HealthConnectPermissionDelegate
    const importStatement = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';

    if (!contents.includes(importStatement)) {
      // Add import after other imports (after the expo.modules import)
      const importRegex = /(import expo\.modules\.ReactActivityDelegateWrapper)/;
      cfg.modResults.contents = contents.replace(
        importRegex,
        `$1\n${importStatement}`
      );
    }

    // 2. Add permission delegate setup in onCreate()
    const delegateSetup = `
    // CRITICAL: Register Health Connect permission delegate to handle permission results
    // This prevents crashes when permissions are denied or not yet granted on Android 10+
    try {
      HealthConnectPermissionDelegate.setPermissionDelegate(this)
    } catch (e: Exception) {
      // Gracefully handle if Health Connect library is not available
      android.util.Log.w("MainActivity", "Health Connect permission delegate not available: \${e.message}")
    }`;

    // Check if delegate setup already exists
    if (!cfg.modResults.contents.includes('HealthConnectPermissionDelegate.setPermissionDelegate')) {
      // Add after super.onCreate(null) call
      const onCreateRegex = /(super\.onCreate\(null\))/;
      cfg.modResults.contents = cfg.modResults.contents.replace(
        onCreateRegex,
        `$1${delegateSetup}`
      );
    }

    console.log('✅ Health Connect Delegate plugin: Added permission delegate to MainActivity');

    return cfg;
  });
};
