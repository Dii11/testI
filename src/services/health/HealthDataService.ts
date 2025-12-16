import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { HealthMetric, HealthDataRange, HealthPermission } from '../../types/health';
import {
  HealthDataType,
  BloodPressureReading,
  SleepData,
  ExerciseSession,
} from '../../types/health';
import { isExpoGo } from '../../utils/nativeModuleChecker';
import { sentryTracker } from '../../utils/sentryErrorTracker';
import PermissionManager from '../PermissionManagerMigrated';

// import { AppleHealthKitProvider } from './providers/AppleHealthKitProvider'; // Removed - using @kingstinct/react-native-healthkit directly
import { GoogleHealthConnectProvider } from './providers/GoogleHealthConnectProvider';
import { wearableHealthManager } from './WearableHealthManager';

// Platform-specific imports with Expo Go safety checks
let AppleHealthKit: any = null;
let HealthKitPermissions: any = null;
let initialize: any = null;
let requestPermission: any = null;
let readRecords: any = null;

// Only load native modules when supported, and never on Expo Go
if (!isExpoGo()) {
  // iOS: Load HealthKit only on physical devices to avoid Nitro ECG init on simulator
  if (Platform.OS === 'ios') {
    if (Constants.isDevice) {
      try {
        const healthModule = require('@kingstinct/react-native-healthkit');
        AppleHealthKit = healthModule.default || healthModule;
        HealthKitPermissions = healthModule.Constants?.Permissions;
      } catch (error) {
        console.warn('@kingstinct/react-native-healthkit not available:', error);
      }
    } else {
      console.log('⚕️ Skipping HealthKit native module on iOS simulator (device hardware required)');
    }
  }

  // Android: Load Health Connect APIs
  if (Platform.OS === 'android') {
    try {
      const healthConnectModule = require('react-native-health-connect');
      initialize = healthConnectModule.initialize;
      requestPermission = healthConnectModule.requestPermission;
      readRecords = healthConnectModule.readRecords;
    } catch (error) {
      console.warn('react-native-health-connect not available:', error);
    }
  }
} else if (isExpoGo()) {
  console.log('⚕️ Health modules unavailable in Expo Go - requires development build');
}

export class HealthDataService {
  private static instance: HealthDataService;
  private isInitialized = false;
  private platformInitialized = false;
  private isRequestingPermissions = false;
  private initializationPromise: Promise<boolean> | null = null;
  private permissionRequestQueue = new Map<string, Promise<boolean>>();
  private initializationLock = false;
  private lastInitializationAttempt: number = 0;
  private readonly INITIALIZATION_COOLDOWN = 5000; // 5 seconds minimum between attempts
  private useUnifiedManager = true; // Flag to enable/disable unified manager

  static getInstance(): HealthDataService {
    if (!HealthDataService.instance) {
      HealthDataService.instance = new HealthDataService();
    }
    return HealthDataService.instance;
  }

  async initialize(): Promise<boolean> {
    // Check if already initialized
    if (this.isInitialized) {
      return true;
    }

    // Prevent concurrent initialization with lock
    if (this.initializationLock) {
      console.log('🏥 Health service initialization locked, waiting for completion...');
      while (this.initializationLock) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.isInitialized;
    }

    // Check cooldown to prevent rapid retry attempts
    const now = Date.now();
    if (now - this.lastInitializationAttempt < this.INITIALIZATION_COOLDOWN) {
      console.log('🏥 Health service initialization in cooldown period');
      return this.isInitialized;
    }

    // Return existing promise if initialization is in progress
    if (this.initializationPromise) {
      console.log('🏥 Health service initialization already in progress, waiting...');
      try {
        return await this.initializationPromise;
      } catch (error) {
        // Clear failed promise to allow retry after cooldown
        this.initializationPromise = null;
        this.lastInitializationAttempt = now;
        throw error;
      }
    }

    // Set lock and create initialization promise
    this.initializationLock = true;
    this.lastInitializationAttempt = now;
    this.initializationPromise = this.performInitialization();

    try {
      const result = await this.initializationPromise;
      return result;
    } catch (error) {
      // Clear failed promise to allow retry after cooldown
      this.initializationPromise = null;
      throw error;
    } finally {
      // Always clear the lock
      this.initializationLock = false;
      // Only clear promise on success to prevent race conditions
      if (this.isInitialized) {
        this.initializationPromise = null;
      }
    }
  }

