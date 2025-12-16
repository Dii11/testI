/**
 * Device-Specific Permission Optimizations - Phase 2
 *
 * Handles manufacturer-specific permission quirks, Android API level variations,
 * iOS version differences, and device-specific timeout optimizations.
 */

import * as Device from 'expo-device';
import { Platform, NativeModules } from 'react-native';

import type { PermissionType, DeviceCapabilities } from '../PermissionManagerMigrated';

export interface DeviceOptimization {
  manufacturer: string;
  model?: string;
  osVersion?: string;
  apiLevel?: number;
  optimizations: {
    permissionTimeouts: Record<PermissionType, number>;
    batchDelay: number;
    retryStrategy: {
      maxRetries: number;
      backoffMultiplier: number;
      initialDelay: number;
    };
    specialHandling?: {
      requiresExtraDelay?: boolean;
      needsCustomDialog?: boolean;
      hasPermissionBugs?: boolean;
      recommendedApproach?: string;
    };
  };
  knownIssues?: {
    description: string;
    workaround: string;
    affectedVersions?: string[];
  }[];
}

export interface PermissionTiming {
  requestTimeout: number;
  batchDelay: number;
  retryDelay: number;
  educationDelay: number;
}

export class DeviceSpecificOptimizations {
  private static instance: DeviceSpecificOptimizations;
  private currentDevice: DeviceOptimization | null = null;
  private deviceCapabilities: DeviceCapabilities | null = null;

  // Known device optimizations database
  private optimizations: DeviceOptimization[] = [];

  static getInstance(): DeviceSpecificOptimizations {
    if (!DeviceSpecificOptimizations.instance) {
      DeviceSpecificOptimizations.instance = new DeviceSpecificOptimizations();
    }
    return DeviceSpecificOptimizations.instance;
  }

  constructor() {
    this.initializeOptimizations();
  }

  /**
   * Initialize the optimization system with device detection
   */
  async initialize(deviceCapabilities: DeviceCapabilities): Promise<void> {
    this.deviceCapabilities = deviceCapabilities;
    this.currentDevice = await this.detectDeviceOptimization();

    console.log('🔧 Device-specific optimizations initialized:', {
      manufacturer: this.currentDevice?.manufacturer,
      hasOptimizations: !!this.currentDevice,
      knownIssues: this.currentDevice?.knownIssues?.length || 0,
    });
  }

  /**
   * Get optimized timing for permission requests
   */
  getOptimizedTiming(permissionType: PermissionType): PermissionTiming {
    const defaults: PermissionTiming = {
      requestTimeout: 15000,
      batchDelay: 200,
      retryDelay: 30000,
      educationDelay: 1000,
    };

    if (!this.currentDevice) {
      return defaults;
    }

    const deviceTimeouts = this.currentDevice.optimizations.permissionTimeouts;
    const deviceRetry = this.currentDevice.optimizations.retryStrategy;

    return {
      requestTimeout: deviceTimeouts[permissionType] || defaults.requestTimeout,
      batchDelay: this.currentDevice.optimizations.batchDelay || defaults.batchDelay,
      retryDelay: deviceRetry.initialDelay || defaults.retryDelay,
      educationDelay: this.getEducationDelay(),
    };
  }

  /**
   * Check if permission requires special handling on current device
   */
  requiresSpecialHandling(permissionType: PermissionType): boolean {
    if (!this.currentDevice?.optimizations.specialHandling) {
      return false;
    }

    return (
      this.currentDevice.optimizations.specialHandling.requiresExtraDelay ||
      this.currentDevice.optimizations.specialHandling.needsCustomDialog ||
      false
    );
  }

  /**
   * Get device-specific workarounds for known issues
   */
  getKnownIssueWorkarounds(permissionType: PermissionType): string[] {
    if (!this.currentDevice?.knownIssues) {
      return [];
    }

    return this.currentDevice.knownIssues
      .filter(issue => issue.description.toLowerCase().includes(permissionType.toLowerCase()))
      .map(issue => issue.workaround);
  }

