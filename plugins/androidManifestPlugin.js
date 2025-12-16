const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function androidManifestPlugin(config) {
  return withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults.manifest;

    // Ensure application and activity structure exists
    if (!androidManifest.application || !androidManifest.application[0]) {
      console.warn('⚠️ Android manifest application structure not found');
      return config;
    }

    if (!androidManifest.application[0].activity || !androidManifest.application[0].activity[0]) {
      console.warn('⚠️ Android manifest main activity not found');
      return config;
    }

    // Ensure intent-filter exists
    if (!androidManifest.application[0].activity[0]['intent-filter']) {
      androidManifest.application[0].activity[0]['intent-filter'] = [];
    }

    // Add Health Connect permissions rationale intent filter
    const healthRationaleIntentFilter = {
      action: [
        {
          $: {
            'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
          },
        },
      ],
    };

    // Check if the intent filter already exists
    const existingIntentFilter = androidManifest.application[0].activity[0]['intent-filter'].find(filter => {
      return filter.action && filter.action.some(action =>
        action.$ && action.$['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'
      );
    });

    if (!existingIntentFilter) {
      androidManifest.application[0].activity[0]['intent-filter'].push(healthRationaleIntentFilter);
      console.log('✅ Added Health Connect permissions rationale intent filter');
    } else {
      console.log('ℹ️ Health Connect permissions rationale intent filter already exists');
    }

    // 🔧 FIX: Handle Firebase notification color manifest merger conflict
    // This ensures our custom notification color overrides the library's default
    if (!androidManifest.application[0]['meta-data']) {
      androidManifest.application[0]['meta-data'] = [];
    }

    // Find existing Firebase notification color meta-data
    const firebaseColorMetaData = androidManifest.application[0]['meta-data'].find(meta => {
      return meta.$ && meta.$['android:name'] === 'com.google.firebase.messaging.default_notification_color';
    });

    if (firebaseColorMetaData) {
      // Add tools:replace attribute to override library's value
      if (!firebaseColorMetaData.$['tools:replace']) {
        firebaseColorMetaData.$['tools:replace'] = 'android:resource';
        console.log('✅ Added tools:replace to Firebase notification color meta-data');
      } else {
        console.log('ℹ️ Firebase notification color meta-data already has tools:replace');
      }
    } else {
      console.log('ℹ️ Firebase notification color meta-data not found (will be added by other plugins)');
    }

    return config;
  });
};