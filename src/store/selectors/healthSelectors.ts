import { createSelector } from '@reduxjs/toolkit';

import type { HealthMetric, AnyMetricGroup, HealthDataCollection } from '../../types/health';
import { HealthDataType, CORE_HEALTH_DATA_TYPES } from '../../types/health';
import type { RootState } from '../index';

// Base selector for health state
const selectHealthState = (state: RootState) => state.health;

// Core selectors
export const selectHealthMetrics = createSelector([selectHealthState], health => health.healthData);

export const selectHealthLoading = createSelector([selectHealthState], health => health.isLoading);

export const selectHealthError = createSelector([selectHealthState], health => health.error);

export const selectHealthPermissions = createSelector(
  [selectHealthState],
  health => health.permissions
);

export const selectLastSync = createSelector([selectHealthState], health => health.lastSync);

export const selectIsInitializing = createSelector(
  [selectHealthState],
  health => health.isInitializing
);

// Steps data selectors
export const selectStepsData = createSelector([selectHealthMetrics], healthData => ({
  today: healthData.steps.today,
  goal: healthData.steps.goal,
  progress: healthData.steps.progress,
  latest: healthData.steps.latest,
  daily: healthData.steps.daily,
  trend: healthData.steps.trend,
}));

export const selectStepsProgress = createSelector([selectStepsData], stepsData => ({
  current: stepsData.today,
  goal: stepsData.goal,
  percentage: Math.min((stepsData.today / stepsData.goal) * 100, 100),
  remaining: Math.max(stepsData.goal - stepsData.today, 0),
}));

// Heart rate selectors
export const selectHeartRateData = createSelector([selectHealthMetrics], healthData => ({
  latest: healthData.heartRate.latest,
  daily: healthData.heartRate.daily,
  trend: healthData.heartRate.trend,
}));

export const selectLatestHeartRate = createSelector(
  [selectHeartRateData],
  heartRateData => heartRateData.latest?.value ?? null
);

// Sleep data selectors
export const selectSleepData = createSelector([selectHealthMetrics], healthData => ({
  lastNight: healthData.sleep.lastNight,
  averageDuration: healthData.sleep.averageDuration,
  latest: healthData.sleep.latest,
  daily: healthData.sleep.daily,
  trend: healthData.sleep.trend,
}));

export const selectLastNightSleep = createSelector([selectSleepData], sleepData => {
  if (!sleepData.lastNight) return null;

  const duration = sleepData.lastNight.duration;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  return {
    ...sleepData.lastNight,
    formattedDuration: `${hours}h ${minutes}m`,
    hours,
    minutes,
  };
});

// Vital signs selectors
export const selectLatestVitals = createSelector([selectHealthMetrics], healthData => ({
  heartRate: healthData.heartRate.latest?.value ?? null,
  oxygenSaturation: healthData.oxygenSaturation.latest?.value ?? null,
  temperature: healthData.bodyTemperature.latest?.value ?? null,
  bloodPressure: healthData.bloodPressure.latest?.value ?? null,
}));

// Blood pressure selectors
export const selectBloodPressureData = createSelector([selectHealthMetrics], healthData => ({
  latest: healthData.bloodPressure.latest,
  daily: healthData.bloodPressure.daily,
  trend: healthData.bloodPressure.trend,
}));

// Weight data selectors
export const selectWeightData = createSelector([selectHealthMetrics], healthData => ({
  latest: healthData.weight.latest,
  daily: healthData.weight.daily,
  trend: healthData.weight.trend,
}));

// Calories burned selectors
export const selectCaloriesData = createSelector([selectHealthMetrics], healthData => ({
  latest: healthData.caloriesBurned.latest,
  daily: healthData.caloriesBurned.daily,
  trend: healthData.caloriesBurned.trend,
}));

// Aggregated dashboard data selector
export const selectDashboardMetrics = createSelector(
  [selectStepsData, selectLatestHeartRate, selectLastNightSleep, selectCaloriesData],
  (stepsData, heartRate, sleepData, caloriesData) => ({
    steps: {
      today: stepsData.today,
      goal: stepsData.goal,
      progress: stepsData.progress,
    },
    heartRate,
    sleep: sleepData
      ? {
          duration: sleepData.formattedDuration,
          hours: sleepData.hours,
          minutes: sleepData.minutes,
          quality: sleepData.quality,
        }
      : null,
    calories: caloriesData.latest?.value ?? null,
  })
);

// Health trends selector
export const selectHealthTrends = createSelector([selectHealthMetrics], healthData => ({
  heartRate: healthData.heartRate.trend,
  steps: healthData.steps.trend,
  sleep: healthData.sleep.trend,
  weight: healthData.weight.trend,
  bloodPressure: healthData.bloodPressure.trend,
  oxygenSaturation: healthData.oxygenSaturation.trend,
  bodyTemperature: healthData.bodyTemperature.trend,
  bloodGlucose: healthData.bloodGlucose.trend,
  caloriesBurned: healthData.caloriesBurned.trend,
}));

