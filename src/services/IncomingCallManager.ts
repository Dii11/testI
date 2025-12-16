/**
 * IncomingCallManager
 *
 * Professional incoming call system for Daily.co integration
 * Manages CallKeep (iOS CallKit + Android ConnectionService) + Daily.co rooms
 *
 * Features:
 * - Native incoming call UI (CallKit on iOS, ConnectionService on Android)
 * - Integration with Daily.co video/audio calls
 * - Call state management (ringing, answered, declined, missed)
 * - Push notification handling
 * - Integration with existing CallNavigationManager
 *
 * Architecture:
 * 1. Backend sends push notification
 * 2. IncomingCallManager receives push
 * 3. Displays native incoming call UI via CallKeep
 * 4. User answers → Join Daily.co room
 * 5. User declines → Reject call
 */

import { Platform, Alert } from 'react-native';
import { v4 as uuidv4 } from 'react-native-get-random-values';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CallNavigationManager from './CallNavigationManager';
import CallNotificationManager, { type IncomingCallNotificationData } from './CallNotificationManager';
import IncomingCallActivityLauncher from './IncomingCallActivityLauncher';
import { SentryErrorTracker, type ErrorContext } from '../utils/sentryErrorTracker';

// Lazy import CallKeep to avoid iOS simulator crash and TurboModule errors
let RNCallKeep: any = null;
let callKeepLoadFailed = false;
let callKeepLoadError: string | null = null;

// Track TurboModule interop issues
let IS_NEW_ARCH_ENABLED = false;
let TURBO_MODULE_INTEROP_ISSUE = false;

// Permission state tracking
const PERMISSION_STATE_KEY = '@hopmed_callkeep_permission_state';
enum PermissionState {
  NOT_REQUESTED = 'not_requested',
  GRANTED = 'granted',
  DENIED = 'denied',
  PERMANENTLY_DENIED = 'permanently_denied',
}

// 🚨 FIXED: New Architecture disabled in app.config.js
// This resolves the TurboModule method overloading issue with react-native-callkeep
// CallKeep works perfectly on the old bridge architecture

const getCallKeep = () => {
  // New Architecture is disabled, so CallKeep should work properly now

  // If we've already tried and failed, don't try again
  if (callKeepLoadFailed) {
    return null;
  }

  if (!RNCallKeep) {
    try {
      // Attempt to load the module
      const module = require('react-native-callkeep');
      RNCallKeep = module.default || module;

      // Verify the module loaded correctly by checking for key methods
      if (RNCallKeep && typeof RNCallKeep.setup === 'function') {
        console.log('✅ CallKeep module loaded successfully');
      } else {
        throw new Error('CallKeep module loaded but setup method not found');
      }
    } catch (error: any) {
      callKeepLoadFailed = true;
      callKeepLoadError = error.message || String(error);

      // 🚨 SPECIFIC FIX: Detect the "Module exports two methods" error
      if (error.message && error.message.includes('Module exports two methods')) {
        console.warn('⚠️ CallKeep TurboModule interop error detected');
        console.warn('⚠️ This is a known issue with react-native-callkeep and React Native 0.79+');
        console.warn('⚠️ Using fallback notification system (this is expected)');
        callKeepLoadError = 'TurboModule interop error: Method overloading not supported in New Architecture';
        TURBO_MODULE_INTEROP_ISSUE = true;
        IS_NEW_ARCH_ENABLED = true;
      } else {
        console.warn('⚠️ Failed to load react-native-callkeep:', callKeepLoadError);
        console.warn('⚠️ This may be due to React Native TurboModule compatibility issues');
        console.warn('⚠️ Incoming calls will use fallback notification system');
      }

      // Track in Sentry for monitoring (non-blocking)
      try {
        const sentryTracker = SentryErrorTracker.getInstance();
        sentryTracker.trackServiceError(error, {
          service: 'CallKeep',
          action: 'Module Load',
          deviceInfo: {
            isDevice: Device.isDevice,
            platform: Platform.OS,
          },
          additional: {
            errorType: 'TurboModule Parse Error',
            reactNativeVersion: '0.79.5',
            isNewArchitecture: IS_NEW_ARCH_ENABLED,
            isTurboModuleInteropIssue: TURBO_MODULE_INTEROP_ISSUE,
          }
        });
      } catch (sentryError) {
        // Ignore Sentry errors
        console.warn('Failed to report CallKeep error to Sentry:', sentryError);
      }
    }
  }
  return RNCallKeep;
};

