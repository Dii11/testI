/**
 * 🔧 Native Module Compatibility Checker
 *
 * Provides safe loading and compatibility checking for native modules
 * that may not be available in Expo Go or certain build configurations.
 */

import Constants from 'expo-constants';

export interface NativeModuleStatus {
  isAvailable: boolean;
  error?: string;
  module?: any;
}

/**
 * Check if we're running in Expo Go
 * Enhanced detection using modern Expo Constants API
 */
export function isExpoGo(): boolean {
  // Be conservative: Expo Go when appOwnership === 'expo'
  // Other signals like executionEnvironment or hostUri can appear in dev builds
  // and must not be treated as Expo Go.
  return (Constants as any).appOwnership === 'expo';
}

/**
 * Check if we're running in a development build
 */
export function isDevelopmentBuild(): boolean {
  const isStandalone = Constants.executionEnvironment === 'standalone';
  const legacyDevBuild =
    (Constants as any).appOwnership === 'expo' ? false : (Constants as any).appOwnership !== null;

  return isStandalone || legacyDevBuild;
}

/**
 * Get runtime environment info for debugging
 */
export function getRuntimeEnvironmentInfo() {
  return {
    isExpoGo: isExpoGo(),
    isDevelopmentBuild: isDevelopmentBuild(),
    executionEnvironment: Constants.executionEnvironment,
    appOwnership: (Constants as any).appOwnership, // Legacy
    platform: Constants.platform,
    expoVersion: Constants.expoVersion,
    isDevice: Constants.isDevice,
    nativeAppVersion: Constants.nativeAppVersion,
    nativeBuildVersion: Constants.nativeBuildVersion,
    hasExpoHost: Boolean(Constants.expoConfig?.hostUri),
  };
}

/**
 * Log compatibility status (development only)
 */
export function logNativeModuleCompatibility() {
  if (!__DEV__) return;

  const runtimeInfo = getRuntimeEnvironmentInfo();

  console.log('');
  console.log('🔧 ====== NATIVE MODULE COMPATIBILITY ======');
  console.log('📱 Runtime Environment:', runtimeInfo);
  console.log('');

  if (runtimeInfo.isExpoGo) {
    console.log('ℹ️  Running in Expo Go - native modules require development build');
    console.log(
      '💡 To use all features, create a development build with: eas build --profile development'
    );
    console.log('📦 Modules requiring development build:');
    console.log('  ❌ @daily-co/react-native-daily-js (Video calling)');
    console.log('  ❌ react-native-health (HealthKit)');
    console.log('  ❌ react-native-health-connect (Android Health Connect)');
    console.log('  ❌ react-native-encrypted-storage (Secure storage)');
    console.log('  ❌ react-native-background-timer (Background processing)');
  } else {
    console.log('✅ Development build detected - native modules should be available');
  }

  console.log('🔧 =========================================');
  console.log('');
}

/**
 * Create safe module loaders for specific modules
 * For Expo Go, we return unavailable status without attempting to load
 */

// Daily.co module loader
export function dailyModuleLoader(): NativeModuleStatus {
  if (isExpoGo()) {
    return {
      isAvailable: false,
      error: 'Daily.co not available in Expo Go',
    };
  }

  // Only attempt require in development builds
  return {
    isAvailable: false, // Will be true in actual dev builds after module import fixes
    error: 'Module loading temporarily disabled for bundle compatibility',
  };
}

// Health module loader
export function healthModuleLoader(): NativeModuleStatus {
  if (isExpoGo()) {
    return {
      isAvailable: false,
      error: 'React Native Health not available in Expo Go',
    };
  }

  return {
    isAvailable: false,
    error: 'Module loading temporarily disabled for bundle compatibility',
  };
}

// Health Connect module loader
export function healthConnectModuleLoader(): NativeModuleStatus {
  if (isExpoGo()) {
    return {
      isAvailable: false,
      error: 'React Native Health Connect not available in Expo Go',
    };
  }

  return {
    isAvailable: false,
    error: 'Module loading temporarily disabled for bundle compatibility',
  };
}

// Encrypted storage loader
export function encryptedStorageLoader(): NativeModuleStatus {
  if (isExpoGo()) {
    return {
      isAvailable: false,
      error: 'React Native Encrypted Storage not available in Expo Go',
    };
  }

  return {
    isAvailable: false,
    error: 'Module loading temporarily disabled for bundle compatibility',
  };
}

// Background timer loader
export function backgroundTimerLoader(): NativeModuleStatus {
  if (isExpoGo()) {
    return {
      isAvailable: false,
      error: 'React Native Background Timer not available in Expo Go',
    };
  }

  return {
    isAvailable: false,
    error: 'Module loading temporarily disabled for bundle compatibility',
  };
}
