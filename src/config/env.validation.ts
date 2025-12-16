import { z } from 'zod';

import type { EnvConfig, EnvValidationError } from './env.schema';
import { envSchema } from './env.schema';
import type {
  ValidationResult,
  SecretValidationResult,
  EnvVarMetadata,
  EnvSource,
} from './env.types';
import { Environment } from './env.types';

/**
 * Environment Validation Utilities
 *
 * Provides comprehensive validation, testing, and diagnostic capabilities
 * for environment configuration.
 */

/**
 * Validate URL format and security
 */
export function validateUrl(url: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push('URL must use HTTP or HTTPS protocol');
    }

    if (parsed.hostname === '') {
      errors.push('URL must have a valid hostname');
    }
  } catch {
    errors.push('Invalid URL format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate API key format
 */
export function validateApiKey(key: string, service: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!key || key.trim() === '') {
    errors.push(`${service} API key cannot be empty`);
    return { valid: false, errors };
  }

  if (key.length < 10) {
    errors.push(`${service} API key is too short (minimum 10 characters)`);
  }

  if (key.includes(' ')) {
    errors.push(`${service} API key should not contain spaces`);
  }

  // Check for placeholder values
  const placeholders = [
    'your_api_key_here',
    'replace_with_actual_key',
    'placeholder',
    'example',
    'test',
  ];

  if (placeholders.some(placeholder => key.toLowerCase().includes(placeholder))) {
    errors.push(`${service} API key appears to be a placeholder value`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate environment-specific configuration
 */
export function validateEnvironmentSpecific(config: EnvConfig): ValidationResult {
  const errors: EnvValidationError[] = [];
  const warnings: string[] = [];

  const env = config.HOPMED_BUILD_ENVIRONMENT;

  // Production-specific validations
  if (env === 'production') {
    if (!config.HOPMED_API_BASE_URL.startsWith('https://')) {
      errors.push({
        field: 'HOPMED_API_BASE_URL',
        message: 'Production environment must use HTTPS',
        received: config.HOPMED_API_BASE_URL,
      });
    }

    if (config.HOPMED_DEBUG_MODE) {
      warnings.push('Debug mode is enabled in production environment');
    }

    if (config.HOPMED_DEBUG_MOCK_CUSTOMERS) {
      errors.push({
        field: 'HOPMED_DEBUG_MOCK_CUSTOMERS',
        message: 'Mock customers should not be enabled in production',
        received: config.HOPMED_DEBUG_MOCK_CUSTOMERS,
      });
    }

    if (!config.HOPMED_SENTRY_DSN && config.HOPMED_BUILD_SENTRY_ENABLED) {
      warnings.push('Sentry is enabled but no DSN is configured');
    }
  }

  // Development-specific validations
  if (env === 'local' || env === 'development') {
    if (config.HOPMED_API_BASE_URL.startsWith('https://api.hopmed.com')) {
      warnings.push('Development environment is using production API URL');
    }
  }

  // Feature flag consistency checks
  if (config.HOPMED_FEATURE_VIDEO_ENABLED && !config.HOPMED_VIDEO_DAILY_API_KEY) {
    errors.push({
      field: 'HOPMED_VIDEO_DAILY_API_KEY',
      message: 'Video calling is enabled but no Daily API key is configured',
      received: undefined,
    });
  }

  if (config.HOPMED_FEATURE_AGORA_ENABLED && !config.HOPMED_VIDEO_AGORA_APP_ID) {
    errors.push({
      field: 'HOPMED_VIDEO_AGORA_APP_ID',
      message: 'Agora is enabled but no App ID is configured',
      received: undefined,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate required secrets for current configuration
 */
export function validateRequiredSecrets(config: EnvConfig): SecretValidationResult {
  const missing: string[] = [];
  const available: string[] = [];

  // Always required secrets
  const alwaysRequired = [{ key: 'HOPMED_API_BASE_URL', value: config.HOPMED_API_BASE_URL }];

  // Conditionally required secrets based on features
  const conditionallyRequired: { key: string; value: string | undefined; condition: boolean }[] = [
    {
      key: 'HOPMED_VIDEO_DAILY_API_KEY',
      value: config.HOPMED_VIDEO_DAILY_API_KEY,
      condition: config.HOPMED_FEATURE_VIDEO_ENABLED,
    },
    {
      key: 'HOPMED_SENTRY_DSN',
      value: config.HOPMED_SENTRY_DSN,
      condition: config.HOPMED_BUILD_SENTRY_ENABLED,
    },
    {
      key: 'HOPMED_VIDEO_AGORA_APP_ID',
      value: config.HOPMED_VIDEO_AGORA_APP_ID,
      condition: config.HOPMED_FEATURE_AGORA_ENABLED,
    },
  ];

  // Check always required
  alwaysRequired.forEach(({ key, value }) => {
    if (value && value.trim() !== '') {
      available.push(key);
    } else {
      missing.push(key);
    }
  });

  // Check conditionally required
  conditionallyRequired.forEach(({ key, value, condition }) => {
    if (condition) {
      if (value && value.trim() !== '') {
        available.push(key);
      } else {
        missing.push(key);
      }
    }
  });

  return {
    valid: missing.length === 0,
    missing,
    available,
  };
}

/**
 * Get detailed environment variable metadata
 */
export function getEnvironmentMetadata(): EnvVarMetadata[] {
  const metadata: EnvVarMetadata[] = [];

  const definitions = [
    {
      key: 'HOPMED_BUILD_ENVIRONMENT',
      isSecret: false,
      isRequired: true,
      description: 'Current deployment environment',
    },
    {
      key: 'HOPMED_API_BASE_URL',
      isSecret: false,
      isRequired: true,
      description: 'Base URL for API endpoints',
    },
    {
      key: 'HOPMED_VIDEO_DAILY_API_KEY',
      isSecret: true,
      isRequired: true,
      description: 'Daily.co API key for video calls',
    },
    {
      key: 'HOPMED_SENTRY_DSN',
      isSecret: true,
      isRequired: false,
      description: 'Sentry error tracking DSN',
    },
    {
      key: 'HOPMED_SENTRY_AUTH_TOKEN',
      isSecret: true,
      isRequired: false,
      description: 'Sentry authentication token',
    },
    {
      key: 'HOPMED_DEBUG_MODE',
      isSecret: false,
      isRequired: false,
      description: 'Enable debug logging and features',
    },
    // Add more as needed...
  ];

  definitions.forEach(def => {
    const value = getEnvVarFromSources(def.key);
    metadata.push({
      key: def.key,
      value: value?.value,
      source: value?.source || 'defaults',
      isSecret: def.isSecret,
      isRequired: def.isRequired,
      description: def.description,
    });
  });

  return metadata;
}

/**
 * Get environment variable value and its source
 */
function getEnvVarFromSources(key: string): { value: string; source: EnvSource } | null {
  // Check process.env first
  if (process.env[key]) {
    return {
      value: process.env[key]!,
      source: 'process-env',
    };
  }

  // Check Expo config
  try {
    const ExpoConstants = require('expo-constants').default;
    if (ExpoConstants?.expoConfig?.extra?.[key]) {
      return {
        value: ExpoConstants.expoConfig.extra[key] as string,
        source: 'expo-config',
      };
    }
  } catch {}

  return null;
}

/**
 * Comprehensive configuration validation
 */
export function validateCompleteConfiguration(): ValidationResult {
  try {
    // Parse with schema
    const rawEnv = buildRawEnvironment();
    const validatedConfig = envSchema.parse(rawEnv);

    // Run environment-specific validations
    const envValidation = validateEnvironmentSpecific(validatedConfig);

    // Run secret validations
    const secretValidation = validateRequiredSecrets(validatedConfig);

    const allErrors = [...envValidation.errors];
    if (!secretValidation.valid) {
      allErrors.push(
        ...secretValidation.missing.map(key => ({
          field: key,
          message: 'Required secret is missing',
          received: undefined,
        }))
      );
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: envValidation.warnings,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: (error.issues || []).map((err: any) => ({
          field: Array.isArray(err.path) ? err.path.join('.') : String(err.path ?? ''),
          message: String(err.message || 'Invalid value'),
          received: (err as any).received,
        })),
        warnings: [],
      };
    }

    return {
      valid: false,
      errors: [
        {
          field: 'unknown',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          received: undefined,
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Build raw environment object (helper function)
 */
function buildRawEnvironment(): Record<string, string> {
  const rawEnv: Record<string, string> = {};

  // Get all possible keys from schema
  const allKeys = Object.keys(envSchema.shape);

  allKeys.forEach(key => {
    const value = getEnvVarFromSources(key);
    if (value) {
      rawEnv[key] = value.value;
    }
  });

  return rawEnv;
}

/**
 * Generate environment configuration report
 */
export function generateConfigurationReport(): string {
  const validation = validateCompleteConfiguration();
  const metadata = getEnvironmentMetadata();

  let report = '📊 HopMed Environment Configuration Report\n';
  report += '='.repeat(50) + '\n\n';

  // Overall status
  report += `✅ Configuration Status: ${validation.valid ? 'VALID' : 'INVALID'}\n`;
  report += `🔢 Total Variables: ${metadata.length}\n`;
  report += `⚠️  Validation Errors: ${validation.errors.length}\n`;
  report += `💡 Warnings: ${validation.warnings.length}\n\n`;

  // Environment details
  const config = envSchema.parse(buildRawEnvironment());
  report += '🌍 Environment Details:\n';
  report += `-  Environment: ${config.HOPMED_BUILD_ENVIRONMENT}\n`;
  report += `-  API URL: ${config.HOPMED_API_BASE_URL}\n`;
  report += `-  Debug Mode: ${config.HOPMED_DEBUG_MODE}\n`;
  report += `-  Sentry Enabled: ${config.HOPMED_BUILD_SENTRY_ENABLED}\n\n`;

  // Feature flags
  report += '🎛️  Feature Flags:\n';
  report += `-  Video Calls: ${config.HOPMED_FEATURE_VIDEO_ENABLED}\n`;
  report += `-  Health Tracking: ${config.HOPMED_FEATURE_HEALTH_ENABLED}\n`;
  report += `-  Analytics: ${config.HOPMED_FEATURE_ANALYTICS_ENABLED}\n`;
  report += `-  Push Notifications: ${config.HOPMED_FEATURE_PUSH_NOTIFICATIONS_ENABLED}\n\n`;

  // Secrets status
  report += '🔐 Secrets Status:\n';
  metadata
    .filter(m => m.isSecret)
    .forEach(m => {
      const status = m.value ? '✅' : '❌';
      report += `-  ${status} ${m.key}\n`;
    });

  // Errors
  if (validation.errors.length > 0) {
    report += '\n❌ Validation Errors:\n';
    validation.errors.forEach(error => {
      report += `-  ${error.field}: ${error.message}\n`;
    });
  }

  // Warnings
  if (validation.warnings.length > 0) {
    report += '\n⚠️  Warnings:\n';
    validation.warnings.forEach(warning => {
      report += `-  ${warning}\n`;
    });
  }

  return report;
}

/**
 * Test environment configuration connectivity
 */
export async function testConnectivity(
  config: EnvConfig
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Test API connectivity
    if (config.HOPMED_API_BASE_URL) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${config.HOPMED_API_BASE_URL}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) {
          errors.push(`API health check failed: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        errors.push(
          `API connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Add more connectivity tests as needed...
  } catch (error) {
    errors.push(
      `Connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Export validation utilities
 */
export const validation = {
  validateUrl,
  validateApiKey,
  validateEnvironmentSpecific,
  validateRequiredSecrets,
  validateCompleteConfiguration,
  getEnvironmentMetadata,
  generateConfigurationReport,
  testConnectivity,
};
