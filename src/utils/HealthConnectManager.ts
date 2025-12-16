/**
 * HealthConnectManager - Centralized Health Connect API Manager
 *
 * CRITICAL FIX FOR: RemoteException crashes from concurrent service bindings
 *
 * Problem:
 * - Multiple hooks calling getGrantedPermissions() simultaneously
 * - Health Connect service can't handle concurrent IPC connections
 * - Causes "Binding to service failed" / "Binding died" native crashes
 *
 * Solution:
 * - Singleton pattern ensures only ONE permission check at a time
 * - Result caching prevents redundant API calls
 * - Queue system serializes all Health Connect operations
 * - Retry logic with exponential backoff handles transient failures
 * - Graceful error handling prevents app crashes
 */

import {
  initialize,
  getGrantedPermissions,
  requestPermission,
  getSdkStatus,
  SdkAvailabilityStatus,
  openHealthConnectSettings,
} from 'react-native-health-connect';
import type { Permission } from 'react-native-health-connect';
import { Platform } from 'react-native';
import { sentryTracker } from './sentryErrorTracker';

interface QueuedOperation<T> {
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  retries: number;
}

interface PermissionCache {
  permissions: any[]; // Use any[] to handle different permission types
  timestamp: number;
  isValid: boolean;
}

class HealthConnectManager {
  private static instance: HealthConnectManager;

  // State
  private isInitialized = false;
  private isInitializing = false;
  private permissionCache: PermissionCache | null = null;

  // Queue management
  private operationQueue: QueuedOperation<any>[] = [];
  private isProcessingQueue = false;

  // Configuration
  private readonly CACHE_DURATION_MS = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_DELAY_MS = 1000; // ✅ INCREASED: 1 second delay for first-launch stability
  private readonly BASE_RETRY_DELAY_MS = 1000; // Base delay for retry exponential backoff
  
