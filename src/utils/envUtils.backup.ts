import Constants from 'expo-constants';

import { getConfig, env } from '../config/env.utils.enhanced';

/**
 * 🌍 Environment Utilities - Enhanced with New Environment System
 *
 * This file provides backward compatibility while using the new standardized
 * environment variable management system.
 *
 * @deprecated Many functions in this file are deprecated.
 * Use the new environment utilities from '../config/env.utils.enhanced'
 *
 * Migration Guide:
 * - getEnvironmentConfig() -> env.getConfig()
 * - getFeatureFlags() -> env.features.getAll()
 * - API functions -> env.api.*
 * - Video functions -> env.video.*
 *
 * See ENVIRONMENT_VARIABLES_DESIGN.md for complete migration instructions.
 */

/**
 * @deprecated Use EnvConfig from '../config/env.types' instead
 */
export interface EnvConfig {
  apiUrl: string;
  sentryDsn?: string;
  sentryAuthToken?: string;
  dailyApiKey?: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isExpoGo: boolean;
  environment: 'development' | 'staging' | 'production';
}

/**
 * @deprecated Use getConfig() from '../config/env.config' instead
 */
let _legacyConfigCache: EnvConfig | null = null;

/**
 * Get environment variable with graceful fallback
 * @deprecated Use getConfig() or specific env utilities instead
 */
function getEnvVar(key: string, fallback?: string): string | undefined {
  if (__DEV__) {
    console.warn(
      `[DEPRECATED] getEnvVar('${key}') is deprecated. Use the new env utilities from '../config/env.utils.enhanced'.`
    );
  }

  // Try the new environment system first
  try {
    const config = getConfig();

    // Map legacy keys to new keys
    const legacyMapping: Record<string, any> = {
      API_URL: config.HOPMED_API_BASE_URL,
      DAILY_API_KEY: config.HOPMED_VIDEO_DAILY_API_KEY,
      DAILY_CO_API_KEY: config.HOPMED_VIDEO_DAILY_API_KEY,
      SENTRY_DSN: config.HOPMED_SENTRY_DSN,
      SENTRY_AUTH_TOKEN: config.HOPMED_SENTRY_AUTH_TOKEN,
      DEBUG_MODE: config.HOPMED_DEBUG_MODE.toString(),
      NODE_ENV: config.HOPMED_BUILD_ENVIRONMENT,
    };

    if (legacyMapping[key] !== undefined) {
      return legacyMapping[key];
    }
  } catch {
    // Fall back to legacy behavior if new system fails
  }

  // Legacy fallback behavior
  if (process.env[key]) {
    return process.env[key];
  }

  if (Constants.expoConfig?.extra?.[key]) {
    return Constants.expoConfig.extra[key];
  }

  if ((Constants.manifest as any)?.extra?.[key]) {
    return (Constants.manifest as any).extra[key];
  }

  return fallback;
}

/**
 * Get environment variable with type validation
 */
function getRequiredEnvVar(key: string, fallback?: string): string {
  const value = getEnvVar(key, fallback);
  if (!value) {
    console.warn(`⚠️ Missing environment variable: ${key}`);
    if (fallback) {
      console.warn(`🔄 Using fallback value for ${key}`);
      return fallback;
    }
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get boolean environment variable
 */
function getBooleanEnvVar(key: string, fallback: boolean = false): boolean {
  const value = getEnvVar(key);
  if (!value) return fallback;

  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Get number environment variable
 */
function getNumberEnvVar(key: string, fallback?: number): number | undefined {
  const value = getEnvVar(key);
  if (!value) return fallback;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`⚠️ Invalid number format for ${key}: ${value}`);
    return fallback;
  }

  return parsed;
}

/**
 * Detect if running in Expo Go
 */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Detect current environment
 */
function detectEnvironment(): 'development' | 'staging' | 'production' {
  // Check explicit environment variable
  const env = getEnvVar('NODE_ENV') || getEnvVar('EXPO_ENV');
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';

  // Check if in development or Expo Go
  if (__DEV__ || isExpoGo()) return 'development';

  // Check API URL to infer environment
  const apiUrl = getEnvVar('API_URL') || Constants.expoConfig?.extra?.apiUrl || '';
  if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    return 'development';
  }
  if (apiUrl.includes('staging')) {
    return 'staging';
  }

  return 'production';
}

/**
 * Main environment configuration
 * @deprecated Use getConfig() from '../config/env.config' instead
 */
