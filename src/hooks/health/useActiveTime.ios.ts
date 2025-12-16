/**
 * useActiveTime - iOS HealthKit Implementation
 *
 * iOS-specific workout/exercise time tracking using HealthKit API
 * Completely separated from Android implementation
 */

import { useEffect, useState } from 'react';
import * as Device from 'expo-device';
import {
  handleHealthKitError,
  validateDateRange,
  sanitizeHealthValue,
  logHealthKitSuccess,
} from '../../utils/healthKitUtils';
import { useHealthKitPermissions } from './useHealthKitPermissions';
import { HKQuantityType } from '../../constants/healthKitTypes';
import type { PeriodFilter } from '../../types/health';
import { getPeriodRange } from '../../types/health';
import type { HealthKitErrorType, HealthDataHookReturn } from '../../types/healthKit';

interface UseActiveTimeParams {
  date?: Date;
  period?: PeriodFilter;
}

/**
 * iOS HealthKit active time hook
 * Returns total workout/exercise time for the period
 */
export const useActiveTime = (params: UseActiveTimeParams = {}): HealthDataHookReturn<number> & {
  activeMinutes: number;
  activeHours: number;
} => {
  const { date = new Date(), period = 'today' } = params;

  const [activeMinutes, setActiveMinutes] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HealthKitErrorType | null>(null);

  // iOS - HealthKit permissions (using AppleExerciseTime quantity type)
  const {
    isAuthorized,
    isAvailable,
    error: permissionError,
    requestPermissions,
  } = useHealthKitPermissions({
    permissions: [HKQuantityType.appleExerciseTime],
    hookName: 'useActiveTime',
  });

  // iOS - Fetch active time data
  useEffect(() => {
    if (!isAvailable) {
      setIsLoading(false);
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

    const fetchActiveTime = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const periodRange = getPeriodRange(period, date);

        // Validate date range
        const validation = validateDateRange(periodRange.startDate, periodRange.endDate);
        if (!validation.valid) {
          setError(validation.error!);
          setIsLoading(false);
          return;
        }

        if (__DEV__) {
          console.log('🏃 Fetching iOS workouts:', {
            period,
            from: periodRange.startDate.toISOString(),
            to: periodRange.endDate.toISOString(),
          });
        }

        // Guard against simulator
        if (!Device.isDevice) {
          setError('NOT_AVAILABLE');
          setIsLoading(false);
          return;
        }

        // Query workout data (use AppleExerciseTime quantity samples instead)
        const { queryQuantitySamples } = require('@kingstinct/react-native-healthkit');
        const samples = await queryQuantitySamples(
          HKQuantityType.appleExerciseTime,
          {
            filter: {
              startDate: periodRange.startDate,
              endDate: periodRange.endDate,
            },
          }
        );

        // Handle no data gracefully
        if (!samples || samples.length === 0) {
          if (__DEV__) {
            console.log('No active time data available for period');
          }
          setActiveMinutes(0);
          setError(null); // No data is not an error
          setIsLoading(false);
          return;
        }

        // Sum all exercise time samples (quantity is in minutes)
        const totalMinutes = (samples as any[]).reduce((sum: number, sample: any) => {
          const minutes = sanitizeHealthValue(sample.quantity, {
            maxValue: 1440, // Max 24 hours per day
          });
          return sum + (minutes ?? 0);
        }, 0);

        // Log success
        logHealthKitSuccess(
          { hook: 'useActiveTime', action: 'fetchExerciseTime' },
          {
            period,
            minutes: totalMinutes,
            sampleCount: samples.length,
          }
        );

        setActiveMinutes(totalMinutes);
        setError(null);

      } catch (error) {
        const errorType = handleHealthKitError(error, {
          hook: 'useActiveTime',
          action: 'fetchWorkouts',
          additional: {
            period,
            date: date.toISOString(),
          },
        });

        setError(errorType);
        setActiveMinutes(0);

      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveTime();
  }, [isAuthorized, isAvailable, date, period, permissionError]);

  // Calculate hours from minutes
  const activeHours = activeMinutes / 60;

  return {
    activeMinutes,
    activeHours,
    data: activeMinutes,
    isLoading,
    error,
    hasPermissions: isAuthorized,
    requestPermissions,
  };
};

