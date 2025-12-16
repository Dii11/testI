import Constants from 'expo-constants';

/**
 * 🌍 Environment Utilities
 *
 * Provides graceful environment variable handling with fallbacks and validation.
 * Works across Expo managed workflow, development, and production builds.
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
 * Get environment variable with graceful fallback
 */
function getEnvVar(key: string, fallback?: string): string | undefined {
  // Try process.env first (works in Node.js/Expo CLI)
  if (process.env[key]) {
    return process.env[key];
  }

  // Try Expo Constants (works in Expo managed workflow)
  if (Constants.expoConfig?.extra?.[key]) {
    return Constants.expoConfig.extra[key];
  }

  // Try manifest extra (legacy support)
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
 */
export function getEnvironmentConfig(): EnvConfig {
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
 */
export function getFeatureFlags() {
  // Get environment info to determine Sentry behavior
  const isRunningInExpoGo = isExpoGo();

  // Sentry behavior:
  // - Local dev (expo start): DISABLED
  // - Expo Go: DISABLED
  // - Development builds: ENABLED if ENABLE_SENTRY=true in build config
  // - Production builds: ENABLED if ENABLE_SENTRY=true in build config
  const sentryDsn = getEnvVar('SENTRY_DSN') || Constants.expoConfig?.extra?.sentryDsn;

  // Logic: Smart Sentry enablement based on environment
  let enableSentry = false;
  if (sentryDsn) {
    // Check if explicitly set via env var (e.g., in EAS build configs)
    const explicitSentryFlag = getEnvVar('ENABLE_SENTRY');
    if (explicitSentryFlag !== undefined) {
      enableSentry = getBooleanEnvVar('ENABLE_SENTRY', false);
      // Log when using explicit override
      if (__DEV__) {
        console.log('🔧 Sentry: Using explicit ENABLE_SENTRY =', enableSentry);
      }
    } else {
      // Auto-determine: disable in local dev/Expo Go, enable in production builds
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
