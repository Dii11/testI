import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { HealthDataService } from '../../services/health/HealthDataService';
import { HealthSyncService } from '../../services/health/HealthSyncService';
import type {
  HealthMetric,
  HealthSyncStatus,
  HealthTrend,
  HealthAlert,
  HealthInsight,
  HealthGoal,
  HealthPermissionState,
} from '../../types/health';
import { HealthDataType, CORE_HEALTH_DATA_TYPES } from '../../types/health';

interface HealthMetricGroup {
  latest: HealthMetric | null;
  daily: HealthMetric[];
  trend: HealthTrend | null;
}

interface HealthState {
  healthData: {
    heartRate: HealthMetricGroup;
    steps: HealthMetricGroup & {
      today: number;
      goal: number;
      progress: number; // percentage
    };
    sleep: HealthMetricGroup & {
      lastNight: {
        duration: number;
        quality: number;
        stages: {
          deep: number;
          light: number;
          rem: number;
          awake: number;
        };
      } | null;
      averageDuration: number;
    };
    weight: HealthMetricGroup;
    bloodPressure: HealthMetricGroup;
    oxygenSaturation: HealthMetricGroup;
    bodyTemperature: HealthMetricGroup;
    bloodGlucose: HealthMetricGroup;
    caloriesBurned: HealthMetricGroup;
  };
  syncStatus: HealthSyncStatus;
  goals: HealthGoal[];
  alerts: HealthAlert[];
  insights: HealthInsight[];
  isLoading: boolean;
  isInitializing: boolean;
  lastSync: string | null;
  error: string | null;
  permissions: HealthPermissionState;
}

const initialHealthMetricGroup = (): HealthMetricGroup => ({
  latest: null,
  daily: [],
  trend: null,
});

const initialState: HealthState = {
  healthData: {
    heartRate: initialHealthMetricGroup(),
    steps: {
      ...initialHealthMetricGroup(),
      today: 0,
      goal: 10000,
      progress: 0,
    },
    sleep: {
      ...initialHealthMetricGroup(),
      lastNight: null,
      averageDuration: 480, // 8 hours in minutes
    },
    weight: initialHealthMetricGroup(),
    bloodPressure: initialHealthMetricGroup(),
    oxygenSaturation: initialHealthMetricGroup(),
    bodyTemperature: initialHealthMetricGroup(),
    bloodGlucose: initialHealthMetricGroup(),
    caloriesBurned: initialHealthMetricGroup(),
  },
  syncStatus: {
    lastSync: null,
    isOnline: false,
    pendingUploads: 0,
    errors: [],
  },
  goals: [],
  alerts: [],
  insights: [],
  isLoading: false,
  isInitializing: false,
  lastSync: null,
  error: null,
  permissions: {
    granted: false,
    requested: false,
    types: [],
    details: [],
    partiallyGranted: false,
  },
};

// Async thunks
export const initializeHealthService = createAsyncThunk(
  'health/initializeHealthService',
  async () => {
    const healthService = HealthDataService.getInstance();
    const isInitialized = await healthService.initialize();

    if (isInitialized) {
      const permissions = await healthService.getPermissions();
      return {
        initialized: true,
        permissions,
      };
    }

    throw new Error('Failed to initialize health service');
  }
);

