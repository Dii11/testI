/**
 * Device-Optimized Permission Manager
 *
 * Implements device-tier specific strategies for permission handling,
 * including timeout optimization, cache strategies, and performance monitoring.
 */

import * as Device from 'expo-device';
import { Platform } from 'react-native';

import deviceCapabilityService from '../deviceCapabilityService';
import { getPlatformCapabilities } from '../platformCapabilities';

export interface DeviceTierConfig {
  tier: 'low' | 'medium' | 'high';
  permissionTimeout: number;
  cacheStrategy: 'aggressive' | 'standard' | 'minimal';
  batchEnabled: boolean;
  retryAttempts: number;
  animationDuration: number;
  enableTelemetry: boolean;
}

export interface PermissionStrategy {
  timeout: number;
  requireCamera: boolean;
  requireMicrophone: boolean;
  shouldPromptUser: boolean;
  cacheEnabled: boolean;
  batchWithOtherPermissions: boolean;
  fallbackOptions: string[];
}

export class DeviceOptimizedPermissionManager {
  private static instance: DeviceOptimizedPermissionManager;
  private deviceConfig: DeviceTierConfig | null = null;
  private performanceMetrics = new Map<string, number[]>();

  public static getInstance(): DeviceOptimizedPermissionManager {
    if (!DeviceOptimizedPermissionManager.instance) {
      DeviceOptimizedPermissionManager.instance = new DeviceOptimizedPermissionManager();
    }
    return DeviceOptimizedPermissionManager.instance;
  }

  private constructor() {
    // Initialize with conservative config immediately to prevent errors
    this.deviceConfig = this.getConservativeConfiguration();
    // Asynchronously improve the configuration in the background
    this.initializeDeviceConfiguration().catch(console.warn);
  }

  /**
   * Initialize device-specific configuration based on hardware capabilities
   */
  private async initializeDeviceConfiguration(): Promise<void> {
    try {
      const platformCaps = getPlatformCapabilities();
      const deviceCaps = deviceCapabilityService.getCapabilities();
      const memoryEstimate = await this.estimateDeviceMemory();

      this.deviceConfig = this.calculateOptimalConfiguration(
        platformCaps,
        deviceCaps,
        memoryEstimate
      );

      console.log('🎯 Device-optimized permission config initialized:', this.deviceConfig);
    } catch (error) {
      console.error('Failed to initialize device configuration:', error);
      // Fallback to conservative configuration
      this.deviceConfig = this.getConservativeConfiguration();
    }
  }

  /**
   * Calculate optimal configuration based on device capabilities
   */
  private calculateOptimalConfiguration(
    platformCaps: any,
    deviceCaps: any,
    memoryMB: number
  ): DeviceTierConfig {
    // Determine device tier based on multiple factors
    const tier = this.determineDeviceTier(platformCaps, deviceCaps, memoryMB);

    switch (tier) {
      case 'low':
        return {
          tier: 'low',
          permissionTimeout: 20000, // 20s - older devices need more time
          cacheStrategy: 'aggressive', // Aggressive caching to reduce API calls
          batchEnabled: false, // Avoid batching on slow devices
          retryAttempts: 1, // Minimal retries to avoid hanging
          animationDuration: 300, // Fast animations
          enableTelemetry: false, // Reduce overhead
        };

      case 'medium':
        return {
          tier: 'medium',
          permissionTimeout: 15000, // 15s - standard timeout
          cacheStrategy: 'standard', // Balanced caching
          batchEnabled: true, // Can handle batch requests
          retryAttempts: 2, // Standard retry count
          animationDuration: 500, // Medium animations
          enableTelemetry: true, // Enable performance tracking
        };

      case 'high':
        return {
          tier: 'high',
          permissionTimeout: 10000, // 10s - fast response expected
          cacheStrategy: 'minimal', // Fresh data preferred
          batchEnabled: true, // Full batching support
          retryAttempts: 3, // More retries for reliability
          animationDuration: 800, // Rich animations
          enableTelemetry: true, // Full telemetry
        };

      default:
        return this.getConservativeConfiguration();
    }
  }

