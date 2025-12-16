/**
 * ✅ OFFICIAL DAILY.CO CONTEXT PATTERN
 *
 * Based on official Daily.co examples:
 * - Uses React Context + useReducer for centralized state management
 * - Follows the exact pattern from Daily.co video chat and audio-only examples
 * - Implements proper event handling and cleanup patterns
 * - Provides hooks for accessing call object and meeting state
 */

import type {
  DailyCall,
  DailyEvent,
  DailyEventObject,
  DailyParticipant,
} from '@daily-co/react-native-daily-js';
import Daily from '@daily-co/react-native-daily-js';
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
} from 'react';

// ✅ OFFICIAL PATTERN: Direct import following Daily.co official example

// ✅ OFFICIAL PATTERN: State interface following Daily.co examples
export interface DailyCallState {
  callObject: DailyCall | null;
  meetingState: string | null;
  participants: { [id: string]: DailyParticipant };
  activeSpeakerId: string | null;
  camOrMicError: string | null;
  fatalError: string | null;
  isLoading: boolean;
}

// ✅ OFFICIAL PATTERN: Action types following Daily.co examples
export type DailyCallAction =
  | { type: 'SET_CALL_OBJECT'; callObject: DailyCall | null }
  | { type: 'SET_MEETING_STATE'; meetingState: string }
  | { type: 'PARTICIPANTS_CHANGE'; participants: { [id: string]: DailyParticipant } }
  | { type: 'ACTIVE_SPEAKER_CHANGE'; activeSpeakerId: string | null }
  | { type: 'CAM_OR_MIC_ERROR'; message: string }
  | { type: 'FATAL_ERROR'; message: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'RESET_STATE' };

// ✅ OFFICIAL PATTERN: Initial state following Daily.co examples
const initialState: DailyCallState = {
  callObject: null,
  meetingState: null,
  participants: {},
  activeSpeakerId: null,
  camOrMicError: null,
  fatalError: null,
  isLoading: false,
};

