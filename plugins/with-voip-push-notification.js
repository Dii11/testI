/**
 * Expo Config Plugin for react-native-voip-push-notification
 * 
 * Adds necessary iOS entitlements and background modes for VoIP push notifications
 * Required for CallKit integration and incoming call notifications
 */

const {
  withEntitlementsPlist,
  withInfoPlist,
} = require('@expo/config-plugins');

/**
 * Add VoIP background mode
 */
function withVoIPBackgroundMode(config) {
  return withInfoPlist(config, (config) => {
    const plist = config.modResults;

    // Ensure UIBackgroundModes exists
    if (!plist.UIBackgroundModes) {
      plist.UIBackgroundModes = [];
    }

    // Add voip mode if not present
    if (!plist.UIBackgroundModes.includes('voip')) {
      plist.UIBackgroundModes.push('voip');
    }

    return config;
  });
}

/**
 * Main plugin export
 */
module.exports = function withVoIPPushNotification(config) {
  // Apply iOS configurations
  config = withVoIPBackgroundMode(config);

  return config;
};
