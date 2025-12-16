import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert, Platform, AppState } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';

import AdvancedInitializationManager from '../services/advancedInitializationManager';
import CallStateManager from '../services/callStateManager';
import type { ChannelInfo } from '../services/channelService';
import DailyService from '../services/dailyService';
import NetworkMonitorService, { NetworkQuality } from '../services/networkMonitorService';
import ReconnectionManager from '../services/reconnectionManager';
import type { AppDispatch } from '../store';
import { RootState } from '../store';
import {
  checkCameraAndMicrophonePermissions,
  requestCameraAndMicrophonePermissions,
  selectCameraAndMicrophonePermission,
  selectIsPermissionSystemReady,
  handleAppStateChange,
} from '../store/slices/permissionSlice';
import { CallState, CallProvider } from '../types/callTypes';
import type { CallSession } from '../types/callTypes';
import { VideoCallProvider } from '../types/videoCallProvider'; // ✅ FIX: Add VideoCallProvider import

export interface VideoCallState {
  isCallActive: boolean;
  isConnecting: boolean;
  hasPermissions: boolean;
  error: string | null;
  currentChannelInfo: ChannelInfo | null;
  // Enhanced state
  sessionId: string | null;
  callState: CallState;
  currentProvider: CallProvider;
  networkQuality: NetworkQuality;
  reconnectionAttempts: number;
  isReconnecting: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  lastError: string | null;
  // Enhanced error handling
  errorHistory: { timestamp: number; error: string; provider: CallProvider }[];
  canRetryAfterError: boolean;
  isRecovering: boolean;
  permissionError: string | null;
}

// COMPLEX IMPLEMENTATION - COMMENTED OUT FOR DEMO PURPOSES
// This hook contains sophisticated fallback mechanisms, error recovery,
// network monitoring, and provider switching logic that is overengineered
// for a PoC/demo app. Use useSimpleVideoCall instead for lightweight demo.

