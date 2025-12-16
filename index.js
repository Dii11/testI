/**
 * Entry Point - Expo App Registration
 *
 * ✅ Push notification packages re-enabled
 * Packages enabled: @notifee/react-native, @react-native-firebase/messaging, react-native-voip-push-notification
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// ℹ️ Note: If you see ElectrocardiogramModule errors on simulator, they are non-critical
// ECG module requires physical device hardware and is expected to fail on simulator
// Just dismiss the error and the app will continue to work normally

// ✅ CRITICAL FIX: Lazy load Notifee to prevent NativeEventEmitter crash
// Loading at top level causes crash if native module isn't ready yet
const isExpoGo = Constants.appOwnership === 'expo';
let notifee = null;
let EventType = null;

if (Device.isDevice && !isExpoGo) {
  try {
    const notifeeModule = require('@notifee/react-native');
    notifee = notifeeModule.default || notifeeModule;
    EventType = notifeeModule.EventType;
    console.log('✅ Notifee loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load Notifee:', error);
    console.warn('⚠️ App will continue without push notification support');
  }
} else {
  console.log('ℹ️ Simulator/Expo Go detected - skipping Notifee initialization');
}

// Only import Firebase on physical devices (simulators don't have native modules)
let messaging = null;
let firebaseApp = null;

if (Device.isDevice && !isExpoGo) {
  try {
    // Initialize Firebase first
    firebaseApp = require('@react-native-firebase/app').default;

    // Check if Firebase is already initialized
    if (firebaseApp.apps.length === 0) {
      console.warn('⚠️ Firebase not auto-initialized, GoogleService-Info.plist may be missing');
    } else {
      console.log('✅ Firebase App initialized successfully');
    }

    // Then initialize messaging
    messaging = require('@react-native-firebase/messaging').default;
    console.log('✅ Firebase Messaging loaded successfully');
  } catch (error) {
    console.warn('⚠️ Firebase not available:', error);
  }
}

// ========================================
// BACKGROUND HANDLERS (MUST BE BEFORE EXPO/APPENTRY)
// ========================================

/**
 * Notifee Background Event Handler
 * Handles notification interactions when app is killed/backgrounded
 *
 * ✅ ENHANCED: Comprehensive error boundary to prevent background handler crashes
 * ✅ CRITICAL FIX: Only register if Notifee loaded successfully
 */
if (notifee && EventType) {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    try {
      const { notification, pressAction } = detail;

      console.log('[Background] Notifee event:', {
        type: EventType[type],
        action: pressAction?.id,
        notificationId: notification?.id,
      });

      switch (type) {
        case EventType.PRESS:
          // Notification tapped - app will open
          console.log('[Background] Opening app from notification');
          break;

        case EventType.ACTION_PRESS:
          // Action button pressed
          if (pressAction?.id === 'decline_call') {
            console.log('[Background] Declining call');

            // Dismiss notification
            if (notification?.id) {
              await notifee.cancelNotification(notification.id);
            }

            // TODO: Optionally notify backend of declined call
          } else if (pressAction?.id === 'answer_call') {
            console.log('[Background] Answering call - app will open');
          }
          break;

        case EventType.DISMISSED:
          console.log('[Background] Notification dismissed');
          break;

        default:
          console.log('[Background] Unhandled event type:', type);
      }
    } catch (error) {
      // ✅ CRITICAL: Never throw in background handlers - log and continue
      console.error('[Background] Error handling Notifee event:', error);
      // Background handler should never crash - errors are logged only
    }
  });
  console.log('✅ Notifee background handler registered');
} else {
  console.warn('⚠️ Notifee not available - background handler skipped');
}

/**
 * Firebase Cloud Messaging Background Handler
 * Handles incoming FCM messages when app is killed/backgrounded
 * Only registered on physical devices
 *
 * ✅ ENHANCED: Comprehensive error boundary to prevent background handler crashes
 */
if (messaging) {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    try {
      console.log('[Background] FCM message received:', {
        messageId: remoteMessage.messageId,
        data: remoteMessage.data,
      });

      // Note: Message will be processed by NotifeeNotificationService
      // when app comes to foreground, or handled by Notifee handler above
      // if user interacts with the resulting notification
    } catch (error) {
      // ✅ CRITICAL: Never throw in background handlers - log and continue
      console.error('[Background] Error handling FCM message:', error);
      // Background handler should never crash - errors are logged only
    }
  });
} else {
  console.log('⚠️ Running on simulator - Firebase background handler skipped');
}

console.log('✅ Push notifications enabled');

// ========================================
// EXPO APP REGISTRATION
// ========================================

import 'expo/AppEntry';
