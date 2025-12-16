/**
 * Expo Config Plugin for Incoming Call Full-Screen Activity
 *
 * This plugin adds a full-screen activity that can be launched when
 * an incoming call notification is received. This is critical for
 * Android 10+ devices (especially budget devices like Tecno) where
 * standard full-screen intents may not work reliably.
 *
 * Features:
 * - Shows over lock screen
 * - Turns screen on
 * - Single instance launch mode
 * - Excludes from recent apps
 */

const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withIncomingCallActivity(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

    // Ensure application structure exists
    if (!androidManifest.application || !androidManifest.application[0]) {
      console.warn('⚠️ Android manifest application structure not found');
      return config;
    }

    // Initialize activity array if it doesn't exist
    if (!androidManifest.application[0].activity) {
      androidManifest.application[0].activity = [];
    }

    // Check if IncomingCallActivity already exists
    const existingActivity = androidManifest.application[0].activity.find(
      activity => activity.$['android:name'] === 'com.lns.hopmed.IncomingCallActivity'
    );

    if (!existingActivity) {
      // Add IncomingCallActivity for full-screen incoming calls
      androidManifest.application[0].activity.push({
        $: {
          'android:name': 'com.lns.hopmed.IncomingCallActivity',
          'android:theme': '@style/Theme.AppCompat.Light.NoActionBar',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:excludeFromRecents': 'true',
          'android:launchMode': 'singleInstance',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'com.lns.hopmed.INCOMING_CALL',
                },
              },
            ],
            category: [
              {
                $: {
                  'android:name': 'android.intent.category.DEFAULT',
                },
              },
            ],
          },
        ],
      });

      console.log('✅ Added IncomingCallActivity to Android manifest');
    } else {
      console.log('ℹ️ IncomingCallActivity already exists in Android manifest');
    }

    return config;
  });
};
