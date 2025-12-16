import { useCallback, useEffect, useRef, useState } from 'react';

import { useCallObject } from './useCallObject';

/**
 * ✅ OFFICIAL PATTERN: Active speaker detection hook
 * Following exact pattern from audio-only-react-native example
 */
export const useActiveSpeaker = () => {
  const callObject = useCallObject();
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<any | null>(null);
  const speakerHistoryRef = useRef<any[]>([]);

  /**
   * ✅ OFFICIAL PATTERN: Handle active speaker change events
   */
  const handleActiveSpeakerChange = useCallback((event?: any) => {
    console.log('[ACTIVE SPEAKER CHANGE]', event);
    const id = event?.activeSpeaker?.peerId || null;
    setActiveSpeakerId(id);
    // Try to resolve full participant for convenience (optional)
    try {
      const participants = callObject?.participants();
      const match = id
        ? Object.values(participants || {}).find((p: any) => p.session_id === id)
        : null;
      if (match) {
        setActiveSpeaker(match);
        // Track simple history of last few speakers
        speakerHistoryRef.current = [match, ...speakerHistoryRef.current].slice(0, 5);
      } else {
        setActiveSpeaker(null);
      }
    } catch {
      setActiveSpeaker(null);
    }
  }, []);

  /**
   * Start listening for active speaker changes when callObject is set
   */
  useEffect(() => {
    if (!callObject) {
      setActiveSpeakerId(null);
      return;
    }

    // ✅ OFFICIAL PATTERN: Listen for active speaker changes
    callObject.on('active-speaker-change', handleActiveSpeakerChange);

    // Cleanup
    return function cleanup() {
      callObject.off('active-speaker-change', handleActiveSpeakerChange);
    };
  }, [callObject, handleActiveSpeakerChange]);

  /**
   * Check if a participant is the active speaker
   */
  const isActiveSpeaker = useCallback(
    (participantId: string) => {
      return activeSpeakerId === participantId;
    },
    [activeSpeakerId]
  );

  return {
    activeSpeakerId,
    activeSpeaker,
    speakerHistory: speakerHistoryRef.current,
    isActiveSpeaker,
  };
};