  private async performInitialization(): Promise<boolean> {
    try {
      console.log('🏥 Initializing health service...');

      // Check if running in Expo Go - use mock data
      const isExpoGo = Constants.executionEnvironment === 'storeClient';

      if (Platform.OS === 'web' || isExpoGo) {
        // Web platform or Expo Go - use mock data
        this.platformInitialized = true;
        console.log(
          `🏥 Health service initialized with mock data (${isExpoGo ? 'Expo Go' : 'web'})`
        );
      } else {
        // Initialize unified wearable health manager
        await this.initializeUnifiedManager();
      }

      this.isInitialized = this.platformInitialized;
      console.log(`🏥 Health service initialization completed: ${this.isInitialized}`);
      return this.isInitialized;
    } catch (error) {
      console.error('🏥 Health service initialization failed:', error);

      // Track initialization failure to Sentry
      sentryTracker.trackCriticalError(
        error instanceof Error ? error : 'Health service initialization failed',
        {
          service: 'healthDataService',
          action: 'performInitialization',
          additional: {
            platform: Platform.OS,
            provider:
              Platform.OS === 'ios'
                ? 'healthkit'
                : Platform.OS === 'android'
                  ? 'healthconnect'
                  : 'web',
            isExpoGo: Constants.executionEnvironment === 'storeClient',
            platformInitialized: this.platformInitialized,
            useUnifiedManager: this.useUnifiedManager,
          },
        }
      );

      // On real devices, don't fall back to mock data - let it fail
      this.platformInitialized = false;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Initialize the unified wearable health manager with all available providers
   */
  private async initializeUnifiedManager(): Promise<void> {
    try {
      console.log('🏥 Initializing unified wearable health manager...');

      // ✅ CRITICAL FIX: Pre-flight permission validation for health data access
      console.log('🔐 Validating health monitoring permissions...');

      try {
        const permissionContext = {
          feature: 'health-monitoring',
          priority: 'important' as const,
          userInitiated: true,
          educationalContent: {
            title: 'Health Monitoring Permissions',
            description:
              'Access to health data enables personalized medical insights and better healthcare tracking.',
            benefits: [
              'Personalized health insights and recommendations',
              'Comprehensive health data tracking from multiple sources',
              'Integration with healthcare providers for better treatment',
              'Automatic sync of health metrics from wearables and devices',
            ],
          },
          fallbackStrategy: {
            mode: 'limited' as const,
            description: 'Manual health data entry available',
            limitations: [
              'No automatic health data sync',
              'Manual entry required for health metrics',
              'Limited health insights',
            ],
            alternativeApproach: 'manual-health-entry',
          },
        };

        const permissionResult = await PermissionManager.requestPermission(
          'health-monitoring',
          permissionContext
        );

        if (permissionResult.status !== 'granted') {
          console.warn('⚠️ Health monitoring permissions not granted, using fallback mode');
          // Don't throw error - allow fallback to manual entry
          if (permissionResult.degradationPath) {
            console.log(
              '🔄 Using degraded mode for health service:',
              permissionResult.degradationPath.description
            );
            // Continue with limited initialization
          }
        } else {
          console.log('✅ Health monitoring permissions validated successfully');
        }
      } catch (permissionError) {
        console.warn(
          '⚠️ Health permission validation failed, using fallback mode:',
          permissionError
        );
        // Allow initialization to continue with fallback capabilities
      }

      // Apple HealthKit provider removed - using @kingstinct/react-native-healthkit directly in hooks
      // if (Platform.OS === 'ios') {
      //   const appleProvider = new AppleHealthKitProvider();
      //   wearableHealthManager.registerProvider('apple_healthkit', appleProvider);
      // }

      // Register Google Health Connect provider (Android)
      if (Platform.OS === 'android') {
        const googleProvider = new GoogleHealthConnectProvider();

        // Check Health Connect requirements before registering
        const androidVersion = Platform.Version;
        console.log(`🏥 Android version detected: ${androidVersion}`);

        if (typeof androidVersion === 'number' && androidVersion < 26) {
          console.warn('🏥 Health Connect not supported on Android versions below 8.0 (API 26)');
          console.warn('🏥 Falling back to legacy health data options');
          // Could register alternative provider here if available
        } else {
          wearableHealthManager.registerProvider('google_health_connect', googleProvider);

          // Provide installation guidance for older Android versions
          if (typeof androidVersion === 'number' && androidVersion < 34) {
            console.log(
              '🏥 Health Connect app installation may be required for Android versions below 14'
            );
            console.log('🏥 App URL: market://details?id=com.google.android.apps.healthdata');
          }
        }
      }

      // Initialize the unified manager
      const initialized = await wearableHealthManager.initialize();

      if (initialized) {
        this.platformInitialized = true;
        console.log('🏥 Unified wearable health manager initialized successfully');

        // Log active providers and their status
        const activeProviders = wearableHealthManager.getActiveProviders();
        console.log(`🏥 Active health providers: [${activeProviders.join(', ')}]`);

        // Additional Android-specific logging
        if (Platform.OS === 'android' && activeProviders.includes('google_health_connect')) {
          console.log('🏥 Health Connect successfully initialized');
        } else if (Platform.OS === 'android') {
          console.warn('🏥 Health Connect not available - possible causes:');
          console.warn('  - Health Connect app not installed (Android 8-13)');
          console.warn('  - Health Connect service disabled (Android 14+)');
          console.warn('  - Device not supported');
          console.warn('  - Permissions not granted');
        }
      } else {
        console.warn('🏥 No health providers available');

        // Provide platform-specific guidance
        if (Platform.OS === 'android') {
          const androidVersion = Platform.Version;
          if (typeof androidVersion === 'number' && androidVersion >= 26) {
            console.warn('🏥 Android Health Connect troubleshooting:');
            if (androidVersion < 34) {
              console.warn('  1. Install Health Connect from Play Store');
              console.warn('  2. Grant necessary permissions to Health Connect');
              console.warn('  3. Enable health data sharing for this app');
            } else {
              console.warn('  1. Enable Health Connect in system settings');
              console.warn('  2. Grant health permissions to this app');
            }
          }
        }

        this.platformInitialized = false;
      }
    } catch (error) {
      console.error('🏥 Error initializing unified health manager:', error);
      this.platformInitialized = false;
      throw error;
    }
  }

  // Apple HealthKit helper method to get daily steps data
  private async getAppleHealthStepsDaily(options: HealthDataRange): Promise<HealthMetric[]> {
    if (!AppleHealthKit) {
      console.warn('AppleHealthKit not available for daily steps');
      return [];
    }

    const startDate = new Date(options.startDate);
    const endDate = new Date(options.endDate);

    // Performance optimization: Limit to reasonable date ranges (max 1 year)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      console.warn('Date range too large for daily fetching, limiting to 365 days');
      endDate.setTime(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    }

    // Fetch data day by day to get granular daily values
    const currentDate = new Date(startDate);
    const allResults: HealthMetric[] = [];
    const batchSize = 30; // Process in 30-day batches to prevent memory issues

    try {
      while (currentDate <= endDate) {
        const batchEndDate = new Date(currentDate);
        batchEndDate.setDate(currentDate.getDate() + batchSize - 1);
        if (batchEndDate > endDate) {
          batchEndDate.setTime(endDate.getTime());
        }

        const batchResults = await this.fetchStepsBatch(currentDate, batchEndDate);
        allResults.push(...batchResults);

        // Move to next batch
        currentDate.setDate(batchEndDate.getDate() + 1);

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return allResults;
    } catch (error) {
      console.error('Error fetching Apple HealthKit steps:', error);
      sentryTracker.trackCriticalError(
        error instanceof Error ? error : 'Apple HealthKit steps fetch failed',
        {
          service: 'healthDataService',
          action: 'getAppleHealthStepsDaily',
          additional: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            daysDiff,
          },
        }
      );
      return [];
    }
  }

  private async fetchStepsBatch(startDate: Date, endDate: Date): Promise<HealthMetric[]> {
    const promises: Promise<HealthMetric | null>[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayPromise = new Promise<HealthMetric | null>(resolve => {
        const dayOptions = {
          startDate: dayStart.toISOString(),
          endDate: dayEnd.toISOString(),
          limit: 1000,
        };

        AppleHealthKit.getStepCount(dayOptions, (error: any, results: any) => {
          if (error || !results) {
            console.warn(`Error reading steps for ${dayStart.toDateString()}:`, error);
            resolve(null);
            return;
          }

          const metric: HealthMetric = {
            id: `ios_steps_daily_${dayStart.getTime()}`,
            type: HealthDataType.STEPS,
            value: results.value || 0,
            unit: 'steps',
            timestamp: dayStart,
            source: 'phone',
            metadata: {
              quality: 'high',
              confidence: 1.0,
            },
          };
          resolve(metric);
        });
      });

      promises.push(dayPromise);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const results = await Promise.all(promises);
    return results.filter((metric): metric is HealthMetric => metric !== null);
  }

  async readHealthData(
    dataType: HealthDataType,
    options: HealthDataRange
  ): Promise<HealthMetric[]> {
    if (!this.isInitialized) {
      const error = new Error('Health service not initialized');
      sentryTracker.trackCriticalError(error, {
        service: 'healthDataService',
        action: 'readHealthData',
        additional: {
          dataType,
          isInitialized: this.isInitialized,
          platform: Platform.OS,
        },
      });
      throw error;
    }

    try {
      // Use unified manager for real devices, return empty for Expo Go/web
      if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
        console.log(
          `🏥 No health data available for ${dataType} in ${Platform.OS === 'web' ? 'web' : 'Expo Go'} environment`
        );
        return [];
      } else if (this.useUnifiedManager) {
        // Use unified wearable health manager
        const response = await wearableHealthManager.getHealthData(dataType, {
          startDate: options.startDate,
          endDate: options.endDate,
          limit: options.limit,
        });

        if (response.success) {
          console.log(
            `🏥 Successfully read ${dataType} from ${response.provider}:`,
            response.data.length,
            'records'
          );
          return response.data;
        } else {
          console.warn(`🏥 Failed to read ${dataType} from unified manager:`, response.errors);
          return [];
        }
      } else {
        // Fallback to legacy platform-specific methods
        if (Platform.OS === 'ios') {
          return await this.readAppleHealthData(dataType, options);
        } else if (Platform.OS === 'android') {
          return await this.readHealthConnectData(dataType, options);
        }
        return [];
      }
    } catch (error) {
      console.error(`Failed to read ${dataType}:`, error);

      // Track health data reading error to Sentry
      sentryTracker.trackCriticalError(
        error instanceof Error ? error : `Failed to read ${dataType}`,
        {
          service: 'healthDataService',
          action: 'readHealthData',
          additional: {
            dataType,
            platform: Platform.OS,
            startDate: options.startDate.toISOString(),
            endDate: options.endDate.toISOString(),
            limit: options.limit,
            useUnifiedManager: this.useUnifiedManager,
          },
        }
      );

      // Return empty array for any failures
      console.log(`🏥 No health data available for ${dataType}`);
      return [];
    }
  }

  private async readAppleHealthData(
    dataType: HealthDataType,
    options: HealthDataRange
  ): Promise<HealthMetric[]> {
    // Check if AppleHealthKit is available
    if (!AppleHealthKit) {
      console.warn('AppleHealthKit not available, returning empty array');
      return [];
    }

    const healthKitOptions = {
      startDate: options.startDate.toISOString(),
      endDate: options.endDate.toISOString(),
      limit: options.limit || 1000,
    };

    return new Promise(resolve => {
      switch (dataType) {
        case HealthDataType.HEART_RATE:
          AppleHealthKit.getHeartRateSamples(healthKitOptions, (error: any, results: any) => {
            if (error) {
              console.error('Error reading heart rate:', error);
              resolve([]);
              return;
            }
            const metrics = results.map((sample: any, index: number) => ({
              id: `ios_hr_${sample.startDate}_${index}`,
              type: HealthDataType.HEART_RATE,
              value: sample.value,
              unit: 'bpm',
              timestamp: new Date(sample.startDate),
              source: 'phone' as const,
              metadata: {
                quality: 'high' as const,
                confidence: 0.95,
              },
            }));
            resolve(metrics);
          });
          break;

        case HealthDataType.STEPS:
          // Apple HealthKit requires daily fetching for granular chart data
          this.getAppleHealthStepsDaily(options)
            .then(resolve)
            .catch(() => resolve([]));
          break;

        case HealthDataType.WEIGHT:
          AppleHealthKit.getWeightSamples(healthKitOptions, (error: any, results: any) => {
            if (error) {
              console.error('Error reading weight:', error);
              resolve([]);
              return;
            }
            const metrics = results.map((sample: any, index: number) => ({
              id: `ios_weight_${sample.startDate}_${index}`,
              type: HealthDataType.WEIGHT,
              value: sample.value,
              unit: 'kg',
              timestamp: new Date(sample.startDate),
              source: 'phone' as const,
              metadata: {
                quality: 'high' as const,
                confidence: 1.0,
              },
            }));
            resolve(metrics);
          });
          break;
        case HealthDataType.BLOOD_PRESSURE:
          AppleHealthKit.getBloodPressureSamples(healthKitOptions, (error: any, results: any) => {
            if (error) {
              console.error('Error reading blood pressure:', error);
              resolve([]);
              return;
            }
            const metrics = results.map((sample: any, index: number) => ({
              id: `ios_bp_${sample.startDate}_${index}`,
              type: HealthDataType.BLOOD_PRESSURE,
              value: sample.bloodPressureSystolicValue || sample.value || 0,
              unit: 'mmHg',
              timestamp: new Date(sample.startDate),
              source: 'phone' as const,
              metadata: { quality: 'high' as const, confidence: 0.9 },
            }));
            resolve(metrics);
          });
          break;
        case HealthDataType.OXYGEN_SATURATION:
          AppleHealthKit.getOxygenSaturationSamples(
            healthKitOptions,
            (error: any, results: any) => {
              if (error) {
                console.error('Error reading oxygen saturation:', error);
                resolve([]);
                return;
              }
              const metrics = results.map((sample: any, index: number) => ({
                id: `ios_spo2_${sample.startDate}_${index}`,
                type: HealthDataType.OXYGEN_SATURATION,
                value: sample.value,
                unit: '%',
                timestamp: new Date(sample.startDate),
                source: 'phone' as const,
                metadata: { quality: 'high' as const, confidence: 0.9 },
              }));
              resolve(metrics);
            }
          );
          break;
        case HealthDataType.BODY_TEMPERATURE:
          AppleHealthKit.getBodyTemperatureSamples(healthKitOptions, (error: any, results: any) => {
            if (error) {
              console.error('Error reading body temperature:', error);
              resolve([]);
              return;
            }
            const metrics = results.map((sample: any, index: number) => ({
              id: `ios_temp_${sample.startDate}_${index}`,
              type: HealthDataType.BODY_TEMPERATURE,
              value: sample.value,
              unit: '°C',
              timestamp: new Date(sample.startDate),
              source: 'phone' as const,
              metadata: { quality: 'high' as const, confidence: 0.9 },
            }));
            resolve(metrics);
          });
          break;
        case HealthDataType.BLOOD_GLUCOSE:
          AppleHealthKit.getBloodGlucoseSamples(healthKitOptions, (error: any, results: any) => {
            if (error) {
              console.error('Error reading blood glucose:', error);
              resolve([]);
              return;
            }
            const metrics = results.map((sample: any, index: number) => ({
              id: `ios_glucose_${sample.startDate}_${index}`,
              type: HealthDataType.BLOOD_GLUCOSE,
              value: sample.value,
              unit: 'mg/dL',
              timestamp: new Date(sample.startDate),
              source: 'phone' as const,
              metadata: { quality: 'high' as const, confidence: 0.9 },
            }));
            resolve(metrics);
          });
          break;
        case HealthDataType.SLEEP:
          AppleHealthKit.getSleepSamples(healthKitOptions, (error: any, results: any) => {
            if (error) {
              console.error('Error reading sleep samples:', error);
              resolve([]);
              return;
            }
            const metrics = results.map((sample: any, index: number) => {
              const start = new Date(sample.startDate);
              const end = new Date(sample.endDate);
              const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
              return {
                id: `ios_sleep_${sample.startDate}_${index}`,
                type: HealthDataType.SLEEP,
                value: durationMin,
                unit: 'minutes',
                timestamp: start,
                source: 'phone' as const,
                metadata: { quality: 'high' as const, confidence: 0.8, category: sample.value },
              } as HealthMetric;
            });
            resolve(metrics);
          });
          break;

        default:
          console.warn(`Health data type ${dataType} not implemented for iOS`);
          resolve([]);
      }
    });
  }

  private async readHealthConnectData(
    dataType: HealthDataType,
    options: HealthDataRange
  ): Promise<HealthMetric[]> {
    try {
      const timeFilter = {
        operator: 'between' as const,
        startTime: options.startDate.toISOString(),
        endTime: options.endDate.toISOString(),
      };

      let recordType: string;
      let unit: string;

      switch (dataType) {
        case HealthDataType.HEART_RATE:
          recordType = 'HeartRate';
          unit = 'bpm';
          break;
        case HealthDataType.STEPS:
          recordType = 'Steps';
          unit = 'steps';
          break;
        case HealthDataType.WEIGHT:
          recordType = 'Weight';
          unit = 'kg';
          break;
        case HealthDataType.BLOOD_PRESSURE:
          recordType = 'BloodPressure';
          unit = 'mmHg';
          break;
        case HealthDataType.BODY_TEMPERATURE:
          recordType = 'BodyTemperature';
          unit = '°C';
          break;
        case HealthDataType.OXYGEN_SATURATION:
          recordType = 'OxygenSaturation';
          unit = '%';
          break;
        case HealthDataType.SLEEP:
          recordType = 'SleepSession';
          unit = 'minutes';
          break;
        case HealthDataType.BLOOD_GLUCOSE:
          recordType = 'BloodGlucose';
          unit = 'mg/dL';
          break;
        default:
          console.warn(`Health data type ${dataType} not implemented for Android`);
          return [];
      }

      if (!readRecords) {
        console.warn('Health Connect readRecords API not available');
        return [];
      }

      const results = await readRecords(recordType, {
        timeRangeFilter: timeFilter,
      }).catch((e: any) => {
        console.warn('readRecords failed for', recordType, e);
        return [];
      });

      return results.map((record: any, index: number) => ({
        id: `android_${dataType}_${record.startTime}_${index}`,
        type: dataType,
        value: this.extractValueFromRecord(record, dataType),
        unit,
        timestamp: new Date(record.startTime),
        source: 'phone' as const,
        metadata: {
          quality: 'high' as const,
          confidence: 0.9,
        },
      }));
    } catch (error) {
      console.error(`Error reading Health Connect data for ${dataType}:`, error);
      return [];
    }
  }

  private extractValueFromRecord(record: any, dataType: HealthDataType): number {
    switch (dataType) {
      case HealthDataType.HEART_RATE:
        return record.beatsPerMinute || record.value || 0;
      case HealthDataType.STEPS:
        return record.count || record.value || 0;
      case HealthDataType.WEIGHT:
        return record.weight ? record.weight.inKilograms : record.value || 0;
      case HealthDataType.BLOOD_PRESSURE:
        return record.systolic || record.value || 0;
      case HealthDataType.BODY_TEMPERATURE:
        return record.temperature ? record.temperature.inCelsius : record.value || 0;
      case HealthDataType.OXYGEN_SATURATION:
        return record.percentage || record.value || 0;
      case HealthDataType.SLEEP: {
        const start = new Date(record.startTime).getTime();
        const end = new Date(record.endTime).getTime();
        if (end > start) {
          return Math.round((end - start) / 60000); // minutes
        }
        return 0; // No fallback sleep data on real devices
      }
      case HealthDataType.BLOOD_GLUCOSE:
        return (
          (record.level && (record.level.milligramsPerDeciliter || record.level.mgPerDeciliter)) ||
          record.value ||
          0
        );
      default:
        return record.value || 0;
    }
  }

  async writeHealthData(metric: HealthMetric): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Health service not initialized');
    }

    try {
      // Use unified manager for all write operations
      const activeProviders = wearableHealthManager.getActiveProviders();

      for (const providerName of activeProviders) {
        try {
          const provider = wearableHealthManager.getProvider(providerName);
          if (provider) {
            const success = await provider.writeHealthData(metric);
            if (success) {
              console.log(`🏥 Successfully wrote ${metric.type} via ${providerName}`);
              return true;
            }
          }
        } catch (error) {
          console.warn(`🏥 Failed to write ${metric.type} via ${providerName}:`, error);
        }
      }

      console.warn(`🏥 Failed to write ${metric.type} via all providers`);
      return false;
    } catch (error) {
      console.error(`Failed to write ${metric.type}:`, error);
      return false;
    }
  }

