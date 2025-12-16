/**
 * Calls API Client
 *
 * Handles all call-related API operations including:
 * - Push token registration
 * - Call initiation (sends push notifications)
 * - Call answer/decline/missed operations
 *
 * Integrates with existing ApiService singleton
 */

import { apiService } from '../api';
import { SentryErrorTracker } from '../../utils/sentryErrorTracker';
import type { ApiResponse } from '../../types';

// ================== Types ==================

interface PushTokenRegistrationData {
  token: string;
  platform: 'ios' | 'android';
  type: 'expo' | 'voip' | 'fcm'; // 'expo' for Expo push tokens, 'voip'/'fcm' for native tokens
}

interface InitiateCallData {
  recipientId: string;
  callType: 'audio' | 'video';
  metadata?: Record<string, any>;
}

interface InitiateCallResponse {
  success: boolean;
  roomUrl: string;
  message: string;
}

interface CallActionResponse {
  success: boolean;
  roomUrl?: string;
  message: string;
}

// ================== API Client ==================

class CallsApiClient {
  /**
   * Register or update push notification token
   * Backend will use this token to send incoming call notifications
   */
  async registerPushToken(
    token: string,
    platform: 'ios' | 'android',
    type: 'expo' | 'voip' | 'fcm'
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    try {
      console.log(`📱 Registering ${type} push token for ${platform}...`);

      const data: PushTokenRegistrationData = {
        token,
        platform,
        type,
      };

      const response = await apiService.post<{ success: boolean; message: string }>(
        '/users/push-tokens',
        data
      );

      if (response.success) {
        console.log('✅ Push token registered successfully');
      } else {
        console.warn('⚠️ Push token registration returned false success');
      }
      return response;
    } catch (error: any) {
      console.error('❌ Failed to register push token:', error);

      // Track error with Sentry
      SentryErrorTracker.getInstance().trackServiceError(error, {
        service: 'callsApi',
        action: 'registerPushToken',
        additional: {
          platform,
          type,
        },
      });

      // Re-throw for caller to handle
      throw error;
    }
  }

  /**
   * Initiate a call to another user
   * This sends a push notification to the recipient with native incoming call UI
   */
  async initiateCall(
    recipientId: string,
    callType: 'audio' | 'video' = 'video',
    metadata?: Record<string, any>
  ): Promise<ApiResponse<InitiateCallResponse>> {
    try {
      console.log(`📞 Initiating ${callType} call to user ${recipientId}...`);

      const data: InitiateCallData = {
        recipientId,
        callType,
        metadata,
      };

      const response = await apiService.post<InitiateCallResponse>('/calls/initiate', data);

      if (response.success) {
        console.log('✅ Call initiated successfully, push notification sent');
        console.log(`🔗 Room URL: ${response.data?.roomUrl || 'N/A'}`);
      } else {
        console.warn('⚠️ Call initiation returned false success');
      }

      return response;
    } catch (error: any) {
      console.error('❌ Failed to initiate call:', error);

      // Provide user-friendly error messages
      let userMessage = 'Failed to initiate call. Please try again.';

      if (error.response?.status === 400) {
        userMessage = error.response?.data?.message || 'Recipient is not available.';
      } else if (error.response?.status === 404) {
        userMessage = 'Recipient not found.';
      } else if (!error.response) {
        userMessage = 'Network error. Please check your connection.';
      }

      // Track error with Sentry using correct method
      SentryErrorTracker.getInstance().trackServiceError(error, {
        service: 'callsApi',
        action: 'initiateCall',
        additional: {
          recipientId,
          callType,
          statusCode: error.response?.status,
        },
      });

      // Create enhanced error with user message
      const enhancedError = new Error(userMessage);
      (enhancedError as any).originalError = error;
      (enhancedError as any).userMessage = userMessage;

      throw enhancedError;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(callId: string): Promise<ApiResponse<CallActionResponse>> {
    try {
      console.log(`✅ Answering call: ${callId}`);

      const response = await apiService.post<CallActionResponse>(`/calls/${callId}/answer`);

      if (response.success) {
        console.log('✅ Call answered successfully');
      }

      return response;
    } catch (error: any) {
      console.error('❌ Failed to answer call:', error);

      // Track error with Sentry
      SentryErrorTracker.getInstance().trackServiceError(error, {
        service: 'callsApi',
        action: 'answerCall',
        additional: {
          callId,
        },
      });

      throw error;
    }
  }

  /**
   * Decline an incoming call
   */
  async declineCall(callId: string): Promise<ApiResponse<CallActionResponse>> {
    try {
      console.log(`❌ Declining call: ${callId}`);

      const response = await apiService.post<CallActionResponse>(`/calls/${callId}/decline`);

      if (response.success) {
        console.log('✅ Call declined successfully');
      }

      return response;
    } catch (error: any) {
      console.error('❌ Failed to decline call:', error);

      // Track error with Sentry
      SentryErrorTracker.getInstance().trackServiceError(error, {
        service: 'callsApi',
        action: 'declineCall',
        additional: {
          callId,
        },
      });

      throw error;
    }
  }

  /**
   * Mark a call as missed (when recipient didn't answer)
   */
  async markCallMissed(callId: string, recipientId: string): Promise<ApiResponse<CallActionResponse>> {
    try {
      console.log(`⏰ Marking call as missed: ${callId}`);

      const response = await apiService.post<CallActionResponse>(`/calls/${callId}/missed`, {
        recipientId,
      });

      if (response.success) {
        console.log('✅ Call marked as missed successfully');
      }

      return response;
    } catch (error: any) {
      console.error('❌ Failed to mark call as missed:', error);

      // Track error with Sentry
      SentryErrorTracker.getInstance().trackServiceError(error, {
        service: 'callsApi',
        action: 'markCallMissed',
        additional: {
          callId,
          recipientId,
        },
      });

      throw error;
    }
  }
}

// Export singleton instance
export const callsApi = new CallsApiClient();
export default callsApi;

// Export types
export type {
  PushTokenRegistrationData,
  InitiateCallData,
  InitiateCallResponse,
  CallActionResponse,
};
