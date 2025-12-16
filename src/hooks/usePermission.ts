/**
 * Modern Permission Hook
 *
 * Phase 4 implementation using the unified PermissionManager with
 * Phase 2 education system and Phase 3 device optimizations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, AppState } from 'react-native';

import type {
  PermissionType,
  PermissionResult,
  PermissionContext,
} from '../services/PermissionManagerMigrated';
import PermissionManager from '../services/PermissionManagerMigrated';

export interface UsePermissionState {
  // Current permission status
  result: PermissionResult | null;

  // Loading states
  isChecking: boolean;
  isRequesting: boolean;

  // Error state
  error: string | null;

  // Helper computed values
  isGranted: boolean;
  isDenied: boolean;
  isBlocked: boolean;
  canRequest: boolean;
  hasFallback: boolean;

  // Actions with Phase 2/3 enhancements
  check: () => Promise<PermissionResult>;
  request: (context?: PermissionContext) => Promise<PermissionResult>;
  requestWithEducation: (
    context?: PermissionContext,
    showEducation?: boolean
  ) => Promise<PermissionResult>;
  requestWithProgressiveFallback: (
    context?: PermissionContext,
    maxAttempts?: number
  ) => Promise<PermissionResult>;
  reset: () => void;
  openSettings: () => void;
}

export interface UsePermissionOptions {
  // Auto-check permission on mount
  autoCheck?: boolean;

  // Refresh permission when app becomes active
  refreshOnAppActive?: boolean;

  // Enable Phase 2 education by default
  enableEducation?: boolean;

  // Enable Phase 3 device optimizations
  enableDeviceOptimizations?: boolean;

  // Default context for requests
  defaultContext?: Partial<PermissionContext>;

  // Retry configuration
  maxRetryAttempts?: number;
  retryDelayMs?: number;
}

const defaultOptions: UsePermissionOptions = {
  autoCheck: true,
  refreshOnAppActive: true,
  enableEducation: true,
  enableDeviceOptimizations: true,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
};

export function usePermission(
  type: PermissionType,
  options: UsePermissionOptions = {}
): UsePermissionState {
  const opts = { ...defaultOptions, ...options };
  const manager = PermissionManager;

  // State
  const [result, setResult] = useState<PermissionResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const componentMountedRef = useRef(true);
  const lastCheckRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  // Check permission function
  const check = useCallback(async (): Promise<PermissionResult> => {
    const now = Date.now();

    // Rate limiting - prevent excessive checks
    if (now - lastCheckRef.current < 1000) {
      return (
        result || {
          status: 'unknown',
          canAskAgain: true,
          fallbackAvailable: false,
          metadata: {
            timestamp: Date.now(),
            source: 'cache' as const,
            retryCount: 0,
            deviceInfo: {
              platform: 'unknown',
              version: 'unknown',
              manufacturer: 'unknown',
              model: 'unknown',
            },
          },
        }
      );
    }

    lastCheckRef.current = now;
    setIsChecking(true);
    setError(null);

    try {
      const permissionResult = await manager.checkPermission(type);

      if (componentMountedRef.current) {
        setResult(permissionResult);
      }

      return permissionResult;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to check permission';

      if (componentMountedRef.current) {
        setError(errorMessage);
      }

      throw err;
    } finally {
      if (componentMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [type, manager, result]);

  // Basic request function
  const request = useCallback(
    async (context?: PermissionContext): Promise<PermissionResult> => {
      setIsRequesting(true);
      setError(null);

      try {
        const finalContext: PermissionContext = {
          feature: `${type}-access`,
          priority: 'important',
          userJourney: 'feature-access',
          userInitiated: true,
          ...opts.defaultContext,
          ...context,
        };

        const permissionResult = await manager.requestPermission(type, finalContext);

        if (componentMountedRef.current) {
          setResult(permissionResult);
          retryCountRef.current = 0;
        }

        return permissionResult;
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to request permission';

        if (componentMountedRef.current) {
          setError(errorMessage);
        }

        throw err;
      } finally {
        if (componentMountedRef.current) {
          setIsRequesting(false);
        }
      }
    },
    [type, manager, opts.defaultContext]
  );

  // Phase 2 Enhanced request with education
  const requestWithEducation = useCallback(
    async (
      context?: PermissionContext,
      showEducation: boolean = true
    ): Promise<PermissionResult> => {
      setIsRequesting(true);
      setError(null);

      try {
        const finalContext: PermissionContext = {
          feature: `${type}-access`,
          priority: 'important',
          userJourney: 'feature-access',
          userInitiated: true,
          ...opts.defaultContext,
          ...context,
        };

        const permissionResult = await manager.requestPermissionWithEducation(
          type,
          finalContext,
          showEducation
        );

        if (componentMountedRef.current) {
          setResult(permissionResult);
          retryCountRef.current = 0;
        }

        return permissionResult;
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to request permission with education';

        if (componentMountedRef.current) {
          setError(errorMessage);
        }

        throw err;
      } finally {
        if (componentMountedRef.current) {
          setIsRequesting(false);
        }
      }
    },
    [type, manager, opts.defaultContext]
  );

  // Phase 2 Enhanced request with progressive fallback
  const requestWithProgressiveFallback = useCallback(
    async (context?: PermissionContext, maxAttempts: number = 3): Promise<PermissionResult> => {
      setIsRequesting(true);
      setError(null);

      try {
        const finalContext: PermissionContext = {
          feature: `${type}-access`,
          priority: 'important',
          userJourney: 'feature-access',
          userInitiated: true,
          ...opts.defaultContext,
          ...context,
        };

        const permissionResult = await manager.requestPermissionWithProgressiveFallback(
          type,
          finalContext,
          maxAttempts
        );

        if (componentMountedRef.current) {
          setResult(permissionResult);
          retryCountRef.current = 0;
        }

        return permissionResult;
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to request permission with fallback';

        if (componentMountedRef.current) {
          setError(errorMessage);
        }

        throw err;
      } finally {
        if (componentMountedRef.current) {
          setIsRequesting(false);
        }
      }
    },
    [type, manager, opts.defaultContext]
  );

  // Reset function
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    retryCountRef.current = 0;
    manager.invalidatePermission(type);
  }, [type, manager]);

  // Open settings function
  const openSettings = useCallback(() => {
    manager.openAppSettings();
  }, [manager]);

  // Computed values
  const isGranted = result?.status === 'granted';
  const isDenied = result?.status === 'denied' || result?.status === 'blocked';
  const isBlocked =
    result?.status === 'blocked' || (result?.status === 'denied' && !result.canAskAgain);
  const canRequest = result?.canAskAgain !== false && !isGranted;
  const hasFallback = result?.fallbackAvailable === true;

  // Auto-check on mount
  useEffect(() => {
    if (opts.autoCheck) {
      check().catch(() => {
        // Silently fail auto-check, user can manually retry
      });
    }
  }, [opts.autoCheck, check]);

  // App state listener for refresh on active
  useEffect(() => {
    if (!opts.refreshOnAppActive) return;

    const handleAppStateChange = (nextAppState: any) => {
      if (nextAppState === 'active' && result) {
        // Refresh permission status when app becomes active
        check().catch(() => {
          // Silently fail refresh
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [opts.refreshOnAppActive, result, check]);

  return {
    result,
    isChecking,
    isRequesting,
    error,
    isGranted,
    isDenied,
    isBlocked,
    canRequest,
    hasFallback,
    check,
    request,
    requestWithEducation,
    requestWithProgressiveFallback,
    reset,
    openSettings,
  };
}

/**
 * Hook for handling multiple permissions simultaneously
 */
