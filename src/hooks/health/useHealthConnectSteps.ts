import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  aggregateRecord,
} from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';
import { sentryTracker } from '../../utils/sentryErrorTracker';
import { healthConnectManager } from '../../utils/HealthConnectManager';
import type { PeriodFilter, PeriodRange } from '../../types/health';
import { getPeriodRange } from '../../types/health';

interface UseHealthConnectStepsParams {
  date?: Date;
  period?: PeriodFilter;
}

export const useHealthConnectSteps = (params: UseHealthConnectStepsParams = {}) => {
  const { date = new Date(), period = 'today' } = params;

  // ✅ SIMPLIFIED: Based on working examples - minimal state management
  const [hasPermissions, setHasPermissions] = useState(false);
  const [steps, setSteps] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [debugData, setDebugData] = useState<any>(null); // For real-device debugging

  // ✅ CRASH-SAFE: Initialize using centralized manager
  const initializeHealthConnect = useCallback(async () => {
    if (isInitialized) {
      console.log('⏭️ [useHealthConnectSteps] Already initialized');
      return true;
    }

    try {
      console.log('🔧 [useHealthConnectSteps] Initializing via HealthConnectManager...');
      await healthConnectManager.initialize();

      setIsInitialized(true);
      console.log('✅ [useHealthConnectSteps] Initialized successfully');

      // ✅ CRITICAL FIX: DO NOT call getGrantedPermissions() immediately after init!
      // This causes native crashes on first launch on some Android devices (TECNO, custom ROMs)
      // Instead, we'll check permissions only when explicitly requested by the user
      console.log('ℹ️ [useHealthConnectSteps] Ready - will check permissions only when user requests');
      setHasPermissions(false); // Assume no permissions until explicitly checked
      setError(null);

      return true;
    } catch (error) {
      console.error('❌ [useHealthConnectSteps] Initialization error:', error);

      sentryTracker.trackServiceError(
        error instanceof Error ? error : new Error(`Health Connect init failed: ${error}`),
        {
          service: 'useHealthConnectSteps',
          action: 'initialize',
          additional: {
            error: String(error),
            platform: 'android'
          }
        }
      );

      setError('Health Connect initialization failed. Please restart the app.');
      setIsInitialized(false);
      return false;
    }
  }, [isInitialized]);

  // ✅ CRASH-SAFE: Check existing permissions using centralized manager
  const checkExistingPermissions = useCallback(async () => {
    if (!isInitialized) {
      console.log('⚠️ [useHealthConnectSteps] Not initialized, cannot check permissions');
      return false;
    }

    try {
      console.log('🔍 [useHealthConnectSteps] Checking existing permissions via manager...');

      // ✅ CRITICAL: Use manager with delay for stability on first launch
      const hasStepsPermission = await healthConnectManager.hasPermission('Steps', 'read');

      console.log('🔍 [useHealthConnectSteps] Permission check result:', { hasStepsPermission });

      setHasPermissions(hasStepsPermission);
      return hasStepsPermission;
    } catch (error) {
      console.warn('⚠️ [useHealthConnectSteps] Could not check existing permissions:', error);
      // If we can't check permissions, assume we need to request them
      setHasPermissions(false);
      return false;
    }
  }, [isInitialized]);

  // ✅ CRASH-SAFE: Request permissions using centralized manager
  const requestHealthPermissions = useCallback(async () => {
    if (!isInitialized) {
      console.log('⚠️ [useHealthConnectSteps] Not initialized, cannot request permissions');
      setError('Health Connect not initialized');
      return false;
    }

    try {
      console.log('🔐 [useHealthConnectSteps] Requesting permissions via manager...');
      setError(null);

      // ✅ CRITICAL FIX: Check existing permissions first (safely)
      const alreadyHasPermissions = await checkExistingPermissions();
      if (alreadyHasPermissions) {
        console.log('✅ [useHealthConnectSteps] Permissions already granted');
        return true;
      }

      // ✅ CRITICAL: Use manager to request permissions (queued, safe from concurrent calls)
      const success = await healthConnectManager.requestPermissions([
        { accessType: 'read', recordType: 'Steps' },
      ]);

      console.log(`${success ? '✅' : '❌'} [useHealthConnectSteps] Permission request ${success ? 'granted' : 'denied'}`);

      setHasPermissions(success);

      if (success) {
        setError(null);
      } else {
        setError('Steps permission was denied');
      }

      return success;
    } catch (error) {
      console.error('❌ [useHealthConnectSteps] Permission request failed:', error);

      sentryTracker.trackServiceError(
        error instanceof Error ? error : new Error(`Permission request failed: ${error}`),
        {
          service: 'useHealthConnectSteps',
          action: 'requestPermission',
          additional: {
            error: String(error),
            platform: 'android'
          }
        }
      );

      const errorMsg = error instanceof Error ? error.message : String(error);

      // Handle specific errors
      if (errorMsg.includes('not installed')) {
        setError('Health Connect app not installed. Install it from Google Play Store.');
      } else if (errorMsg.includes('lateinit') || errorMsg.includes('delegate')) {
        setError('Health Connect needs app restart. Please close and reopen the app.');
      } else if (errorMsg.includes('SERVICE_BINDING_FAILED')) {
        setError('Health Connect service temporarily unavailable. Please wait and try again.');
      } else {
        setError('Permission request failed. Please try again.');
      }

      setHasPermissions(false);
      return false;
    }
  }, [isInitialized, checkExistingPermissions]);

  // ✅ SIMPLIFIED: Read step data (based on working examples)
  const readStepData = useCallback(async () => {
    if (!isInitialized || !hasPermissions) {
      console.log('⚠️ [Health Connect] Not ready to read data:', { isInitialized, hasPermissions });
      setIsLoading(false);
      return;
    }

    try {
      // Get the date range based on period filter
      const periodRange = getPeriodRange(period, date);

      // ✅ CRITICAL FIX: Preserve calendar day across timezone conversions
      // Extract calendar dates from the period range
      const startYear = periodRange.startDate.getFullYear();
      const startMonth = periodRange.startDate.getMonth();
      const startDay = periodRange.startDate.getDate();
      const startHour = periodRange.startDate.getHours();
      const startMinute = periodRange.startDate.getMinutes();
      const startSecond = periodRange.startDate.getSeconds();
      const startMs = periodRange.startDate.getMilliseconds();

      const endYear = periodRange.endDate.getFullYear();
      const endMonth = periodRange.endDate.getMonth();
      const endDay = periodRange.endDate.getDate();
      const endHour = periodRange.endDate.getHours();
      const endMinute = periodRange.endDate.getMinutes();
      const endSecond = periodRange.endDate.getSeconds();
      const endMs = periodRange.endDate.getMilliseconds();

      // Create UTC dates that preserve the same calendar date and time
      const utcStartDate = new Date(Date.UTC(startYear, startMonth, startDay, startHour, startMinute, startSecond, startMs));
      const utcEndDate = new Date(Date.UTC(endYear, endMonth, endDay, endHour, endMinute, endSecond, endMs));

      const timeRangeFilter: TimeRangeFilter = {
        operator: 'between',
        startTime: utcStartDate.toISOString(),
        endTime: utcEndDate.toISOString(),
      };

      console.log(`🏃 [Health Connect] Reading steps for ${period}`, {
        periodRange: {
          start: periodRange.startDate.toISOString(),
          end: periodRange.endDate.toISOString(),
        },
        queryRange: {
          start: utcStartDate.toISOString(),
          end: utcEndDate.toISOString(),
        },
        calendarDates: {
          start: `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
          end: `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
        },
      });

      const aggregateResult = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter,
      });

      // ✅ REAL-DEVICE DEBUG: Capture raw API response for verification
      setDebugData({
        recordType: 'Steps',
        rawResponse: aggregateResult,
        responseKeys: aggregateResult ? Object.keys(aggregateResult) : [],
        timestamp: new Date().toISOString(),
      });

      // Extract steps from result
      const totalSteps = typeof aggregateResult?.COUNT_TOTAL === 'number' ? aggregateResult.COUNT_TOTAL : 0;

      console.log(`✅ [Health Connect] Read ${totalSteps} steps for ${period}`);
      setSteps(totalSteps);
      setError(null);
    } catch (error) {
      console.error('❌ [Health Connect] Failed to read step data:', error);

      sentryTracker.trackServiceError(
        error instanceof Error ? error : new Error(`Failed to read steps: ${error}`),
        {
          service: 'useHealthConnectSteps',
          action: 'readStepData',
          additional: {
            error: String(error),
            platform: 'android',
            period,
            date: date.toISOString(),
            hasPermissions
          }
        }
      );

      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('permission') || errorMsg.includes('not granted')) {
        setError('Permission denied. Please grant Health Connect permissions.');
        setHasPermissions(false);
      } else {
        setError('Failed to read step data. Please try again.');
      }
      
      setSteps(0);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, hasPermissions, date, period]);

  // ✅ SIMPLIFIED: Main initialization flow (based on working examples)
  useEffect(() => {
    if (Platform.OS !== 'android') {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await initializeHealthConnect();

        // ✅ CRITICAL FIX: Auto-check permissions after initialization
        // This ensures we know the permission state and can fetch data if already granted
        console.log('🔍 [useHealthConnectSteps] Auto-checking existing permissions...');
        const hasExisting = await checkExistingPermissions();

        if (hasExisting) {
          console.log('✅ [useHealthConnectSteps] Permissions already granted, data will be fetched');
          // Data will be fetched by the hasPermissions useEffect
        } else {
          console.log('⚠️ [useHealthConnectSteps] No permissions found - user needs to grant them');
        }

      } catch (error) {
        console.error('Initialization error:', error);
        setError('Failed to initialize Health Connect');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [initializeHealthConnect, checkExistingPermissions]);

  // ✅ SIMPLIFIED: Read step data when ready (based on working examples)
  useEffect(() => {
    if (hasPermissions && isInitialized && Platform.OS === 'android') {
      readStepData();
    }
  }, [hasPermissions, isInitialized, date, period, readStepData]);

  // ✅ CRASH-SAFE: Open Health Connect settings via manager
  const openSettings = useCallback(async () => {
    try {
      await healthConnectManager.openSettings();
    } catch (error) {
      console.error('Error opening Health Connect settings:', error);
    }
  }, []);

  // ✅ LAZY: Check permissions when user first interacts (prevents first-launch crash)
  const lazyPermissionCheck = useCallback(async () => {
    if (!isInitialized) {
      console.log('⚠️ [Health Connect] Not initialized, cannot check permissions');
      return false;
    }

    // Only check if we haven't checked yet
    if (hasPermissions !== false) {
      return hasPermissions;
    }

    console.log('🔍 [Health Connect] Lazy permission check on first user interaction');
    return await checkExistingPermissions();
  }, [isInitialized, hasPermissions, checkExistingPermissions]);

  // ✅ SIMPLIFIED: Retry function for manual permission request
  const retryPermissionRequest = useCallback(async () => {
    if (!isInitialized) {
      setError('Health Connect is not properly initialized. Please restart the app.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // First, do a lazy check to see if permissions already exist
      const alreadyHasPermissions = await lazyPermissionCheck();
      if (alreadyHasPermissions) {
        console.log('✅ [Health Connect] Permissions already exist, reading data');
        await readStepData();
        return;
      }

      // If no permissions, request them
      const success = await requestHealthPermissions();
      if (success) {
        await readStepData();
      }
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, lazyPermissionCheck, requestHealthPermissions, readStepData]);

  return {
    steps,
    isLoading,
    error,
    hasPermissions,
    isHealthConnectAvailable: isInitialized,
    openSettings,
    requestPermissions: retryPermissionRequest,
    // Debug information
    debug: {
      isInitialized,
      isInitializing: false, // Removed isInitializing state
      apiResponse: debugData, // ✅ Raw API response for real-device debugging
    },
  };
};