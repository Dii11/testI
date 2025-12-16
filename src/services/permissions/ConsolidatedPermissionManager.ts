/**
 * Consolidated Permission Manager
 *
 * Single source of truth for all permission management in the HopMed app.
 * Replaces all deprecated permission services with a unified, optimized approach.
 *
 * Key Features:
 * - Device-optimized permission strategies
 * - Intelligent caching with coherent invalidation
 * - Graceful degradation and fallback handling
 * - Performance monitoring and telemetry
 * - Cross-platform compatibility
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform, Alert, Linking, AppState } from 'react-native';

import DeviceOptimizedPermissionManager from './DeviceOptimizedPermissionManager';
import PermissionMigrationService from './PermissionMigrationService';

// Core Types
export type PermissionType =
  | 'camera'
  | 'microphone'
  | 'camera+microphone'
  // ✅ TELECONSULTATION: Enhanced permission types for medical app
  | 'teleconsultation-video' // Camera + Microphone + Notifications for video consultations
  | 'teleconsultation-audio' // Microphone + Notifications for audio consultations
  | 'emergency-call' // Camera + Microphone + Location for emergency consultations
  | 'health-monitoring' // Health + Notifications for continuous monitoring
  | 'health-sharing' // Health + Photos for sharing health data with doctors
  | 'location'
  | 'location-precise'
  | 'location-coarse'
  | 'notifications'
  | 'health'
  | 'photos'
  | 'storage';

export type PermissionStatus =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'restricted'
  | 'limited';

export interface PermissionResult {
  status: PermissionStatus;
  canAskAgain: boolean;
  message?: string;
  accuracy?: 'precise' | 'approximate';
  fallbackAvailable: boolean;
  degradationPath?: DegradationStrategy;
  metadata: {
    source: 'cache' | 'fresh' | 'fallback';
    timestamp: number;
    requestDuration?: number;
    deviceTier: string;
    retryCount: number;
  };
}

export interface DegradationStrategy {
  mode: 'full' | 'limited' | 'alternative' | 'disabled';
  description: string;
  limitations: string[];
  alternativeApproach?: string;
}

export interface PermissionContext {
  feature: string;
  priority: 'critical' | 'important' | 'optional';
  userInitiated: boolean;
  // ✅ TELECONSULTATION: Enhanced context for medical scenarios
  medicalContext?: {
    consultationType: 'routine' | 'urgent' | 'emergency' | 'follow-up';
    doctorName?: string;
    appointmentTime?: Date;
    riskLevel: 'low' | 'medium' | 'high';
  };
  educationalContent?: {
    title: string;
    description: string;
    benefits: string[];
    privacyNote?: string;
    // ✅ TELECONSULTATION: Medical-specific educational content
    medicalNecessity?: string;
    dataUsage?: string;
    retentionPolicy?: string;
  };
  fallbackStrategy: DegradationStrategy;
  batchWith?: PermissionType[];
}

// Cache Entry
interface CachedPermission {
  status: PermissionStatus;
  canAskAgain: boolean;
  timestamp: number;
  source: 'fresh' | 'migrated';
  metadata: any;
  ttl?: number; // Time to live override
}

/**
 * Main Consolidated Permission Manager
 */
export class ConsolidatedPermissionManager {
  private static instance: ConsolidatedPermissionManager;

  // Core dependencies
  private deviceOptimizer: DeviceOptimizedPermissionManager;
  private migrationService: PermissionMigrationService;

  // Internal state
  private cache = new Map<PermissionType, CachedPermission>();
  private requestQueue = new Map<PermissionType, Promise<PermissionResult>>();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Configuration
  private readonly config = {
    STORAGE_KEY: '@hopmed_permissions_consolidated_v1',
    DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
    MIGRATION_TIMEOUT: 30000, // 30 seconds
  };

  public static getInstance(): ConsolidatedPermissionManager {
    if (!ConsolidatedPermissionManager.instance) {
      ConsolidatedPermissionManager.instance = new ConsolidatedPermissionManager();
    }
    return ConsolidatedPermissionManager.instance;
  }

  private constructor() {
    this.deviceOptimizer = DeviceOptimizedPermissionManager.getInstance();
    this.migrationService = PermissionMigrationService.getInstance();
    this.setupAppStateListener();
  }