  /**
   * Determine device tier based on multiple hardware factors
   */
  private determineDeviceTier(
    platformCaps: any,
    deviceCaps: any,
    memoryMB: number
  ): 'low' | 'medium' | 'high' {
    // Memory-based classification
    if (memoryMB < 2048) return 'low'; // <2GB
    if (memoryMB < 4096) return 'medium'; // 2-4GB
    if (memoryMB >= 6144) return 'high'; // 6GB+

    // Platform capabilities override
    if (platformCaps.tier) {
      return platformCaps.tier;
    }

    // Android API level consideration
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version as number;
      if (apiLevel < 26) return 'low'; // Very old Android
      if (apiLevel < 29) return 'medium'; // Older Android
    }

    // iOS version consideration
    if (Platform.OS === 'ios') {
      const iosVersion = parseFloat(Platform.Version.toString());
      if (iosVersion < 13) return 'low';
      if (iosVersion < 15) return 'medium';
    }

    // Device type consideration
    if (deviceCaps.isTablet) return 'high'; // Tablets typically more powerful
    if (Device.deviceType === Device.DeviceType.UNKNOWN) return 'low'; // Unknown/emulator

    return 'medium'; // Default fallback
  }

  /**
   * Estimate device memory based on available information
   */
  private async estimateDeviceMemory(): Promise<number> {
    try {
      // Try to use any available memory detection
      // This is a simplified estimation - in production, you might use a native module

      if (Platform.OS === 'android') {
        // Android memory estimation based on device model and year
        const model = Device.modelName?.toLowerCase() || '';

        // High-end indicators
        if (model.includes('pro') || model.includes('ultra') || model.includes('max')) {
          return 8192; // 8GB estimate
        }

        // Budget device indicators
        if (model.includes('lite') || model.includes('go') || model.includes('mini')) {
          return 1536; // 1.5GB estimate
        }

        // API level based estimation
        const apiLevel = Platform.Version as number;
        if (apiLevel >= 30) return 4096; // Android 11+ likely 4GB+
        if (apiLevel >= 28) return 3072; // Android 9+ likely 3GB+
        return 2048; // Older Android likely 2GB
      }

      if (Platform.OS === 'ios') {
        const iosVersion = parseFloat(Platform.Version.toString());
        if (iosVersion >= 15) return 4096; // iOS 15+ devices typically 4GB+
        if (iosVersion >= 13) return 3072; // iOS 13+ typically 3GB+
        return 2048; // Older iOS devices
      }

      return 3072; // Default 3GB estimate
    } catch (error) {
      console.warn('Memory estimation failed:', error);
      return 2048; // Conservative default
    }
  }

  /**
   * Get conservative fallback configuration
   */
  private getConservativeConfiguration(): DeviceTierConfig {
    return {
      tier: 'medium',
      permissionTimeout: 15000,
      cacheStrategy: 'standard',
      batchEnabled: false,
      retryAttempts: 1,
      animationDuration: 400,
      enableTelemetry: false,
    };
  }

  /**
   * Get optimal permission strategy for a specific call type
   */
  getPermissionStrategy(callType: 'video' | 'audio' | 'health' | 'location'): PermissionStrategy {
    const config = this.deviceConfig || this.getConservativeConfiguration();

    const baseStrategy: PermissionStrategy = {
      timeout: config.permissionTimeout,
      requireCamera: false,
      requireMicrophone: false,
      shouldPromptUser: true,
      cacheEnabled: config.cacheStrategy !== 'minimal',
      batchWithOtherPermissions: config.batchEnabled,
      fallbackOptions: [],
    };

    switch (callType) {
      case 'video':
        return {
          ...baseStrategy,
          requireCamera: true,
          requireMicrophone: true,
          batchWithOtherPermissions: config.tier !== 'low', // Avoid batching on low-end
          fallbackOptions: ['audio-only', 'text-chat'],
        };

      case 'audio':
        return {
          ...baseStrategy,
          requireMicrophone: true,
          batchWithOtherPermissions: false, // Single permission is faster
          fallbackOptions: ['text-chat'],
        };

      case 'health':
        return {
          ...baseStrategy,
          timeout: config.permissionTimeout + 5000, // Health permissions often slower
          batchWithOtherPermissions: false, // Health is complex, handle separately
          fallbackOptions: ['mock-data', 'manual-entry'],
        };

      case 'location':
        return {
          ...baseStrategy,
          timeout: config.permissionTimeout,
          batchWithOtherPermissions: config.tier === 'high', // Only batch on high-end
          fallbackOptions: ['manual-location', 'ip-location'],
        };

      default:
        return baseStrategy;
    }
  }

  /**
   * Execute permission request with device-optimized strategy
   */
  async requestWithOptimization<T>(
    permissionRequest: () => Promise<T>,
    strategy: PermissionStrategy,
    context?: string
  ): Promise<T> {
    const startTime = Date.now();
    const config = this.deviceConfig || this.getConservativeConfiguration();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Permission request timeout')), strategy.timeout);
      });

      // Execute request with timeout
      const result = await Promise.race([permissionRequest(), timeoutPromise]);

      // Track performance if enabled
      if (config.enableTelemetry && context) {
        this.trackPerformance(context, Date.now() - startTime, true);
      }

      return result;
    } catch (error) {
      // Track failure if enabled
      if (config.enableTelemetry && context) {
        this.trackPerformance(context, Date.now() - startTime, false);
      }

      throw error;
    }
  }

  /**
   * Track permission request performance
   */
  private trackPerformance(context: string, duration: number, success: boolean): void {
    const key = `${context}_${success ? 'success' : 'failure'}`;

    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }

    const metrics = this.performanceMetrics.get(key)!;
    metrics.push(duration);

    // Keep only last 50 measurements to prevent memory growth
    if (metrics.length > 50) {
      metrics.shift();
    }

    // Log performance issues
    const average = metrics.reduce((a, b) => a + b, 0) / metrics.length;
    const threshold = this.getPerformanceThreshold();

    if (average > threshold) {
      console.warn(
        `🐌 Slow permission performance detected for ${context}: ${average.toFixed(0)}ms average (threshold: ${threshold}ms)`
      );
    }
  }

  /**
   * Get performance threshold based on device tier
   */
  private getPerformanceThreshold(): number {
    const config = this.deviceConfig || this.getConservativeConfiguration();

    switch (config.tier) {
      case 'low':
        return 2000; // 2s acceptable for low-end
      case 'medium':
        return 1000; // 1s for medium
      case 'high':
        return 500; // 500ms for high-end
      default:
        return 1000;
    }
  }

  /**
   * Get device configuration for external use
   */
  getDeviceConfiguration(): DeviceTierConfig {
    return this.deviceConfig || this.getConservativeConfiguration();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): Record<
    string,
    {
      count: number;
      averageMs: number;
      threshold: number;
      performanceGrade: 'excellent' | 'good' | 'poor';
    }
  > {
    const stats: Record<string, any> = {};
    const threshold = this.getPerformanceThreshold();

    for (const [key, metrics] of this.performanceMetrics.entries()) {
      const average = metrics.reduce((a, b) => a + b, 0) / metrics.length;

      let grade: 'excellent' | 'good' | 'poor' = 'good';
      if (average < threshold * 0.5) grade = 'excellent';
      else if (average > threshold) grade = 'poor';

      stats[key] = {
        count: metrics.length,
        averageMs: Math.round(average),
        threshold,
        performanceGrade: grade,
      };
    }

    return stats;
  }

  /**
   * Check if recent permissions were granted (anti-spam protection)
   */
  werePermissionsRecentlyGranted(): boolean {
    const config = this.deviceConfig || this.getConservativeConfiguration();

    // On low-end devices, be more conservative about repeated requests
    const recentWindow = config.tier === 'low' ? 30000 : 15000; // 30s vs 15s

    // This would check actual permission grant timestamps
    // Implementation depends on your permission tracking system
    return false; // Placeholder
  }

  /**
   * Force reconfiguration (useful for testing or device changes)
   */
  async reconfigure(): Promise<void> {
    this.deviceConfig = null;
    this.performanceMetrics.clear();
    await this.initializeDeviceConfiguration();
  }
}

export default DeviceOptimizedPermissionManager;