export function getEnvironmentConfig(): EnvConfig {
  if (__DEV__) {
    console.warn(
      '[DEPRECATED] getEnvironmentConfig() is deprecated. Use getConfig() from ../config/env.config instead.'
    );
  }

  // Cache the legacy config to avoid repeated warnings
  if (_legacyConfigCache) {
    return _legacyConfigCache;
  }

  try {
    // Use the new environment system internally
    const newConfig = getConfig();

    // Map new config to legacy format
    const legacyConfig: EnvConfig = {
      apiUrl: newConfig.HOPMED_API_BASE_URL,
      sentryDsn: newConfig.HOPMED_SENTRY_DSN,
      sentryAuthToken: newConfig.HOPMED_SENTRY_AUTH_TOKEN,
      dailyApiKey: newConfig.HOPMED_VIDEO_DAILY_API_KEY,
      isDevelopment: newConfig.HOPMED_DEBUG_MODE,
      isProduction: newConfig.HOPMED_BUILD_ENVIRONMENT === 'production',
      isExpoGo: Constants.appOwnership === 'expo',
      environment: newConfig.HOPMED_BUILD_ENVIRONMENT as 'development' | 'staging' | 'production',
    };

    _legacyConfigCache = legacyConfig;
    return legacyConfig;
  } catch (error) {
    // Fallback to legacy behavior if new system fails
    console.warn('New environment system failed, falling back to legacy behavior:', error);
    return getLegacyEnvironmentConfig();
  }
}

/**
 * Legacy environment configuration implementation
 * @private
 */
function getLegacyEnvironmentConfig(): EnvConfig {
  const environment = detectEnvironment();
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';
  const isRunningInExpoGo = isExpoGo();

  // Get API URL with fallbacks
  const apiUrl = getRequiredEnvVar(
    'API_URL',
    Constants.expoConfig?.extra?.apiUrl || 'http://141.94.71.13:3001/api/v1'
  );

  // Get optional Sentry configuration - try expo config first (for Expo Go)
  const sentryDsn = getEnvVar('SENTRY_DSN') || Constants.expoConfig?.extra?.sentryDsn;
  const sentryAuthToken = getEnvVar('SENTRY_AUTH_TOKEN');

  // Get Daily.co API key for video calling
  const dailyApiKey =
    getEnvVar('DAILY_API_KEY') ||
    getEnvVar('DAILY_CO_API_KEY') ||
    Constants.expoConfig?.extra?.dailyApiKey;

  const config: EnvConfig = {
    apiUrl,
    sentryDsn,
    sentryAuthToken,
    dailyApiKey,
    isDevelopment,
    isProduction,
    isExpoGo: isRunningInExpoGo,
    environment,
  };

  // Log configuration in development with detailed environment variable detection
  if (isDevelopment) {
    console.log('🔍 Environment Variable Detection:');
    console.log('  📁 .env file exists:', typeof process !== 'undefined' && !!process.env.API_URL);
    console.log('  🌐 API_URL from process.env:', process.env.API_URL || 'undefined');
    console.log(
      '  🌐 API_URL from expo config:',
      Constants.expoConfig?.extra?.apiUrl || 'undefined'
    );
    console.log('  🌐 NODE_ENV from process.env:', process.env.NODE_ENV || 'undefined');
    console.log('  🌐 EXPO_ENV from process.env:', process.env.EXPO_ENV || 'undefined');
    console.log('  🌐 Final API URL used:', apiUrl);

    // Detect source of API URL
    let apiUrlSource = 'fallback';
    if (process.env.API_URL) {
      apiUrlSource = '.env file (process.env)';
    } else if (Constants.expoConfig?.extra?.apiUrl) {
      apiUrlSource = 'app.json (expo config)';
    }
    console.log('  🎯 API URL source:', apiUrlSource);
    console.log('');

    console.log('🌍 Environment Configuration:', {
      environment,
      apiUrl,
      isExpoGo: isRunningInExpoGo,
      hasSentryDsn: !!sentryDsn,
      hasSentryAuthToken: !!sentryAuthToken,
      hasDailyApiKey: !!dailyApiKey,
    });
  }

  return config;
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): boolean {
  try {
    const config = getEnvironmentConfig();

    // Validate API URL format
    if (!config.apiUrl.startsWith('http')) {
      console.error('❌ Invalid API URL format:', config.apiUrl);
      return false;
    }

    // In production, ensure we have proper HTTPS
    if (config.isProduction && !config.apiUrl.startsWith('https://')) {
      console.warn('⚠️ Production should use HTTPS API URL');
    }

    return true;
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    return false;
  }
}

/**
 * Get feature flags
 * @deprecated Use getFeatureFlags() from '../config/env.config' or env.features.getAll() instead
 */
export function getFeatureFlags() {
  if (__DEV__) {
    console.warn(
      '[DEPRECATED] getFeatureFlags() from envUtils is deprecated. Use getFeatureFlags() from ../config/env.config instead.'
    );
  }

  try {
    // Use the new feature flags system
    const newFlags = env.features.getAll();

    // Map new flags to legacy format
    return {
      enableVideoCall: newFlags.videoCall,
      enableHealthTracking: newFlags.healthTracking,
      enablePushNotifications: newFlags.pushNotifications,
      enableAnalytics: newFlags.analytics,
      enableSentry: newFlags.sentry,
      debugMode: newFlags.mockCustomers || env.debug.isEnabled(),
    };
  } catch (error) {
    // Fallback to legacy behavior if new system fails
    console.warn('New feature flags system failed, falling back to legacy behavior:', error);
    return getLegacyFeatureFlags();
  }
}

