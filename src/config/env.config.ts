import Constants from 'expo-constants';
import { z } from 'zod';

import type { EnvConfig, EnvValidationError } from './env.schema';
import { envSchema, environmentDefaults } from './env.schema';

/**
 * Unified Environment Configuration Loader
 *
 * Loads and validates environment variables from multiple sources with a clear hierarchy:
 * 1. GitLab CI/CD Variables (highest priority - production builds)
 * 2. EAS Build Environment Variables (mobile builds)
 * 3. Process environment variables (.env files)
 * 4. Environment-specific templates (environments/.env.{NODE_ENV})
 * 5. Schema defaults (lowest priority)
 *
 * Security: All sensitive values (API keys, tokens) are loaded via GitLab CI/CD
 * or EAS build environments - never hard-coded in source files.
 */

class EnvironmentConfigLoader {
  private config: EnvConfig | null = null;
  private validationErrors: EnvValidationError[] = [];

  /**
   * Get environment variable from unified sources in priority order
   */
  private getEnvVar(key: string, fallback?: string): string | undefined {
    // 1. GitLab CI/CD Variables & EAS Build Variables (via process.env)
    // These have highest priority as they're set during build/deployment
    if (process.env[key]) {
      return process.env[key];
    }

    // 2. Expo config (app.json extra) - for Expo Go compatibility
    // Used for non-sensitive values and Expo Go development (e.g., Sentry DSN)
    if (Constants.expoConfig?.extra?.[key]) {
      const value = Constants.expoConfig.extra[key] as string;
      if (__DEV__ && !key.includes('SENTRY_DSN')) {
        console.warn(`⚠️  Loading ${key} from app.json - consider moving to environment files`);
      } else if (__DEV__ && key.includes('SENTRY_DSN')) {
        console.log(`🔧 Loading ${key} from app.json for Expo Go compatibility`);
      }
      return value;
    }

    // 3. Legacy manifest support (deprecated)
    if ((Constants.manifest as any)?.extra?.[key]) {
      const value = (Constants.manifest as any).extra[key] as string;
      if (__DEV__) {
        console.warn(`⚠️  Loading ${key} from legacy manifest - update to environment files`);
      }
      return value;
    }

    // 4. Return fallback
    return fallback;
  }

  /**
   * Detect current environment from various sources
   * Enhanced with robust Expo Go detection for development workflow
   */
  private detectEnvironment(): keyof typeof environmentDefaults {
    // 1. Check explicit environment variables (highest priority)
    const explicitEnv =
      this.getEnvVar('HOPMED_BUILD_ENVIRONMENT') ||
      this.getEnvVar('NODE_ENV') ||
      this.getEnvVar('EXPO_ENV');

    if (explicitEnv && explicitEnv in environmentDefaults) {
      if (__DEV__) {
        console.log(`🌍 Environment detected from explicit variable: ${explicitEnv}`);
      }
      return explicitEnv as keyof typeof environmentDefaults;
    }

    // 2. Enhanced Expo Go detection (for npm run start workflow)
    // Using modern Expo Constants API - check multiple indicators
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    const isExpoDev = Constants.executionEnvironment === 'standalone' && __DEV__;
    const hasExpoHost = Boolean(Constants.expoConfig?.hostUri);

    // Legacy support for older Expo versions
    const legacyExpoGo = (Constants as any).appOwnership === 'expo';

    if (isExpoGo || isExpoDev || hasExpoHost || legacyExpoGo) {
      if (__DEV__) {
        console.log('📱 Expo Go detected - using development environment');
        console.log(`   - executionEnvironment: ${Constants.executionEnvironment}`);
        console.log(`   - hasExpoHost: ${hasExpoHost}`);
        console.log(`   - legacyExpoGo: ${legacyExpoGo}`);
      }
      return 'development';
    }

    // 3. Check __DEV__ flag for development builds
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      if (__DEV__) {
        console.log('🔧 __DEV__ flag detected - using development environment');
      }
      return 'development';
    }