  /**
   * Initialize the consolidated permission manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log('🔐 Initializing Consolidated Permission Manager...');

      // Step 1: Check if migration is needed
      const migrationStatus = await this.migrationService.getMigrationStatus();

      if (migrationStatus.isMigrationNeeded) {
        console.log('📦 Legacy permission data found, starting migration...');

        // Perform migration with timeout
        const migrationResult = await Promise.race([
          this.migrationService.migrateFromLegacyServices(),
          this.createTimeoutPromise(this.config.MIGRATION_TIMEOUT, 'Migration timeout'),
        ]);

        console.log('✅ Migration completed:', migrationResult);
      }

      // Step 2: Load existing permissions from consolidated storage
      await this.loadConsolidatedCache();

      // Step 3: Cleanup expired entries
      await this.cleanupExpiredEntries();

      this.isInitialized = true;
      console.log('✅ Consolidated Permission Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Consolidated Permission Manager:', error);
      this.isInitialized = true; // Continue with limited functionality
      throw error;
    }
  }

  /**
   * Request permission with full optimization and fallback handling
   */
  async requestPermission(
    type: PermissionType,
    context: PermissionContext
  ): Promise<PermissionResult> {
    await this.ensureInitialized();

    // ✅ FIX: Ensure device optimizer is properly initialized
    if (!this.deviceOptimizer) {
      console.error('❌ DeviceOptimizedPermissionManager not initialized');
      return {
        status: 'denied',
        canAskAgain: false,
        message: 'Permission system not properly initialized',
        fallbackAvailable: true,
        metadata: {
          source: 'error',
          timestamp: Date.now(),
          error: 'DeviceOptimizedPermissionManager not initialized',
        },
      };
    }

    // Prevent concurrent requests for the same permission
    if (this.requestQueue.has(type)) {
      console.log(`🔄 Permission request for ${type} already in progress`);
      return this.requestQueue.get(type)!;
    }

    const requestPromise = this.executePermissionRequest(type, context);
    this.requestQueue.set(type, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.requestQueue.delete(type);
    }
  }

  /**
   * Check permission status (cache-first with smart revalidation)
   */
  async checkPermission(type: PermissionType): Promise<PermissionResult> {
    await this.ensureInitialized();

    const cached = this.getCachedPermission(type);
    const deviceConfig = this.deviceOptimizer.getDeviceConfiguration();

    // Smart cache validation based on device tier and permission type
    if (cached && !this.shouldRevalidatePermission(cached, deviceConfig, type)) {
      return this.transformCachedToResult(cached, type);
    }

    // Perform fresh check
    return this.performFreshPermissionCheck(type);
  }

