/**
 * useCalories - iOS HealthKit Implementation
 *
 * iOS-specific energy tracking using HealthKit API
 * Queries BOTH active and basal energy for total calories (parity with Android)
 * Completely separated from Android implementation
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

interface UseCaloriesParams {
  date?: Date;
  period?: PeriodFilter;
}

/**
 * iOS HealthKit calories hook
 * Returns TOTAL energy burned (active + basal) for the period
 * Matches Android's TotalCaloriesBurned behavior
 */
export const useCalories = (params: UseCaloriesParams = {}): HealthDataHookReturn<number> & {
  calories: number;
  activeCalories?: number;
  basalCalories?: number;
} => {
  const { date = new Date(), period = 'today' } = params;

  const [calories, setCalories] = useState<number>(0);
  const [activeCalories, setActiveCalories] = useState<number>(0);
  const [basalCalories, setBasalCalories] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HealthKitErrorType | null>(null);

  // iOS - HealthKit permissions for BOTH active and basal energy
  const {
    isAuthorized,
    isAvailable,
    error: permissionError,
    requestPermissions,
    isRequesting,
  } = useHealthKitPermissions({
    permissions: [HKQuantityType.activeEnergyBurned, HKQuantityType.basalEnergyBurned],
    hookName: 'useCalories',
  });

  // iOS - Fetch calories data
  useEffect(() => {
    if (!isAvailable) {
      setIsLoading(false);
      return;
    }

    // ✅ CRITICAL FIX: Keep loading while checking authorization status
    if (isRequesting) {
      setIsLoading(true);
      setError(null);
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

    const fetchCalories = async () => {
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
          console.log('🔥 Fetching iOS energy (active + basal):', {
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

        // Dynamically import HealthKit functions at runtime on real devices only
        const hk = require('@kingstinct/react-native-healthkit');
        const { queryQuantitySamples } = hk;

        // Query BOTH active and basal energy in parallel for total calories
        const [activeSamples, basalSamples] = await Promise.all([
          queryQuantitySamples(
            HKQuantityType.activeEnergyBurned,
            {
              filter: {
                startDate: periodRange.startDate,
                endDate: periodRange.endDate,
              },
            }
          ),
          queryQuantitySamples(
            HKQuantityType.basalEnergyBurned,
            {
              filter: {
                startDate: periodRange.startDate,
                endDate: periodRange.endDate,
              },
            }
          ),
        ]);

        // Aggregate both types of samples
        const activeEnergy = aggregateHealthSamples(
          activeSamples,
          (sample: any) => sample.quantity
        );

        const basalEnergy = aggregateHealthSamples(
          basalSamples,
          (sample: any) => sample.quantity
        );

        // Calculate total (active + basal) for parity with Android's TotalCaloriesBurned
        const totalEnergy = activeEnergy + basalEnergy;

        // Log success
        logHealthKitSuccess(
          { hook: 'useCalories', action: 'fetchCalories' },
          {
            period,
            totalCalories: totalEnergy,
            activeCalories: activeEnergy,
            basalCalories: basalEnergy,
            activeSampleCount: activeSamples?.length || 0,
            basalSampleCount: basalSamples?.length || 0,
          }
        );

        setCalories(totalEnergy);
        setActiveCalories(activeEnergy);
        setBasalCalories(basalEnergy);
        setError(null);

      } catch (error) {
        const errorType = handleHealthKitError(error, {
          hook: 'useCalories',
          action: 'fetchCalories',
          additional: {
            period,
            date: date.toISOString(),
          },
        });

        setError(errorType);
        setCalories(0);
        setActiveCalories(0);
        setBasalCalories(0);

      } finally {
        setIsLoading(false);
      }
    };

    fetchCalories();
  }, [isAuthorized, isAvailable, date, period, permissionError]);

  return {
    calories,
    activeCalories,
    basalCalories,
    data: calories,
    isLoading,
    error,
    hasPermissions: isAuthorized,
    requestPermissions,
  };
};

