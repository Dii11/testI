/**
 * Legacy Permission Adapter
 *
 * Provides backward compatibility for existing code that uses the old permission managers.
 * This allows for gradual migration to the new PermissionManager without breaking existing functionality.
 */

import type {
  PermissionType,
  PermissionResult,
  PermissionContext,
} from '../PermissionManagerMigrated';
import PermissionManager, { PermissionStatus } from '../PermissionManagerMigrated';
// Legacy VideoCallPermissionResult interface for compatibility
export interface VideoCallPermissionResult {
  canProceed: boolean;
  hasCamera: boolean;
  hasMicrophone: boolean;
  errorMessage?: string;
  fallbackOptions?: string[];
}

/**
 * Adapter for VideoCallPermissionService compatibility
 */
export class VideoCallPermissionAdapter {
  private permissionManager = PermissionManager;

  async requestVideoCallPermissions(options?: {
    requireCamera?: boolean;
    requireMicrophone?: boolean;
    context?: 'video_call' | 'audio_call';
  }): Promise<VideoCallPermissionResult> {
    const {
      requireCamera = true,
      requireMicrophone = true,
      context = 'video_call',
    } = options || {};

    try {
      const permissionContext: PermissionContext = {
        feature: context,
        priority: 'critical',
        userJourney: 'feature-access',
        userInitiated: true,
        explanation: {
          title: `${context === 'video_call' ? 'Video' : 'Audio'} Call Permissions`,
          reason: `Enable ${requireCamera ? 'camera and ' : ''}microphone access for your ${context === 'video_call' ? 'video' : 'audio'} call.`,
          benefits: [
            context === 'video_call'
              ? 'Face-to-face interaction with healthcare providers'
              : 'Clear audio communication',
            'Enhanced consultation experience',
            'Better diagnosis and care',
          ],
          privacyNote: 'All calls are encrypted and HIPAA-compliant.',
        },
        fallbackStrategy: {
          mode: requireCamera && context === 'video_call' ? 'limited' : 'alternative',
          description:
            requireCamera && context === 'video_call'
              ? 'Audio-only call available'
              : 'Alternative communication methods available',
          limitations:
            requireCamera && context === 'video_call'
              ? ['No video sharing', 'Voice only']
              : ['No real-time communication'],
          alternativeApproach:
            requireCamera && context === 'video_call' ? 'audio-only' : 'text-chat',
        },
      };

      // Determine which permissions to request
      const permissionsToRequest: { type: PermissionType; context: PermissionContext }[] = [];

      if (requireCamera && requireMicrophone) {
        permissionsToRequest.push({ type: 'camera+microphone', context: permissionContext });
      } else {
        if (requireCamera) {
          permissionsToRequest.push({ type: 'camera', context: permissionContext });
        }
        if (requireMicrophone) {
          permissionsToRequest.push({ type: 'microphone', context: permissionContext });
        }
      }

      const results = await this.permissionManager.requestBatchPermissions(permissionsToRequest);

      // Extract individual results
      let camera = false;
      let microphone = false;
      let canProceed = false;

      if (requireCamera && requireMicrophone) {
        const combinedResult = results['camera+microphone'];
        if (combinedResult?.batchResults) {
          camera = combinedResult.batchResults.camera === 'granted';
          microphone = combinedResult.batchResults.microphone === 'granted';
        } else {
          camera = combinedResult?.status === 'granted' || false;
          microphone = combinedResult?.status === 'granted' || false;
        }
      } else {
        if (requireCamera) {
          camera = results.camera?.status === 'granted' || false;
        } else {
          camera = true; // Not required
        }

        if (requireMicrophone) {
          microphone = results.microphone?.status === 'granted' || false;
        } else {
          microphone = true; // Not required
        }
      }

      canProceed = (!requireCamera || camera) && (!requireMicrophone || microphone);

      // Create legacy-compatible result
      const legacyResult: VideoCallPermissionResult = {
        camera,
        microphone,
        canProceed,
        skippedPermissions: [],
        errorMessage: canProceed
          ? undefined
          : this.getErrorMessage(results, requireCamera, requireMicrophone),
      };

      return legacyResult;
    } catch (error) {
      console.error('Video call permission adapter error:', error);
      return {
        camera: false,
        microphone: false,
        canProceed: false,
        skippedPermissions: [],
        errorMessage: error instanceof Error ? error.message : 'Permission request failed',
      };
    }
  }

  async checkVideoCallPermissions(): Promise<VideoCallPermissionResult> {
    try {
      const results = await this.permissionManager.checkMultiplePermissions([
        'camera',
        'microphone',
      ]);

      const camera = results.camera?.status === 'granted' || false;
      const microphone = results.microphone?.status === 'granted' || false;

      return {
        camera,
        microphone,
        canProceed: camera && microphone,
        skippedPermissions: [],
      };
    } catch (error) {
      console.error('Video call permission check adapter error:', error);
      return {
        camera: false,
        microphone: false,
        canProceed: false,
        skippedPermissions: [],
        errorMessage: error instanceof Error ? error.message : 'Permission check failed',
      };
    }
  }

  getPermissionStrategy(callType: 'video' | 'audio'): {
    timeout: number;
    requireCamera: boolean;
    requireMicrophone: boolean;
    shouldPromptUser: boolean;
  } {
    const deviceCaps = this.permissionManager.getDeviceCapabilities();

    return {
      timeout: deviceCaps.permissionTimeoutMs || 10000,
      requireCamera: callType === 'video',
      requireMicrophone: true,
      shouldPromptUser: true,
    };
  }