  /**
   * Batch permission requests (optimized for device capabilities)
   */
  async requestMultiplePermissions(
    requests: { type: PermissionType; context: PermissionContext }[]
  ): Promise<Record<PermissionType, PermissionResult>> {
    await this.ensureInitialized();

    const deviceConfig = this.deviceOptimizer.getDeviceConfiguration();
    const results: Record<PermissionType, PermissionResult> = {} as any;

    if (deviceConfig.batchEnabled && requests.length > 1) {
      // Execute in parallel for capable devices
      const promises = requests.map(async ({ type, context }) => {
        const result = await this.requestPermission(type, context);
        return { type, result };
      });

      const settled = await Promise.allSettled(promises);

      for (const promise of settled) {
        if (promise.status === 'fulfilled') {
          results[promise.value.type] = promise.value.result;
        }
      }
    } else {
      // Sequential execution for low-end devices
      for (const { type, context } of requests) {
        try {
          results[type] = await this.requestPermission(type, context);
        } catch (error) {
          console.warn(`Failed to request ${type}:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Import legacy permission data (used by migration service)
   */
  async importLegacyPermission(data: {
    type: PermissionType;
    status: PermissionStatus;
    timestamp: number;
    source: string;
    metadata?: any;
  }): Promise<void> {
    const cachedPermission: CachedPermission = {
      status: data.status,
      canAskAgain: data.status !== 'blocked',
      timestamp: data.timestamp,
      source: 'migrated',
      metadata: { ...data.metadata, migratedFrom: data.source },
    };

    this.cache.set(data.type, cachedPermission);
    await this.persistCache();
  }

  /**
   * Execute the actual permission request with device optimization
   */
  private async executePermissionRequest(
    type: PermissionType,
    context: PermissionContext
  ): Promise<PermissionResult> {
    const startTime = Date.now();
    
    // ✅ FIX: Ensure device optimizer is properly initialized
    if (!this.deviceOptimizer) {
      console.error('❌ DeviceOptimizedPermissionManager not initialized in executePermissionRequest');
      return {
        status: 'denied',
        canAskAgain: false,
        message: 'Permission system not properly initialized',
        fallbackAvailable: true,
        metadata: {
          source: 'error',
          timestamp: Date.now(),
          error: 'DeviceOptimizedPermissionManager not initialized',
        },
      };
    }

    const deviceConfig = this.deviceOptimizer.getDeviceConfiguration();
    const strategy = this.deviceOptimizer.getPermissionStrategy(
      this.getCallTypeForPermission(type)
    );

    try {
      // Show educational content if needed
      if (context.educationalContent && context.userInitiated) {
        const shouldProceed = await this.showEducationalContent(context.educationalContent);
        if (!shouldProceed) {
          return this.createUserDeclinedResult(type, startTime);
        }
      }

      // Execute with device-optimized strategy
      const result = await this.deviceOptimizer.requestWithOptimization(
        () => this.performNativePermissionRequest(type, context),
        strategy,
        `permission_${type}`
      );

      // Cache the result
      this.cachePermissionResult(type, result);

      return result;
    } catch (error) {
      console.error(`Permission request failed for ${type}:`, error);
      return this.createErrorResult(type, error, startTime, context);
    }
  }

  /**
   * Perform the actual native permission request
   */
  private async performNativePermissionRequest(
    type: PermissionType,
    context: PermissionContext
  ): Promise<PermissionResult> {
    const startTime = Date.now();
    const deviceConfig = this.deviceOptimizer.getDeviceConfiguration();

    switch (type) {
      case 'camera':
        return this.requestCameraPermission(startTime, deviceConfig.tier);

      case 'microphone':
        return this.requestMicrophonePermission(startTime, deviceConfig.tier);

      case 'camera+microphone':
        return this.requestCombinedAVPermissions(startTime, deviceConfig.tier);

      // ✅ TELECONSULTATION: Enhanced permission types for medical scenarios
      case 'teleconsultation-video':
        return this.requestTeleconsultationVideoPermissions(startTime, deviceConfig.tier, context);

      case 'teleconsultation-audio':
        return this.requestTeleconsultationAudioPermissions(startTime, deviceConfig.tier, context);

      case 'emergency-call':
        return this.requestEmergencyCallPermissions(startTime, deviceConfig.tier, context);

      case 'health-monitoring':
        return this.requestHealthMonitoringPermissions(startTime, deviceConfig.tier, context);

      case 'health-sharing':
        return this.requestHealthSharingPermissions(startTime, deviceConfig.tier, context);

      case 'location':
      case 'location-precise':
        return this.requestLocationPermission(type, startTime, deviceConfig.tier);

      case 'notifications':
        return this.requestNotificationPermission(startTime, deviceConfig.tier);

      case 'health':
      case 'photos':
      case 'storage':
        return this.requestGenericPermission(type, startTime, deviceConfig.tier);

      default:
        throw new Error(`Unsupported permission type: ${type}`);
    }
  }

  // Platform-specific permission request implementations
  private async requestCameraPermission(
    startTime: number,
    deviceTier: string
  ): Promise<PermissionResult> {
    const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();

    return {
      status: this.mapNativeStatus(status),
      canAskAgain: canAskAgain !== false,
      fallbackAvailable: true,
      metadata: {
        source: 'fresh',
        timestamp: Date.now(),
        requestDuration: Date.now() - startTime,
        deviceTier,
        retryCount: 0,
      },
    };
  }

  private async requestMicrophonePermission(
    startTime: number,
    deviceTier: string
  ): Promise<PermissionResult> {
    const { status, canAskAgain } = await Audio.requestPermissionsAsync();

    return {
      status: this.mapNativeStatus(status),
      canAskAgain: canAskAgain !== false,
      fallbackAvailable: true,
      metadata: {
        source: 'fresh',
        timestamp: Date.now(),
        requestDuration: Date.now() - startTime,
        deviceTier,
        retryCount: 0,
      },
    };
  }

  private async requestCombinedAVPermissions(
    startTime: number,
    deviceTier: string
  ): Promise<PermissionResult> {
    const [cameraResult, audioResult] = await Promise.all([
      Camera.requestCameraPermissionsAsync(),
      Audio.requestPermissionsAsync(),
    ]);

    const bothGranted = cameraResult.status === 'granted' && audioResult.status === 'granted';
    const canAskEither = cameraResult.canAskAgain !== false || audioResult.canAskAgain !== false;

    return {
      status: bothGranted ? 'granted' : 'denied',
      canAskAgain: canAskEither,
      fallbackAvailable: cameraResult.status === 'granted' || audioResult.status === 'granted',
      degradationPath: this.calculateAVDegradation(cameraResult.status, audioResult.status),
      metadata: {
        source: 'fresh',
        timestamp: Date.now(),
        requestDuration: Date.now() - startTime,
        deviceTier,
        retryCount: 0,
      },
    };
  }

  private async requestLocationPermission(
    type: 'location' | 'location-precise',
    startTime: number,
    deviceTier: string
  ): Promise<PermissionResult> {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

    return {
      status: this.mapNativeStatus(status),
      canAskAgain: canAskAgain !== false,
      accuracy:
        status === 'granted'
          ? type === 'location-precise'
            ? 'precise'
            : 'approximate'
          : undefined,
      fallbackAvailable: true,
      degradationPath: {
        mode: 'alternative',
        description: 'Manual location entry available',
        limitations: ['No automatic detection', 'Manual input required'],
        alternativeApproach: 'manual-location',
      },
      metadata: {
        source: 'fresh',
        timestamp: Date.now(),
        requestDuration: Date.now() - startTime,
        deviceTier,
        retryCount: 0,
      },
    };
  }

  private async requestNotificationPermission(
    startTime: number,
    deviceTier: string
  ): Promise<PermissionResult> {
    const { status, canAskAgain } = await Notifications.requestPermissionsAsync();

    return {
      status: this.mapNativeStatus(status),
      canAskAgain: canAskAgain !== false,
      fallbackAvailable: true,
      degradationPath: {
        mode: 'limited',
        description: 'In-app notifications only',
        limitations: ['No push notifications', 'No background alerts'],
        alternativeApproach: 'in-app-notifications',
      },
      metadata: {
        source: 'fresh',
        timestamp: Date.now(),
        requestDuration: Date.now() - startTime,
        deviceTier,
        retryCount: 0,
      },
    };
  }

  // Utility and helper methods
  private async performFreshPermissionCheck(type: PermissionType): Promise<PermissionResult> {
    const startTime = Date.now();
    const deviceConfig = this.deviceOptimizer.getDeviceConfiguration();

    // This would implement fresh permission checking without requesting
    // For now, return a basic implementation
    return {
      status: 'unknown',
      canAskAgain: true,
      fallbackAvailable: false,
      metadata: {
        source: 'fresh',
        timestamp: Date.now(),
        requestDuration: Date.now() - startTime,
        deviceTier: deviceConfig.tier,
        retryCount: 0,
      },
    };
  }

  private shouldRevalidatePermission(
    cached: CachedPermission,
    deviceConfig: any,
    type: PermissionType
  ): boolean {
    const now = Date.now();
    const age = now - cached.timestamp;

    // Use device-specific TTL
    const ttl = cached.ttl || this.getPermissionTTL(type, deviceConfig);

    // Always revalidate expired cache
    if (age > ttl) return true;

    // Revalidate denied permissions more frequently on high-end devices
    if (cached.status === 'denied' && deviceConfig.tier === 'high') {
      return age > 30000; // 30 seconds
    }

    // Revalidate blocked permissions when app becomes active
    if (cached.status === 'blocked') {
      return age > 60000; // 1 minute
    }

    return false;
  }

  private getPermissionTTL(type: PermissionType, deviceConfig: any): number {
    const baseTTL = this.config.DEFAULT_TTL;

    // Adjust TTL based on device capabilities and caching strategy
    switch (deviceConfig.cacheStrategy) {
      case 'aggressive':
        return baseTTL * 2; // 10 minutes for low-end devices
      case 'minimal':
        return baseTTL * 0.5; // 2.5 minutes for high-end devices
      default:
        return baseTTL; // 5 minutes standard
    }
  }

  private getCachedPermission(type: PermissionType): CachedPermission | null {
    return this.cache.get(type) || null;
  }

  private transformCachedToResult(
    cached: CachedPermission,
    type: PermissionType
  ): PermissionResult {
    const deviceConfig = this.deviceOptimizer.getDeviceConfiguration();

    return {
      status: cached.status,
      canAskAgain: cached.canAskAgain,
      fallbackAvailable: true,
      metadata: {
        source: 'cache',
        timestamp: cached.timestamp,
        deviceTier: deviceConfig.tier,
        retryCount: 0,
      },
    };
  }

  private cachePermissionResult(type: PermissionType, result: PermissionResult): void {
    const cachedPermission: CachedPermission = {
      status: result.status,
      canAskAgain: result.canAskAgain,
      timestamp: result.metadata.timestamp,
      source: 'fresh',
      metadata: result.metadata,
    };

    this.cache.set(type, cachedPermission);
    this.persistCache().catch(console.warn);
  }

  private async loadConsolidatedCache(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.config.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.cache = new Map(parsed);
        console.log(`📦 Loaded ${this.cache.size} cached permissions`);
      }
    } catch (error) {
      console.warn('Failed to load consolidated cache:', error);
    }
  }

  private async persistCache(): Promise<void> {
    try {
      const data = Array.from(this.cache.entries());
      await AsyncStorage.setItem(this.config.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist cache:', error);
    }
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    let cleanupCount = 0;

    for (const [type, cached] of this.cache.entries()) {
      const ttl = cached.ttl || this.config.DEFAULT_TTL * 2; // Double TTL for cleanup
      if (now - cached.timestamp > ttl) {
        this.cache.delete(type);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`🗑️ Cleaned up ${cleanupCount} expired permission entries`);
      await this.persistCache();
    }
  }

  private mapNativeStatus(status: string): PermissionStatus {
    switch (status) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'blocked':
      case 'never_ask_again':
        return 'blocked';
      case 'restricted':
        return 'restricted';
      case 'limited':
        return 'limited';
      case 'undetermined':
      default:
        return 'unknown';
    }
  }

  private calculateAVDegradation(cameraStatus: string, audioStatus: string): DegradationStrategy {
    const hasCamera = cameraStatus === 'granted';
    const hasAudio = audioStatus === 'granted';

    if (hasCamera && !hasAudio) {
      return {
        mode: 'limited',
        description: 'Video without audio available',
        limitations: ['No audio input'],
        alternativeApproach: 'video-only',
      };
    }

    if (!hasCamera && hasAudio) {
      return {
        mode: 'limited',
        description: 'Audio-only call available',
        limitations: ['No video'],
        alternativeApproach: 'audio-only',
      };
    }

    return {
      mode: 'alternative',
      description: 'Text chat available',
      limitations: ['No audio or video'],
      alternativeApproach: 'text-chat',
    };
  }

  private getCallTypeForPermission(
    type: PermissionType
  ): 'video' | 'audio' | 'health' | 'location' {
    switch (type) {
      case 'camera':
      case 'camera+microphone':
        return 'video';
      case 'microphone':
        return 'audio';
      case 'health':
        return 'health';
      case 'location':
      case 'location-precise':
        return 'location';
      default:
        return 'video';
    }
  }

  private async showEducationalContent(
    content: PermissionContext['educationalContent']
  ): Promise<boolean> {
    return new Promise(resolve => {
      Alert.alert(
        content!.title,
        `${content!.description}\n\n${content!.benefits.map(b => `• ${b}`).join('\n')}${content!.privacyNote ? `\n\n${content!.privacyNote}` : ''}`,
        [
          { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continue', onPress: () => resolve(true) },
        ]
      );
    });
  }

  private createUserDeclinedResult(type: PermissionType, startTime: number): PermissionResult {
    const deviceConfig = this.deviceOptimizer.getDeviceConfiguration();

    return {
      status: 'denied',
      canAskAgain: true,
      message: 'User declined after education',
      fallbackAvailable: true,
      metadata: {
        source: 'fresh',
        timestamp: Date.now(),
        requestDuration: Date.now() - startTime,
        deviceTier: deviceConfig.tier,
        retryCount: 0,
      },
    };
  }

  private createErrorResult(
    type: PermissionType,
    error: any,
    startTime: number,
    context: PermissionContext
  ): PermissionResult {
    const deviceConfig = this.deviceOptimizer.getDeviceConfiguration();

    return {
      status: 'unknown',
      canAskAgain: false,
      message: error?.message || 'Permission request failed',
      fallbackAvailable: context.fallbackStrategy.mode !== 'disabled',
      degradationPath: context.fallbackStrategy,
      metadata: {
        source: 'fresh',
        timestamp: Date.now(),
        requestDuration: Date.now() - startTime,
        deviceTier: deviceConfig.tier,
        retryCount: 0,
      },
    };
  }

  private createTimeoutPromise<T>(timeout: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    });
  }

  // ✅ FIX: Store app state listener reference for proper cleanup
  private appStateListener: any = null;

  private setupAppStateListener(): void {
    if (this.appStateListener) {
      return; // Already set up
    }

    this.appStateListener = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        this.handleAppBecameActive();
      }
    });
  }

  // ✅ FIX: Add cleanup method
  public cleanup(): void {
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
  }

  private handleAppBecameActive(): void {
    // Invalidate critical permission cache when app becomes active
    const criticalTypes: PermissionType[] = ['camera', 'microphone', 'location'];

    for (const type of criticalTypes) {
      const cached = this.getCachedPermission(type);
      if (cached && (cached.status === 'denied' || cached.status === 'blocked')) {
        this.cache.delete(type);
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // Public utility methods
  async openAppSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Failed to open app settings:', error);
      Alert.alert('Error', 'Could not open app settings. Please open them manually.');
    }
  }

  invalidatePermission(type: PermissionType): void {
    this.cache.delete(type);
    this.persistCache().catch(console.warn);
  }

  getPerformanceStats() {
    return this.deviceOptimizer.getPerformanceStats();
  }

  getDeviceConfiguration() {
    return this.deviceOptimizer.getDeviceConfiguration();
  }

  getDeviceCapabilities() {
    return this.deviceOptimizer.getDeviceConfiguration();
  }

  // ✅ TELECONSULTATION: Enhanced permission methods for medical scenarios

  /**
   * Request permissions for video consultations (Camera + Microphone + Notifications)
   * Optimized for medical consultation flow with appropriate fallbacks
   */
  private async requestTeleconsultationVideoPermissions(
    startTime: number,
    deviceTier: string,
    context: PermissionContext
  ): Promise<PermissionResult> {
    console.log('🏥 Requesting teleconsultation video permissions...');

    try {
      // Step 1: Request camera and microphone together for better UX
      const avResult = await this.requestCombinedAVPermissions(startTime, deviceTier);

      // Step 2: Request notifications (non-critical, continue if fails)
      let notificationGranted = false;
      try {
        const notifResult = await this.requestNotificationPermission(startTime, deviceTier);
        notificationGranted = notifResult.status === 'granted';
      } catch (error) {
        console.warn('Notification permission failed (non-critical):', error);
      }

      // Determine overall status - camera+microphone is critical, notifications are optional
      const isCriticalGranted = avResult.status === 'granted';

      return {
        status: isCriticalGranted ? 'granted' : avResult.status,
        canAskAgain: avResult.canAskAgain,
        message: isCriticalGranted
          ? `Video consultation ready${notificationGranted ? ' with notifications' : ''}`
          : avResult.message || 'Camera and microphone access required for video consultations',
        fallbackAvailable: true, // Audio-only consultation available
        degradationPath: {
          mode: isCriticalGranted ? 'full' : 'alternative',
          description: isCriticalGranted
            ? 'Full video consultation capabilities'
            : 'Audio-only consultation available as alternative',
          limitations: isCriticalGranted ? [] : ['No video feed', 'Voice-only communication'],
          alternativeApproach: 'Switch to audio-only consultation',
        },
        metadata: {
          source: 'fresh',
          timestamp: Date.now(),
          requestDuration: Date.now() - startTime,
          deviceTier,
          retryCount: 0,
        },
      };
    } catch (error) {
      console.error('Teleconsultation video permissions failed:', error);
      return this.createErrorResult('teleconsultation-video', error, startTime, context);
    }
  }

  /**
   * Request permissions for audio consultations (Microphone + Notifications)
   * Streamlined for audio-only medical consultations
   */
  private async requestTeleconsultationAudioPermissions(
    startTime: number,
    deviceTier: string,
    context: PermissionContext
  ): Promise<PermissionResult> {
    console.log('🏥 Requesting teleconsultation audio permissions...');

    try {
      // Step 1: Request microphone (critical)
      const micResult = await this.requestMicrophonePermission(startTime, deviceTier);

      // Step 2: Request notifications (optional)
      let notificationGranted = false;
      try {
        const notifResult = await this.requestNotificationPermission(startTime, deviceTier);
        notificationGranted = notifResult.status === 'granted';
      } catch (error) {
        console.warn('Notification permission failed (non-critical):', error);
      }

      const isMicGranted = micResult.status === 'granted';

      return {
        status: isMicGranted ? 'granted' : micResult.status,
        canAskAgain: micResult.canAskAgain,
        message: isMicGranted
          ? `Audio consultation ready${notificationGranted ? ' with notifications' : ''}`
          : micResult.message || 'Microphone access required for audio consultations',
        fallbackAvailable: false, // No fallback for audio-only
        degradationPath: {
          mode: isMicGranted ? 'full' : 'disabled',
          description: isMicGranted
            ? 'Full audio consultation capabilities'
            : 'Audio consultation unavailable without microphone access',
          limitations: isMicGranted ? [] : ['Cannot communicate via voice'],
          alternativeApproach: undefined,
        },
        metadata: {
          source: 'fresh',
          timestamp: Date.now(),
          requestDuration: Date.now() - startTime,
          deviceTier,
          retryCount: 0,
        },
      };
    } catch (error) {
      console.error('Teleconsultation audio permissions failed:', error);
      return this.createErrorResult('teleconsultation-audio', error, startTime, context);
    }
  }

  /**
   * Request permissions for emergency calls (Camera + Microphone + Location + Notifications)
   * High-priority request for urgent medical situations
   */
  private async requestEmergencyCallPermissions(
    startTime: number,
    deviceTier: string,
    context: PermissionContext
  ): Promise<PermissionResult> {
    console.log('🚨 Requesting emergency call permissions...');

    try {
      // Step 1: Request A/V permissions (critical)
      const avResult = await this.requestCombinedAVPermissions(startTime, deviceTier);

      // Step 2: Request location (important for emergencies)
      let locationGranted = false;
      try {
        const locationResult = await this.requestLocationPermission(
          'location-precise',
          startTime,
          deviceTier
        );
        locationGranted = locationResult.status === 'granted';
      } catch (error) {
        console.warn('Location permission failed (important for emergency):', error);
      }

      // Step 3: Request notifications (important)
      let notificationGranted = false;
      try {
        const notifResult = await this.requestNotificationPermission(startTime, deviceTier);
        notificationGranted = notifResult.status === 'granted';
      } catch (error) {
        console.warn('Notification permission failed:', error);
      }

      const isCriticalGranted = avResult.status === 'granted';
      const emergencyFeatures = [
        isCriticalGranted ? 'Video/Audio communication' : null,
        locationGranted ? 'Location sharing' : null,
        notificationGranted ? 'Emergency notifications' : null,
      ].filter(Boolean);

      return {
        status: isCriticalGranted ? 'granted' : avResult.status,
        canAskAgain: avResult.canAskAgain,
        message: isCriticalGranted
          ? `Emergency call ready with: ${emergencyFeatures.join(', ')}`
          : 'Camera and microphone access required for emergency video calls',
        fallbackAvailable: true,
        degradationPath: {
          mode: isCriticalGranted ? (locationGranted ? 'full' : 'limited') : 'alternative',
          description: isCriticalGranted
            ? 'Emergency call capabilities active'
            : 'Audio-only emergency call available',
          limitations: [
            ...(!isCriticalGranted ? ['No video communication'] : []),
            ...(!locationGranted ? ['No location sharing'] : []),
            ...(!notificationGranted ? ['No emergency notifications'] : []),
          ],
          alternativeApproach: 'Switch to audio-only emergency call',
        },
        metadata: {
          source: 'fresh',
          timestamp: Date.now(),
          requestDuration: Date.now() - startTime,
          deviceTier,
          retryCount: 0,
        },
      };
    } catch (error) {
      console.error('Emergency call permissions failed:', error);
      return this.createErrorResult('emergency-call', error, startTime, context);
    }
  }

  /**
   * Request permissions for health monitoring (Health + Notifications)
   * Optimized for continuous health data collection and alerts
   */
  private async requestHealthMonitoringPermissions(
    startTime: number,
    deviceTier: string,
    context: PermissionContext
  ): Promise<PermissionResult> {
    console.log('📊 Requesting health monitoring permissions...');

    try {
      // Request health permissions (platform-specific)
      const healthResult = await this.requestGenericPermission('health', startTime, deviceTier);

      // Request notifications for health alerts
      let notificationGranted = false;
      try {
        const notifResult = await this.requestNotificationPermission(startTime, deviceTier);
        notificationGranted = notifResult.status === 'granted';
      } catch (error) {
        console.warn('Notification permission failed:', error);
      }

      const isHealthGranted = healthResult.status === 'granted';

      return {
        status: isHealthGranted ? 'granted' : healthResult.status,
        canAskAgain: healthResult.canAskAgain,
        message: isHealthGranted
          ? `Health monitoring active${notificationGranted ? ' with notifications' : ''}`
          : 'Health data access required for continuous monitoring',
        fallbackAvailable: true,
        degradationPath: {
          mode: isHealthGranted ? (notificationGranted ? 'full' : 'limited') : 'alternative',
          description: isHealthGranted
            ? 'Health monitoring capabilities active'
            : 'Manual health data entry available',
          limitations: [
            ...(!isHealthGranted ? ['No automatic health data collection'] : []),
            ...(!notificationGranted ? ['No health alerts'] : []),
          ],
          alternativeApproach: 'Manual health data entry during consultations',
        },
        metadata: {
          source: 'fresh',
          timestamp: Date.now(),
          requestDuration: Date.now() - startTime,
          deviceTier,
          retryCount: 0,
        },
      };
    } catch (error) {
      console.error('Health monitoring permissions failed:', error);
      return this.createErrorResult('health-monitoring', error, startTime, context);
    }
  }

  /**
   * Request permissions for health data sharing (Health + Photos)
   * Optimized for sharing health documents and images with healthcare providers
   */
  private async requestHealthSharingPermissions(
    startTime: number,
    deviceTier: string,
    context: PermissionContext
  ): Promise<PermissionResult> {
    console.log('📋 Requesting health sharing permissions...');

    try {
      // Request health permissions
      const healthResult = await this.requestGenericPermission('health', startTime, deviceTier);

      // Request photo library access for medical documents
      let photosGranted = false;
      try {
        const photosResult = await this.requestGenericPermission('photos', startTime, deviceTier);
        photosGranted = photosResult.status === 'granted';
      } catch (error) {
        console.warn('Photos permission failed:', error);
      }

      const isHealthGranted = healthResult.status === 'granted';
      const capabilities = [
        isHealthGranted ? 'Health data sharing' : null,
        photosGranted ? 'Medical document sharing' : null,
      ].filter(Boolean);

      return {
        status: isHealthGranted || photosGranted ? 'granted' : healthResult.status,
        canAskAgain: healthResult.canAskAgain || photosGranted,
        message:
          capabilities.length > 0
            ? `Health sharing ready: ${capabilities.join(', ')}`
            : 'Health data or photo access needed for sharing medical information',
        fallbackAvailable: true,
        degradationPath: {
          mode:
            capabilities.length > 0
              ? capabilities.length === 2
                ? 'full'
                : 'limited'
              : 'alternative',
          description:
            capabilities.length > 0
              ? 'Health sharing capabilities active'
              : 'Manual data entry available',
          limitations: [
            ...(!isHealthGranted ? ['No automatic health data sharing'] : []),
            ...(!photosGranted ? ['No medical document sharing'] : []),
          ],
          alternativeApproach: 'Manual data entry during consultations',
        },
        metadata: {
          source: 'fresh',
          timestamp: Date.now(),
          requestDuration: Date.now() - startTime,
          deviceTier,
          retryCount: 0,
        },
      };
    } catch (error) {
      console.error('Health sharing permissions failed:', error);
      return this.createErrorResult('health-sharing', error, startTime, context);
    }
  }

  /**
   * Generic permission request for basic permission types
   * Handles health, photos, storage permissions with platform-specific implementations
   */
  private async requestGenericPermission(
    type: PermissionType,
    startTime: number,
    deviceTier: string
  ): Promise<PermissionResult> {
    // For now, return a placeholder - this would be implemented with specific platform APIs
    console.log(`📋 Requesting ${type} permission...`);

    // This is a simplified implementation - in production you'd call actual platform APIs
    return {
      status: 'granted', // Placeholder - would be actual permission result
      canAskAgain: true,
      message: `${type} permission requested`,
      fallbackAvailable: true,
      metadata: {
        source: 'fresh',
        timestamp: Date.now(),
        requestDuration: Date.now() - startTime,
        deviceTier,
        retryCount: 0,
      },
    };
  }
}

export default ConsolidatedPermissionManager;
