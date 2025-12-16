/**
 * PushTokenRegistrationService
 * 
 * Automatically registers push tokens with the backend when obtained.
 * Ensures users can receive incoming call notifications.
 */

import { Platform } from 'react-native';

import { callsApi } from './api/callsApi';
import NotifeeNotificationService, { type PushTokenData } from './NotifeeNotificationService';
import { SentryErrorTracker } from '../utils/sentryErrorTracker';

class PushTokenRegistrationService {
  private static instance: PushTokenRegistrationService | null = null;
  private isInitialized = false;
  private registrationAttempted = false;

  private constructor() {}

  static getInstance(): PushTokenRegistrationService {
    if (!PushTokenRegistrationService.instance) {
      PushTokenRegistrationService.instance = new PushTokenRegistrationService();
    }
    return PushTokenRegistrationService.instance;
  }

  /**
   * Initialize and start listening for push token updates
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📱 PushTokenRegistrationService already initialized');
      return;
    }

    try {
      console.log('📱 Initializing PushTokenRegistrationService...');

      const pushService = NotifeeNotificationService.getInstance();

      // Set up token update callback to automatically register with backend
      pushService.onTokenUpdate(async (tokenData: PushTokenData) => {
        await this.registerTokenWithBackend(tokenData);
      });

      this.isInitialized = true;
      console.log('✅ PushTokenRegistrationService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize PushTokenRegistrationService:', error);
      SentryErrorTracker.getInstance().trackServiceError(error as Error, {
        service: 'PushTokenRegistrationService',
        action: 'initialize',
      });
    }
  }

  /**
   * Register push token with backend
   */
  private async registerTokenWithBackend(tokenData: PushTokenData): Promise<void> {
    if (this.registrationAttempted) {
      console.log('📱 Token registration already attempted, skipping duplicate');
      return;
    }

    try {
      console.log('📱 Registering push token with backend...', {
        platform: tokenData.platform,
        type: tokenData.type,
      });

      this.registrationAttempted = true;

      const response = await callsApi.registerPushToken(
        tokenData.token,
        tokenData.platform,
        tokenData.type
      );

      if (response.success) {
        console.log('✅ Push token registered successfully with backend');
      } else {
        console.warn('⚠️ Push token registration returned false success:', response.message);
      }
    } catch (error: any) {
      console.error('❌ Failed to register push token with backend:', error);

      // Reset flag to allow retry on next app launch
      this.registrationAttempted = false;

      // Track error
      SentryErrorTracker.getInstance().trackServiceError(error as Error, {
        service: 'PushTokenRegistrationService',
        action: 'registerToken',
        additional: {
          platform: tokenData.platform,
          tokenType: tokenData.type,
          errorMessage: error.message,
        },
      });

      // Don't throw - we don't want to break app if token registration fails
      // The user can still use the app, just won't receive incoming calls
    }
  }

  /**
   * Manually trigger token registration (useful for retry scenarios)
   */
  async retryRegistration(): Promise<void> {
    this.registrationAttempted = false;
    
    const pushService = NotifeeNotificationService.getInstance();
    const currentToken = pushService.getFCMToken();

    if (currentToken) {
      await this.registerTokenWithBackend({
        token: currentToken,
        platform: Platform.OS as 'ios' | 'android',
        type: Platform.OS === 'android' ? 'fcm' : 'voip', // FCM for Android, VoIP for iOS
      });
    } else {
      console.warn('⚠️ No current token available for retry');
    }
  }

  /**
   * Reset the service (useful for logout)
   */
  reset(): void {
    this.registrationAttempted = false;
    console.log('🔄 PushTokenRegistrationService reset');
  }
}

export default PushTokenRegistrationService;