  async getPermissions(): Promise<HealthPermission[]> {
    if (!this.isInitialized) return [];

    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (Platform.OS === 'web' || isExpoGo) {
      // Web/Expo Go environments => no permissions available
      return [];
    }

    if (this.useUnifiedManager) {
      // Use unified manager to check permissions across all providers
      try {
        const allDataTypes = [
          HealthDataType.HEART_RATE,
          HealthDataType.STEPS,
          HealthDataType.WEIGHT,
          HealthDataType.SLEEP,
          HealthDataType.BLOOD_PRESSURE,
          HealthDataType.OXYGEN_SATURATION,
          HealthDataType.BODY_TEMPERATURE,
          HealthDataType.BLOOD_GLUCOSE,
        ];

        const providerPermissions = await wearableHealthManager.checkPermissions(allDataTypes);

        // Aggregate permissions across all providers
        const aggregatedPermissions = new Map<HealthDataType, HealthPermission>();

        // providerPermissions is a Map<string, HealthPermission[]>; iterate it directly
        for (const [, permissions] of providerPermissions) {
          for (const permission of permissions) {
            const existing = aggregatedPermissions.get(permission.type);
            if (!existing || !existing.granted) {
              // Prefer granted permissions, or the first one if neither is granted
              aggregatedPermissions.set(permission.type, {
                ...permission,
                granted: permission.granted || existing?.granted || false,
              });
            }
          }
        }

        // Convert to array and ensure all data types are represented
        const result: HealthPermission[] = allDataTypes.map(type => {
          const permission = aggregatedPermissions.get(type);
          return (
            permission || {
              type,
              read: true,
              write: false,
              granted: false,
            }
          );
        });

        console.log('🏥 Unified permissions check result:', result);
        return result;
      } catch (error) {
        console.error('🏥 Error checking unified permissions:', error);
        sentryTracker.trackServiceError(
          error instanceof Error ? error : 'unified_permissions_failed',
          {
            service: 'healthDataService',
            action: 'getPermissions',
            additional: { platform: Platform.OS, useUnifiedManager: true },
          }
        );
        return [];
      }
    } else {
      // Fallback to legacy platform-specific methods
      if (Platform.OS === 'ios' && AppleHealthKit) {
        try {
          const hkConstants = AppleHealthKit.Constants?.Permissions || AppleHealthKit.Constants;
          const statusEnum = AppleHealthKit.Constants?.AuthorizationStatus;
          const PERM_MAP: { type: HealthDataType; key: any; read: boolean; write: boolean }[] = [
            {
              type: HealthDataType.HEART_RATE,
              key: hkConstants?.HeartRate,
              read: true,
              write: false,
            },
            {
              type: HealthDataType.STEPS,
              key: hkConstants?.Steps || hkConstants?.StepCount,
              read: true,
              write: true,
            },
            { type: HealthDataType.WEIGHT, key: hkConstants?.Weight, read: true, write: true },
            {
              type: HealthDataType.SLEEP,
              key: hkConstants?.SleepAnalysis,
              read: true,
              write: false,
            },
            {
              type: HealthDataType.BLOOD_PRESSURE,
              key: hkConstants?.BloodPressureSystolic,
              read: true,
              write: false,
            },
          ];
          if (!AppleHealthKit.getAuthStatus || !statusEnum) {
            const isAvailable =
              typeof AppleHealthKit.isAvailable === 'function'
                ? AppleHealthKit.isAvailable()
                : true;
            return PERM_MAP.map(p => ({
              type: p.type,
              read: p.read,
              write: p.write,
              granted: !!isAvailable,
            }));
          }
          const granular = await Promise.all(
            PERM_MAP.map(
              meta =>
                new Promise<HealthPermission>(resolve => {
                  try {
                    AppleHealthKit.getAuthStatus(meta.key, (err: any, result: any) => {
                      if (err) {
                        console.warn('HealthKit getAuthStatus error', meta.type, err);
                        return resolve({
                          type: meta.type,
                          read: meta.read,
                          write: meta.write,
                          granted: false,
                        });
                      }
                      const granted =
                        result === statusEnum.SHARING_AUTHORIZED ||
                        result?.sharing === statusEnum.SHARING_AUTHORIZED;
                      resolve({ type: meta.type, read: meta.read, write: meta.write, granted });
                    });
                  } catch (inner) {
                    console.warn('HealthKit getAuthStatus exception', meta.type, inner);
                    resolve({
                      type: meta.type,
                      read: meta.read,
                      write: meta.write,
                      granted: false,
                    });
                  }
                })
            )
          );
          return granular;
        } catch (error) {
          console.error('Error checking granular HealthKit permissions:', error);
          sentryTracker.trackServiceError(
            error instanceof Error ? error : 'healthkit_permissions_failed',
            {
              service: 'healthDataService',
              action: 'getPermissions',
              additional: { platform: Platform.OS, granular: true },
            }
          );
          return [];
        }
      }

      if (Platform.OS === 'android') {
        const granted = this.platformInitialized; // coarse flag until per-record query implemented
        return [
          { type: HealthDataType.HEART_RATE, read: true, write: false, granted },
          { type: HealthDataType.STEPS, read: true, write: true, granted },
          { type: HealthDataType.WEIGHT, read: true, write: true, granted },
          { type: HealthDataType.SLEEP, read: true, write: false, granted },
          { type: HealthDataType.BLOOD_PRESSURE, read: true, write: false, granted },
        ];
      }
      return [];
    }
  }

