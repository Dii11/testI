/**
 * Android-specific Permission Handler
 *
 * Handles Android's complex permission system with API level awareness,
 * device-specific workarounds, and proper handling of special permissions
 */

import * as Device from 'expo-device';
import { Platform, PermissionsAndroid } from 'react-native';

import type {
  PermissionType,
  PermissionContext as PermissionRequestContext,
  PermissionResult,
  DegradationStrategy,
} from '../permissions/ConsolidatedPermissionManager';

// Legacy DeviceCapabilities type for compatibility
export interface DeviceCapabilities {
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasGPS: boolean;
  hasHealthKit: boolean;
  hasNotifications: boolean;
  isEmulator: boolean;
  manufacturer: string;
  model: string;
  osVersion: string;
  apiLevel?: number;
  permissionTimeoutMs: number;
  supportsGranularPermissions: boolean;
  tier?: string; // Device performance tier
}

export interface AndroidPermissionMapping {
  [key: string]: string | string[];
}

export interface DeviceWorkaround {
  manufacturer: string;
  models?: string[];
  workaround: (permission: string, context: PermissionRequestContext) => PermissionRequestOptions;
}

export interface PermissionRequestOptions {
  rationale?: {
    title: string;
    message: string;
    buttonPositive: string;
    buttonNegative?: string;
  };
  showRequestRationale?: boolean;
  requestTimeout?: number;
  retryOnFailure?: boolean;
}

export class AndroidPermissionHandler {
  private deviceCapabilities: DeviceCapabilities;
  private apiLevel: number;

  // Android permission mappings
  private readonly PERMISSION_MAPPINGS: AndroidPermissionMapping = {
    camera: PermissionsAndroid.PERMISSIONS.CAMERA,
    microphone: PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    'location-coarse': PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    'location-precise': [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ],
    location: [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ],
    'read-external-storage': PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    'write-external-storage': PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  };

  // Android 13+ granular media permissions
  private readonly ANDROID_13_PERMISSIONS = {
    photos: 'android.permission.READ_MEDIA_IMAGES',
    videos: 'android.permission.READ_MEDIA_VIDEO',
    audio: 'android.permission.READ_MEDIA_AUDIO',
    notifications: 'android.permission.POST_NOTIFICATIONS',
  };

  // Device-specific workarounds
  private readonly DEVICE_WORKAROUNDS: DeviceWorkaround[] = [
    {
      manufacturer: 'samsung',
      workaround: (permission, context) => ({
        rationale: {
          title: 'Permission Required',
          message:
            context.educationalContent?.description ||
            'This permission is needed for the app to function properly.',
          buttonPositive: 'Continue',
          buttonNegative: 'Cancel',
        },
        showRequestRationale: true,
        requestTimeout: 25000, // Samsung devices can be slow
      }),
    },
    {
      manufacturer: 'xiaomi',
      workaround: (permission, context) => ({
        showRequestRationale: true,
        requestTimeout: 30000, // MIUI permission dialogs can take longer
        retryOnFailure: true,
      }),
    },
    {
      manufacturer: 'oneplus',
      workaround: (permission, context) => ({
        requestTimeout: 30000, // OxygenOS specific handling
        showRequestRationale: context.priority === 'critical',
      }),
    },
    {
      manufacturer: 'huawei',
      workaround: (permission, context) => ({
        requestTimeout: 35000, // EMUI can be very slow
        showRequestRationale: true,
        retryOnFailure: true,
      }),
    },
    {
      manufacturer: 'oppo',
      models: ['a', 'r', 'find'], // Common OPPO series
      workaround: (permission, context) => ({
        requestTimeout: 25000,
        showRequestRationale: context.userInitiated,
      }),
    },
  ];

  constructor(deviceCapabilities: DeviceCapabilities) {
    this.deviceCapabilities = deviceCapabilities;
    this.apiLevel = Platform.Version as number;
  }