interface IncomingCallData {
  callUuid: string; // CallKeep UUID
  callerId: string; // User ID of caller
  callerName: string; // Display name
  callerType: 'customer' | 'doctor'; // Type of caller
  callType: 'audio' | 'video';
  roomUrl: string; // Daily.co room URL
  metadata?: Record<string, any>; // Additional call metadata
}

interface CallKeepConfig {
  ios: {
    appName: string;
    imageName?: string;
    supportsVideo: boolean;
    maximumCallGroups: number;
    maximumCallsPerCallGroup: number;
  };
  android: {
    alertTitle: string;
    alertDescription: string;
    cancelButton: string;
    okButton: string;
    imageName?: string;
    additionalPermissions: string[];
    selfManaged: boolean;
  };
}

class IncomingCallManager {
  private static instance: IncomingCallManager | null = null;
  private isInitialized = false;
  private isCallKeepSupported = false;
  private activeCalls: Map<string, IncomingCallData> = new Map();
  private permissionState: PermissionState = PermissionState.NOT_REQUESTED;
  private permissionRequestCount = 0;
  private maxPermissionRequests = 2; // Only ask twice before giving up
  private initializationPromise: Promise<void> | null = null; // ✅ CRITICAL FIX: Prevent concurrent init

  // Callbacks for handling call events
  private onCallAnsweredCallback: ((callData: IncomingCallData) => void) | null = null;
  private onCallDeclinedCallback: ((callData: IncomingCallData) => void) | null = null;

  private constructor() {}

  static getInstance(): IncomingCallManager {
    if (!IncomingCallManager.instance) {
      IncomingCallManager.instance = new IncomingCallManager();
    }
    return IncomingCallManager.instance;
  }

  /**
   * Public method to check if CallKeep is currently supported and working
   * @returns true if CallKeep is initialized and working, false if using fallback
   */
  isCallKeepActive(): boolean {
    return this.isCallKeepSupported;
  }

  /**
   * Get information about incoming call strategy
   * @returns status message
   *
   * 🎯 NEW ARCHITECTURE UPDATE: Returns platform-specific strategy
   */
  getCallKeepStatus(): string {
    if (Platform.OS === 'android') {
      return 'Android: Using NativeIncomingCallModule (New Architecture compatible)';
    }

    if (this.isCallKeepSupported) {
      return 'iOS: CallKeep is active and working';
    }

    if (!Device.isDevice) {
      return 'iOS: CallKeep unavailable (simulator) - Using fallback notifications';
    }

    if (callKeepLoadFailed) {
      return `iOS: CallKeep unavailable - ${callKeepLoadError || 'Module load failed'}`;
    }

    return 'iOS: CallKeep unavailable - Using fallback notifications';
  }

  /**
   * Check if CallKeep is supported on this device (internal check)
   */
  private isCallKeepAvailable(): boolean {
    // 🚨 ANDROID FIX: Never use CallKeep on Android (using NativeIncomingCallModule instead)
    if (Platform.OS === 'android') {
      return false;
    }

    // CallKeep doesn't work on iOS simulator
    if (!Device.isDevice) {
      return false;
    }

    // Try to load CallKeep module
    const CallKeep = getCallKeep();
    return CallKeep !== null;
  }

