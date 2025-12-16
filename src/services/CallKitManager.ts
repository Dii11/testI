/**
 * CallKitManager - iOS CallKit Integration
 *
 * Provides native iOS calling experience with:
 * - System call UI
 * - Lock screen controls
 * - Background VoIP support
 * - Call history integration
 *
 * Requirements:
 * - Install: npm install react-native-callkeep
 * - Add capabilities in Xcode: Background Modes > Voice over IP
 * - Add privacy keys in Info.plist: NSMicrophoneUsageDescription
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { SentryErrorTracker } from '../utils/sentryErrorTracker';

// ✅ CRITICAL FIX: Lazy load RNCallKeep to prevent NativeEventEmitter crash on simulator
// CallKeep native module doesn't exist on iOS simulator, causing:
// "Invariant Violation: new NativeEventEmitter() requires a non-null argument"
let RNCallKeep: any = null;

interface CallKitOptions {
  appName: string;
  imageName?: string;
  ringtoneSound?: string;
  includesCallsInRecents: boolean;
  supportsVideo: boolean;
}

interface ActiveCall {
  callUUID: string;
  roomUrl: string;
  contactName: string;
  callType: 'audio' | 'video';
  isOutgoing: boolean;
  startTime: number;
  onAnswer?: () => void;
  onEnd?: () => void;
}

class CallKitManager {
  private static instance: CallKitManager | null = null;
  private isInitialized = false;
  private activeCalls: Map<string, ActiveCall> = new Map();
  private options: CallKitOptions = {
    appName: 'HopMed',
    imageName: 'logo',
    ringtoneSound: 'ringtone.mp3',
    includesCallsInRecents: true,
    supportsVideo: true,
  };

  private constructor() {}

  static getInstance(): CallKitManager {
    if (!CallKitManager.instance) {
      CallKitManager.instance = new CallKitManager();
    }
    return CallKitManager.instance;
  }

  /**
   * Initialize CallKit (iOS only)
   * Must be called early in app lifecycle
   */
  public async initialize(customOptions?: Partial<CallKitOptions>): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.log('📱 CallKit: Not iOS, skipping initialization');
      return false;
    }

    // ✅ CRITICAL FIX: Check if running on physical device
    // CallKit doesn't work properly on iOS simulator
    if (!Device.isDevice) {
      console.warn('⚠️ CallKit: Simulator detected - CallKit requires a physical device');
      console.warn('⚠️ CallKit: Using fallback mode (no native call UI)');
      this.isInitialized = false; // Mark as not initialized so fallbacks are used
      return false;
    }

    if (this.isInitialized) {
      console.log('📱 CallKit: Already initialized');
      return true;
    }

    try {
      console.log('📱 CallKit: Initializing on physical device...');

      // ✅ CRITICAL FIX: Lazy load RNCallKeep only on physical devices
      if (!RNCallKeep) {
        try {
          RNCallKeep = require('react-native-callkeep').default;
          console.log('✅ CallKit: Native module loaded successfully');
        } catch (error) {
          console.error('❌ CallKit: Failed to load native module:', error);
          console.warn('⚠️ CallKit: Using fallback mode (no native call UI)');
          return false;
        }
      }

      // Merge custom options
      if (customOptions) {
        this.options = { ...this.options, ...customOptions };
      }

      // Setup CallKit
      await RNCallKeep.setup({
        ios: {
          appName: this.options.appName,
          imageName: this.options.imageName,
          ringtoneSound: this.options.ringtoneSound,
          includesCallsInRecents: this.options.includesCallsInRecents,
          supportsVideo: this.options.supportsVideo,
        },
        android: {
          // Android config handled by ForegroundServiceManager
          alertTitle: 'Permissions Required',
          alertDescription: 'This app needs to access your phone calling accounts',
          cancelButton: 'Cancel',
          okButton: 'OK',
        },
      });

      // Register event listeners
      this.registerEventListeners();

      this.isInitialized = true;
      console.log('✅ CallKit: Initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ CallKit: Initialization failed:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'CallKitManager',
        action: 'initialize',
      });
      return false;
    }
  }

  /**
   * Register CallKit event listeners
   */
  private registerEventListeners(): void {
    // ✅ CRITICAL FIX: Guard against calling RNCallKeep if not loaded
    if (!RNCallKeep) {
      console.warn('⚠️ CallKit: Cannot register event listeners - module not loaded');
      return;
    }

    // Answer call (user answered via system UI)
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
      console.log('📱 CallKit: User answered call:', callUUID);
      const call = this.activeCalls.get(callUUID);
      if (call?.onAnswer) {
        call.onAnswer();
      }
    });

    // End call (user ended via system UI)
    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
      console.log('📱 CallKit: User ended call:', callUUID);
      this.endCall(callUUID);
    });

    // Mute/unmute
    RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ muted, callUUID }) => {
      console.log(`📱 CallKit: Mute toggled to ${muted} for call:`, callUUID);
      // This will be handled by the call interface
    });

    // Hold/unhold
    RNCallKeep.addEventListener('didToggleHoldCallAction', ({ hold, callUUID }) => {
      console.log(`📱 CallKit: Hold toggled to ${hold} for call:`, callUUID);
      // This will be handled by the call interface
    });

    // Call audio activated
    RNCallKeep.addEventListener('didActivateAudioSession', () => {
      console.log('📱 CallKit: Audio session activated');
    });

    // Call audio deactivated
    RNCallKeep.addEventListener('didDeactivateAudioSession', () => {
      console.log('📱 CallKit: Audio session deactivated');
    });
  }

  /**
   * Start an outgoing call
   */
  public async startOutgoingCall(
    callUUID: string,
    contactName: string,
    roomUrl: string,
    callType: 'audio' | 'video' = 'video',
    onAnswer?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    if (Platform.OS !== 'ios' || !this.isInitialized) {
      console.log('📱 CallKit: Not available, using fallback');
      // Fallback: immediately trigger onAnswer for non-iOS
      onAnswer?.();
      return;
    }

    try {
      console.log('📱 CallKit: Starting outgoing call:', contactName);

      // Display outgoing call UI
      await RNCallKeep.startCall(callUUID, contactName, contactName, callType, callType === 'video');

      // Store call info
      this.activeCalls.set(callUUID, {
        callUUID,
        roomUrl,
        contactName,
        callType,
        isOutgoing: true,
        startTime: Date.now(),
        onAnswer,
        onEnd,
      });

      // Mark as connected (outgoing calls connect immediately)
      setTimeout(() => {
        RNCallKeep.reportConnectedOutgoingCallWithUUID(callUUID);
        onAnswer?.();
      }, 500);

    } catch (error) {
      console.error('❌ CallKit: Failed to start outgoing call:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'CallKitManager',
        action: 'startOutgoingCall',
        callUUID,
      });
      // Fallback: trigger onAnswer anyway
      onAnswer?.();
    }
  }

  /**
   * Display incoming call
   */
  public async displayIncomingCall(
    callUUID: string,
    contactName: string,
    roomUrl: string,
    callType: 'audio' | 'video' = 'video',
    onAnswer?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    if (Platform.OS !== 'ios' || !this.isInitialized) {
      console.log('📱 CallKit: Not available, using fallback');
      // Fallback: immediately trigger onAnswer for non-iOS
      onAnswer?.();
      return;
    }

    try {
      console.log('📱 CallKit: Displaying incoming call:', contactName);

      // Display incoming call UI
      await RNCallKeep.displayIncomingCall(
        callUUID,
        contactName,
        contactName,
        callType,
        callType === 'video'
      );

      // Store call info
      this.activeCalls.set(callUUID, {
        callUUID,
        roomUrl,
        contactName,
        callType,
        isOutgoing: false,
        startTime: Date.now(),
        onAnswer,
        onEnd,
      });

    } catch (error) {
      console.error('❌ CallKit: Failed to display incoming call:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'CallKitManager',
        action: 'displayIncomingCall',
        callUUID,
      });
      // Fallback: trigger onAnswer anyway
      onAnswer?.();
    }
  }

  /**
   * End a call
   */
  public async endCall(callUUID: string): Promise<void> {
    const call = this.activeCalls.get(callUUID);
    if (!call) {
      console.warn('📱 CallKit: Call not found:', callUUID);
      return;
    }

    try {
      console.log('📱 CallKit: Ending call:', callUUID);

      if (Platform.OS === 'ios' && this.isInitialized) {
        await RNCallKeep.endCall(callUUID);
      }

      // Trigger onEnd callback
      call.onEnd?.();

      // Remove from active calls
      this.activeCalls.delete(callUUID);

    } catch (error) {
      console.error('❌ CallKit: Failed to end call:', error);
      // Still remove from active calls and trigger callback
      call.onEnd?.();
      this.activeCalls.delete(callUUID);
    }
  }

  /**
   * Report call connected (for incoming calls)
   */
  public reportCallConnected(callUUID: string): void {
    if (Platform.OS !== 'ios' || !this.isInitialized) return;

    try {
      RNCallKeep.reportConnectingOutgoingCallWithUUID(callUUID);
      setTimeout(() => {
        RNCallKeep.reportConnectedOutgoingCallWithUUID(callUUID);
      }, 100);
    } catch (error) {
      console.warn('📱 CallKit: Failed to report connected:', error);
    }
  }

  /**
   * Update call display name
   */
  public updateCall(callUUID: string, contactName: string): void {
    if (Platform.OS !== 'ios' || !this.isInitialized) return;

    try {
      RNCallKeep.updateDisplay(callUUID, contactName, contactName);
    } catch (error) {
      console.warn('📱 CallKit: Failed to update call:', error);
    }
  }

  /**
   * Set call as held
   */
  public setCallHeld(callUUID: string, held: boolean): void {
    if (Platform.OS !== 'ios' || !this.isInitialized) return;

    try {
      RNCallKeep.setOnHold(callUUID, held);
    } catch (error) {
      console.warn('📱 CallKit: Failed to set hold:', error);
    }
  }

  /**
   * Set call muted
   */
  public setCallMuted(callUUID: string, muted: boolean): void {
    if (Platform.OS !== 'ios' || !this.isInitialized) return;

    try {
      RNCallKeep.setMutedCall(callUUID, muted);
    } catch (error) {
      console.warn('📱 CallKit: Failed to set mute:', error);
    }
  }

  /**
   * Check if call is active
   */
  public hasActiveCall(callUUID?: string): boolean {
    if (callUUID) {
      return this.activeCalls.has(callUUID);
    }
    return this.activeCalls.size > 0;
  }

  /**
   * Get active call info
   */
  public getActiveCall(callUUID: string): ActiveCall | undefined {
    return this.activeCalls.get(callUUID);
  }

  /**
   * Get all active calls
   */
  public getActiveCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Check permissions
   */
  public async checkPermissions(): Promise<boolean> {
    if (Platform.OS !== 'ios') return true;

    try {
      const hasPermissions = await RNCallKeep.checkPhoneAccountEnabled();
      return hasPermissions;
    } catch (error) {
      console.warn('📱 CallKit: Permission check failed:', error);
      return false;
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    console.log('🧹 CallKit: Destroying...');

    // End all active calls
    this.activeCalls.forEach((call) => {
      this.endCall(call.callUUID);
    });

    // Remove event listeners (only if RNCallKeep is loaded)
    if (RNCallKeep) {
      RNCallKeep.removeEventListener('answerCall');
      RNCallKeep.removeEventListener('endCall');
      RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
      RNCallKeep.removeEventListener('didToggleHoldCallAction');
      RNCallKeep.removeEventListener('didActivateAudioSession');
      RNCallKeep.removeEventListener('didDeactivateAudioSession');
    }

    this.activeCalls.clear();
    this.isInitialized = false;
    CallKitManager.instance = null;

    console.log('✅ CallKit: Destroyed');
  }
}

export default CallKitManager;
export type { CallKitOptions, ActiveCall };
