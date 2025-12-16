/**
 * Unified Wearable Health Manager
 *
 * Provides a unified API for accessing health data from core health providers:
 * - Apple HealthKit (iOS/watchOS)
 * - Google Health Connect (Android/WearOS)
 *
 * Architecture:
 * - Provider-based system with pluggable health providers
 * - Unified API with consistent method signatures
 * - Automatic provider detection and fallback
 * - Centralized error handling and caching
 * - Enhanced error recovery and permission management
 */

import { Platform } from 'react-native';

import type { HealthMetric, HealthDataRange, HealthPermission } from '../../types/health';
import { HealthDataType } from '../../types/health';
import { sentryTracker } from '../../utils/sentryErrorTracker';

import { healthDataCache } from './HealthDataCache';
import { HealthDataNormalizer } from './HealthDataNormalizer';

// Core Provider Interface
export interface HealthProvider {
  readonly name: string;
  readonly platform: 'ios' | 'android' | 'web';
  readonly supportedDataTypes: HealthDataType[];
  readonly priority: number; // Higher priority providers are preferred

  // Lifecycle methods
  initialize(): Promise<boolean>;
  isAvailable(): Promise<boolean>;
  cleanup(): Promise<void>;

  // Permission management
  checkPermissions(dataTypes: HealthDataType[]): Promise<HealthPermission[]>;
  requestPermissions(dataTypes: HealthDataType[]): Promise<boolean>;

  // Data operations
  readHealthData(dataType: HealthDataType, options: HealthDataRange): Promise<HealthMetric[]>;
  writeHealthData(metric: HealthMetric): Promise<boolean>;

  // Device information
  getDeviceInfo(): Promise<{
    deviceName?: string;
    deviceModel?: string;
    osVersion?: string;
    appVersion?: string;
  }>;
}

// Provider Registration
export interface ProviderRegistration {
  provider: HealthProvider;
  enabled: boolean;
  conditions?: {
    platform?: string[];
    minOSVersion?: string;
    requiredCapabilities?: string[];
  };
}

// Unified Health Data Response
export interface UnifiedHealthResponse {
  success: boolean;
  data: HealthMetric[];
  provider: string;
  cached: boolean;
  errors?: string[];
  metadata: {
    fetchTime: number;
    source: string;
    dataQuality: 'high' | 'medium' | 'low';
    pagination?: {
      currentPage: number;
      totalPages: number;
      totalEntries: number;
      hasMore: boolean;
      entriesPerPage: number;
    };
  };
}

// Error Recovery Strategy
export interface ErrorRecoveryStrategy {
  maxRetries: number;
  retryDelay: number;
  fallbackToCache: boolean;
  fallbackToMockData: boolean;
  exponentialBackoff: boolean;
  platformSpecificHandling: boolean;
}

// Platform Availability Check
export interface PlatformAvailability {
  available: boolean;
  reason?: string;
  canRetry: boolean;
  suggestedAction?: string;
}

// Enhanced Error Classification
export type ErrorType =
  | 'PERMISSION_DENIED'
  | 'DEVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'DATA_CORRUPTION'
  | 'RATE_LIMITED'
  | 'SERVICE_BINDING_FAILED'
  | 'TRANSIENT'
  | 'UNKNOWN';

export class WearableHealthManager {
  private static instance: WearableHealthManager;
  private providers = new Map<string, HealthProvider>();
  private activeProviders = new Set<string>();
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;
  private fallbackProvider: string | null = null;
  private providerCache = new Map<string, { data: any; timestamp: number }>();
  private permissionCache = new Map<
    string,
    { permissions: HealthPermission[]; timestamp: number }
  >();
  private CACHE_TTL = 30000; // 30 seconds data cache
  private readonly PERMISSION_CACHE_TTL = 900000; // 15 minutes permission cache - optimized for better performance
  private errorRecoveryStrategy: ErrorRecoveryStrategy = {
    maxRetries: 3,
    retryDelay: 1000,
    fallbackToCache: true,
    fallbackToMockData: false,
    exponentialBackoff: true,
    platformSpecificHandling: true,
  };

  // Device performance detection
  private devicePerformance: 'low' | 'medium' | 'high' = 'medium';
  private performanceOptimizations: Record<
    'low' | 'medium' | 'high',
    {
      maxRetries: number;
      retryDelay: number;
      cacheTTL: number;
      batchSize: number;
      timeoutMultiplier: number;
    }
  > = {
    low: {
      maxRetries: 2,
      retryDelay: 2000,
      cacheTTL: 60000, // 1 minute
      batchSize: 10,
      timeoutMultiplier: 1.5,
    },
    medium: {
      maxRetries: 3,
      retryDelay: 1000,
      cacheTTL: 30000, // 30 seconds
      batchSize: 50,
      timeoutMultiplier: 1.0,
    },
    high: {
      maxRetries: 3,
      retryDelay: 500,
      cacheTTL: 15000, // 15 seconds
      batchSize: 100,
      timeoutMultiplier: 0.8,
    },
  };

  static getInstance(): WearableHealthManager {
    if (!WearableHealthManager.instance) {
      WearableHealthManager.instance = new WearableHealthManager();
    }
    return WearableHealthManager.instance;
  }

