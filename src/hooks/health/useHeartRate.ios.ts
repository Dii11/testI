/**
 * useHeartRate - iOS HealthKit Implementation
 *
 * iOS-specific heart rate tracking using HealthKit API
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

interface UseHeartRateParams {
  date?: Date;
  period?: PeriodFilter;
  /** Maximum number of samples to fetch (default: 1000) */
  limit?: number;
  /** Include manually entered data (default: false - device data only) */
  includeUserEntered?: boolean;
}

/**
 * iOS HealthKit heart rate hook (OPTIMIZED)
 * Returns most recent heart rate value for the period
 * 
 * @example
 * ```typescript
 * // Basic usage (device-measured data only)
 * const { heartRate, sampleCount } = useHeartRate({ period: 'today' });
 * ```
 */
export const useHeartRate = (params: UseHeartRateParams = {}): HealthDataHookReturn<number> & {
  heartRate: number | null;
  sampleCount: number;
} => {
  const { 
    date = new Date(), 
    period = 'today',
    limit = 1000,
    includeUserEntered = false,
  } = params;

  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HealthKitErrorType | null>(null);

  const {
    isAuthorized,
    isAvailable,
    error: permissionError,
    requestPermissions,
  } = useHealthKitPermissions({
    permissions: [HKQuantityType.heartRate],
    hookName: 'useHeartRate.ios',
  });

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

    const fetchHeartRate = async () => {
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
          console.log('❤️ [iOS] Fetching heart rate:', {
            period,
            from: periodRange.startDate.toISOString(),
            to: periodRange.endDate.toISOString(),
            includeUserEntered,
            limit,
          });
        }

        // Build filter with optional user-entered data exclusion (from official example pattern)
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

        // Dynamically import HealthKit functions at runtime on real devices only
        const hk = require('@kingstinct/react-native-healthkit');
        const { queryQuantitySamples } = hk;

        const samples = await queryQuantitySamples(
          HKQuantityType.heartRate,
          {
            filter: {
              startDate: periodRange.startDate,
              endDate: periodRange.endDate,
              ...userEnteredFilter,  // Only device-measured data by default
            },
            limit,
            ascending: false,  // Most recent first
          }
        );

        if (!samples || samples.length === 0) {
          if (__DEV__) {
            console.log('No heart rate data available');
          }
          setHeartRate(null);
          setSampleCount(0);
          setError('NO_DATA');
          setIsLoading(false);
          return;
        }

        // Get most recent sample
        const latestSample = samples[samples.length - 1];
        const heartRateValue = sanitizeHealthValue(latestSample.quantity, {
          maxValue: 300, // Max realistic heart rate
        });

        logHealthKitSuccess(
          { hook: 'useHeartRate.ios', action: 'fetchHeartRate' },
          {
            period,
            heartRate: heartRateValue,
            sampleCount: samples.length,
            includeUserEntered,
          }
        );

        setHeartRate(heartRateValue);
        setSampleCount(samples.length);
        setError(null);

      } catch (err) {
        const errorType = handleHealthKitError(err, {
          hook: 'useHeartRate.ios',
          action: 'fetchHeartRate',
          additional: { 
            period, 
            date: date.toISOString(),
            includeUserEntered,
            limit,
          },
        });

        setError(errorType);
        setHeartRate(null);
        setSampleCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeartRate();
  }, [isAuthorized, isAvailable, date, period, permissionError, limit, includeUserEntered]);

  return {
    heartRate,
    sampleCount,
    data: heartRate,
    isLoading,
    error,
    hasPermissions: isAuthorized,
    requestPermissions,
  };
};
