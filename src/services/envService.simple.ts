/**
 * 🔧 Simplified Environment Service for debugging splash screen issues
 *
 * This replaces the complex environment service with hardcoded values
 * to eliminate environment variable issues as a potential cause.
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

class SimplifiedEnvironmentService {
  private config: EnvConfig = {
    apiUrl: 'http://141.94.71.13:3001/api/v1',
    sentryDsn: undefined, // Disabled for debugging
    sentryAuthToken: undefined,
    dailyApiKey: 'de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9',
    isDevelopment: true,
    isProduction: false,
    isExpoGo: false,
    environment: 'development',
  };

  private featureFlags = {
    enableVideoCall: true,
    enableHealthTracking: false, // Disabled for debugging
    enablePushNotifications: false, // Disabled for debugging
    enableAnalytics: false, // Disabled for debugging
    enableSentry: false, // Disabled for debugging
    debugMode: true,
  };

  getConfig(): EnvConfig {
    return this.config;
  }

  getFeatureFlags() {
    return this.featureFlags;
  }

  isFeatureEnabled(feature: keyof typeof this.featureFlags): boolean {
    return this.featureFlags[feature];
  }

  getApiUrl(): string {
    return this.config.apiUrl;
  }

  getDailyApiKey(): string | undefined {
    return this.config.dailyApiKey;
  }

  isDevelopment(): boolean {
    return this.config.isDevelopment;
  }

  isProduction(): boolean {
    return this.config.isProduction;
  }

  getEnvironment(): string {
    return this.config.environment;
  }

  reloadConfig(): void {
    console.log('🔇 reloadConfig: SKIPPED for debugging');
  }

  isEnvironmentValid(): boolean {
    return true; // Always valid for debugging
  }

  getEnvironmentSettings() {
    return {
      enableLogging: true,
      enableAnalytics: false,
      enableSentry: false,
      strictSSL: false,
      cacheTimeout: 1000,
      retryAttempts: 1,
    };
  }
}

// Export singleton instance
export const envService = new SimplifiedEnvironmentService();
export default envService;