  // Circuit breaker pattern
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private lastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_RESET_MS = 30000; // 30 seconds

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): HealthConnectManager {
    if (!HealthConnectManager.instance) {
      HealthConnectManager.instance = new HealthConnectManager();
    }
    return HealthConnectManager.instance;
  }

  /**
   * Initialize Health Connect (idempotent)
   * Safe to call multiple times
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.log('⏭️ [HealthConnectManager] Already initialized');
      return true;
    }

    if (this.isInitializing) {
      console.log('⏳ [HealthConnectManager] Initialization in progress, waiting...');
      // Wait for ongoing initialization
      return this.waitForInitialization();
    }

    this.isInitializing = true;

    try {
      console.log('🔧 [HealthConnectManager] Initializing Health Connect...');

      // ✅ CRITICAL: Check SDK status FIRST (Android 14+ detection)
      console.log('🔍 [HealthConnectManager] Checking SDK status...');
      const sdkStatus = await getSdkStatus();
      const androidVersion = Platform.Version as number;

      console.log(`📱 [HealthConnectManager] Android ${androidVersion}, SDK Status: ${sdkStatus}`);

      // Handle different SDK statuses
      if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        if (androidVersion >= 34) {
          // Android 14+ should have system Health Connect
          const errorMsg = 'Health Connect is unavailable on your device. Please check system settings.';
          console.error(`❌ [HealthConnectManager] ${errorMsg}`);
          throw new Error(errorMsg);
        } else {
          // Android 10-13 needs the app
          const errorMsg = 'Health Connect app not installed. Please install it from Google Play Store.';
          console.error(`❌ [HealthConnectManager] ${errorMsg}`);
          throw new Error(errorMsg);
        }
      }

      if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        const errorMsg = 'Health Connect needs an update. Please update it from Google Play Store.';
        console.error(`❌ [HealthConnectManager] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`✅ [HealthConnectManager] SDK Status: ${sdkStatus} (AVAILABLE)`);

      // ✅ CRITICAL FIX: Add initialization delay for first-launch stability
      // This prevents race conditions when multiple hooks initialize simultaneously
      console.log('⏱️ [HealthConnectManager] Adding 1s delay for first-launch stability...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const initResult = await initialize();

      if (!initResult) {
        throw new Error('Health Connect initialization returned false');
      }

      this.isInitialized = true;
      this.consecutiveFailures = 0; // Reset failure counter on successful init
      console.log('✅ [HealthConnectManager] Health Connect initialized successfully');

      return true;
    } catch (error) {
      console.error('❌ [HealthConnectManager] Initialization failed:', error);

      sentryTracker.trackServiceError(
        error instanceof Error ? error : new Error(`Health Connect init failed: ${error}`),
        {
          service: 'HealthConnectManager',
          action: 'initialize',
          additional: {
            error: String(error),
            androidVersion: Platform.Version,
          }
        }
      );

      this.isInitialized = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Wait for ongoing initialization to complete
   */
  private async waitForInitialization(): Promise<boolean> {
    const maxWaitTime = 10000; // 10 seconds
    const checkInterval = 100; // 100ms
    let elapsed = 0;

    while (this.isInitializing && elapsed < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }

    if (this.isInitializing) {
      throw new Error('Initialization timeout');
    }

    return this.isInitialized;
  }

  /**
   * Get granted permissions with caching and retry logic
   * CRITICAL: This prevents concurrent service bindings
   */
  async getGrantedPermissions(options: { useCache?: boolean; delayMs?: number } = {}): Promise<any[]> {
    const { useCache = true, delayMs = 0 } = options;

    // ✅ CRITICAL FIX: Check circuit breaker first
    if (this.isCircuitBreakerOpen()) {
      throw new Error('Health Connect service unavailable - too many consecutive failures');
    }

    // Check cache first
    if (useCache && this.isCacheValid()) {
      console.log('✨ [HealthConnectManager] Using cached permissions');
      return this.permissionCache!.permissions;
    }

    // Ensure initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Add delay if requested (useful for first-launch stability)
    if (delayMs > 0) {
      console.log(`⏱️ [HealthConnectManager] Delaying permission check by ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Queue the operation to prevent concurrent calls
    return this.queueOperation(
      () => this.getGrantedPermissionsInternal(),
      this.MAX_RETRIES
    );
  }

  /**
   * Internal method to fetch permissions from Health Connect
   * Includes retry logic with exponential backoff
   */
  private async getGrantedPermissionsInternal(): Promise<any[]> {
    try {
      console.log('🔍 [HealthConnectManager] Fetching permissions from Health Connect...');

      const permissions = await getGrantedPermissions();

      // Update cache
      this.permissionCache = {
        permissions,
        timestamp: Date.now(),
        isValid: true,
      };

      // ✅ Record success for circuit breaker
      this.recordSuccess();

      console.log(`✅ [HealthConnectManager] Retrieved ${permissions.length} permissions`);
      return permissions;
    } catch (error) {
      console.error('❌ [HealthConnectManager] Failed to get permissions:', error);

      const errorMsg = error instanceof Error ? error.message : String(error);

      // ✅ Record failure for circuit breaker
      this.recordFailure();

      // Check if it's a service binding error
      if (this.isServiceBindingError(errorMsg)) {
        console.warn('⚠️ [HealthConnectManager] Service binding error detected - will retry');
        throw new Error('SERVICE_BINDING_FAILED');
      }

      throw error;
    }
  }

  /**
   * Request permissions with queuing
   */
  async requestPermissions(permissions: any[]): Promise<boolean> {
    // Ensure initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.queueOperation(
      async () => {
        console.log('🔐 [HealthConnectManager] Requesting permissions...');

        await requestPermission(permissions);

        // Invalidate cache and fetch updated permissions
        this.invalidateCache();

        // Small delay to ensure Health Connect has updated
        await new Promise(resolve => setTimeout(resolve, 500));

        const grantedPermissions = await this.getGrantedPermissionsInternal();

        // Check if all requested permissions were granted
        const allGranted = permissions.every(requested =>
          grantedPermissions.some(
            granted =>
              granted.recordType === requested.recordType &&
              granted.accessType === requested.accessType
          )
        );

        console.log(`${allGranted ? '✅' : '❌'} [HealthConnectManager] Permissions ${allGranted ? 'granted' : 'partially granted'}`);

        return allGranted;
      },
      this.MAX_RETRIES
    );
  }

  /**
   * Check if specific permission is granted
   */
  async hasPermission(recordType: string, accessType: 'read' | 'write' = 'read'): Promise<boolean> {
    try {
      const permissions = await this.getGrantedPermissions({
        useCache: true,
        delayMs: this.INITIAL_DELAY_MS // First check has delay for stability
      });

      return permissions.some(
        p => p.recordType === recordType && p.accessType === accessType
      );
    } catch (error) {
      console.warn(`⚠️ [HealthConnectManager] Could not check permission for ${recordType}:`, error);
      return false;
    }
  }

  /**
   * Queue an operation to prevent concurrent API calls
   */
  private queueOperation<T>(
    operation: () => Promise<T>,
    retries: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({
        operation,
        resolve,
        reject,
        retries,
      });

      // Start processing if not already processing
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process operations sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.operationQueue.length > 0) {
      const item = this.operationQueue.shift()!;

      try {
        const result = await this.executeWithRetry(item.operation, item.retries);
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }

      // Small delay between operations to prevent overwhelming the service
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        const errorMsg = error instanceof Error ? error.message : String(error);

        // Only retry on service binding errors
        if (this.isServiceBindingError(errorMsg) && attempt < maxRetries) {
          const delayMs = this.BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `⚠️ [HealthConnectManager] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delayMs}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          // Non-retryable error or max retries reached
          break;
        }
      }
    }

    // Log final failure
    sentryTracker.trackServiceError(
      lastError instanceof Error ? lastError : new Error(String(lastError)),
      {
        service: 'HealthConnectManager',
        action: 'executeWithRetry',
        additional: {
          maxRetries,
          error: String(lastError),
        }
      }
    );

    throw lastError;
  }

  /**
   * Check if error is a service binding error
   * ✅ ENHANCED: More comprehensive error detection
   */
  private isServiceBindingError(errorMsg: string): boolean {
    const bindingErrorKeywords = [
      'binding to service failed',
      'binding died',
      'remoteexception',
      'binding',
      'service',
      'remote',
      'ipc',
      'binder',
      'connection',
      'died',
      'failed to connect',
      'service_binding_failed',
      'healthconnectclientimpl',
      'getgrantedpermissions',
    ];

    const lowerMsg = errorMsg.toLowerCase();
    return bindingErrorKeywords.some(keyword => lowerMsg.includes(keyword));
  }

  /**
   * ✅ NEW: Circuit breaker pattern to prevent repeated failures
   */
  private isCircuitBreakerOpen(): boolean {
    const now = Date.now();
    
    // Reset circuit breaker if enough time has passed
    if (now - this.lastFailureTime > this.CIRCUIT_BREAKER_RESET_MS) {
      this.consecutiveFailures = 0;
      return false;
    }
    
    return this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES;
  }

  /**
   * ✅ NEW: Record failure for circuit breaker
   */
  private recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      console.error(`🚨 [HealthConnectManager] Circuit breaker OPEN - ${this.consecutiveFailures} consecutive failures`);
    }
  }

  /**
   * ✅ NEW: Record success for circuit breaker
   */
  private recordSuccess(): void {
    if (this.consecutiveFailures > 0) {
      console.log(`✅ [HealthConnectManager] Circuit breaker reset - operation succeeded`);
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.permissionCache) {
      return false;
    }

    const age = Date.now() - this.permissionCache.timestamp;
    return this.permissionCache.isValid && age < this.CACHE_DURATION_MS;
  }

  /**
   * Invalidate permission cache
   */
  invalidateCache(): void {
    if (this.permissionCache) {
      this.permissionCache.isValid = false;
    }
    console.log('🗑️ [HealthConnectManager] Permission cache invalidated');
  }

  /**
   * Get SDK status
   */
  async getSdkStatus(): Promise<any> {
    try {
      return await getSdkStatus();
    } catch (error) {
      console.error('❌ [HealthConnectManager] Failed to get SDK status:', error);
      throw error;
    }
  }

  /**
   * Open Health Connect settings
   */
  async openSettings(): Promise<void> {
    try {
      await openHealthConnectSettings();
    } catch (error) {
      console.error('❌ [HealthConnectManager] Failed to open settings:', error);
      throw error;
    }
  }

  /**
   * Reset manager (useful for testing)
   */
  reset(): void {
    this.isInitialized = false;
    this.isInitializing = false;
    this.permissionCache = null;
    this.operationQueue = [];
    this.isProcessingQueue = false;
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    console.log('🔄 [HealthConnectManager] Manager reset');
  }
}

// Export singleton instance
export const healthConnectManager = HealthConnectManager.getInstance();
