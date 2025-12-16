/**
 * Expo Config Plugin: Incoming Call Native Module
 * 
 * Automatically copies native Kotlin files and updates Android project
 * during prebuild/build process.
 * 
 * This plugin:
 * 1. Copies IncomingCallActivity.kt to Android project
 * 2. Copies NativeIncomingCallModule.kt to Android project  
 * 3. Copies NativeIncomingCallPackage.kt to Android project
 * 4. Updates MainActivity.kt with incoming call handling
 * 5. Updates MainApplication.kt to register the native module
 * 
 * NO MANUAL FILE COPYING NEEDED! ✅
 */

const { withDangerousMod, withMainActivity, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Copy native Kotlin files to Android project
 */
function withIncomingCallNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = 'com.lns.hopmed';
      const packagePath = packageName.replace(/\./g, '/');
      
      // Source files in android-native-fix directory
      const sourceDir = path.join(projectRoot, 'android-native-fix');
      
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

      console.log('📱 Copying incoming call native files...');

      // Files to copy
      const filesToCopy = [
        'IncomingCallActivity.kt',
        'NativeIncomingCallModule.kt',
        'NativeIncomingCallPackage.kt',
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

      console.log('✅ Native files copied successfully');

      return config;
    },
  ]);
}

/**
 * Update MainActivity.kt with incoming call handling
 */
function withIncomingCallMainActivity(config) {
  return withMainActivity(config, (config) => {
    const { contents } = config.modResults;
    
    // Check if already modified
    if (contents.includes('handleIncomingCallIntent')) {
      console.log('ℹ️  MainActivity already updated');
      return config;
    }

    console.log('📱 Updating MainActivity.kt...');

    let newContents = contents;

    // Add imports at the top (after package declaration)
    const importsToAdd = [];
    
    if (!newContents.includes('import android.content.Intent')) {
      importsToAdd.push('import android.content.Intent');
    }
    if (!newContents.includes('import android.os.Bundle')) {
      importsToAdd.push('import android.os.Bundle');
    }
    if (!newContents.includes('import com.facebook.react.bridge.Arguments')) {
      importsToAdd.push('import com.facebook.react.bridge.Arguments');
    }
    if (!newContents.includes('import com.facebook.react.bridge.WritableMap')) {
      importsToAdd.push('import com.facebook.react.bridge.WritableMap');
    }
    if (!newContents.includes('import com.facebook.react.modules.core.DeviceEventManagerModule')) {
      importsToAdd.push('import com.facebook.react.modules.core.DeviceEventManagerModule');
    }

    // Add only missing imports
    if (importsToAdd.length > 0) {
      const importsString = '\n' + importsToAdd.join('\n');
      newContents = newContents.replace(
        /import com\.facebook\.react\.ReactActivity/,
        `import com.facebook.react.ReactActivity${importsString}`
      );
    }

    // Find the MainActivity class and add methods before the closing brace
    const mainActivityClassMatch = newContents.match(/class MainActivity\s*:\s*ReactActivity\(\)\s*\{/);
    
    if (mainActivityClassMatch) {
      // Only add onCreate if it doesn't exist, otherwise just add onNewIntent
      const hasOnCreate = newContents.includes('override fun onCreate');
      
      let methodsToAdd = `

  // 🚨 INCOMING CALL: Handle new intent
  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    
    if (intent?.action == "com.lns.hopmed.INCOMING_CALL") {
      handleIncomingCallIntent(intent)
    }
  }`;
  
      if (!hasOnCreate) {
        methodsToAdd += `

  // 🚨 INCOMING CALL: Handle initial intent
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    intent?.let { initialIntent ->
      if (initialIntent.action == "com.lns.hopmed.INCOMING_CALL") {
        handleIncomingCallIntent(initialIntent)
      }
    }
  }`;
      }
      
      methodsToAdd += `

  // 🚨 INCOMING CALL: Process intent and send to React Native
  private fun handleIncomingCallIntent(intent: Intent) {
    val showIncomingCallScreen = intent.getBooleanExtra("showIncomingCallScreen", false)
    
    if (!showIncomingCallScreen) {
      return
    }
    
    val callId = intent.getStringExtra("callId") ?: ""
    val callerId = intent.getStringExtra("callerId") ?: ""
    val callerName = intent.getStringExtra("callerName") ?: ""
    val callerType = intent.getStringExtra("callerType") ?: "customer"
    val callType = intent.getStringExtra("callType") ?: "video"
    val roomUrl = intent.getStringExtra("roomUrl") ?: ""
    val metadataJson = intent.getStringExtra("metadata") ?: "{}"
    
    android.util.Log.d("MainActivity", "📱 Incoming call: \$callerName")
    
    val callData = Arguments.createMap().apply {
      putString("callId", callId)
      putString("callerId", callerId)
      putString("callerName", callerName)
      putString("callerType", callerType)
      putString("callType", callType)
      putString("roomUrl", roomUrl)
      putString("metadata", metadataJson)
    }
    
    sendEventToReactNative("IncomingCallReceived", callData)
  }

  // 🚨 INCOMING CALL: Send event to React Native
  private fun sendEventToReactNative(eventName: String, params: WritableMap?) {
    try {
      reactInstanceManager?.currentReactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit(eventName, params)
        
      android.util.Log.d("MainActivity", "✅ Sent event: \$eventName")
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "❌ Failed to send event: \${e.message}")
    }
  }
`;

      // Add methods before the last closing brace of the class
      // Find the position right before the last }
      const lastBraceIndex = newContents.lastIndexOf('}');
      newContents = 
        newContents.substring(0, lastBraceIndex) + 
        methodsToAdd + 
        '\n' + 
        newContents.substring(lastBraceIndex);
    }

    config.modResults.contents = newContents;
    console.log('✅ MainActivity.kt updated');

    return config;
  });
}

/**
 * Update MainApplication.kt to register native module package
 */
function withIncomingCallMainApplication(config) {
  return withMainApplication(config, (config) => {
    const { contents } = config.modResults;

    // Check if already modified
    if (contents.includes('NativeIncomingCallPackage')) {
      console.log('ℹ️  MainApplication already updated');
      return config;
    }

    console.log('📱 Updating MainApplication.kt...');

    let newContents = contents;

    // Find the getPackages() method and add our package
    const getPackagesMatch = newContents.match(/override fun getPackages\(\)[\s\S]*?val packages = PackageList\(this\)\.packages/);
    
    if (getPackagesMatch) {
      // Add package registration after PackageList line
      newContents = newContents.replace(
        /val packages = PackageList\(this\)\.packages/,
        `val packages = PackageList(this).packages
    
    // 🚨 INCOMING CALL: Register native module
    packages.add(NativeIncomingCallPackage())`
      );
      
      config.modResults.contents = newContents;
      console.log('✅ MainApplication.kt updated');
    } else {
      console.warn('⚠️  Could not find getPackages() method in MainApplication.kt');
      console.warn('   You may need to manually add: packages.add(NativeIncomingCallPackage())');
    }

    return config;
  });
}

/**
 * Main plugin - combines all modifications
 */
module.exports = function withIncomingCallNativeModule(config) {
  console.log('\n🔧 Configuring Incoming Call Native Module...\n');
  
  config = withIncomingCallNativeFiles(config);
  config = withIncomingCallMainActivity(config);
  config = withIncomingCallMainApplication(config);
  
  console.log('\n✅ Incoming Call Native Module configured!\n');
  
  return config;
};
