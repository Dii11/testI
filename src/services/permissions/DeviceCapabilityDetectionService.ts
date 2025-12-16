/**
 * Device Capability Detection Service - Phase 3
 * Advanced device detection and capability analysis for optimal permission handling
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export interface DeviceCapabilities {
  // Hardware capabilities
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasGPS: boolean;
  hasHealthKit: boolean;
  hasNotifications: boolean;
  hasSecureStorage: boolean;
  hasBiometrics: boolean;
  hasNFC: boolean;

  // Device information
  manufacturer: string;
  model: string;
  osVersion: string;
  isEmulator: boolean;
  deviceType: 'phone' | 'tablet' | 'tv' | 'desktop' | 'unknown';

  // Platform-specific
  ios?: {
    iosVersion: number;
    isJailbroken: boolean;
    supportsAppClips: boolean;
    supportsWidgets: boolean;
  };

  android?: {
    apiLevel: number;
    isRooted: boolean;
    hasGooglePlayServices: boolean;
    hasHMSCore: boolean;
    customUI: 'oneui' | 'miui' | 'emui' | 'oxygenos' | 'stock' | 'unknown';
  };

  // Permission-related optimizations
  permissionTimeoutMs: number;
  supportsGranularPermissions: boolean;
  requiresSequentialRequests: boolean;
  requiresDelayedSequential: boolean;
  preRequestDelayMs: number;
  maxConcurrentRequests: number;

  // Performance characteristics
  isLowEndDevice: boolean;
  availableMemoryMB: number;
  cpuCores: number;

  // Special modes/features
  gamingMode?: boolean;
  dexMode?: boolean; // Samsung DeX
  multiWindow?: boolean;
  darkModeSupported: boolean;

  // Network capabilities
  has5G: boolean;
  hasWiFi: boolean;
  hasCellular: boolean;

  // Healthcare-specific
  healthIntegrationSupported: boolean;
  emergencySOSAvailable: boolean;
  medicalIDSupported: boolean;
}

export interface PermissionOptimization {
  type: 'timeout' | 'batching' | 'delay' | 'retry' | 'ui';
  value: number | string | boolean;
  reason: string;
  confidence: number; // 0-1
}

/**
 * Advanced device capability detection service
 * Provides detailed device analysis for optimal permission handling
 */
export class DeviceCapabilityDetectionService {
  private static instance: DeviceCapabilityDetectionService;
  private capabilities: DeviceCapabilities | null = null;
  private readonly cacheKey = '@HopMed:DeviceCapabilities';
  private readonly cacheExpiryHours = 24;

  private constructor() {}

  public static getInstance(): DeviceCapabilityDetectionService {
    if (!DeviceCapabilityDetectionService.instance) {
      DeviceCapabilityDetectionService.instance = new DeviceCapabilityDetectionService();
    }
    return DeviceCapabilityDetectionService.instance;
  }

  /**
   * Initialize and detect device capabilities
   */
  public async initialize(): Promise<void> {
    // Try to load cached capabilities first
    const cachedCapabilities = await this.loadCachedCapabilities();
    if (cachedCapabilities && !this.isCacheExpired(cachedCapabilities.timestamp)) {
      this.capabilities = cachedCapabilities.data;
      return;
    }

    // Perform fresh detection
    this.capabilities = await this.detectCapabilities();
    await this.cacheCapabilities(this.capabilities);
  }

  /**
   * Get current device capabilities
   */
  public getCapabilities(): DeviceCapabilities | null {
    return this.capabilities;
  }

