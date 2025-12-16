const fs = require('fs');
const path = require('path');

/**
 * Dynamic Expo Configuration
 * Loads environment variables without hard-coding them in app.json
 */

// Use our universal environment loader
const { loadEnvironmentForScenario } = require('./scripts/load-environment');

// Load environment variables for current scenario
console.log('🌍 Loading environment variables for Expo config...');
const envResult = loadEnvironmentForScenario();
console.log('✅ Environment loaded:', {
  scenario: envResult.scenario,
  filesLoaded: envResult.loadedFiles.length
});

// Helper to get environment variable with fallback
function getEnvVar(key, fallback = '') {
  return process.env[key] || fallback;
}

// Helper to get boolean environment variable
function getBooleanEnvVar(key, fallback = false) {
  const value = process.env[key];
  if (!value) return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

export default {
  expo: {
    name: 'HopMed',
    slug: 'hopmed',
    version: '1.0.22',
    orientation: 'portrait',
    icon: './assets/original-app-icon-1024.png', // ✅ Using exact icon from old app
    userInterfaceStyle: 'light',
    newArchEnabled: true, // ✅ New Architecture enabled - CallKeep fixed via patch-package
    splash: {
      image: './assets/original-hopmed-logo.png',
      resizeMode: 'contain',
      backgroundColor: '#FFFFFF', // ✅ White background to match original logo design
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      buildNumber: '1',
      bundleIdentifier: 'com.lns.hopmed',
      icon: './assets/original-app-icon-1024.png', // ✅ Using exact icon from old app
      splash: {
        image: './assets/original-hopmed-logo.png',
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF', // ✅ White background to match original logo design
        tabletImage: './assets/original-hopmed-logo.png',
      },
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
        NSCameraUsageDescription: 'This app needs camera access to take photos for medical consultations and video calls',
        NSMicrophoneUsageDescription: 'This app needs microphone access for video consultations and audio calls',
        NSLocalNetworkUsageDescription: 'This app needs local network access for video calls',
        NSBluetoothAlwaysUsageDescription: 'This app needs bluetooth access for audio devices during calls',
        NSUserNotificationsUsageDescription: 'This app needs notification access to alert you about incoming video and audio calls',
        // ✅ FIXED: Removed NSHealthRequiredReadAuthorizationTypeIdentifiers
        // The @kingstinct/react-native-healthkit plugin automatically generates this based on requested permissions
        // Manual configuration was causing conflicts with the plugin's auto-generated entitlements

        // ✅ FIXED: Removed UIRequiredDeviceCapabilities: ['healthkit']
        // This was too restrictive - made app only installable on HealthKit-capable devices
        // Now health features gracefully degrade on unsupported devices (iPads, old iPhones, simulators)

        // Valid keys: 'audio', 'location', 'voip', 'fetch', 'processing', 'remote-notification', etc.
        UIBackgroundModes: ['voip', 'fetch', 'processing', 'remote-notification'],
          // Allow simulator by not requiring arm64-only devices
          UIRequiredDeviceCapabilities: [],
        // Required when using 'processing' in UIBackgroundModes
        BGTaskSchedulerPermittedIdentifiers: [
          'com.lns.hopmed.healthsync',
          'com.lns.hopmed.backgroundfetch',
          'com.lns.hopmed.dataprocessing',
        ],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      versionCode: 46,
      icon: './assets/original-app-icon-1024.png', // ✅ Using exact icon from old app
      adaptiveIcon: {
        foregroundImage: './assets/original-adaptive-icon-foreground.png', // ✅ Using exact icon from old app
        backgroundColor: '#2b216c', // ✅ Using exact gradient start color from old app
        monochromeImage: './assets/original-adaptive-icon-foreground.png', // ✅ Using exact icon from old app
      },
      splash: {
        image: './assets/original-hopmed-logo.png',
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF', // ✅ White background to match original logo design
        mdpi: './assets/original-hopmed-logo.png',
        hdpi: './assets/original-hopmed-logo.png',
        xhdpi: './assets/original-hopmed-logo.png',
        xxhdpi: './assets/original-hopmed-logo.png',
        xxxhdpi: './assets/original-hopmed-logo.png',
      },
      package: 'com.lns.hopmed',
      permissions: [
        // Core app permissions
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.INTERNET',
        'android.permission.WAKE_LOCK',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_CAMERA',
        'android.permission.FOREGROUND_SERVICE_MICROPHONE',
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.BLUETOOTH_CONNECT',
        // 🚨 CRITICAL: Incoming call permissions for Android 10+
        'android.permission.USE_FULL_SCREEN_INTENT', // Enables full-screen intent notifications (wakes device, shows over lock screen)
        'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', // Allows app to request battery optimization exemption for incoming calls
        'android.permission.SYSTEM_ALERT_WINDOW', // Allows displaying over other apps
        // CallKeep permissions for incoming call UI
        'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
        'android.permission.READ_PHONE_STATE',
        'android.permission.CALL_PHONE',
        'android.permission.USE_SIP',
        // Health permissions (minimal set for steps tracking)
        'android.permission.health.READ_STEPS',
        'android.permission.health.READ_DISTANCE',
        'android.permission.health.READ_FLOORS_CLIMBED',
        'android.permission.health.READ_HEART_RATE',
        'android.permission.health.READ_TOTAL_CALORIES_BURNED',
        'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
        'android.permission.health.READ_EXERCISE',
        'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND', // Background data access
      ],
      intentFilters: [
        {
          action: 'MAIN',
          category: ['LAUNCHER'],
        },
      ],
      mainActivity: {
        launchMode: 'singleTop',
      },
      googleServicesFile: './google-services.json',
    },
    // Dynamic extra section that loads from environment variables
    extra: {
      copyright: '2024 LaNewScience',
      note: 'Environment variables dynamically loaded from .env files and process.env',
      
      // Build Configuration (safe to expose)
      HOPMED_BUILD_ENVIRONMENT: getEnvVar('HOPMED_BUILD_ENVIRONMENT', 'development'),
      HOPMED_API_BASE_URL: getEnvVar('HOPMED_API_BASE_URL', 'http://141.94.71.13:3001/api/v1'),
      HOPMED_DEBUG_MODE: getEnvVar('HOPMED_DEBUG_MODE', 'true'),
      HOPMED_DEMO_MODE: getEnvVar('HOPMED_DEMO_MODE', 'false'),
      
      // Feature Flags (safe to expose)
      HOPMED_FEATURE_VIDEO_ENABLED: getEnvVar('HOPMED_FEATURE_VIDEO_ENABLED', 'true'),
      HOPMED_FEATURE_HEALTH_ENABLED: getEnvVar('HOPMED_FEATURE_HEALTH_ENABLED', 'true'),
      HOPMED_FEATURE_ANALYTICS_ENABLED: getEnvVar('HOPMED_FEATURE_ANALYTICS_ENABLED', 'true'),
      HOPMED_FEATURE_PUSH_NOTIFICATIONS_ENABLED: getEnvVar('HOPMED_FEATURE_PUSH_NOTIFICATIONS_ENABLED', 'true'),
      HOPMED_FEATURE_AGORA_ENABLED: getEnvVar('HOPMED_FEATURE_AGORA_ENABLED', 'false'),
      
      // Build Settings (safe to expose)
      HOPMED_BUILD_SENTRY_ENABLED: getEnvVar('HOPMED_BUILD_SENTRY_ENABLED', 'false'),
      HOPMED_BUILD_HEALTH_CONNECT_ENABLED: getEnvVar('HOPMED_BUILD_HEALTH_CONNECT_ENABLED', 'true'),
      HOPMED_BUILD_HEALTHKIT_ENABLED: getEnvVar('HOPMED_BUILD_HEALTHKIT_ENABLED', 'true'),
      
      // Health Permissions Configuration
      HOPMED_ANDROID_MANIFEST_HEALTH_PERMS: getBooleanEnvVar('HOPMED_ANDROID_MANIFEST_HEALTH_PERMS', true),
      HOPMED_IOS_HEALTH_RECORDS_ENABLED: getBooleanEnvVar('HOPMED_IOS_HEALTH_RECORDS_ENABLED', false),
      
      // Non-secret Configuration (safe to expose)
      HOPMED_VIDEO_DAILY_DOMAIN: getEnvVar('HOPMED_VIDEO_DAILY_DOMAIN', 'mbinina.daily.co'),
      HOPMED_AUTH_DOMAIN: getEnvVar('HOPMED_AUTH_DOMAIN', 'hopmed.com'),
      
      // Timeouts (safe to expose)
      HOPMED_INIT_TIMEOUT: getEnvVar('HOPMED_INIT_TIMEOUT', '15000'),
      HOPMED_SPLASH_TIMEOUT: getEnvVar('HOPMED_SPLASH_TIMEOUT', '10000'),
      HOPMED_REDUX_PERSIST_TIMEOUT: getEnvVar('HOPMED_REDUX_PERSIST_TIMEOUT', '12000'),
      HOPMED_PERMISSION_TIMEOUT: getEnvVar('HOPMED_PERMISSION_TIMEOUT', '8000'),
      
      // Upload Configuration (safe to expose)
      HOPMED_UPLOAD_MAX_SIZE: getEnvVar('HOPMED_UPLOAD_MAX_SIZE', '10485760'),
      HOPMED_UPLOAD_ALLOWED_TYPES: getEnvVar('HOPMED_UPLOAD_ALLOWED_TYPES', 'jpg,jpeg,png,pdf'),
      
      // SENTRY DSN (exposed for Expo Go development, secured for production)
      // In production builds, Sentry DSN comes from secure CI/CD variables
      // In Expo Go development, we need it in extras for initialization
      HOPMED_SENTRY_DSN: getEnvVar('HOPMED_SENTRY_DSN'),
      
      // NOTE: Other secrets (API keys, auth tokens) are NEVER exposed in extra
      // They are loaded directly by the app via process.env from:
      // - GitLab CI/CD variables (production)
      // - EAS build environment (mobile builds)
      // - .env files (development)
      
      eas: {
        projectId: '0b8a9e9b-2b76-4743-adec-c08db3f01610',
      },
    },
    plugins: [
      './plugins/with-fix-react-runtime-modules.js', // 🔧 CRITICAL: Fixes "Redefinition of module 'react_runtime'" error in RN 0.79.x
      './plugins/with-release-signing.js', // 🔐 CRITICAL: Configures proper release keystore signing for Play Store
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: "35.0.0",
            usesCleartextTraffic: true,
            enableHermes: true,
            enableProguardInReleaseBuilds: false, // ⚠️ ProGuard disabled - builds will be larger but simpler
            // extraProguardRules: Comprehensive ProGuard rules removed since ProGuard is disabled
            // To re-enable: set enableProguardInReleaseBuilds to true and restore rules from git history
            extraProguardRules: ``,
            extraMavenRepos: [
             '../../node_modules/@notifee/react-native/android/libs',
             ],
          },
          ios: {
            deploymentTarget: '15.1',
            debugInformationFormat: 'dwarf-with-dsym',
            // Fix C++ compilation issues
            extraXcodebuildSettings: {
              'CLANG_CXX_LANGUAGE_STANDARD': 'c++20',
              'CLANG_CXX_LIBRARY': 'libc++',
              'DEBUG_INFORMATION_FORMAT': 'dwarf-with-dsym',
              'DWARF_DSYM_FILE_SHOULD_ACCOMPANY_PRODUCT': 'YES',
              'GCC_GENERATE_DEBUGGING_SYMBOLS': 'YES',
              'STRIP_INSTALLED_PRODUCT': 'NO',
              'COPY_PHASE_STRIP': 'NO',
              'DEPLOYMENT_POSTPROCESSING': 'NO',
            },
            // Enable Hermes for optimal performance on RN 0.79+
            // Hermes is fully compatible with Firebase and all other dependencies
            jsEngine: 'hermes',
          },
        },
      ],
      [
        '@daily-co/config-plugin-rn-daily-js',
        {},
      ],
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: 'react-native',
          organization: 'self-m66',
        },
      ],
      'expo-secure-store',
      '@react-native-firebase/app',
      '@react-native-firebase/messaging', // CRITICAL: Required for FCM push notifications
      './plugins/with-firebase-targeted-modular-headers.js', // CRITICAL: Targeted modular headers for Firebase pods
        './plugins/with-firebase-appdelegate.js', // Ensure Firebase/notification delegate are persisted
      // NOTE: @notifee/react-native uses autolinking - no config plugin needed
      [
        '@kingstinct/react-native-healthkit',
        {
          background: true, // ✅ CRITICAL: Enables background-delivery entitlement for real-time health data updates
          NSHealthShareUsageDescription: 'HopMed needs access to read your health data including steps, heart rate, calories burned, and exercise time to provide comprehensive wellness tracking and share your health progress with your healthcare providers during consultations.',
          NSHealthUpdateUsageDescription: 'HopMed needs to write health data including activity metrics and wellness information to help you track your fitness goals and maintain accurate, comprehensive health records.',
        }
      ],
      './plugins/with-health-connect.js',
      './plugins/with-health-connect-delegate.js', // CRITICAL: Adds permission delegate to MainActivity for Android 10+ compatibility
      './plugins/with-health-connect-rationale.js', // CRITICAL: Adds Android 14+ support and PermissionsRationaleActivity
      './plugins/androidManifestPlugin.js',
      './plugins/with-bundle-package-type.js',
      '@config-plugins/react-native-callkeep',
      './plugins/with-voip-push-notification.js', // CRITICAL: Adds VoIP push notification support for iOS CallKit
      './plugins/with-incoming-call-activity.js', // CRITICAL: Adds full-screen incoming call activity for Android 10+
      './plugins/with-incoming-call-native-module.js', // 🚨 Automatically copies native files and updates Android project
      './plugins/with-foreground-service.js', // 🚨 CRITICAL: Foreground service for Android 12+ (prevents app from being killed during calls)
      [
        'expo-notifications',
        {
          icon: './assets/original-app-icon-1024.png', // ✅ Using exact icon from old app
          color: '#4F46E5',
          enableBackgroundRemoteNotifications: true, // ✅ Required for iOS background push notifications
        },
      ],
    ],
    owner: 'haashinaa',
  },
};