  /**
   * Detect device performance characteristics
   */
  private detectDevicePerformance(): void {
    try {
      // Simple performance detection based on available information
      const androidVersion = Platform.OS === 'android' ? Platform.Version : 0;

      // Basic heuristics for device performance
      if (Platform.OS === 'android') {
        if (androidVersion < 28) {
          // Older Android versions likely on lower-end devices
          this.devicePerformance = 'low';
        } else if (androidVersion >= 34) {
          // Newer Android versions likely on higher-end devices
          this.devicePerformance = 'high';
        } else {
          this.devicePerformance = 'medium';
        }
      } else if (Platform.OS === 'ios') {
        // iOS devices are generally more consistent
        this.devicePerformance = 'medium';
      } else {
        this.devicePerformance = 'medium';
      }

      console.log(`🏥 Detected device performance: ${this.devicePerformance}`);

      // Apply performance optimizations
      this.applyPerformanceOptimizations();
    } catch (error) {
      console.warn('🏥 Device performance detection failed, using medium settings:', error);
      this.devicePerformance = 'medium';
    }
  }

  /**
   * Apply performance optimizations based on device capabilities
   */
  private applyPerformanceOptimizations(): void {
    const optimizations = this.performanceOptimizations[this.devicePerformance];

    // Update error recovery strategy
    this.errorRecoveryStrategy.maxRetries = optimizations.maxRetries;
    this.errorRecoveryStrategy.retryDelay = optimizations.retryDelay;

    // Update cache TTL
    this.CACHE_TTL = optimizations.cacheTTL;

    console.log(`🏥 Applied ${this.devicePerformance} device optimizations:`, {
      maxRetries: optimizations.maxRetries,
      retryDelay: optimizations.retryDelay,
      cacheTTL: optimizations.cacheTTL,
      batchSize: optimizations.batchSize,
    });
  }

  /**
   * Get current performance optimizations
   */
  getPerformanceOptimizations() {
    return this.performanceOptimizations[this.devicePerformance];
  }

  /**
   * Register a health provider with enhanced validation
   */
  registerProvider(name: string, provider: HealthProvider): void {
    console.log(`🏥 Registering health provider: ${name} (${provider.platform})`);

    // Validate provider interface
    if (!this.validateProviderInterface(provider)) {
      console.error(`🏥 Provider ${name} failed interface validation`);
      return;
    }

    this.providers.set(name, provider);

    // Auto-detect best provider for current platform
    this.updateProviderPriority();
  }

