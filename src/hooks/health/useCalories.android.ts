/**
 * useCalories - Android Health Connect Implementation
 *
 * Android-specific active energy tracking using Health Connect API
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

interface UseCaloriesParams {
  date?: Date;
  period?: PeriodFilter;
}

/**
 * Android Health Connect calories hook
 */
export const useCalories = (params: UseCaloriesParams = {}): HealthDataHookReturn<number> & {
  calories: number;
  openSettings?: () => Promise<void>;
  androidData?: unknown;
} => {
  const { date = new Date(), period = 'today' } = params;

  const [calories, setCalories] = useState<number>(0);
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
    } catch (error) {
      setIsHealthConnectAvailable(false);
      setError('QUERY_FAILED');
      return false;
    }
  }, []);

  const initializeHealthConnect = useCallback(async () => {
    if (isInitialized) return true;

    try {
      console.log('🔧 [useCalories] Initializing via HealthConnectManager...');
      await healthConnectManager.initialize();
      setIsInitialized(true);

      // ✅ CRITICAL FIX: DO NOT call hasPermission() immediately after init!
      // This internally calls getGrantedPermissions() which causes native crashes
      // on first launch on some Android devices (TECNO, custom ROMs, etc.)
      // We'll check permissions lazily only when user requests them
      console.log('ℹ️ [useCalories] Initialized - will check permissions lazily on user interaction');
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
      console.log('⚠️ [useCalories] Not initialized, cannot check permissions');
      return false;
    }

    try {
      console.log('🔍 [useCalories] Checking existing permissions via manager...');

      // Check for both ActiveCaloriesBurned and TotalCaloriesBurned
      const hasActiveCalories = await healthConnectManager.hasPermission('ActiveCaloriesBurned', 'read');
      const hasTotalCalories = await healthConnectManager.hasPermission('TotalCaloriesBurned', 'read');
      const hasCaloriesPermission = hasActiveCalories || hasTotalCalories;

      setHasPermissions(hasCaloriesPermission);
      return hasCaloriesPermission;
    } catch (error) {
      console.warn('⚠️ [useCalories] Could not check existing permissions:', error);
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
      console.log('🔐 [useCalories] Requesting permissions via manager...');

      // ✅ CRITICAL FIX: Check existing permissions first (safely)
      const alreadyHasPermissions = await checkExistingPermissions();
      if (alreadyHasPermissions) {
        console.log('✅ [useCalories] Permissions already granted');
        return true;
      }

      // ✅ CRITICAL: Use centralized manager to prevent concurrent API calls
      // Request BOTH ActiveCaloriesBurned and TotalCaloriesBurned permissions
      const success = await healthConnectManager.requestPermissions([
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'TotalCaloriesBurned' },
      ]);

      setHasPermissions(success);

      if (!success) {
        setError('NOT_AUTHORIZED');
      }

      console.log(`${success ? '✅' : '❌'} [useCalories] Permission request ${success ? 'granted' : 'denied'}`);

      return success;
    } catch (error) {
      console.error('❌ [useCalories] Permission request failed:', error);
      setError('NOT_AUTHORIZED');
      setHasPermissions(false);
      return false;
    }
  }, [isInitialized, checkExistingPermissions]);

  const readCaloriesData = useCallback(async () => {
    if (!isInitialized || !hasPermissions) return;

    try {
      const periodRange = getPeriodRange(period, date);

      console.log(`🔥 [useCalories] Reading calories for ${period}:`, {
        start: periodRange.startDate.toISOString(),
        end: periodRange.endDate.toISOString(),
      });

      // Try ActiveCaloriesBurned first, fallback to TotalCaloriesBurned
      let aggregateResult;
      let recordTypeUsed: 'ActiveCaloriesBurned' | 'TotalCaloriesBurned';
      try {
        recordTypeUsed = 'ActiveCaloriesBurned';
        aggregateResult = await aggregateRecord({
          recordType: recordTypeUsed,
          timeRangeFilter: {
            operator: 'between',
            startTime: periodRange.startDate.toISOString(),
            endTime: periodRange.endDate.toISOString(),
          },
        });
      } catch (err) {
        console.log('⚠️ [useCalories] ActiveCaloriesBurned failed, trying TotalCaloriesBurned...', err);
        recordTypeUsed = 'TotalCaloriesBurned';
        aggregateResult = await aggregateRecord({
          recordType: recordTypeUsed,
          timeRangeFilter: {
            operator: 'between',
            startTime: periodRange.startDate.toISOString(),
            endTime: periodRange.endDate.toISOString(),
          },
        });
      }

      console.log(`📊 [useCalories] Aggregate result from ${recordTypeUsed}:`, aggregateResult);

      // ✅ REAL-DEVICE DEBUG: Capture raw API response for verification
      setDebugData({
        recordType: recordTypeUsed,
        rawResponse: aggregateResult,
        responseKeys: aggregateResult ? Object.keys(aggregateResult) : [],
        timestamp: new Date().toISOString(),
      });

      // ✅ FIX: Based on actual API behavior (not TypeScript types)
      // The aggregateRecord API returns energy fields DIRECTLY on the result object
      // NOT nested under ACTIVE_CALORIES_TOTAL or ENERGY_TOTAL
      // See: https://github.com/matinzd/react-native-health-connect/blob/main/docs/docs/api/methods/09-aggregateRecord.md
      // Example result: { inKilocalories: 15000, inCalories: 15000000, inJoules: ..., dataOrigins: [...] }

      // Try direct properties first (actual API behavior)
      let totalCalories = (aggregateResult as any).inKilocalories || 0;

      // Fallback: Try nested properties (in case TypeScript types are correct for some versions)
      if (totalCalories === 0) {
        const nestedData =
          (aggregateResult as any).ACTIVE_CALORIES_TOTAL ||
          (aggregateResult as any).ENERGY_TOTAL;

        if (nestedData) {
          totalCalories =
            nestedData.inKilocalories ||
            nestedData.inCalories / 1000 ||
            0;
        }
      }

      // Last resort: Try converting from inCalories
      if (totalCalories === 0 && (aggregateResult as any).inCalories) {
        totalCalories = (aggregateResult as any).inCalories / 1000;
      }

      console.log(`✅ [useCalories] Total calories: ${totalCalories} kcal (direct: ${(aggregateResult as any).inKilocalories}, nested: ${(aggregateResult as any).ACTIVE_CALORIES_TOTAL?.inKilocalories || (aggregateResult as any).ENERGY_TOTAL?.inKilocalories})`);

      setCalories(totalCalories);
      setError(null);
    } catch (error) {
      console.error('❌ [useCalories] Failed to read calories:', error);
      setError('QUERY_FAILED');
      setCalories(0);
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
      console.log('🔍 [useCalories] Auto-checking existing permissions...');
      const hasExisting = await checkExistingPermissions();

      if (hasExisting) {
        console.log('✅ [useCalories] Permissions already granted, data will be fetched');
        // Data will be fetched by the hasPermissions useEffect
      } else {
        console.log('⚠️ [useCalories] No permissions found - user needs to grant them');
      }

      setIsLoading(false);
    };

    setupHealthConnect();
  }, [testHealthConnectFunctionality, initializeHealthConnect, checkExistingPermissions]);

  // Android data reading
  useEffect(() => {
    if (hasPermissions && isInitialized) {
      readCaloriesData();
    }
  }, [hasPermissions, isInitialized, date, period, readCaloriesData]);

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
        await readCaloriesData();
      }
    } finally {
      setIsLoading(false);
    }
  }, [requestHealthPermissions, readCaloriesData, isInitialized]);

  return {
    calories,
    data: calories,
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

