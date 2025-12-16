/**
 * PushNotificationService
 *
 * Handles push notifications for incoming calls
 * - iOS: High-priority APNs via expo-notifications
 * - Android: Firebase Cloud Messaging (FCM) via expo-notifications
 *
 * Integration with IncomingCallManager to display native call UI
 * Uses CallKeep for native incoming call experience
 */

import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';

import IncomingCallManager, { type IncomingCallData } from './IncomingCallManager';
import CallNavigationManager from './CallNavigationManager';
import { SentryErrorTracker } from '../utils/sentryErrorTracker';

// Background notification task name
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

interface PushTokenData {
  token: string;
  platform: 'ios' | 'android';
  type: 'expo' | 'fcm';
}

interface IncomingCallPushPayload {
  callerId: string;
  callerName: string;
  callerType: 'customer' | 'doctor';
  callType: 'audio' | 'video';
  roomUrl: string;
  metadata?: Record<string, any> | string; // Can be object or stringified JSON from FCM
}

/**
 * Define background notification task handler
 * This runs when a notification is received while the app is backgrounded or killed
 */
TaskManager.defineTask(
  BACKGROUND_NOTIFICATION_TASK,
  async ({ data, error, executionInfo }: any) => {
    if (error) {
      console.error('❌ Background notification task error:', error);
      return;
    }

    console.log('📱 Background notification received:', data);

    try {
      // Extract notification data
      const notification = data?.notification;
      const notificationData = notification?.request?.content?.data;

      // Handle incoming call notification
      if (notificationData && notificationData.type === 'incoming_call') {
        console.log('📞 Background incoming call notification');

        // Parse metadata if it's a stringified JSON (FCM data messages require string values)
        let metadata = notificationData.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            console.warn('⚠️ Failed to parse metadata JSON:', e);
            metadata = undefined;
          }
        }

        // Get IncomingCallManager and display call
        const incomingCallManager = IncomingCallManager.getInstance();
        await incomingCallManager.displayIncomingCall({
          callerId: notificationData.callerId,
          callerName: notificationData.callerName,
          callerType: notificationData.callerType,
          callType: notificationData.callType,
          roomUrl: notificationData.roomUrl,
          metadata,
        });

        console.log('✅ Background incoming call displayed via CallKeep');
      }
    } catch (error) {
      console.error('❌ Error handling background notification:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'PushNotificationService',
        action: 'background_notification_task',
      });
    }
  }
);

class PushNotificationService {
  private static instance: PushNotificationService | null = null;
  private isInitialized = false;
  private pushToken: string | null = null;
  private navigationRef: any = null;

  // Callback for token updates (send to backend)
  private onTokenUpdateCallback: ((tokenData: PushTokenData) => void) | null = null;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize push notification service
   * ✅ CRITICAL FIX: Added initialization lock to prevent concurrent initializations
   */
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    // ✅ CRITICAL FIX: If initialization is in progress, wait for it
    if (this.initializationPromise) {
      console.log('🔔 PushNotificationService initialization already in progress, waiting...');
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      console.log('🔔 PushNotificationService already initialized');
      return;
    }

    console.log('🔔 PushNotificationService initializing...');

    // Create and store the initialization promise
    this.initializationPromise = (async () => {
      try {
        // Initialize IncomingCallManager first
        await IncomingCallManager.getInstance().initialize();

        // Configure notification handler
        this.configureNotificationHandler();

        // Initialize push notifications for both platforms
        await this.initializePushNotifications();

        // Set up notification listeners
        this.setupNotificationListeners();

        // Register background notification task for when app is killed
        await this.registerBackgroundTask();

        this.isInitialized = true;
        console.log('✅ PushNotificationService initialized successfully');
      } catch (error) {
        console.error('❌ PushNotificationService initialization failed:', error);
        SentryErrorTracker.getInstance().trackError(error as Error, {
          context: 'PushNotificationService',
          action: 'initialization',
        });
        throw error; // Re-throw to mark initialization as failed
      } finally {
        // Clear the promise so subsequent calls can check isInitialized
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Configure notification handler
   */
  private configureNotificationHandler(): void {
    // Configure Android notification channel for incoming calls
    if (Platform.OS === 'android') {
      this.setupAndroidNotificationChannel();
    }

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data;

        // For incoming calls, show as high-priority notification
        if (data && data.type === 'incoming_call') {
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            priority: Notifications.AndroidNotificationPriority.MAX,
          };
        }

        return {
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      },
    });
  }

