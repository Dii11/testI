/**
 * Expo Config Plugin for @kingstinct/react-native-healthkit
 *
 * This plugin:
 * - Adds HealthKit entitlements
 * - Configures Info.plist with required permissions
 * - Adds HealthKit capability requirement
 * - Sets up background modes for health data
 *
 * Graceful handling:
 * - All operations are defensive with proper error logging
 * - Validates existing values before modifications
 * - Only adds permissions that are actually used
 */

const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

/**
 * Main config plugin function
 */
module.exports = function withHealthKitKingstinct(config) {
  console.log('🏥 Configuring HealthKit with @kingstinct/react-native-healthkit...');

  // Configure entitlements
  config = configureEntitlements(config);

  // Configure Info.plist
  config = configureInfoPlist(config);

  console.log('✅ HealthKit configuration complete');

  return config;
};

/**
 * Configure HealthKit entitlements
 */
function configureEntitlements(config) {
  return withEntitlementsPlist(config, cfg => {
    try {
      // Enable HealthKit capability (required)
      cfg.modResults['com.apple.developer.healthkit'] = true;

      // Check if Health Records should be enabled (optional)
      const enableHealthRecords =
        process.env.HOPMED_IOS_HEALTH_RECORDS_ENABLED === 'true' ||
        config.extra?.HOPMED_IOS_HEALTH_RECORDS_ENABLED === true;

      if (enableHealthRecords) {
        cfg.modResults['com.apple.developer.healthkit.access'] = ['health-records'];
        console.log('  ℹ️  Health Records access enabled');
      }

      // Add App Group if configured (optional, for HealthKit background delivery)
      if (process.env.HOPMED_IOS_APP_GROUP) {
        const groupId = process.env.HOPMED_IOS_APP_GROUP;
        const existing = cfg.modResults['com.apple.security.application-groups'] || [];

        if (!existing.includes(groupId)) {
          cfg.modResults['com.apple.security.application-groups'] = [...existing, groupId];
          console.log(`  ℹ️  App Group added: ${groupId}`);
        }
      }

      console.log('  ✅ HealthKit entitlements configured:', {
        healthkit: true,
        healthRecords: enableHealthRecords,
        appGroups: cfg.modResults['com.apple.security.application-groups']?.length || 0
      });

    } catch (error) {
      console.error('  ❌ Error configuring entitlements:', error);
      throw error;
    }

    return cfg;
  });
}

/**
 * Configure Info.plist with HealthKit permissions
 */
function configureInfoPlist(config) {
  return withInfoPlist(config, cfg => {
    try {
      // Only request permissions for health data types actually used in the app
      const requiredHealthKitTypes = [
        // Activity metrics (useStepCounter)
        'HKQuantityTypeIdentifierStepCount',

        // Heart rate and vitals (useHeartRate)
        'HKQuantityTypeIdentifierHeartRate',

        // Energy and calories (useCalories)
        'HKQuantityTypeIdentifierActiveEnergyBurned',

        // Exercise and activity time (useActiveTime)
        'HKQuantityTypeIdentifierAppleExerciseTime',
        'HKWorkoutTypeIdentifier',
      ];

      // Set required read authorization types
      cfg.modResults['NSHealthRequiredReadAuthorizationTypeIdentifiers'] = requiredHealthKitTypes;

      // Add HealthKit to required device capabilities
      if (!cfg.modResults['UIRequiredDeviceCapabilities']) {
        cfg.modResults['UIRequiredDeviceCapabilities'] = [];
      }

      if (!Array.isArray(cfg.modResults['UIRequiredDeviceCapabilities'])) {
        cfg.modResults['UIRequiredDeviceCapabilities'] = [cfg.modResults['UIRequiredDeviceCapabilities']];
      }

      if (!cfg.modResults['UIRequiredDeviceCapabilities'].includes('healthkit')) {
        cfg.modResults['UIRequiredDeviceCapabilities'].push('healthkit');
      }

      // Configure background modes for HealthKit background delivery
      if (!cfg.modResults['UIBackgroundModes']) {
        cfg.modResults['UIBackgroundModes'] = [];
      }

      if (!Array.isArray(cfg.modResults['UIBackgroundModes'])) {
        cfg.modResults['UIBackgroundModes'] = [cfg.modResults['UIBackgroundModes']];
      }

      // Valid iOS background modes for HealthKit
      const healthBackgroundModes = ['processing', 'fetch'];
      healthBackgroundModes.forEach(mode => {
        if (!cfg.modResults['UIBackgroundModes'].includes(mode)) {
          cfg.modResults['UIBackgroundModes'].push(mode);
        }
      });

      // Privacy usage descriptions (required by App Store)
      cfg.modResults['NSHealthShareUsageDescription'] =
        cfg.modResults['NSHealthShareUsageDescription'] ||
        'HopMed needs access to read your health data including steps, heart rate, calories burned, and exercise time to provide comprehensive wellness tracking and share your health progress with your healthcare providers during consultations.';

      cfg.modResults['NSHealthUpdateUsageDescription'] =
        cfg.modResults['NSHealthUpdateUsageDescription'] ||
        'HopMed needs to write health data including activity metrics and wellness information to help you track your fitness goals and maintain accurate, comprehensive health records.';

      // Health Records description (only if enabled)
      const enableHealthRecords =
        process.env.HOPMED_IOS_HEALTH_RECORDS_ENABLED === 'true' ||
        config.extra?.HOPMED_IOS_HEALTH_RECORDS_ENABLED === true;

      if (enableHealthRecords) {
        cfg.modResults['NSHealthClinicalHealthRecordsShareUsageDescription'] =
          'HopMed can access your clinical health records to provide comprehensive medical history to your healthcare providers during consultations.';
      }

      console.log('  ✅ Info.plist configured:', {
        requiredTypes: requiredHealthKitTypes.length,
        backgroundModes: cfg.modResults['UIBackgroundModes'].length,
        deviceCapabilities: cfg.modResults['UIRequiredDeviceCapabilities'].length
      });

    } catch (error) {
      console.error('  ❌ Error configuring Info.plist:', error);
      throw error;
    }

    return cfg;
  });
}
