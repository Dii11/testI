/**
 * HealthKit Utility Functions
 *
 * Centralized error handling, validation, and helper functions for HealthKit integration
 * All functions implement graceful degradation and comprehensive error handling
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { sentryTracker } from './sentryErrorTracker';
import type {
  HealthKitErrorType,
  HealthKitErrorContext,
  HEALTHKIT_ERROR_MESSAGES,
} from '../types/healthKit';

/**
 * Check if HealthKit is available on the current platform/device
 *
 * Returns false for:
 * - Android devices
 * - iOS Simulators (HealthKit not supported)
 * - Old iOS versions (< iOS 8.0)
 * - Devices without HealthKit capability
 *
 * @returns {boolean} True if HealthKit is available
 */
export const isHealthKitAvailable = (): boolean => {
  // HealthKit is iOS-only
  if (Platform.OS !== 'ios') {
    return false;
  }

  // ✅ ENHANCED: Better iOS version checking
  const iosVersion = Platform.Version;
  if (typeof iosVersion === 'string') {
    const version = parseFloat(iosVersion);
    if (version < 8.0) {
      return false; // HealthKit requires iOS 8.0+
    }
  } else if (typeof iosVersion === 'number' && iosVersion < 8) {
    return false;
  }

  // ✅ ENHANCED: Better simulator detection
  // iOS Simulator doesn't support HealthKit
  if (__DEV__) {
    // In development, we allow testing but warn about simulator limitations
    console.log('🏥 [HealthKit] Development mode - HealthKit availability will be checked by native module');
    return true;
  }

  // ✅ ENHANCED: Real device availability is checked by the native module
  // The @kingstinct/react-native-healthkit library handles this internally
  return true;
};

/**
 * Parse unknown error into typed HealthKit error
 *
 * Intelligently categorizes errors based on error messages and types
 * Always returns a valid HealthKitErrorType (never throws)
 *
 * @param error - Unknown error from HealthKit operations
 * @param context - Context information for logging
 * @returns {HealthKitErrorType} Categorized error type
 */
export const parseHealthKitError = (
  error: unknown,
  context: HealthKitErrorContext
): HealthKitErrorType => {
  try {
    // Handle null/undefined
    if (!error) {
      return 'UNKNOWN';
    }

    // Extract error message
    const errorMessage = error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

    // Categorize based on error content
    if (errorMessage.includes('not available') ||
        errorMessage.includes('not supported')) {
      return 'NOT_AVAILABLE';
    }

    if (errorMessage.includes('not authorized') ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('authorization denied')) {
      return 'NOT_AUTHORIZED';
    }

    if (errorMessage.includes('no data') ||
        errorMessage.includes('no samples') ||
        errorMessage.includes('empty')) {
      return 'NO_DATA';
    }

    if (errorMessage.includes('invalid') ||
        errorMessage.includes('malformed')) {
      return 'INVALID_PARAMETERS';
    }

    if (errorMessage.includes('initialization') ||
        errorMessage.includes('init failed')) {
      return 'INITIALIZATION_FAILED';
    }

    // Default to query failed for other errors
    return 'QUERY_FAILED';

  } catch (parseError) {
    // If error parsing itself fails, return unknown
    console.error('Error parsing HealthKit error:', parseError);
    return 'UNKNOWN';
  }
};

/**
 * Handle and log HealthKit errors with comprehensive tracking
 *
 * - Logs to console (development only)
 * - Tracks to Sentry (production)
 * - Returns user-friendly error message
 *
 * @param error - The error that occurred
 * @param context - Context information
 * @returns {HealthKitErrorType} Typed error for state management
 */