export function useMultiplePermissions(
  types: PermissionType[],
  options: UsePermissionOptions = {}
): {
  results: Record<string, PermissionResult | null>;
  isChecking: boolean;
  error: string | null;
  allGranted: boolean;
  anyDenied: boolean;
  anyBlocked: boolean;
  checkAll: () => Promise<Record<string, PermissionResult>>;
  requestAll: (
    contexts?: Record<string, PermissionContext>
  ) => Promise<Record<string, PermissionResult>>;
} {
  const opts = { ...defaultOptions, ...options };
  const manager = PermissionManager;

  const [results, setResults] = useState<Record<string, PermissionResult | null>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const componentMountedRef = useRef(true);

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  const checkAll = useCallback(async (): Promise<Record<string, PermissionResult>> => {
    setIsChecking(true);
    setError(null);

    try {
      const batchResults = await manager.checkMultiplePermissions(types);

      if (componentMountedRef.current) {
        setResults(batchResults);
      }

      return batchResults;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to check multiple permissions';

      if (componentMountedRef.current) {
        setError(errorMessage);
      }

      throw err;
    } finally {
      if (componentMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [types, manager]);

  const requestAll = useCallback(
    async (
      contexts: Record<string, PermissionContext> = {}
    ): Promise<Record<string, PermissionResult>> => {
      setIsChecking(true);
      setError(null);

      try {
        const finalContexts: Record<string, PermissionContext> = {};

        for (const type of types) {
          finalContexts[type] = {
            ...opts.defaultContext,
            ...contexts[type],
            feature: contexts[type].feature || `${type}-access`,
            priority: contexts[type].priority || 'important',
            userJourney: contexts[type].userJourney || 'feature-access',
            userInitiated: contexts[type].userInitiated ?? true,
          };
        }

        // Request permissions individually and combine results
        const batchResults: Record<string, PermissionResult> = {};
        for (const type of types) {
          try {
            batchResults[type] = await manager.requestPermission(type, finalContexts[type]);
          } catch (err) {
            batchResults[type] = {
              status: 'denied',
              canAskAgain: false,
              fallbackAvailable: false,
              metadata: {
                timestamp: Date.now(),
                source: 'fresh' as const,
                retryCount: 0,
                deviceInfo: {
                  platform: 'unknown',
                  version: 'unknown',
                  manufacturer: 'unknown',
                  model: 'unknown',
                },
                userInteractions: [(err as Error).message || 'Request failed'],
              },
            };
          }
        }

        if (componentMountedRef.current) {
          setResults(batchResults);
        }

        return batchResults;
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to request multiple permissions';

        if (componentMountedRef.current) {
          setError(errorMessage);
        }

        throw err;
      } finally {
        if (componentMountedRef.current) {
          setIsChecking(false);
        }
      }
    },
    [types, manager, opts.defaultContext]
  );

  // Auto-check on mount
  useEffect(() => {
    if (opts.autoCheck) {
      checkAll().catch(() => {
        // Silently fail auto-check
      });
    }
  }, [opts.autoCheck, checkAll]);

  // Computed values
  const allGranted = types.every(type => results[type]?.status === 'granted');
  const anyDenied = types.some(
    type => results[type]?.status === 'denied' || results[type]?.status === 'blocked'
  );
  const anyBlocked = types.some(type => results[type]?.status === 'blocked');

  return {
    results,
    isChecking,
    error,
    allGranted,
    anyDenied,
    anyBlocked,
    checkAll,
    requestAll,
  };
}

export default usePermission;