  /**
   * Handle Android permission request with API level and device awareness
   */
  async requestPermission(
    type: PermissionType,
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    console.log(`🤖 Android: Requesting ${type} permission on API ${this.apiLevel}`);

    // Pre-Android 6.0 (API 23) - Permissions granted at install time
    if (this.apiLevel < 23) {
      return this.handleLegacyAndroidPermission(type);
    }

    // Handle special permissions for different API levels
    if (this.apiLevel >= 33 && this.requiresAndroid13Handling(type)) {
      return this.handleAndroid13Permission(type, context);
    }

    if (this.apiLevel >= 30 && type === 'storage') {
      return this.handleScopedStoragePermission(context);
    }

    if (this.apiLevel >= 31 && this.isLocationPermission(type)) {
      return this.handleAndroid12LocationPermission(type, context);
    }

    // Standard runtime permission handling
    return this.handleRuntimePermission(type, context);
  }

  /**
   * Check current permission status
   */
  async checkPermission(type: PermissionType): Promise<PermissionResult> {
    const permissions = this.getAndroidPermissions(type);

    if (Array.isArray(permissions)) {
      // Multiple permissions - check all
      const results = await Promise.all(permissions.map(p => PermissionsAndroid.check(p as any)));

      const allGranted = results.every(Boolean);
      const someGranted = results.some(Boolean);

      return {
        status: allGranted ? 'granted' : someGranted ? 'limited' : 'denied',
        canAskAgain: !allGranted,
        fallbackAvailable: someGranted || this.hasFallbackStrategy(type),
        metadata: this.createMetadata('fresh'),
      };
    } else {
      // Single permission
      const hasPermission = await PermissionsAndroid.check(permissions as any);
      return {
        status: hasPermission ? 'granted' : 'denied',
        canAskAgain: !hasPermission,
        fallbackAvailable: this.hasFallbackStrategy(type),
        metadata: this.createMetadata('fresh'),
      };
    }
  }

  /**
   * Handle Android 13+ granular media permissions
   */
  private async handleAndroid13Permission(
    type: PermissionType,
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    const permission =
      this.ANDROID_13_PERMISSIONS[type as keyof typeof this.ANDROID_13_PERMISSIONS];

    if (!permission) {
      throw new Error(`No Android 13 permission mapping for ${type}`);
    }

    const options = this.getDeviceSpecificOptions(permission, context);

    try {
      const granted = await this.requestWithOptions(permission, options);

      return {
        status:
          granted === 'granted' ? 'granted' : granted === 'never_ask_again' ? 'blocked' : 'denied',
        canAskAgain: granted !== 'never_ask_again' && granted !== 'granted',
        fallbackAvailable: this.hasFallbackStrategy(type),
        degradationPath: granted !== 'granted' ? context.fallbackStrategy : undefined,
        metadata: this.createMetadata('fresh'),
      };
    } catch (error) {
      console.warn(`Android 13 permission request failed for ${type}:`, error);

      // Fallback to legacy permission if available
      if (type === 'photos' || type === 'storage') {
        return this.handleLegacyStoragePermission(context);
      }

      throw error;
    }
  }

  /**
   * Handle Android 12+ location permissions with approximate/precise choice
   */
  private async handleAndroid12LocationPermission(
    type: PermissionType,
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];

    const options = this.getDeviceSpecificOptions(permissions[0], context);

