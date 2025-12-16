import { Alert } from 'react-native';

import { sentryTracker } from '../utils/sentryErrorTracker';

import DailyService from './dailyService';
import deviceCapabilityService from './deviceCapabilityService';

export interface ErrorRecoveryOptions {
  context: 'video_call' | 'audio_call' | 'health_permissions' | 'app_startup';
  userId?: string;
  doctorId?: string;
  customerId?: string;
  originalError: Error;
  attemptCount?: number;
}

export interface RecoveryResult {
  recovered: boolean;
  actionTaken: string;
  shouldRetry: boolean;
  userMessage?: string;
}

/**
 * Comprehensive error recovery system for video call and permission failures
 * Provides device-specific recovery strategies with graceful degradation
 */
class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private recoveryAttempts = new Map<string, number>();
  private maxRetries = 3;

  public static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  async recoverFromError(options: ErrorRecoveryOptions): Promise<RecoveryResult> {
    const { context, originalError, attemptCount = 1 } = options;
    const deviceCaps = deviceCapabilityService.getCapabilities();
    const recoveryKey = `${context}_${options.userId || 'unknown'}_${options.doctorId || options.customerId || 'unknown'}`;

    console.log(`🚑 Attempting error recovery for ${context}:`, originalError.message);

    // Track current attempt
    const currentAttempts = this.recoveryAttempts.get(recoveryKey) || 0;
    this.recoveryAttempts.set(recoveryKey, currentAttempts + 1);

    // Prevent infinite recovery loops
    if (currentAttempts >= this.maxRetries) {
      console.warn(`⚠️ Max recovery attempts (${this.maxRetries}) reached for ${context}`);
      return {
        recovered: false,
        actionTaken: 'max_attempts_reached',
        shouldRetry: false,
        userMessage: 'Unable to resolve the issue after multiple attempts. Please try again later.',
      };
    }

    try {
      switch (context) {
        case 'video_call':
        case 'audio_call':
          return await this.recoverFromCallError(options, deviceCaps);

        case 'health_permissions':
          return await this.recoverFromPermissionError(options, deviceCaps);

        case 'app_startup':
          return await this.recoverFromStartupError(options, deviceCaps);

        default:
          return {
            recovered: false,
            actionTaken: 'unknown_context',
            shouldRetry: false,
          };
      }
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);

      sentryTracker.trackCriticalError(
        recoveryError instanceof Error ? recoveryError : 'Recovery failed',
        {
          service: 'errorRecoveryService',
          action: 'recoverFromError',
          additional: {
            originalContext: context,
            originalError: originalError.message,
            recoveryAttempt: currentAttempts + 1,
            deviceInfo: {
              manufacturer: deviceCaps.manufacturer,
              model: deviceCaps.model,
              hasSlowPermissionHandling: deviceCaps.hasSlowPermissionHandling,
            },
          },
        }
      );

      return {
        recovered: false,
        actionTaken: 'recovery_failed',
        shouldRetry: currentAttempts < this.maxRetries - 1,
        userMessage: 'Recovery attempt failed. Please try again.',
      };
    }
  }

  private async recoverFromCallError(
    options: ErrorRecoveryOptions,
    deviceCaps: any
  ): Promise<RecoveryResult> {
    const { originalError, doctorId, userId, customerId } = options;
    const errorMessage = originalError.message.toLowerCase();

    // Permission timeout recovery for TECNO and similar devices
    if (errorMessage.includes('permission') && errorMessage.includes('timeout')) {
      if (deviceCaps.hasSlowPermissionHandling) {
        return {
          recovered: false,
          actionTaken: 'expected_timeout_on_slow_device',
          shouldRetry: false,
          userMessage:
            'This device requires manual permission setup. Please go to Settings > Apps > HopMed > Permissions and enable Camera and Microphone.',
        };
      }
    }

    // Daily.co SDK initialization failures
    if (
      errorMessage.includes('failed to initialize daily') ||
      errorMessage.includes('daily.co sdk')
    ) {
      console.log('🔄 Attempting Daily.co SDK recovery...');

      try {
        // Force cleanup and re-initialize
        await DailyService.forceCleanup();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const callObject = await DailyService.initializeEngine();
        if (callObject) {
          return {
            recovered: true,
            actionTaken: 'daily_sdk_reinitialized',
            shouldRetry: true,
          };
        }
      } catch (reinitError) {
        console.error('Daily.co SDK reinitialization failed:', reinitError);
      }

      return {
        recovered: false,
        actionTaken: 'daily_sdk_unavailable',
        shouldRetry: false,
        userMessage:
          'Video calling is not available on this device. Please try using audio call instead.',
      };
    }

    // Channel/Room connection failures
    if (
      errorMessage.includes('room') ||
      errorMessage.includes('channel') ||
      errorMessage.includes('consultation not started')
    ) {
      console.log('🔄 Attempting room connection recovery...');

      // For symmetric call issues, try to create the room first
      if (doctorId && (userId || customerId)) {
        try {
          const targetId = userId || customerId!;
          const channelInfo = await DailyService.startConsultation(doctorId, targetId, 'video');

          return {
            recovered: true,
            actionTaken: 'room_created_first',
            shouldRetry: true,
          };
        } catch (createError) {
          console.error('Room creation recovery failed:', createError);
        }
      }

      return {
        recovered: false,
        actionTaken: 'room_connection_failed',
        shouldRetry: true,
        userMessage:
          'Unable to connect to the call room. The other person may need to start the call first.',
      };
    }

    // Network-related failures
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection')
    ) {
      return {
        recovered: false,
        actionTaken: 'network_issue',
        shouldRetry: true,
        userMessage:
          'Network connection issue. Please check your internet connection and try again.',
      };
    }

    // Default fallback
    return {
      recovered: false,
      actionTaken: 'unknown_call_error',
      shouldRetry: false,
      userMessage: 'An unexpected error occurred during the call. Please try again later.',
    };
  }

  private async recoverFromPermissionError(
    options: ErrorRecoveryOptions,
    deviceCaps: any
  ): Promise<RecoveryResult> {
    const { originalError } = options;
    const errorMessage = originalError.message.toLowerCase();

    // Health permission timeout on slow devices - expected behavior
    if (errorMessage.includes('timeout') && deviceCaps.hasSlowPermissionHandling) {
      return {
        recovered: true, // This is actually expected behavior
        actionTaken: 'skip_health_permissions_on_slow_device',
        shouldRetry: false,
        userMessage:
          'Health tracking permissions were skipped to improve performance on this device.',
      };
    }

    // General permission denials
    if (errorMessage.includes('denied') || errorMessage.includes('not granted')) {
      return {
        recovered: false,
        actionTaken: 'permissions_denied',
        shouldRetry: false,
        userMessage:
          'Permissions are required for this feature. Please go to Settings > Apps > HopMed > Permissions to enable them.',
      };
    }

    return {
      recovered: false,
      actionTaken: 'unknown_permission_error',
      shouldRetry: false,
      userMessage: 'Permission error occurred. Please check app permissions in device settings.',
    };
  }

  private async recoverFromStartupError(
    options: ErrorRecoveryOptions,
    deviceCaps: any
  ): Promise<RecoveryResult> {
    const { originalError } = options;

    // For startup errors, we generally want to continue with degraded functionality
    return {
      recovered: true,
      actionTaken: 'continue_with_degraded_functionality',
      shouldRetry: false,
      userMessage: undefined, // Don't show user message for startup issues
    };
  }

  /**
   * Reset recovery attempts for a specific context
   */
  resetRecoveryAttempts(context: string, userId?: string, otherId?: string): void {
    const recoveryKey = `${context}_${userId || 'unknown'}_${otherId || 'unknown'}`;
    this.recoveryAttempts.delete(recoveryKey);
  }

  /**
   * Get current recovery attempt count
   */
  getRecoveryAttempts(context: string, userId?: string, otherId?: string): number {
    const recoveryKey = `${context}_${userId || 'unknown'}_${otherId || 'unknown'}`;
    return this.recoveryAttempts.get(recoveryKey) || 0;
  }

  /**
   * Show user-friendly error message with recovery options
   */
  showRecoveryAlert(result: RecoveryResult, onRetry?: () => void): void {
    if (!result.userMessage) return;

    const buttons: any[] = [{ text: 'OK', style: 'default' }];

    if (result.shouldRetry && onRetry) {
      buttons.unshift({
        text: 'Try Again',
        onPress: onRetry,
        style: 'default',
      });
    }

    Alert.alert('Recovery Suggestion', result.userMessage, buttons);
  }
}

export default ErrorRecoveryService.getInstance();
