import { z } from 'zod';

/**
 * Environment Variable Schema
 *
 * Defines the structure, types, and validation rules for all environment variables
 * used in the HopMed Mobile application.
 */

// Helper schemas for common types
const BooleanFromString = z
  .string()
  .optional()
  .transform(val => {
    if (!val) return false;
    return ['true', '1', 'yes', 'on'].includes(val.toLowerCase());
  });

const NumberFromString = z
  .string()
  .optional()
  .transform(val => (val ? parseInt(val, 10) : undefined))
  .refine(val => val === undefined || !isNaN(val), {
    message: 'Must be a valid number',
  });

const UrlSchema = z
  .string()
  .url()
  .refine(url => url.startsWith('http://') || url.startsWith('https://'), {
    message: 'Must be a valid HTTP or HTTPS URL',
  });

// Environment type enum
const EnvironmentEnum = z.enum(['local', 'development', 'staging', 'production']);

/**
 * Complete environment variable schema
 */
export const envSchema = z.object({
  // Build Environment
  HOPMED_BUILD_ENVIRONMENT: EnvironmentEnum.default('development'),
  HOPMED_BUILD_VERSION: z.string().optional(),
  HOPMED_BUILD_TIMESTAMP: z.string().optional(),

  // API Configuration
  HOPMED_API_BASE_URL: UrlSchema,
  HOPMED_API_TIMEOUT: NumberFromString.default(30000).transform(val => val || 30000),
  HOPMED_API_RETRY_ATTEMPTS: NumberFromString.default(3).transform(val => val || 3),
  HOPMED_API_RETRY_DELAY: NumberFromString.default(1000).transform(val => val || 1000),

  // Video Services
  HOPMED_VIDEO_DAILY_API_KEY: z
    .string()
    .min(10, 'Daily API key must be at least 10 characters')
    .optional(),
  HOPMED_VIDEO_DAILY_DOMAIN: z.string().default('mbinina.daily.co'),
  HOPMED_VIDEO_AGORA_APP_ID: z.string().optional(),
  HOPMED_VIDEO_AGORA_TOKEN: z.string().optional(),
  HOPMED_VIDEO_AGORA_CERTIFICATE: z.string().optional(),

  // Health Services - Only Apple Health and Google Health Connect supported

  // Authentication
  HOPMED_AUTH_JWT_SECRET: z.string().optional(),
  HOPMED_AUTH_DOMAIN: z.string().optional(),

  // Feature Flags
  HOPMED_FEATURE_VIDEO_ENABLED: BooleanFromString.default(true),
  HOPMED_FEATURE_HEALTH_ENABLED: BooleanFromString.default(true),
  HOPMED_FEATURE_ANALYTICS_ENABLED: BooleanFromString.default(true),
  HOPMED_FEATURE_PUSH_NOTIFICATIONS_ENABLED: BooleanFromString.default(true),
  HOPMED_FEATURE_AGORA_ENABLED: BooleanFromString.default(false),

  // Demo/Development Mode
  HOPMED_DEMO_MODE: BooleanFromString.default(false),

  // Monitoring & Error Tracking
  HOPMED_SENTRY_DSN: z.string().optional(),
  HOPMED_SENTRY_AUTH_TOKEN: z.string().optional(),
  HOPMED_BUILD_SENTRY_ENABLED: BooleanFromString.default(true),

  // Development & Debugging
  HOPMED_DEBUG_MODE: BooleanFromString,
  HOPMED_DEBUG_MOCK_CUSTOMERS: BooleanFromString.default(false),
  HOPMED_DEBUG_PERFORMANCE_MONITORING: BooleanFromString,

  // Push Notifications
  HOPMED_PUSH_EXPO_TOKEN: z.string().optional(),

  // Analytics
  HOPMED_ANALYTICS_API_KEY: z.string().optional(),

  // File Upload Configuration
  HOPMED_UPLOAD_MAX_SIZE: NumberFromString.default(10485760), // 10MB
  HOPMED_UPLOAD_ALLOWED_TYPES: z.string().default('jpg,jpeg,png,pdf'),

  // Build-specific configurations
  HOPMED_BUILD_HEALTH_CONNECT_ENABLED: BooleanFromString.default(true),
  HOPMED_BUILD_HEALTHKIT_ENABLED: BooleanFromString.default(true),

  // Legacy support (for backward compatibility during migration)
  API_URL: z.string().optional(),
  NODE_ENV: z.string().optional(),
  DAILY_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  ENABLE_SENTRY: z.string().optional(),
});

/**
 * Inferred TypeScript type from the schema
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Environment-specific default configurations
 */
export const environmentDefaults = {
  local: {
    HOPMED_BUILD_ENVIRONMENT: 'local' as const,
    HOPMED_API_BASE_URL: 'http://localhost:3001/api/v1',
    HOPMED_DEBUG_MODE: 'true',
    HOPMED_DEBUG_MOCK_CUSTOMERS: 'true',
    HOPMED_BUILD_SENTRY_ENABLED: 'false',
  },
  development: {
    HOPMED_BUILD_ENVIRONMENT: 'development' as const,
    HOPMED_API_BASE_URL: 'http://141.94.71.13:3001/api/v1',
    HOPMED_DEBUG_MODE: 'true',
    HOPMED_DEBUG_MOCK_CUSTOMERS: 'false',
    HOPMED_BUILD_SENTRY_ENABLED: 'true',
  },
  staging: {
    HOPMED_BUILD_ENVIRONMENT: 'staging' as const,
    HOPMED_API_BASE_URL: 'http://141.94.71.13:3001/api/v1',
    HOPMED_DEBUG_MODE: 'false',
    HOPMED_DEBUG_MOCK_CUSTOMERS: 'false',
    HOPMED_BUILD_SENTRY_ENABLED: 'true',
  },
  production: {
    HOPMED_BUILD_ENVIRONMENT: 'production' as const,
    HOPMED_API_BASE_URL: 'http://141.94.71.13:3001/api/v1',
    HOPMED_DEBUG_MODE: 'false',
    HOPMED_DEBUG_MOCK_CUSTOMERS: 'false',
    HOPMED_BUILD_SENTRY_ENABLED: 'true',
  },
} as const;

/**
 * Validation error type for better error handling
 */
export interface EnvValidationError {
  field: string;
  message: string;
  received: unknown;
}