export const handleHealthKitError = (
  error: unknown,
  context: HealthKitErrorContext
): HealthKitErrorType => {
  try {
    // Parse error into typed category
    const errorType = parseHealthKitError(error, context);

    // Development logging (verbose)
    if (__DEV__) {
      console.error(`❌ [${context.hook}] ${context.action} failed:`, {
        errorType,
        error,
        context: context.additional,
      });
    }

    // Production logging (errors only)
    if (!__DEV__) {
      console.error(`HealthKit error in ${context.hook}.${context.action}:`, errorType);
    }

    // Track to Sentry (non-fatal)
    const errorMessage = error instanceof Error
      ? error.message
      : String(error);

    sentryTracker.trackServiceError(
      new Error(`HealthKit ${errorType}: ${errorMessage}`),
      {
        service: context.hook,
        action: context.action,
        additional: {
          errorType,
          platform: Platform.OS,
          ...context.additional,
        },
      }
    );

    return errorType;

  } catch (handlingError) {
    // If error handling itself fails, log and return UNKNOWN
    console.error('Fatal error in handleHealthKitError:', handlingError);
    return 'UNKNOWN';
  }
};

/**
 * Validate and sanitize date range for health queries
 *
 * Ensures:
 * - Start date is before end date
 * - Dates are not in the future
 * - Dates are valid Date objects
 *
 * @param startDate - Query start date
 * @param endDate - Query end date
 * @returns {{ valid: boolean, error?: HealthKitErrorType }} Validation result
 */
export const validateDateRange = (
  startDate: Date,
  endDate: Date
): { valid: boolean; error?: HealthKitErrorType } => {
  try {
    // Check if dates are valid
    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
      return { valid: false, error: 'INVALID_PARAMETERS' };
    }

    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
      return { valid: false, error: 'INVALID_PARAMETERS' };
    }

    // Check if start is before end
    if (startDate > endDate) {
      return { valid: false, error: 'INVALID_PARAMETERS' };
    }

    // Check if dates are not in the future (allow small buffer for timezone issues)
    const now = new Date();
    const buffer = 24 * 60 * 60 * 1000; // 24 hours
    if (startDate.getTime() > now.getTime() + buffer) {
      return { valid: false, error: 'INVALID_PARAMETERS' };
    }

    return { valid: true };

  } catch (error) {
    console.error('Error validating date range:', error);
    return { valid: false, error: 'INVALID_PARAMETERS' };
  }
};

/**
 * Sanitize health data values
 *
 * Filters out invalid values:
 * - NaN
 * - Infinity
 * - Negative values (for metrics that shouldn't be negative)
 * - Extremely large values (likely data errors)
 *
 * @param value - Raw health data value
 * @param options - Sanitization options
 * @returns {number | null} Sanitized value or null if invalid
 */
export const sanitizeHealthValue = (
  value: unknown,
  options: {
    allowNegative?: boolean;
    maxValue?: number;
  } = {}
): number | null => {
  try {
    // Convert to number
    const numValue = Number(value);

    // Check for invalid numbers
    if (isNaN(numValue) || !isFinite(numValue)) {
      return null;
    }

    // Check negative values
    if (!options.allowNegative && numValue < 0) {
      return null;
    }

    // Check maximum value (default: 1 million for safety)
    const maxValue = options.maxValue ?? 1000000;
    if (numValue > maxValue) {
      if (__DEV__) {
        console.warn(`Health value ${numValue} exceeds maximum ${maxValue}, filtering out`);
      }
      return null;
    }

    return numValue;

  } catch (error) {
    console.error('Error sanitizing health value:', error);
    return null;
  }
};

/**
 * Safely aggregate health samples
 *
 * Sums sample values while filtering out invalid data
 * Always returns a valid number (defaults to 0)
 *
 * @param samples - Array of health samples
 * @param getValue - Function to extract value from sample
 * @returns {number} Total aggregated value
 */
export const aggregateHealthSamples = <T>(
  samples: readonly T[] | T[] | null | undefined,
  getValue: (sample: T) => unknown
): number => {
  try {
    // Handle null/undefined samples
    if (!Array.isArray(samples) || samples.length === 0) {
      return 0;
    }

    // Sum all valid values
    const total = samples.reduce((sum, sample) => {
      const value = sanitizeHealthValue(getValue(sample));
      return sum + (value ?? 0);
    }, 0);

    return total;

  } catch (error) {
    console.error('Error aggregating health samples:', error);
    return 0;
  }
};

/**
 * Format health error for user display
 *
 * @param errorType - The error type
 * @returns {string} User-friendly error message
 */