  /**
   * Initialize IncomingCallManager
   * ✅ CRITICAL FIX: Added initialization lock to prevent concurrent initializations
   *
   * 🎯 NEW ARCHITECTURE STRATEGY:
   * - Android: Skip CallKeep, use NativeIncomingCallModule
   * - iOS: Use CallKeep (works fine with New Arch)
   */
  async initialize(): Promise<void> {
    // ✅ CRITICAL FIX: If initialization is in progress, wait for it
    if (this.initializationPromise) {
      console.log('📞 IncomingCallManager initialization already in progress, waiting...');
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      console.log('📞 IncomingCallManager already initialized');
      return;
    }

    console.log('📞 IncomingCallManager initializing...');

    // Create and store the initialization promise
    this.initializationPromise = (async () => {
      try {
      // 🎯 ANDROID: Skip CallKeep setup (using NativeIncomingCallModule instead)
      if (Platform.OS === 'android') {
        console.log('🤖 Android: Using NativeIncomingCallModule (New Architecture compatible)');
        console.log('   CallKeep will NOT be initialized on Android');
        console.log('   NativeIncomingCallModule handles incoming calls');

        this.isInitialized = true;
        this.isCallKeepSupported = false; // Not using CallKeep on Android
        return;
      }

      // 🍎 iOS: Check CallKeep availability and initialize
      console.log('🍎 iOS: Initializing CallKeep...');

      if (!this.isCallKeepAvailable()) {
        if (!Device.isDevice) {
          console.warn('⚠️ CallKeep not available (simulator/emulator)');
        } else if (callKeepLoadFailed) {
          console.warn('⚠️ CallKeep module failed to load due to compatibility issue');
          console.warn(`   Error: ${callKeepLoadError}`);
        } else {
          console.warn('⚠️ CallKeep not available on this device');
        }

        console.warn('📱 Falling back to standard push notifications');

        this.isInitialized = true;
        this.isCallKeepSupported = false;
        return;
      }

      const CallKeep = getCallKeep();
      if (!CallKeep) {
        console.warn('⚠️ CallKeep module not loaded - using fallback notifications');
        this.isInitialized = true;
        this.isCallKeepSupported = false;
        return;
      }

      // Configure CallKeep
      const config: CallKeepConfig = {
        ios: {
          appName: 'HopMed',
          imageName: 'CallKitIcon',
          supportsVideo: true,
          maximumCallGroups: 1,
          maximumCallsPerCallGroup: 1,
        },
        android: {
          alertTitle: 'Enable Native Call UI',
          alertDescription: 'Display incoming calls like regular phone calls for a better experience',
          cancelButton: 'Not Now',
          okButton: 'Enable',
          imageName: 'ic_launcher',
          additionalPermissions: [],
          selfManaged: false, // Use system-managed for better UX
        },
      };

      // 🚨 CRITICAL FIX: Verify setup method exists
      if (typeof CallKeep.setup !== 'function') {
        console.error('❌ CallKeep.setup is not a function!');

        // Track to Sentry
        try {
          const sentryTracker = SentryErrorTracker.getInstance();
          sentryTracker.trackServiceError(
            new Error('CallKeep.setup method not available'),
            {
              service: 'CallKeep',
              action: 'setup',
              additional: {
                issue: 'method_not_available',
                platform: Platform.OS,
                moduleState: {
                  callKeepExists: !!CallKeep,
                  callKeepType: typeof CallKeep,
                  setupType: typeof CallKeep.setup,
                  availableMethods: Object.keys(CallKeep).filter(key => typeof CallKeep[key] === 'function'),
                },
                reactNativeVersion: '0.79.5',
                callKeepVersion: '4.3.16',
              }
            }
          );
        } catch (sentryError) {
          console.warn('⚠️ Failed to send diagnostic info to Sentry:', sentryError);
        }

        throw new Error('CallKeep.setup method not available');
      }

      await CallKeep.setup(config);

      // Register event listeners
      this.registerEventListeners();

      // Check permissions - this determines if CallKeep is actually usable
      const hasPermissions = await this.checkAndRequestPermissions();

      this.isInitialized = true;
      
      if (hasPermissions) {
        this.isCallKeepSupported = true;
        console.log('✅ IncomingCallManager initialized successfully with CallKeep');
      } else {
        this.isCallKeepSupported = false;
        console.log('⚠️ IncomingCallManager initialized but CallKeep unavailable (permissions denied)');
        console.log('   Will use fallback notification system for incoming calls');
      }
      } catch (error) {
        console.error('❌ IncomingCallManager initialization failed:', error);
        console.warn('⚠️ This is expected on iOS simulator. Use a physical device for incoming calls.');
        this.isInitialized = true; // Mark as initialized to prevent repeated attempts
        this.isCallKeepSupported = false;
      } finally {
        // Clear the promise so subsequent calls can check isInitialized
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Register CallKeep event listeners
   */
  private registerEventListeners(): void {
    const CallKeep = getCallKeep();
    if (!CallKeep) return;

    console.log('📞 Registering CallKeep event listeners');

    // User answered the call
    CallKeep.addEventListener('answerCall', this.handleAnswerCall.bind(this));

    // User declined the call
    CallKeep.addEventListener('endCall', this.handleEndCall.bind(this));

    // User toggled mute
    CallKeep.addEventListener('didPerformSetMutedCallAction', this.handleMuteCall.bind(this));

    // Call timed out
    CallKeep.addEventListener('didDisplayIncomingCall', this.handleDidDisplayIncomingCall.bind(this));

    // Android specific - incoming call UI shown
    if (Platform.OS === 'android') {
      CallKeep.addEventListener('showIncomingCallUi', this.handleShowIncomingCallUi.bind(this));
      CallKeep.addEventListener('createIncomingConnectionFailed', this.handleCreateIncomingConnectionFailed.bind(this));
    }

    console.log('✅ CallKeep event listeners registered');
  }

  /**
   * ✅ ROBUST: Check and request CallKeep permissions with proper state management
   * Prevents repeated permission dialogs and handles user denial gracefully
   */
  private async checkAndRequestPermissions(): Promise<boolean> {
    const CallKeep = getCallKeep();
    if (!CallKeep) return false;

    try {
      // Load saved permission state
      await this.loadPermissionState();

      if (Platform.OS === 'android') {
        // Check actual permission status
        const hasPermission = await CallKeep.checkPhoneAccountPermission();

        if (hasPermission) {
          console.log('✅ Phone account permission already granted');
          this.permissionState = PermissionState.GRANTED;
          await this.savePermissionState();
          return true;
        }

        // If permission was permanently denied, don't ask again
        if (this.permissionState === PermissionState.PERMANENTLY_DENIED) {
          console.log('🚫 Phone account permission permanently denied by user');
          console.log('   Using fallback notification system');
          return false;
        }

        // If we've asked too many times, consider it permanently denied
        if (this.permissionRequestCount >= this.maxPermissionRequests) {
          console.log('🚫 Maximum permission requests reached, using fallback');
          this.permissionState = PermissionState.PERMANENTLY_DENIED;
          await this.savePermissionState();
          return false;
        }

        // Ask for permission (but only show explanation dialog first time)
        if (this.permissionState === PermissionState.NOT_REQUESTED) {
          // Show explanation to user before requesting
          const shouldRequest = await this.showPermissionExplanation();
          
          if (!shouldRequest) {
            console.log('👤 User declined permission explanation');
            this.permissionState = PermissionState.DENIED;
            this.permissionRequestCount++;
            await this.savePermissionState();
            return false;
          }
        }

        console.log(`📞 Requesting phone account permission (attempt ${this.permissionRequestCount + 1}/${this.maxPermissionRequests})`);
        this.permissionRequestCount++;
        
        // Request the permission
        await CallKeep.requestPhoneAccountPermission();

        // Check again after request
        const hasPermissionNow = await CallKeep.checkPhoneAccountPermission();
        
        if (hasPermissionNow) {
          console.log('✅ Phone account permission granted!');
          this.permissionState = PermissionState.GRANTED;
          this.permissionRequestCount = 0; // Reset count on success
        } else {
          console.log('❌ Phone account permission denied');
          this.permissionState = PermissionState.DENIED;
          
          // If denied twice, mark as permanently denied
          if (this.permissionRequestCount >= this.maxPermissionRequests) {
            this.permissionState = PermissionState.PERMANENTLY_DENIED;
          }
        }

        await this.savePermissionState();
        return hasPermissionNow;
      }

      // iOS doesn't need explicit permission for CallKit
      return true;
    } catch (error) {
      console.error('❌ Permission check failed:', error);
      return false;
    }
  }

  /**
   * Show a user-friendly explanation before requesting permission
   */
  private async showPermissionExplanation(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Enable Native Call UI',
        'HopMed can display incoming calls like regular phone calls. This provides a better calling experience.\n\nThis is optional - you can still receive calls through notifications.',
        [
          {
            text: 'Use Notifications',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Enable',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Load permission state from storage
   */
  private async loadPermissionState(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(PERMISSION_STATE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.permissionState = data.state || PermissionState.NOT_REQUESTED;
        this.permissionRequestCount = data.count || 0;
        console.log(`📱 Loaded permission state: ${this.permissionState} (requests: ${this.permissionRequestCount})`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load permission state:', error);
    }
  }

  /**
   * Save permission state to storage
   */
  private async savePermissionState(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        PERMISSION_STATE_KEY,
        JSON.stringify({
          state: this.permissionState,
          count: this.permissionRequestCount,
          lastUpdated: new Date().toISOString(),
        })
      );
      console.log(`💾 Saved permission state: ${this.permissionState}`);
    } catch (error) {
      console.warn('⚠️ Failed to save permission state:', error);
    }
  }

  /**
   * Reset permission state (useful for testing or if user wants to try again)
   */
  async resetPermissionState(): Promise<void> {
    this.permissionState = PermissionState.NOT_REQUESTED;
    this.permissionRequestCount = 0;
    await AsyncStorage.removeItem(PERMISSION_STATE_KEY);
    console.log('🔄 Permission state reset');
  }

  /**
   * ✅ PUBLIC: Allow user to manually enable CallKeep
   * Useful if they initially declined but now want to enable it
   */
  async requestCallKeepPermission(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const CallKeep = getCallKeep();
    if (!CallKeep) {
      console.warn('⚠️ CallKeep not available on this device');
      return false;
    }

    // Reset state to allow fresh request
    if (this.permissionState === PermissionState.PERMANENTLY_DENIED) {
      Alert.alert(
        'Enable in Settings',
        'You previously declined phone account permission. To enable native call UI, please grant permission in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }

    // Reset count if user is manually requesting
    this.permissionRequestCount = 0;
    await this.savePermissionState();

    // Request permission
    const hasPermission = await this.checkAndRequestPermissions();
    
    if (hasPermission) {
      this.isCallKeepSupported = true;
      console.log('✅ CallKeep enabled successfully');
    }

    return hasPermission;
  }

  /**
   * ✅ PUBLIC: Check if CallKeep permissions are granted
   */
  async hasCallKeepPermission(): Promise<boolean> {
    const CallKeep = getCallKeep();
    if (!CallKeep || Platform.OS !== 'android') {
      return false;
    }

    try {
      return await CallKeep.checkPhoneAccountPermission();
    } catch {
      return false;
    }
  }

  /**
   * Display incoming call UI
   * This is called when a push notification is received
   *
   * 🎯 NEW ARCHITECTURE STRATEGY:
   * - Android: Use custom NativeIncomingCallModule (New Arch compatible)
   * - iOS: Use CallKeep (works fine with New Arch on iOS)
   */
  async displayIncomingCall(callData: Omit<IncomingCallData, 'callUuid'>): Promise<string> {
    if (!this.isInitialized) {
      console.warn('⚠️ IncomingCallManager not initialized');
      await this.initialize();
    }

    // Generate unique call UUID
    const callUuid = uuidv4();

    const fullCallData: IncomingCallData = {
      ...callData,
      callUuid,
    };

    // Store call data
    this.activeCalls.set(callUuid, fullCallData);

    // 🎯 ANDROID: Use custom native module (New Architecture compatible)
    if (Platform.OS === 'android') {
      console.log('🤖 Android detected - using NativeIncomingCallModule');
      console.log(`📞 Displaying incoming call: ${callData.callerName} (${callData.callType})`);

      try {
        // Import IncomingCallActivityLauncher
        const IncomingCallActivityLauncher = require('./IncomingCallActivityLauncher').default;
        const launcher = IncomingCallActivityLauncher.getInstance();

        // Launch native incoming call activity
        await launcher.launchIncomingCallUI({
          callId: callUuid,
          callerId: fullCallData.callerId,
          callerName: fullCallData.callerName,
          callerType: fullCallData.callerType,
          callType: fullCallData.callType,
          roomUrl: fullCallData.roomUrl,
          metadata: fullCallData.metadata,
        });

        console.log('✅ Android incoming call UI launched successfully');
        return callUuid;
      } catch (error) {
        console.error('❌ Failed to launch Android incoming call UI:', error);

        // Clean up on error
        this.activeCalls.delete(callUuid);
        throw error;
      }
    }

    // 🍎 iOS: Use CallKeep (works fine with New Architecture on iOS)
    console.log('🍎 iOS detected - using CallKeep');

    const CallKeep = getCallKeep();
    if (!CallKeep) {
      this.activeCalls.delete(callUuid);
      throw new Error('CallKeep not available on iOS');
    }

    try {

      console.log(`📞 Displaying incoming call via CallKeep: ${callData.callerName} (${callData.callType})`);
      console.log(`📞 Call UUID: ${callUuid}`);

      // 🚨 CRITICAL FIX: Verify displayIncomingCall method exists before calling
      // This prevents "undefined is not a function" errors on Android
      if (typeof CallKeep.displayIncomingCall !== 'function') {
        console.error('❌ CallKeep.displayIncomingCall is not a function!');
        console.error('   This indicates the native module is not properly loaded.');

        // Track detailed architecture information to Sentry
        try {
          const sentryTracker = SentryErrorTracker.getInstance();

          // Gather comprehensive diagnostic data
          const diagnosticInfo: ErrorContext = {
            service: 'CallKeep',
            action: 'displayIncomingCall',
            deviceInfo: {
              isDevice: Device.isDevice,
              platform: Platform.OS,
              version: Platform.Version,
            },
            additional: {
              issue: 'method_not_available',
              platform: Platform.OS,
              moduleState: {
                callKeepExists: !!CallKeep,
                callKeepType: typeof CallKeep,
                displayIncomingCallType: typeof CallKeep.displayIncomingCall,
                availableMethods: Object.keys(CallKeep).filter(key => typeof CallKeep[key] === 'function'),
                setAvailableExists: typeof CallKeep.setAvailable === 'function',
                setupExists: typeof CallKeep.setup === 'function',
                endCallExists: typeof CallKeep.endCall === 'function',
              },
              nativeModuleInfo: {
                // Check if the underlying native module is loaded
                nativeModuleLoaded: callKeepLoadFailed,
                nativeModuleError: callKeepLoadError,
                isTurboModuleIssue: TURBO_MODULE_INTEROP_ISSUE,
                isNewArchEnabled: IS_NEW_ARCH_ENABLED,
              },
              reactNativeVersion: '0.79.5',
              callKeepVersion: '4.3.16',
              errorContext: 'Method undefined when attempting to display incoming call',
            }
          };

          sentryTracker.trackServiceError(
            new Error('CallKeep.displayIncomingCall method not available'),
            diagnosticInfo
          );

          console.error('📊 Diagnostic info sent to Sentry:', JSON.stringify(diagnosticInfo, null, 2));
        } catch (sentryError) {
          console.warn('⚠️ Failed to send diagnostic info to Sentry:', sentryError);
        }

        console.error('   Using fallback notification system instead.');
        throw new Error('CallKeep.displayIncomingCall method not available - native module not properly loaded');
      }

      // Display incoming call via CallKeep
      await CallKeep.displayIncomingCall(
        callUuid,
        fullCallData.callerName,
        fullCallData.callerName,
        'generic',
        fullCallData.callType === 'video'
      );

      // 🚨 CRITICAL: Immediately bring app to foreground
      // This is essential for showing the call UI, especially on Android
      // The backToForeground() call ensures the app launches if it's in background/killed
      try {
        if (typeof CallKeep.backToForeground === 'function') {
          CallKeep.backToForeground();
          console.log('✅ App brought to foreground for incoming call');
        } else {
          console.warn('⚠️ CallKeep.backToForeground method not available');
        }
      } catch (error) {
        console.warn('⚠️ Failed to bring app to foreground (may be expected on some devices):', error);
      }

      return callUuid;
    } catch (error) {
      console.error('❌ Failed to display incoming call via CallKeep (iOS):', error);

      // Clean up on error
      this.activeCalls.delete(callUuid);

      throw error;
    }
  }

  /**
   * Handle user answering the call
   * 🚨 CRITICAL FIX: Now launches app to foreground on Android
   */
  private async handleAnswerCall({ callUUID }: { callUUID: string }): Promise<void> {
    console.log(`📞 User answered call: ${callUUID}`);

    const callData = this.activeCalls.get(callUUID);
    if (!callData) {
      console.error(`❌ Call data not found for UUID: ${callUUID}`);
      return;
    }

    const CallKeep = getCallKeep();
    if (!CallKeep) return;

    try {
      // 🚨 CRITICAL FIX: Bring app to foreground BEFORE setting call active
      // This is essential for Android when app is in background/killed
      // Reference: https://github.com/react-native-webrtc/react-native-callkeep/issues/841
      console.log('📱 Bringing app to foreground...');

      if (typeof CallKeep.backToForeground === 'function') {
        CallKeep.backToForeground();
      } else {
        console.warn('⚠️ CallKeep.backToForeground not available');
      }

      // Small delay to ensure app comes to foreground before setting call active
      await new Promise(resolve => setTimeout(resolve, 300));

      // Update CallKeep state
      if (typeof CallKeep.setCurrentCallActive === 'function') {
        CallKeep.setCurrentCallActive(callUUID);
      } else {
        console.warn('⚠️ CallKeep.setCurrentCallActive not available');
      }

      // Notify callback (this will trigger navigation in useIncomingCall hook)
      if (this.onCallAnsweredCallback) {
        this.onCallAnsweredCallback(callData);
      }

      console.log(`✅ Call answered and app brought to foreground: ${callData.callerName}`);
    } catch (error) {
      console.error('❌ Error handling answer call:', error);
      
      // Even if CallKeep fails, still trigger callback for fallback navigation
      if (this.onCallAnsweredCallback) {
        this.onCallAnsweredCallback(callData);
      }
    }
  }

  /**
   * Handle user declining or ending the call
   */
  private async handleEndCall({ callUUID }: { callUUID: string }): Promise<void> {
    console.log(`📞 User ended call: ${callUUID}`);

    const callData = this.activeCalls.get(callUUID);
    if (!callData) {
      console.error(`❌ Call data not found for UUID: ${callUUID}`);
      return;
    }

    const CallKeep = getCallKeep();
    if (!CallKeep) return;

    try {
      // End the call
      if (typeof CallKeep.endCall === 'function') {
        CallKeep.endCall(callUUID);
      } else {
        console.warn('⚠️ CallKeep.endCall not available');
      }

      // Clean up
      this.activeCalls.delete(callUUID);

      // 🚨 CRITICAL: Mark as available again when no active calls
      if (Platform.OS === 'android' && this.activeCalls.size === 0) {
        try {
          if (typeof CallKeep.setAvailable === 'function') {
            CallKeep.setAvailable(true);
            console.log('✅ CallKeep set to available (call ended)');
          } else {
            console.warn('⚠️ CallKeep.setAvailable not available');
          }
        } catch (error) {
          console.warn('⚠️ Failed to set CallKeep available:', error);
        }
      }
      
      console.log(`✅ Call ended: ${callData.callerName}`);

      // Notify callback
      if (this.onCallDeclinedCallback) {
        this.onCallDeclinedCallback(callData);
      }
    } catch (error) {
      console.error('❌ Error handling end call:', error);
    }
  }

  /**
   * Handle mute action
   */
  private handleMuteCall({ muted, callUUID }: { muted: boolean; callUUID: string }): void {
    console.log(`🔇 Mute toggled for call ${callUUID}: ${muted}`);
  }

  /**
   * Handle when incoming call is displayed
   */
  private handleDidDisplayIncomingCall({ callUUID, error }: { callUUID: string; error?: string }): void {
    if (error) {
      console.error(`❌ Error displaying incoming call ${callUUID}:`, error);
    } else {
      console.log(`✅ Incoming call displayed: ${callUUID}`);
    }
  }

  /**
   * Android specific: Handle showing incoming call UI
   */
  private handleShowIncomingCallUi({ callUUID }: { callUUID: string }): void {
    const CallKeep = getCallKeep();
    if (!CallKeep) return;

    console.log(`📞 [Android] Showing incoming call UI: ${callUUID}`);
    
    try {
      if (typeof CallKeep.backToForeground === 'function') {
        CallKeep.backToForeground();
        console.log('✅ App brought to foreground for incoming call UI');
      } else {
        console.warn('⚠️ CallKeep.backToForeground not available');
      }
    } catch (error) {
      console.error('❌ Failed to bring app to foreground:', error);
    }
  }

  /**
   * Android specific: Handle connection failure
   */
  private handleCreateIncomingConnectionFailed({ callUUID }: { callUUID: string }): void {
    console.error(`❌ [Android] Failed to create incoming connection: ${callUUID}`);

    const callData = this.activeCalls.get(callUUID);
    if (callData) {
      // End the call
      this.endCall(callUUID);
    }
  }

  /**
   * Manually end a call (called from app code)
   */
  async endCall(callUuid: string): Promise<void> {
    const CallKeep = getCallKeep();
    if (!CallKeep) {
      console.warn('⚠️ Cannot end call - CallKeep not available');
      return;
    }

    console.log(`📞 Ending call: ${callUuid}`);

    try {
      if (typeof CallKeep.endCall === 'function') {
        CallKeep.endCall(callUuid);
      } else {
        console.warn('⚠️ CallKeep.endCall not available');
      }

      // Remove from active calls
      this.activeCalls.delete(callUuid);

      // 🚨 CRITICAL: Mark as available again when no active calls
      // This allows new incoming calls to be received
      // Reference: VideoSDK implementation pattern
      if (Platform.OS === 'android' && this.activeCalls.size === 0) {
        try {
          if (typeof CallKeep.setAvailable === 'function') {
            CallKeep.setAvailable(true);
            console.log('✅ CallKeep set to available (no active calls)');
          } else {
            console.warn('⚠️ CallKeep.setAvailable not available');
          }
        } catch (error) {
          console.warn('⚠️ Failed to set CallKeep available:', error);
        }
      }
      
      console.log(`✅ Call ended: ${callUuid}`);
    } catch (error) {
      console.error(`❌ Error ending call ${callUuid}:`, error);
    }
  }
  /**
   * Report call ended from Daily.co side
   */
  async reportCallEnded(callUuid: string, reason: number = 1): Promise<void> {
    const CallKeep = getCallKeep();
    if (!CallKeep) {
      console.warn('⚠️ Cannot report call ended - CallKeep not available');
      return;
    }

    console.log(`📞 Reporting call ended: ${callUuid}, reason: ${reason}`);

    try {
      if (typeof CallKeep.reportEndCallWithUUID === 'function') {
        CallKeep.reportEndCallWithUUID(callUuid, reason);
      } else {
        console.warn('⚠️ CallKeep.reportEndCallWithUUID not available');
      }
      this.activeCalls.delete(callUuid);
    } catch (error) {
      console.error(`❌ Error reporting call ended ${callUuid}:`, error);
    }
  }

  /**
   * Set call connected state
   */
  async setCallConnected(callUuid: string): Promise<void> {
    const CallKeep = getCallKeep();
    if (!CallKeep) {
      console.warn('⚠️ Cannot set call connected - CallKeep not available');
      return;
    }

    console.log(`📞 Setting call connected: ${callUuid}`);

    try {
      if (typeof CallKeep.setCurrentCallActive === 'function') {
        CallKeep.setCurrentCallActive(callUuid);
      } else {
        console.warn('⚠️ CallKeep.setCurrentCallActive not available');
      }
    } catch (error) {
      console.error(`❌ Error setting call connected ${callUuid}:`, error);
    }
  }

  /**
   * Register callback for when user answers call
   */
  onCallAnswered(callback: (callData: IncomingCallData) => void): void {
    this.onCallAnsweredCallback = callback;
  }

  /**
   * Register callback for when user declines call
   */
  onCallDeclined(callback: (callData: IncomingCallData) => void): void {
    this.onCallDeclinedCallback = callback;
  }

  /**
   * Get active call by UUID
   */
  getActiveCall(callUuid: string): IncomingCallData | undefined {
    return this.activeCalls.get(callUuid);
  }

  /**
   * Get all active calls
   */
  getActiveCalls(): IncomingCallData[] {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Check if there are active calls
   */
  hasActiveCalls(): boolean {
    return this.activeCalls.size > 0;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    console.log('🧹 IncomingCallManager destroying...');

    // End all active calls
    this.activeCalls.forEach((_, callUuid) => {
      this.endCall(callUuid);
    });

    // Clear callbacks
    this.onCallAnsweredCallback = null;
    this.onCallDeclinedCallback = null;

    this.isInitialized = false;
    IncomingCallManager.instance = null;

    console.log('✅ IncomingCallManager destroyed');
  }
}

export default IncomingCallManager;
export type { IncomingCallData, CallKeepConfig };
