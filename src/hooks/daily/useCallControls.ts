import type { DailyCall } from '@daily-co/react-native-daily-js';
import { useCallback, useEffect, useState } from 'react';

import { useCallObject } from './useCallObject';

/**
 * ✅ OFFICIAL PATTERN: Simplified stream states following Daily.co official Tray component
 */
function getCallStates(callObject: DailyCall | null) {
  let isCameraMuted = false;
  let isMicMuted = false;
  let isScreenShareOff = false;

  if (callObject && callObject.participants() && callObject.participants().local) {
    const localParticipant = callObject.participants().local;
    // ✅ OFFICIAL PATTERN: Use callObject methods directly like official example
    isCameraMuted = !callObject.localVideo();
    isMicMuted = !callObject.localAudio();
    isScreenShareOff = ['blocked', 'off'].includes(localParticipant.tracks.screenVideo.state);
  }

  return [isCameraMuted, isMicMuted, isScreenShareOff] as const;
}

/**
 * Hook to manage Daily.co call controls (mute/unmute, screen share)
 * Based on official Daily.co React Native example patterns
 */
export const useCallControls = () => {
  const callObject = useCallObject();
  const [isCameraMuted, setCameraMuted] = useState(false);
  const [isMicMuted, setMicMuted] = useState(false);
  const [isScreenShareOff, setScreenShareOff] = useState(false);

  const toggleCamera = useCallback(() => {
    callObject?.setLocalVideo(isCameraMuted);
  }, [callObject, isCameraMuted]);

  const toggleMic = useCallback(() => {
    callObject?.setLocalAudio(isMicMuted);
  }, [callObject, isMicMuted]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenShareOff) {
      callObject?.startScreenShare();
    } else {
      callObject?.stopScreenShare();
    }
  }, [callObject, isScreenShareOff]);

  /**
   * Start listening for participant changes when callObject is set
   * This will capture any changes to audio/video mute state
   */
  useEffect(() => {
    if (!callObject) {
      return;
    }

    const handleParticipantUpdate = () => {
      const [cameraMuted, micMuted, screenShareOff] = getCallStates(callObject);
      setCameraMuted(cameraMuted);
      setMicMuted(micMuted);
      setScreenShareOff(screenShareOff);
    };

    // Use initial state
    handleParticipantUpdate();

    // Listen for changes in state
    callObject.on('participant-updated', handleParticipantUpdate);

    // Stop listening for changes in state
    return function cleanup() {
      callObject.off('participant-updated', handleParticipantUpdate);
    };
  }, [callObject]);

  return {
    isCameraMuted,
    isMicMuted,
    isScreenShareOff,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
  };
};
