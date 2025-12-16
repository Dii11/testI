import { useCallback, useEffect, useState } from 'react';

import { useCallObject } from './useCallObject';
import { useOfficialParticipants } from './useOfficialParticipants';

/**
 * ✅ OFFICIAL PATTERN: Call controls hook following audio-only example
 * Handles mute/unmute, video toggle, and other call controls
 */
export const useOfficialCallControls = () => {
  const callObject = useCallObject();
  const { getLocal, updateParticipants } = useOfficialParticipants();

  const [isMuted, setIsMuted] = useState(true); // Start muted (official pattern)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);

  const local = getLocal();

  /**
   * ✅ OFFICIAL PATTERN: Simplified mute/unmute following official Tray component
   */
  const toggleAudio = useCallback(() => {
    if (!callObject) return;

    try {
      console.log(`🎤 Toggling audio: currently ${isMuted ? 'muted' : 'unmuted'}`);
      callObject.setLocalAudio(isMuted);
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  }, [callObject, isMuted]);

  /**
   * ✅ OFFICIAL PATTERN: Simplified video toggle following official Tray component
   */
  const toggleVideo = useCallback(() => {
    if (!callObject) return;

    try {
      console.log(`📹 Toggling video: currently ${isVideoEnabled ? 'enabled' : 'disabled'}`);
      callObject.setLocalVideo(!isVideoEnabled);
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  }, [callObject, isVideoEnabled]);

  /**
   * ✅ OFFICIAL PATTERN: Update state based on call object like official Tray
   */
  useEffect(() => {
    if (!callObject || !local) return;

    // ✅ OFFICIAL PATTERN: Use callObject methods directly
    const cameraMuted = !callObject.localVideo();
    const micMuted = !callObject.localAudio();

    setIsMuted(micMuted);
    setIsVideoEnabled(!cameraMuted);
  }, [callObject, local]);

  /**
   * ✅ OFFICIAL PATTERN: Leave call function
   */
  const leaveCall = useCallback(async () => {
    if (!callObject) return;

    try {
      console.log('[LEAVING CALL]');
      await callObject.leave();
    } catch (error) {
      console.error('Failed to leave call:', error);
    }
  }, [callObject]);

  /**
   * ✅ OFFICIAL PATTERN: App messaging (for custom features)
   */
  const sendAppMessage = useCallback(
    (message: any, participantId?: string) => {
      if (!callObject) return false;

      try {
        callObject.sendAppMessage(message, participantId);
        return true;
      } catch (error) {
        console.error('Failed to send app message:', error);
        return false;
      }
    },
    [callObject]
  );

  /**
   * ✅ OFFICIAL PATTERN: Hand raising (from audio example)
   */
  const raiseHand = useCallback(() => {
    if (!callObject || !local) return;

    console.log('RAISING HAND');
    const newName = `✋ ${local.user_name}`;
    callObject.setUserName(newName);
    updateParticipants(`raising-hand-${local.user_id}-${Date.now()}`);
  }, [callObject, local, updateParticipants]);

  const lowerHand = useCallback(() => {
    if (!callObject || !local) return;

    console.log('LOWERING HAND');
    const split = local.user_name.split('✋ ');
    const username = split && split.length === 2 ? split[1] : local.user_name;
    if (username) {
      callObject.setUserName(username);
      updateParticipants(`lowering-hand-${local.user_id}-${Date.now()}`);
    }
  }, [callObject, local, updateParticipants]);

  const toggleHand = useCallback(() => {
    if (!local) return;

    if (local.user_name.includes('✋')) {
      lowerHand();
    } else {
      raiseHand();
    }
  }, [local, raiseHand, lowerHand]);

  return {
    // Audio controls - ✅ OFFICIAL PATTERN: Simplified
    isMuted,
    isAudioMuted: isMuted,
    toggleAudio,

    // Video controls
    isVideoEnabled,
    // Alias used by screens
    isVideoMuted: !isVideoEnabled,
    toggleVideo,

    // Call controls
    leaveCall,
    // Alias used by screens
    endCall: leaveCall,
    sendAppMessage,

    // Hand raising (audio calls)
    raiseHand,
    lowerHand,
    toggleHand,
    // Aliases used by screens
    toggleHandRaise: toggleHand,
    isHandRaised: local?.user_name.includes('✋') || false,
    hasRaisedHand: local?.user_name.includes('✋') || false,

    // Local participant
    local,
  };
};