  /**
   * Get optimal batch size for permission requests
   */
  getOptimalBatchSize(): number {
    if (!this.currentDevice) {
      return 3; // Default conservative batch size
    }

    // Adjust based on device performance and known issues
    if (this.currentDevice.optimizations.specialHandling?.hasPermissionBugs) {
      return 1; // Sequential requests only
    }

    if (this.isLowEndDevice()) {
      return 2; // Smaller batches for low-end devices
    }

    return 3; // Standard batch size
  }

  /**
   * Determine if device needs pre-permission preparation
   */
  needsPrePermissionPreparation(permissionType: PermissionType): boolean {
    if (!this.currentDevice) return false;

    // Samsung devices with One UI often need extra preparation
    if (this.currentDevice.manufacturer.toLowerCase().includes('samsung')) {
      return ['camera', 'microphone', 'location'].includes(permissionType);
    }

    // Xiaomi MIUI requires extra care
    if (this.currentDevice.manufacturer.toLowerCase().includes('xiaomi')) {
      return true; // Almost all permissions need preparation on MIUI
    }

    return false;
  }

  /**
   * Get device-specific permission request strategy
   */
  getPermissionRequestStrategy(
    permissionType: PermissionType
  ): 'standard' | 'delayed' | 'sequential' | 'batched' {
    if (!this.currentDevice) return 'standard';

    const specialHandling = this.currentDevice.optimizations.specialHandling;

    if (specialHandling?.hasPermissionBugs) {
      return 'sequential';
    }

    if (specialHandling?.requiresExtraDelay) {
      return 'delayed';
    }

    if (this.isHighEndDevice() && !this.hasKnownBatchingIssues()) {
      return 'batched';
    }

    return 'standard';
  }

  /**
   * Apply device-specific pre-request optimizations
   */
  async applyPreRequestOptimizations(permissionType: PermissionType): Promise<void> {
    if (!this.needsPrePermissionPreparation(permissionType)) {
      return;
    }

    console.log(
      `🔧 Applying pre-request optimizations for ${permissionType} on ${this.currentDevice?.manufacturer}`
    );

    // Add delay for devices that need it
    if (this.currentDevice?.optimizations.specialHandling?.requiresExtraDelay) {
      await this.delay(500);
    }

    // Prepare UI state for devices with custom dialogs
    if (this.currentDevice?.optimizations.specialHandling?.needsCustomDialog) {
      await this.prepareCustomDialog(permissionType);
    }
  }

  /**
   * Get manufacturer-specific permission messaging
   */
  getManufacturerSpecificMessaging(permissionType: PermissionType): {
    title?: string;
    message?: string;
    additionalInfo?: string;
  } {
    if (!this.currentDevice) return {};

    const manufacturer = this.currentDevice.manufacturer.toLowerCase();

    // Samsung One UI specific messaging
    if (manufacturer.includes('samsung')) {
      return this.getSamsungMessaging(permissionType);
    }

    // Xiaomi MIUI specific messaging
    if (manufacturer.includes('xiaomi')) {
      return this.getXiaomiMessaging(permissionType);
    }

    // Huawei EMUI specific messaging
    if (manufacturer.includes('huawei')) {
      return this.getHuaweiMessaging(permissionType);
    }

    // OnePlus OxygenOS specific messaging
    if (manufacturer.includes('oneplus')) {
      return this.getOnePlusMessaging(permissionType);
    }

    return {};
  }

  // Private implementation methods

