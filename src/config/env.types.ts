/**
 * Environment Variable Type Definitions
 *
 * Provides TypeScript type definitions for environment variables
 * to ensure type safety and better developer experience.
 */

// Re-export main types from schema
export type { EnvConfig, EnvValidationError } from './env.schema';

/**
 * Environment type enum
 */
export type Environment = 'local' | 'development' | 'staging' | 'production';

/**
 * Feature flags type
 */
export interface FeatureFlags {
  videoCall: boolean;
  healthTracking: boolean;
  analytics: boolean;
  pushNotifications: boolean;
  agoraVideo: boolean;
  sentry: boolean;
  mockCustomers: boolean;
  performanceMonitoring: boolean;
}

/**
 * API configuration type
 */
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Video service configuration types
 */
export interface DailyConfig {
  apiKey: string;
  domain: string;
}

export interface AgoraConfig {
  appId: string | undefined;
  token: string | undefined;
  certificate: string | undefined;
}

export interface VideoConfig {
  daily: DailyConfig;
  agora: AgoraConfig;
  isEnabled: boolean;
  isAgoraEnabled: boolean;
}

/**
 * Health service configuration types
 * Only Apple HealthKit and Google Health Connect are supported
 */
export interface HealthConfig {
  isEnabled: boolean;
  availableProviders: ('apple_healthkit' | 'google_health_connect')[];
}

/**
 * Monitoring configuration type
 */
export interface MonitoringConfig {
  sentry: {
    dsn: string | undefined;
    authToken: string | undefined;
    enabled: boolean;
  };
  analytics: {
    apiKey: string | undefined;
    enabled: boolean;
  };
}

/**
 * Debug configuration type
 */
export interface DebugConfig {
  debugMode: boolean;
  mockCustomers: boolean;
  performanceMonitoring: boolean;
}

/**
 * Build configuration type
 */
export interface BuildConfig {
  environment: Environment;
  version: string | undefined;
  timestamp: string | undefined;
  healthConnect: boolean;
  healthKit: boolean;
}

/**
 * Upload configuration type
 */
export interface UploadConfig {
  maxSize: number;
  allowedTypes: string[];
}

/**
 * Authentication configuration type
 */
export interface AuthConfig {
  jwtSecret: string | undefined;
  domain: string | undefined;
}

/**
 * Complete environment utilities type
 */
export interface EnvUtils {
  api: {
    getBaseUrl(): string;
    getTimeout(): number;
    getRetryConfig(): { attempts: number; delay: number };
    isLocalhost(): boolean;
  };
  video: {
    getDailyApiKey(): string;
    getDailyDomain(): string;
    getAgoraConfig(): AgoraConfig;
    isEnabled(): boolean;
    isAgoraEnabled(): boolean;
  };
  health: {
    isEnabled(): boolean;
    getAvailableProviders(): ('apple_healthkit' | 'google_health_connect')[];
  };
  monitoring: {
    getSentryDsn(): string | undefined;
    getSentryAuthToken(): string | undefined;
    isSentryEnabled(): boolean;
    isAnalyticsEnabled(): boolean;
    getAnalyticsApiKey(): string | undefined;
  };
  debug: {
    isEnabled(): boolean;
    shouldUseMockCustomers(): boolean;
    isPerformanceMonitoringEnabled(): boolean;
    getConfig(): DebugConfig;
  };
  build: {
    getEnvironment(): Environment;
    getVersion(): string | undefined;
    getTimestamp(): string | undefined;
    isHealthConnectEnabled(): boolean;
    isHealthKitEnabled(): boolean;
    getBuildInfo(): BuildConfig;
  };
  features: {
    getAll(): FeatureFlags;
    isEnabled(feature: keyof FeatureFlags): boolean;
    getEnabledFeatures(): string[];
  };
  upload: {
    getMaxSize(): number;
    getAllowedTypes(): string[];
    isAllowedType(fileType: string): boolean;
    isAllowedSize(size: number): boolean;
  };
  auth: {
    getJwtSecret(): string | undefined;
    getDomain(): string | undefined;
    getConfig(): AuthConfig;
  };
  validation: {
    validateConfiguration(): boolean;
    getValidationErrors(): EnvValidationError[];
    checkRequiredSecrets(): { valid: boolean; missing: string[] };
  };
}