  /**
   * Get permission-specific optimizations for current device
   */
  public getPermissionOptimizations(): PermissionOptimization[] {
    if (!this.capabilities) return [];

    const optimizations: PermissionOptimization[] = [];

    // Manufacturer-specific timeout optimizations
    if (this.capabilities.manufacturer === 'Samsung') {
      optimizations.push({
        type: 'timeout',
        value: 20000,
        reason: 'Samsung One UI requires extended timeouts for permission dialogs',
        confidence: 0.9,
      });
      optimizations.push({
        type: 'delay',
        value: 1000,
        reason: 'Samsung devices benefit from pre-request delays',
        confidence: 0.8,
      });
    }

    if (this.capabilities.manufacturer === 'Xiaomi') {
      optimizations.push({
        type: 'batching',
        value: false,
        reason: 'MIUI requires sequential permission requests to avoid conflicts',
        confidence: 0.95,
      });
      optimizations.push({
        type: 'timeout',
        value: 15000,
        reason: 'MIUI permission manager can be slow',
        confidence: 0.85,
      });
    }

    if (this.capabilities.manufacturer === 'Huawei') {
      optimizations.push({
        type: 'timeout',
        value: 25000,
        reason: 'EMUI permission system requires extended timeouts',
        confidence: 0.9,
      });
      optimizations.push({
        type: 'delay',
        value: 1500,
        reason: 'EMUI benefits from longer delays between requests',
        confidence: 0.8,
      });
    }

    // Low-end device optimizations
    if (this.capabilities.isLowEndDevice) {
      optimizations.push({
        type: 'timeout',
        value: this.capabilities.permissionTimeoutMs * 1.5,
        reason: 'Low-end devices need extended timeouts for UI responsiveness',
        confidence: 0.7,
      });
      optimizations.push({
        type: 'ui',
        value: 'simplified',
        reason: 'Use simplified UI for better performance on low-end devices',
        confidence: 0.8,
      });
    }

    // Android API level optimizations
    if (Platform.OS === 'android' && this.capabilities.android) {
      if (this.capabilities.android.apiLevel >= 31) {
        optimizations.push({
          type: 'ui',
          value: 'granular',
          reason: 'Android 12+ supports granular permission UI',
          confidence: 0.95,
        });
      }

      if (this.capabilities.android.apiLevel < 23) {
        optimizations.push({
          type: 'ui',
          value: 'legacy',
          reason: 'Pre-Android 6.0 requires legacy permission handling',
          confidence: 1.0,
        });
      }
    }

    // iOS version optimizations
    if (Platform.OS === 'ios' && this.capabilities.ios) {
      if (this.capabilities.ios.iosVersion >= 14) {
        optimizations.push({
          type: 'ui',
          value: 'modern',
          reason: 'iOS 14+ supports modern permission UI patterns',
          confidence: 0.9,
        });
      }
    }

    return optimizations;
  }

  /**
   * Check if device supports specific healthcare features
   */
  public supportsHealthcareFeature(feature: string): boolean {
    if (!this.capabilities) return false;

    switch (feature) {
      case 'healthkit':
        return Platform.OS === 'ios' && this.capabilities.hasHealthKit;
      case 'googlefit':
        return (
          Platform.OS === 'android' && this.capabilities.android?.hasGooglePlayServices === true
        );
      case 'emergency-sos':
        return this.capabilities.emergencySOSAvailable;
      case 'medical-id':
        return this.capabilities.medicalIDSupported;
      case 'biometric-auth':
        return this.capabilities.hasBiometrics;
      default:
        return false;
    }
  }

  /**
   * Get recommended permission request strategy
   */
  public getRecommendedStrategy(): {
    batchingStrategy: 'parallel' | 'sequential' | 'hybrid';
    educationStyle: 'minimal' | 'standard' | 'comprehensive';
    retryStrategy: 'immediate' | 'delayed' | 'escalated';
    fallbackApproach: 'aggressive' | 'moderate' | 'conservative';
  } {
    if (!this.capabilities) {
      return {
        batchingStrategy: 'parallel',
        educationStyle: 'standard',
        retryStrategy: 'delayed',
        fallbackApproach: 'moderate',
      };
    }

    return {
      batchingStrategy: this.getBatchingStrategy(),
      educationStyle: this.getEducationStyle(),
      retryStrategy: this.getRetryStrategy(),
      fallbackApproach: this.getFallbackApproach(),
    };
  }

  /**
   * Force refresh device capabilities
   */
  public async refreshCapabilities(): Promise<void> {
    this.capabilities = await this.detectCapabilities();
    await this.cacheCapabilities(this.capabilities);
  }

  // Private methods

  private async detectCapabilities(): Promise<DeviceCapabilities> {
    const capabilities: DeviceCapabilities = {
      // Hardware detection
      hasCamera: await this.detectCameraCapability(),
      hasMicrophone: await this.detectMicrophoneCapability(),
      hasGPS: await this.detectGPSCapability(),
      hasHealthKit: await this.detectHealthKitCapability(),
      hasNotifications: true, // Assume available
      hasSecureStorage: await this.detectSecureStorageCapability(),
      hasBiometrics: await this.detectBiometricsCapability(),
      hasNFC: await this.detectNFCCapability(),

      // Device information
      manufacturer: Device.manufacturer || 'Unknown',
      model: Device.modelName || 'Unknown',
      osVersion: Device.osVersion || '0',
      isEmulator: !Device.isDevice,
      deviceType: this.getDeviceType(),

      // Permission optimizations
      permissionTimeoutMs: this.getOptimalTimeout(),
      supportsGranularPermissions: this.supportsGranularPermissions(),
      requiresSequentialRequests: this.requiresSequentialRequests(),
      requiresDelayedSequential: this.requiresDelayedSequential(),
      preRequestDelayMs: this.getOptimalPreRequestDelay(),
      maxConcurrentRequests: this.getMaxConcurrentRequests(),

      // Performance characteristics
      isLowEndDevice: await this.detectLowEndDevice(),
      availableMemoryMB: await this.getAvailableMemory(),
      cpuCores: await this.getCPUCores(),

      // Special features
      darkModeSupported: true, // Modern devices support this
      has5G: await this.detect5GCapability(),
      hasWiFi: true, // Assume available
      hasCellular: Device.deviceType !== Device.DeviceType.DESKTOP,

      // Healthcare-specific
      healthIntegrationSupported: await this.detectHealthIntegration(),
      emergencySOSAvailable: await this.detectEmergencySOSCapability(),
      medicalIDSupported: await this.detectMedicalIDCapability(),
    };

    // Platform-specific detection
    if (Platform.OS === 'ios') {
      capabilities.ios = await this.detectiOSSpecificCapabilities();
    } else if (Platform.OS === 'android') {
      capabilities.android = await this.detectAndroidSpecificCapabilities();
    }

    return capabilities;
  }

