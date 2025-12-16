/**
 * useIncomingCall Hook
 *
 * React hook for handling incoming calls in components
 * Provides easy access to IncomingCallManager and PushNotificationService
 *
 * Usage:
 * ```tsx
 * const { incomingCall, answerCall, declineCall } = useIncomingCall({
 *   onCallAnswered: (callData) => {
 *     // Navigate to call screen and join Daily.co room
 *     navigation.navigate('CallScreen', { roomUrl: callData.roomUrl });
 *   },
 *   onCallDeclined: (callData) => {
 *     // Log declined call
 *     console.log('User declined call from:', callData.callerName);
 *   }
 * });
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

import IncomingCallManager, { type IncomingCallData } from '../services/IncomingCallManager';
import NotifeeNotificationService, { type PushTokenData } from '../services/NotifeeNotificationService';
import CallNavigationManager from '../services/CallNavigationManager';
import { VIDEO_CALL_CONFIG } from '../config/videoCallConfig';
import { SentryErrorTracker } from '../utils/sentryErrorTracker';

/**
 * Safe navigation hook that doesn't throw if navigation isn't available yet
 */
const useSafeNavigation = () => {
  try {
    return useNavigation();
  } catch (error) {
    console.warn('⚠️ Navigation not available yet');
    return null;
  }
};

interface UseIncomingCallOptions {
  onCallAnswered?: (callData: IncomingCallData) => void;
  onCallDeclined?: (callData: IncomingCallData) => void;
  onTokenUpdate?: (tokenData: PushTokenData) => void;
  autoNavigateOnAnswer?: boolean; // Automatically navigate to call screen when answered
}

interface UseIncomingCallReturn {
  incomingCall: IncomingCallData | null;
  hasIncomingCall: boolean;
  answerCall: (callUuid: string) => Promise<void>;
  declineCall: (callUuid: string) => Promise<void>;
  sendTestCall: () => Promise<void>;
  pushToken: PushTokenData | null;
  isInitialized: boolean;
}

