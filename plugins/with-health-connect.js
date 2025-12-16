// Expo config plugin to add Android <queries> and permissions for Health Connect
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withHealthConnect(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults;
    manifest.manifest = manifest.manifest || {};

    // 1. Add Health Connect permissions (always include for production builds)
    // Check both process.env and config.extra for the environment variable
    const enableManifestHealthPerms = 
      process.env.HOPMED_ANDROID_MANIFEST_HEALTH_PERMS !== 'false' &&
      (config.extra?.HOPMED_ANDROID_MANIFEST_HEALTH_PERMS !== false);
    if (enableManifestHealthPerms) {
      const healthPermissions = [
        // Core health metrics for comprehensive tracking
        'android.permission.health.READ_STEPS',
        'android.permission.health.READ_DISTANCE',
        'android.permission.health.READ_FLOORS_CLIMBED',
        // Heart rate and vitals
        'android.permission.health.READ_HEART_RATE',
        // Energy and calories
        'android.permission.health.READ_TOTAL_CALORIES_BURNED',
        'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
        // Exercise and activity sessions
        'android.permission.health.READ_EXERCISE',
        // Background data access (Android 10+)
        'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND',
      ];

      manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
      healthPermissions.forEach(permission => {
        const exists = manifest.manifest['uses-permission'].some(p => 
          p.$ && p.$['android:name'] === permission
        );
        if (!exists) {
          manifest.manifest['uses-permission'].push({
            $: { 'android:name': permission }
          });
        }
      });
    } else {
      console.log('ℹ️ Health Connect manifest permissions are disabled by env (HOPMED_ANDROID_MANIFEST_HEALTH_PERMS=false).');
    }

    // 2. Ensure <queries> exists for package visibility
    if (!manifest.manifest.queries) {
      manifest.manifest.queries = [];
    }

    const queries = manifest.manifest.queries;
    
    // 3. Add package visibility for Health Connect app
    const healthConnectPackage = 'com.google.android.apps.healthdata';
    const packageExists = (queries || []).some(q => {
      if (q.package && Array.isArray(q.package)) {
        return q.package.some(pkg => 
          pkg.$ && pkg.$['android:name'] === healthConnectPackage
        );
      }
      return false;
    });
    
    if (!packageExists) {
      // Find or create a queries entry with package array
      let queriesWithPackage = queries.find(q => q.package);
      if (!queriesWithPackage) {
        queriesWithPackage = { package: [] };
        queries.push(queriesWithPackage);
      }
      
      queriesWithPackage.package.push({
        $: { 'android:name': healthConnectPackage },
      });
    }

    // 4. Add Health Connect permissions rationale intent
    const rationaleIntent = {
      intent: [{
        action: [{ 
          $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' }
        }]
      }]
    };
    
    const intentExists = queries.some(q => {
      if (q.intent && Array.isArray(q.intent)) {
        return q.intent.some(intent => {
          if (intent.action && Array.isArray(intent.action)) {
            return intent.action.some(action => 
              action.$ && action.$['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'
            );
          }
          return false;
        });
      }
      return false;
    });
    
    if (!intentExists) {
      queries.push(rationaleIntent);
    }

    // 5. Add intent filter for Health Connect settings
    const healthSettingsIntent = {
      intent: [{
        action: [{ 
          $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' }
        }],
        category: [{
          $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' }
        }]
      }]
    };
    
    const settingsIntentExists = queries.some(q => {
      if (q.intent && Array.isArray(q.intent)) {
        return q.intent.some(intent => {
          if (intent.action && Array.isArray(intent.action)) {
            return intent.action.some(action => 
              action.$ && action.$['android:name'] === 'android.intent.action.VIEW_PERMISSION_USAGE'
            );
          }
          return false;
        });
      }
      return false;
    });
    
    if (!settingsIntentExists) {
      queries.push(healthSettingsIntent);
    }

    console.log('✅ Health Connect plugin: Added permissions and queries to AndroidManifest.xml');
    
    return cfg;
  });
};