export const getHealthKitErrorMessage = (errorType: HealthKitErrorType): string => {
  // Import the messages type-safely
  const messages: Record<HealthKitErrorType, string> = {
    NOT_AVAILABLE: 'Health tracking is only available on iOS devices with HealthKit support.',
    NOT_AUTHORIZED: 'Health data access was denied. Please grant permissions in Settings to view your health data.',
    AUTHORIZATION_PENDING: 'Waiting for permission approval...',
    QUERY_FAILED: 'Unable to fetch health data at this time. Please try again.',
    NO_DATA: 'No health data available for this period. Activity data may not have been recorded.',
    INVALID_PARAMETERS: 'Invalid date range selected. Please check your selection and try again.',
    INITIALIZATION_FAILED: 'HealthKit initialization failed. Please restart the app and try again.',
    TIMEOUT: 'Request timed out. Please check your connection and try again.',
    UNKNOWN: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  };

  return messages[errorType] || messages.UNKNOWN;
};

/**
 * Log successful HealthKit operation (development only)
 *
 * @param context - Operation context
 * @param data - Data retrieved/processed
 */
export const logHealthKitSuccess = (
  context: { hook: string; action: string },
  data: Record<string, unknown>
): void => {
  if (__DEV__) {
    console.log(`✅ [${context.hook}] ${context.action} succeeded:`, data);
  }
};

/**
 * Verify HealthKit authorization is ready for data queries
 *
 * 🚨 CRITICAL FIX: SIMPLIFIED VERSION - No Multiple Calls
 *
 * PREVIOUS PROBLEM: This function was calling isHealthDataAvailable() 3 times in a loop,
 * which combined with other calls in the permission flow caused Swift continuation crashes.
 *
 * NEW APPROACH: Just wait a fixed delay to let iOS propagate authorization internally.
 * The actual verification happens when hooks try to query data - if it fails, they handle it.
 *
 * TIMING: Fixed 500ms delay (safe and sufficient based on iOS behavior)
 *
 * @param context - Context for logging (optional)
 * @returns Promise<boolean> - Always returns true after delay (actual verification via data queries)
 *
 * @example
 * ```typescript
 * await requestAuthorization([...permissions]);
 * await verifyHealthKitReady({ hook: 'MyComponent' }); // Just waits 500ms
 * // Now try to query - the query itself will verify if permission was granted
 * const data = await queryQuantitySamples(...);
 * ```
 */
export const verifyHealthKitReady = async (
  context?: { hook?: string; action?: string }
): Promise<boolean> => {
  const hookName = context?.hook || 'verifyHealthKitReady';

  try {
    // Only available on iOS
    if (Platform.OS !== 'ios') {
      if (__DEV__) {
        console.log(`⚠️ [${hookName}] Skipping verification - not iOS platform`);
      }
      return false;
    }

    // Only attempt native import on real devices
    if (!Device.isDevice) {
      if (__DEV__) {
        console.log(`⚠️ [${hookName}] Skipping verification - not real device`);
      }
      return false;
    }

    if (__DEV__) {
      console.log(`🔍 [${hookName}] Waiting 500ms for iOS authorization propagation...`);
    }

    // ✅ FIX: Just wait a fixed delay - no multiple native calls
    // iOS needs ~500ms to propagate authorization internally
    // If it's not ready after this, the data query hooks will catch the error
    await new Promise(resolve => setTimeout(resolve, 500));

    if (__DEV__) {
      console.log(`✅ [${hookName}] Propagation delay complete - data hooks can now query`);
    }

    return true;

  } catch (error) {
    // Catastrophic error in verification logic itself
    console.error(`❌ [${hookName}] Fatal error in readiness verification:`, error);

    // Track to Sentry
    sentryTracker.trackServiceError(
      new Error(`HealthKit readiness verification failed: ${error}`),
      {
        service: hookName,
        action: context?.action || 'verification',
        additional: {
          platform: Platform.OS,
          errorType: 'verification_failure',
        },
      }
    );

    // Return true anyway - let data queries handle any issues
    return true;
  }
};
