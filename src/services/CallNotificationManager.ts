/**
 * CallNotificationManager
 *
 * Manages notifications for video calls, especially when app goes to background
 * Provides persistent call notifications and allows basic call controls from notification
 *
 * Features:
 * - Background call notifications with call controls
 * - Platform-specific notification handling (iOS/Android)
 * - Integration with VideoCallBackgroundManager
 * - Notification-based call controls (mute, end call)
 * - VoIP integration for iOS
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import AppStateManager from '../utils/AppStateManager';
import CallNavigationManager from './CallNavigationManager';
import VideoCallBackgroundManager from './VideoCallBackgroundManager';
import { SentryErrorTracker } from '../utils/sentryErrorTracker';

interface CallNotificationConfig {
  enableBackgroundNotifications: boolean;
  enableCallControls: boolean;
  autoShowOnBackground: boolean;
  persistentNotification: boolean;
  notificationChannelId: string;
  notificationChannelName: string;
}

interface ActiveCallNotification {
  id: string;
  participantName: string;
  callType: 'audio' | 'video';
  callStartTime: Date;
  isVisible: boolean;
}

interface IncomingCallNotificationData {
  callId: string;
  callerId: string;
  callerName: string;
  callerType: 'customer' | 'doctor';
  callType: 'audio' | 'video';
  roomUrl: string;
  metadata?: Record<string, any>;
}

class CallNotificationManager {
  private static instance: CallNotificationManager | null = null;

  private config: CallNotificationConfig = {
    enableBackgroundNotifications: true,
    enableCallControls: Platform.OS === 'android', // iOS has CallKit
    autoShowOnBackground: true,
    persistentNotification: true,
    notificationChannelId: 'hopmed_video_calls',
    notificationChannelName: 'Video Calls',
  };

  private activeNotification: ActiveCallNotification | null = null;
  private incomingCallNotification: IncomingCallNotificationData | null = null;
  private isInitialized = false;
  private appStateUnsubscribe: (() => void) | null = null;
  private backgroundManagerUnsubscribe: (() => void) | null = null;
  private navigationRef: any = null; // ✅ Navigation ref for direct navigation

  // Callbacks for incoming call notifications
  private onIncomingCallAnsweredCallback: ((callData: IncomingCallNotificationData) => void) | null = null;
  private onIncomingCallDeclinedCallback: ((callData: IncomingCallNotificationData) => void) | null = null;

  private constructor() {
    this.initialize();
  }

  static getInstance(): CallNotificationManager {
    if (!CallNotificationManager.instance) {
      CallNotificationManager.instance = new CallNotificationManager();
    }
    return CallNotificationManager.instance;
  }

  /**
   * Register navigation ref for direct navigation to IncomingCallScreen
   * CRITICAL: Must be called from App.tsx after navigation container is ready
   */
  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
    console.log('✅ Navigation ref registered with CallNotificationManager');
  }

  private async initialize(): Promise<void> {
    console.log('📱 CallNotificationManager initializing...');

    try {
      await this.setupNotificationPermissions();
      await this.setupNotificationChannel();
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('✅ CallNotificationManager initialized successfully');
    } catch (error) {
      console.error('❌ CallNotificationManager initialization failed:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'CallNotificationManager',
        action: 'initialization',
      });
    }
  }

  /**
   * Setup notification permissions
   */
  private async setupNotificationPermissions(): Promise<void> {
    try {
      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('📱 Notification permissions not granted');
        this.config.enableBackgroundNotifications = false;
        return;
      }

      console.log('✅ Notification permissions granted');
    } catch (error) {
      console.error('❌ Failed to setup notification permissions:', error);
      this.config.enableBackgroundNotifications = false;
    }
  }

  /**
   * Setup notification channel for Android
   */
  private async setupNotificationChannel(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      // Ongoing calls channel
      await Notifications.setNotificationChannelAsync(this.config.notificationChannelId, {
        name: this.config.notificationChannelName,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: true,
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true, // Allow notifications even in Do Not Disturb mode
        showBadge: true,
      });

      // 🚨 CRITICAL: Incoming calls channel with MAX importance for Android 10+
      // This enables full-screen intent and wake-on-notification
      await Notifications.setNotificationChannelAsync('incoming-calls', {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX, // MAX importance for full-screen intent
        vibrationPattern: [0, 500, 250, 500], // Longer vibration for incoming calls
        lightColor: '#4F46E5',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      console.log('✅ Android notification channels created (ongoing + incoming)');
    } catch (error) {
      console.error('❌ Failed to create notification channel:', error);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to app state changes
    this.appStateUnsubscribe = AppStateManager.getInstance().addListener(
      'CallNotificationManager',
      this.handleAppStateChange.bind(this),
      80 // Lower priority than video manager
    );

    // Listen to background manager events
    this.backgroundManagerUnsubscribe = VideoCallBackgroundManager.getInstance().addListener({
      id: 'CallNotificationManager',
      onAppStateChange: this.handleVideoCallStateChange.bind(this),
      onVideoStateChange: () => {}, // Not needed for notifications
      onCallRecoveryStarted: () => {},
      onCallRecoveryCompleted: () => {},
      onQualityDegraded: () => {},
    });

    // Handle notification interactions
    Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );

    console.log('✅ Event listeners setup for call notifications');
  }

  /**
   * Handle app state changes
   */
  private async handleAppStateChange(appState: AppStateStatus): Promise<void> {
    if (!this.isInitialized || !this.config.enableBackgroundNotifications) {
      return;
    }

    const backgroundManager = VideoCallBackgroundManager.getInstance();

    if (appState === 'background' || appState === 'inactive') {
      // Show notification when app goes to background during call
      if (backgroundManager.isInCall() && this.config.autoShowOnBackground) {
        await this.showBackgroundCallNotification();
      }
    } else if (appState === 'active') {
      // Hide notification when app comes to foreground
      await this.hideBackgroundCallNotification();
    }
  }

  /**
   * Handle video call state changes from background manager
   */
  private async handleVideoCallStateChange(
    appState: AppStateStatus,
    callState: any
  ): Promise<void> {
    if (!this.isInitialized || !callState.isInCall) {
      return;
    }

    // Update notification content based on call state
    if (this.activeNotification && this.activeNotification.isVisible) {
      await this.updateBackgroundCallNotification(callState);
    }
  }

  /**
   * Show background call notification
   */
  public async showBackgroundCallNotification(
    participantName?: string,
    callType: 'audio' | 'video' = 'video'
  ): Promise<void> {
    if (!this.config.enableBackgroundNotifications || this.activeNotification?.isVisible) {
      return;
    }

    try {
      const notificationId = `call_${Date.now()}`;
      const effectiveParticipantName = participantName || 'Healthcare Provider';

      const notificationContent: Notifications.NotificationContentInput = {
        title: '🏥 HopMed Call in Progress',
        body: `${callType === 'video' ? 'Video' : 'Audio'} call with ${effectiveParticipantName}`,
        sound: false, // Don't play sound for ongoing call notifications
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sticky: true, // Make notification persistent
        data: {
          type: 'ongoing_call',
          callType,
          participantName: effectiveParticipantName,
          callId: notificationId,
        },
      };

      // Add call controls for Android
      if (Platform.OS === 'android' && this.config.enableCallControls) {
        notificationContent.categoryIdentifier = 'call_controls';
      }

      const notificationRequest: Notifications.NotificationRequest = {
        identifier: notificationId,
        content: notificationContent,
        trigger: null, // Show immediately
      };

      // Add Android-specific configuration
      if (Platform.OS === 'android') {
        notificationRequest.content.android = {
          channelId: this.config.notificationChannelId,
          ongoing: true, // Makes notification persistent
          autoCancel: false,
          showWhen: true,
          when: Date.now(),
          // ✅ FIX: expo-notifications doesn't support 'category' field in android config
          // The notification channel configuration already handles call-specific behavior
          actions: this.config.enableCallControls ? [
            {
              identifier: 'mute_call',
              buttonTitle: '🔇 Mute',
              options: {
                opensAppToForeground: false,
              },
            },
            {
              identifier: 'end_call',
              buttonTitle: '📞 End Call',
              options: {
                opensAppToForeground: true,
              },
            },
          ] : undefined,
        };
      }

      await Notifications.scheduleNotificationAsync(notificationRequest);

      this.activeNotification = {
        id: notificationId,
        participantName: effectiveParticipantName,
        callType,
        callStartTime: new Date(),
        isVisible: true,
      };

      console.log(`📱 Background call notification shown: ${notificationId}`);
    } catch (error) {
      console.error('❌ Failed to show background call notification:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'CallNotificationManager',
        action: 'show_notification',
        participantName,
        callType,
      });
    }
  }

  /**
   * Update background call notification
   */
  private async updateBackgroundCallNotification(callState: any): Promise<void> {
    if (!this.activeNotification || !this.activeNotification.isVisible) {
      return;
    }

    try {
      const callDuration = Math.floor((Date.now() - this.activeNotification.callStartTime.getTime()) / 1000);
      const minutes = Math.floor(callDuration / 60);
      const seconds = callDuration % 60;
      const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      let statusText = '';
      if (callState.isRecovering) {
        statusText = ' • Reconnecting...';
      } else if (callState.hasBackgroundTransitioned) {
        statusText = ' • Resumed from background';
      }

      const updatedContent: Notifications.NotificationContentInput = {
        title: `🏥 HopMed Call • ${durationText}`,
        body: `${this.activeNotification.callType === 'video' ? 'Video' : 'Audio'} call with ${this.activeNotification.participantName}${statusText}`,
        sound: false,
        data: {
          ...this.activeNotification,
          callDuration,
          callState,
        },
      };

      await Notifications.scheduleNotificationAsync({
        identifier: this.activeNotification.id,
        content: updatedContent,
        trigger: null,
      });

      console.log(`📱 Background call notification updated: ${durationText}`);
    } catch (error) {
      console.error('❌ Failed to update background call notification:', error);
    }
  }

  /**
   * Hide background call notification
   */
  public async hideBackgroundCallNotification(): Promise<void> {
    if (!this.activeNotification) {
      return;
    }

    try {
      await Notifications.dismissNotificationAsync(this.activeNotification.id);
      console.log(`📱 Background call notification hidden: ${this.activeNotification.id}`);

      this.activeNotification.isVisible = false;
      this.activeNotification = null;
    } catch (error) {
      console.error('❌ Failed to hide background call notification:', error);
    }
  }

  /**
   * Handle notification interactions
   */
  private async handleNotificationResponse(
    response: Notifications.NotificationResponse
  ): Promise<void> {
    const { notification, actionIdentifier } = response;
    const notificationData = notification.request.content.data;

    console.log(`📱 Notification action: ${actionIdentifier}`, notificationData?.type);

    try {
      // 🚨 Handle incoming call notification actions
      // Check for both 'incoming_call' and 'incoming_call_fullscreen' types
      if (notificationData?.type === 'incoming_call' || notificationData?.type === 'incoming_call_fullscreen') {
        switch (actionIdentifier) {
          case 'answer_call':
            console.log('✅ FALLBACK: Answer call action from notification');
            if (this.incomingCallNotification && this.onIncomingCallAnsweredCallback) {
              this.onIncomingCallAnsweredCallback(this.incomingCallNotification);
            }
            await this.dismissIncomingCallNotification();
            break;

          case 'decline_call':
            console.log('❌ FALLBACK: Decline call action from notification');
            if (this.incomingCallNotification && this.onIncomingCallDeclinedCallback) {
              this.onIncomingCallDeclinedCallback(this.incomingCallNotification);
            }
            await this.dismissIncomingCallNotification();
            break;

          case Notifications.DEFAULT_ACTION_IDENTIFIER:
            // User tapped the notification - navigate directly to IncomingCallScreen
            console.log('📱 FALLBACK: Incoming call notification tapped - showing incoming call screen');

            // 🚨 CRITICAL FIX: Extract call data from notification (works for both stored and non-stored cases)
            const callData = this.incomingCallNotification || {
              callId: notificationData.callId as string,
              callerId: notificationData.callerId as string,
              callerName: notificationData.callerName as string,
              callerType: notificationData.callerType as 'customer' | 'doctor',
              callType: notificationData.callType as 'audio' | 'video',
              roomUrl: notificationData.roomUrl as string,
              metadata: typeof notificationData.metadata === 'string' 
                ? JSON.parse(notificationData.metadata) 
                : notificationData.metadata,
            };

            if (callData) {
              // ✅ DIRECT NAVIGATION with data as params
              if (this.navigationRef) {
                console.log('✅ Navigating directly to IncomingCall screen with data:', callData.callerName);
                this.navigationRef.navigate('IncomingCall', {
                  callData: callData,
                });
              } else {
                console.warn('⚠️ Navigation ref not set - using fallback restoration method');
                console.warn('   Make sure to call CallNotificationManager.setNavigationRef() in App.tsx');
                
                // Fallback: Register call session and hope restoration works
                CallNavigationManager.getInstance().startCallSession(
                  callData.callType,
                  callData.callerType === 'doctor' ? 'DoctorDetails' : 'CustomerDetails',
                  callData.metadata || {},
                  callData.callerName,
                  callData.callerType,
                  callData.roomUrl
                );
              }
            } else {
              console.error('❌ No call data available in notification - cannot navigate');
            }

            // Note: Don't dismiss notification here - IncomingCallScreen will handle it
            break;

          default:
            console.log(`📱 Unknown incoming call action: ${actionIdentifier}`);
        }
        return;
      }

      // Handle ongoing call notification actions
      if (notificationData?.type === 'ongoing_call') {
        switch (actionIdentifier) {
          case 'mute_call':
            // Handle mute action
            console.log('🔇 Mute call action from notification');
            // TODO: Integrate with call controls
            break;

          case 'end_call':
            // Handle end call action
            console.log('📞 End call action from notification');
            await this.hideBackgroundCallNotification();
            // TODO: Integrate with call manager to end call
            break;

          case Notifications.DEFAULT_ACTION_IDENTIFIER:
            // User tapped the notification - bring app to foreground
            console.log('📱 Notification tapped - bringing app to foreground');
            break;

          default:
            console.log(`📱 Unknown ongoing call action: ${actionIdentifier}`);
        }
      }
    } catch (error) {
      console.error('❌ Error handling notification response:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'CallNotificationManager',
        action: 'handle_notification_response',
        actionIdentifier,
      });
    }
  }

  /**
   * Configuration management
   */
  public updateConfig(newConfig: Partial<CallNotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📱 Call notification config updated:', this.config);
  }

  public getConfig(): CallNotificationConfig {
    return { ...this.config };
  }

  /**
   * Status getters
   */
  public isNotificationVisible(): boolean {
    return this.activeNotification?.isVisible || false;
  }

  public getActiveNotification(): ActiveCallNotification | null {
    return this.activeNotification ? { ...this.activeNotification } : null;
  }

  /**
   * Manual notification controls
   */
  public async forceShowNotification(
    participantName: string,
    callType: 'audio' | 'video'
  ): Promise<void> {
    await this.showBackgroundCallNotification(participantName, callType);
  }

  public async forceHideNotification(): Promise<void> {
    await this.hideBackgroundCallNotification();
  }

  /**
   * 🚨 INCOMING CALL FALLBACK: Display incoming call notification
   * Used when CallKeep is unavailable (Android 10+ budget devices, simulators, etc.)
   *
   * This creates a high-priority notification with:
   * - Full-screen intent (wakes device and shows over lock screen on Android 10+)
   * - Answer and Decline actions
   * - Persistent sound and vibration
   */
  public async displayIncomingCallNotification(
    callData: IncomingCallNotificationData
  ): Promise<string> {
    try {
      const notificationId = `incoming_call_${callData.callId}`;

      console.log('📱 FALLBACK: Displaying incoming call notification (CallKeep unavailable)');
      console.log(`   Caller: ${callData.callerName} (${callData.callType})`);

      const notificationContent: Notifications.NotificationContentInput = {
        title: `📞 Incoming ${callData.callType === 'video' ? 'Video' : 'Audio'} Call`,
        body: `${callData.callerName} is calling...`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 250, 500, 250, 500],
        sticky: true,
        autoDismiss: false,
        data: {
          type: 'incoming_call',
          ...callData,
        },
      };

      const notificationRequest: Notifications.NotificationRequest = {
        identifier: notificationId,
        content: notificationContent,
        trigger: null, // Show immediately
      };

      // 🚨 CRITICAL: Android full-screen intent configuration
      if (Platform.OS === 'android') {
        notificationRequest.content.android = {
          channelId: 'incoming-calls',
          priority: Notifications.AndroidNotificationPriority.MAX,
          ongoing: true,
          autoCancel: false,
          showWhen: true,
          when: Date.now(),
          color: '#4F46E5',
          // 🚨 Full-screen intent (Android 10+): Wakes device and shows over lock screen
          fullScreenIntent: true,
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

      await Notifications.scheduleNotificationAsync(notificationRequest);

      // Store incoming call data
      this.incomingCallNotification = callData;

      console.log(`✅ FALLBACK: Incoming call notification displayed: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('❌ FALLBACK: Failed to display incoming call notification:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'CallNotificationManager',
        action: 'display_incoming_call_notification',
        callData,
      });
      throw error;
    }
  }

  /**
   * Dismiss incoming call notification
   */
  public async dismissIncomingCallNotification(): Promise<void> {
    if (!this.incomingCallNotification) {
      return;
    }

    try {
      const notificationId = `incoming_call_${this.incomingCallNotification.callId}`;
      await Notifications.dismissNotificationAsync(notificationId);
      console.log(`✅ Incoming call notification dismissed: ${notificationId}`);
      this.incomingCallNotification = null;
    } catch (error) {
      console.error('❌ Failed to dismiss incoming call notification:', error);
    }
  }

  /**
   * Register callbacks for incoming call events
   */
  public onIncomingCallAnswered(callback: (callData: IncomingCallNotificationData) => void): void {
    this.onIncomingCallAnsweredCallback = callback;
  }

  public onIncomingCallDeclined(callback: (callData: IncomingCallNotificationData) => void): void {
    this.onIncomingCallDeclinedCallback = callback;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    console.log('🧹 CallNotificationManager destroying...');

    // Hide any active notifications
    if (this.activeNotification) {
      this.hideBackgroundCallNotification();
    }

    // Dismiss incoming call notifications
    if (this.incomingCallNotification) {
      this.dismissIncomingCallNotification();
    }

    // Remove event listeners
    if (this.appStateUnsubscribe) {
      this.appStateUnsubscribe();
      this.appStateUnsubscribe = null;
    }

    if (this.backgroundManagerUnsubscribe) {
      this.backgroundManagerUnsubscribe();
      this.backgroundManagerUnsubscribe = null;
    }

    // Clear callbacks
    this.onIncomingCallAnsweredCallback = null;
    this.onIncomingCallDeclinedCallback = null;

    this.isInitialized = false;
    CallNotificationManager.instance = null;

    console.log('✅ CallNotificationManager destroyed');
  }
}

export default CallNotificationManager;
export type { CallNotificationConfig, ActiveCallNotification, IncomingCallNotificationData };