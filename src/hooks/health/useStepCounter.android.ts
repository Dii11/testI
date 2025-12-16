/**
 * useStepCounter - Android Health Connect Implementation
 *
 * Android-specific step counter using Health Connect API
 * Completely separated from iOS implementation
 *
 * Features:
 * - Health Connect integration
 * - Comprehensive error handling
 * - Support for daily/weekly/monthly aggregation
 *
 * 🔍 DEBUG: This is the ANDROID-SPECIFIC implementation (.android.ts file)
 */

import type { PeriodFilter } from '../../types/health';
import type { HealthKitErrorType, HealthDataHookReturn } from '../../types/healthKit';
import { useHealthConnectSteps } from './useHealthConnectSteps';

interface UseStepCounterParams {
  date?: Date;
  period?: PeriodFilter;
}

/**
 * Android Health Connect step counter hook
 *
 * 🔍 VERIFICATION: If you see this in your debug logs, the .android.ts file is being used correctly!
 */
export const useStepCounter = (params: UseStepCounterParams = {}): HealthDataHookReturn<number> & {
  steps: number;
  openSettings?: () => Promise<void>;
  androidData?: unknown;
  __platformFile?: string; // Debug marker to verify correct file is loaded
} => {
  const { date = new Date(), period = 'today' } = params;

  // 🔍 DEBUG: Log when Android file is used
  if (__DEV__) {
    console.log('✅ [useStepCounter] ANDROID FILE (.android.ts) is being used');
  }

  // Use existing Health Connect implementation
  const androidHealthData = useHealthConnectSteps({ date, period });

  return {
    steps: androidHealthData?.steps || 0,
    data: androidHealthData?.steps || 0,
    isLoading: androidHealthData?.isLoading ?? true,
    error: androidHealthData?.error as HealthKitErrorType | null,
    hasPermissions: androidHealthData?.hasPermissions ?? false,
    requestPermissions: androidHealthData?.requestPermissions || (async () => {}),
    openSettings: androidHealthData?.openSettings,
    androidData: {
      sdkStatus: (androidHealthData as any)?.sdkStatus,
      isHealthConnectAvailable: androidHealthData?.isHealthConnectAvailable ?? false,
      isInitialized: androidHealthData?.debug?.isInitialized ?? false,
      isInitializing: false, // ✅ SIMPLIFIED: Removed isInitializing state
    },
    __platformFile: 'useStepCounter.android.ts', // 🔍 Verification marker
  };
};
