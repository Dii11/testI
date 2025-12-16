/**
 * useHeartRate - Android Health Connect Implementation
 *
 * Android-specific heart rate tracking using Health Connect API
 * Completely separated from iOS implementation
 */

import { useEffect, useState, useCallback } from 'react';
import {
  aggregateRecord,
  getSdkStatus,
} from 'react-native-health-connect';
import { healthConnectManager } from '../../utils/HealthConnectManager';
import type { PeriodFilter } from '../../types/health';
import { getPeriodRange } from '../../types/health';
import type { HealthKitErrorType, HealthDataHookReturn } from '../../types/healthKit';

interface UseHeartRateParams {
  date?: Date;
  period?: PeriodFilter;
}

/**
 * Android Health Connect heart rate hook
 */
export const useHeartRate = (params: UseHeartRateParams = {}): HealthDataHookReturn<number> & {
  heartRate: number | null;
  openSettings?: () => Promise<void>;
  androidData?: unknown;
} => {
  const { date = new Date(), period = 'today' } = params;

  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HealthKitErrorType | null>(null);
  const [isHealthConnectAvailable, setIsHealthConnectAvailable] = useState(false);
  const [sdkStatus, setSdkStatus] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [debugData, setDebugData] = useState<any>(null); // For real-device debugging

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
    } catch (err) {
      setIsHealthConnectAvailable(false);
      setError('QUERY_FAILED');
      return false;
    }
  }, []);

  const initializeHealthConnect = useCallback(async () => {
    if (isInitialized) return true;

    try {
      console.log('🔧 [useHeartRate] Initializing via HealthConnectManager...');
      await healthConnectManager.initialize();
      setIsInitialized(true);

      // ✅ CRITICAL FIX: DO NOT call hasPermission() immediately after init!
      // This internally calls getGrantedPermissions() which causes native crashes
      // on first launch on some Android devices (TECNO, custom ROMs, etc.)
      // We'll check permissions lazily only when user requests them
      console.log('ℹ️ [useHeartRate] Initialized - will check permissions lazily on user interaction');
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
      console.log('⚠️ [useHeartRate] Not initialized, cannot check permissions');
      return false;
    }

    try {
      console.log('🔍 [useHeartRate] Checking existing permissions via manager...');

      const hasHeartRatePermission = await healthConnectManager.hasPermission('HeartRate', 'read');

      setHasPermissions(hasHeartRatePermission);
      return hasHeartRatePermission;
    } catch (error) {
      console.warn('⚠️ [useHeartRate] Could not check existing permissions:', error);
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
      console.log('🔐 [useHeartRate] Requesting permissions via manager...');

      // ✅ CRITICAL FIX: Check existing permissions first (safely)
      const alreadyHasPermissions = await checkExistingPermissions();
      if (alreadyHasPermissions) {
        console.log('✅ [useHeartRate] Permissions already granted');
        return true;
      }

      // ✅ CRITICAL: Use centralized manager to prevent concurrent API calls
      const success = await healthConnectManager.requestPermissions([
        { accessType: 'read', recordType: 'HeartRate' },
      ]);

      setHasPermissions(success);

      if (!success) {
        setError('NOT_AUTHORIZED');
      }

      console.log(`${success ? '✅' : '❌'} [useHeartRate] Permission request ${success ? 'granted' : 'denied'}`);

      return success;
    } catch (error) {
      console.error('❌ [useHeartRate] Permission request failed:', error);
      setError('NOT_AUTHORIZED');
      setHasPermissions(false);
      return false;
    }
  }, [isInitialized, checkExistingPermissions]);

  const readHeartRateData = useCallback(async () => {
    if (!isInitialized || !hasPermissions) return;

    try {
      const periodRange = getPeriodRange(period, date);

      const aggregateResult = await aggregateRecord({
        recordType: 'HeartRate',
        timeRangeFilter: {
          operator: 'between',
          startTime: periodRange.startDate.toISOString(),
          endTime: periodRange.endDate.toISOString(),
        },
      });

      // ✅ REAL-DEVICE DEBUG: Capture raw API response for verification
      setDebugData({
        recordType: 'HeartRate',
        rawResponse: aggregateResult,
        responseKeys: aggregateResult ? Object.keys(aggregateResult) : [],
        timestamp: new Date().toISOString(),
      });

      const avgHeartRate = (aggregateResult as any).BPM_AVG || (aggregateResult as any).BPM_MAX || null;
      setHeartRate(avgHeartRate);
      setError(null);
    } catch (err) {
      setError('QUERY_FAILED');
      setHeartRate(null);
    } finally {
      setIsLoading(false);
    }
  }, [date, period, hasPermissions, isInitialized]);

  // Initialization flow
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
      console.log('🔍 [useHeartRate] Auto-checking existing permissions...');
      const hasExisting = await checkExistingPermissions();

      if (hasExisting) {
        console.log('✅ [useHeartRate] Permissions already granted, data will be fetched');
        // Data will be fetched by the hasPermissions useEffect
      } else {
        console.log('⚠️ [useHeartRate] No permissions found - user needs to grant them');
      }

      setIsLoading(false);
    };

    setupHealthConnect();
  }, [testHealthConnectFunctionality, initializeHealthConnect, checkExistingPermissions]);

  // Data reading
  useEffect(() => {
    if (hasPermissions && isInitialized) {
      readHeartRateData();
    }
  }, [hasPermissions, isInitialized, date, period, readHeartRateData]);

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
        await readHeartRateData();
      }
    } finally {
      setIsLoading(false);
    }
  }, [requestHealthPermissions, readHeartRateData, isInitialized]);

  return {
    heartRate,
    data: heartRate,
    isLoading,
    error,
    hasPermissions,
    requestPermissions: retryPermissionRequest,
    openSettings,
    androidData: {
      sdkStatus,
      isHealthConnectAvailable,
      isInitialized,
      apiResponse: debugData, // ✅ Raw API response for real-device debugging
    },
  };
};