// Alerts and insights selectors
export const selectHealthAlerts = createSelector([selectHealthState], health => health.alerts);

export const selectUnreadAlerts = createSelector([selectHealthAlerts], alerts =>
  alerts.filter(alert => !alert.isRead)
);

export const selectHealthInsights = createSelector([selectHealthState], health => health.insights);

export const selectHealthGoals = createSelector([selectHealthState], health => health.goals);

// Sync status selectors
export const selectSyncStatus = createSelector([selectHealthState], health => health.syncStatus);

export const selectIsSyncing = createSelector(
  [selectSyncStatus],
  syncStatus => !syncStatus.isOnline && syncStatus.pendingUploads > 0
);

// Health permissions selectors
export const selectHealthPermissionsGranted = createSelector(
  [selectHealthPermissions],
  permissions => permissions.granted
);

export const selectHealthPermissionDetails = createSelector(
  [selectHealthPermissions],
  permissions => permissions.details ?? []
);

// Granted health data types (read access confirmed)
export const selectGrantedHealthTypes = createSelector([selectHealthPermissionDetails], details =>
  details.filter(d => d.granted || d.read === true).map(d => d.type as HealthDataType)
);

// Missing (requested in CORE_HEALTH_DATA_TYPES but not granted) — requires lazy import to avoid cycle
export const selectMissingGrantedHealthTypes = createSelector([selectGrantedHealthTypes], granted =>
  CORE_HEALTH_DATA_TYPES.filter(t => !granted.includes(t))
);

// Boolean helper: do we have at least one vital metric granted?
export const selectHasAnyVitalGranted = createSelector([selectGrantedHealthTypes], granted => {
  const vitalSet = new Set<HealthDataType>([
    HealthDataType.HEART_RATE,
    HealthDataType.STEPS,
    HealthDataType.SLEEP,
  ]);
  return granted.some(t => vitalSet.has(t));
});

// Unified permission summary for UI components
export const selectHealthPermissionSummary = createSelector(
  [selectHealthPermissions, selectGrantedHealthTypes, selectMissingGrantedHealthTypes],
  (permissions, granted, missing) => {
    const partiallyGranted =
      (permissions.partiallyGranted ?? false) || (granted.length > 0 && missing.length > 0);
    return {
      granted,
      missing,
      missingCount: missing.length,
      grantedCount: granted.length,
      hasAny: granted.length > 0,
      partiallyGranted,
      allGranted: missing.length === 0 && granted.length > 0,
      requested: permissions.requested,
    } as const;
  }
);

// Metric by type selector (reusable)
export type MetricSelectorResult = AnyMetricGroup | null;

export const selectHealthMetricByType = (dataType: HealthDataType) =>
  createSelector([selectHealthMetrics], (healthData: any): MetricSelectorResult => {
    switch (dataType) {
      case HealthDataType.HEART_RATE:
        return healthData.heartRate;
      case HealthDataType.STEPS:
        return healthData.steps;
      case HealthDataType.SLEEP:
        return healthData.sleep;
      case HealthDataType.WEIGHT:
        return healthData.weight;
      case HealthDataType.BLOOD_PRESSURE:
        return healthData.bloodPressure;
      case HealthDataType.OXYGEN_SATURATION:
        return healthData.oxygenSaturation;
      case HealthDataType.BODY_TEMPERATURE:
        return healthData.bodyTemperature;
      case HealthDataType.BLOOD_GLUCOSE:
        return healthData.bloodGlucose;
      case HealthDataType.CALORIES_BURNED:
        return healthData.caloriesBurned;
      default:
        return null;
    }
  });

// Loading state selectors
export const selectHealthLoadingStates = createSelector([selectHealthState], health => {
  const hasData = Object.values(health.healthData).some(
    metric => metric.latest !== null || metric.daily.length > 0
  );
  const hasError = typeof health.error === 'string' && health.error.trim().length > 0;
  return {
    isLoading: health.isLoading,
    isInitializing: health.isInitializing,
    hasError,
    hasData,
  };
});

// Chart data selectors (for visualization components)
interface ChartPoint {
  x: string;
  y: number;
  metadata?: Record<string, unknown>;
}

export const selectChartData = (dataType: HealthDataType, period: 'daily' | 'weekly' | 'monthly') =>
  createSelector([selectHealthMetricByType(dataType)], (metricData: MetricSelectorResult) => {
    if (!metricData || metricData.daily.length === 0) return [] as ChartPoint[];

    const now = new Date();
    const offsets: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };
    const days = offsets[period] ?? 7;
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const filteredData = metricData.daily.filter(m => {
      const ts: Date = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp);
      return ts >= threshold;
    });

    return filteredData.map<ChartPoint>(m => ({
      x: (m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp)).toISOString(),
      y: m.value,
      metadata: m.metadata,
    }));
  });