  werePermissionsRecentlyGranted(): boolean {
    // This is a simplified implementation - the new manager doesn't track "recent" grants
    // Could be enhanced if needed
    return false;
  }

  private getErrorMessage(
    results: Record<PermissionType, PermissionResult>,
    requireCamera: boolean,
    requireMicrophone: boolean
  ): string {
    if (requireCamera && requireMicrophone) {
      const combinedResult = results['camera+microphone'];
      if (combinedResult.batchResults) {
        const cameraStatus = combinedResult.batchResults.camera;
        const microphoneStatus = combinedResult.batchResults.microphone;

        if (cameraStatus === 'blocked' || microphoneStatus === 'blocked') {
          return 'Camera or microphone access is blocked. Please enable in device settings.';
        }
        if (cameraStatus === 'denied' || microphoneStatus === 'denied') {
          return 'Camera and microphone permissions are required for video calls.';
        }
      }
    } else {
      if (requireCamera && results.camera.status === 'blocked') {
        return 'Camera access is blocked. Please enable in device settings.';
      }
      if (requireMicrophone && results.microphone.status === 'blocked') {
        return 'Microphone access is blocked. Please enable in device settings.';
      }
      if (requireCamera && results.camera.status === 'denied') {
        return 'Camera permission is required for video calls.';
      }
      if (requireMicrophone && results.microphone.status === 'denied') {
        return 'Microphone permission is required for calls.';
      }
    }

    return 'Permission request failed. Please try again.';
  }
}

/**
 * Adapter for EnhancedPermissionManager compatibility
 */
export class EnhancedPermissionAdapter {
  private permissionManager = PermissionManager;

  async checkPermission(type: string, context?: any): Promise<any> {
    const mappedType = this.mapLegacyPermissionType(type);
    if (!mappedType) {
      throw new Error(`Unsupported legacy permission type: ${type}`);
    }

    const result = await this.permissionManager.checkPermission(mappedType);
    return this.mapToLegacyResult(result);
  }

  async requestPermission(type: string, context?: any): Promise<any> {
    const mappedType = this.mapLegacyPermissionType(type);
    if (!mappedType) {
      throw new Error(`Unsupported legacy permission type: ${type}`);
    }

    const permissionContext: PermissionContext = {
      feature: context?.feature || 'unknown',
      priority: context?.critical ? 'critical' : 'important',
      userJourney: context?.userInitiated ? 'feature-access' : 'background',
      userInitiated: context?.userInitiated || false,
      explanation: context?.educationalContent
        ? {
            title: context.educationalContent.title,
            reason: context.educationalContent.description,
            benefits: context.educationalContent.benefits,
            privacyNote: context.educationalContent.privacyNote,
          }
        : undefined,
      fallbackStrategy: {
        mode: context?.fallbackMessage ? 'alternative' : 'disabled',
        description: context?.fallbackMessage || 'Feature unavailable',
        limitations: [],
        alternativeApproach: 'manual',
      },
    };

    const result = await this.permissionManager.requestPermission(mappedType, permissionContext);
    return this.mapToLegacyResult(result);
  }

  async checkMultiplePermissions(types: string[]): Promise<Record<string, any>> {
    const mappedTypes = types.map(this.mapLegacyPermissionType).filter(Boolean) as PermissionType[];
    const results = await this.permissionManager.checkMultiplePermissions(mappedTypes);

    const legacyResults: Record<string, any> = {};
    for (const [type, result] of Object.entries(results)) {
      const legacyType = this.mapToLegacyPermissionType(type as PermissionType);
      if (legacyType) {
        legacyResults[legacyType] = this.mapToLegacyResult(result);
      }
    }

    return legacyResults;
  }

  invalidatePermission(type: string): void {
    const mappedType = this.mapLegacyPermissionType(type);
    if (mappedType) {
      this.permissionManager.invalidatePermission(mappedType);
    }
  }

  async openSettings(): Promise<void> {
    return this.permissionManager.openAppSettings();
  }

  getDeviceCapabilities(): any {
    return this.permissionManager.getDeviceCapabilities();
  }

  getCacheStats(): any {
    return this.permissionManager.getCacheStats();
  }

  private mapLegacyPermissionType(legacyType: string): PermissionType | null {
    const mapping: Record<string, PermissionType> = {
      camera: 'camera',
      microphone: 'microphone',
      'camera+microphone': 'camera+microphone',
      location: 'location',
      notifications: 'notifications',
      health: 'health',
      storage: 'storage',
      photos: 'photos',
    };

    return mapping[legacyType] || null;
  }

  private mapToLegacyPermissionType(type: PermissionType): string | null {
    const mapping: Record<PermissionType, string> = {
      camera: 'camera',
      microphone: 'microphone',
      'camera+microphone': 'camera+microphone',
      location: 'location',
      'location-precise': 'location',
      'location-coarse': 'location',
      notifications: 'notifications',
      health: 'health',
      storage: 'storage',
      photos: 'photos',
    };

    return mapping[type] || null;
  }

  private mapToLegacyResult(result: PermissionResult): any {
    return {
      status: result.status,
      canAskAgain: result.canAskAgain,
      message: result.message,
      fallbackAvailable: result.fallbackAvailable,
      metadata: result.metadata,
    };
  }
}

// Export singleton instances for compatibility
export const videoCallPermissions = new VideoCallPermissionAdapter();
export const enhancedPermissionManager = new EnhancedPermissionAdapter();