export const useVideoCall = () => {
  const dispatch = useDispatch<AppDispatch>();
  const permissionState = useSelector(selectCameraAndMicrophonePermission);
  const isPermissionSystemReady = useSelector(selectIsPermissionSystemReady);

  const [state, setState] = useState<VideoCallState>({
    isCallActive: false,
    isConnecting: false,
    hasPermissions: false,
    error: null,
    currentChannelInfo: null,
    sessionId: null,
    callState: CallState.IDLE,
    currentProvider: CallProvider.DAILY,
    networkQuality: NetworkQuality.UNKNOWN,
    reconnectionAttempts: 0,
    isReconnecting: false,
    connectionQuality: 'unknown',
    lastError: null,
    errorHistory: [],
    canRetryAfterError: false,
    isRecovering: false,
    permissionError: null,
  });

  // Concurrent permission check protection
  const permissionCheckRef = useRef<Promise<boolean> | null>(null);
  const lastPermissionCheckRef = useRef<number>(0);
  const componentMountedRef = useRef(true);

  const callStateManager = CallStateManager;
  const networkMonitor = NetworkMonitorService;
  const reconnectionManager = ReconnectionManager;
  const initManager = AdvancedInitializationManager;

  // Sync permission state from Redux store
  const hasPermissions = useMemo(() => {
    return permissionState.status === 'granted';
  }, [permissionState.status]);

  useEffect(() => {
    setState(prev => ({
      ...prev,
      hasPermissions,
      permissionError: permissionState.error || null,
    }));
  }, [hasPermissions, permissionState.error]);

  useEffect(() => {
    componentMountedRef.current = true;

    // Initialize permissions if system is ready
    if (isPermissionSystemReady) {
      checkPermissions();
    }

    const cleanupMonitoring = setupMonitoring();
    const cleanupAppState = setupAppStateMonitoring();

    return () => {
      componentMountedRef.current = false;
      cleanupMonitoring();
      cleanupAppState();
      cleanup();
    };
  }, [isPermissionSystemReady]);

  const setupMonitoring = () => {
    // Monitor network changes
    const unsubscribeNetwork = networkMonitor.addListener(networkState => {
      setState(prev => ({
        ...prev,
        networkQuality: networkState.quality,
      }));

      // Handle network disconnection during active calls
      if (!networkState.isConnected && state.isCallActive) {
        handleNetworkDisconnection();
      }
    });

    // Monitor call state changes
    const unsubscribeCallState = callStateManager.addListener((session: CallSession) => {
      if (session.sessionId === state.sessionId) {
        updateStateFromSession(session);
      }
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeCallState();
    };
  };

  const updateStateFromSession = (session: CallSession) => {
    setState(prev => ({
      ...prev,
      callState: session.state,
      currentProvider: session.currentProvider,
      reconnectionAttempts: session.reconnectionAttempts,
      isReconnecting: session.state === CallState.RECONNECTING,
      isConnecting:
        session.state === CallState.CONNECTING || session.state === CallState.SWITCHING_PROVIDER,
      isCallActive: session.state === CallState.CONNECTED,
      currentChannelInfo: session.channelInfo,
      connectionQuality: session.qualityMetrics.networkQuality as any,
      lastError:
        session.qualityMetrics.disconnectionCount > 0 ? 'Connection issues detected' : null,
      canRetryAfterError: session.state === CallState.FAILED,
      isRecovering:
        session.state === CallState.RECONNECTING || session.state === CallState.SWITCHING_PROVIDER,
    }));
  };

  const handleNetworkDisconnection = () => {
    if (state.sessionId) {
      const error = new Error('Network disconnected');
      logError(error, 'network');
      callStateManager
        .handleRuntimeError(state.sessionId, error, 'network')
        .catch(err => console.error('Error handling network disconnection:', err));
    }
  };

  const logError = (error: Error, context: string = 'unknown') => {
    const errorEntry = {
      timestamp: Date.now(),
      error: error.message,
      provider: state.currentProvider,
    };

    setState(prev => ({
      ...prev,
      errorHistory: [...prev.errorHistory.slice(-9), errorEntry], // Keep last 10 errors
      lastError: error.message,
    }));

    console.error(`Video call error [${context}]:`, error);
  };

  const clearErrors = () => {
    setState(prev => ({
      ...prev,
      error: null,
      lastError: null,
      permissionError: null,
      canRetryAfterError: false,
    }));
  };

  const cleanup = async () => {
    console.log('🧹 Starting video call hook cleanup...');

    try {
      if (state.sessionId) {
        console.log('🧹 Ending active call session...');
        await callStateManager.endCall(state.sessionId);
      }

      // Clean up initialization manager resources
      await initManager.cleanup('daily_engine');

      // Force cleanup of Daily service to ensure no lingering resources
      await DailyService.destroy().catch(err => console.warn('Daily cleanup warning:', err));

      console.log('🧹 Video call hook cleanup completed');
    } catch (error) {
      console.error('🧹 Error during cleanup:', error);
    }
  };

  // Force cleanup method for emergency situations
  const forceCleanup = useCallback(async () => {
    console.log('🚨 Force cleaning up video call resources...');

    try {
      // Force stop any active session
      if (state.sessionId) {
        await callStateManager.endCall(state.sessionId);
      }

      // Emergency cleanup of initialization manager
      await initManager.emergencyCleanup();

      // Force cleanup Daily service
      await DailyService.forceCleanup().catch(() => {});

      // Reset local state
      setState(prev => ({
        ...prev,
        isCallActive: false,
        isConnecting: false,
        isReconnecting: false,
        isRecovering: false,
        sessionId: null,
        currentChannelInfo: null,
        callState: CallState.IDLE,
        reconnectionAttempts: 0,
        error: null,
        lastError: null,
        canRetryAfterError: false,
      }));

      console.log('🚨 Force cleanup completed');
    } catch (error) {
      console.error('🚨 Error during force cleanup:', error);
    }
  }, [state.sessionId]);

  // App state monitoring for permission revalidation
  const setupAppStateMonitoring = () => {
    const handleAppStateChange = (nextAppState: string) => {
      dispatch(handleAppStateChange(nextAppState));
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  };

  // Optimized permission checking with proper caching and concurrency protection
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    if (!componentMountedRef.current) {
      console.log('🔐 Component unmounted, skipping permission check');
      return false;
    }

    // Prevent concurrent permission checks
    if (permissionCheckRef.current) {
      console.log('🔐 Permission check already in progress, waiting...');
      try {
        return await permissionCheckRef.current;
      } catch (error) {
        console.warn('🔐 Concurrent permission check failed:', error);
        return false;
      }
    }

    // Rate limiting: Don't check permissions too frequently
    const now = Date.now();
    const timeSinceLastCheck = now - lastPermissionCheckRef.current;
    const MIN_CHECK_INTERVAL = 2000; // 2 seconds

    if (timeSinceLastCheck < MIN_CHECK_INTERVAL && permissionState.status !== 'unknown') {
      console.log('🔐 Permission check rate limited, using cached result');
      return permissionState.status === 'granted';
    }

    // Create promise for this permission check with timeout protection
    const checkPromise = Promise.race([
      performPermissionCheck(now),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Permission check timeout')), 10000)
      ),
    ]).finally(() => {
      permissionCheckRef.current = null;
    });

    permissionCheckRef.current = checkPromise;
    return checkPromise;
  }, [dispatch, permissionState.status]);

  // Extract permission check logic to reduce callback complexity
  const performPermissionCheck = async (timestamp: number): Promise<boolean> => {
    try {
      console.log('🔐 Checking camera and microphone permissions...');
      lastPermissionCheckRef.current = timestamp;

      // Use Redux action for centralized permission management
      const result = await dispatch(checkCameraAndMicrophonePermissions()).unwrap();

      if (!componentMountedRef.current) {
        return false;
      }

      const hasPermissions = result.status === 'granted';
      console.log(`🔐 Permission check result: ${hasPermissions ? 'granted' : 'denied'}`);

      return hasPermissions;
    } catch (error) {
      console.error('🔐 Permission check failed:', error);

      if (componentMountedRef.current) {
        const errorMsg = getPermissionErrorMessage(error);
        setState(prev => ({
          ...prev,
          hasPermissions: false,
          permissionError: errorMsg,
          error: errorMsg,
        }));
      }

      return false;
    }
  };

  // Enhanced error message generation
  const getPermissionErrorMessage = (error: any): string => {
    if (typeof error === 'string') {
      if (error.includes('denied')) {
        return Platform.OS === 'ios'
          ? 'Camera and microphone access denied. Go to Settings > Privacy > Camera/Microphone to enable.'
          : 'Camera and microphone access denied. Go to Settings > Apps > HopMed > Permissions to enable.';
      }
      if (error.includes('undetermined')) {
        return 'Camera and microphone permissions are required for video calls.';
      }
    }

    return 'Unable to access camera or microphone. Please check device settings and try again.';
  };

  // Enhanced permission request with user guidance
  const requestPermissionsWithGuidance = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔐 Requesting camera and microphone permissions...');

      const result = await dispatch(requestCameraAndMicrophonePermissions()).unwrap();
      const granted = result.status === 'granted';

      if (!granted) {
        const message = result.canAskAgain
          ? 'Camera and microphone access is required for video calls. Please grant permissions.'
          : Platform.OS === 'ios'
            ? 'Permissions were denied. Please enable Camera and Microphone in Settings > Privacy.'
            : 'Permissions were denied. Please enable Camera and Microphone in Settings > Apps > HopMed > Permissions.';

        Alert.alert(
          'Permissions Required',
          message,
          result.canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    // This would open device settings - implementation depends on requirements
                    console.log('🔐 User should open device settings');
                  },
                },
              ]
        );
      }

      return granted;
    } catch (error) {
      console.error('🔐 Permission request failed:', error);
      Alert.alert(
        'Permission Error',
        'Failed to request permissions. Please try again or check device settings.'
      );
      return false;
    }
  }, [dispatch]);

  const startCall = useCallback(
    async (channelName: string, token?: string, audioOnly: boolean = false) => {
      // Check permissions first, request if needed
      if (!hasPermissions) {
        console.log('🔐 Permissions not granted, requesting...');
        const granted = await requestPermissionsWithGuidance();
        if (!granted) {
          return false;
        }
      }

      if (state.isConnecting) {
        console.log('Call already in progress');
        return false;
      }

      setState(prev => ({ ...prev, isConnecting: true, error: null }));

      try {
        clearErrors();

        // Use safe initialization to prevent race conditions
        const callObject = await initManager.safeInitialize(
          'daily_engine',
          () => DailyService.initializeEngine(),
          {
            timeout: 15000,
            maxRetries: 2,
            retryDelay: 2000,
          }
        );

        if (!callObject) {
          throw new Error('Failed to initialize video call engine - SDK may not be available');
        }

        console.log(`Starting ${audioOnly ? 'audio' : 'video'} call on channel: ${channelName}`);

        // Create room URL from channel name
        const channelInfo = await DailyService.createRoom(channelName);
        await DailyService.joinRoom(channelInfo.roomUrl || channelInfo.channelName); // ✅ FIX: Use roomUrl from ChannelInfo

        if (audioOnly) {
          await DailyService.setLocalVideo(false);
        }

        setState(prev => ({
          ...prev,
          isCallActive: true,
          isConnecting: false,
        }));

        return true;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
        logError(errorObj, 'call_start');

        const isSDKError =
          errorObj.message.toLowerCase().includes('sdk') ||
          errorObj.message.toLowerCase().includes('engine') ||
          errorObj.message.toLowerCase().includes('initialization') ||
          errorObj.message.toLowerCase().includes('timeout');

        const isTimeoutError = errorObj.message.toLowerCase().includes('timeout');

        let errorMessage: string;
        if (isTimeoutError) {
          errorMessage =
            'Video call setup is taking too long. Please check your connection and try again.';
        } else if (isSDKError) {
          errorMessage =
            'Video calling is not available on this device. Please try audio-only calls.';
        } else {
          errorMessage = `Failed to start ${audioOnly ? 'audio' : 'video'} call: ${errorObj.message}`;
        }

        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: errorMessage,
          canRetryAfterError: !isSDKError || isTimeoutError,
        }));

        Alert.alert(
          'Call Failed',
          errorMessage + (isSDKError && !isTimeoutError ? '' : ' Please try again.')
        );
        return false;
      }
    },
    [hasPermissions, state.isConnecting, requestPermissionsWithGuidance]
  );

  const startAudioCall = useCallback(
    async (channelName: string, token?: string) => {
      return startCall(channelName, token, true);
    },
    [startCall]
  );

  const endCall = useCallback(async () => {
    try {
      await DailyService.leaveRoom();
      setState(prev => ({
        ...prev,
        isCallActive: false,
        isConnecting: false,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to end call:', error);
      setState(prev => ({ ...prev, error: 'Failed to end call properly' }));
    }
  }, []);

  const generateChannelName = useCallback((appointmentId?: string | number) => {
    if (!appointmentId) {
      return `hopmed_test_${Date.now()}`;
    }
    return `hopmed_call_${appointmentId}`;
  }, []);

  // Enhanced consultation methods with automatic fallback
  const startConsultation = useCallback(
    async (
      doctorId: string,
      customerId: string,
      callType: 'audio' | 'video' = 'video',
      preferredProvider: CallProvider = CallProvider.DAILY
    ) => {
      // Enhanced permission check with automatic request
      if (!hasPermissions) {
        console.log('🔐 Consultation requires permissions, requesting...');
        const granted = await requestPermissionsWithGuidance();
        if (!granted) {
          return false;
        }
      }

      if (state.isConnecting || state.isCallActive) {
        console.log('Call already in progress');
        return false;
      }

      try {
        // Create managed call session
        const sessionId = callStateManager.createSession(
          {
            channelName: `consultation_${doctorId}_${customerId}`,
            participants: { doctorId, customerId },
            callType,
            roomUrl: '',
            callId: `${Date.now()}_${doctorId}_${customerId}`, // ✅ FIX: Add missing callId
            provider: VideoCallProvider.DAILY, // ✅ FIX: Use DAILY directly for demo stability
          },
          preferredProvider,
          { originalPreference: preferredProvider }
        );

        setState(prev => ({
          ...prev,
          sessionId,
          isConnecting: true,
          error: null,
          callState: CallState.CONNECTING,
          currentProvider: preferredProvider,
        }));

        console.log(
          `Starting ${callType} consultation between Dr.${doctorId} and Patient ${customerId}`
        );

        // Start the call through the call state manager
        const success = await callStateManager.startCall(sessionId, 0);

        if (!success) {
          setState(prev => ({
            ...prev,
            isConnecting: false,
            error: 'Failed to start consultation',
          }));
          return false;
        }

        return true;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
        logError(errorObj, 'consultation_start');

        const isProviderError =
          errorObj.message.toLowerCase().includes('provider') ||
          errorObj.message.toLowerCase().includes('sdk') ||
          errorObj.message.toLowerCase().includes('initialization');

        const errorMessage = isProviderError
          ? 'Video calling service is currently unavailable. Please try again later.'
          : `Failed to start consultation: ${errorObj.message}`;

        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: errorMessage,
          lastError: errorObj.message,
          canRetryAfterError: !isProviderError,
        }));

        Alert.alert(
          'Consultation Failed',
          errorMessage + (isProviderError ? '' : ' Would you like to try again?')
        );
        return false;
      }
    },
    [hasPermissions, state.isConnecting, state.isCallActive, requestPermissionsWithGuidance]
  );

  const joinConsultation = useCallback(
    async (
      doctorId: string,
      customerId: string,
      callType: 'audio' | 'video' = 'video',
      preferredProvider: CallProvider = CallProvider.DAILY
    ) => {
      // For joining, we use the same logic as starting
      return startConsultation(doctorId, customerId, callType, preferredProvider);
    },
    [startConsultation]
  );

  const endConsultation = useCallback(async () => {
    if (!state.sessionId) {
      console.warn('No active session to end');
      return;
    }

    try {
      await callStateManager.endCall(state.sessionId);
      setState(prev => ({
        ...prev,
        isCallActive: false,
        isConnecting: false,
        isReconnecting: false,
        error: null,
        currentChannelInfo: null,
        sessionId: null,
        callState: CallState.ENDED,
        reconnectionAttempts: 0,
      }));
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      logError(errorObj, 'consultation_end');
      setState(prev => ({
        ...prev,
        error: 'Failed to end consultation properly',
        lastError: errorObj.message,
      }));
    }
  }, [state.sessionId]);

  // Manual retry for failed connections
  const retryConnection = useCallback(async () => {
    if (!state.sessionId) {
      console.warn('No session to retry');
      return false;
    }

    try {
      setState(prev => ({ ...prev, error: null, isConnecting: true }));
      const success = await callStateManager.startCall(state.sessionId, 0);

      if (!success) {
        setState(prev => ({ ...prev, error: 'Retry failed', isConnecting: false }));
      }

      return success;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      logError(errorObj, 'retry_connection');
      setState(prev => ({
        ...prev,
        error: 'Retry failed',
        isConnecting: false,
        lastError: errorObj.message,
        canRetryAfterError: false,
      }));
      return false;
    }
  }, [state.sessionId]);

  // Force provider switch
  const switchProvider = useCallback(async () => {
    if (!state.sessionId) {
      console.warn('No session to switch providers');
      return false;
    }

    try {
      // Trigger a manual provider switch by reporting a connection error
      await callStateManager.handleRuntimeError(
        state.sessionId,
        new Error('Manual provider switch requested'),
        'connection'
      );
      return true;
    } catch (error) {
      console.error('Provider switch failed:', error);
      return false;
    }
  }, [state.sessionId]);

  // Get detailed connection info
  const getConnectionInfo = useCallback(() => {
    if (!state.sessionId) return null;

    const session = callStateManager.getSession(state.sessionId);
    return session
      ? {
          provider: session.currentProvider,
          state: session.state,
          quality: session.qualityMetrics,
          duration: Date.now() - session.startTime,
          reconnectionAttempts: session.reconnectionAttempts,
          providerSwitches: session.providerSwitchAttempts,
        }
      : null;
  }, [state.sessionId]);

  // Check if network is suitable for calls
  const isNetworkSuitable = useCallback((forVideo: boolean = true) => {
    return forVideo ? networkMonitor.isVideoCallViable() : networkMonitor.isAudioCallViable();
  }, []);

  return {
    ...state,
    // Override hasPermissions with Redux state for consistency
    hasPermissions,
    // Legacy methods (deprecated but kept for compatibility)
    startCall,
    startAudioCall,
    endCall,
    generateChannelName,
    checkPermissions,
    // Enhanced consultation methods with automatic fallback
    startConsultation,
    joinConsultation,
    endConsultation,
    // Enhanced permission methods
    requestPermissionsWithGuidance,
    // New reliability methods
    retryConnection,
    switchProvider,
    getConnectionInfo,
    isNetworkSuitable,
    // Error handling methods
    clearErrors,
    // Enhanced state utilities
    isReconnecting: state.isReconnecting,
    canRetry: state.callState === CallState.FAILED || state.canRetryAfterError,
    canSwitchProvider: state.sessionId !== null,
    currentProvider: state.currentProvider,
    reconnectionAttempts: state.reconnectionAttempts,
    hasErrors: !!(state.error || state.lastError || state.permissionError),
    errorCount: state.errorHistory.length,
    // Permission system state
    permissionStatus: permissionState.status,
    isCheckingPermissions: permissionState.isChecking,
    canAskPermissions: permissionState.canAskAgain !== false,
    permissionSystemReady: isPermissionSystemReady,
  };
};

export default useVideoCall;