export function useIncomingCall(options: UseIncomingCallOptions = {}): UseIncomingCallReturn {
  const {
    onCallAnswered,
    onCallDeclined,
    onTokenUpdate,
    autoNavigateOnAnswer = true,
  } = options;

  const navigation = useSafeNavigation();

  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [pushToken, setPushToken] = useState<PushTokenData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Initialize managers
   * CRITICAL FIX: Set up token update callback BEFORE initializing service
   * to prevent race condition where token is retrieved before callback is registered
   */
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        console.log('🎯 useIncomingCall: Initializing...');

        // Initialize IncomingCallManager (only once)
        const callManager = IncomingCallManager.getInstance();
        await callManager.initialize();

        // Initialize NotifeeNotificationService (only once)
        const pushService = NotifeeNotificationService.getInstance();
        await pushService.initialize();

        if (isMounted) {
          setIsInitialized(true);
          console.log('✅ useIncomingCall: Initialized successfully');
        }
      } catch (error) {
        console.error('❌ useIncomingCall: Initialization failed:', error);
        SentryErrorTracker.getInstance().trackServiceError(error as Error, {
          service: 'useIncomingCall',
          action: 'initialization',
        });
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []); // ✅ CRITICAL FIX: Run only once on mount

  /**
   * ✅ CRITICAL FIX: Register token callback separately
   * This allows callback to update without re-initializing services
   */
  useEffect(() => {
    const pushService = NotifeeNotificationService.getInstance();
    
    // Set up push token callback
    pushService.onTokenUpdate((tokenData: PushTokenData) => {
      console.log('🎯 useIncomingCall: Push token updated:', tokenData.type);
      setPushToken(tokenData);

      // Notify custom callback
      if (onTokenUpdate) {
        onTokenUpdate(tokenData);
      }
    });
  }, [onTokenUpdate]);

  /**
   * Setup call event handlers
   * NOTE: Navigation is now handled by IncomingCallProvider for reliability
   * This hook only tracks state and notifies custom callbacks
   */
  useEffect(() => {
    // NOTE: IncomingCallManager callbacks are now registered in IncomingCallProvider
    // for guaranteed navigation. This hook only tracks local state.
    
    // Register custom callbacks if provided
    if (onCallAnswered || onCallDeclined) {
      const callManager = IncomingCallManager.getInstance();
      
      if (onCallAnswered) {
        callManager.onCallAnswered(onCallAnswered);
      }
      
      if (onCallDeclined) {
        callManager.onCallDeclined(onCallDeclined);
      }
    }
  }, [onCallAnswered, onCallDeclined]);

  /**
   * Auto-navigate to appropriate screen when call is answered
   */
  const handleAutoNavigation = useCallback((callData: IncomingCallData) => {
    if (!navigation) {
      console.warn('⚠️ useIncomingCall: Navigation not available yet, skipping auto-navigation');
      return;
    }

    console.log('🎯 useIncomingCall: Auto-navigating to call screen');

    try {
      // Register call session with navigation manager
      CallNavigationManager.getInstance().startCallSession(
        callData.callType,
        callData.callerType === 'doctor' ? 'DoctorDetails' : 'CustomerDetails',
        callData.metadata || {},
        callData.callerName,
        callData.callerType,
        callData.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL
      );

      // Navigate to appropriate details screen with restoreCall flag
      if (callData.callerType === 'doctor') {
        navigation.navigate('DoctorDetails' as never, {
          doctor: callData.metadata?.doctor || {
            id: callData.callerId,
            firstName: callData.callerName.split(' ')[0],
            lastName: callData.callerName.split(' ')[1] || '',
          },
          restoreCall: true,
          incomingCallData: callData,
        } as never);
      } else {
        navigation.navigate('CustomerDetails' as never, {
          customer: callData.metadata?.customer || {
            id: callData.callerId,
            firstName: callData.callerName.split(' ')[0],
            lastName: callData.callerName.split(' ')[1] || '',
          },
          restoreCall: true,
          incomingCallData: callData,
        } as never);
      }

      console.log('✅ useIncomingCall: Navigation successful');
    } catch (error) {
      console.error('❌ useIncomingCall: Navigation failed:', error);
    }
  }, [navigation]);

  /**
   * Answer a call
   */
  const answerCall = useCallback(async (callUuid: string) => {
    console.log('🎯 useIncomingCall: Answering call:', callUuid);

    try {
      const callManager = IncomingCallManager.getInstance();
      await callManager.setCallConnected(callUuid);

      const callData = callManager.getActiveCall(callUuid);
      if (callData) {
        setIncomingCall(callData);
      }

      console.log('✅ useIncomingCall: Call answered successfully');
    } catch (error) {
      console.error('❌ useIncomingCall: Failed to answer call:', error);
      SentryErrorTracker.getInstance().trackServiceError(error as Error, {
        service: 'useIncomingCall',
        action: 'answer_call',
        additional: { callUuid },
      });
    }
  }, []);

  /**
   * Decline a call
   */
  const declineCall = useCallback(async (callUuid: string) => {
    console.log('🎯 useIncomingCall: Declining call:', callUuid);

    try {
      const callManager = IncomingCallManager.getInstance();
      await callManager.endCall(callUuid);

      setIncomingCall(null);

      console.log('✅ useIncomingCall: Call declined successfully');
    } catch (error) {
      console.error('❌ useIncomingCall: Failed to decline call:', error);
      SentryErrorTracker.getInstance().trackServiceError(error as Error, {
        service: 'useIncomingCall',
        action: 'decline_call',
        additional: { callUuid },
      });
    }
  }, []);

  /**
   * Send test incoming call (for development/testing)
   */
  const sendTestCall = useCallback(async () => {
    console.log('🧪 useIncomingCall: Sending test call...');

    try {
      const pushService = NotifeeNotificationService.getInstance();
      await pushService.sendTestIncomingCall();

      console.log('✅ useIncomingCall: Test call sent');
    } catch (error) {
      console.error('❌ useIncomingCall: Failed to send test call:', error);
    }
  }, []);

  return {
    incomingCall,
    hasIncomingCall: incomingCall !== null,
    answerCall,
    declineCall,
    sendTestCall,
    pushToken,
    isInitialized,
  };
}

export default useIncomingCall;
