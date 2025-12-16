/**
 * useStepCounter - iOS HealthKit Implementation (OPTIMIZED)
 *
 * ✅ IMPROVEMENTS OVER ORIGINAL:
 * - Added query limits to prevent memory issues
 * - Added user-entered data filtering for accuracy
 * - Added ascending/descending control
 * - Better error messages
 * - Performance optimizations
 *
 * Based on official @kingstinct/react-native-healthkit example patterns
 */

import { useEffect, useState } from 'react';
import * as Device from 'expo-device';
import {
  handleHealthKitError,
  validateDateRange,
  aggregateHealthSamples,
  logHealthKitSuccess,
} from '../../utils/healthKitUtils';
import { useHealthKitPermissions } from './useHealthKitPermissions';
import { HKQuantityType } from '../../constants/healthKitTypes';
import type { PeriodFilter } from '../../types/health';
import { getPeriodRange } from '../../types/health';
import type { HealthKitErrorType, HealthDataHookReturn } from '../../types/healthKit';

interface UseStepCounterParams {
  date?: Date;
  period?: PeriodFilter;
  /** Maximum number of samples to fetch (default: 10000) */
  limit?: number;
  /** Include manually entered data (default: false) */
  includeUserEntered?: boolean;
  /** Sort order (default: false = most recent first) */
  ascending?: boolean;
}

interface UseStepCounterReturn extends HealthDataHookReturn<number> {
  steps: number;
  sampleCount: number;  // ✅ NEW: Number of samples used in calculation
}

/**
 * iOS HealthKit step counter hook (OPTIMIZED)
 * 
 * @example
 * ```typescript
 * // Basic usage (device-measured data only)
 * const { steps, isLoading, error } = useStepCounter({ 
 *   date: new Date(), 
 *   period: 'today' 
 * });
 * 
 * // Include manually entered data
 * const { steps } = useStepCounter({ 
 *   period: 'week',
 *   includeUserEntered: true 
 * });
 * 
 * // Custom query limits for performance
 * const { steps } = useStepCounter({ 
 *   period: 'month',
 *   limit: 5000 
 * });
 * ```
 */
export const useStepCounter = (params: UseStepCounterParams = {}): UseStepCounterReturn => {
  const { 
    date = new Date(), 
    period = 'today',
    limit = 10000,  // ✅ Default limit to prevent memory issues
    includeUserEntered = false,  // ✅ Default to device-measured data only
    ascending = false,  // ✅ Most recent first
  } = params;

  // State
  const [steps, setSteps] = useState<number>(0);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HealthKitErrorType | null>(null);

  // HealthKit permissions
  const {
    isAuthorized,
    isAvailable,
    error: permissionError,
    requestPermissions,
  } = useHealthKitPermissions({
    permissions: [HKQuantityType.stepCount],
    hookName: 'useStepCounter.ios',
  });

  // Fetch steps data when authorized
  useEffect(() => {
    if (!isAvailable) {
      setIsLoading(false);
      setError('NOT_AVAILABLE');
      return;
    }

    if (!isAuthorized) {
      setIsLoading(false);
      if (permissionError) {
        setError(permissionError);
      } else {
        setError('NOT_AUTHORIZED');
      }
      return;
    }

    const fetchSteps = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const periodRange = getPeriodRange(period, date);
        const validation = validateDateRange(periodRange.startDate, periodRange.endDate);
        
        if (!validation.valid) {
          setError(validation.error!);
          setIsLoading(false);
          return;
        }

        if (__DEV__) {
          console.log('🏃 [iOS] Fetching steps:', {
            period,
            from: periodRange.startDate.toISOString(),
            to: periodRange.endDate.toISOString(),
            includeUserEntered,
            limit,
          });
        }

        // ✅ Build filter with optional user-entered data exclusion
        const userEnteredFilter = includeUserEntered ? {} : {
          withMetadataKey: 'HKWasUserEntered',
          operatorType: 'notEqualTo' as const,
          value: true,
        };

        // Guard against simulator
        if (!Device.isDevice) {
          setError('NOT_AVAILABLE');
          setIsLoading(false);
          return;
        }

        // ✅ Query step count samples from HealthKit with optimizations
        const { queryQuantitySamples } = require('@kingstinct/react-native-healthkit');
        const samples = await queryQuantitySamples(
          HKQuantityType.stepCount,
          {
            filter: {
              startDate: periodRange.startDate,
              endDate: periodRange.endDate,
              ...userEnteredFilter,
            },
            limit,  // ✅ Prevent fetching too much data
            ascending,  // ✅ Control sort order
          }
        );

        // ✅ Handle empty results gracefully
        if (!samples || samples.length === 0) {
          if (__DEV__) {
            console.log('📊 No step data found for period');
          }
          setSteps(0);
          setSampleCount(0);
          setError(null);  // Not an error, just no data
          setIsLoading(false);
          return;
        }

        // Aggregate samples
        const totalSteps = aggregateHealthSamples(
          samples,
          (sample: any) => sample.quantity
        );

        logHealthKitSuccess(
          { hook: 'useStepCounter.ios', action: 'fetchSteps' },
          {
            period,
            steps: totalSteps,
            sampleCount: samples.length,
            includeUserEntered,
          }
        );

        setSteps(totalSteps);
        setSampleCount(samples.length);
        setError(null);

      } catch (err) {
        const errorType = handleHealthKitError(err, {
          hook: 'useStepCounter.ios',
          action: 'fetchSteps',
          additional: { 
            period, 
            date: date.toISOString(),
            includeUserEntered,
            limit,
          },
        });

        setError(errorType);
        setSteps(0);
        setSampleCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSteps();
  }, [
    isAuthorized, 
    isAvailable, 
    date, 
    period, 
    permissionError,
    limit,  // ✅ Re-fetch if limit changes
    includeUserEntered,  // ✅ Re-fetch if filter changes
    ascending,  // ✅ Re-fetch if sort changes
  ]);

  return {
    steps,
    sampleCount,  // ✅ NEW: Expose sample count for debugging
    data: steps,
    isLoading,
    error,
    hasPermissions: isAuthorized,
    requestPermissions,
  };
};

