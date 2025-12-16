/**
 * Health Error Recovery Service
 *
 * Provides robust error recovery patterns for health data operations.
 * Handles common failure scenarios with appropriate fallback strategies,
 * circuit breaker patterns, and intelligent health monitoring.
 */

import { EventEmitter } from 'events';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

import type { HealthDataType } from '../../types/health';
import { sentryTracker } from '../../utils/sentryErrorTracker';

import { wearableHealthManager } from './WearableHealthManager';

export interface HealthErrorContext {
  operation:
    | 'initialize'
    | 'fetch'
    | 'permission'
    | 'background_sync'
    | 'real_time_monitor'
    | 'data_sync';
  dataType?: HealthDataType;
  platform: string;
  deviceTier?: string;
  retryCount: number;
  lastAttempt: number;
  networkState?: Network.NetworkState;
  batteryLevel?: number;
  memoryWarning?: boolean;
  providerName?: string;
  errorCode?: string | number;
}

export interface RecoveryStrategy {
  shouldRetry: boolean;
  retryDelay: number;
  maxRetries: number;
  fallbackAction?: 'cache' | 'offline' | 'degraded_mode' | 'emergency_cache' | 'none';
  userAction?: 'notify' | 'silent' | 'prompt_settings' | 'alert_doctor' | 'emergency_contact';
  circuitBreakerAction?: 'open' | 'half_open' | 'close';
  priorityLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
}

export interface HealthServiceStatus {
  serviceName: string;
  isHealthy: boolean;
  lastHealthCheck: number;
  errorCount: number;
  averageResponseTime: number;
  circuitState: CircuitBreakerState;
}

export class HealthErrorRecoveryService extends EventEmitter {
  private static instance: HealthErrorRecoveryService;
  private readonly MAX_RETRIES = 3;
  private readonly BASE_RETRY_DELAY = 2000; // 2 seconds
  private readonly CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  private errorHistory = new Map<string, HealthErrorContext>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private serviceStatus = new Map<string, HealthServiceStatus>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isRecoveryMode = false;
  private emergencyMode = false;

  private constructor() {
    super();
    this.startHealthMonitoring();
    this.loadPersistedState();
  }

  static getInstance(): HealthErrorRecoveryService {
    if (!HealthErrorRecoveryService.instance) {
      HealthErrorRecoveryService.instance = new HealthErrorRecoveryService();
    }
    return HealthErrorRecoveryService.instance;
  }

  /**
   * Start continuous health monitoring of services
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health checks on all registered services
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const services = [
        'apple_healthkit',
        'google_health_connect',
        'background_sync',
        'real_time_monitor',
      ];

      for (const serviceName of services) {
        await this.checkServiceHealth(serviceName);
      }

      // Update recovery mode based on overall health
      this.updateRecoveryMode();

      // Persist state
      await this.persistState();
    } catch (error) {
      console.error('❌ Error performing health checks:', error);
    }
  }

  /**
   * Check individual service health
   */
  private async checkServiceHealth(serviceName: string): Promise<void> {
    const startTime = Date.now();
    let isHealthy = false;
    let errorCount = 0;

    try {
      switch (serviceName) {
        case 'apple_healthkit':
        case 'google_health_connect':
          isHealthy = await this.checkProviderHealth(serviceName);
          break;
        case 'background_sync':
          isHealthy = await this.checkBackgroundSyncHealth();
          break;
        case 'real_time_monitor':
          isHealthy = await this.checkRealTimeMonitorHealth();
          break;
        default:
          isHealthy = true;
      }
    } catch (error) {
      isHealthy = false;
      errorCount = 1;
      console.warn(`⚠️ Health check failed for ${serviceName}:`, error);
    }

    const responseTime = Date.now() - startTime;
    const currentStatus = this.serviceStatus.get(serviceName);

    // Update service status
    this.serviceStatus.set(serviceName, {
      serviceName,
      isHealthy,
      lastHealthCheck: Date.now(),
      errorCount: (currentStatus?.errorCount || 0) + errorCount,
      averageResponseTime: currentStatus
        ? currentStatus.averageResponseTime * 0.7 + responseTime * 0.3
        : responseTime,
      circuitState: this.getOrCreateCircuitBreaker(serviceName),
    });

    // Update circuit breaker
    if (isHealthy) {
      this.recordSuccess(serviceName);
    } else {
      this.recordFailure(serviceName);
    }

    // Emit health status change
    this.emit('serviceHealthChanged', {
      serviceName,
      isHealthy,
      previousHealth: currentStatus?.isHealthy,
      responseTime,
      timestamp: Date.now(),
    });
  }