/**
 * Environment validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: EnvValidationError[];
  warnings: string[];
}

/**
 * Secret validation result type
 */
export interface SecretValidationResult {
  valid: boolean;
  missing: string[];
  available: string[];
}

/**
 * Environment source type
 */
export type EnvSource = 'eas-secrets' | 'process-env' | 'expo-config' | 'defaults';

/**
 * Environment variable metadata type
 */
export interface EnvVarMetadata {
  key: string;
  value: string | undefined;
  source: EnvSource;
  isSecret: boolean;
  isRequired: boolean;
  description?: string;
}

/**
 * Configuration loading result type
 */
export interface ConfigLoadResult {
  success: boolean;
  config: EnvConfig | null;
  errors: EnvValidationError[];
  warnings: string[];
  metadata: EnvVarMetadata[];
}

/**
 * Legacy compatibility type mappings
 */
export interface LegacyEnvMappings {
  API_URL: 'HOPMED_API_BASE_URL';
  DAILY_API_KEY: 'HOPMED_VIDEO_DAILY_API_KEY';
  DAILY_CO_API_KEY: 'HOPMED_VIDEO_DAILY_API_KEY';
  SENTRY_DSN: 'HOPMED_SENTRY_DSN';
  SENTRY_AUTH_TOKEN: 'HOPMED_SENTRY_AUTH_TOKEN';
  ENABLE_SENTRY: 'HOPMED_BUILD_SENTRY_ENABLED';
  DEBUG_MODE: 'HOPMED_DEBUG_MODE';
  AGORA_APP_ID: 'HOPMED_VIDEO_AGORA_APP_ID';
  AGORA_TEMP_TOKEN: 'HOPMED_VIDEO_AGORA_TOKEN';
  AGORA_PRIMARY_CERTIFICATE: 'HOPMED_VIDEO_AGORA_CERTIFICATE';
}

/**
 * Type guard functions
 */
export interface TypeGuards {
  isValidUrl(value: string): boolean;
  isValidApiKey(value: string): boolean;
  isValidEnvironment(value: string): value is Environment;
  isSecureUrl(value: string): boolean;
}

/**
 * Configuration hooks for React components
 */
export interface ConfigHooks {
  useEnvironmentConfig(): EnvConfig;
  useFeatureFlags(): FeatureFlags;
  useApiConfig(): ApiConfig;
  useVideoConfig(): VideoConfig;
  useHealthConfig(): HealthConfig;
  useDebugConfig(): DebugConfig;
}

/**
 * Environment variable categories for organization
 */
export type EnvCategory =
  | 'api'
  | 'video'
  | 'health'
  | 'auth'
  | 'feature'
  | 'build'
  | 'debug'
  | 'monitoring'
  | 'upload';

/**
 * Environment variable definition type
 */
export interface EnvVarDefinition {
  key: string;
  category: EnvCategory;
  description: string;
  required: boolean;
  secret: boolean;
  defaultValue?: string;
  validation?: (value: string) => boolean;
  examples?: string[];
}

/**
 * Module augmentation for global types
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Core environment variables
      HOPMED_BUILD_ENVIRONMENT?: Environment;
      HOPMED_API_BASE_URL?: string;
      HOPMED_VIDEO_DAILY_API_KEY?: string;
      HOPMED_DEBUG_MODE?: string;

      // Legacy support (marked as optional)
      API_URL?: string;
      DAILY_API_KEY?: string;
      SENTRY_DSN?: string;
      NODE_ENV?: string;
    }
  }
}