export const fetchLatestHealthData = createAsyncThunk(
  'health/fetchLatestHealthData',
  async (
    options?: {
      selectedPeriod?: 'Today' | 'This week' | 'This month';
      forceRefresh?: boolean;
      dataTypes?: HealthDataType[];
    },
    { state: any }
  ) => {
    const healthService = HealthDataService.getInstance();

    // Ensure health service is initialized before reading data
    const isInitialized = await healthService.initialize();
    if (!isInitialized) {
      throw new Error('Failed to initialize health service');
    }

    const today = new Date();
    const selectedPeriod = options?.selectedPeriod || 'Today';
    // Base requested types (central source of truth)
    const requestedTypes = options?.dataTypes || CORE_HEALTH_DATA_TYPES;

    // Derive granted permissions if available to avoid SecurityException on unsupported types
    let effectiveTypes = requestedTypes;
    try {
      const rootState = (state as any)?.getState ? (state as any).getState() : state;
      const permDetails: any[] | undefined = rootState?.health?.permissions?.details;
      if (Array.isArray(permDetails) && permDetails.length > 0) {
        const grantedSet = new Set(
          permDetails.filter(d => d.granted || d.read === true).map(d => d.type)
        );
        effectiveTypes = requestedTypes.filter(t => grantedSet.has(t));
        if (effectiveTypes.length === 0) {
          // Fallback: keep at least one to avoid empty loop; choose steps as baseline
          effectiveTypes = [HealthDataType.STEPS];
        }
      }
    } catch (e) {
      // Silent fallback – do not block fetching
    }

    // ✅ OPTIMIZED: Smart date range selection based on actual needs
    let startDate: Date;
    let limit: number;

    switch (selectedPeriod) {
      case 'Today':
        // Need current week for "Today" view (7 days)
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        limit = 500; // Reasonable limit for 7 days of data
        break;
      case 'This week':
        // Need current month for "This week" view (30 days)
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        limit = 1000; // Reasonable limit for 30 days of data
        break;
      case 'This month':
        // Need current year for "This month" view (365 days)
        startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        limit = 2000; // Reasonable limit for 365 days of data
        break;
      default:
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        limit = 1000;
    }

    // ✅ OPTIMIZED: Only fetch requested data types to reduce memory usage
    const dataPromises = effectiveTypes.map(dataType =>
      healthService
        .readHealthData(dataType, {
          startDate,
          endDate: today,
          limit,
        })
        .then(data => ({ dataType, data }))
        .catch(error => {
          console.warn(`Failed to fetch ${dataType}:`, error);
          return { dataType, data: [] };
        })
    );

    const results = await Promise.all(dataPromises);

    // Convert results back to expected format
    const response: any = {
      heartRate: [],
      steps: [],
      sleep: [],
      weight: [],
      bloodPressure: [],
      oxygenSaturation: [],
      bodyTemperature: [],
      bloodGlucose: [],
      caloriesBurned: [],
    };

    results.forEach(({ dataType, data }) => {
      switch (dataType) {
        case HealthDataType.HEART_RATE:
          response.heartRate = data;
          break;
        case HealthDataType.STEPS:
          response.steps = data;
          break;
        case HealthDataType.SLEEP:
          response.sleep = data;
          break;
        case HealthDataType.WEIGHT:
          response.weight = data;
          break;
        case HealthDataType.BLOOD_PRESSURE:
          response.bloodPressure = data;
          break;
        case HealthDataType.OXYGEN_SATURATION:
          response.oxygenSaturation = data;
          break;
        case HealthDataType.BODY_TEMPERATURE:
          response.bodyTemperature = data;
          break;
        case HealthDataType.BLOOD_GLUCOSE:
          response.bloodGlucose = data;
          break;
        case HealthDataType.CALORIES_BURNED:
          response.caloriesBurned = data;
          break;
      }
    });

    return response;
  }
);

export const syncHealthData = createAsyncThunk('health/syncHealthData', async (userId: string) => {
  const syncService = HealthSyncService.getInstance();
  const success = await syncService.syncHealthData(userId);

  if (success) {
    const syncStatus = await syncService.getSyncStatus();
    return syncStatus;
  }

  throw new Error('Health data sync failed');
});

export const requestHealthPermissions = createAsyncThunk(
  'health/requestHealthPermissions',
  async (dataTypes: HealthDataType[]) => {
    const healthService = HealthDataService.getInstance();
    const granted = await healthService.requestPermissions(dataTypes);

    if (granted) {
      const permissions = await healthService.getPermissions();
      return permissions;
    }

    throw new Error('Health permissions not granted');
  }
);

