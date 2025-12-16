/**
 * HealthKit Type Identifiers for v10.0.0
 *
 * IMPORTANT: v10.0.0 uses string literals instead of enums
 * Use these constants throughout the app instead of importing HKQuantityTypeIdentifier
 *
 * ONLY includes types that are actually displayed in SimpleStepsDashboard.tsx:
 * - Steps (line 898)
 * - Heart Rate (line 916)
 * - Calories (line 909) - active + basal = total
 * - Active Time (line 924-926)
 *
 * @see https://github.com/Kingstinct/react-native-healthkit
 */

export const HKQuantityType = {
  // Activity & Fitness
  stepCount: 'HKQuantityTypeIdentifierStepCount',

  // Energy & Exercise
  activeEnergyBurned: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  basalEnergyBurned: 'HKQuantityTypeIdentifierBasalEnergyBurned',
  appleExerciseTime: 'HKQuantityTypeIdentifierAppleExerciseTime',

  // Heart
  heartRate: 'HKQuantityTypeIdentifierHeartRate',
} as const;

export type HKQuantityTypeValue = typeof HKQuantityType[keyof typeof HKQuantityType];

/**
 * All quantity types used in the app
 * Used for batch permission requests
 *
 * This array matches EXACTLY what's displayed in SimpleStepsDashboard.tsx:
 * - stepCount: Steps count + charts
 * - heartRate: Heart rate in bpm
 * - activeEnergyBurned: Active calories for total calculation
 * - basalEnergyBurned: Basal calories for total calculation (active + basal = total)
 * - appleExerciseTime: Active time in minutes/hours
 */
export const ALL_QUANTITY_TYPES = [
  HKQuantityType.stepCount,
  HKQuantityType.heartRate,
  HKQuantityType.activeEnergyBurned,
  HKQuantityType.basalEnergyBurned,
  HKQuantityType.appleExerciseTime,
] as const;