    try {
      const results = await PermissionsAndroid.requestMultiple(permissions as any);

      const hasCoarse =
        results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === 'granted';
      const hasFine = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted';

      let status: 'granted' | 'limited' | 'denied' | 'blocked';
      let accuracy: 'precise' | 'approximate' | undefined;

      if (hasFine) {
        status = 'granted';
        accuracy = 'precise';
      } else if (hasCoarse) {
        status = type === 'location-precise' ? 'limited' : 'granted';
        accuracy = 'approximate';
      } else {
        const coarseStatus = results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
        status = coarseStatus === 'never_ask_again' ? 'blocked' : 'denied';
      }

      return {
        status,
        canAskAgain: status === 'denied',
        accuracy,
        fallbackAvailable: status !== 'granted' && this.hasFallbackStrategy(type),
        degradationPath:
          status !== 'granted' ? this.createLocationDegradationPath(type, accuracy) : undefined,
        metadata: this.createMetadata('fresh'),
      };
    } catch (error) {
      console.error('Android 12 location permission failed:', error);
      throw error;
    }
  }

  /**
   * Handle Android 11+ scoped storage
   */
  private async handleScopedStoragePermission(
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    // Android 11+ uses scoped storage, might not need explicit permission
    // for app-specific directories

    if (context.feature === 'app-documents' || context.feature === 'cache') {
      // App-specific storage doesn't require permission
      return {
        status: 'granted',
        canAskAgain: false,
        message: 'Using scoped storage',
        fallbackAvailable: false,
        metadata: this.createMetadata('fresh'),
      };
    }

    // For accessing shared storage, still need permission
    return this.handleLegacyStoragePermission(context);
  }

  /**
   * Handle standard runtime permissions
   */
  private async handleRuntimePermission(
    type: PermissionType,
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    const permissions = this.getAndroidPermissions(type);

    if (Array.isArray(permissions)) {
      return this.handleMultiplePermissions(permissions, type, context);
    } else {
      return this.handleSinglePermission(permissions, type, context);
    }
  }

  /**
   * Handle multiple related permissions
   */
  private async handleMultiplePermissions(
    permissions: string[],
    type: PermissionType,
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    const options = this.getDeviceSpecificOptions(permissions[0], context);

    try {
      const results = await PermissionsAndroid.requestMultiple(permissions as any);

      const grantedPermissions = Object.entries(results).filter(
        ([, status]) => status === 'granted'
      );
      const blockedPermissions = Object.entries(results).filter(
        ([, status]) => status === 'never_ask_again'
      );

      const allGranted = grantedPermissions.length === permissions.length;
      const someGranted = grantedPermissions.length > 0;
      const someBlocked = blockedPermissions.length > 0;

      let status: PermissionResult['status'];
      if (allGranted) {
        status = 'granted';
      } else if (someBlocked) {
        status = 'blocked';
      } else if (someGranted) {
        status = 'limited';
      } else {
        status = 'denied';
      }

      return {
        status,
        canAskAgain: !someBlocked && !allGranted,
        fallbackAvailable: someGranted || this.hasFallbackStrategy(type),
        batchResults: this.createBatchResults(results, permissions, type),
        degradationPath: status !== 'granted' ? context.fallbackStrategy : undefined,
        metadata: this.createMetadata('fresh'),
      };
    } catch (error) {
      console.error('Multiple permissions request failed:', error);
      throw error;
    }
  }

  /**
   * Handle single permission request
   */
  private async handleSinglePermission(
    permission: string,
    type: PermissionType,
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    const options = this.getDeviceSpecificOptions(permission, context);

    try {
      const granted = await this.requestWithOptions(permission, options);

      return {
        status:
          granted === 'granted' ? 'granted' : granted === 'never_ask_again' ? 'blocked' : 'denied',
        canAskAgain: granted !== 'never_ask_again' && granted !== 'granted',
        fallbackAvailable: this.hasFallbackStrategy(type),
        degradationPath: granted !== 'granted' ? context.fallbackStrategy : undefined,
        metadata: this.createMetadata('fresh'),
      };
    } catch (error) {
      console.error(`Single permission request failed for ${permission}:`, error);
      throw error;
    }
  }

  /**
   * Request permission with device-specific options and timeout
   */
  private async requestWithOptions(
    permission: string,
    options: PermissionRequestOptions
  ): Promise<string> {
    const requestPromise = PermissionsAndroid.request(permission as any, options.rationale);

    if (options.requestTimeout) {
      return Promise.race([
        requestPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Permission request timeout')), options.requestTimeout)
        ),
      ]);
    }

    return requestPromise;
  }

  /**
   * Get device-specific workarounds and options
   */
  private getDeviceSpecificOptions(
    permission: string,
    context: PermissionRequestContext
  ): PermissionRequestOptions {
    const manufacturer = this.deviceCapabilities.manufacturer.toLowerCase();
    const model = this.deviceCapabilities.model.toLowerCase();

    // Find matching workaround
    const workaround = this.DEVICE_WORKAROUNDS.find(w => {
      if (w.manufacturer !== manufacturer) return false;
      if (w.models) {
        return w.models.some(m => model.includes(m));
      }
      return true;
    });

    if (workaround) {
      console.log(`🔧 Applying ${manufacturer} device workaround`);
      return workaround.workaround(permission, context);
    }

    // Default options
    return {
      rationale: {
        title: context.educationalContent?.title || 'Permission Required',
        message:
          context.educationalContent?.description ||
          'This permission is needed for the app to function properly.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
      requestTimeout: 20000,
      showRequestRationale: context.userInitiated,
    };
  }

  /**
   * Handle legacy Android (pre-API 23) permissions
   */
  private handleLegacyAndroidPermission(type: PermissionType): PermissionResult {
    // Pre-Android 6.0, permissions are granted at install time
    return {
      status: 'granted',
      canAskAgain: false,
      message: 'Permission granted at install time (Android < 6.0)',
      fallbackAvailable: false,
      metadata: this.createMetadata('fresh'),
    };
  }

  /**
   * Handle legacy storage permission for compatibility
   */
  private async handleLegacyStoragePermission(
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    const permission = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const options = this.getDeviceSpecificOptions(permission, context);

    const granted = await this.requestWithOptions(permission, options);

    return {
      status:
        granted === 'granted' ? 'granted' : granted === 'never_ask_again' ? 'blocked' : 'denied',
      canAskAgain: granted !== 'never_ask_again' && granted !== 'granted',
      fallbackAvailable: this.hasFallbackStrategy('storage'),
      degradationPath: granted !== 'granted' ? context.fallbackStrategy : undefined,
      metadata: this.createMetadata('fresh'),
    };
  }

  /**
   * Get Android permissions for a given type
   */
  private getAndroidPermissions(type: PermissionType): string | string[] {
    // Handle Android 13+ permissions
    if (this.apiLevel >= 33 && this.requiresAndroid13Handling(type)) {
      const android13Permission =
        this.ANDROID_13_PERMISSIONS[type as keyof typeof this.ANDROID_13_PERMISSIONS];
      if (android13Permission) return android13Permission;
    }

    // Handle standard permissions
    const permission = this.PERMISSION_MAPPINGS[type];
    if (!permission) {
      throw new Error(`No Android permission mapping for ${type}`);
    }

    return permission;
  }

  /**
   * Create batch results for multiple permissions
   */
  private createBatchResults(
    results: Record<string, string>,
    permissions: string[],
    type: PermissionType
  ): Record<string, any> {
    const batchResults: Record<string, any> = {};

    // Map Android permissions back to our permission types
    for (const [permission, status] of Object.entries(results)) {
      if (permission === PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
        batchResults['location-precise'] = status === 'granted' ? 'granted' : 'denied';
      } else if (permission === PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION) {
        batchResults['location-coarse'] = status === 'granted' ? 'granted' : 'denied';
      } else if (permission === PermissionsAndroid.PERMISSIONS.CAMERA) {
        batchResults.camera = status === 'granted' ? 'granted' : 'denied';
      } else if (permission === PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) {
        batchResults.microphone = status === 'granted' ? 'granted' : 'denied';
      }
    }

    return batchResults;
  }

  /**
   * Create location degradation path for Android
   */
  private createLocationDegradationPath(
    type: PermissionType,
    accuracy?: 'precise' | 'approximate'
  ): DegradationStrategy {
    if (type === 'location-precise' && accuracy === 'approximate') {
      return {
        mode: 'limited',
        description: 'Using approximate location for privacy',
        limitations: ['Less accurate positioning', 'Larger search radius'],
        alternativeApproach: 'approximate-location',
      };
    }

    return {
      mode: 'alternative',
      description: 'Manual location entry available',
      limitations: ['No automatic detection', 'Manual input required'],
      alternativeApproach: 'manual-location',
    };
  }

  // Utility methods
  private requiresAndroid13Handling(type: PermissionType): boolean {
    return ['photos', 'videos', 'audio', 'notifications'].includes(type);
  }

  private isLocationPermission(type: PermissionType): boolean {
    return ['location', 'location-coarse', 'location-precise'].includes(type);
  }

  private hasFallbackStrategy(type: PermissionType): boolean {
    const fallbackTypes = ['location', 'photos', 'storage', 'notifications'];
    return fallbackTypes.includes(type);
  }

  private createMetadata(source: 'cache' | 'fresh' | 'fallback') {
    return {
      source,
      timestamp: Date.now(),
      retryCount: 0,
      osVersion: this.deviceCapabilities.osVersion,
      deviceModel: this.deviceCapabilities.model,
      deviceTier: this.deviceCapabilities.tier || 'unknown',
    };
  }
}

export default AndroidPermissionHandler;