  /**
   * Check health provider availability and responsiveness
   */
  private async checkProviderHealth(providerName: string): Promise<boolean> {
    try {
      if (providerName === 'apple_healthkit' && Platform.OS === 'ios') {
        const providers = wearableHealthManager.getActiveProviders();
        return providers.includes('apple_healthkit');
      } else if (providerName === 'google_health_connect' && Platform.OS === 'android') {
        const providers = wearableHealthManager.getActiveProviders();
        return providers.includes('google_health_connect');
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check background sync service health
   */
  private async checkBackgroundSyncHealth(): Promise<boolean> {
    try {
      // Check if background sync is functioning
      const lastSyncKey = 'last_background_sync';
      const lastSyncStr = await AsyncStorage.getItem(lastSyncKey);

      if (!lastSyncStr) return false;

      const lastSync = parseInt(lastSyncStr, 10);
      const timeSinceLastSync = Date.now() - lastSync;

      // Consider healthy if synced within last 15 minutes
      return timeSinceLastSync < 15 * 60 * 1000;
    } catch {
      return false;
    }
  }

  /**
   * Check real-time monitor health
   */
  private async checkRealTimeMonitorHealth(): Promise<boolean> {
    try {
      // This would check if real-time monitoring is active and responsive
      // For now, return true as a placeholder
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get or create circuit breaker for service
   */
  private getOrCreateCircuitBreaker(serviceName: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0,
      });
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Record successful operation for circuit breaker
   */
  private recordSuccess(serviceName: string): void {
    const breaker = this.getOrCreateCircuitBreaker(serviceName);

    breaker.successCount++;

    if (breaker.state === 'half_open') {
      // Reset to closed state after successful operation
      breaker.state = 'closed';
      breaker.failureCount = 0;
      console.log(`✅ Circuit breaker for ${serviceName} closed after successful recovery`);

      this.emit('circuitBreakerStateChanged', {
        serviceName,
        newState: 'closed',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Record failed operation for circuit breaker
   */
  private recordFailure(serviceName: string): void {
    const breaker = this.getOrCreateCircuitBreaker(serviceName);

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (
      breaker.state === 'closed' &&
      breaker.failureCount >= this.CIRCUIT_BREAKER_FAILURE_THRESHOLD
    ) {
      // Open circuit breaker
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;

      console.log(
        `🔴 Circuit breaker for ${serviceName} opened due to ${breaker.failureCount} failures`
      );

      this.emit('circuitBreakerStateChanged', {
        serviceName,
        newState: 'open',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Check if service is available based on circuit breaker state
   */
  public isServiceAvailable(serviceName: string): boolean {
    const breaker = this.circuitBreakers.get(serviceName);

    if (!breaker) return true;

    switch (breaker.state) {
      case 'closed':
        return true;
      case 'open':
        if (Date.now() >= breaker.nextAttemptTime) {
          // Transition to half-open
          breaker.state = 'half_open';
          console.log(`🟡 Circuit breaker for ${serviceName} is now half-open`);
          return true;
        }
        return false;
      case 'half_open':
        return true;
      default:
        return true;
    }
  }

  /**
   * Update overall recovery mode based on service health
   */
  private updateRecoveryMode(): void {
    const unhealthyServices = Array.from(this.serviceStatus.values()).filter(
      status => !status.isHealthy
    );

    const criticalServicesDown = unhealthyServices.filter(status =>
      ['apple_healthkit', 'google_health_connect'].includes(status.serviceName)
    );

    const wasInRecoveryMode = this.isRecoveryMode;
    const wasInEmergencyMode = this.emergencyMode;

    // Update recovery mode
    this.isRecoveryMode = unhealthyServices.length > 0;

    // Update emergency mode (critical services down)
    this.emergencyMode = criticalServicesDown.length > 0;

    // Emit mode changes
    if (this.isRecoveryMode !== wasInRecoveryMode) {
      this.emit('recoveryModeChanged', {
        recoveryMode: this.isRecoveryMode,
        unhealthyServices: unhealthyServices.map(s => s.serviceName),
        timestamp: Date.now(),
      });
    }

    if (this.emergencyMode !== wasInEmergencyMode) {
      this.emit('emergencyModeChanged', {
        emergencyMode: this.emergencyMode,
        criticalServices: criticalServicesDown.map(s => s.serviceName),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Load persisted state from storage
   */
  private async loadPersistedState(): Promise<void> {
    try {
      const stateKey = 'health_error_recovery_state';
      const stateStr = await AsyncStorage.getItem(stateKey);

      if (stateStr) {
        const state = JSON.parse(stateStr);

        // Restore circuit breaker states
        if (state.circuitBreakers) {
          for (const [serviceName, breakerState] of Object.entries(state.circuitBreakers)) {
            this.circuitBreakers.set(serviceName, breakerState as CircuitBreakerState);
          }
        }

        // Restore service statuses
        if (state.serviceStatus) {
          for (const [serviceName, status] of Object.entries(state.serviceStatus)) {
            this.serviceStatus.set(serviceName, status as HealthServiceStatus);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load persisted error recovery state:', error);
    }
  }

  /**
   * Persist current state to storage
   */
  private async persistState(): Promise<void> {
    try {
      const state = {
        circuitBreakers: Object.fromEntries(this.circuitBreakers),
        serviceStatus: Object.fromEntries(this.serviceStatus),
        timestamp: Date.now(),
      };

      const stateKey = 'health_error_recovery_state';
      await AsyncStorage.setItem(stateKey, JSON.stringify(state));
    } catch (error) {
      console.warn('⚠️ Could not persist error recovery state:', error);
    }
  }

  /**
   * Analyzes error with enhanced context and determines recovery strategy
   */
  async analyzeError(
    error: Error | string,
    context: Partial<HealthErrorContext>
  ): Promise<RecoveryStrategy> {
    const errorKey = this.generateErrorKey(context);
    const existingContext = this.errorHistory.get(errorKey);
    const retryCount = existingContext?.retryCount || 0;

    // Enhance context with current system state
    const enhancedContext = await this.enhanceErrorContext(context);

    // Update error history
    this.errorHistory.set(errorKey, {
      operation: enhancedContext.operation || 'fetch',
      dataType: enhancedContext.dataType,
      platform: enhancedContext.platform || Platform.OS,
      deviceTier: enhancedContext.deviceTier || 'unknown',
      retryCount: retryCount + 1,
      lastAttempt: Date.now(),
      networkState: enhancedContext.networkState,
      batteryLevel: enhancedContext.batteryLevel,
      memoryWarning: enhancedContext.memoryWarning,
      providerName: enhancedContext.providerName,
      errorCode: enhancedContext.errorCode,
    });

    // Log error for monitoring
    try {
      sentryTracker.trackServiceError(error instanceof Error ? error : error.toString(), {
        service: 'healthErrorRecovery',
        action: 'analyzeError',
        additional: {
          ...enhancedContext,
          retryCount: retryCount + 1,
          errorType: this.categorizeError(error),
          isRecoveryMode: this.isRecoveryMode,
          isEmergencyMode: this.emergencyMode,
        },
      });
    } catch {}

    return await this.determineEnhancedStrategy(error, enhancedContext, retryCount + 1);
  }

  /**
   * Enhance error context with current system state
   */
  private async enhanceErrorContext(
    context: Partial<HealthErrorContext>
  ): Promise<HealthErrorContext> {
    try {
      // Get network state
      const networkState = await Network.getNetworkStateAsync();

      return {
        operation: context.operation || 'fetch',
        dataType: context.dataType,
        platform: context.platform || Platform.OS,
        deviceTier: context.deviceTier || this.getDeviceTier(),
        retryCount: context.retryCount || 0,
        lastAttempt: context.lastAttempt || Date.now(),
        networkState,
        batteryLevel: context.batteryLevel,
        memoryWarning: context.memoryWarning,
        providerName: context.providerName,
        errorCode: context.errorCode,
      };
    } catch {
      return {
        operation: context.operation || 'fetch',
        platform: context.platform || Platform.OS,
        deviceTier: context.deviceTier || 'unknown',
        retryCount: context.retryCount || 0,
        lastAttempt: context.lastAttempt || Date.now(),
      };
    }
  }

  /**
   * Get device tier for optimization
   */
  private getDeviceTier(): string {
    // This would normally use device performance metrics
    // For now, return 'medium' as default
    return 'medium';
  }

  /**
   * Determine enhanced recovery strategy with circuit breaker and system state
   */
  private async determineEnhancedStrategy(
    error: Error | string,
    context: HealthErrorContext,
    retryCount: number
  ): Promise<RecoveryStrategy> {
    const errorType = this.categorizeError(error);
    const isInitialAttempt = retryCount === 1;
    const hasExceededMaxRetries = retryCount > this.MAX_RETRIES;

    // Check circuit breaker state if provider is specified
    const isServiceAvailable = context.providerName
      ? this.isServiceAvailable(context.providerName)
      : true;

    // Base strategy
    const strategy: RecoveryStrategy = {
      shouldRetry: false,
      retryDelay: this.BASE_RETRY_DELAY * Math.pow(2, retryCount - 1), // Exponential backoff
      maxRetries: this.MAX_RETRIES,
      fallbackAction: 'none',
      userAction: 'silent',
      circuitBreakerAction: 'close',
      priorityLevel: 'medium',
    };

    // Enhanced network-aware strategy
    if (context.networkState) {
      if (!context.networkState.isConnected) {
        strategy.shouldRetry = false;
        strategy.fallbackAction = 'offline';
        strategy.userAction = 'notify';
        strategy.priorityLevel = 'high';
      } else if (context.networkState.type === 'cellular') {
        // Be more conservative with cellular connections
        strategy.retryDelay = Math.max(strategy.retryDelay, 5000);
        strategy.maxRetries = Math.min(strategy.maxRetries, 2);
      }
    }

    // Circuit breaker consideration
    if (!isServiceAvailable && context.providerName) {
      strategy.shouldRetry = false;
      strategy.fallbackAction = 'emergency_cache';
      strategy.userAction = context.operation === 'real_time_monitor' ? 'alert_doctor' : 'notify';
      strategy.circuitBreakerAction = 'open';
      strategy.priorityLevel = 'critical';
    }

    // Emergency mode adjustments
    if (this.emergencyMode) {
      strategy.priorityLevel = 'critical';
      if (context.operation === 'real_time_monitor') {
        strategy.userAction = 'emergency_contact';
        strategy.fallbackAction = 'emergency_cache';
      }
    }

    // Battery level consideration
    if (context.batteryLevel && context.batteryLevel < 0.15) {
      strategy.retryDelay = Math.max(strategy.retryDelay, 10000); // Longer delays for low battery
      strategy.maxRetries = 1;
      strategy.fallbackAction = 'cache';
    }

    // Memory warning consideration
    if (context.memoryWarning) {
      strategy.shouldRetry = false;
      strategy.fallbackAction = 'degraded_mode';
      strategy.userAction = 'silent';
    }

    // Customize strategy based on error type with enhanced logic
    switch (errorType) {
      case 'permission':
        strategy.shouldRetry = false;
        strategy.fallbackAction = this.emergencyMode ? 'emergency_cache' : 'none';
        strategy.userAction = isInitialAttempt ? 'prompt_settings' : 'silent';
        strategy.priorityLevel = 'high';
        break;

      case 'timeout':
        strategy.shouldRetry = !hasExceededMaxRetries && isServiceAvailable;
        strategy.retryDelay = Math.min(strategy.retryDelay, 15000);
        strategy.fallbackAction = hasExceededMaxRetries ? 'cache' : 'none';
        strategy.userAction = hasExceededMaxRetries ? 'notify' : 'silent';
        strategy.priorityLevel = context.operation === 'real_time_monitor' ? 'high' : 'medium';
        break;

      case 'network':
        strategy.shouldRetry = !hasExceededMaxRetries;
        strategy.fallbackAction = 'cache';
        strategy.userAction = 'silent';
        strategy.priorityLevel = 'low';
        break;

      case 'unavailable':
        strategy.shouldRetry = isInitialAttempt && isServiceAvailable;
        strategy.fallbackAction = this.emergencyMode ? 'emergency_cache' : 'none';
        strategy.userAction = 'notify';
        strategy.circuitBreakerAction = hasExceededMaxRetries ? 'open' : 'close';
        strategy.priorityLevel = 'high';
        break;

      case 'initialization':
        strategy.shouldRetry = !hasExceededMaxRetries && isServiceAvailable;
        strategy.retryDelay = Math.max(strategy.retryDelay, 5000);
        strategy.fallbackAction = 'none';
        strategy.userAction = hasExceededMaxRetries ? 'notify' : 'silent';
        strategy.priorityLevel = 'high';
        break;

      case 'data':
        strategy.shouldRetry = false;
        strategy.fallbackAction = 'cache';
        strategy.userAction = 'silent';
        strategy.priorityLevel = 'low';
        break;

      default: // unknown errors
        strategy.shouldRetry = !hasExceededMaxRetries && isInitialAttempt && isServiceAvailable;
        strategy.fallbackAction = hasExceededMaxRetries ? 'cache' : 'none';
        strategy.userAction = hasExceededMaxRetries ? 'notify' : 'silent';
        strategy.priorityLevel = 'medium';
        break;
    }

    // Platform and device tier specific adjustments
    if (context.platform === 'android' && context.deviceTier === 'low') {
      strategy.retryDelay = Math.max(strategy.retryDelay, 3000);
      strategy.maxRetries = Math.min(strategy.maxRetries, 2);
    }

    // Real-time monitoring specific adjustments
    if (context.operation === 'real_time_monitor') {
      strategy.priorityLevel = 'critical';
      if (strategy.fallbackAction === 'none') {
        strategy.fallbackAction = 'emergency_cache';
      }
      if (hasExceededMaxRetries) {
        strategy.userAction = 'alert_doctor';
      }
    }

    return strategy;
  }

  /**
   * Executes recovery action with appropriate strategy
   */
  async executeRecovery<T>(
    error: Error | string,
    context: Partial<HealthErrorContext>,
    retryCallback?: () => Promise<T>
  ): Promise<{ success: boolean; data?: T; fallbackUsed?: boolean }> {
    const strategy = await this.analyzeError(error, context);

    console.log(`🏥 Health error recovery strategy:`, {
      shouldRetry: strategy.shouldRetry,
      fallbackAction: strategy.fallbackAction,
      userAction: strategy.userAction,
    });

    // Attempt retry if appropriate
    if (strategy.shouldRetry && retryCallback) {
      try {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, strategy.retryDelay));

        console.log(
          `🏥 Attempting health operation retry (${context.retryCount || 0 + 1}/${strategy.maxRetries})`
        );
        const result = await retryCallback();

        // Clear error history on success
        this.clearErrorHistory(this.generateErrorKey(context));

        return { success: true, data: result };
      } catch (retryError) {
        console.warn('🏥 Health operation retry failed:', retryError);
        // Continue to fallback strategy
      }
    }

    // Execute fallback strategy
    return this.executeFallback(strategy, context);
  }

  /**
   * Clears error history for a specific operation
   */
  clearErrorHistory(errorKey?: string): void {
    if (errorKey) {
      this.errorHistory.delete(errorKey);
    } else {
      this.errorHistory.clear();
    }
  }

  /**
   * Gets current error statistics for monitoring
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByOperation: Record<string, number>;
    errorsByPlatform: Record<string, number>;
  } {
    const stats = {
      totalErrors: this.errorHistory.size,
      errorsByOperation: {} as Record<string, number>,
      errorsByPlatform: {} as Record<string, number>,
    };

    this.errorHistory.forEach(context => {
      stats.errorsByOperation[context.operation] =
        (stats.errorsByOperation[context.operation] || 0) + 1;
      stats.errorsByPlatform[context.platform] =
        (stats.errorsByPlatform[context.platform] || 0) + 1;
    });

    return stats;
  }

  private generateErrorKey(context: Partial<HealthErrorContext>): string {
    return `${context.operation || 'unknown'}_${context.dataType != null || 'all'}_${context.platform || Platform.OS}`;
  }

  private categorizeError(error: Error | string): string {
    const errorStr = error instanceof Error ? error.message.toLowerCase() : error.toLowerCase();

    if (
      errorStr.includes('permission') ||
      errorStr.includes('denied') ||
      errorStr.includes('unauthorized')
    ) {
      return 'permission';
    }
    if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
      return 'timeout';
    }
    if (
      errorStr.includes('network') ||
      errorStr.includes('connection') ||
      errorStr.includes('offline')
    ) {
      return 'network';
    }
    if (
      errorStr.includes('not available') ||
      errorStr.includes('not supported') ||
      errorStr.includes('unavailable')
    ) {
      return 'unavailable';
    }
    if (errorStr.includes('initialization') || errorStr.includes('init')) {
      return 'initialization';
    }
    if (errorStr.includes('data') || errorStr.includes('parse') || errorStr.includes('format')) {
      return 'data';
    }

    return 'unknown';
  }

  private determineStrategy(
    error: Error | string,
    context: Partial<HealthErrorContext>,
    retryCount: number
  ): RecoveryStrategy {
    const errorType = this.categorizeError(error);
    const isInitialAttempt = retryCount === 1;
    const hasExceededMaxRetries = retryCount > this.MAX_RETRIES;

    // Base strategy
    const strategy: RecoveryStrategy = {
      shouldRetry: false,
      retryDelay: this.BASE_RETRY_DELAY * Math.pow(2, retryCount - 1), // Exponential backoff
      maxRetries: this.MAX_RETRIES,
      fallbackAction: 'none',
      userAction: 'silent',
    };

    // Customize strategy based on error type
    switch (errorType) {
      case 'permission':
        strategy.shouldRetry = false; // Don't retry permission errors
        strategy.fallbackAction = 'none';
        strategy.userAction = isInitialAttempt ? 'notify' : 'silent';
        break;

      case 'timeout':
        strategy.shouldRetry = !hasExceededMaxRetries;
        strategy.retryDelay = Math.min(strategy.retryDelay, 10000); // Cap at 10 seconds
        strategy.fallbackAction = hasExceededMaxRetries ? 'cache' : 'none';
        strategy.userAction = hasExceededMaxRetries ? 'notify' : 'silent';
        break;

      case 'network':
        strategy.shouldRetry = !hasExceededMaxRetries;
        strategy.fallbackAction = 'cache';
        strategy.userAction = 'silent'; // Network errors are common
        break;

      case 'unavailable':
        strategy.shouldRetry = isInitialAttempt; // Try once more
        strategy.fallbackAction = 'none';
        strategy.userAction = 'notify';
        break;

      case 'initialization':
        strategy.shouldRetry = !hasExceededMaxRetries;
        strategy.retryDelay = Math.max(strategy.retryDelay, 5000); // Longer delay for init
        strategy.fallbackAction = 'none';
        strategy.userAction = hasExceededMaxRetries ? 'notify' : 'silent';
        break;

      case 'data':
        strategy.shouldRetry = false; // Data errors usually don't resolve with retry
        strategy.fallbackAction = 'cache';
        strategy.userAction = 'silent';
        break;

      default: // unknown errors
        strategy.shouldRetry = !hasExceededMaxRetries && isInitialAttempt;
        strategy.fallbackAction = hasExceededMaxRetries ? 'cache' : 'none';
        strategy.userAction = hasExceededMaxRetries ? 'notify' : 'silent';
        break;
    }

    // Platform-specific adjustments
    if (context.platform === 'android' && context.deviceTier === 'low') {
      strategy.retryDelay = Math.max(strategy.retryDelay, 3000); // Longer delays for low-end devices
      strategy.maxRetries = Math.min(strategy.maxRetries, 2); // Fewer retries
    }

    return strategy;
  }

  private async executeFallback<T>(
    strategy: RecoveryStrategy,
    context: Partial<HealthErrorContext>
  ): Promise<{ success: boolean; data?: T; fallbackUsed?: boolean }> {
    switch (strategy.fallbackAction) {
      case 'cache':
        console.log('🏥 Using cached health data as fallback');
        try {
          const cachedData = await this.getCachedHealthData(context);
          return { success: true, data: cachedData as T, fallbackUsed: true };
        } catch {
          return { success: false, fallbackUsed: false };
        }

      case 'emergency_cache':
        console.log('🏥 Using emergency cached health data');
        try {
          const emergencyData = await this.getEmergencyCachedData(context);
          return { success: true, data: emergencyData as T, fallbackUsed: true };
        } catch {
          return { success: false, fallbackUsed: false };
        }

      case 'degraded_mode':
        console.log('🏥 Switching to degraded mode');
        try {
          const degradedData = await this.getDegradedModeData(context);
          return { success: true, data: degradedData as T, fallbackUsed: true };
        } catch {
          return { success: false, fallbackUsed: false };
        }

      // Mock data fallback has been removed - no fake data allowed
      // Return failure instead of fake data

      case 'offline':
        console.log('🏥 Switching to offline mode');
        try {
          const offlineData = await this.getOfflineModeData(context);
          return { success: true, data: offlineData as T, fallbackUsed: true };
        } catch {
          return { success: false, fallbackUsed: false };
        }

      case 'none':
      default:
        console.log('🏥 No fallback strategy available');
        return { success: false, fallbackUsed: false };
    }
  }

  /**
   * Get cached health data
   */
  private async getCachedHealthData(context: Partial<HealthErrorContext>): Promise<any> {
    try {
      const cacheKey = `health_cache_${context.dataType != null || 'general'}`;
      const cachedDataStr = await AsyncStorage.getItem(cacheKey);

      if (cachedDataStr) {
        const cachedData = JSON.parse(cachedDataStr);
        // Check if cache is not too old (max 1 hour)
        if (Date.now() - cachedData.timestamp < 3600000) {
          return cachedData.data;
        }
      }
      throw new Error('No valid cached data available');
    } catch {
      throw new Error('Cache retrieval failed');
    }
  }

  /**
   * Get emergency cached health data (older cache acceptable)
   */
  private async getEmergencyCachedData(context: Partial<HealthErrorContext>): Promise<any> {
    try {
      const cacheKey = `health_cache_${context.dataType != null || 'general'}`;
      const cachedDataStr = await AsyncStorage.getItem(cacheKey);

      if (cachedDataStr) {
        const cachedData = JSON.parse(cachedDataStr);
        // Accept cache up to 24 hours old in emergency mode
        if (Date.now() - cachedData.timestamp < 86400000) {
          console.log(
            '🚨 Using emergency cached data (age: %d hours)',
            Math.round((Date.now() - cachedData.timestamp) / 3600000)
          );
          return cachedData.data;
        }
      }
      throw new Error('No emergency cached data available');
    } catch {
      throw new Error('Emergency cache retrieval failed');
    }
  }

  /**
   * Get degraded mode data (minimal functionality)
   */
  private async getDegradedModeData(context: Partial<HealthErrorContext>): Promise<any> {
    console.log('⚠️ Operating in degraded mode - limited functionality');

    // Return minimal data structure based on context
    switch (context.dataType) {
      case 'steps':
        return { value: 0, unit: 'steps', timestamp: new Date(), source: 'degraded' };
      case 'heart_rate':
        return { value: 0, unit: 'bpm', timestamp: new Date(), source: 'degraded' };
      default:
        return { message: 'Service temporarily unavailable', mode: 'degraded' };
    }
  }

  /**
   * Mock data generation has been removed
   * No fake data is allowed in production
   * This method is deprecated and should not be used
   */
  private async getMockHealthData(context: Partial<HealthErrorContext>): Promise<any> {
    console.error('❌ Mock health data requested but not allowed');
    throw new Error('Mock data generation is disabled. Only real health data is allowed.');
  }

  /**
   * Get offline mode data
   */
  private async getOfflineModeData(context: Partial<HealthErrorContext>): Promise<any> {
    console.log('📱 Operating in offline mode');

    // Try to get any available local data
    try {
      const offlineKey = `offline_health_${context.dataType != null || 'general'}`;
      const offlineDataStr = await AsyncStorage.getItem(offlineKey);

      if (offlineDataStr) {
        return JSON.parse(offlineDataStr);
      }

      // Fallback to basic offline structure
      return {
        message: 'Offline mode - limited data available',
        timestamp: new Date(),
        mode: 'offline',
      };
    } catch {
      throw new Error('Offline mode data not available');
    }
  }
}

// Export singleton instance
export const healthErrorRecovery = HealthErrorRecoveryService.getInstance();
