/**
 * useActiveTime - Android Health Connect Implementation
 *
 * Android-specific workout/exercise time tracking using Health Connect API
 * Completely separated from iOS implementation
 */

import { useEffect, useState, useCallback } from 'react';
import {
  readRecords,
  getSdkStatus,
} from 'react-native-health-connect';
import { healthConnectManager } from '../../utils/HealthConnectManager';
import type { PeriodFilter } from '../../types/health';
import { getPeriodRange } from '../../types/health';
import type { HealthKitErrorType, HealthDataHookReturn } from '../../types/healthKit';

interface UseActiveTimeParams {
  date?: Date;
  period?: PeriodFilter;
}

/**
 * Android Health Connect active time hook
 */
export const useActiveTime = (params: UseActiveTimeParams = {}): HealthDataHookReturn<number> & {
  activeMinutes: number;
  activeHours: number;
  openSettings?: () => Promise<void>;
  androidData?: unknown;
} => {
  const { date = new Date(), period = 'today' } = params;

  const [activeMinutes, setActiveMinutes] = useState<number>(0);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HealthKitErrorType | null>(null);
  const [isHealthConnectAvailable, setIsHealthConnectAvailable] = useState(false);
  const [sdkStatus, setSdkStatus] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const testHealthConnectFunctionality = useCallback(async () => {
    try {
      const status = await getSdkStatus();
      setSdkStatus(status);

      const statusNum =
        typeof status === 'number'
          ? status
          : typeof status === 'object' && status && 'status' in status
          ? (status as any).status
          : null;

      if (statusNum === 1) {
        setError('NOT_AVAILABLE');
        setIsHealthConnectAvailable(false);
        return false;
      }

      setIsHealthConnectAvailable(true);
      return true;
    } catch (error) {
      setIsHealthConnectAvailable(false);
      setError('QUERY_FAILED');
      return false;
    }
  }, []);

  const initializeHealthConnect = useCallback(async () => {
    if (isInitialized) return true;

    try {
      console.log('🔧 [useActiveTime] Initializing via HealthConnectManager...');
      await healthConnectManager.initialize();
      setIsInitialized(true);

      // ✅ CRITICAL FIX: DO NOT call hasPermission() immediately after init!
      // This internally calls getGrantedPermissions() which causes native crashes
      // on first launch on some Android devices (TECNO, custom ROMs, etc.)
      // We'll check permissions lazily only when user requests them
      console.log('ℹ️ [useActiveTime] Initialized - will check permissions lazily on user interaction');
      setHasPermissions(false); // Assume no permissions until explicitly checked
      setError(null);

      return true;
    } catch (error) {
      setError('INITIALIZATION_FAILED');
      setIsInitialized(false);
      return false;
    }
  }, [isInitialized]);

  // ✅ LAZY: Check existing permissions only when needed (prevents first-launch crash)
  const checkExistingPermissions = useCallback(async () => {
    if (!isInitialized) {
      console.log('⚠️ [useActiveTime] Not initialized, cannot check permissions');
      return false;
    }

    try {
      console.log('🔍 [useActiveTime] Checking existing permissions via manager...');

      const hasExercisePermission = await healthConnectManager.hasPermission('ExerciseSession', 'read');

      setHasPermissions(hasExercisePermission);
      return hasExercisePermission;
    } catch (error) {
      console.warn('⚠️ [useActiveTime] Could not check existing permissions:', error);
      setHasPermissions(false);
      return false;
    }
  }, [isInitialized]);

  const requestHealthPermissions = useCallback(async () => {
    if (!isInitialized) {
      setError('INITIALIZATION_FAILED');
      return false;
    }

    try {
      console.log('🔐 [useActiveTime] Requesting permissions via manager...');

      // ✅ CRITICAL FIX: Check existing permissions first (safely)
      const alreadyHasPermissions = await checkExistingPermissions();
      if (alreadyHasPermissions) {
        console.log('✅ [useActiveTime] Permissions already granted');
        return true;
      }

      // ✅ CRITICAL: Use centralized manager to prevent concurrent API calls
      const success = await healthConnectManager.requestPermissions([
        { accessType: 'read', recordType: 'ExerciseSession' },
      ]);

      setHasPermissions(success);

      if (!success) {
        setError('NOT_AUTHORIZED');
      }

      console.log(`${success ? '✅' : '❌'} [useActiveTime] Permission request ${success ? 'granted' : 'denied'}`);

      return success;
    } catch (error) {
      console.error('❌ [useActiveTime] Permission request failed:', error);
      setError('NOT_AUTHORIZED');
      setHasPermissions(false);
      return false;
    }
  }, [isInitialized, checkExistingPermissions]);

  const readActiveTimeData = useCallback(async () => {
    if (!isInitialized || !hasPermissions) return;

    try {
      const periodRange = getPeriodRange(period, date);

      const result = await readRecords('ExerciseSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: periodRange.startDate.toISOString(),
          endTime: periodRange.endDate.toISOString(),
        },
      });

      const sessions = (result as any)?.records || result || [];

      if (!Array.isArray(sessions) || sessions.length === 0) {
        setActiveMinutes(0);
        setError(null);
        setIsLoading(false);
        return;
      }

      // Sum all exercise session durations
      const totalMinutes = sessions.reduce((sum: number, session: any) => {
        if (session.startTime && session.endTime) {
          const start = new Date(session.startTime).getTime();
          const end = new Date(session.endTime).getTime();
          const durationMs = end - start;
          const durationMinutes = Math.round(durationMs / 60000);
          return sum + durationMinutes;
        }
        return sum;
      }, 0);

      setActiveMinutes(totalMinutes);
      setError(null);
    } catch (error) {
      setError('QUERY_FAILED');
      setActiveMinutes(0);
    } finally {
      setIsLoading(false);
    }
  }, [date, period, hasPermissions, isInitialized]);

  // Android initialization flow
  useEffect(() => {
    const setupHealthConnect = async () => {
      setIsLoading(true);
      setError(null);

      const isAvailable = await testHealthConnectFunctionality();
      if (!isAvailable) {
        setIsLoading(false);
        return;
      }

      const initSuccess = await initializeHealthConnect();
      if (!initSuccess) {
        setIsLoading(false);
        return;
      }

      // ✅ CRITICAL FIX: Auto-check permissions after initialization
      // This ensures we know the permission state and can fetch data if already granted
      console.log('🔍 [useActiveTime] Auto-checking existing permissions...');
      const hasExisting = await checkExistingPermissions();

      if (hasExisting) {
        console.log('✅ [useActiveTime] Permissions already granted, data will be fetched');
        // Data will be fetched by the hasPermissions useEffect
      } else {
        console.log('⚠️ [useActiveTime] No permissions found - user needs to grant them');
      }

      setIsLoading(false);
    };

    setupHealthConnect();
  }, [testHealthConnectFunctionality, initializeHealthConnect, checkExistingPermissions]);

  // Android data reading
  useEffect(() => {
    if (hasPermissions && isInitialized) {
      readActiveTimeData();
    }
  }, [hasPermissions, isInitialized, date, period, readActiveTimeData]);

  const openSettings = useCallback(async () => {
    try {
      await healthConnectManager.openSettings();
    } catch (error) {
      console.error('Error opening Health Connect settings:', error);
    }
  }, []);

  const retryPermissionRequest = useCallback(async () => {
    if (!isInitialized) {
      setError('INITIALIZATION_FAILED');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const success = await requestHealthPermissions();
      if (success) {
        await readActiveTimeData();
      }
    } finally {
      setIsLoading(false);
    }
  }, [requestHealthPermissions, readActiveTimeData, isInitialized]);

  // Calculate hours from minutes
  const activeHours = activeMinutes / 60;

  return {
    activeMinutes,
    activeHours,
    data: activeMinutes,
    isLoading,
    error,
    hasPermissions,
    requestPermissions: retryPermissionRequest,
    openSettings,
    androidData: {
      sdkStatus,
      isHealthConnectAvailable,
      isInitialized,
    },
  };
};

