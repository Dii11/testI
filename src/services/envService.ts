import type { EnvConfig } from '../utils/envUtils';
import { getEnvironmentConfig, validateEnvironment, getFeatureFlags } from '../utils/envUtils';

/**
 * 🔧 Environment Service
 *
 * Centralized service for environment configuration and feature management.
 * Provides runtime environment validation and feature flag management.
 */

class EnvironmentService {
  private config: EnvConfig;
  private featureFlags: ReturnType<typeof getFeatureFlags>;
  private isValidated: boolean = false;

  constructor() {
    this.config = getEnvironmentConfig();
    this.featureFlags = getFeatureFlags();
    this.validateEnvironmentOnStartup();
  }

  /**
   * Get current environment configuration
   */
  getConfig(): EnvConfig {
    return this.config;
  }

  /**
   * Get feature flags
   */
  getFeatureFlags() {
    return this.featureFlags;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof ReturnType<typeof getFeatureFlags>): boolean {
    return this.featureFlags[feature];
  }

  /**
   * Get API base URL
   */
  getApiUrl(): string {
    return this.config.apiUrl;
  }

  /**
   * Get Daily.co API key
   */
  getDailyApiKey(): string | undefined {
    return this.config.dailyApiKey;
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.isDevelopment;
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.isProduction;
  }

  /**
   * Get current environment name
   */
  getEnvironment(): string {
    return this.config.environment;
  }

  /**
   * Validate environment on startup
   */
  private validateEnvironmentOnStartup(): void {
    try {
      this.isValidated = validateEnvironment();

      if (!this.isValidated) {
        console.error('❌ Environment validation failed. App may not work correctly.');
      } else if (this.isDevelopment()) {
        console.log('✅ Environment validation passed');
        this.logEnvironmentInfo();
      }
    } catch (error) {
      console.error('❌ Environment validation error:', error);
      this.isValidated = false;
    }
  }

  /**
   * Log environment information (development only)
   */
  private logEnvironmentInfo(): void {
    if (!this.isDevelopment()) return;

    console.log('🌍 Environment Info:', {
      environment: this.getEnvironment(),
      apiUrl: this.getApiUrl(),
      hasDailyApiKey: !!this.getDailyApiKey(),
      features: Object.entries(this.featureFlags)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature),
    });
  }

  /**
   * Reload environment configuration
   */
  reloadConfig(): void {
    this.config = getEnvironmentConfig();
    this.featureFlags = getFeatureFlags();
    this.validateEnvironmentOnStartup();
  }

  /**
   * Check if environment is properly configured
   */
  isEnvironmentValid(): boolean {
    return this.isValidated;
  }

  /**
   * Get environment-specific settings
   */
  getEnvironmentSettings() {
    return {
      enableLogging: this.isDevelopment() || this.featureFlags.debugMode,
      enableAnalytics: this.featureFlags.enableAnalytics && !this.isDevelopment(),
      enableSentry: this.featureFlags.enableSentry && this.config.sentryDsn,
      strictSSL: this.isProduction(),
      cacheTimeout: this.isDevelopment() ? 1000 : 60000,
      retryAttempts: this.isDevelopment() ? 1 : 3,
    };
  }
}

// Export singleton instance
export const envService = new EnvironmentService();
export default envService;