/**
 * Legacy feature flags implementation
 * @private
 */
function getLegacyFeatureFlags() {
  // Get environment info to determine Sentry behavior
  const isRunningInExpoGo = isExpoGo();

  const sentryDsn = getEnvVar('SENTRY_DSN') || Constants.expoConfig?.extra?.sentryDsn;

  // Logic: Smart Sentry enablement based on environment
  let enableSentry = false;
  if (sentryDsn) {
    const explicitSentryFlag = getEnvVar('ENABLE_SENTRY');
    if (explicitSentryFlag !== undefined) {
      enableSentry = getBooleanEnvVar('ENABLE_SENTRY', false);
      if (__DEV__) {
        console.log('🔧 Sentry: Using explicit ENABLE_SENTRY =', enableSentry);
      }
    } else {
      enableSentry = !(__DEV__ || isRunningInExpoGo);
      if (__DEV__) {
        console.log(
          '🔧 Sentry: Auto-determined =',
          enableSentry,
          '(dev:',
          __DEV__,
          'expoGo:',
          isRunningInExpoGo,
          ')'
        );
      }
    }
  }

  return {
    enableVideoCall: getBooleanEnvVar('ENABLE_VIDEO_CALL', true),
    enableHealthTracking: getBooleanEnvVar('ENABLE_HEALTH_TRACKING', true),
    enablePushNotifications: getBooleanEnvVar('ENABLE_PUSH_NOTIFICATIONS', true),
    enableAnalytics: getBooleanEnvVar('ENABLE_ANALYTICS', true),
    enableSentry,
    debugMode: getBooleanEnvVar('DEBUG_MODE', __DEV__),
  };
}

// Export utilities for direct use
export { getEnvVar, getRequiredEnvVar, getBooleanEnvVar, getNumberEnvVar };

// ===================================================================
// NEW ENVIRONMENT SYSTEM EXPORTS
// ===================================================================
// Re-export the new environment utilities for easy migration

/**
 * New environment utilities - recommended for all new code
 */
export {
  // Main config and utilities
  getConfig,
  env,

  // Specific utility modules
  api,
  video,
  health,
  monitoring,
  debug,
  build,
  features,
  upload,
  auth,
  validation,
} from '../config/env.utils.enhanced';

// Re-export types for TypeScript support
export type {
  EnvConfig as NewEnvConfig,
  FeatureFlags,
  Environment,
  ValidationResult,
} from '../config/env.types';

/**
 * Migration helpers - these provide a smooth transition path
 */
export const migration = {
  /**
   * Get migration status for current codebase
   */
  getStatus() {
    return {
      newSystemAvailable: true,
      legacySystemActive: true,
      migrationRequired: true,
      documentationUrl: 'ENVIRONMENT_VARIABLES_DESIGN.md',
    };
  },

  /**
   * Check if a specific legacy function is being used
   */
  checkLegacyUsage(functionName: string) {
    console.warn(
      `🚨 MIGRATION NEEDED: ${functionName} is deprecated. See ENVIRONMENT_VARIABLES_DESIGN.md for migration guide.`
    );

    const migrationMap: Record<string, string> = {
      getEnvironmentConfig: 'getConfig() from ../config/env.config',
      getFeatureFlags: 'env.features.getAll() from ../config/env.utils.enhanced',
      getEnvVar: 'env.* utilities from ../config/env.utils.enhanced',
      validateEnvironment: 'env.validation.validateConfiguration()',
    };

    const suggestion = migrationMap[functionName];
    if (suggestion) {
      console.info(`💡 Recommended replacement: ${suggestion}`);
    }
  },

  /**
   * Validate that new environment system is working
   */
  validateNewSystem() {
    try {
      const config = getConfig();
      console.log('✅ New environment system is working correctly');
      console.log(`📍 Current environment: ${config.HOPMED_BUILD_ENVIRONMENT}`);
      console.log(`🌐 API URL: ${config.HOPMED_API_BASE_URL}`);
      return true;
    } catch (error) {
      console.error('❌ New environment system validation failed:', error);
      return false;
    }
  },
};

// ===================================================================
// LEGACY COMPATIBILITY WARNINGS
// ===================================================================

if (__DEV__) {
  console.log('📢 HopMed Environment System Notice:');
  console.log('   A new standardized environment variable system is available!');
  console.log('   📖 See ENVIRONMENT_VARIABLES_DESIGN.md for migration instructions');
  console.log('   🔧 Use npm run env:help for environment management commands');
  console.log('');
}
