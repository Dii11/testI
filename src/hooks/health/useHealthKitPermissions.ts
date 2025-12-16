/**
 * Reusable HealthKit Permissions Hook
 *
 * Provides consistent permission management across all health data hooks
 * Handles authorization requests, status checking, and error states gracefully
 */

import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { isHealthKitAvailable, handleHealthKitError } from '../../utils/healthKitUtils';
import type { HealthKitErrorType } from '../../types/healthKit';

// v10.0.0 authorization status values (numeric enum)
const AuthStatus = {
  unknown: 0,
  shouldRequest: 1,
  authorized: 2,
  notDetermined: 3,
} as const;

interface UseHealthKitPermissionsOptions {
  /** Required HealthKit permission identifiers (v10.0.0 uses string literals) */
  permissions: string[];

  /** Hook name for error logging */
  hookName: string;

  /** Whether to auto-request permissions on mount (default: false) */
  autoRequest?: boolean;
}

interface UseHealthKitPermissionsReturn {
  /** Whether all requested permissions are granted */
  isAuthorized: boolean;

  /** Whether HealthKit is available on this device */
  isAvailable: boolean;

  /** Whether permission request is in progress */
  isRequesting: boolean;

  /** Authorization status */
  authStatus: number | null;

  /** Any error that occurred during authorization */
  error: HealthKitErrorType | null;

  /** Function to request permissions */
  requestPermissions: () => Promise<void>;
}

/**
 * Hook to manage HealthKit permissions
 *
 * Features:
 * - Platform checking (iOS only)
 * - Availability checking (HealthKit support)
 * - Permission status tracking
 * - Graceful error handling
 * - Auto-request capability
 *
 * @param options - Configuration options
 * @returns Permission state and request function
 */
