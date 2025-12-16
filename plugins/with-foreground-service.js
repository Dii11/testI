/**
 * Expo Config Plugin: Foreground Call Service
 * 
 * Automatically copies native Kotlin files and updates Android project
 * during prebuild/build process.
 * 
 * This plugin:
 * 1. Copies ForegroundCallService.kt to Android project
 * 2. Copies ForegroundCallServiceModule.kt to Android project  
 * 3. Copies ForegroundCallServicePackage.kt to Android project
 * 4. Updates MainApplication.kt to register the native module
 * 5. Updates AndroidManifest.xml with service declaration and permissions
 * 
 * NO MANUAL FILE COPYING NEEDED! ✅
 */

const { withDangerousMod, withMainApplication, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Copy native Kotlin files to Android project
 */
function withForegroundServiceNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = 'com.lns.hopmed';
      const packagePath = packageName.replace(/\./g, '/');
      
      // Source files in foreground-service-native directory
      const sourceDir = path.join(projectRoot, 'foreground-service-native');
      
      // Destination directory in Android project
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        packagePath
      );

      // Create destination directory if it doesn't exist
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      console.log('📱 Copying foreground service native files...');

      // Files to copy
      const filesToCopy = [
        'ForegroundCallService.kt',
        'ForegroundCallServiceModule.kt',
        'ForegroundCallServicePackage.kt',
      ];

      for (const fileName of filesToCopy) {
        const sourcePath = path.join(sourceDir, fileName);
        const destPath = path.join(destDir, fileName);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`  ✅ Copied ${fileName}`);
        } else {
          console.warn(`  ⚠️  Source file not found: ${fileName}`);
        }
      }

      console.log('✅ Foreground service native files copied successfully');

      return config;
    },
  ]);
}

/**
 * Update MainApplication.kt to register the native module
 */
function withForegroundServiceMainApplication(config) {
  return withMainApplication(config, (config) => {
    const { contents } = config.modResults;
    
    // Check if already modified
    if (contents.includes('ForegroundCallServicePackage')) {
      console.log('ℹ️  MainApplication already updated for ForegroundCallService');
      return config;
    }

    console.log('📱 Updating MainApplication.kt for ForegroundCallService...');

    let newContents = contents;

    // Find the packages list in getPackages() method
    const packagesRegex = /override fun getPackages\(\): List<ReactPackage> \{[\s\S]*?val packages = PackageList\(this\)\.packages\.toMutableList\(\)/;
    
    if (packagesRegex.test(newContents)) {
      // Add ForegroundCallServicePackage after existing packages
      newContents = newContents.replace(
        /(val packages = PackageList\(this\)\.packages\.toMutableList\(\))/,
        `$1\n    \n    // 🚨 Foreground Call Service\n    packages.add(ForegroundCallServicePackage())`
      );
      
      console.log('✅ MainApplication.kt updated for ForegroundCallService');
    } else {
      console.warn('⚠️  Could not find packages list in MainApplication.kt');
      console.warn('   You may need to manually add: packages.add(ForegroundCallServicePackage())');
    }

    config.modResults.contents = newContents;
    return config;
  });
}

/**
 * Update AndroidManifest.xml with service and permissions
 */
function withForegroundServiceManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    
    console.log('📱 Updating AndroidManifest.xml for Foreground Service...');

    // Add permissions
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
    ];

    for (const permission of permissions) {
      const exists = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === permission
      );
      
      if (!exists) {
        manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
        console.log(`  ✅ Added permission: ${permission}`);
      }
    }

    // Add service declaration
    const application = manifest.application[0];
    
    if (!application.service) {
      application.service = [];
    }

    // Check if service already exists
    const serviceExists = application.service.some(
      (s) => s.$?.['android:name'] === '.ForegroundCallService'
    );

    if (!serviceExists) {
      application.service.push({
        $: {
          'android:name': '.ForegroundCallService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone|camera',
          'android:stopWithTask': 'false',
        },
      });
      console.log('  ✅ Added ForegroundCallService to AndroidManifest.xml');
    } else {
      console.log('  ℹ️  ForegroundCallService already in AndroidManifest.xml');
    }

    // ✅ CRITICAL FIX: Add @supersami/rn-foreground-service service declarations
    // These services are REQUIRED for the library to work properly
    const supersamiServiceExists = application.service.some(
      (s) => s.$?.['android:name'] === 'com.supersami.foregroundservice.ForegroundService'
    );

    if (!supersamiServiceExists) {
      // Main foreground service from @supersami/rn-foreground-service
      application.service.push({
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'camera|microphone',
          'android:stopWithTask': 'false',
        },
      });
      console.log('  ✅ Added @supersami ForegroundService to AndroidManifest.xml');
    } else {
      console.log('  ℹ️  @supersami ForegroundService already in AndroidManifest.xml');
    }

    // Add ForegroundServiceTask (headless task service)
    const supersamiTaskExists = application.service.some(
      (s) => s.$?.['android:name'] === 'com.supersami.foregroundservice.ForegroundServiceTask'
    );

    if (!supersamiTaskExists) {
      application.service.push({
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundServiceTask',
          'android:exported': 'false',
        },
      });
      console.log('  ✅ Added @supersami ForegroundServiceTask to AndroidManifest.xml');
    } else {
      console.log('  ℹ️  @supersami ForegroundServiceTask already in AndroidManifest.xml');
    }

    console.log('✅ AndroidManifest.xml updated for Foreground Service');

    return config;
  });
}

/**
 * Main plugin export - combines all modifications
 */
module.exports = function withForegroundService(config) {
  console.log('🔧 Configuring Foreground Call Service...\n');
  
  config = withForegroundServiceNativeFiles(config);
  config = withForegroundServiceMainApplication(config);
  config = withForegroundServiceManifest(config);
  
  console.log('\n✅ Foreground Call Service configured!');
  
  return config;
};
