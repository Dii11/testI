/**
 * Permission Context Provider
 *
 * Provides app-wide permission management with Redux integration
 * and enhanced error handling capabilities
 */

import type { ReactNode } from 'react';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { AppState, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

// ✅ MIGRATED: Now using ConsolidatedPermissionManager via PermissionManager
import type {
  PermissionType,
  PermissionResult,
  DeviceCapabilities,
} from '../services/PermissionManagerMigrated';
import PermissionManager from '../services/PermissionManagerMigrated';
import type { RootState, AppDispatch } from '../store';
import {
  initializePermissions as initializeReduxPermissions,
  handleAppStateChange,
} from '../store/slices/permissionSlice';

export interface PermissionContextValue {
  // Manager instance - ✅ MIGRATED: Now using ConsolidatedPermissionManager
  manager: typeof PermissionManager;

  // Device capabilities
  capabilities: DeviceCapabilities | null;

  // Global permission state
  isInitialized: boolean;
  isInitializing: boolean;
  initializationError: string | null;

  // Permission results cache
  permissionCache: Map<PermissionType, PermissionResult>;

  // Global permission actions
  checkPermission: (type: PermissionType) => Promise<PermissionResult>;
  requestPermission: (type: PermissionType) => Promise<PermissionResult>;
  invalidatePermission: (type: PermissionType) => void;
  invalidateAllPermissions: () => void;

  // Utility functions
  isPermissionGranted: (type: PermissionType) => boolean;
  isPermissionDenied: (type: PermissionType) => boolean;
  isPermissionBlocked: (type: PermissionType) => boolean;
  hasPermissionFallback: (type: PermissionType) => boolean;

  // Health check
  checkSystemHealth: () => Promise<boolean>;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export interface PermissionProviderProps {
  children: ReactNode;

  // Configuration options
  autoInitialize?: boolean;
  enableReduxIntegration?: boolean;
  enableAppStateMonitoring?: boolean;

  // Error handling
  onInitializationError?: (error: Error) => void;
  onPermissionError?: (type: PermissionType, error: Error) => void;
}

export const PermissionProvider: React.FC<PermissionProviderProps> = ({
  children,
  autoInitialize = true,
  enableReduxIntegration = true,
  enableAppStateMonitoring = true,
  onInitializationError,
  onPermissionError,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const reduxPermissionState = useSelector((state: RootState) => state.permissions);

  // Local state - ✅ MIGRATED: Now using ConsolidatedPermissionManager via PermissionManager
  const [manager] = useState(() => PermissionManager);
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [permissionCache] = useState(new Map<PermissionType, PermissionResult>());

  // ✅ FIX: Add app state tracking for intelligent refresh
  const [lastBackgroundTime, setLastBackgroundTime] = useState<number | null>(null);
  const appStateRef = useRef<string>('active');
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize permission system
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isInitializing) {
      initializePermissionSystem();
    }
  }, [autoInitialize, isInitialized, isInitializing]);

  // ✅ FIX: Debounced permission refresh with intelligent batching
  const debouncedPermissionRefresh = useMemo(() => {
    let timeoutId: NodeJS.Timeout;

    return (appState: string) => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(async () => {
        if (appState === 'active' && appStateRef.current !== 'active') {
          const backgroundDuration = lastBackgroundTime ? Date.now() - lastBackgroundTime : 0;

          // ✅ Only refresh if backgrounded for more than 30 seconds
          if (backgroundDuration > 30000) {
            console.log('🔐 App resumed after significant background time, refreshing permissions');
            await batchRefreshCriticalPermissions();
          } else {
            console.log('🔐 App resumed quickly, skipping permission refresh');
          }
        }

        if (appState === 'background') {
          setLastBackgroundTime(Date.now());
        }

        appStateRef.current = appState;
      }, 500); // ✅ 500ms debounce
    };
  }, [lastBackgroundTime, batchRefreshCriticalPermissions]);

  // ✅ FIX: Improved app state monitoring with cleanup and debouncing
  useEffect(() => {
    if (!enableAppStateMonitoring) return;

    const onAppStateChange = (nextAppState: string) => {
      console.log(`🔐 App state changed: ${appStateRef.current} → ${nextAppState}`);

      // Dispatch to Redux if integration is enabled
      if (enableReduxIntegration) {
        dispatch(handleAppStateChange(nextAppState));
      }

      // ✅ Use debounced refresh instead of immediate
      debouncedPermissionRefresh(nextAppState);
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      // ✅ Proper cleanup
      subscription.remove();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [enableAppStateMonitoring, enableReduxIntegration, dispatch]);

  const initializePermissionSystem = async () => {
    setIsInitializing(true);
    setInitializationError(null);

    try {
      console.log('🔐 Initializing permission system...');

      // Initialize enhanced permission manager
      await manager.initialize();

      // Get device capabilities
      const deviceCapabilities = manager.getDeviceCapabilities();
      setCapabilities(deviceCapabilities);

      // Initialize Redux permission system if enabled
      if (enableReduxIntegration) {
        await dispatch(initializeReduxPermissions()).unwrap();
      }

      setIsInitialized(true);
      console.log('✅ Permission system initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error('❌ Failed to initialize permission system:', error);

      setInitializationError(errorMessage);
      onInitializationError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsInitializing(false);
    }
  };

  // ✅ FIX: Batch permission refresh to avoid UI blocking
  const batchRefreshCriticalPermissions = useCallback(async () => {
    try {
      const criticalPermissions: PermissionType[] = ['camera', 'microphone', 'location'];

      // ✅ Parallel execution instead of sequential
      const refreshPromises = criticalPermissions.map(async permission => {
        const cached = permissionCache.get(permission);
        if (cached && shouldRevalidateOnAppActive(cached)) {
          try {
            const fresh = await manager.checkPermission(permission);
            permissionCache.set(permission, fresh);
            return { permission, result: fresh, success: true };
          } catch (error) {
            console.warn(`Failed to refresh ${permission} permission:`, error);
            return { permission, result: cached, success: false };
          }
        }
        return { permission, result: cached, success: true };
      });

      // ✅ Execute all checks in parallel
      const results = await Promise.allSettled(refreshPromises);
      console.log('🔐 Batch permission refresh completed:', results.length, 'permissions checked');
    } catch (error) {
      console.error('❌ Batch permission refresh failed:', error);
    }
  }, [permissionCache, manager]);

  // ✅ FIX: Smarter cache invalidation logic
  const shouldRevalidateOnAppActive = useCallback((result: PermissionResult): boolean => {
    const age = Date.now() - result.metadata.timestamp;

    // ✅ Only revalidate denied permissions if they're older than 5 minutes
    if (result.status === 'denied' || result.status === 'blocked') {
      return age > 300000; // 5 minutes instead of immediate
    }

    // ✅ Longer cache for granted permissions (2 minutes instead of 1)
    return age > 120000;
  }, []);

  const checkPermission = async (type: PermissionType): Promise<PermissionResult> => {
    try {
      const result = await manager.checkPermission(type);
      permissionCache.set(type, result);
      return result;
    } catch (error) {
      console.error(`Error checking ${type} permission:`, error);
      onPermissionError?.(type, error instanceof Error ? error : new Error(`Check ${type} failed`));
      throw error;
    }
  };

  const requestPermission = async (type: PermissionType): Promise<PermissionResult> => {
    try {
      // ✅ MIGRATED: Using new PermissionContext format for ConsolidatedPermissionManager
      const result = await manager.requestPermission(type, {
        feature: 'app_feature',
        priority: 'important',
        userJourney: 'feature-access',
        userInitiated: true,
      });
      permissionCache.set(type, result);
      return result;
    } catch (error) {
      console.error(`Error requesting ${type} permission:`, error);
      onPermissionError?.(
        type,
        error instanceof Error ? error : new Error(`Request ${type} failed`)
      );
      throw error;
    }
  };

  const invalidatePermission = (type: PermissionType) => {
    permissionCache.delete(type);
    manager.invalidatePermission(type);
  };

  const invalidateAllPermissions = () => {
    permissionCache.clear();
    // ✅ MIGRATED: ConsolidatedPermissionManager handles batch invalidation internally
    const permissionTypes: PermissionType[] = [
      'camera',
      'microphone',
      'location',
      'notifications',
      'health',
    ];
    permissionTypes.forEach(type => manager.invalidatePermission(type));
  };

  const isPermissionGranted = (type: PermissionType): boolean => {
    const cached = permissionCache.get(type);
    return cached?.status === 'granted' || false;
  };

  const isPermissionDenied = (type: PermissionType): boolean => {
    const cached = permissionCache.get(type);
    return cached?.status === 'denied' || cached?.status === 'blocked' || false;
  };

  const isPermissionBlocked = (type: PermissionType): boolean => {
    const cached = permissionCache.get(type);
    return (
      cached?.status === 'blocked' || (cached?.status === 'denied' && !cached.canAskAgain) || false
    );
  };

  const hasPermissionFallback = (type: PermissionType): boolean => {
    const cached = permissionCache.get(type);
    return cached?.fallbackAvailable || false;
  };

  const checkSystemHealth = async (): Promise<boolean> => {
    try {
      // Check if manager is initialized
      if (!isInitialized) {
        return false;
      }

      // Check device capabilities
      if (!capabilities) {
        return false;
      }

      // Verify core permissions can be checked
      const corePermissions: PermissionType[] = ['camera', 'microphone'];

      for (const permission of corePermissions) {
        try {
          await manager.checkPermission(permission);
        } catch (error) {
          console.warn(`Health check failed for ${permission}:`, error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('System health check failed:', error);
      return false;
    }
  };

  const contextValue: PermissionContextValue = {
    manager,
    capabilities,
    isInitialized,
    isInitializing,
    initializationError,
    permissionCache,
    checkPermission,
    requestPermission,
    invalidatePermission,
    invalidateAllPermissions,
    isPermissionGranted,
    isPermissionDenied,
    isPermissionBlocked,
    hasPermissionFallback,
    checkSystemHealth,
  };

  return <PermissionContext.Provider value={contextValue}>{children}</PermissionContext.Provider>;
};

export const usePermissionContext = (): PermissionContextValue => {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error('usePermissionContext must be used within a PermissionProvider');
  }

  return context;
};

// Hook for checking if permission system is ready
export const usePermissionSystemReady = (): boolean => {
  const { isInitialized, initializationError } = usePermissionContext();
  return isInitialized && !initializationError;
};

// Hook for getting device capabilities
export const useDeviceCapabilities = (): DeviceCapabilities | null => {
  const { capabilities } = usePermissionContext();
  return capabilities;
};

// Hook for quick permission status checks
export const usePermissionStatus = (type: PermissionType) => {
  const { isPermissionGranted, isPermissionDenied, isPermissionBlocked, hasPermissionFallback } =
    usePermissionContext();

  return {
    isGranted: isPermissionGranted(type),
    isDenied: isPermissionDenied(type),
    isBlocked: isPermissionBlocked(type),
    hasFallback: hasPermissionFallback(type),
  };
};

export default PermissionContext;
