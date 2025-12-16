/**
 * IncomingCallActivityLauncher
 * 
 * Launches a full-screen incoming call UI on Android 10+ devices
 * when CallKeep is unavailable (budget devices like Tecno Spark 5 Pro)
 * 
 * This module provides a React Native-based full-screen incoming call UI
 * that works without native Android activities.
 */

import { Platform, AppState, NativeModules, NativeEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';

// 🚨 CRITICAL: Native module for launching IncomingCallActivity on Android
// This enables full-screen incoming call UI even when app is in background/killed
const NativeIncomingCallModule = NativeModules.NativeIncomingCallModule;

interface IncomingCallData {
  callId: string;
  callerId: string;
  callerName: string;
  callerType: 'customer' | 'doctor';
  callType: 'audio' | 'video';
  roomUrl: string;
  metadata?: Record<string, any>;
}

class IncomingCallActivityLauncher {
  private static instance: IncomingCallActivityLauncher | null = null;
  private activeCallData: IncomingCallData | null = null;
  private onAnswerCallback: ((callData: IncomingCallData) => void) | null = null;
  private onDeclineCallback: ((callData: IncomingCallData) => void) | null = null;

  private constructor() {}

  static getInstance(): IncomingCallActivityLauncher {
    if (!IncomingCallActivityLauncher.instance) {
      IncomingCallActivityLauncher.instance = new IncomingCallActivityLauncher();
    }
    return IncomingCallActivityLauncher.instance;
  }

  /**
   * Launch full-screen incoming call UI
   *
   * Strategy:
   * 1. Try native module first (best UX - works with New Architecture)
   * 2. Fallback to expo-notifications if native module unavailable
   *
   * 🎯 NEW ARCHITECTURE COMPATIBLE: Uses NativeIncomingCallModule
   */
  async launchIncomingCallUI(callData: IncomingCallData): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('⚠️ IncomingCallActivityLauncher only works on Android');
      return;
    }

    console.log('📱 Launching full-screen incoming call UI for:', callData.callerName);

    // Store call data
    this.activeCallData = callData;

    // 🎯 PRIORITY 1: Try native module (works with New Architecture)
    if (NativeIncomingCallModule && typeof NativeIncomingCallModule.launchIncomingCallActivity === 'function') {
      console.log('✅ Using NativeIncomingCallModule (New Architecture compatible)');

      try {
        await NativeIncomingCallModule.launchIncomingCallActivity({
          callId: callData.callId,
          callerId: callData.callerId,
          callerName: callData.callerName,
          callerType: callData.callerType,
          callType: callData.callType,
          roomUrl: callData.roomUrl,
          metadata: callData.metadata || {},
        });

        console.log('✅ Native incoming call activity launched successfully');
        return;
      } catch (error) {
        console.error('❌ Failed to launch native activity:', error);
        console.log('⚠️ Falling back to expo-notifications');
        // Continue to fallback
      }
    } else {
      console.warn('⚠️ NativeIncomingCallModule not available');
      console.log('ℹ️  Module exists:', !!NativeIncomingCallModule);
      console.log('ℹ️  Method exists:', typeof NativeIncomingCallModule?.launchIncomingCallActivity);
      console.log('⚠️ Using expo-notifications fallback');
    }

    // 🎯 FALLBACK: Use expo-notifications
    await this.createFullScreenNotification(callData);

    const appState = AppState.currentState;
    console.log(`📱 App state: ${appState} - Notification will wake device and launch app`);
  }

  /**
   * Create full-screen notification that wakes device
   * 🚨 ENHANCED: Improved configuration for better wake-up behavior
   */
  private async createFullScreenNotification(callData: IncomingCallData): Promise<void> {
    const notificationId = `incoming_call_fullscreen_${callData.callId}`;

    const notificationContent: Notifications.NotificationContentInput = {
      title: `📞 Incoming ${callData.callType === 'video' ? 'Video' : 'Audio'} Call`,
      body: `${callData.callerName} is calling...`,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 500, 250, 500, 250, 500],
      sticky: true,
      autoDismiss: false,
      data: {
        type: 'incoming_call_fullscreen',
        callId: callData.callId,
        callerId: callData.callerId,
        callerName: callData.callerName,
        callerType: callData.callerType,
        callType: callData.callType,
        roomUrl: callData.roomUrl,
        metadata: JSON.stringify(callData.metadata || {}), // Stringify for notification data
      },
    };

    const notificationRequest: Notifications.NotificationRequestInput = {
      identifier: notificationId,
      content: notificationContent,
      trigger: null, // Show immediately
    };

    // Android-specific configuration for full-screen intent
    if (Platform.OS === 'android') {
      (notificationRequest.content as any).android = {
        channelId: 'incoming-calls',
        priority: Notifications.AndroidNotificationPriority.MAX,
        ongoing: true,
        autoCancel: false,
        showWhen: true,
        when: Date.now(),
        color: '#4F46E5',
        // 🚨 CRITICAL: Full-screen intent to wake device and show over lock screen
        fullScreenIntent: true,
        // Action buttons for answer/decline
        actions: [
          {
            identifier: 'answer_call',
            buttonTitle: '✅ Answer',
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: 'decline_call',
            buttonTitle: '❌ Decline',
            options: {
              opensAppToForeground: false,
            },
          },
        ],
      };
    }

    try {
      await Notifications.scheduleNotificationAsync(notificationRequest);
      console.log(`✅ Full-screen notification created: ${notificationId}`);
    } catch (error) {
      console.error('❌ Failed to create full-screen notification:', error);
      throw error;
    }
  }

  /**
   * Register callback for when user answers the call
   */
  onAnswer(callback: (callData: IncomingCallData) => void): void {
    this.onAnswerCallback = callback;
  }

  /**
   * Register callback for when user declines the call
   */
  onDecline(callback: (callData: IncomingCallData) => void): void {
    this.onDeclineCallback = callback;
  }

  /**
   * Handle answer action
   */
  handleAnswer(): void {
    if (this.activeCallData && this.onAnswerCallback) {
      console.log('✅ User answered incoming call');
      this.onAnswerCallback(this.activeCallData);
      this.activeCallData = null;
    }
  }

  /**
   * Handle decline action
   */
  handleDecline(): void {
    if (this.activeCallData && this.onDeclineCallback) {
      console.log('❌ User declined incoming call');
      this.onDeclineCallback(this.activeCallData);
      this.activeCallData = null;
    }
  }

  /**
   * Get active call data
   */
  getActiveCallData(): IncomingCallData | null {
    return this.activeCallData;
  }

  /**
   * Clear active call data
   */
  clearActiveCallData(): void {
    this.activeCallData = null;
  }
}

export default IncomingCallActivityLauncher;
export type { IncomingCallData };
