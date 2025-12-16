/**
 * SIMPLIFIED Enhanced Environment Utilities for debugging splash screen issue
 *
 * All hardcoded values to prevent environment validation errors.
 */

console.log('env.utils.enhanced: SIMPLIFIED for debugging splash screen');

/**
 * Hardcoded API configuration
 */
export const api = {
  getBaseUrl(): string {
    return 'http://141.94.71.13:3001/api/v1';
  },
  getTimeout(): number {
    return 30000;
  },
  getRetryConfig() {
    return {
      attempts: 3,
      delay: 1000,
    };
  },
  isLocalhost(): boolean {
    return false;
  },
};

/**
 * Hardcoded video configuration
 */
export const video = {
  getDailyApiKey(): string {
    return 'de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9';
  },
  getDailyDomain(): string {
    return 'mbinina.daily.co';
  },
  getAgoraConfig() {
    return {
      appId: '',
      token: '',
      certificate: '',
    };
  },
  isVideoCallEnabled(): boolean {
    return true;
  },
  isAgoraEnabled(): boolean {
    return false;
  },
};

/**
 * Hardcoded health configuration
 */
export const health = {
  isHealthTrackingEnabled(): boolean {
    return false; // Disabled for debugging
  },
  getSamsungHealthAppId(): string {
    return '';
  },
  getHuaweiHealthAppId(): string {
    return '';
  },
  isHealthKitEnabled(): boolean {
    return false; // Disabled for debugging
  },
  isHealthConnectEnabled(): boolean {
    return false; // Disabled for debugging
  },
};

/**
 * Hardcoded authentication configuration
 */
export const auth = {
  getDomain(): string {
    return 'http://141.94.71.13:3001';
  },
  getTokenExpiryBuffer(): number {
    return 300;
  },
};

/**
 * Hardcoded feature flags
 */
export const features = {
  getAll() {
    return {
      videoCall: true,
      healthTracking: false,
      analytics: false,
      pushNotifications: false,
      agoraVideo: false,
      sentry: false,
      mockCustomers: false,
      performanceMonitoring: false,
    };
  },
  isEnabled(feature: string): boolean {
    const flags = this.getAll();
    return (flags as any)[feature] || false;
  },
};

/**
 * Hardcoded sentry configuration
 */
export const sentry = {
  getDsn(): string {
    return '';
  },
  getAuthToken(): string {
    return '';
  },
  isEnabled(): boolean {
    return false;
  },
};

/**
 * Hardcoded upload configuration
 */
export const upload = {
  getMaxSize(): number {
    return 10485760; // 10MB
  },
  getAllowedTypes(): string[] {
    return ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  },
};

/**
 * Simple environment config interface
 */
export interface EnvConfig {
  HOPMED_API_BASE_URL: string;
  HOPMED_BUILD_ENVIRONMENT: 'development' | 'staging' | 'production';
  HOPMED_DEBUG_MODE: boolean;
}

/**
 * Hardcoded environment config
 */
export function getEnvironmentConfig(): EnvConfig {
  return {
    HOPMED_API_BASE_URL: 'http://141.94.71.13:3001/api/v1',
    HOPMED_BUILD_ENVIRONMENT: 'development',
    HOPMED_DEBUG_MODE: true,
  };
}

/**
 * Legacy exports for compatibility
 */
export const env = {
  api,
  video,
  health,
  auth,
  features,
  sentry,
  upload,
  getEnvironmentConfig,
};

export { getEnvironmentConfig as getConfig };
export const getFeatureFlags = () => features.getAll();