  private async detectCameraCapability(): Promise<boolean> {
    try {
      // Use expo-camera to detect camera availability
      return Device.isDevice && Device.deviceType !== Device.DeviceType.TV;
    } catch {
      return false;
    }
  }

  private async detectMicrophoneCapability(): Promise<boolean> {
    try {
      return Device.isDevice && Device.deviceType !== Device.DeviceType.TV;
    } catch {
      return false;
    }
  }

  private async detectGPSCapability(): Promise<boolean> {
    return Device.isDevice && Device.deviceType !== Device.DeviceType.DESKTOP;
  }

  private async detectHealthKitCapability(): Promise<boolean> {
    return Platform.OS === 'ios' && Device.isDevice;
  }

  private async detectSecureStorageCapability(): Promise<boolean> {
    return Device.isDevice;
  }

  private async detectBiometricsCapability(): Promise<boolean> {
    return Device.isDevice && Device.deviceType !== Device.DeviceType.TV;
  }

  private async detectNFCCapability(): Promise<boolean> {
    return Device.isDevice && Device.deviceType === Device.DeviceType.PHONE;
  }

  private getDeviceType(): 'phone' | 'tablet' | 'tv' | 'desktop' | 'unknown' {
    switch (Device.deviceType) {
      case Device.DeviceType.PHONE:
        return 'phone';
      case Device.DeviceType.TABLET:
        return 'tablet';
      case Device.DeviceType.TV:
        return 'tv';
      case Device.DeviceType.DESKTOP:
        return 'desktop';
      default:
        return 'unknown';
    }
  }

  private getOptimalTimeout(): number {
    const manufacturer = Device.manufacturer?.toLowerCase();

    if (manufacturer?.includes('samsung')) return 20000;
    if (manufacturer?.includes('xiaomi')) return 15000;
    if (manufacturer?.includes('huawei')) return 25000;
    if (manufacturer?.includes('oneplus')) return 12000;
    if (manufacturer?.includes('google')) return 10000;
    if (Platform.OS === 'ios') return 8000;

    return 10000; // Default
  }

  private supportsGranularPermissions(): boolean {
    if (Platform.OS === 'android') {
      return Platform.Version >= 23;
    }
    return Platform.OS === 'ios';
  }

  private requiresSequentialRequests(): boolean {
    const manufacturer = Device.manufacturer?.toLowerCase();
    return manufacturer?.includes('xiaomi') === true;
  }

  private requiresDelayedSequential(): boolean {
    const manufacturer = Device.manufacturer?.toLowerCase();
    return manufacturer?.includes('huawei') === true;
  }

  private getOptimalPreRequestDelay(): number {
    const manufacturer = Device.manufacturer?.toLowerCase();

    if (manufacturer?.includes('samsung')) return 1000;
    if (manufacturer?.includes('huawei')) return 1500;
    if (manufacturer?.includes('xiaomi')) return 800;

    return 0;
  }

  private getMaxConcurrentRequests(): number {
    if (this.requiresSequentialRequests()) return 1;
    return Platform.OS === 'ios' ? 3 : 2;
  }

  private async detectLowEndDevice(): Promise<boolean> {
    const availableMemory = await this.getAvailableMemory();
    const cpuCores = await this.getCPUCores();

    return availableMemory < 2048 || cpuCores < 4;
  }

  private async getAvailableMemory(): Promise<number> {
    // Simplified memory detection
    if (Device.deviceType === Device.DeviceType.PHONE) {
      const year = this.getDeviceYear();
      if (year < 2018) return 1024;
      if (year < 2020) return 2048;
      return 4096;
    }
    return 2048;
  }

  private async getCPUCores(): Promise<number> {
    // Simplified CPU core estimation
    const year = this.getDeviceYear();
    if (year < 2017) return 2;
    if (year < 2019) return 4;
    return 8;
  }

