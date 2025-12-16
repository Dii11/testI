import type { StackNavigationProp } from '@react-navigation/stack';

import PermissionDialogStateManager from './PermissionDialogStateManager';
import {
  requestVideoConsultationPermissions,
  requestAudioConsultationPermissions,
} from './teleconsultationPermissions';

interface CallInitiationContext {
  screen: string;
  userId?: string;
  entityId?: string;
  entityName?: string;
  entityType?: 'doctor' | 'customer';
}

interface CallInitiationResult {
  success: boolean;
  hasPermissions: boolean;
  permissionResult?: any;
  error?: string;
  canRetry?: boolean;
  fallbackAvailable?: boolean;
}

/**
 * PermissionAwareCallInitiator
 *
 * Manages call initiation with permission handling that preserves navigation state.
 * Prevents navigation issues during permission requests by coordinating with
 * PermissionDialogStateManager.
 */
export class PermissionAwareCallInitiator {
  private permissionDialogManager = PermissionDialogStateManager.getInstance();

  /**
   * Initiate a video call with permission-aware navigation protection
   */
  async initiateVideoCall(
    context: CallInitiationContext,
    navigation?: StackNavigationProp<any>
  ): Promise<CallInitiationResult> {
    const { screen, userId, entityId, entityName, entityType } = context;

    console.log(`🎥 Initiating video call from ${screen} for ${entityType} ${entityName}`);

    try {
      // ✅ FIX: Ensure permission dialog manager is properly initialized
      if (!this.permissionDialogManager) {
        console.error('❌ PermissionDialogStateManager not initialized');
        return {
          success: false,
          hasPermissions: false,
          error: 'Permission system not initialized',
          canRetry: true,
          fallbackAvailable: true,
        };
      }

      // Start permission dialog protection
      this.permissionDialogManager.startPermissionDialog(
        'combined',
        {
          screen,
          feature: 'video-call-initiation',
          userId,
          entityId,
        },
        20000
      ); // 20 second timeout for video permissions

      // Request video consultation permissions with medical context
      const permissionResult = await requestVideoConsultationPermissions({
        doctorName: entityType === 'doctor' ? entityName : undefined,
        consultationType: 'routine',
        includeHealthData: false,
        includeLocation: false,
        userInitiated: true,
      });

      // End permission dialog protection
      this.permissionDialogManager.endPermissionDialog('combined', true);

      if (permissionResult.granted && permissionResult.hasVideo && permissionResult.hasAudio) {
        console.log(`✅ Video call permissions granted for ${entityType} ${entityName}`);

        return {
          success: true,
          hasPermissions: true,
          permissionResult,
        };
      } else {
        console.log(
          `❌ Video call permissions denied for ${entityType} ${entityName}:`,
          permissionResult.message
        );

        return {
          success: false,
          hasPermissions: false,
          permissionResult,
          error: permissionResult.message,
          canRetry: permissionResult.granted === false, // Can retry if explicitly denied
          fallbackAvailable: permissionResult.fallbackAvailable,
        };
      }
    } catch (error) {
      console.error(`🚨 Video call initiation failed for ${entityType} ${entityName}:`, error);

      // Ensure permission dialog protection is ended
      this.permissionDialogManager.endPermissionDialog('combined', true);

      return {
        success: false,
        hasPermissions: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        canRetry: true,
        fallbackAvailable: true,
      };
    }
  }

  /**
   * Initiate an audio call with permission-aware navigation protection
   */
  async initiateAudioCall(
    context: CallInitiationContext,
    navigation?: StackNavigationProp<any>
  ): Promise<CallInitiationResult> {
    const { screen, userId, entityId, entityName, entityType } = context;

    console.log(`📞 Initiating audio call from ${screen} for ${entityType} ${entityName}`);

    try {
      // ✅ FIX: Ensure permission dialog manager is properly initialized
      if (!this.permissionDialogManager) {
        console.error('❌ PermissionDialogStateManager not initialized');
        return {
          success: false,
          hasPermissions: false,
          error: 'Permission system not initialized',
          canRetry: true,
          fallbackAvailable: false,
        };
      }

      // Start permission dialog protection
      this.permissionDialogManager.startPermissionDialog(
        'microphone',
        {
          screen,
          feature: 'audio-call-initiation',
          userId,
          entityId,
        },
        15000
      ); // 15 second timeout for audio permissions

      // Request audio consultation permissions with medical context
      const permissionResult = await requestAudioConsultationPermissions({
        doctorName: entityType === 'doctor' ? entityName : undefined,
        consultationType: 'routine',
        includeHealthData: false,
        userInitiated: true,
      });

      // End permission dialog protection
      this.permissionDialogManager.endPermissionDialog('microphone', true);

      if (permissionResult.granted && permissionResult.hasAudio) {
        console.log(`✅ Audio call permissions granted for ${entityType} ${entityName}`);

        return {
          success: true,
          hasPermissions: true,
          permissionResult,
        };
      } else {
        console.log(
          `❌ Audio call permissions denied for ${entityType} ${entityName}:`,
          permissionResult.message
        );

        return {
          success: false,
          hasPermissions: false,
          permissionResult,
          error: permissionResult.message,
          canRetry: permissionResult.granted === false, // Can retry if explicitly denied
          fallbackAvailable: false, // No fallback for audio-only calls
        };
      }
    } catch (error) {
      console.error(`🚨 Audio call initiation failed for ${entityType} ${entityName}:`, error);

      // Ensure permission dialog protection is ended
      this.permissionDialogManager.endPermissionDialog('microphone', true);

      return {
        success: false,
        hasPermissions: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        canRetry: true,
        fallbackAvailable: false,
      };
    }
  }

  /**
   * Check if permissions are already available without requesting them
   */
  async checkCallPermissions(callType: 'video' | 'audio'): Promise<{
    hasPermissions: boolean;
    needsRequest: boolean;
    details: any;
  }> {
    // This would typically check current permission status without requesting
    // Implementation depends on your permission management system
    console.log(`🔍 Checking ${callType} call permissions`);

    // Placeholder implementation
    return {
      hasPermissions: false,
      needsRequest: true,
      details: null,
    };
  }

  /**
   * Handle permission denied scenarios with user-friendly messaging
   */
  getPermissionDeniedMessage(callType: 'video' | 'audio', result: CallInitiationResult): string {
    if (result.fallbackAvailable) {
      return callType === 'video'
        ? 'Video permissions denied. Would you like to start an audio-only call instead?'
        : 'Audio permissions denied. Please enable microphone access in settings to continue.';
    }

    return callType === 'video'
      ? 'Camera and microphone access are required for video calls. Please enable these permissions in your device settings.'
      : 'Microphone access is required for audio calls. Please enable this permission in your device settings.';
  }

  /**
   * Check if the permission system is currently in a state that would interfere with navigation
   */
  isNavigationSafe(): boolean {
    return !this.permissionDialogManager.shouldPreserveNavigation();
  }

  /**
   * Get current permission dialog state for debugging
   */
  getPermissionDialogState() {
    return {
      isActive: this.permissionDialogManager.isPermissionDialogActive(),
      dialogType: this.permissionDialogManager.getCurrentDialogType(),
      context: this.permissionDialogManager.getDialogContext(),
      shouldPreserveNavigation: this.permissionDialogManager.shouldPreserveNavigation(),
    };
  }
}

// Singleton instance
export const permissionAwareCallInitiator = new PermissionAwareCallInitiator();
export default permissionAwareCallInitiator;