  /**
   * Validate provider implements required interface methods
   */
  private validateProviderInterface(provider: HealthProvider): boolean {
    const requiredMethods = [
      'initialize',
      'isAvailable',
      'cleanup',
      'checkPermissions',
      'requestPermissions',
      'readHealthData',
    ];

    for (const method of requiredMethods) {
      if (typeof provider[method as keyof HealthProvider] !== 'function') {
        console.error(`🏥 Provider missing required method: ${method}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Update provider priority based on platform and device capabilities
   */
  private updateProviderPriority(): void {
    const platformProviders = Array.from(this.providers.entries())
      .filter(([, provider]) => provider.platform === Platform.OS || provider.platform === 'web')
      .sort(([, a], [, b]) => b.priority - a.priority);

    if (platformProviders.length > 0) {
      this.fallbackProvider = platformProviders[0][0];
      console.log(`🏥 Primary provider for ${Platform.OS}: ${this.fallbackProvider}`);
    }
  }

  /**
   * Initialize all registered providers with enhanced error recovery
   */
  async initialize(): Promise<boolean> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      return this.isInitialized;
    }

    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
    return this.isInitialized;
  }

  private async performInitialization(): Promise<void> {
    console.log('🏥 Initializing WearableHealthManager...');

    // Detect device performance and apply optimizations
    this.detectDevicePerformance();

    const initPromises = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        // Check if provider is available on current platform
        if (provider.platform !== Platform.OS && provider.platform !== 'web') {
          console.log(`🏥 Skipping ${name} - not available on ${Platform.OS}`);
          return;
        }

        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          console.log(`🏥 Provider ${name} not available on device`);
          return;
        }

        const initialized = await provider.initialize();
        if (initialized) {
          this.activeProviders.add(name);
          console.log(`🏥 Successfully initialized provider: ${name}`);
        } else {
          console.warn(`🏥 Failed to initialize provider: ${name}`);
        }
      } catch (error) {
        console.error(`🏥 Error initializing provider ${name}:`, error);
        sentryTracker.trackServiceError(
          error instanceof Error ? error : `Failed to initialize ${name}`,
          {
            service: 'wearableHealthManager',
            action: 'initializeProvider',
            additional: { providerName: name, platform: provider.platform },
          }
        );
      }
    });

    await Promise.allSettled(initPromises);
    this.isInitialized = this.activeProviders.size > 0;

    console.log(
      `🏥 WearableHealthManager initialization complete. Active providers: [${Array.from(this.activeProviders).join(', ')}]`
    );
  }

  /**
   * Unified API Methods - Core health data retrieval interface
   */

  /**
   * Get steps data from best available provider
   */
  async getSteps(options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    preferredProvider?: string;
  }): Promise<UnifiedHealthResponse> {
    return this.getHealthData(HealthDataType.STEPS, options);
  }

  /**
   * Get heart rate data from best available provider
   */
  async getHeartRate(options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    preferredProvider?: string;
  }): Promise<UnifiedHealthResponse> {
    return this.getHealthData(HealthDataType.HEART_RATE, options);
  }

  /**
   * Get sleep data from best available provider
   */
  async getSleepData(options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    preferredProvider?: string;
  }): Promise<UnifiedHealthResponse> {
    return this.getHealthData(HealthDataType.SLEEP, options);
  }

  /**
   * Get calories burned data from best available provider
   */
  async getCalories(options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    preferredProvider?: string;
  }): Promise<UnifiedHealthResponse> {
    return this.getHealthData(HealthDataType.CALORIES_BURNED, options);
  }

  /**
   * Get weight data from best available provider
   */
  async getWeight(options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    preferredProvider?: string;
  }): Promise<UnifiedHealthResponse> {
    return this.getHealthData(HealthDataType.WEIGHT, options);
  }

  /**
   * Get blood pressure data from best available provider
   */
  async getBloodPressure(options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    preferredProvider?: string;
  }): Promise<UnifiedHealthResponse> {
    return this.getHealthData(HealthDataType.BLOOD_PRESSURE, options);
  }

  /**
   * Get oxygen saturation data from best available provider
   */
  async getOxygenSaturation(options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    preferredProvider?: string;
  }): Promise<UnifiedHealthResponse> {
    return this.getHealthData(HealthDataType.OXYGEN_SATURATION, options);
  }

  /**
   * Generic health data retrieval with provider fallback and caching
   */
  async getHealthData(
    dataType: HealthDataType,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      preferredProvider?: string;
    } = {}
  ): Promise<UnifiedHealthResponse> {
    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate = new Date(),
      limit = 100,
      preferredProvider,
    } = options;

    // Check cache first
    const cacheKey = `${dataType}_${startDate.getTime()}_${endDate.getTime()}_${limit}`;
    const cached = this.providerCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`🏥 Returning cached data for ${dataType}`);
      return { ...cached.data, cached: true };
    }

    const range: HealthDataRange = { startDate, endDate, limit };

    // Get providers that support this data type, sorted by priority
    const compatibleProviders = await this.getPermittedProviders(dataType);

    // If preferred provider is specified and available, try it first
    if (preferredProvider && compatibleProviders.some(([name]) => name === preferredProvider)) {
      const preferredIndex = compatibleProviders.findIndex(([name]) => name === preferredProvider);
      if (preferredIndex > 0) {
        const [preferredEntry] = compatibleProviders.splice(preferredIndex, 1);
        compatibleProviders.unshift(preferredEntry);
      }
    }

    if (compatibleProviders.length === 0) {
      console.warn(`🏥 No providers available for data type: ${dataType}`);
      return this.createErrorResponse(dataType, [`No providers available for ${dataType}`]);
    }

    // Try providers in order of priority with retry logic
    for (const [providerName, provider] of compatibleProviders) {
      const result = await this.tryProviderWithRetry(provider, providerName, dataType, range);
      if (result.success) {
        // Cache successful response
        this.providerCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
    }

    // If all providers failed, try fallback strategies
    return this.handleProviderFailure(dataType, cacheKey);
  }

  /**
   * Filter providers to only those with granted permissions for a specific data type.
   */
  private async getPermittedProviders(
    dataType: HealthDataType
  ): Promise<[string, HealthProvider][]> {
    const compatibleProviders = Array.from(this.providers.entries())
      .filter(
        ([name, provider]) =>
          this.activeProviders.has(name) && provider.supportedDataTypes.includes(dataType)
      )
      .sort(([, a], [, b]) => b.priority - a.priority);

    const permittedProviders: [string, HealthProvider][] = [];

    for (const [name, provider] of compatibleProviders) {
      try {
        const permissions = await provider.checkPermissions([dataType]);
        if (permissions.length > 0 && permissions[0].granted) {
          permittedProviders.push([name, provider]);
        }
      } catch (error) {
        console.warn(`🏥 Error checking permissions for ${name}:`, error);
      }
    }

    return permittedProviders;
  }

  /**
   * Try a provider with retry logic
   */
  private async tryProviderWithRetry(
    provider: HealthProvider,
    providerName: string,
    dataType: HealthDataType,
    range: HealthDataRange
  ): Promise<UnifiedHealthResponse> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= this.errorRecoveryStrategy.maxRetries; attempt++) {
      try {
        console.log(`🏥 Attempting to fetch ${dataType} from ${providerName} (attempt ${attempt})`);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeout = this.calculateRetryDelay(attempt) * 2; // 2x retry delay as timeout
          setTimeout(() => reject(new Error(`Provider timeout after ${timeout}ms`)), timeout);
        });

        const data = await Promise.race([provider.readHealthData(dataType, range), timeoutPromise]);

        if (data && data.length > 0) {
          console.log(
            `🏥 Successfully fetched ${data.length} ${dataType} records from ${providerName}`
          );
          return {
            success: true,
            data,
            provider: providerName,
            cached: false,
            metadata: {
              fetchTime: Date.now(),
              source: providerName,
              dataQuality: this.assessDataQuality(data, provider),
            },
          };
        } else {
          console.log(`🏥 No data available from ${providerName} for ${dataType}`);
          // For empty data, still return success but with empty array
          return {
            success: true,
            data: [],
            provider: providerName,
            cached: false,
            metadata: {
              fetchTime: Date.now(),
              source: providerName,
              dataQuality: 'low' as const,
            },
          };
        }
      } catch (error) {
        lastError = error;
        console.error(
          `🏥 Error fetching ${dataType} from ${providerName} (attempt ${attempt}):`,
          error
        );

        // Classify error to determine if we should retry
        const errorType = this.classifyError(error, providerName);
        const canRetry = this.canRetry(errorType);

        if (attempt < this.errorRecoveryStrategy.maxRetries && canRetry) {
          const delay = this.calculateRetryDelay(attempt);
          console.log(`🏥 Retrying ${providerName} in ${delay}ms... (${errorType})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Enhanced error tracking with classification
          sentryTracker.trackServiceError(
            error instanceof Error ? error : `Failed to fetch ${dataType}`,
            {
              service: 'wearableHealthManager',
              action: 'getHealthData',
              additional: {
                dataType,
                providerName,
                attempt,
                errorType,
                canRetry,
                platform: Platform.OS,
                androidVersion: Platform.OS === 'android' ? Platform.Version : null,
                iosVersion: Platform.OS === 'ios' ? Platform.Version : null,
                timestamp: new Date().toISOString(),
                retryExhausted: attempt >= this.errorRecoveryStrategy.maxRetries,
              },
            }
          );

          // Don't break immediately - let the loop complete to track all attempts
          if (!canRetry) {
            console.log(`🏥 Non-retryable error (${errorType}), stopping retries`);
            break;
          }
        }
      }
    }

    return this.createErrorResponse(dataType, [
      `${providerName} failed after ${this.errorRecoveryStrategy.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    ]);
  }

  /**
   * Handle complete provider failure with fallback strategies
   */
  private async handleProviderFailure(
    dataType: HealthDataType,
    cacheKey: string
  ): Promise<UnifiedHealthResponse> {
    // Try cached data as fallback
    if (this.errorRecoveryStrategy.fallbackToCache) {
      const staleCache = this.providerCache.get(cacheKey);
      if (staleCache) {
        console.log(`🏥 Falling back to stale cached data for ${dataType}`);
        return {
          ...staleCache.data,
          cached: true,
          errors: ['Using stale cached data due to provider failures'],
          metadata: {
            ...staleCache.data.metadata,
            dataQuality: 'low' as const,
          },
        };
      }
    }

    // Check if this is a service binding failure and provide specific guidance
    const isServiceBindingFailure = this.isServiceBindingFailure(cacheKey);

    if (isServiceBindingFailure) {
      console.log(
        `🏥 Service binding failure detected for ${dataType} - providing fallback guidance`
      );
      return {
        success: false,
        data: [],
        provider: 'service_binding_failed',
        cached: false,
        errors: [
          'Health Connect service binding failed - common on TECNO and custom Android devices',
          'The service connection was lost or could not be established',
          'Try updating Health Connect app, restarting device, or clearing app cache',
          'Consider using a different health data source if available',
        ],
        metadata: {
          fetchTime: Date.now(),
          source: 'service_binding_failed',
          dataQuality: 'low',
        },
      };
    }

    // No fallback to mock data - return empty data
    console.log(`🏥 No data available for ${dataType} - returning empty result`);
    return {
      success: true,
      data: [],
      provider: 'empty',
      cached: false,
      errors: ['No data available from any provider'],
      metadata: {
        fetchTime: Date.now(),
        source: 'empty',
        dataQuality: 'low',
      },
    };
  }

  /**
   * Check if the failure is due to service binding issues
   */
  private isServiceBindingFailure(cacheKey: string): boolean {
    // This is a simplified check - in a real implementation, you might want to
    // track specific error types per cache key or maintain a failure history
    return cacheKey.includes('google_health_connect') && Platform.OS === 'android';
  }

  /**
   * Create standardized error response
   */
  private createErrorResponse(dataType: HealthDataType, errors: string[]): UnifiedHealthResponse {
    return {
      success: false,
      data: [],
      provider: 'failed',
      cached: false,
      errors,
      metadata: {
        fetchTime: Date.now(),
        source: 'failed',
        dataQuality: 'low',
      },
    };
  }

  /**
   * Assess data quality based on provider and data characteristics
   */
  private assessDataQuality(
    data: HealthMetric[],
    provider: HealthProvider
  ): 'high' | 'medium' | 'low' {
    if (!data || data.length === 0) return 'low';

    // Provider-based quality assessment
    const providerQuality =
      provider.priority >= 90 ? 'high' : provider.priority >= 70 ? 'medium' : 'low';

    // Data recency assessment
    const latestData = data.reduce((latest, metric) =>
      metric.timestamp > latest.timestamp ? metric : latest
    );
    const hoursOld = (Date.now() - latestData.timestamp.getTime()) / (1000 * 60 * 60);
    const recencyQuality = hoursOld <= 2 ? 'high' : hoursOld <= 24 ? 'medium' : 'low';

    // Combine assessments (use lowest quality)
    if (providerQuality === 'low' || recencyQuality === 'low') return 'low';
    if (providerQuality === 'medium' || recencyQuality === 'medium') return 'medium';
    return 'high';
  }

  /**
   * Request permissions for all active providers with enhanced tracking
   */
  async requestPermissions(dataTypes: HealthDataType[]): Promise<boolean> {
    console.log(
      `🏥 Requesting permissions for: [${dataTypes.join(', ')}] across ${this.activeProviders.size} providers`
    );

    // Ensure providers are initialized before requesting permissions
    if (!this.isInitialized) {
      console.log('🏥 Health manager not initialized, initializing before permission request...');
      const initialized = await this.initialize();
      if (!initialized) {
        console.error('🏥 Failed to initialize providers for permission request');
        return false;
      }
    }

    // Clear cached permissions since we're requesting new ones
    const cacheKey = `permissions_${dataTypes.sort().join('_')}`;
    this.permissionCache.delete(cacheKey);
    console.log('🏥 Cleared cached permissions for refresh');

    const permissionResults = new Map<
      string,
      { success: boolean; error?: string; duration: number }
    >();

    const permissionPromises = Array.from(this.activeProviders).map(async providerName => {
      const startTime = Date.now();

      try {
        const provider = this.providers.get(providerName);
        if (!provider) {
          console.warn(`🏥 Provider ${providerName} not found during permission request`);
          permissionResults.set(providerName, {
            success: false,
            error: 'Provider not found',
            duration: Date.now() - startTime,
          });
          return false;
        }

        console.log(`🏥 Requesting permissions from ${providerName}`);

        // Ensure individual provider is initialized before requesting permissions
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          console.log(`🏥 Provider ${providerName} not available, attempting initialization...`);
          const providerInitialized = await provider.initialize();
          if (!providerInitialized) {
            console.warn(`🏥 Failed to initialize ${providerName} for permission request`);
            permissionResults.set(providerName, {
              success: false,
              error: 'Provider initialization failed',
              duration: Date.now() - startTime,
            });
            return false;
          }
        }

        // Add timeout for permission request
        const requestPromise = provider.requestPermissions(dataTypes);
        const timeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Permission request timeout for ${providerName}`)),
            60000
          );
        });

        const success = await Promise.race([requestPromise, timeoutPromise]);
        const duration = Date.now() - startTime;

        console.log(
          `🏥 Permission request for ${providerName} ${success ? 'succeeded' : 'failed'} in ${duration}ms`
        );

        permissionResults.set(providerName, { success, duration });
        return success;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error(
          `🏥 Permission request failed for ${providerName} after ${duration}ms:`,
          errorMessage
        );

        permissionResults.set(providerName, {
          success: false,
          error: errorMessage,
          duration,
        });

        // Track permission request failures
        sentryTracker.trackServiceError(
          error instanceof Error
            ? error
            : new Error(`Permission request failed for ${providerName}`),
          {
            service: 'wearableHealthManager',
            action: 'requestPermissions',
            additional: {
              providerName,
              dataTypes: dataTypes.join(','),
              duration,
              platform: Platform.OS,
              activeProviders: Array.from(this.activeProviders).join(','),
              timestamp: new Date().toISOString(),
            },
          }
        );

        return false;
      }
    });

    const results = await Promise.allSettled(permissionPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

    // Log detailed results
    console.log('🏥 Permission request results by provider:');
    for (const [providerName, result] of permissionResults) {
      console.log(
        `  ${providerName}: ${result.success ? '✓' : '✗'} (${result.duration}ms)${result.error ? ` - ${result.error}` : ''}`
      );
    }

    const finalResult = successCount > 0;
    console.log(
      `🏥 Permission request completed: ${successCount}/${this.activeProviders.size} providers granted permissions - Overall: ${finalResult ? 'SUCCESS' : 'FAILED'}`
    );

    // Track overall permission request outcome
    sentryTracker.trackServiceError(
      new Error(`Health permissions request ${finalResult ? 'succeeded' : 'failed'}`),
      {
        service: 'wearableHealthManager',
        action: 'requestPermissions',
        additional: {
          dataTypes: dataTypes.join(','),
          successCount,
          totalProviders: this.activeProviders.size,
          providerResults: JSON.stringify(Object.fromEntries(permissionResults)),
          finalResult,
          platform: Platform.OS,
          timestamp: new Date().toISOString(),
        },
      }
    );

    return finalResult;
  }

  /**
   * Check permissions across all active providers with caching
   */
  async checkPermissions(dataTypes: HealthDataType[]): Promise<Map<string, HealthPermission[]>> {
    const permissionMap = new Map<string, HealthPermission[]>();
    const cacheKey = `permissions_${dataTypes.sort().join('_')}`;

    // Check cache first
    const cached = this.permissionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.PERMISSION_CACHE_TTL) {
      console.log(`🏥 Returning cached permissions for [${dataTypes.join(', ')}]`);

      // Reconstruct permission map from cached data
      const cachedMap = new Map<string, HealthPermission[]>();
      for (const providerName of this.activeProviders) {
        const providerPermissions = cached.permissions.filter(p => dataTypes.includes(p.type));
        if (providerPermissions.length > 0) {
          cachedMap.set(providerName, providerPermissions);
        }
      }
      return cachedMap;
    }

    console.log(
      `🏥 Checking permissions for [${dataTypes.join(', ')}] across ${this.activeProviders.size} providers`
    );

    const checkPromises = Array.from(this.activeProviders).map(async providerName => {
      try {
        const provider = this.providers.get(providerName);
        if (!provider) {
          console.warn(`🏥 Provider ${providerName} not found`);
          return;
        }

        console.log(`🏥 Checking permissions for ${providerName}`);
        const startTime = Date.now();

        // Add timeout for permission check
        const permissionPromise = provider.checkPermissions(dataTypes);
        const timeoutPromise = new Promise<HealthPermission[]>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Permission check timeout for ${providerName}`)),
            10000
          );
        });

        const permissions = await Promise.race([permissionPromise, timeoutPromise]);
        const duration = Date.now() - startTime;

        console.log(
          `🏥 Permission check for ${providerName} completed in ${duration}ms:`,
          permissions.map(p => `${p.type}=${p.granted}`).join(', ')
        );

        permissionMap.set(providerName, permissions);
      } catch (error) {
        console.error(`🏥 Permission check failed for ${providerName}:`, error);

        // Still add empty permissions to avoid provider being ignored
        const emptyPermissions = dataTypes.map(type => ({
          type,
          read: false,
          write: false,
          granted: false,
          error: error instanceof Error ? error.message : String(error),
          canRetry: true,
        }));
        permissionMap.set(providerName, emptyPermissions);

        // Track permission check failures
        sentryTracker.trackServiceError(
          error instanceof Error ? error : new Error(`Permission check failed for ${providerName}`),
          {
            service: 'wearableHealthManager',
            action: 'checkPermissions',
            additional: {
              providerName,
              dataTypes: dataTypes.join(','),
              platform: Platform.OS,
              activeProviders: Array.from(this.activeProviders).join(','),
              timestamp: new Date().toISOString(),
            },
          }
        );
      }
    });

    await Promise.allSettled(checkPromises);

    // Cache the results if we got any successful responses
    const allPermissions = Array.from(permissionMap.values()).flat();
    if (allPermissions.length > 0) {
      this.permissionCache.set(cacheKey, {
        permissions: allPermissions,
        timestamp: Date.now(),
      });
      console.log(`🏥 Cached permissions for ${allPermissions.length} permission entries`);
    }

    const grantedCount = allPermissions.filter(p => p.granted).length;
    console.log(
      `🏥 Permission check complete: ${grantedCount}/${allPermissions.length} permissions granted across ${permissionMap.size} providers`
    );

    return permissionMap;
  }

  /**
   * Get device information from all active providers
   */
  async getDeviceInfo(): Promise<Map<string, any>> {
    const deviceInfoMap = new Map<string, any>();

    const infoPromises = Array.from(this.activeProviders).map(async providerName => {
      try {
        const provider = this.providers.get(providerName);
        if (!provider) return;

        const deviceInfo = await provider.getDeviceInfo();
        deviceInfoMap.set(providerName, deviceInfo);
      } catch (error) {
        console.error(`🏥 Device info fetch failed for ${providerName}:`, error);
      }
    });

    await Promise.allSettled(infoPromises);
    return deviceInfoMap;
  }

  /**
   * Get list of active providers
   */
  getActiveProviders(): string[] {
    return Array.from(this.activeProviders);
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): HealthProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if manager is initialized and has active providers
   */
  isReady(): boolean {
    return this.isInitialized && this.activeProviders.size > 0;
  }

  /**
   * Update error recovery strategy
   */
  setErrorRecoveryStrategy(strategy: Partial<ErrorRecoveryStrategy>): void {
    this.errorRecoveryStrategy = { ...this.errorRecoveryStrategy, ...strategy };
  }

  /**
   * Cleanup all providers (important for memory management)
   */
  async cleanup(): Promise<void> {
    console.log('🏥 Cleaning up WearableHealthManager...');

    const cleanupPromises = Array.from(this.activeProviders).map(async providerName => {
      try {
        const provider = this.providers.get(providerName);
        if (provider?.cleanup) {
          await provider.cleanup();
        }
      } catch (error) {
        console.error(`🏥 Cleanup failed for ${providerName}:`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);

    this.activeProviders.clear();
    this.providerCache.clear();
    this.isInitialized = false;
    this.initializationPromise = null;

    // Clear all caches
    this.providerCache.clear();
    this.permissionCache.clear();

    console.log('🏥 WearableHealthManager cleanup completed');
  }

  /**
   * Force refresh cache for specific data type
   */
  clearCache(dataType?: HealthDataType): void {
    if (dataType != null) {
      // Clear data cache entries for specific data type
      const dataKeysToDelete = Array.from(this.providerCache.keys()).filter(key =>
        key.startsWith(dataType)
      );
      dataKeysToDelete.forEach(key => this.providerCache.delete(key));

      // Clear permission cache entries that include this data type
      const permissionKeysToDelete = Array.from(this.permissionCache.keys()).filter(key =>
        key.includes(dataType)
      );
      permissionKeysToDelete.forEach(key => this.permissionCache.delete(key));

      console.log(
        `🏥 Cleared ${dataKeysToDelete.length} data cache entries and ${permissionKeysToDelete.length} permission cache entries for ${dataType}`
      );
    } else {
      // Clear all caches
      const dataCount = this.providerCache.size;
      const permissionCount = this.permissionCache.size;

      this.providerCache.clear();
      this.permissionCache.clear();

      console.log(
        `🏥 Cleared all cache: ${dataCount} data entries and ${permissionCount} permission entries`
      );
    }
  }

  /**
   * Get health summary across all data types
   */
  async getHealthSummary(options?: { startDate?: Date; endDate?: Date }): Promise<{
    steps: UnifiedHealthResponse;
    heartRate: UnifiedHealthResponse;
    sleep: UnifiedHealthResponse;
    calories: UnifiedHealthResponse;
  }> {
    const [steps, heartRate, sleep, calories] = await Promise.all([
      this.getSteps(options),
      this.getHeartRate(options),
      this.getSleepData(options),
      this.getCalories(options),
    ]);

    return { steps, heartRate, sleep, calories };
  }

  /**
   * Check platform-specific availability
   */
  private async checkPlatformAvailability(
    provider: HealthProvider,
    providerName: string
  ): Promise<PlatformAvailability> {
    try {
      // iOS-specific checks
      if (Platform.OS === 'ios' && providerName.includes('apple')) {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          return {
            available: false,
            reason: 'HealthKit not available on this device',
            canRetry: false,
            suggestedAction: 'Ensure HealthKit is enabled and device supports health features',
          };
        }
      }

      // Android-specific checks
      if (Platform.OS === 'android' && providerName.includes('google')) {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          return {
            available: false,
            reason: 'Health Connect not available or not installed',
            canRetry: false,
            suggestedAction: 'Install Google Health Connect from Play Store',
          };
        }
      }

      return { available: true, canRetry: true };
    } catch (error) {
      return {
        available: false,
        reason: `Platform availability check failed: ${error}`,
        canRetry: true,
      };
    }
  }

  /**
   * Enhanced error classification for better handling
   */
  private classifyError(error: any, providerName: string): ErrorType {
    const errorMessage = error?.message?.toLowerCase() || error?.toString()?.toLowerCase() || '';
    const errorCode = error?.code || error?.errorCode;

    // Permission-related errors
    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('denied') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authorization') ||
      errorCode === 'PERMISSION_DENIED' ||
      errorCode === 'AUTHORIZATION_DENIED'
    ) {
      return 'PERMISSION_DENIED';
    }

    // Service binding failures (common on TECNO and other custom Android devices)
    if (
      errorMessage.includes('binding to service failed') ||
      errorMessage.includes('service binding failed') ||
      errorMessage.includes('cannot bind to service') ||
      errorMessage.includes('service not found') ||
      errorMessage.includes('bindservice failed') ||
      errorMessage.includes('binding died') ||
      errorMessage.includes('null binding') ||
      errorMessage.includes('underlying_error') ||
      errorCode === 'SERVICE_BINDING_FAILED' ||
      errorCode === 'UNDERLYING_ERROR'
    ) {
      return 'SERVICE_BINDING_FAILED';
    }

    // Device/service unavailable errors
    if (
      errorMessage.includes('device') ||
      errorMessage.includes('unavailable') ||
      errorMessage.includes('not available') ||
      errorMessage.includes('not installed') ||
      errorMessage.includes('not supported') ||
      errorCode === 'SERVICE_UNAVAILABLE' ||
      errorCode === 'DEVICE_NOT_SUPPORTED'
    ) {
      return 'DEVICE_UNAVAILABLE';
    }

    // Network-related errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('offline') ||
      errorCode === 'NETWORK_ERROR' ||
      errorCode === 'TIMEOUT'
    ) {
      return 'NETWORK_ERROR';
    }

    // Rate limiting errors
    if (
      errorMessage.includes('rate') ||
      errorMessage.includes('limit') ||
      errorMessage.includes('throttle') ||
      errorMessage.includes('quota') ||
      errorCode === 'RATE_LIMITED' ||
      errorCode === 'QUOTA_EXCEEDED'
    ) {
      return 'RATE_LIMITED';
    }

    // Data corruption errors
    if (
      errorMessage.includes('corrupt') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('malformed') ||
      errorMessage.includes('parse') ||
      errorCode === 'INVALID_DATA' ||
      errorCode === 'DATA_CORRUPTION'
    ) {
      return 'DATA_CORRUPTION';
    }

    // Platform-specific error patterns
    if (Platform.OS === 'ios') {
      if (
        errorMessage.includes('healthkit') ||
        errorMessage.includes('hk') ||
        errorMessage.includes('health kit') ||
        errorCode === 'HEALTHKIT_ERROR'
      ) {
        return 'DEVICE_UNAVAILABLE';
      }

      // iOS-specific permission errors
      if (
        errorMessage.includes('nshealth') ||
        errorMessage.includes('health data') ||
        errorCode === 'NSHEALTH_ERROR'
      ) {
        return 'PERMISSION_DENIED';
      }
    } else if (Platform.OS === 'android') {
      if (
        errorMessage.includes('health connect') ||
        errorMessage.includes('healthconnect') ||
        errorMessage.includes('health_connect') ||
        errorCode === 'HEALTH_CONNECT_ERROR'
      ) {
        return 'DEVICE_UNAVAILABLE';
      }

      // Android-specific permission errors
      if (
        errorMessage.includes('android.permission') ||
        errorCode === 'ANDROID_PERMISSION_DENIED'
      ) {
        return 'PERMISSION_DENIED';
      }
    }

    // Health Connect specific errors
    if (providerName.includes('health_connect')) {
      if (
        errorMessage.includes('app not installed') ||
        errorMessage.includes('service not found')
      ) {
        return 'DEVICE_UNAVAILABLE';
      }

      if (
        errorMessage.includes('access denied') ||
        errorMessage.includes('insufficient permissions')
      ) {
        return 'PERMISSION_DENIED';
      }
    }

    // HealthKit specific errors
    if (providerName.includes('healthkit')) {
      if (
        errorMessage.includes('health data not available') ||
        errorMessage.includes('health app not installed')
      ) {
        return 'DEVICE_UNAVAILABLE';
      }

      if (
        errorMessage.includes('health data access denied') ||
        errorMessage.includes('privacy settings')
      ) {
        return 'PERMISSION_DENIED';
      }
    }

    // Assume transient for unknown errors
    return 'TRANSIENT';
  }

  /**
   * Determine if error type can be retried
   */
  private canRetry(errorType: ErrorType): boolean {
    const retryableErrors: ErrorType[] = ['TRANSIENT', 'NETWORK_ERROR', 'RATE_LIMITED'];
    const nonRetryableErrors: ErrorType[] = [
      'SERVICE_BINDING_FAILED',
      'PERMISSION_DENIED',
      'DEVICE_UNAVAILABLE',
      'DATA_CORRUPTION',
    ];

    // Explicitly non-retryable errors
    if (nonRetryableErrors.includes(errorType)) {
      return false;
    }

    // Explicitly retryable errors
    if (retryableErrors.includes(errorType)) {
      return true;
    }

    // Default to non-retryable for unknown errors
    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (!this.errorRecoveryStrategy.exponentialBackoff) {
      return this.errorRecoveryStrategy.retryDelay;
    }

    const baseDelay = this.errorRecoveryStrategy.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter

    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Calculate rate limit delay
   */
  private calculateRateLimitDelay(attempt: number): number {
    return Math.min(5000 * attempt, 60000); // 5s, 10s, 15s... up to 60s
  }

  /**
   * Try degraded mode operation
   */
  private async tryDegradedMode(
    dataType: HealthDataType,
    options: any
  ): Promise<UnifiedHealthResponse | null> {
    console.log(`🏥 Attempting degraded mode for ${dataType}`);

    // For some data types, we can provide basic estimates or cached aggregates
    switch (dataType) {
      case HealthDataType.STEPS:
        // Could provide daily average or last known good value
        break;
      case HealthDataType.HEART_RATE:
        // Could provide resting heart rate estimate
        break;
      default:
        return null;
    }

    return null; // No degraded mode available
  }

  /**
   * Get cache statistics including permission cache
   */
  getCacheStats() {
    const dataStats = healthDataCache.getStats();
    const permissionCacheSize = this.permissionCache.size;
    const providerCacheSize = this.providerCache.size;

    // Calculate permission cache age statistics
    const now = Date.now();
    const permissionAges = Array.from(this.permissionCache.values()).map(
      entry => now - entry.timestamp
    );

    const avgPermissionAge =
      permissionAges.length > 0
        ? Math.round(
            permissionAges.reduce((sum, age) => sum + age, 0) / permissionAges.length / 1000
          )
        : 0;

    const stats = {
      ...dataStats,
      permissionCache: {
        size: permissionCacheSize,
        averageAgeSeconds: avgPermissionAge,
        ttlSeconds: this.PERMISSION_CACHE_TTL / 1000,
      },
      providerCache: {
        size: providerCacheSize,
        ttlSeconds: this.CACHE_TTL / 1000,
      },
      activeProviders: Array.from(this.activeProviders),
      isInitialized: this.isInitialized,
    };

    console.log('🏥 Cache statistics:', stats);
    return stats;
  }

  /**
   * Pre-warm cache for better performance
   */
  /**
   * Pre-warm both data and permission caches for better performance
   */
  async preWarmCache(
    commonDataTypes: HealthDataType[] = [HealthDataType.STEPS, HealthDataType.HEART_RATE]
  ) {
    console.log(`🏥 Pre-warming cache for [${commonDataTypes.join(', ')}]`);

    try {
      // Pre-warm permission cache first
      console.log('🏥 Pre-warming permission cache...');
      const permissionStart = Date.now();
      await this.checkPermissions(commonDataTypes);
      console.log(`🏥 Permission cache pre-warmed in ${Date.now() - permissionStart}ms`);

      // Pre-warm data cache
      console.log('🏥 Pre-warming data cache...');
      const dataStart = Date.now();
      await healthDataCache.preWarm(commonDataTypes, async dataType => {
        return this.getHealthData(dataType, {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endDate: new Date(),
          limit: 100,
        });
      });
      console.log(`🏥 Data cache pre-warmed in ${Date.now() - dataStart}ms`);

      console.log('🏥 Cache pre-warming completed successfully');
    } catch (error) {
      console.warn('🏥 Cache pre-warming failed:', error);

      sentryTracker.trackServiceError(
        error instanceof Error ? error : new Error('Cache pre-warming failed'),
        {
          service: 'wearableHealthManager',
          action: 'preWarmCache',
          additional: {
            dataTypes: commonDataTypes.join(','),
            platform: Platform.OS,
            timestamp: new Date().toISOString(),
          },
        }
      );
    }
  }
}

// Export singleton instance
export const wearableHealthManager = WearableHealthManager.getInstance();