  private getDeviceYear(): number {
    const model = Device.modelName?.toLowerCase() || '';

    // Simple heuristic based on model names
    if (model.includes('se') || model.includes('6s')) return 2015;
    if (model.includes('7') || model.includes('s8')) return 2017;
    if (model.includes('8') || model.includes('s9') || model.includes('x')) return 2018;
    if (model.includes('11') || model.includes('s10')) return 2019;
    if (model.includes('12') || model.includes('s20')) return 2020;
    if (model.includes('13') || model.includes('s21')) return 2021;
    if (model.includes('14') || model.includes('s22')) return 2022;

    return 2021; // Default to recent year
  }

  private async detect5GCapability(): Promise<boolean> {
    const year = this.getDeviceYear();
    return year >= 2020 && Device.deviceType === Device.DeviceType.PHONE;
  }

  private async detectHealthIntegration(): Promise<boolean> {
    if (Platform.OS === 'ios') return true;
    if (Platform.OS === 'android') {
      const android = await this.detectAndroidSpecificCapabilities();
      return android.hasGooglePlayServices;
    }
    return false;
  }

  private async detectEmergencySOSCapability(): Promise<boolean> {
    return Device.isDevice && Device.deviceType === Device.DeviceType.PHONE;
  }

  private async detectMedicalIDCapability(): Promise<boolean> {
    return Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 24);
  }

  private async detectiOSSpecificCapabilities() {
    const osVersion = parseFloat(Device.osVersion || '0');

    return {
      iosVersion: osVersion,
      isJailbroken: false, // Would require additional detection
      supportsAppClips: osVersion >= 14,
      supportsWidgets: osVersion >= 14,
    };
  }

  private async detectAndroidSpecificCapabilities() {
    return {
      apiLevel: Platform.Version as number,
      isRooted: false, // Would require additional detection
      hasGooglePlayServices: await this.detectGooglePlayServices(),
      hasHMSCore: await this.detectHMSCore(),
      customUI: this.detectCustomUI(),
    };
  }

  private async detectGooglePlayServices(): Promise<boolean> {
    const manufacturer = Device.manufacturer?.toLowerCase();
    return !manufacturer?.includes('huawei');
  }

  private async detectHMSCore(): Promise<boolean> {
    const manufacturer = Device.manufacturer?.toLowerCase();
    return manufacturer?.includes('huawei') === true;
  }

  private detectCustomUI(): 'oneui' | 'miui' | 'emui' | 'oxygenos' | 'stock' | 'unknown' {
    const manufacturer = Device.manufacturer?.toLowerCase();

    if (manufacturer?.includes('samsung')) return 'oneui';
    if (manufacturer?.includes('xiaomi')) return 'miui';
    if (manufacturer?.includes('huawei')) return 'emui';
    if (manufacturer?.includes('oneplus')) return 'oxygenos';
    if (manufacturer?.includes('google')) return 'stock';

    return 'unknown';
  }

  private getBatchingStrategy(): 'parallel' | 'sequential' | 'hybrid' {
    if (!this.capabilities) return 'parallel';

    if (this.capabilities.requiresSequentialRequests) return 'sequential';
    if (this.capabilities.isLowEndDevice) return 'sequential';
    if (this.capabilities.requiresDelayedSequential) return 'sequential';

    return 'parallel';
  }

  private getEducationStyle(): 'minimal' | 'standard' | 'comprehensive' {
    if (!this.capabilities) return 'standard';

    if (this.capabilities.isLowEndDevice) return 'minimal';
    if (this.capabilities.deviceType === 'tablet') return 'comprehensive';

    return 'standard';
  }

  private getRetryStrategy(): 'immediate' | 'delayed' | 'escalated' {
    if (!this.capabilities) return 'delayed';

    if (this.capabilities.manufacturer === 'Xiaomi') return 'escalated';
    if (this.capabilities.isLowEndDevice) return 'delayed';

    return 'delayed';
  }

  private getFallbackApproach(): 'aggressive' | 'moderate' | 'conservative' {
    if (!this.capabilities) return 'moderate';

    if (this.capabilities.healthIntegrationSupported) return 'aggressive';
    if (this.capabilities.isLowEndDevice) return 'conservative';

    return 'moderate';
  }

  private async loadCachedCapabilities(): Promise<{
    data: DeviceCapabilities;
    timestamp: number;
  } | null> {
    try {
      const cached = await AsyncStorage.getItem(this.cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  private async cacheCapabilities(capabilities: DeviceCapabilities): Promise<void> {
    try {
      const cacheData = {
        data: capabilities,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache device capabilities:', error);
    }
  }

  private isCacheExpired(timestamp: number): boolean {
    const expiryMs = this.cacheExpiryHours * 60 * 60 * 1000;
    return Date.now() - timestamp > expiryMs;
  }
}