// ✅ OFFICIAL PATTERN: Reducer following Daily.co examples
function callReducer(state: DailyCallState, action: DailyCallAction): DailyCallState {
  switch (action.type) {
    case 'SET_CALL_OBJECT':
      return { ...state, callObject: action.callObject };
    case 'SET_MEETING_STATE':
      return { ...state, meetingState: action.meetingState };
    case 'PARTICIPANTS_CHANGE':
      return { ...state, participants: action.participants };
    case 'ACTIVE_SPEAKER_CHANGE':
      return { ...state, activeSpeakerId: action.activeSpeakerId };
    case 'CAM_OR_MIC_ERROR':
      return { ...state, camOrMicError: action.message };
    case 'FATAL_ERROR':
      return { ...state, fatalError: action.message };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

// ✅ OFFICIAL PATTERN: Context interface following Daily.co examples
interface DailyCallContextType {
  callState: DailyCallState;
  createCallObject: () => Promise<DailyCall | null>;
  destroyCallObject: () => Promise<void>;
}

const DailyCallContext = createContext<DailyCallContextType | undefined>(undefined);

// ✅ OFFICIAL PATTERN: Provider component following Daily.co examples
export const DailyCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callState, dispatch] = useReducer(callReducer, initialState);
  const isSDKAvailable = useRef<boolean | null>(null);
  const eventListenersSetup = useRef(false);

  // ✅ OFFICIAL PATTERN: Simplified SDK availability check
  const checkSDKAvailability = useCallback(async (): Promise<boolean> => {
    if (isSDKAvailable.current !== null) {
      return isSDKAvailable.current;
    }

    try {
      // Simple check - if we can import Daily, we're good
      isSDKAvailable.current = !!Daily;
      return isSDKAvailable.current;
    } catch (error) {
      console.warn('Daily.co SDK availability check failed:', error);
      isSDKAvailable.current = false;
      return false;
    }
  }, []);

  // ✅ OFFICIAL PATTERN: Event handling following Daily.co examples
  const setupEventListeners = useCallback((callObject: DailyCall) => {
    if (eventListenersSetup.current) return;

    const logDailyEvent = (event: any) => {
      console.log(`Daily Event: ${event.action || 'unknown'}`, event);
    };

    // Meeting state events
    const handleMeetingState = (event?: DailyEventObject) => {
      event && logDailyEvent(event);
      const meetingState = callObject.meetingState();
      dispatch({ type: 'SET_MEETING_STATE', meetingState });
    };

    // ✅ RACE CONDITION FIX: Enhanced participant change handler with track state debugging
    const handleParticipantsChange = (event?: any) => {
      event && logDailyEvent(event);
      const participants = callObject.participants();

      // CRITICAL: Log track state changes for debugging
      Object.values(participants).forEach(participant => {
        if (participant.tracks.video) {
          console.log(`🎥 Participant ${participant.session_id.slice(-6)} video track:`, {
            state: participant.tracks.video.state,
            hasTrack: !!participant.tracks.video.track,
            hasPersistentTrack: !!participant.tracks.video.persistentTrack,
            trackReadyState: participant.tracks.video.track?.readyState,
            persistentTrackReadyState: participant.tracks.video.persistentTrack?.readyState,
          });
        }
      });

      dispatch({ type: 'PARTICIPANTS_CHANGE', participants });
    };

    // Active speaker events
    const handleActiveSpeakerChange = (event?: any) => {
      event && logDailyEvent(event);
      dispatch({
        type: 'ACTIVE_SPEAKER_CHANGE',
        activeSpeakerId: event?.activeSpeaker?.peerId || null,
      });
    };

    // Error events
    const handleCameraErrorEvent = (event?: any) => {
      event && logDailyEvent(event);
      dispatch({
        type: 'CAM_OR_MIC_ERROR',
        message: event?.errorMsg?.errorMsg || 'Camera/Microphone error',
      });
    };

    const handleFatalErrorEvent = (event?: any) => {
      event && logDailyEvent(event);
      dispatch({
        type: 'FATAL_ERROR',
        message: event?.errorMsg || 'Fatal error occurred',
      });
    };

    // ✅ RACE CONDITION FIX: Enhanced event listener setup for better track state tracking
    const events: DailyEvent[] = [
      'loading',
      'loaded',
      'load-attempt-failed',
      'joining-meeting',
      'joined-meeting',
      'left-meeting',
      'participant-joined',
      'participant-updated',
      'participant-left',
      'active-speaker-change',
      'camera-error',
      'error',
      // CRITICAL: Add track-specific events for better state tracking
      'track-started',
      'track-stopped',
      'track-ended',
    ];

    // Set up meeting state listeners
    const meetingStateEvents: DailyEvent[] = [
      'loading',
      'loaded',
      'load-attempt-failed',
      'joining-meeting',
      'joined-meeting',
      'left-meeting',
      'error',
    ];

    meetingStateEvents.forEach(event => {
      callObject.on(event, handleMeetingState);
    });

    // ✅ OFFICIAL PATTERN: Complete participant events per Daily.co documentation
    const participantEvents: DailyEvent[] = [
      'joined-meeting',
      'participant-joined',
      'participant-updated',
      'participant-left',
      'track-started', // Critical for remote video detection
      'track-stopped', // Important for track cleanup
      'waiting-participant-added',
      'waiting-participant-updated',
      'waiting-participant-removed',
    ];

    participantEvents.forEach(event => {
      callObject.on(event, handleParticipantsChange);
    });

    // Set up other event listeners
    callObject.on('active-speaker-change', handleActiveSpeakerChange);
    callObject.on('camera-error', handleCameraErrorEvent);
    callObject.on('error', handleFatalErrorEvent);

    // ✅ OFFICIAL PATTERN: Proper initial state handling per Daily.co docs
    handleMeetingState();
    handleParticipantsChange(); // Ensure participants are captured immediately

    eventListenersSetup.current = true;

    // Return cleanup function
    return () => {
      meetingStateEvents.forEach(event => {
        callObject.off(event, handleMeetingState);
      });

      participantEvents.forEach(event => {
        callObject.off(event, handleParticipantsChange);
      });

      callObject.off('active-speaker-change', handleActiveSpeakerChange);
      callObject.off('camera-error', handleCameraErrorEvent);
      callObject.off('error', handleFatalErrorEvent);

      eventListenersSetup.current = false;
    };
  }, []);

  // ✅ OFFICIAL PATTERN: Simplified call object creation following Daily.co examples
  const createCallObject = useCallback(async (): Promise<DailyCall | null> => {
    // Don't create if already exists
    if (callState.callObject) {
      return callState.callObject;
    }

    // Check SDK availability
    const isAvailable = await checkSDKAvailability();
    if (!isAvailable) {
      dispatch({
        type: 'FATAL_ERROR',
        message: 'Daily.co SDK not available. Please use a development build.',
      });
      return null;
    }

    try {
      dispatch({ type: 'SET_LOADING', isLoading: true });

      // ✅ OFFICIAL PATTERN: Simple call object creation like official example
      const callObject = Daily.createCallObject();
      if (!callObject) {
        throw new Error('Failed to create Daily call object');
      }

      // Set up event listeners
      const cleanup = setupEventListeners(callObject);

      dispatch({ type: 'SET_CALL_OBJECT', callObject });
      dispatch({ type: 'SET_LOADING', isLoading: false });

      // Store cleanup function
      (callObject as any)._cleanup = cleanup;

      console.log('✅ Daily call object created successfully');
      return callObject;
    } catch (error) {
      console.error('❌ Failed to create Daily call object:', error);
      dispatch({
        type: 'FATAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      dispatch({ type: 'SET_LOADING', isLoading: false });
      return null;
    }
  }, [callState.callObject, checkSDKAvailability, setupEventListeners]);

  // ✅ OFFICIAL PATTERN: Destroy call object following Daily.co examples
  const destroyCallObject = useCallback(async (): Promise<void> => {
    if (!callState.callObject) return;

    try {
      // Call cleanup function if it exists
      const cleanup = (callState.callObject as any)._cleanup;
      if (cleanup) {
        cleanup();
      }

      await callState.callObject.destroy();
      dispatch({ type: 'RESET_STATE' });

      console.log('✅ Daily call object destroyed successfully');
    } catch (error) {
      console.error('❌ Failed to destroy Daily call object:', error);
      // Reset state anyway
      dispatch({ type: 'RESET_STATE' });
    }
  }, [callState.callObject]);

  // ✅ OFFICIAL PATTERN: Cleanup on unmount following Daily.co examples
  useEffect(() => {
    return () => {
      if (callState.callObject) {
        destroyCallObject();
      }
    };
  }, []);

  const contextValue: DailyCallContextType = {
    callState,
    createCallObject,
    destroyCallObject,
  };

  return <DailyCallContext.Provider value={contextValue}>{children}</DailyCallContext.Provider>;
};

// ✅ OFFICIAL PATTERN: useCallObject hook following Daily.co examples
export const useCallObject = (): DailyCall | null => {
  const context = useContext(DailyCallContext);
  if (!context) {
    throw new Error('useCallObject must be used within a DailyCallProvider');
  }
  return context.callState.callObject;
};

// ✅ OFFICIAL PATTERN: useMeetingState hook following Daily.co examples
export const useMeetingState = (): string | null => {
  const context = useContext(DailyCallContext);
  if (!context) {
    throw new Error('useMeetingState must be used within a DailyCallProvider');
  }
  return context.callState.meetingState;
};

// ✅ OFFICIAL PATTERN: useParticipants hook following Daily.co examples
export const useParticipants = (): { [id: string]: DailyParticipant } => {
  const context = useContext(DailyCallContext);
  if (!context) {
    throw new Error('useParticipants must be used within a DailyCallProvider');
  }
  return context.callState.participants;
};

// ✅ OFFICIAL PATTERN: useActiveSpeaker hook following Daily.co examples
export const useActiveSpeaker = (): string | null => {
  const context = useContext(DailyCallContext);
  if (!context) {
    throw new Error('useActiveSpeaker must be used within a DailyCallProvider');
  }
  return context.callState.activeSpeakerId;
};

// ✅ OFFICIAL PATTERN: Main context hook following Daily.co examples
export const useDailyCall = (): DailyCallContextType => {
  const context = useContext(DailyCallContext);
  if (!context) {
    throw new Error('useDailyCall must be used within a DailyCallProvider');
  }
  return context;
};

// ✅ OFFICIAL PATTERN: Error state hooks following Daily.co examples
export const useCallErrors = (): { camOrMicError: string | null; fatalError: string | null } => {
  const context = useContext(DailyCallContext);
  if (!context) {
    throw new Error('useCallErrors must be used within a DailyCallProvider');
  }
  return {
    camOrMicError: context.callState.camOrMicError,
    fatalError: context.callState.fatalError,
  };
};
