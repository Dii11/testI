import { useState, useEffect, useReducer, useCallback } from 'react';
import { Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { ensureAndroidHealthPermissions } from '../../services/health/androidPermissions';
import { wearableHealthManager } from '../../services/health/WearableHealthManager';
import type { AppDispatch } from '../../store';
import { selectUser } from '../../store/selectors/authSelectors';
import { initializeHealthService, syncHealthData } from '../../store/slices/healthSlice';
import { HealthDataType, CORE_HEALTH_DATA_TYPES } from '../../types/health';
import { sentryTracker } from '../../utils/sentryErrorTracker';

// Helper to get device-specific configuration
const getDeviceTier = () => {
  // Simplified tier detection for the hook
  return 'medium';
};

const getOptimalConfig = () => {
  const tier = getDeviceTier();
  return {
    refreshInterval: tier === 'low' ? 10000 : tier === 'medium' ? 5000 : 3000,
    enableAnimations: tier !== 'low',
  };
};

const EMPTY_HEALTH_DATA = {
  steps: { today: 0, goal: 10000, progress: 0 },
  heartRate: 0, // Use 0 instead of 'N/A' for numeric fields
  sleep: { duration: '0h 0m', hours: 0, minutes: 0, quality: 0 },
  calories: 0, // Use 0 instead of 'N/A' for numeric fields
  timestamp: new Date().toISOString(),
  dataSource: 'No Data Available',
};

export type HealthStatus =
  | 'uninitialized'
  | 'checking_availability'
  | 'checking_permissions'
  | 'requesting_permissions'
  | 'permission_granted'
  | 'permission_denied'
  | 'permission_partial'
  | 'initializing_providers'
  | 'connected'
  | 'error'
  | 'no_data'
  | 'device_unavailable';

interface PermissionState {
  steps: boolean | null;
  heartRate: boolean | null;
  sleep: boolean | null;
  calories: boolean | null;
  weight?: boolean | null;
  bloodPressure?: boolean | null;
  oxygenSaturation?: boolean | null;
  bodyTemperature?: boolean | null;
  bloodGlucose?: boolean | null;
}

interface DeviceInfo {
  name?: string;
  type?: string;
  lastSync?: string;
  installUrl?: string;
  availabilityMessage?: string;
}

interface State {
  status: HealthStatus;
  deviceInfo: DeviceInfo | null;
  emptyData: typeof EMPTY_HEALTH_DATA;
  error: string | null;
  permissionsGranted: boolean | null;
  permissionState: PermissionState;
  lastSync?: string;
  retryCount: number;
}

type Action =
  | { type: 'START_INITIALIZATION' }
  | { type: 'CHECKING_AVAILABILITY' }
  | { type: 'DEVICE_UNAVAILABLE'; payload: { message: string; actionUrl?: string } }
  | { type: 'CHECKING_PERMISSIONS' }
  | { type: 'PERMISSIONS_GRANTED'; payload?: { permissionState: PermissionState } }
  | { type: 'PARTIAL_PERMISSIONS'; payload: { permissionState: PermissionState } }
  | { type: 'REQUESTING_PERMISSIONS' }
  | { type: 'PERMISSIONS_DENIED'; payload?: { deniedPermissions: string[] } }
  | { type: 'INITIALIZING_PROVIDERS' }
  | { type: 'INITIALIZE_SUCCESS'; payload: { deviceInfo: DeviceInfo; permissionsGranted: boolean } }
  | { type: 'INITIALIZE_FAILURE'; payload: { error: string; canRetry: boolean } }
  | { type: 'SYNC_START' }
  | { type: 'SYNC_SUCCESS'; payload: { deviceInfo: DeviceInfo } }
  | { type: 'SYNC_FAILURE'; payload: { error: string } }
  | { type: 'SHOW_NO_DATA' }
  | { type: 'RETRY_INITIALIZATION' }
  | { type: 'RESET_STATE' };

const initialState: State = {
  status: 'uninitialized',
  deviceInfo: null,
  emptyData: EMPTY_HEALTH_DATA,
  error: null,
  permissionsGranted: null,
  permissionState: {
    steps: null,
    heartRate: null,
    sleep: null,
    calories: null,
    weight: null,
    bloodPressure: null,
    oxygenSaturation: null,
    bodyTemperature: null,
    bloodGlucose: null,
  },
  retryCount: 0,
};

const healthDataReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'START_INITIALIZATION':
      return {
        ...initialState,
        status: 'checking_availability',
        retryCount: state.retryCount,
      };

    case 'CHECKING_AVAILABILITY':
      return { ...state, status: 'checking_availability', error: null };

    case 'DEVICE_UNAVAILABLE':
      return {
        ...state,
        status: 'device_unavailable',
        error: action.payload.message,
        deviceInfo: {
          ...state.deviceInfo,
          installUrl: action.payload.actionUrl,
          availabilityMessage: action.payload.message,
        },
      };

    case 'CHECKING_PERMISSIONS':
      return { ...state, status: 'checking_permissions', error: null };

    case 'PERMISSIONS_GRANTED':
      return {
        ...state,
        status: 'permission_granted',
        permissionsGranted: true,
        permissionState: action.payload?.permissionState ?? {
          steps: true,
          heartRate: true,
          sleep: true,
          calories: true,
        },
        error: null,
      };

    case 'PARTIAL_PERMISSIONS':
      return {
        ...state,
        status: 'permission_partial',
        permissionsGranted: true, // Some permissions granted
        permissionState: action.payload.permissionState,
        error: null,
      };

    case 'REQUESTING_PERMISSIONS':
      return { ...state, status: 'requesting_permissions', error: null };

    case 'PERMISSIONS_DENIED':
      return {
        ...state,
        status: 'permission_denied',
        permissionsGranted: false,
        error: action.payload?.deniedPermissions
          ? `Access denied for: ${action.payload.deniedPermissions.join(', ')}`
          : 'Health data access denied',
      };

    case 'INITIALIZING_PROVIDERS':
      return { ...state, status: 'initializing_providers', error: null };

    case 'INITIALIZE_SUCCESS':
      return {
        ...state,
        status: 'connected',
        deviceInfo: action.payload.deviceInfo,
        permissionsGranted: action.payload.permissionsGranted,
        error: null,
        retryCount: 0,
      };

    case 'INITIALIZE_FAILURE':
      return {
        ...state,
        status: 'error',
        error: action.payload.error,
        retryCount: state.retryCount + 1,
      };

    case 'SYNC_START':
      return { ...state, status: 'initializing_providers' };

    case 'SYNC_SUCCESS':
      return {
        ...state,
        status: 'connected',
        deviceInfo: action.payload.deviceInfo,
        lastSync: new Date().toISOString(),
        error: null,
      };

    case 'SYNC_FAILURE':
      return { ...state, status: 'error', error: action.payload.error };

    case 'SHOW_NO_DATA':
      return {
        ...state,
        status: 'no_data',
        permissionsGranted: true,
        error: null,
      };

    case 'RETRY_INITIALIZATION':
      return {
        ...initialState,
        status: 'uninitialized',
        retryCount: Math.min(state.retryCount + 1, 3), // Cap at 3 retries
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
};

export type { PermissionState };

export const useHealthData = (): State & {
  deviceConfig: ReturnType<typeof getOptimalConfig>;
  refresh: () => Promise<void>;
  showNoData: () => void;
  retryInitialization: () => void;
  requestPermissions: () => Promise<void>;
} => {
  const [state, dispatchAction] = useReducer(healthDataReducer, initialState);
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector(selectUser);

  const [deviceConfig] = useState(() => getOptimalConfig());

  const initialize = useCallback(async () => {
    dispatchAction({ type: 'START_INITIALIZATION' });

    // Prevent excessive retries
    if (state.retryCount >= 3) {
      console.warn('🏥 Maximum retry attempts reached, showing no data');
      dispatchAction({ type: 'SHOW_NO_DATA' });
      return;
    }

    dispatchAction({ type: 'CHECKING_AVAILABILITY' });

    // Track initialization start
    const initStartTime = Date.now();

    try {
      const requiredPermissions = CORE_HEALTH_DATA_TYPES; // centralized list

      console.log('🏥 Starting health data initialization...');

      // 1) On Android, ensure runtime sensor/activity permissions (best-effort, non-blocking)
      if (Platform.OS === 'android') {
        try {
          await ensureAndroidHealthPermissions({ context: 'health_dashboard' });
        } catch (permErr) {
          console.warn('🏥 Skipped/failed ensuring Android runtime health permissions:', permErr);
        }
      }

      // 2) Initialize and register providers via redux service (this registers providers internally)
      dispatchAction({ type: 'INITIALIZING_PROVIDERS' });
      const initResult = await dispatch(initializeHealthService());

      // Check for graceful degradation mode after initialization
      const providers = wearableHealthManager.getActiveProviders();
      const hasHealthConnectProvider = providers.includes('google_health_connect');
      let isGracefulDegradation = false;

      if (hasHealthConnectProvider) {
        try {
          const healthConnectProvider = wearableHealthManager.getProvider('google_health_connect') as any;
          if (healthConnectProvider && typeof healthConnectProvider.isInGracefulDegradationMode === 'function') {
            isGracefulDegradation = healthConnectProvider.isInGracefulDegradationMode();
          }
        } catch (err) {
          console.log('🏥 Could not check graceful degradation mode:', err);
        }
      }

      if (!initResult.type.includes('fulfilled') && !isGracefulDegradation) {
        // Handle both rejected and failed cases safely, but allow graceful degradation
        let error = 'Initialization failed.';

        if (initResult.payload && typeof initResult.payload === 'object') {
          const payload = initResult.payload as any;
          error = payload.error || payload.message || error;
        } else if (initResult.payload && typeof initResult.payload === 'string') {
          error = initResult.payload;
        }

        console.error('🏥 Health service initialization failed:', error);

        // If we're in graceful degradation mode, don't treat this as a hard failure
        if (isGracefulDegradation) {
          console.log('🏥 Health Connect in graceful degradation mode - continuing with limited functionality');
        } else {
          sentryTracker.trackServiceError(new Error(error), {
            service: 'useHealthData',
            action: 'initialize',
            additional: {
              platform: Platform.OS,
              androidVersion: Platform.OS === 'android' ? Platform.Version : null,
              iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
              initDuration: Date.now() - initStartTime,
              timestamp: new Date().toISOString(),
            },
          });

          // If no providers after init, mark device unavailable with actionable hint
          if (providers.length === 0) {
            const message =
              Platform.OS === 'ios'
                ? 'HealthKit not available on this device'
                : 'Health Connect not installed or available';
            const actionUrl =
              Platform.OS === 'android'
                ? 'market://details?id=com.google.android.apps.healthdata'
                : undefined;
            dispatchAction({ type: 'DEVICE_UNAVAILABLE', payload: { message, actionUrl } });
            return;
          }

          dispatchAction({
            type: 'INITIALIZE_FAILURE',
            payload: { error, canRetry: state.retryCount < 3 },
          });
          return;
        }
      }

      // If in graceful degradation, show a helpful message but continue
      if (isGracefulDegradation) {
        console.log('🏥 Health Connect working in background - will connect when service becomes available');
      }

      // 3) With providers active, check permissions atomically
      dispatchAction({ type: 'CHECKING_PERMISSIONS' });
      const permissionMap = await wearableHealthManager.checkPermissions(requiredPermissions);

      // Build permission state from all providers
      const permissionState: PermissionState = {
        steps: null,
        heartRate: null,
        sleep: null,
        calories: null,
        weight: null,
        bloodPressure: null,
        oxygenSaturation: null,
        bodyTemperature: null,
        bloodGlucose: null,
      };

      let hasAnyPermissions = false;

      for (const [providerName, permissions] of permissionMap) {
        // Verbose permission inspection (can be toggled via env flag if needed)
        console.log(`🏥 Checking permissions for ${providerName}:`, permissions);

        permissions.forEach(perm => {
          hasAnyPermissions = hasAnyPermissions || perm.granted;

          switch (perm.type) {
            case HealthDataType.STEPS:
              permissionState.steps = permissionState.steps ?? perm.granted;
              break;
            case HealthDataType.HEART_RATE:
              permissionState.heartRate = permissionState.heartRate ?? perm.granted;
              break;
            case HealthDataType.SLEEP:
              permissionState.sleep = permissionState.sleep ?? perm.granted;
              break;
            case HealthDataType.CALORIES_BURNED:
              permissionState.calories = permissionState.calories ?? perm.granted;
              break;
            case HealthDataType.WEIGHT:
              permissionState.weight = permissionState.weight ?? perm.granted;
              break;
            case HealthDataType.BLOOD_PRESSURE:
              permissionState.bloodPressure = permissionState.bloodPressure ?? perm.granted;
              break;
            case HealthDataType.OXYGEN_SATURATION:
              permissionState.oxygenSaturation = permissionState.oxygenSaturation ?? perm.granted;
              break;
            case HealthDataType.BODY_TEMPERATURE:
              permissionState.bodyTemperature = permissionState.bodyTemperature ?? perm.granted;
              break;
            case HealthDataType.BLOOD_GLUCOSE:
              permissionState.bloodGlucose = permissionState.bloodGlucose ?? perm.granted;
              break;
            // Explicitly ignore currently unsupported permission tracking types
            default:
              break;
          }
        });
      }

      const grantedCount = Object.values(permissionState).filter(Boolean).length;
      const allGranted = grantedCount === requiredPermissions.length;

      // 3. Handle permission states
      if (allGranted) {
        console.log('🏥 All health permissions granted');
        dispatchAction({
          type: 'PERMISSIONS_GRANTED',
          payload: { permissionState },
        });
      } else if (hasAnyPermissions) {
        console.log(
          `🏥 Partial permissions granted: ${grantedCount}/${requiredPermissions.length}`
        );
        dispatchAction({
          type: 'PARTIAL_PERMISSIONS',
          payload: { permissionState },
        });
        // Continue with available data - graceful degradation
      } else {
        console.warn('🏥 No health permissions granted, requesting permissions...');
        dispatchAction({ type: 'REQUESTING_PERMISSIONS' });

        // Request permissions with timeout
        const requestPromise = wearableHealthManager.requestPermissions(requiredPermissions);
        const timeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(() => reject(new Error('Permission request timeout')), 30000);
        });

        const granted = await Promise.race([requestPromise, timeoutPromise]);

        if (granted) {
          console.log('🏥 Health permissions granted after request');

          // Re-check permissions to get updated state
          const updatedPermissions =
            await wearableHealthManager.checkPermissions(requiredPermissions);
          const updatedPermissionState: PermissionState = {
            steps: false,
            heartRate: false,
            sleep: false,
            calories: false,
            weight: false,
            bloodPressure: false,
            oxygenSaturation: false,
            bodyTemperature: false,
            bloodGlucose: false,
          };

          for (const [, permissions] of updatedPermissions) {
            permissions.forEach(perm => {
              if (perm.granted) {
                switch (perm.type) {
                  case HealthDataType.STEPS:
                    updatedPermissionState.steps = true;
                    break;
                  case HealthDataType.HEART_RATE:
                    updatedPermissionState.heartRate = true;
                    break;
                  case HealthDataType.SLEEP:
                    updatedPermissionState.sleep = true;
                    break;
                  case HealthDataType.CALORIES_BURNED:
                    updatedPermissionState.calories = true;
                    break;
                  case HealthDataType.WEIGHT:
                    updatedPermissionState.weight = true;
                    break;
                  case HealthDataType.BLOOD_PRESSURE:
                    updatedPermissionState.bloodPressure = true;
                    break;
                  case HealthDataType.OXYGEN_SATURATION:
                    updatedPermissionState.oxygenSaturation = true;
                    break;
                  case HealthDataType.BODY_TEMPERATURE:
                    updatedPermissionState.bodyTemperature = true;
                    break;
                  case HealthDataType.BLOOD_GLUCOSE:
                    updatedPermissionState.bloodGlucose = true;
                    break;
                }
              }
            });
          }

          const newGrantedCount = Object.values(updatedPermissionState).filter(Boolean).length;
          if (newGrantedCount === requiredPermissions.length) {
            dispatchAction({
              type: 'PERMISSIONS_GRANTED',
              payload: { permissionState: updatedPermissionState },
            });
          } else if (newGrantedCount > 0) {
            dispatchAction({
              type: 'PARTIAL_PERMISSIONS',
              payload: { permissionState: updatedPermissionState },
            });
          } else {
            throw new Error('No permissions granted after user interaction');
          }
        } else {
          console.warn('🏥 Health permissions denied by user');
          const deniedPermissions = requiredPermissions
            .filter((_, index) => !Object.values(permissionState)[index])
            .map(p => p.toString());

          dispatchAction({
            type: 'PERMISSIONS_DENIED',
            payload: { deniedPermissions },
          });

          // Track permission denial
          sentryTracker.trackServiceError(new Error('Health permissions denied by user'), {
            service: 'useHealthData',
            action: 'initialize',
            additional: {
              platform: Platform.OS,
              androidVersion: Platform.OS === 'android' ? Platform.Version : null,
              iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
              deniedPermissions: deniedPermissions.join(','),
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
      }

      // 4) Providers already initialized by service above; collect device info and finalize
      if (initResult.type.includes('fulfilled')) {
        const providers = wearableHealthManager.getActiveProviders();
        if (providers.length > 0 && providers[0]) {
          const primaryProvider = providers[0];
          let deviceInfo: State['deviceInfo'] = {
            name: Platform.OS === 'ios' ? 'Apple Health' : 'Google Health Connect',
            type: 'Health Platform',
            lastSync: new Date().toISOString(),
          };
          try {
            const deviceDetails = await wearableHealthManager.getDeviceInfo();
            if (deviceDetails && deviceDetails.size > 0) {
              const deviceData = deviceDetails.get(primaryProvider);
              deviceInfo = {
                name:
                  deviceData?.deviceName || `${Platform.OS === 'ios' ? 'Apple' : 'Android'} Device`,
                type: deviceData?.deviceModel || 'Health Device',
                lastSync: new Date().toISOString(),
              };
            }
          } catch (e) {
            console.warn('Could not get device info', e);
          }

          const initDuration = Date.now() - initStartTime;
          console.log(`🏥 Health initialization successful in ${initDuration}ms`);

          // Track successful initialization
          sentryTracker.trackServiceError(new Error('Health data initialization successful'), {
            service: 'useHealthData',
            action: 'initialize',
            additional: {
              platform: Platform.OS,
              provider: primaryProvider,
              deviceInfo: deviceInfo.name,
              initDuration,
              androidVersion: Platform.OS === 'android' ? Platform.Version : null,
              iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
              timestamp: new Date().toISOString(),
              success: true,
            },
          });

          dispatchAction({
            type: 'INITIALIZE_SUCCESS',
            payload: { deviceInfo, permissionsGranted: true },
          });
        } else {
          console.warn('🏥 No health providers available');
          dispatchAction({ type: 'SHOW_NO_DATA' });
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unknown error occurred.';
      console.error('🏥 Health initialization error:', errorMessage);

      // Track initialization error
      sentryTracker.trackServiceError(error instanceof Error ? error : new Error(errorMessage), {
        service: 'useHealthData',
        action: 'initialize',
        additional: {
          platform: Platform.OS,
          androidVersion: Platform.OS === 'android' ? Platform.Version : null,
          iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
          initDuration: Date.now() - initStartTime,
          timestamp: new Date().toISOString(),
        },
      });

      dispatchAction({
        type: 'INITIALIZE_FAILURE',
        payload: { error: errorMessage, canRetry: state.retryCount < 3 },
      });
    }
  }, [dispatch, state.retryCount]);

  const requestPermissions = useCallback(async () => {
    try {
      console.log('🏥 Manually requesting health permissions...');
      dispatchAction({ type: 'REQUESTING_PERMISSIONS' });

      const permissions = CORE_HEALTH_DATA_TYPES;

      const granted = await wearableHealthManager.requestPermissions(permissions);

      if (granted) {
        console.log('🏥 Health permissions granted, initializing...');
        dispatchAction({ type: 'PERMISSIONS_GRANTED' });

        // Track successful permission grant
        sentryTracker.trackServiceError(new Error('Health permissions granted successfully'), {
          service: 'useHealthData',
          action: 'requestPermissions',
          additional: {
            platform: Platform.OS,
            androidVersion: Platform.OS === 'android' ? Platform.Version : null,
            iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
            permissions: permissions.join(','),
            timestamp: new Date().toISOString(),
            success: true,
          },
        });

        // Re-initialize after permissions are granted
        initialize();
      } else {
        console.warn('🏥 Health permissions denied by user');
        dispatchAction({ type: 'PERMISSIONS_DENIED' });

        // Track permission denial
        sentryTracker.trackServiceError(new Error('Health permissions denied by user'), {
          service: 'useHealthData',
          action: 'requestPermissions',
          additional: {
            platform: Platform.OS,
            androidVersion: Platform.OS === 'android' ? Platform.Version : null,
            iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
            permissions: permissions.join(','),
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error: any) {
      console.error('🏥 Permission request error:', error);

      // Track permission request error
      sentryTracker.trackServiceError(
        error instanceof Error ? error : new Error('Permission request failed'),
        {
          service: 'useHealthData',
          action: 'requestPermissions',
          additional: {
            platform: Platform.OS,
            androidVersion: Platform.OS === 'android' ? Platform.Version : null,
            iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
            timestamp: new Date().toISOString(),
          },
        }
      );

      dispatchAction({
        type: 'INITIALIZE_FAILURE',
        payload: {
          error: error.message || 'Permission request failed.',
          canRetry: state.retryCount < 3,
        },
      });
    }
  }, [initialize]);

  const refresh = useCallback(async () => {
    const refreshStartTime = Date.now();

    if (state.status === 'no_data' || state.status === 'permission_denied') {
      // Try to reinitialize when refreshing from a no_data or permission_denied state
      console.log('🏥 Refreshing from no_data/permission_denied state, reinitializing...');
      initialize();
      return;
    }

    if (state.status === 'connected' && user?.id) {
      dispatchAction({ type: 'SYNC_START' });
      console.log('🏥 Starting health data sync...');

      try {
        await dispatch(syncHealthData(user.id));

        const refreshDuration = Date.now() - refreshStartTime;
        console.log(`🏥 Health data sync successful in ${refreshDuration}ms`);

        // Track successful sync
        sentryTracker.trackServiceError(new Error('Health data sync successful'), {
          service: 'useHealthData',
          action: 'refresh',
          additional: {
            platform: Platform.OS,
            userId: user.id,
            refreshDuration,
            androidVersion: Platform.OS === 'android' ? Platform.Version : null,
            iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
            timestamp: new Date().toISOString(),
            success: true,
          },
        });

        dispatchAction({
          type: 'SYNC_SUCCESS',
          payload: { deviceInfo: { ...state.deviceInfo, lastSync: new Date().toISOString() } },
        });
      } catch (error: any) {
        const errorMessage = error.message || 'Sync failed.';
        console.error('🏥 Health data sync failed:', errorMessage);

        // Track sync failure
        sentryTracker.trackServiceError(error instanceof Error ? error : new Error(errorMessage), {
          service: 'useHealthData',
          action: 'refresh',
          additional: {
            platform: Platform.OS,
            userId: user.id,
            refreshDuration: Date.now() - refreshStartTime,
            androidVersion: Platform.OS === 'android' ? Platform.Version : null,
            iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
            timestamp: new Date().toISOString(),
          },
        });

        dispatchAction({
          type: 'SYNC_FAILURE',
          payload: { error: errorMessage },
        });
      }
    } else {
      console.log('🏥 Refreshing from disconnected state, initializing...');
      initialize();
    }
  }, [state.status, user?.id, dispatch, initialize]);

  const showNoData = useCallback(() => {
    dispatchAction({ type: 'SHOW_NO_DATA' });
  }, []);

  const retryInitialization = useCallback(() => {
    console.log('🔄 Manual retry initialization requested');
    dispatchAction({ type: 'RETRY_INITIALIZATION' });
    setTimeout(() => initialize(), 100); // Small delay to prevent race conditions
  }, [initialize]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { ...state, deviceConfig, refresh, showNoData, retryInitialization, requestPermissions };
};