  private initializeOptimizations(): void {
    // Samsung Galaxy devices with One UI
    this.optimizations.push({
      manufacturer: 'samsung',
      optimizations: {
        permissionTimeouts: {
          camera: 20000,
          microphone: 15000,
          'camera+microphone': 25000,
          location: 18000,
          notifications: 12000,
          health: 22000,
          photos: 15000,
          storage: 15000,
          'location-precise': 20000,
          'location-coarse': 15000,
        },
        batchDelay: 400,
        retryStrategy: {
          maxRetries: 3,
          backoffMultiplier: 1.5,
          initialDelay: 45000,
        },
        specialHandling: {
          requiresExtraDelay: true,
          needsCustomDialog: false,
          hasPermissionBugs: false,
          recommendedApproach: 'sequential-with-delay',
        },
      },
      knownIssues: [
        {
          description: 'One UI sometimes delays camera permission dialog',
          workaround: 'Add 500ms delay before camera permission request',
        },
      ],
    });

    // Xiaomi MIUI devices
    this.optimizations.push({
      manufacturer: 'xiaomi',
      optimizations: {
        permissionTimeouts: {
          camera: 25000,
          microphone: 20000,
          'camera+microphone': 30000,
          location: 25000,
          notifications: 20000,
          health: 25000,
          photos: 20000,
          storage: 20000,
          'location-precise': 25000,
          'location-coarse': 20000,
        },
        batchDelay: 600,
        retryStrategy: {
          maxRetries: 2,
          backoffMultiplier: 2.0,
          initialDelay: 60000,
        },
        specialHandling: {
          requiresExtraDelay: true,
          needsCustomDialog: true,
          hasPermissionBugs: true,
          recommendedApproach: 'sequential-only',
        },
      },
      knownIssues: [
        {
          description: 'MIUI can block permissions silently',
          workaround: 'Always provide manual settings guidance',
        },
        {
          description: 'Batch permission requests often fail',
          workaround: 'Request permissions one at a time with delays',
        },
      ],
    });

    // Huawei EMUI devices
    this.optimizations.push({
      manufacturer: 'huawei',
      optimizations: {
        permissionTimeouts: {
          camera: 22000,
          microphone: 18000,
          'camera+microphone': 28000,
          location: 22000,
          notifications: 18000,
          health: 20000,
          photos: 18000,
          storage: 18000,
          'location-precise': 22000,
          'location-coarse': 18000,
        },
        batchDelay: 500,
        retryStrategy: {
          maxRetries: 2,
          backoffMultiplier: 1.8,
          initialDelay: 50000,
        },
        specialHandling: {
          requiresExtraDelay: true,
          needsCustomDialog: false,
          hasPermissionBugs: false,
          recommendedApproach: 'delayed-sequential',
        },
      },
    });

    // OnePlus OxygenOS devices
    this.optimizations.push({
      manufacturer: 'oneplus',
      optimizations: {
        permissionTimeouts: {
          camera: 18000,
          microphone: 15000,
          'camera+microphone': 22000,
          location: 18000,
          notifications: 12000,
          health: 20000,
          photos: 15000,
          storage: 15000,
          'location-precise': 18000,
          'location-coarse': 15000,
        },
        batchDelay: 300,
        retryStrategy: {
          maxRetries: 3,
          backoffMultiplier: 1.3,
          initialDelay: 35000,
        },
        specialHandling: {
          requiresExtraDelay: false,
          needsCustomDialog: false,
          hasPermissionBugs: false,
          recommendedApproach: 'standard',
        },
      },
    });

    // Google Pixel devices (stock Android)
    this.optimizations.push({
      manufacturer: 'google',
      optimizations: {
        permissionTimeouts: {
          camera: 15000,
          microphone: 12000,
          'camera+microphone': 18000,
          location: 15000,
          notifications: 10000,
          health: 18000,
          photos: 12000,
          storage: 12000,
          'location-precise': 15000,
          'location-coarse': 12000,
        },
        batchDelay: 200,
        retryStrategy: {
          maxRetries: 3,
          backoffMultiplier: 1.2,
          initialDelay: 30000,
        },
        specialHandling: {
          requiresExtraDelay: false,
          needsCustomDialog: false,
          hasPermissionBugs: false,
          recommendedApproach: 'batched',
        },
      },
    });
  }