export const useHealthKitPermissions = (
  options: UseHealthKitPermissionsOptions
): UseHealthKitPermissionsReturn => {
  const { permissions, hookName, autoRequest = false } = options;

  // State
  const [error, setError] = useState<HealthKitErrorType | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Check availability (must be done before hook call for safety)
  const isAvailable = Platform.OS === 'ios' && isHealthKitAvailable();

  // Local authorization status (avoid using HealthKit hook to prevent module import on simulator)
  const [authStatus, setAuthStatus] = useState<number | null>(null);

  // ✅ iOS READ-ONLY FIX: For read-only permissions, authStatus NEVER reports "authorized" (iOS privacy)
  // Solution: Optimistically assume authorized after requesting, then let data queries verify
  // - authStatus === authorized: Write permissions (iOS reports status)
  // - hasRequestedPermission: Read permissions (optimistic - actual verification via query)
  const isAuthorized = isAvailable && (
    authStatus === AuthStatus.authorized ||  // Write permissions
    hasRequestedPermission  // Read permissions (optimistic authorization)
  );

  // Handle errors from HealthKit initialization
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setError('NOT_AVAILABLE');
      setIsCheckingStatus(false);
      return;
    }

    if (!isHealthKitAvailable()) {
      setError('NOT_AVAILABLE');
      setIsCheckingStatus(false);
      return;
    }

    // Clear error if we're available and authorized
    if (isAuthorized) {
      setError(null);
    }
  }, [isAvailable, isAuthorized]);

  // ✅ CRITICAL FIX: Check existing authorization status on mount
  // This is what the official example does (auth.tsx:42-63)
  // Without this, the app doesn't remember that permission was granted after restart
  useEffect(() => {
    if (!isAvailable || !Device.isDevice) {
      setIsCheckingStatus(false);
      return;
    }

    const checkExistingAuthorization = async () => {
      try {
        if (__DEV__) {
          console.log(`🔍 [${hookName}] Checking existing authorization status on mount...`);
        }

        // Dynamically import HealthKit to avoid loading on Android/simulator
        const hk = require('@kingstinct/react-native-healthkit');
        const getRequestStatusForAuthorization = hk.getRequestStatusForAuthorization;

        if (!getRequestStatusForAuthorization) {
          if (__DEV__) {
            console.warn(`⚠️ [${hookName}] getRequestStatusForAuthorization not available`);
          }
          setIsCheckingStatus(false);
          return;
        }

        // Check authorization status (same as official example)
        const status = await getRequestStatusForAuthorization(
          permissions as any,  // Read permissions
          []                   // Write permissions (empty for read-only)
        );

        if (__DEV__) {
          console.log(`📋 [${hookName}] Authorization status:`, {
            status,
            statusName: status === AuthStatus.shouldRequest
              ? 'shouldRequest'
              : status === AuthStatus.authorized
                ? 'authorized'
                : status === AuthStatus.notDetermined
                  ? 'notDetermined'
                  : 'unknown',
          });
        }

        // ✅ If authorization was previously granted, set the state
        // Note: For read-only permissions, iOS may return shouldRequest even when granted
        // This is iOS privacy - it never reveals read authorization status
        // So we check if status is NOT "unknown" (which means HealthKit is working)
        if (status === AuthStatus.authorized || status === AuthStatus.shouldRequest) {
          // shouldRequest means user hasn't denied, so we can try to use optimistic auth
          // If they previously granted, queries will succeed; if not, they'll fail gracefully
          setHasRequestedPermission(true);
          setAuthStatus(status);
          setError(null);

          if (__DEV__) {
            console.log(`✅ [${hookName}] Setting optimistic authorization based on status check`);
          }
        } else if (status === AuthStatus.unknown) {
          // Unknown status - might be first time or error
          if (__DEV__) {
            console.log(`⚠️ [${hookName}] Unknown authorization status - user needs to grant permission`);
          }
          setHasRequestedPermission(false);
          setAuthStatus(null);
        }

      } catch (statusError) {
        if (__DEV__) {
          console.warn(`⚠️ [${hookName}] Failed to check authorization status:`, statusError);
        }
        // Don't set error - just leave as not authorized
        // The user can still try to request permissions manually
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkExistingAuthorization();
  }, [isAvailable, permissions, hookName]);

  // Request permissions function with error handling
  const requestPermissions = useCallback(async () => {
    // Clear previous errors
    setError(null);

    // Check availability
    if (!isAvailable) {
      setError('NOT_AVAILABLE');
      return;
    }

    // Check if already authorized
    if (isAuthorized) {
      if (__DEV__) {
        console.log(`✅ [${hookName}] Already authorized - skipping permission request`);
      }
      return;
    }

    try {
      setIsRequesting(true);

      if (!Device.isDevice) {
        setError('NOT_AVAILABLE');
        return;
      }

      // ✅ CRITICAL FIX: Only call isHealthDataAvailable ONCE before requesting
      let requestAuthorizationFn: any = null;
      try {
        const hk = require('@kingstinct/react-native-healthkit');
        const isHealthDataAvailableFn = hk.isHealthDataAvailable;
        requestAuthorizationFn = hk.requestAuthorization;

        if (!isHealthDataAvailableFn) {
          setError('NOT_AVAILABLE');
          return;
        }

        // ✅ SINGLE availability check (not multiple)
        const healthDataAvailable = await isHealthDataAvailableFn();

        if (!healthDataAvailable) {
          if (__DEV__) {
            console.warn('⚠️ [HealthKit] Health data not available on this device (simulator or restricted device)');
          }
          setError('NOT_AVAILABLE');
          return;
        }
      } catch (availCheckError) {
        if (__DEV__) {
          console.warn('⚠️ [HealthKit] Module unavailable or check failed:', availCheckError);
        }
        setError('NOT_AVAILABLE');
        return;
      }

      // ✅ CRITICAL FIX: Call native requestAuthorization to trigger iOS permission dialog
      // This is required in v10.0.0 - useHealthkitAuthorization only checks status
      if (__DEV__) {
        console.log(`🔐 [${hookName}] Requesting authorization for ${permissions.length} permissions...`);
      }

      await requestAuthorizationFn(
        permissions as any,  // Read permissions
        []           // Write permissions (empty array for read-only access)
      );

      if (__DEV__) {
        console.log(`✅ [${hookName}] Authorization dialog dismissed by user`);
      }

      // ✅ SIMPLIFIED: Just wait 1 second for iOS to propagate authorization
      // No more verification loops that call isHealthDataAvailable() again
      if (__DEV__) {
        console.log(`⏳ [${hookName}] Waiting 1 second for iOS authorization propagation...`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ✅ Mark as optimistically authorized for read permissions
      // iOS READ-ONLY PRIVACY: iOS never reports read authorization status
      // We must assume success and let data queries verify actual access
      setHasRequestedPermission(true);
      setAuthStatus(AuthStatus.authorized);
      setError(null);

      if (__DEV__) {
        console.log(`✅ [${hookName}] Permission flow complete - optimistically authorized for read-only access`);
        console.log(`📊 [${hookName}] Data hooks will now attempt to query health data`);
      }

    } catch (requestError) {
      // Handle permission request error
      const errorType = handleHealthKitError(requestError, {
        hook: hookName,
        action: 'requestPermissions',
        additional: {
          permissions: permissions.map(p => p.toString()),
        },
      });

      // Reset optimistic authorization on error
      setHasRequestedPermission(false);
      setError(errorType);

    } finally {
      setIsRequesting(false);
    }
  }, [isAvailable, isAuthorized, permissions, hookName]);

  // Auto-request permissions on mount (if enabled)
  useEffect(() => {
    // ✅ Wait for status check to complete before auto-requesting
    if (autoRequest && isAvailable && !isAuthorized && !error && !isCheckingStatus) {
      if (__DEV__) {
        console.log(`🔐 [${hookName}] Auto-requesting permissions (status check complete)`);
      }
      requestPermissions();
    }
  }, [autoRequest, isAvailable, isAuthorized, error, isCheckingStatus, requestPermissions, hookName]);

  return {
    isAuthorized,
    isAvailable,
    isRequesting,
    authStatus,
    error,
    requestPermissions,
  };
};