  async requestPermissions(dataTypes: HealthDataType[]): Promise<boolean> {
    // Generate a unique key for this permission request
    const requestKey = dataTypes.sort().join(',');

    // Check if there's already a pending request for these permissions
    const existingRequest = this.permissionRequestQueue.get(requestKey);
    if (existingRequest) {
      console.log('🏥 Permission request already in progress for:', requestKey);
      return await existingRequest;
    }

    // Prevent multiple concurrent permission requests globally
    if (this.isRequestingPermissions) {
      console.warn('🏥 Another permission request is in progress, rejecting this request');
      return false;
    }

    // Create the permission request promise
    const requestPromise = this.performPermissionRequest(dataTypes);
    this.permissionRequestQueue.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up the queue
      this.permissionRequestQueue.delete(requestKey);
    }
  }

  private async performPermissionRequest(dataTypes: HealthDataType[]): Promise<boolean> {
    this.isRequestingPermissions = true;

    try {
      console.log('🏥 Requesting health permissions for:', dataTypes);

      if (this.useUnifiedManager) {
        // Use unified manager to request permissions across all providers
        try {
          const result = await wearableHealthManager.requestPermissions(dataTypes);
          console.log('🏥 Unified permission request result:', result);

          if (result) {
            console.log('🏥 Permissions granted by at least one provider');
          } else {
            console.warn('🏥 No providers granted permissions');
          }

          return result;
        } catch (error) {
          console.error('🏥 Unified permission request failed:', error);
          sentryTracker.trackServiceError(
            error instanceof Error ? error : 'unified_permission_request_failed',
            {
              service: 'healthDataService',
              action: 'performPermissionRequest',
              additional: {
                platform: Platform.OS,
                dataTypes,
                useUnifiedManager: true,
              },
            }
          );
          return false;
        }
      } else {
        // Fallback to legacy platform-specific methods
        if (Platform.OS === 'ios') {
          // iOS permissions are requested during initialization
          if (!this.isInitialized) {
            await this.initialize();
          }
          return this.isInitialized && this.platformInitialized;
        } else if (Platform.OS === 'android') {
          if (!initialize || !requestPermission) {
            console.warn('🏥 Health Connect not available');
            sentryTracker.trackCriticalError('Health Connect not available', {
              service: 'healthDataService',
              action: 'performPermissionRequest',
              additional: {
                platform: Platform.OS,
                dataTypes,
                initializeAvailable: !!initialize,
                requestPermissionAvailable: !!requestPermission,
              },
            });
            return false;
          }

          const permissionRequests = dataTypes.map(dataType => ({
            accessType: 'read' as const,
            recordType: this.mapToHealthConnectType(dataType),
          }));

          // Add timeout to permission request to prevent hanging
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Permission request timeout')), 30000);
          });

          try {
            const permissions = await Promise.race([
              requestPermission(permissionRequests),
              timeoutPromise,
            ]);

            const granted = permissions.length > 0;
            console.log('🏥 Health Connect permissions result:', { granted, permissions });
            return granted;
          } catch (error) {
            console.error('🏥 Health Connect permission request failed:', error);
            return false;
          }
        } else if (Platform.OS === 'web') {
          // Web or Expo Go - mock data doesn't require permissions
          return true;
        }
        // Other platforms not supported
        return false;
      }
    } catch (error) {
      console.error('🏥 Error requesting health permissions:', error);

      // Track permission request error to Sentry
      sentryTracker.trackCriticalError(
        error instanceof Error ? error : 'Health permission request failed',
        {
          service: 'healthDataService',
          action: 'performPermissionRequest',
          additional: {
            platform: Platform.OS,
            dataTypes,
            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          },
        }
      );

      return false;
    } finally {
      this.isRequestingPermissions = false;
    }
  }

  private mapToHealthConnectType(dataType: HealthDataType): string {
    switch (dataType) {
      case HealthDataType.HEART_RATE:
        return 'HeartRate';
      case HealthDataType.STEPS:
        return 'Steps';
      case HealthDataType.WEIGHT:
        return 'Weight';
      case HealthDataType.BLOOD_PRESSURE:
        return 'BloodPressure';
      case HealthDataType.BODY_TEMPERATURE:
        return 'BodyTemperature';
      case HealthDataType.OXYGEN_SATURATION:
        return 'OxygenSaturation';
      case HealthDataType.SLEEP:
        return 'SleepSession';
      default:
        return 'Steps';
    }
  }

  isHealthDataAvailable(): boolean {
    if (Platform.OS === 'ios') {
      return AppleHealthKit ? AppleHealthKit.isAvailable() : false;
    } else if (Platform.OS === 'android') {
      return true; // Health Connect availability is checked during initialization
    }
    return false;
  }

  async getLatestMetric(dataType: HealthDataType): Promise<HealthMetric | null> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    const metrics = await this.readHealthData(dataType, {
      startDate,
      endDate,
      limit: 1,
    });

    return metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }
}