  /**
   * Set up Android notification channel for incoming calls
   * Required for Android 8.0+ to show high-priority notifications
   */
  private async setupAndroidNotificationChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      await Notifications.setNotificationChannelAsync('incoming-calls', {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F46E5',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      console.log('✅ Android notification channel configured');
    } catch (error) {
      console.error('❌ Failed to set up Android notification channel:', error);
    }
  }

  /**
   * Initialize push notifications (works for both iOS and Android)
   * 
   * Token Strategy:
   * - Development: Use Expo tokens (avoid Firebase config issues)
   * - Production: Use native FCM tokens on Android (better reliability)
   * - iOS: Always use Expo tokens (backend routes through Expo)
   * 
   * 🔧 FIX: Handles MISSING_INSTANCEID_SERVICE error by using environment-based strategy
   */
  private async initializePushNotifications(): Promise<void> {
    const platform = Platform.OS === 'ios' ? '🍎' : '🤖';
    console.log(`${platform} Initializing push notifications...`);

    try {
      // Check if running on physical device
      if (!Device.isDevice) {
        console.warn('⚠️ Push notifications require a physical device');
        return;
      }

      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn(`${platform} Notification permissions not granted`);
        return;
      }

      // 🔧 CRITICAL FIX: Environment-based token strategy to handle Firebase issues
      let tokenData;
      let tokenType: 'expo' | 'fcm';
      
      // Load environment config
      const { getConfig } = await import('../config/env.config');
      const config = getConfig();
      const isDevelopment = config.HOPMED_BUILD_ENVIRONMENT === 'development';

      if (Platform.OS === 'android') {
        // Use Expo token in development to avoid Firebase configuration issues
        // Use native FCM token in production for better reliability
        if (isDevelopment) {
          try {
            console.log(`${platform} 🔧 Development mode: Using Expo token to avoid Firebase config issues`);
            tokenData = await Notifications.getExpoPushTokenAsync({
              projectId: '0b8a9e9b-2b76-4743-adec-c08db3f01610'
            });
            tokenType = 'expo';
            console.log(`${platform} Expo Token received:`, tokenData.data.substring(0, 20) + '...');
          } catch (expoError) {
            console.error(`${platform} ❌ Expo token fetch failed:`, expoError);
            throw expoError;
          }
        } else {
          try {
            console.log(`${platform} 🚀 Production mode: Using native FCM token for better reliability`);
            tokenData = await Notifications.getDevicePushTokenAsync();
            tokenType = 'fcm';
            console.log(`${platform} FCM Token received:`, tokenData.data.substring(0, 20) + '...');
          } catch (fcmError) {
            console.warn(`${platform} ⚠️ FCM token fetch failed, falling back to Expo token:`, fcmError);
            
            // Track FCM failure for monitoring
            SentryErrorTracker.getInstance().trackError(fcmError as Error, {
              context: 'PushNotificationService',
              action: 'fcm_fallback',
              errorType: (fcmError as any)?.message?.includes('MISSING_INSTANCEID_SERVICE') 
                ? 'firebase_missing' 
                : 'fcm_unknown',
            });
            
            // Fallback to Expo token if FCM fails
            tokenData = await Notifications.getExpoPushTokenAsync({
              projectId: '0b8a9e9b-2b76-4743-adec-c08db3f01610'
            });
            tokenType = 'expo';
            console.log(`${platform} Fallback Expo Token received:`, tokenData.data.substring(0, 20) + '...');
          }
        }
      } else {
        // iOS: Always use Expo token (backend routes through Expo)
        tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '0b8a9e9b-2b76-4743-adec-c08db3f01610'
        });
        tokenType = 'expo';
        console.log(`${platform} Expo Token received:`, tokenData.data.substring(0, 20) + '...');
      }

      this.pushToken = tokenData.data;

      // Notify callback to send token to backend
      if (this.onTokenUpdateCallback) {
        this.onTokenUpdateCallback({
          token: this.pushToken,
          platform: Platform.OS as 'ios' | 'android',
          type: tokenType,
        });
      }

      console.log(`✅ ${platform} Push notifications initialized successfully (type: ${tokenType})`);
    } catch (error) {
      console.error(`❌ ${platform} Push notifications initialization failed:`, error);
      
      // Track error with detailed context
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'PushNotificationService',
        action: 'initializePushNotifications',
        platform: Platform.OS,
        errorType: (error as any)?.message?.includes('MISSING_INSTANCEID_SERVICE') 
          ? 'firebase_missing' 
          : 'unknown',
      });
      
      throw error;
    }
  }

  /**
   * Set up notification listeners
   */
  private setupNotificationListeners(): void {
    // Listen for incoming notifications (when app is foregrounded)
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('📱 Push notification received:', notification);
      const data = notification.request.content.data;

      if (data && data.type === 'incoming_call') {
        this.handleIncomingCallPush(data as IncomingCallPushPayload);
      }
    });

    // Handle notification responses (user tapped notification)
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('📱 Push notification tapped:', response);
      const data = response.notification.request.content.data;

      if (data && data.type === 'incoming_call') {
        // ✅ CRITICAL FIX: Navigate directly to call screen when tapped
        console.log('📞 User tapped incoming call notification - navigating to call');

        const callData = data as IncomingCallPushPayload;

        // Start call session
        CallNavigationManager.getInstance().startCallSession(
          callData.callType,
          callData.callerType === 'doctor' ? 'DoctorDetails' : 'CustomerDetails',
          callData.metadata || {},
          callData.callerName,
          callData.callerType,
          callData.roomUrl
        );

        // Navigate to call screen
        this.navigateToCallScreen(callData);
      }
    });
  }

  /**
   * Register background notification task
   * This handles notifications when app is backgrounded or killed
   */
  private async registerBackgroundTask(): Promise<void> {
    try {
      console.log('📱 Registering background notification task...');

      // Check if task is already registered
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_NOTIFICATION_TASK
      );

      if (isRegistered) {
        console.log('📱 Background notification task already registered');
        return;
      }

      // Register the background notification task
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);

      console.log('✅ Background notification task registered successfully');
      console.log(
        '⚠️  Note: Background tasks have limitations when app is completely killed (Expo limitation)'
      );
    } catch (error) {
      console.error('❌ Failed to register background notification task:', error);
      
      // Provide helpful diagnostic information
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('enableBackgroundRemoteNotifications')) {
        console.error('');
        console.error('🚨 CONFIGURATION ERROR:');
        console.error('   Background remote notifications are not configured in app.json/app.config.js');
        console.error('   Add to expo-notifications plugin configuration:');
        console.error('   {');
        console.error('     enableBackgroundRemoteNotifications: true,');
        console.error('   }');
        console.error('');
        console.error('   Also ensure UIBackgroundModes includes "remote-notification" for iOS');
        console.error('');
      }
      
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'PushNotificationService',
        action: 'register_background_task',
        platform: Platform.OS,
      });
      
      // Non-fatal - app continues to work for foreground/background notifications
      // Only killed-state notifications will not work
      console.warn('⚠️  App will continue without background task registration');
      console.warn('    Foreground and background notifications will still work');
      console.warn('    Only killed-state notifications may be affected');
    }
  }

  /**
   * Handle incoming call push notification
   */
  private async handleIncomingCallPush(payload: IncomingCallPushPayload): Promise<void> {
    console.log('📞 Processing incoming call push:', payload);

    try {
      const incomingCallManager = IncomingCallManager.getInstance();

      // Parse metadata if it's a stringified JSON (FCM data messages require string values)
      let metadata = payload.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata as string);
        } catch (e) {
          console.warn('⚠️ Failed to parse metadata JSON:', e);
          metadata = undefined;
        }
      }

      // Display incoming call UI
      const callUuid = await incomingCallManager.displayIncomingCall({
        callerId: payload.callerId,
        callerName: payload.callerName,
        callerType: payload.callerType,
        callType: payload.callType,
        roomUrl: payload.roomUrl,
        metadata,
      });

      console.log(`✅ Incoming call displayed: ${callUuid}`);
    } catch (error) {
      console.error('❌ Failed to handle incoming call push:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'PushNotificationService',
        action: 'handle_incoming_call_push',
        payload,
      });
    }
  }

  /**
   * Set navigation ref for navigating to call screens
   * CRITICAL: Must be called from App.tsx after navigation container is ready
   */
  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
    console.log('✅ Navigation ref registered with PushNotificationService');
  }

  /**
   * Navigate to call screen when notification is tapped
   * CRITICAL FIX: This enables users to join calls by tapping notifications
   */
  private navigateToCallScreen(callData: IncomingCallPushPayload): void {
    if (!this.navigationRef) {
      console.error('❌ Navigation ref not set - cannot navigate to call screen');
      console.error('   Make sure to call PushNotificationService.setNavigationRef() in App.tsx');
      return;
    }

    try {
      console.log(`🧭 Navigating to ${callData.callerType} details screen with incoming call`);

      // Parse metadata if it's a string
      let metadata = callData.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          console.warn('⚠️ Failed to parse metadata:', e);
          metadata = {};
        }
      }

      // Navigate based on caller type
      if (callData.callerType === 'doctor') {
        const doctorData = (metadata && typeof metadata === 'object' && 'doctor' in metadata)
          ? metadata.doctor
          : null;

        // ✅ CRITICAL FIX: Ensure doctor object has all required fields including userId
        if (!doctorData || !doctorData.userId) {
          console.error('❌ Doctor data incomplete in push notification metadata');
          console.error('   Metadata:', JSON.stringify(metadata, null, 2));
          Alert.alert(
            'Call Error',
            'Unable to display call - doctor information is incomplete. Please try initiating the call again.',
            [{ text: 'OK' }]
          );
          return;
        }

        console.log('✅ Navigating to DoctorDetails with complete doctor data:', doctorData);

        this.navigationRef.navigate('DoctorDetails', {
          doctor: doctorData,
          restoreCall: true,
          incomingCallData: callData,
        });
      } else {
        const customerData = (metadata && typeof metadata === 'object' && 'customer' in metadata)
          ? metadata.customer
          : null;

        // ✅ CRITICAL FIX: Ensure customer object has all required fields including userId
        if (!customerData || !customerData.userId) {
          console.error('❌ Customer data incomplete in push notification metadata');
          console.error('   Metadata:', JSON.stringify(metadata, null, 2));
          Alert.alert(
            'Call Error',
            'Unable to display call - patient information is incomplete. Please try initiating the call again.',
            [{ text: 'OK' }]
          );
          return;
        }

        console.log('✅ Navigating to CustomerDetails with complete customer data:', customerData);

        this.navigationRef.navigate('CustomerDetails', {
          customer: customerData,
          restoreCall: true,
          incomingCallData: callData,
        });
      }

      console.log('✅ Navigation to call screen completed');
    } catch (error) {
      console.error('❌ Navigation to call screen failed:', error);
      SentryErrorTracker.captureError(error as Error, {
        context: 'PushNotificationService',
        extra: {
          action: 'navigate_to_call_screen',
          callData,
        },
      });
    }
  }

  /**
   * Register callback for token updates
   * CRITICAL FIX: If token already exists, triggers callback immediately
   * This fixes the race condition where initialization completes before callback is set
   */
  onTokenUpdate(callback: (tokenData: PushTokenData) => void): void {
    this.onTokenUpdateCallback = callback;

    // CRITICAL FIX: If token already exists, trigger callback immediately
    // This handles the case where initialization completed before callback was registered
    if (this.pushToken) {
      console.log('🔔 Token already exists, triggering callback immediately');
      callback({
        token: this.pushToken,
        platform: Platform.OS as 'ios' | 'android',
        type: Platform.OS === 'android' ? 'fcm' : 'expo',
      });
    }
  }

  /**
   * Get current push token
   */
  getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Manually send test push notification (for testing)
   */
  async sendTestIncomingCall(): Promise<void> {
    console.log('🧪 Sending test incoming call...');

    const testPayload: IncomingCallPushPayload = {
      callerId: 'test-user-123',
      callerName: 'Dr. Test Smith',
      callerType: 'doctor',
      callType: 'video',
      roomUrl: 'https://mbinina.daily.co/test-room',
      metadata: {
        test: true,
      },
    };

    await this.handleIncomingCallPush(testPayload);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    console.log('🧹 PushNotificationService destroying...');

    // Expo notifications listeners are automatically managed
    // No manual cleanup needed

    this.onTokenUpdateCallback = null;
    this.pushToken = null;
    this.isInitialized = false;

    PushNotificationService.instance = null;

    console.log('✅ PushNotificationService destroyed');
  }
}

export default PushNotificationService;
export type { PushTokenData, IncomingCallPushPayload };