  private async detectDeviceOptimization(): Promise<DeviceOptimization | null> {
    const manufacturer = (
      Device.manufacturer ||
      this.deviceCapabilities?.manufacturer ||
      ''
    ).toLowerCase();
    const model = Device.modelName || this.deviceCapabilities?.model || '';
    const osVersion = Device.osVersion || Platform.Version.toString();

    console.log('🔍 Detecting device optimization for:', { manufacturer, model, osVersion });

    // Find matching optimization
    for (const optimization of this.optimizations) {
      if (manufacturer.includes(optimization.manufacturer.toLowerCase())) {
        console.log(`✅ Found optimization for ${optimization.manufacturer}`);
        return {
          ...optimization,
          model,
          osVersion,
        };
      }
    }

    console.log('ℹ️ No specific optimization found, using defaults');
    return null;
  }

  private getEducationDelay(): number {
    if (!this.currentDevice) return 1000;

    // Slower devices need more time for users to read
    if (this.isLowEndDevice()) {
      return 2000;
    }

    // Devices with custom skins might need extra time
    if (this.hasCustomSkin()) {
      return 1500;
    }

    return 1000;
  }

  private isLowEndDevice(): boolean {
    if (!this.deviceCapabilities) return false;

    // Basic heuristics for low-end device detection
    const manufacturer = this.deviceCapabilities.manufacturer.toLowerCase();
    const model = this.deviceCapabilities.model.toLowerCase();

    // Known low-end device indicators
    if (model.includes('lite') || model.includes('go') || model.includes('mini')) {
      return true;
    }

    // Android Go devices
    if (
      Platform.OS === 'android' &&
      this.deviceCapabilities.apiLevel &&
      this.deviceCapabilities.apiLevel >= 27
    ) {
      // Could detect Android Go, but this is complex
      return false;
    }

    return false;
  }

  private isHighEndDevice(): boolean {
    if (!this.deviceCapabilities) return false;

    const manufacturer = this.deviceCapabilities.manufacturer.toLowerCase();
    const model = this.deviceCapabilities.model.toLowerCase();

    // Known high-end indicators
    if (manufacturer.includes('google') && model.includes('pixel')) {
      return true;
    }

    if (
      manufacturer.includes('samsung') &&
      (model.includes('galaxy s') || model.includes('note'))
    ) {
      return true;
    }

    if (manufacturer.includes('oneplus')) {
      return true;
    }

    return false;
  }

  private hasCustomSkin(): boolean {
    if (!this.currentDevice) return false;

    const manufacturer = this.currentDevice.manufacturer.toLowerCase();

    // Manufacturers with heavy UI customizations
    return ['samsung', 'xiaomi', 'huawei', 'oppo', 'vivo'].some(m => manufacturer.includes(m));
  }

  private hasKnownBatchingIssues(): boolean {
    return this.currentDevice?.optimizations.specialHandling?.hasPermissionBugs || false;
  }

  private async prepareCustomDialog(permissionType: PermissionType): Promise<void> {
    // Prepare UI state for devices that need custom dialog handling
    console.log(`🔧 Preparing custom dialog for ${permissionType}`);
    await this.delay(200);
  }

  private getSamsungMessaging(permissionType: PermissionType): any {
    return {
      additionalInfo:
        'Samsung devices may show additional security prompts. This is normal and helps protect your privacy.',
    };
  }

  private getXiaomiMessaging(permissionType: PermissionType): any {
    return {
      title: `MIUI Permission Required`,
      additionalInfo:
        'MIUI may require you to enable permissions in multiple steps. Please follow all prompts to ensure the feature works properly.',
    };
  }

  private getHuaweiMessaging(permissionType: PermissionType): any {
    return {
      additionalInfo:
        'EMUI provides enhanced privacy controls. You may see additional permission screens.',
    };
  }

  private getOnePlusMessaging(permissionType: PermissionType): any {
    return {
      additionalInfo: 'OxygenOS streamlines permission requests for a smooth experience.',
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default DeviceSpecificOptimizations.getInstance();
