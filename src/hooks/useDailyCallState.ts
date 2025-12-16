/**
 * ✅ OFFICIAL DAILY.CO HOOKS PATTERN
 *
 * Additional hooks following Daily.co official examples for:
 * - Call state management
 * - Stream state tracking
 * - Network quality monitoring
 * - Participant filtering
 */

import type { DailyCall, DailyParticipant } from '@daily-co/react-native-daily-js';
import { useMemo, useState, useEffect, useCallback } from 'react';

import {
  useCallObject,
  useParticipants,
  useMeetingState,
  useDailyCall,
} from '../contexts/DailyCallContext';

// ✅ OFFICIAL PATTERN: Stream state management following Daily.co official Tray component
export function useLocalStreamState(): {
  isCameraMuted: boolean;
  isMicMuted: boolean;
  toggleCamera: () => void;
  toggleMic: () => void;
} {
  const callObject = useCallObject();
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // ✅ OFFICIAL PATTERN: Simplified stream states following official Tray component
  const getStreamStates = useCallback((call: DailyCall | null) => {
    if (!call?.participants().local) {
      return [false, false];
    }

    // ✅ OFFICIAL PATTERN: Use callObject methods directly like official example
    const cameraMuted = !call.localVideo();
    const micMuted = !call.localAudio();
    return [cameraMuted, micMuted];
  }, []);

  // ✅ OFFICIAL PATTERN: Update stream states on participant changes
  useEffect(() => {
    if (!callObject) return;

    const updateStreamStates = () => {
      const [cameraMuted, micMuted] = getStreamStates(callObject);
      setIsCameraMuted(cameraMuted);
      setIsMicMuted(micMuted);
    };

    // Initial state
    updateStreamStates();

    // Listen for changes
    callObject.on('participant-updated', updateStreamStates);

    return () => {
      callObject.off('participant-updated', updateStreamStates);
    };
  }, [callObject, getStreamStates]);

  const toggleCamera = useCallback(() => {
    if (!callObject) return;

    try {
      callObject.setLocalVideo(!isCameraMuted);
    } catch (error) {
      console.error('Failed to toggle camera:', error);
    }
  }, [callObject, isCameraMuted]);

  const toggleMic = useCallback(() => {
    if (!callObject) return;

    try {
      callObject.setLocalAudio(!isMicMuted);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  }, [callObject, isMicMuted]);

  return {
    isCameraMuted,
    isMicMuted,
    toggleCamera,
    toggleMic,
  };
}

// ✅ CRITICAL FIX: Simple participant filtering following working reference pattern
export function useParticipantFilters() {
  const participants = useParticipants();
  const callObject = useCallObject();

  return useMemo(() => {
    // ✅ CRITICAL DEBUG: Check both sources of participants
    console.log('🔍 useParticipantFilters Debug:', {
      contextParticipants: Object.keys(participants),
      contextParticipantsCount: Object.keys(participants).length,
      callObjectParticipants: callObject
        ? Object.keys(callObject.participants())
        : 'no call object',
      callObjectParticipantsCount: callObject ? Object.keys(callObject.participants()).length : 0,
    });

    // ✅ FALLBACK: Use call object participants if context is empty
    let participantArray = Object.values(participants);

    if (participantArray.length === 0 && callObject) {
      console.log('⚠️ Context participants empty, using call object participants');
      participantArray = Object.values(callObject.participants());
    }

    const localParticipant = participantArray.find(p => p.local) ?? null;
    const remoteParticipants = participantArray.filter(p => !p.local);

    // ✅ SIMPLIFIED: No complex fallback logic - trust the context state

    // ✅ CRITICAL DEBUG: Enhanced debugging for video track issues
    const debugInfo = {
      participantsObjectKeys: Object.keys(participants),
      participantArrayLength: participantArray.length,
      localFound: !!localParticipant,
      remoteCount: remoteParticipants.length,
      localParticipantDetails: localParticipant
        ? {
            session_id: localParticipant.session_id,
            user_name: localParticipant.user_name,
            videoState: localParticipant.tracks.video.state,
            hasVideoTrack: !!localParticipant.tracks.video.track,
            hasPersistentTrack: !!localParticipant.tracks.video.persistentTrack,
            videoTrackPlayable: localParticipant.tracks.video.state === 'playable',
            videoTrackId: localParticipant.tracks.video.track?.id,
            persistentTrackId: localParticipant.tracks.video.persistentTrack?.id,
            cameraEnabled: localParticipant.video,
            micEnabled: localParticipant.audio,
          }
        : null,
      remoteParticipantDetails: remoteParticipants.map(p => ({
        session_id: p.session_id,
        user_name: p.user_name,
        videoState: p.tracks.video.state,
        hasVideoTrack: !!p.tracks.video.track,
        hasPersistentTrack: !!p.tracks.video.persistentTrack,
        videoTrackPlayable: p.tracks.video.state === 'playable',
        // ✅ KEY INSIGHT: Check both track and persistentTrack like reference
        videoTrackId: p.tracks.video.track?.id,
        persistentTrackId: p.tracks.video.persistentTrack?.id,
        cameraEnabled: p.video,
        micEnabled: p.audio,
      })),
    };

    return {
      localParticipant,
      remoteParticipants,
      allParticipants: participantArray,
      participantCount: participantArray.length,
      remoteParticipantCount: remoteParticipants.length,
      debugInfo,
    };
  }, [participants]);
}

// ✅ OFFICIAL PATTERN: Network quality monitoring following Daily.co examples
export function useNetworkQuality(): {
  quality: 'excellent' | 'good' | 'poor' | 'unknown';
  threshold: string | null;
} {
  const callObject = useCallObject();
  const [quality, setQuality] = useState<'excellent' | 'good' | 'poor' | 'unknown'>('unknown');
  const [threshold, setThreshold] = useState<string | null>(null);

  useEffect(() => {
    if (!callObject) return;

    const handleNetworkQualityChange = (event: any) => {
      const newThreshold = event.threshold;
      setThreshold(newThreshold);

      // Map Daily.co thresholds to our quality levels
      switch (newThreshold) {
        case 'good':
          setQuality('excellent');
          break;
        case 'low':
          setQuality('good');
          break;
        case 'very-low':
          setQuality('poor');
          break;
        default:
          setQuality('unknown');
      }
    };

    callObject.on('network-quality-change', handleNetworkQualityChange);

    return () => {
      callObject.off('network-quality-change', handleNetworkQualityChange);
    };
  }, [callObject]);

  return { quality, threshold };
}

// ✅ OFFICIAL PATTERN: Call state utilities following Daily.co examples
export function useCallState() {
  const meetingState = useMeetingState();
  const callObject = useCallObject();
  const { participantCount } = useParticipantFilters();
  const { quality } = useNetworkQuality();

  return useMemo(() => {
    const isLoading = meetingState === 'loading';
    const isJoining = meetingState === 'joining-meeting';
    const isJoined = meetingState === 'joined-meeting';
    const isLeft = meetingState === 'left-meeting';
    const hasError = meetingState === 'error';

    const isConnected = isJoined;
    const isConnecting = isLoading || isJoining;
    const isDisconnected = isLeft || hasError || !callObject;

    return {
      meetingState,
      isLoading,
      isJoining,
      isJoined,
      isLeft,
      hasError,
      isConnected,
      isConnecting,
      isDisconnected,
      participantCount,
      networkQuality: quality,
    };
  }, [meetingState, callObject, participantCount, quality]);
}

// ✅ OFFICIAL PATTERN: Room management following Daily.co examples
export function useRoomManagement() {
  const callObject = useCallObject();
  const { createCallObject, destroyCallObject } = useDailyCall();

  const joinRoom = useCallback(
    async (roomUrl: string, options?: any) => {
      try {
        // Ensure we have a call object created with listeners attached BEFORE join
        const activeCall = callObject ?? (await createCallObject());
        if (!activeCall) {
          console.error('Call object not available (failed to create)');
          return;
        }

        console.log('🎥 Joining room with options:', options);
        await activeCall.join({ url: roomUrl, ...options });

        // ✅ OFFICIAL PATTERN: Daily.co automatically handles track subscriptions
        console.log('✅ Successfully joined room');
      } catch (error) {
        console.error('Failed to join room:', error);
        throw error;
      }
    },
    [callObject, createCallObject]
  );

  const leaveRoom = useCallback(async () => {
    try {
      const activeCall = callObject;
      if (!activeCall) return;
      await activeCall.leave();
    } catch (error) {
      console.error('Failed to leave room:', error);
      throw error;
    }
  }, [callObject]);

  const preAuth = useCallback(
    async (roomUrl: string) => {
      if (!callObject) return;

      try {
        await callObject.preAuth({ url: roomUrl });
      } catch (error) {
        console.error('Failed to pre-auth:', error);
        throw error;
      }
    },
    [callObject]
  );

  return {
    joinRoom,
    leaveRoom,
    preAuth,
    createCallObject,
    destroyCallObject,
  };
}

// ✅ OFFICIAL PATTERN: Media device management following Daily.co examples
export function useMediaDevices() {
  const callObject = useCallObject();
  const [devices, setDevices] = useState<any>(null);

  useEffect(() => {
    if (!callObject) return;

    const updateDevices = async () => {
      try {
        const inputDevices = callObject.getInputDevices();
        setDevices(inputDevices);
      } catch (error) {
        console.error('Failed to get input devices:', error);
      }
    };

    updateDevices();

    // Listen for device changes
    callObject.on('available-devices-updated', updateDevices);

    return () => {
      callObject.off('available-devices-updated', updateDevices);
    };
  }, [callObject]);

  const cycleCamera = useCallback(async () => {
    if (!callObject) return;

    try {
      await callObject.cycleCamera();
    } catch (error) {
      console.error('Failed to cycle camera:', error);
    }
  }, [callObject]);

  const setInputDevices = useCallback(
    async (deviceConfig: any) => {
      if (!callObject) return;

      try {
        // ✅ CORRECT: Use setCamera and setAudioDevice instead of deprecated setInputDevices
        if (deviceConfig.camera) {
          await callObject.setCamera(deviceConfig.camera);
        }
        if (deviceConfig.speaker) {
          await callObject.setAudioDevice(deviceConfig.speaker);
        }
      } catch (error) {
        console.error('Failed to set input devices:', error);
      }
    },
    [callObject]
  );

  return {
    devices,
    cycleCamera,
    setInputDevices,
  };
}

// ✅ OFFICIAL PATTERN: Track subscription management per Daily.co documentation
export function useRemoteTrackSubscription() {
  const callObject = useCallObject();
  const participants = useParticipants();

  const ensureAllSubscriptions = useCallback(async () => {
    if (!callObject) return;

    try {
      // Official pattern: Use updateParticipant() method as per Daily.co docs
      const participantArray = Object.values(participants);
      const remoteParticipants = participantArray.filter(p => !p.local);

      for (const participant of remoteParticipants) {
        try {
          // Official method: updateParticipant() with setSubscribedTracks
          await callObject.updateParticipant(participant.session_id, {
            setSubscribedTracks: {
              video: true,
              audio: true,
            },
          });

          console.log(
            `✅ Ensured track subscription for remote participant: ${participant.session_id}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to ensure subscription for participant ${participant.session_id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error('❌ Failed to ensure track subscriptions:', error);
    }
  }, [callObject, participants]);

  return {
    ensureAllSubscriptions,
  };
}
