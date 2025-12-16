/**
 * Expo Config Plugin for react-native-callkeep
 * Configures iOS CallKit and Android ConnectionService
 */

const { withInfoPlist, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCallKeep(config) {
  // iOS Configuration
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    // Ensure audio background mode is enabled (voip is already there from app.config.js)
    if (!infoPlist.UIBackgroundModes) {
      infoPlist.UIBackgroundModes = [];
    }
    if (!infoPlist.UIBackgroundModes.includes('audio')) {
      infoPlist.UIBackgroundModes.push('audio');
    }

    return config;
  });

  // Android Configuration
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Add CallKeep permissions
    const permissions = [
      'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
      'android.permission.READ_PHONE_STATE',
      'android.permission.CALL_PHONE',
      'android.permission.USE_SIP',
    ];

    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    permissions.forEach((permission) => {
      const hasPermission = androidManifest.manifest['uses-permission'].some(
        (p) => p.$['android:name'] === permission
      );
      if (!hasPermission) {
        androidManifest.manifest['uses-permission'].push({
          $: {
            'android:name': permission,
          },
        });
      }
    });

    // Ensure mainActivity has proper launchMode
    if (mainApplication.activity) {
      mainApplication.activity.forEach((activity) => {
        if (activity.$['android:name'] === '.MainActivity') {
          activity.$['android:launchMode'] = 'singleTop';
        }
      });
    }

    return config;
  });

  return config;
};