    // 4. Infer from API URL patterns
    const apiUrl = this.getEnvVar('HOPMED_API_BASE_URL') || this.getEnvVar('API_URL') || '';
    if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
      if (__DEV__) {
        console.log('🏠 Localhost API detected - using local environment');
      }
      return 'local';
    }
    if (apiUrl.includes('staging')) {
      if (__DEV__) {
        console.log('🚀 Staging API detected - using staging environment');
      }
      return 'staging';
    }

    // 5. Default to production for safety
    if (__DEV__) {
      console.log('⚠️ No specific environment detected - defaulting to production');
    }
    return 'production';
  }

  /**
   * Build raw environment object from all sources
   */
  private buildRawEnvironment(): Record<string, string> {
    const environment = this.detectEnvironment();
    const defaults = environmentDefaults[environment];

    const rawEnv: Record<string, string> = {
      // Start with environment-specific defaults
      ...defaults,
    };

    // Override with any available environment variables
    const allPossibleKeys = Object.keys(envSchema.shape) as (keyof EnvConfig)[];

    allPossibleKeys.forEach(key => {
      const value = this.getEnvVar(key);
      if (value !== undefined) {
        rawEnv[key] = value;
      }
    });

    // Handle legacy variable mapping during transition
    this.mapLegacyVariables(rawEnv);

    return rawEnv;
  }

  /**
   * Map legacy environment variables to new standardized names
   */
  private mapLegacyVariables(rawEnv: Record<string, string>) {
    const legacyMappings: Record<string, string> = {
      API_URL: 'HOPMED_API_BASE_URL',
      DAILY_API_KEY: 'HOPMED_VIDEO_DAILY_API_KEY',
      DAILY_CO_API_KEY: 'HOPMED_VIDEO_DAILY_API_KEY',
      SENTRY_DSN: 'HOPMED_SENTRY_DSN',
      SENTRY_AUTH_TOKEN: 'HOPMED_SENTRY_AUTH_TOKEN',
      ENABLE_SENTRY: 'HOPMED_BUILD_SENTRY_ENABLED',
      DEBUG_MODE: 'HOPMED_DEBUG_MODE',
      AGORA_APP_ID: 'HOPMED_VIDEO_AGORA_APP_ID',
      AGORA_TEMP_TOKEN: 'HOPMED_VIDEO_AGORA_TOKEN',
      AGORA_PRIMARY_CERTIFICATE: 'HOPMED_VIDEO_AGORA_CERTIFICATE',
    };

    Object.entries(legacyMappings).forEach(([legacyKey, newKey]) => {
      const legacyValue = this.getEnvVar(legacyKey);
      if (legacyValue && !rawEnv[newKey]) {
        rawEnv[newKey] = legacyValue;
        if (__DEV__) {
          console.warn(
            `🔄 Using legacy environment variable ${legacyKey} -> ${newKey}. Please update to use ${newKey}.`
          );
        }
      }
    });
  }

  /**
   * Validate and parse environment configuration
   */
  private validateEnvironment(rawEnv: Record<string, string>): EnvConfig | null {
    try {
      const validated = envSchema.parse(rawEnv);
      this.validationErrors = [];
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.validationErrors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          received: err.received,
        }));
      }
      return null;
    }
  }

  /**
   * Load and validate environment configuration
   */
  public load(): EnvConfig {
    if (this.config) {
      return this.config;
    }

    const rawEnv = this.buildRawEnvironment();
    const validatedConfig = this.validateEnvironment(rawEnv);

    if (!validatedConfig) {
      console.warn('⚠️ Environment validation failed, using fallback configuration');
      this.handleValidationErrors();
      // Don't throw - use fallback configuration instead
      this.config = this.createFallbackConfig();
      return this.config;
    }

    this.config = validatedConfig;

    // Log configuration in development
    this.logConfiguration();

    return this.config;
  }

  /**
   * Get current configuration (load if not already loaded)
   */
  public getConfig(): EnvConfig {
    return this.config || this.load();
  }

  /**
   * Get validation errors from last load attempt
   */
  public getValidationErrors(): EnvValidationError[] {
    return this.validationErrors;
  }

  /**
   * Check if environment is valid
   */
  public isValid(): boolean {
    try {
      this.load();
      return this.validationErrors.length === 0;
    } catch {
      return false;
    }
  }

  /**
   * Create secure fallback configuration when validation fails
   * NOTE: No hard-coded secrets in fallback - all sensitive values undefined
   */
  private createFallbackConfig(): EnvConfig {
    return {
      HOPMED_BUILD_ENVIRONMENT: 'development',
      HOPMED_BUILD_VERSION: '1.0.0',
      HOPMED_BUILD_TIMESTAMP: new Date().toISOString(),
      HOPMED_API_BASE_URL: 'http://141.94.71.13:3001/api/v1',
      HOPMED_API_TIMEOUT: 30000,
      HOPMED_API_RETRY_ATTEMPTS: 3,
      HOPMED_API_RETRY_DELAY: 1000,
      HOPMED_VIDEO_DAILY_API_KEY: undefined, // Security: No hard-coded API keys
      HOPMED_VIDEO_DAILY_DOMAIN: 'mbinina.daily.co',
      HOPMED_VIDEO_AGORA_APP_ID: undefined,
      HOPMED_VIDEO_AGORA_TOKEN: undefined,
      HOPMED_VIDEO_AGORA_CERTIFICATE: undefined,
      HOPMED_AUTH_DOMAIN: 'hopmed.com',
      HOPMED_FEATURE_VIDEO_ENABLED: true,
      HOPMED_FEATURE_HEALTH_ENABLED: false,
      HOPMED_FEATURE_ANALYTICS_ENABLED: false,
      HOPMED_FEATURE_PUSH_NOTIFICATIONS_ENABLED: false,
      HOPMED_FEATURE_AGORA_ENABLED: false,
      HOPMED_DEMO_MODE: false,
      HOPMED_SENTRY_DSN: undefined, // Security: No hard-coded Sentry DSN
      HOPMED_BUILD_SENTRY_ENABLED: true,
      HOPMED_SENTRY_AUTH_TOKEN: undefined, // Security: No hard-coded tokens
      HOPMED_DEBUG_MODE: true,
      HOPMED_DEBUG_MOCK_CUSTOMERS: false,
      HOPMED_DEBUG_PERFORMANCE_MONITORING: false,
      HOPMED_UPLOAD_MAX_SIZE: 10485760,
      HOPMED_UPLOAD_ALLOWED_TYPES: 'image/jpeg,image/png,image/gif,application/pdf',
      HOPMED_BUILD_HEALTH_CONNECT_ENABLED: false,
      HOPMED_BUILD_HEALTHKIT_ENABLED: false,
    };
  }

  /**
   * Handle validation errors
   */
  private handleValidationErrors() {
    console.error('❌ Environment Configuration Validation Failed:');
    console.error('');

    this.validationErrors.forEach(error => {
      console.error(`  • ${error.field}: ${error.message}`);
      if (error.received !== undefined) {
        console.error(`    Received: ${JSON.stringify(error.received)}`);
      }
    });

    console.error('');
    console.error('💡 Check your environment variables and .env files.');
    console.error('💡 See GITLAB_ENVIRONMENT_VARIABLES.md for production secrets setup.');
    console.error('💡 For development, copy environments/.env.example to environments/.env.local');
  }

  /**
   * Log configuration in development
   * Enhanced with Expo Go detection and clear API endpoint information
   */
  private logConfiguration() {
    if (!this.config || !this.config.HOPMED_DEBUG_MODE) {
      return;
    }

    console.log('🌍 ===== HopMed Unified Environment System =====');
    console.log('');

    // Enhanced environment detection info
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    const isExpoDev = Constants.executionEnvironment === 'standalone' && __DEV__;
    const hasExpoHost = Boolean(Constants.expoConfig?.hostUri);
    const legacyExpoGo = (Constants as any).appOwnership === 'expo';

    console.log(`  Environment: ${this.config.HOPMED_BUILD_ENVIRONMENT}`);

    // Expo Go specific logging
    if (isExpoGo || isExpoDev || hasExpoHost || legacyExpoGo) {
      console.log('  🚀 Running in: Expo Go (Development Mode)');
      console.log(`  📱 Execution Environment: ${Constants.executionEnvironment}`);
      if (hasExpoHost) {
        console.log(`  🔗 Expo Host: ${Constants.expoConfig?.hostUri}`);
      }
    }

    console.log('');
    console.log(`  🌐 API Endpoint: ${this.config.HOPMED_API_BASE_URL}`);
    console.log(`  ⏱️  API Timeout: ${this.config.HOPMED_API_TIMEOUT}ms`);
    console.log(`  🔄 Retry Attempts: ${this.config.HOPMED_API_RETRY_ATTEMPTS}`);
    console.log('');
    console.log(`  🐛 Debug Mode: ${this.config.HOPMED_DEBUG_MODE}`);
    console.log(`  🎭 Demo Mode: ${this.config.HOPMED_DEMO_MODE}`);
    console.log(`  📊 Sentry Enabled: ${this.config.HOPMED_BUILD_SENTRY_ENABLED}`);
    console.log(`  📹 Video Enabled: ${this.config.HOPMED_FEATURE_VIDEO_ENABLED}`);
    console.log(`  💚 Health Enabled: ${this.config.HOPMED_FEATURE_HEALTH_ENABLED}`);
    console.log('');

    // Log secrets availability (without exposing values)
    const secrets = {
      'Daily API Key': !!this.config.HOPMED_VIDEO_DAILY_API_KEY,
      'Sentry DSN': !!this.config.HOPMED_SENTRY_DSN,
      'Sentry Auth Token': !!this.config.HOPMED_SENTRY_AUTH_TOKEN,
      'Agora App ID': !!this.config.HOPMED_VIDEO_AGORA_APP_ID,
    };

    console.log('🔐 Secrets Status:');
    Object.entries(secrets).forEach(([name, available]) => {
      const status = available ? '✅' : '❌';
      console.log(`  ${status} ${name}`);
    });
    console.log('');
    console.log('🔧 When using `npm run start` + Expo Go, this should show:');
    console.log(`   Environment: development`);
    console.log(`   API Endpoint: http://141.94.71.13:3001/api/v1`);
    console.log('===============================================');
    console.log('');
  }

  /**
   * Reload configuration (useful for testing or dynamic updates)
   */
  public reload(): EnvConfig {
    this.config = null;
    this.validationErrors = [];
    return this.load();
  }

  /**
   * Get environment-specific feature flags
   */
  public getFeatureFlags() {
    const config = this.getConfig();

    return {
      videoCall: config.HOPMED_FEATURE_VIDEO_ENABLED,
      healthTracking: config.HOPMED_FEATURE_HEALTH_ENABLED,
      analytics: config.HOPMED_FEATURE_ANALYTICS_ENABLED,
      pushNotifications: config.HOPMED_FEATURE_PUSH_NOTIFICATIONS_ENABLED,
      agoraVideo: config.HOPMED_FEATURE_AGORA_ENABLED,
      sentry: config.HOPMED_BUILD_SENTRY_ENABLED && !config.HOPMED_DEBUG_MODE,
      mockCustomers: config.HOPMED_DEBUG_MOCK_CUSTOMERS,
      performanceMonitoring: config.HOPMED_DEBUG_PERFORMANCE_MONITORING,
    };
  }

  /**
   * Check if running in specific environment
   */
  public isEnvironment(env: EnvConfig['HOPMED_BUILD_ENVIRONMENT']): boolean {
    return this.getConfig().HOPMED_BUILD_ENVIRONMENT === env;
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return this.getConfig().HOPMED_DEBUG_MODE;
  }

  /**
   * Check if running in production mode
   */
  public isProduction(): boolean {
    return this.isEnvironment('production');
  }
}

// Create singleton instance
const envConfigLoader = new EnvironmentConfigLoader();

// Export the loader instance and convenience functions
export { envConfigLoader };
export const getConfig = () => envConfigLoader.getConfig();
export const getFeatureFlags = () => envConfigLoader.getFeatureFlags();
export const isDevelopment = () => envConfigLoader.isDevelopment();
export const isProduction = () => envConfigLoader.isProduction();
export const isEnvironment = (env: EnvConfig['HOPMED_BUILD_ENVIRONMENT']) =>
  envConfigLoader.isEnvironment(env);

// Export types for use in other modules
export type { EnvConfig, EnvValidationError };
