/**
 * useStepCounter - iOS HealthKit Implementation
 *
 * iOS-specific step counter using HealthKit API
 * Completely separated from Android implementation
 *
 * Features:
 * - Type-safe Promise-based queries
 * - Comprehensive error handling
 * - Automatic data sanitization
 * - Support for daily/weekly/monthly aggregation
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
import { healthKitDebugCollector } from '../../utils/HealthKitDebugCollector';

interface UseStepCounterParams {
  date?: Date;
  period?: PeriodFilter;
  /** Maximum number of samples to fetch (default: 10000) */
  limit?: number;
  /** Include manually entered data (default: false - device data only) */
  includeUserEntered?: boolean;
}

/**
 * iOS HealthKit step counter hook (OPTIMIZED)
 * 
 * @example
 * ```typescript
 * // Basic usage (device-measured data only)
 * const { steps, sampleCount } = useStepCounter({ period: 'today' });
 * 
 * // Include manually entered data
 * const { steps } = useStepCounter({ period: 'week', includeUserEntered: true });
 * ```
 */
export const useStepCounter = (params: UseStepCounterParams = {}): HealthDataHookReturn<number> & {
  steps: number;
  sampleCount: number;
} => {
  const { 
    date = new Date(), 
    period = 'today',
    limit = 10000,  // Prevent memory issues with large datasets
    includeUserEntered = false,  // Default to device-measured data only
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
    isRequesting,
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

    // ✅ CRITICAL FIX: Keep loading while checking authorization status
    // This prevents showing "NOT_AUTHORIZED" error while still checking if permission exists
    if (isRequesting) {
      setIsLoading(true);
      setError(null);
      if (__DEV__) {
        console.log('⏳ [useStepCounter.ios] Waiting for authorization status check...');
      }
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

    // 🚨 CRITICAL FIX: Authorization Readiness Gate
    //
    // PROBLEM: iOS HealthKit authorization is optimistic (hasRequestedPermission flag)
    // After the flag is set, iOS still needs time to propagate authorization internally
    // If we query immediately, HealthKit returns empty or fails silently
    //
    // SOLUTION: Add a small delay (100ms) to ensure iOS authorization is ready
    // This is much smaller than the main 2-second delay because that already happened
    // This is just a final safety gate to ensure the hook re-runs AFTER iOS is ready
    //
    // TIMING: 100ms is sufficient here because the main 2.5s delay already passed
    // This prevents the race condition where the hook re-runs during the delay period
    let authReadinessTimer: NodeJS.Timeout | null = null;

    const fetchSteps = async () => {
      const queryStartTime = Date.now(); // ✅ Start timing for debug

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

        // ✅ PERFORMANCE OPTIMIZATION: Use statistics API for large datasets
        // This is more efficient than fetching individual samples for aggregation
        let useStatisticsAPI = period === 'month' || period === 'week';

        let totalSteps = 0;
        let sampleCount = 0;
        let usedStats: boolean = false;

        // Guard against simulator
        if (!Device.isDevice) {
          setError('NOT_AVAILABLE');
          setIsLoading(false);
          return;
        }

        // Dynamically import HealthKit functions at runtime on real devices only
        const hk = require('@kingstinct/react-native-healthkit');
        const { queryStatisticsCollectionForQuantity, queryQuantitySamples } = hk;

        if (useStatisticsAPI) {
          // ✅ OPTIMIZED: Use statistics collection for better performance
          // Note: Statistics API may not be available in all versions, fallback to samples
          try {
            // ✅ CRITICAL FIX: Add date range filter (confirmed from Swift impl line 320-334)
            const stats = await queryStatisticsCollectionForQuantity(
              HKQuantityType.stepCount,
              ['cumulativeSum'],
              periodRange.startDate.toISOString(),
              { day: 1 }, // Daily intervals
              {
                filter: {
                  startDate: periodRange.startDate,
                  endDate: periodRange.endDate,
                },
              }
            );

            // Aggregate statistics results
            // ✅ FIX: Access sumQuantity.quantity instead of cumulativeSum
            // The statistics API returns QueryStatisticsResponse[] where each stat has:
            // - sumQuantity: { quantity: number, unit: string }
            totalSteps = stats.reduce((sum: number, stat: any) => {
              const value = stat?.sumQuantity?.quantity || 0;
              return sum + value;
            }, 0);
            
            sampleCount = stats.length;

            if (__DEV__) {
              console.log('📊 [iOS] Used statistics API for performance:', {
                period,
                totalSteps,
                sampleCount,
                statsCount: stats.length,
              });
            }
            usedStats = true;

            // ✅ DEBUG: Record statistics query
            healthKitDebugCollector.recordQuery({
              hookName: 'useStepCounter.ios',
              queryType: 'statistics',
              queryDuration: Date.now() - queryStartTime,
              rawResponse: stats,
              processedData: { totalSteps, sampleCount },
              metadata: {
                dateRange: {
                  start: periodRange.startDate.toISOString(),
                  end: periodRange.endDate.toISOString(),
                },
                sampleCount: stats.length,
                dataPoints: sampleCount,
                queryParams: { period, includeUserEntered, limit },
              },
            });
          } catch (statsError) {
            // Fallback to individual samples if statistics API fails
            if (__DEV__) {
              console.warn('⚠️ [iOS] Statistics API failed, falling back to samples:', statsError);
            }
            useStatisticsAPI = false; // Force fallback
          }
        }
        
        if (!useStatisticsAPI) {
          // ✅ FALLBACK: Use individual samples for daily data (more detailed)
          const userEnteredFilter = includeUserEntered ? {} : {
            withMetadataKey: 'HKWasUserEntered',
            operatorType: 'notEqualTo' as const,
            value: true,
          };

          const samples = await queryQuantitySamples(
            HKQuantityType.stepCount,
            {
              filter: {
                startDate: periodRange.startDate,
                endDate: periodRange.endDate,
                ...userEnteredFilter,  // Only device-measured data by default
              },
              limit,  // Prevent fetching too much data (performance optimization)
              ascending: false,  // Most recent data first
            }
          );

          // Handle empty results gracefully
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
          totalSteps = aggregateHealthSamples(
            samples,
            (sample: any) => sample.quantity
          );
          sampleCount = samples.length;

          // ✅ DEBUG: Record samples query
          healthKitDebugCollector.recordQuery({
            hookName: 'useStepCounter.ios',
            queryType: 'samples',
            queryDuration: Date.now() - queryStartTime,
            rawResponse: samples,
            processedData: { totalSteps, sampleCount },
            metadata: {
              dateRange: {
                start: periodRange.startDate.toISOString(),
                end: periodRange.endDate.toISOString(),
              },
              sampleCount: samples.length,
              dataPoints: sampleCount,
              queryParams: { period, includeUserEntered, limit },
            },
          });
        }

        // ✅ Handle empty results gracefully
        if (totalSteps === 0 && sampleCount === 0) {
          if (__DEV__) {
            console.log('📊 No step data found for period');
          }
          setSteps(0);
          setSampleCount(0);
          setError(null);  // Not an error, just no data
          setIsLoading(false);
          return;
        }

        logHealthKitSuccess(
          { hook: 'useStepCounter.ios', action: 'fetchSteps' },
          {
            period,
            steps: totalSteps,
            sampleCount,
            includeUserEntered,
            usedStatisticsAPI: usedStats || useStatisticsAPI || false,
          }
        );

        setSteps(totalSteps);
        setSampleCount(sampleCount);
        setError(null);

      } catch (err) {
        // ✅ DEBUG: Record error
        const periodRange = getPeriodRange(period, date);
        healthKitDebugCollector.recordQuery({
          hookName: 'useStepCounter.ios',
          queryType: 'samples', // Best guess for error case
          queryDuration: Date.now() - queryStartTime,
          error: err,
          metadata: {
            dateRange: {
              start: periodRange.startDate.toISOString(),
              end: periodRange.endDate.toISOString(),
            },
            queryParams: { period, includeUserEntered, limit },
          },
        });

        // ✅ ENHANCED: Better error handling for iOS-specific edge cases
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

        // ✅ iOS READ-ONLY FIX: Distinguish between authorization errors and data errors
        // This prevents false "NOT_AUTHORIZED" messages when user actually granted permission
        if (err && typeof err === 'object' && 'message' in err) {
          const errorMessage = (err as Error).message.toLowerCase();

          if (errorMessage.includes('not available') || errorMessage.includes('unavailable')) {
            setError('NOT_AVAILABLE');
          } else if (
            errorMessage.includes('not authorized') ||
            errorMessage.includes('permission denied') ||
            errorMessage.includes('authorization denied') ||
            errorMessage.includes('authorization status')
          ) {
            // ✅ REAL authorization error - user explicitly denied permission
            setError('NOT_AUTHORIZED');
            if (__DEV__) {
              console.error('🚫 [iOS] Authorization denied by user:', errorMessage);
            }
          } else if (
            errorMessage.includes('no data') ||
            errorMessage.includes('empty') ||
            errorMessage.includes('no samples') ||
            errorMessage.includes('no results')
          ) {
            // ✅ Not an error - permission granted but no data available
            // This is normal for new users or periods with no activity
            setSteps(0);
            setSampleCount(0);
            setError(null);
            setIsLoading(false);
            if (__DEV__) {
              console.log('📊 [iOS] Permission granted, no data available for period');
            }
            return;
          } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            setError('TIMEOUT');
          } else {
            // Other errors (network, HealthKit service, etc.)
            setError(errorType);
          }
        } else {
          setError(errorType);
        }

        setSteps(0);
        setSampleCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    // 🚨 CRITICAL: Add delay before fetching to ensure iOS authorization is propagated
    // This is a secondary safety gate - the primary 2.5s delay happens in the dashboard
    // This 100ms delay catches the edge case where the hook re-runs during authorization
    if (__DEV__) {
      console.log('🕐 [useStepCounter.ios] Scheduling data fetch with 100ms readiness delay');
    }

    authReadinessTimer = setTimeout(() => {
      if (__DEV__) {
        console.log('✅ [useStepCounter.ios] Authorization readiness gate passed - fetching steps');
      }
      fetchSteps();
    }, 100);

    // Cleanup: Cancel timer if component unmounts or dependencies change
    return () => {
      if (authReadinessTimer) {
        clearTimeout(authReadinessTimer);
        if (__DEV__) {
          console.log('🧹 [useStepCounter.ios] Cleaned up readiness timer');
        }
      }
    };
  }, [isAuthorized, isAvailable, date, period, permissionError, limit, includeUserEntered, isRequesting]);

  return {
    steps,
    sampleCount,
    data: steps,
    isLoading,
    error,
    hasPermissions: isAuthorized,
    requestPermissions,
  };
};