const healthSlice = createSlice({
  name: 'health',
  initialState,
  reducers: {
    addHealthMetric: (state, action: PayloadAction<HealthMetric>) => {
      const metric = action.payload;
      const today = new Date();
      const isToday = metric.timestamp.toDateString() === today.toDateString();

      switch (metric.type) {
        case HealthDataType.HEART_RATE:
          state.healthData.heartRate.latest = metric;
          state.healthData.heartRate.daily.push(metric);
          break;

        case HealthDataType.STEPS:
          state.healthData.steps.latest = metric;
          state.healthData.steps.daily.push(metric);
          if (isToday) {
            state.healthData.steps.today += metric.value;
            state.healthData.steps.progress =
              (state.healthData.steps.today / state.healthData.steps.goal) * 100;
          }
          break;

        case HealthDataType.WEIGHT:
          state.healthData.weight.latest = metric;
          state.healthData.weight.daily.push(metric);
          break;

        case HealthDataType.BLOOD_PRESSURE:
          state.healthData.bloodPressure.latest = metric;
          state.healthData.bloodPressure.daily.push(metric);
          break;

        case HealthDataType.OXYGEN_SATURATION:
          state.healthData.oxygenSaturation.latest = metric;
          state.healthData.oxygenSaturation.daily.push(metric);
          break;

        case HealthDataType.BODY_TEMPERATURE:
          state.healthData.bodyTemperature.latest = metric;
          state.healthData.bodyTemperature.daily.push(metric);
          break;

        case HealthDataType.BLOOD_GLUCOSE:
          state.healthData.bloodGlucose.latest = metric;
          state.healthData.bloodGlucose.daily.push(metric);
          break;
        case HealthDataType.CALORIES_BURNED:
          state.healthData.caloriesBurned.latest = metric;
          state.healthData.caloriesBurned.daily.push(metric);
          break;
      }

      // Keep only last 100 daily readings per type
      Object.keys(state.healthData).forEach(key => {
        const dataKey = key as keyof typeof state.healthData;
        if (state.healthData[dataKey].daily.length > 100) {
          state.healthData[dataKey].daily = state.healthData[dataKey].daily.slice(-100);
        }
      });
    },

    updateSyncStatus: (state, action: PayloadAction<HealthSyncStatus>) => {
      state.syncStatus = action.payload;
      state.lastSync = action.payload.lastSync?.toISOString() || null;
    },

    addHealthAlert: (state, action: PayloadAction<HealthAlert>) => {
      state.alerts.unshift(action.payload);

      // Keep only last 50 alerts
      if (state.alerts.length > 50) {
        state.alerts = state.alerts.slice(0, 50);
      }
    },

    markAlertAsRead: (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find(a => a.id === action.payload);
      if (alert) {
        alert.isRead = true;
      }
    },

    clearAllAlerts: state => {
      state.alerts = [];
    },

    addHealthInsight: (state, action: PayloadAction<HealthInsight>) => {
      state.insights.unshift(action.payload);

      // Keep only last 20 insights
      if (state.insights.length > 20) {
        state.insights = state.insights.slice(0, 20);
      }
    },

    updateHealthGoal: (state, action: PayloadAction<HealthGoal>) => {
      const existingGoalIndex = state.goals.findIndex(goal => goal.type === action.payload.type);

      if (existingGoalIndex !== -1) {
        state.goals[existingGoalIndex] = action.payload;
      } else {
        state.goals.push(action.payload);
      }

      // Update steps goal if it's a steps goal
      if (action.payload.type === HealthDataType.STEPS) {
        state.healthData.steps.goal = action.payload.target;
        state.healthData.steps.progress =
          (state.healthData.steps.today / action.payload.target) * 100;
      }
    },

    removeHealthGoal: (state, action: PayloadAction<string>) => {
      state.goals = state.goals.filter(goal => goal.id !== action.payload);
    },

    calculateTrends: state => {
      // Calculate trends for each health metric
      Object.keys(state.healthData).forEach(key => {
        const dataKey = key as keyof typeof state.healthData;
        const metricGroup = state.healthData[dataKey];

        if (metricGroup.daily.length >= 2) {
          const recent = metricGroup.daily.slice(-7); // Last 7 readings
          const older = metricGroup.daily.slice(-14, -7); // Previous 7 readings

          if (recent.length > 0 && older.length > 0) {
            const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
            const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;

            const percentageChange = ((recentAvg - olderAvg) / olderAvg) * 100;

            let direction: 'up' | 'down' | 'stable' = 'stable';
            if (Math.abs(percentageChange) > 5) {
              direction = percentageChange > 0 ? 'up' : 'down';
            }

            metricGroup.trend = {
              type: getHealthDataTypeFromKey(dataKey),
              direction,
              percentage: Math.abs(percentageChange),
              period: 'week',
              significance:
                Math.abs(percentageChange) > 15
                  ? 'high'
                  : Math.abs(percentageChange) > 5
                    ? 'medium'
                    : 'low',
            };
          }
        }
      });
    },

    clearError: state => {
      state.error = null;
    },

    resetHealthData: state => {
      state.healthData = initialState.healthData;
      state.alerts = [];
      state.insights = [];
      state.error = null;
    },
  },

  extraReducers: builder => {
    builder
      // Initialize health service
      .addCase(initializeHealthService.pending, state => {
        state.isInitializing = true;
        state.error = null;
      })
      .addCase(initializeHealthService.fulfilled, (state, action) => {
        state.isInitializing = false;
        // Check if any permissions are granted
        const hasGrantedPermissions = action.payload.permissions.some(p => p.granted);
        state.permissions.granted = hasGrantedPermissions;
        state.permissions.requested = true;
        state.permissions.types = action.payload.permissions.map(p => p.type);
        state.permissions.details = action.payload.permissions.map(p => ({
          type: p.type,
          granted: p.granted,
          read: p.read,
          write: p.write,
        }));
        const total = action.payload.permissions.length;
        const grantedCount = action.payload.permissions.filter(p => p.granted).length;
        state.permissions.partiallyGranted = grantedCount > 0 && grantedCount < total;
      })
      .addCase(initializeHealthService.rejected, (state, action) => {
        state.isInitializing = false;
        state.error = action.error.message || 'Failed to initialize health service';
      })

      // Fetch latest health data
      .addCase(fetchLatestHealthData.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLatestHealthData.fulfilled, (state, action) => {
        state.isLoading = false;
        const {
          heartRate,
          steps,
          sleep,
          weight,
          bloodPressure,
          oxygenSaturation,
          bodyTemperature,
          bloodGlucose,
        } = action.payload;
        // Update sleep data
        if (Array.isArray(sleep) && sleep.length > 0) {
          state.healthData.sleep.latest = sleep[sleep.length - 1];
          state.healthData.sleep.daily = sleep;

          // Determine last night sleep (longest sleep period ending within last 18h)
          const now = new Date();
          const cutoff = new Date(now.getTime() - 18 * 60 * 60 * 1000);
          const recentSleeps = sleep.filter(s => s.timestamp >= cutoff);
          if (recentSleeps.length > 0) {
            // Longest duration among recent
            const longest = recentSleeps.reduce((a, b) => (a.value >= b.value ? a : b));
            state.healthData.sleep.lastNight = {
              duration: longest.value,
              quality: 80, // Placeholder – derive from stages when available
              stages: { deep: 0, light: 0, rem: 0, awake: 0 },
            };
          }
          // Average duration over last 7 sleeps
          const last7 = sleep.slice(-7);
          if (last7.length > 0) {
            const avg = last7.reduce((sum, s) => sum + s.value, 0) / last7.length;
            state.healthData.sleep.averageDuration = Math.round(avg);
          }
        }

        // Update heart rate data
        if (heartRate.length > 0) {
          state.healthData.heartRate.latest = heartRate[heartRate.length - 1];
          state.healthData.heartRate.daily = heartRate;
        }

        // Update steps data
        if (steps.length > 0) {
          state.healthData.steps.latest = steps[steps.length - 1];
          state.healthData.steps.daily = steps;

          // Calculate today's steps
          const today = new Date().toDateString();
          if (action.payload.steps) {
            state.healthData.steps.today = (action.payload.steps as HealthMetric[])
              .filter((s: HealthMetric) => new Date(s.timestamp).toDateString() === today)
              .reduce((sum: number, s: HealthMetric) => sum + s.value, 0);
            state.healthData.steps.progress =
              (state.healthData.steps.today / state.healthData.steps.goal) * 100;
          }
          if (action.payload.sleep) {
            const lastNightSleep = (action.payload.sleep as HealthMetric[]).find(
              (s: any) => s.type === 'sleep'
            ); // Simplified
            if (lastNightSleep) {
              state.healthData.sleep.lastNight = {
                duration: lastNightSleep.value,
                quality: lastNightSleep.metadata?.quality === 'high' ? 100 : 50,
                stages: { deep: 0, light: 0, rem: 0, awake: 0 }, // Placeholder
              };
            }
          }

          // Handle all metric groups generically
          for (const key in action.payload) {
            if (
              Object.prototype.hasOwnProperty.call(action.payload, key) &&
              Object.prototype.hasOwnProperty.call(state.healthData, key)
            ) {
              const data = action.payload[key as keyof typeof action.payload] as HealthMetric[];
              const stateKey = key as keyof typeof state.healthData;
              (state.healthData[stateKey] as HealthMetricGroup).daily = data;
              (state.healthData[stateKey] as HealthMetricGroup).latest =
                data.length > 0 ? data[data.length - 1] : null;
            }
          }
        }

        // Update weight data
        if (weight.length > 0) {
          state.healthData.weight.latest = weight[weight.length - 1];
          state.healthData.weight.daily = weight;
        }

        // Update blood pressure data
        if (bloodPressure.length > 0) {
          state.healthData.bloodPressure.latest = bloodPressure[bloodPressure.length - 1];
          state.healthData.bloodPressure.daily = bloodPressure;
        }

        // Update oxygen saturation data
        if (oxygenSaturation.length > 0) {
          state.healthData.oxygenSaturation.latest = oxygenSaturation[oxygenSaturation.length - 1];
          state.healthData.oxygenSaturation.daily = oxygenSaturation;
        }

        // Update body temperature data
        if (bodyTemperature.length > 0) {
          state.healthData.bodyTemperature.latest = bodyTemperature[bodyTemperature.length - 1];
          state.healthData.bodyTemperature.daily = bodyTemperature;
        }

        // Update blood glucose data
        if (bloodGlucose.length > 0) {
          state.healthData.bloodGlucose.latest = bloodGlucose[bloodGlucose.length - 1];
          state.healthData.bloodGlucose.daily = bloodGlucose;
        }

        state.lastSync = new Date().toISOString();
      })
      .addCase(fetchLatestHealthData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch health data';
      })

      // Sync health data
      .addCase(syncHealthData.pending, state => {
        state.syncStatus.isOnline = false;
      })
      .addCase(syncHealthData.fulfilled, (state, action) => {
        state.syncStatus = action.payload;
      })
      .addCase(syncHealthData.rejected, (state, action) => {
        state.error = action.error.message || 'Health data sync failed';
      })

      // Request health permissions
      .addCase(requestHealthPermissions.pending, state => {
        state.permissions.requested = true;
      })
      .addCase(requestHealthPermissions.fulfilled, (state, action) => {
        const grantedCount = action.payload.filter(p => p.granted).length;
        state.permissions.granted = grantedCount > 0;
        state.permissions.types = action.payload.filter(p => p.granted).map(p => p.type);
        state.permissions.details = action.payload.map(p => ({
          type: p.type,
          granted: p.granted,
          read: p.read,
          write: p.write,
        }));
        const total = action.payload.length;
        state.permissions.partiallyGranted = grantedCount > 0 && grantedCount < total;
      })
      .addCase(requestHealthPermissions.rejected, (state, action) => {
        state.permissions.granted = false;
        state.error = action.error.message || 'Health permissions denied';
      });
  },
});

// Helper function to map data keys to health data types
function getHealthDataTypeFromKey(key: keyof HealthState['healthData']): HealthDataType {
  const mapping: { [key: string]: HealthDataType } = {
    heartRate: HealthDataType.HEART_RATE,
    steps: HealthDataType.STEPS,
    sleep: HealthDataType.SLEEP,
    weight: HealthDataType.WEIGHT,
    bloodPressure: HealthDataType.BLOOD_PRESSURE,
    oxygenSaturation: HealthDataType.OXYGEN_SATURATION,
    bodyTemperature: HealthDataType.BODY_TEMPERATURE,
    bloodGlucose: HealthDataType.BLOOD_GLUCOSE,
    caloriesBurned: HealthDataType.CALORIES_BURNED,
  };
  return mapping[key] as HealthDataType;
}

export const {
  addHealthMetric,
  updateSyncStatus,
  addHealthAlert,
  markAlertAsRead,
  clearAllAlerts,
  addHealthInsight,
  updateHealthGoal,
  removeHealthGoal,
  calculateTrends,
  clearError,
  resetHealthData,
} = healthSlice.actions;

export default healthSlice.reducer;
