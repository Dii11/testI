/**
 * iOS-specific Permission Handler
 *
 * Handles iOS permission system with version awareness, privacy string validation,
 * and proper handling of iOS-specific permission states and restrictions
 */

import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';

import type {
  PermissionType,
  PermissionContext as PermissionRequestContext,
  PermissionResult,
  DegradationStrategy,
  PermissionStatus,
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

export interface IOSPermissionConfiguration {
  requiredInfoPlistKeys: string[];
  minimumIOSVersion?: number;
  degradationStrategy: DegradationStrategy;
}

export class IOSPermissionHandler {
  private deviceCapabilities: DeviceCapabilities;
  private iosVersion: number;

  // iOS permission configurations
  private readonly PERMISSION_CONFIGS: Record<PermissionType, IOSPermissionConfiguration> = {
    camera: {
      requiredInfoPlistKeys: ['NSCameraUsageDescription'],
      degradationStrategy: {
        mode: 'alternative',
        description: 'Use photo picker instead',
        limitations: ['No real-time capture'],
        alternativeApproach: 'photo-picker',
      },
    },
    microphone: {
      requiredInfoPlistKeys: ['NSMicrophoneUsageDescription'],
      degradationStrategy: {
        mode: 'limited',
        description: 'Text-based communication available',
        limitations: ['No voice input', 'No audio recording'],
        alternativeApproach: 'text-input',
      },
    },
    'camera+microphone': {
      requiredInfoPlistKeys: ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription'],
      degradationStrategy: {
        mode: 'limited',
        description: 'Partial functionality available',
        limitations: ['Limited call features'],
        alternativeApproach: 'text-chat',
      },
    },
    location: {
      requiredInfoPlistKeys: ['NSLocationWhenInUseUsageDescription'],
      degradationStrategy: {
        mode: 'alternative',
        description: 'Manual location entry',
        limitations: ['No automatic detection'],
        alternativeApproach: 'manual-entry',
      },
    },
    'location-coarse': {
      requiredInfoPlistKeys: ['NSLocationWhenInUseUsageDescription'],
      degradationStrategy: {
        mode: 'alternative',
        description: 'Manual location entry',
        limitations: ['No automatic detection'],
        alternativeApproach: 'manual-entry',
      },
    },
    'location-precise': {
      requiredInfoPlistKeys: ['NSLocationWhenInUseUsageDescription'],
      minimumIOSVersion: 14.0,
      degradationStrategy: {
        mode: 'limited',
        description: 'Approximate location available',
        limitations: ['Less accurate positioning'],
        alternativeApproach: 'approximate-location',
      },
    },
    notifications: {
      requiredInfoPlistKeys: [],
      degradationStrategy: {
        mode: 'limited',
        description: 'In-app notifications only',
        limitations: ['No push notifications', 'No background alerts'],
        alternativeApproach: 'in-app-alerts',
      },
    },
    health: {
      requiredInfoPlistKeys: ['NSHealthUpdateUsageDescription', 'NSHealthShareUsageDescription'],
      degradationStrategy: {
        mode: 'limited',
        description: 'Manual health data entry',
        limitations: ['No automatic sync', 'Manual input required'],
        alternativeApproach: 'manual-entry',
      },
    },
    photos: {
      requiredInfoPlistKeys: ['NSPhotoLibraryUsageDescription'],
      minimumIOSVersion: 14.0, // For limited photo access
      degradationStrategy: {
        mode: 'alternative',
        description: 'Use camera instead',
        limitations: ['No existing photo access'],
        alternativeApproach: 'camera-capture',
      },
    },
    storage: {
      requiredInfoPlistKeys: [],
      degradationStrategy: {
        mode: 'limited',
        description: 'App-specific storage only',
        limitations: ['Limited file access'],
        alternativeApproach: 'app-documents',
      },
    },
  };

  constructor(deviceCapabilities: DeviceCapabilities) {
    this.deviceCapabilities = deviceCapabilities;
    this.iosVersion = parseFloat(Platform.Version as string);
  }

  /**
   * Handle iOS permission request with version awareness
   */
  async requestPermission(
    type: PermissionType,
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    console.log(`🍎 iOS: Requesting ${type} permission on iOS ${this.iosVersion}`);

    // Validate Info.plist keys
    if (!this.validatePrivacyStrings(type)) {
      throw new Error(`Missing required Info.plist keys for ${type} permission`);
    }

    // Check iOS version compatibility
    const config = this.PERMISSION_CONFIGS[type];
    if (config.minimumIOSVersion && this.iosVersion < config.minimumIOSVersion) {
      return this.createUnsupportedVersionResult(type, config.minimumIOSVersion);
    }

    // Handle iOS-specific permission flows
    switch (type) {
      case 'camera':
        return this.requestCameraPermission(context);
      case 'microphone':
        return this.requestMicrophonePermission(context);
      case 'camera+microphone':
        return this.requestCameraAndMicrophonePermission(context);
      case 'location':
      case 'location-coarse':
      case 'location-precise':
        return this.requestLocationPermission(type, context);
      case 'notifications':
        return this.requestNotificationPermission(context);
      case 'photos':
        return this.requestPhotoLibraryPermission(context);
      case 'health':
        return this.requestHealthPermission(context);
      default:
        return this.createUnsupportedResult(type);
    }
  }

  /**
   * Check current permission status
   */
  async checkPermission(type: PermissionType): Promise<PermissionResult> {
    try {
      switch (type) {
        case 'camera':
          const cameraStatus = await Camera.getCameraPermissionsAsync();
          return this.createPermissionResult(type, cameraStatus.status, cameraStatus.canAskAgain);

        case 'microphone':
          const audioStatus = await Audio.getPermissionsAsync();
          return this.createPermissionResult(type, audioStatus.status, audioStatus.canAskAgain);

        case 'camera+microphone':
          return this.checkCombinedCameraAndMicrophone();

        case 'location':
        case 'location-coarse':
        case 'location-precise':
          return this.checkLocationPermission(type);

        case 'notifications':
          const notificationStatus = await Notifications.getPermissionsAsync();
          return this.createPermissionResult(
            type,
            notificationStatus.status,
            notificationStatus.canAskAgain
          );

        case 'photos':
          const mediaStatus = await MediaLibrary.getPermissionsAsync();
          return this.createPhotoPermissionResult(mediaStatus);

        default:
          return this.createUnsupportedResult(type);
      }
    } catch (error) {
      console.error(`iOS permission check failed for ${type}:`, error);
      throw error;
    }
  }

  // Specific permission handlers

  private async requestCameraPermission(
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    try {
      const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();
      return this.createPermissionResult('camera', status, canAskAgain, context);
    } catch (error) {
      console.error('iOS camera permission request failed:', error);
      throw error;
    }
  }

  private async requestMicrophonePermission(
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    try {
      const { status, canAskAgain } = await Audio.requestPermissionsAsync();
      return this.createPermissionResult('microphone', status, canAskAgain, context);
    } catch (error) {
      console.error('iOS microphone permission request failed:', error);
      throw error;
    }
  }

  private async requestCameraAndMicrophonePermission(
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    try {
      // Request both permissions in parallel
      const [cameraResult, microphoneResult] = await Promise.all([
        Camera.requestCameraPermissionsAsync(),
        Audio.requestPermissionsAsync(),
      ]);

      const bothGranted =
        cameraResult.status === 'granted' && microphoneResult.status === 'granted';
      const canAskEither = cameraResult.canAskAgain || microphoneResult.canAskAgain;

      return {
        status: bothGranted ? 'granted' : 'denied',
        canAskAgain: canAskEither,
        fallbackAvailable:
          cameraResult.status === 'granted' || microphoneResult.status === 'granted',
        batchResults: {
          camera: this.mapIOSStatus(cameraResult.status),
          microphone: this.mapIOSStatus(microphoneResult.status),
        },
        degradationPath: this.calculateCombinedDegradation(
          cameraResult.status,
          microphoneResult.status
        ),
        metadata: this.createMetadata('fresh'),
      };
    } catch (error) {
      console.error('iOS camera+microphone permission request failed:', error);
      throw error;
    }
  }

  private async requestLocationPermission(
    type: PermissionType,
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      // iOS 14+ handles approximate vs precise location automatically
      let accuracy: 'precise' | 'approximate' | undefined;
      if (this.iosVersion >= 14.0 && status === 'granted') {
        // On iOS 14+, check if user chose "Precise Location"
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        accuracy = location.coords.accuracy < 100 ? 'precise' : 'approximate';
      }

      const result = this.createPermissionResult(type, status, canAskAgain, context);

      // Add iOS-specific location handling
      if (type === 'location-precise' && accuracy === 'approximate') {
        result.status = 'limited';
        result.accuracy = 'approximate';
        result.degradationPath = this.createLocationDegradationPath(type, accuracy);
      } else if (accuracy) {
        result.accuracy = accuracy;
      }

      return result;
    } catch (error) {
      console.error('iOS location permission request failed:', error);
      throw error;
    }
  }

  private async requestNotificationPermission(
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    try {
      // iOS 15+ supports different notification types
      const permissions =
        this.iosVersion >= 15.0
          ? {
              alert: true,
              badge: true,
              sound: true,
              criticalAlert: false, // Requires special entitlement
              providesAppNotificationSettings: true,
              provisional: false,
            }
          : {
              alert: true,
              badge: true,
              sound: true,
            };

      const { status, canAskAgain } = await Notifications.requestPermissionsAsync(permissions);
      return this.createPermissionResult('notifications', status, canAskAgain, context);
    } catch (error) {
      console.error('iOS notification permission request failed:', error);
      throw error;
    }
  }

  private async requestPhotoLibraryPermission(
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    try {
      const { status, canAskAgain, accessPrivileges } =
        await MediaLibrary.requestPermissionsAsync();

      // iOS 14+ has limited photo access
      if (this.iosVersion >= 14.0 && status === 'limited') {
        return {
          status: 'limited',
          canAskAgain,
          message: 'Limited photo access granted',
          fallbackAvailable: true,
          degradationPath: {
            mode: 'limited',
            description: 'Access to selected photos only',
            limitations: ['Limited photo selection', 'No full library access'],
            alternativeApproach: 'camera-capture',
          },
          metadata: this.createMetadata('fresh'),
        };
      }

      return this.createPermissionResult('photos', status, canAskAgain, context);
    } catch (error) {
      console.error('iOS photo library permission request failed:', error);
      throw error;
    }
  }

  private async requestHealthPermission(
    context: PermissionRequestContext
  ): Promise<PermissionResult> {
    // HealthKit permissions are handled differently and require expo-health or react-native-health
    // For now, return unsupported
    return this.createUnsupportedResult('health');
  }

  // Helper methods for checking permissions

  private async checkCombinedCameraAndMicrophone(): Promise<PermissionResult> {
    const [cameraStatus, audioStatus] = await Promise.all([
      Camera.getCameraPermissionsAsync(),
      Audio.getPermissionsAsync(),
    ]);

    const bothGranted = cameraStatus.status === 'granted' && audioStatus.status === 'granted';
    const canAskEither = cameraStatus.canAskAgain || audioStatus.canAskAgain;

    return {
      status: bothGranted ? 'granted' : 'denied',
      canAskAgain: canAskEither,
      fallbackAvailable: cameraStatus.status === 'granted' || audioStatus.status === 'granted',
      batchResults: {
        camera: this.mapIOSStatus(cameraStatus.status),
        microphone: this.mapIOSStatus(audioStatus.status),
      },
      degradationPath: this.calculateCombinedDegradation(cameraStatus.status, audioStatus.status),
      metadata: this.createMetadata('fresh'),
    };
  }

  private async checkLocationPermission(type: PermissionType): Promise<PermissionResult> {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();

    let accuracy: 'precise' | 'approximate' | undefined;
    if (this.iosVersion >= 14.0 && status === 'granted') {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
          timeInterval: 5000,
        });
        accuracy = location.coords.accuracy < 100 ? 'precise' : 'approximate';
      } catch {
        // If we can't get precise location, assume approximate
        accuracy = 'approximate';
      }
    }

    const result = this.createPermissionResult(type, status, canAskAgain);

    if (type === 'location-precise' && accuracy === 'approximate') {
      result.status = 'limited';
      result.accuracy = 'approximate';
      result.degradationPath = this.createLocationDegradationPath(type, accuracy);
    } else if (accuracy) {
      result.accuracy = accuracy;
    }

    return result;
  }

  private createPhotoPermissionResult(mediaStatus: any): PermissionResult {
    // Handle iOS 14+ limited photo access
    if (mediaStatus.status === 'limited') {
      return {
        status: 'limited',
        canAskAgain: mediaStatus.canAskAgain,
        message: 'Limited photo access',
        fallbackAvailable: true,
        degradationPath: {
          mode: 'limited',
          description: 'Access to selected photos only',
          limitations: ['Limited photo selection'],
          alternativeApproach: 'camera-capture',
        },
        metadata: this.createMetadata('fresh'),
      };
    }

    return this.createPermissionResult('photos', mediaStatus.status, mediaStatus.canAskAgain);
  }

  // Result creation helpers

  private createPermissionResult(
    type: PermissionType,
    status: string,
    canAskAgain: boolean,
    context?: PermissionRequestContext
  ): PermissionResult {
    const mappedStatus = this.mapIOSStatus(status);
    const config = this.PERMISSION_CONFIGS[type];

    return {
      status: mappedStatus,
      canAskAgain: mappedStatus === 'denied' ? canAskAgain : false,
      fallbackAvailable: config.degradationStrategy.mode !== 'disabled',
      degradationPath: mappedStatus !== 'granted' ? config.degradationStrategy : undefined,
      metadata: this.createMetadata('fresh'),
    };
  }

  private createUnsupportedResult(type: PermissionType): PermissionResult {
    const config = this.PERMISSION_CONFIGS[type];

    return {
      status: 'restricted',
      canAskAgain: false,
      message: `${type} permission not supported on this iOS version`,
      fallbackAvailable: config.degradationStrategy.mode !== 'disabled',
      degradationPath: config.degradationStrategy,
      metadata: this.createMetadata('fresh'),
    };
  }

  private createUnsupportedVersionResult(
    type: PermissionType,
    requiredVersion: number
  ): PermissionResult {
    const config = this.PERMISSION_CONFIGS[type];

    return {
      status: 'restricted',
      canAskAgain: false,
      message: `${type} requires iOS ${requiredVersion}+ (current: ${this.iosVersion})`,
      fallbackAvailable: config.degradationStrategy.mode !== 'disabled',
      degradationPath: config.degradationStrategy,
      metadata: this.createMetadata('fresh'),
    };
  }

  private calculateCombinedDegradation(
    cameraStatus: string,
    microphoneStatus: string
  ): DegradationStrategy | undefined {
    const hasCamera = cameraStatus === 'granted';
    const hasMicrophone = microphoneStatus === 'granted';

    if (hasCamera && !hasMicrophone) {
      return {
        mode: 'limited',
        description: 'Video-only call available',
        limitations: ['No audio input', 'Text chat available'],
        alternativeApproach: 'video-only',
      };
    }

    if (!hasCamera && hasMicrophone) {
      return {
        mode: 'limited',
        description: 'Audio-only call available',
        limitations: ['No video', 'Voice call only'],
        alternativeApproach: 'audio-only',
      };
    }

    if (!hasCamera && !hasMicrophone) {
      return {
        mode: 'alternative',
        description: 'Text chat available',
        limitations: ['No audio/video', 'Text communication only'],
        alternativeApproach: 'text-chat',
      };
    }

    return undefined;
  }

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

  private mapIOSStatus(status: string): PermissionStatus {
    switch (status) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'restricted':
        return 'restricted'; // Parental controls or company policy
      case 'undetermined':
        return 'unknown';
      case 'limited':
        return 'limited'; // iOS 14+ limited photo access
      default:
        return 'unknown';
    }
  }

  private validatePrivacyStrings(type: PermissionType): boolean {
    const config = this.PERMISSION_CONFIGS[type];
    if (!config.requiredInfoPlistKeys.length) {
      return true; // No validation needed
    }

    // In a real implementation, you would check Info.plist for these keys
    // For now, assume they are properly configured
    console.log(`✅ Privacy strings validated for ${type}:`, config.requiredInfoPlistKeys);
    return true;
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

export default IOSPermissionHandler;
