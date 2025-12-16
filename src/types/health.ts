export interface HealthMetric {
  id: string;
  type: HealthDataType;
  value: number;
  unit: string;
  timestamp: Date;
  source: 'watch' | 'phone' | 'manual';
  deviceId?: string;
  metadata?: {
    quality?: 'high' | 'medium' | 'low';
    confidence?: number;
    context?: string;
  };
}

export enum HealthDataType {
  HEART_RATE = 'heart_rate',
  STEPS = 'steps',
  SLEEP = 'sleep',
  BLOOD_PRESSURE = 'blood_pressure',
  BODY_TEMPERATURE = 'body_temperature',
  OXYGEN_SATURATION = 'oxygen_saturation',
  WEIGHT = 'weight',
  HEIGHT = 'height',
  BLOOD_GLUCOSE = 'blood_glucose',
  EXERCISE = 'exercise',
  DISTANCE = 'distance',
  CALORIES_BURNED = 'calories_burned',
  BODY_FAT_PERCENTAGE = 'body_fat_percentage',
  RESPIRATORY_RATE = 'respiratory_rate',
  ACTIVE_ENERGY = 'active_energy',
  RESTING_HEART_RATE = 'resting_heart_rate',
}

export interface HealthDataRange {
  startDate: Date;
  endDate: Date;
  limit?: number;
}

export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
  timestamp: Date;
  source: string;
}

export interface SleepData {
  duration: number; // in minutes
  bedTime: Date;
  wakeTime: Date;
  quality: number; // 0-100 scale
  stages: {
    deep: number;
    light: number;
    rem: number;
    awake: number;
  };
  efficiency: number; // percentage
}

export interface ExerciseSession {
  id: string;
  type: ExerciseType;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  calories: number;
  distance?: number; // in meters
  averageHeartRate?: number;
  maxHeartRate?: number;
  steps?: number;
}

export enum ExerciseType {
  WALKING = 'walking',
  RUNNING = 'running',
  CYCLING = 'cycling',
  SWIMMING = 'swimming',
  WORKOUT = 'workout',
  YOGA = 'yoga',
  STRENGTH_TRAINING = 'strength_training',
  OTHER = 'other',
}

export interface HealthPermission {
  type: HealthDataType;
  read: boolean;
  write: boolean;
  granted: boolean;
}

export interface HealthPermissionDetails {
  type: HealthDataType;
  granted: boolean;
  read?: boolean;
  write?: boolean;
}

export interface HealthPermissionState {
  granted: boolean;
  requested: boolean;
  types: HealthDataType[];
  details?: HealthPermissionDetails[];
  partiallyGranted?: boolean;
}

export interface HealthSyncStatus {
  lastSync: Date | null;
  isOnline: boolean;
  pendingUploads: number;
  errors: HealthSyncError[];
}

export interface HealthSyncError {
  id: string;
  type: HealthDataType;
  message: string;
  timestamp: Date;
  retryCount: number;
}

export interface HealthGoal {
  id: string;
  type: HealthDataType;
  target: number;
  unit: string;
  period: 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  createdAt: Date;
}

export interface HealthAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  healthDataType: HealthDataType;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  isRead: boolean;
}

export interface HealthTrend {
  type: HealthDataType;
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  period: 'day' | 'week' | 'month';
  significance: 'high' | 'medium' | 'low';
}

export interface HealthInsight {
  id: string;
  title: string;
  description: string;
  type: 'recommendation' | 'warning' | 'achievement' | 'trend';
  healthDataTypes: HealthDataType[];
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  actionText?: string;
  createdAt: Date;
}

export interface HealthProfile {
  userId: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number; // in cm
  weight: number; // in kg
  activityLevel:
    | 'sedentary'
    | 'lightly_active'
    | 'moderately_active'
    | 'very_active'
    | 'extremely_active';
  medicalConditions: string[];
  medications: string[];
  allergies: string[];
  goals: HealthGoal[];
  preferences: {
    units: 'metric' | 'imperial';
    notifications: boolean;
    dataSharing: boolean;
  };
}

// Centralized list of core health data types the app attempts to read.
// Keeping this in one place prevents divergence between permission requests
// and actual data fetch logic (which previously led to SecurityException errors
// for types like Blood Pressure & Oxygen Saturation that were read without
// having been requested at permission time).
export const CORE_HEALTH_DATA_TYPES: HealthDataType[] = [
  HealthDataType.HEART_RATE,
  HealthDataType.STEPS,
  HealthDataType.SLEEP,
  HealthDataType.WEIGHT,
  HealthDataType.BLOOD_PRESSURE,
  HealthDataType.OXYGEN_SATURATION,
  HealthDataType.BODY_TEMPERATURE,
  HealthDataType.BLOOD_GLUCOSE,
  HealthDataType.CALORIES_BURNED,
  HealthDataType.EXERCISE, // For exercise sessions and workout tracking
  HealthDataType.ACTIVE_ENERGY, // For active energy burned (alternative metric)
];

// Metric group structures (mirrors slice state shapes)
export interface BaseMetricGroup {
  latest: HealthMetric | null;
  daily: HealthMetric[];
  trend: HealthTrend | null;
}

export interface StepsMetricGroup extends BaseMetricGroup {
  today: number;
  goal: number;
  progress: number; // percentage
}

export interface SleepMetricGroup extends BaseMetricGroup {
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
}

export type StandardMetricGroup = BaseMetricGroup;

export interface HealthDataCollection {
  heartRate: StandardMetricGroup;
  steps: StepsMetricGroup;
  sleep: SleepMetricGroup;
  weight: StandardMetricGroup;
  bloodPressure: StandardMetricGroup;
  oxygenSaturation: StandardMetricGroup;
  bodyTemperature: StandardMetricGroup;
  bloodGlucose: StandardMetricGroup;
  caloriesBurned: StandardMetricGroup;
}

export type AnyMetricGroup = StandardMetricGroup | StepsMetricGroup | SleepMetricGroup;

/**
 * Period filter types for aggregated health data
 */
export type PeriodFilter = 'today' | 'week' | 'month';

export interface PeriodRange {
  startDate: Date;
  endDate: Date;
  period: PeriodFilter;
}

/**
 * Helper function to get date range for a period
 */
export function getPeriodRange(period: PeriodFilter, referenceDate: Date = new Date()): PeriodRange {
  const now = new Date(referenceDate);
  const startDate = new Date(now);
  const endDate = new Date(now);

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'week':
      // Start from Monday of current week
      const dayOfWeek = startDate.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Monday start
      startDate.setDate(startDate.getDate() + diff);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'month':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(endDate.getMonth() + 1, 0); // Last day of month
      endDate.setHours(23, 59, 59, 999);
      break;
  }

  return { startDate, endDate, period };
}
