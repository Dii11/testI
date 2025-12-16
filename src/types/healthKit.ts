/**
 * TypeScript Type Definitions for HealthKit Integration
 *
 * Comprehensive type safety for HealthKit error handling and state management
 */

/**
 * Enumerated error types for HealthKit operations
 * Each error represents a specific failure mode with user-friendly messaging
 */
export type HealthKitErrorType =
  | 'NOT_AVAILABLE'           // iOS only, HealthKit not supported (simulator/Android)
  | 'NOT_AUTHORIZED'          // User explicitly denied permissions
  | 'AUTHORIZATION_PENDING'   // Authorization request in progress
  | 'QUERY_FAILED'            // Data query failed (network, HealthKit service)
  | 'NO_DATA'                 // No health data available for requested period
  | 'INVALID_PARAMETERS'      // Invalid date range or query parameters
  | 'INITIALIZATION_FAILED'   // HealthKit initialization failed
  | 'TIMEOUT'                 // Request timed out
  | 'UNKNOWN';                // Catch-all for unexpected errors

/**
 * User-friendly error messages mapped to error types
 */
export const HEALTHKIT_ERROR_MESSAGES: Record<HealthKitErrorType, string> = {
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

/**
 * Generic health data state container
 * Provides consistent state shape across all health hooks
 */
export interface HealthDataState<T> {
  /** The actual health data (null when no data or not yet loaded) */
  data: T | null;

  /** Loading indicator for async operations */
  isLoading: boolean;

  /** Typed error information (null when no error) */
  error: HealthKitErrorType | null;

  /** Whether user has granted required permissions */
  hasPermissions: boolean;

  /** Whether HealthKit is available on this device/platform */
  isAvailable: boolean;
}

/**
 * Context information for error logging and tracking
 */
export interface HealthKitErrorContext {
  /** Hook or component name where error occurred */
  hook: string;

  /** Specific action that failed */
  action: string;

  /** Additional context data for debugging */
  additional?: Record<string, unknown>;
}

/**
 * Configuration for health data queries
 */
export interface HealthQueryOptions {
  /** Start date for data query */
  from: Date;

  /** End date for data query */
  to: Date;

  /** Optional limit on number of samples to return */
  limit?: number;

  /** Whether to include manually entered data */
  includeManuallyAdded?: boolean;
}

/**
 * Result of a permission request
 */
export interface PermissionResult {
  /** Whether permission was granted */
  granted: boolean;

  /** Optional error if permission request failed */
  error?: HealthKitErrorType;
}

/**
 * Hook return type for health data
 * Provides consistent API across all health hooks
 */
export interface HealthDataHookReturn<T> extends Omit<HealthDataState<T>, 'isAvailable'> {
  /** Function to request permissions */
  requestPermissions: () => Promise<void> | void;

  /** Function to retry failed queries */
  retry?: () => Promise<void> | void;
}
