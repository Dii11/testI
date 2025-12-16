import type { DailyParticipant } from '@daily-co/react-native-daily-js';
import { useCallback, useEffect, useState } from 'react';

import { useCallObject } from './useCallObject';

/**
 * ✅ OFFICIAL PATTERN: Participant management hook following audio-only example
 * Uses the update trigger pattern from the official examples for efficient updates
 */
export const useOfficialParticipants = () => {
  const callObject = useCallObject();
  const [participants, setParticipants] = useState<DailyParticipant[]>([]);
  const [updateTrigger, setUpdateTrigger] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string | undefined>(undefined);

  /**
   * ✅ OFFICIAL PATTERN: Update participants for any event
   * This matches the exact pattern from audio-only-react-native example
   */
  const updateParticipants = useCallback((trigger: string) => {
    console.log('[UPDATING PARTICIPANT LIST]');
    setUpdateTrigger(trigger);
  }, []);

  /**
   * ✅ OFFICIAL PATTERN: Get participant list as array like official examples
   */
  useEffect(() => {
    if (updateTrigger && callObject) {
      const participantsList = Object.values(callObject.participants());
      setParticipants(participantsList);
      setConnectionState(callObject.meetingState());
      console.log(`🔄 Participants updated (${participantsList.length})`, updateTrigger);
    }
  }, [updateTrigger, callObject]);

  /**
   * Start listening for participant changes when callObject is set
   */
  useEffect(() => {
    if (!callObject) {
      setParticipants([]);
      setConnectionState(undefined);
      return;
    }

    const handleParticipantJoined = (event?: any) => {
      updateParticipants(`joined-${event?.participant?.user_id}-${Date.now()}`);
    };

    const handleParticipantUpdated = (event?: any) => {
      updateParticipants(`updated-${event?.participant?.user_id}-${Date.now()}`);
    };

    const handleParticipantLeft = (event?: any) => {
      updateParticipants(`left-${event?.participant?.user_id}-${Date.now()}`);
    };

    const handleTrackStarted = (event?: any) => {
      updateParticipants(`track-started-${event?.participant?.user_id}-${Date.now()}`);
    };

    const handleTrackStopped = (event?: any) => {
      updateParticipants(`track-stopped-${event?.participant?.user_id}-${Date.now()}`);
    };

    const handleJoinedMeeting = (event?: any) => {
      updateParticipants(`joined-meeting-${event?.participant?.user_id || 'local'}-${Date.now()}`);
      setConnectionState('joined-meeting');
    };

    // ✅ OFFICIAL PATTERN: Initial participant list load
    updateParticipants(`initial-load-${Date.now()}`);
    setConnectionState(callObject.meetingState());

    // Listen for all participant-related events
    callObject.on('joined-meeting', handleJoinedMeeting);
    callObject.on('participant-joined', handleParticipantJoined);
    callObject.on('participant-updated', handleParticipantUpdated);
    callObject.on('participant-left', handleParticipantLeft);
    callObject.on('track-started', handleTrackStarted);
    callObject.on('track-stopped', handleTrackStopped);

    // Cleanup
    return function cleanup() {
      callObject.off('joined-meeting', handleJoinedMeeting);
      callObject.off('participant-joined', handleParticipantJoined);
      callObject.off('participant-updated', handleParticipantUpdated);
      callObject.off('participant-left', handleParticipantLeft);
      callObject.off('track-started', handleTrackStarted);
      callObject.off('track-stopped', handleTrackStopped);
    };
  }, [callObject, updateParticipants]);

  /**
   * ✅ OFFICIAL PATTERN: Helper functions like in audio example
   */
  const getLocal = useCallback(() => {
    return participants.find(p => p.local);
  }, [participants]);

  const getRemote = useCallback(() => {
    return participants.filter(p => !p.local);
  }, [participants]);

  const getParticipantById = useCallback(
    (id: string) => {
      return participants.find(p => p.user_id === id || p.session_id === id);
    },
    [participants]
  );

  /**
   * ✅ OFFICIAL PATTERN: Account type helpers (from audio example)
   */
  const getAccountType = useCallback((username?: string) => {
    if (!username) return null;
    // Check last three letters for account type (MOD, SPK, LST pattern)
    return username.slice(-3);
  }, []);

  const displayName = useCallback((username?: string) => {
    if (!username) return '';
    // Return name without account type suffix
    return username.slice(0, username.length - 4);
  }, []);

  return {
    participants,
    getLocal,
    getRemote,
    // Aliases expected by some screens
    localParticipant: getLocal(),
    remoteParticipants: getRemote(),
    isConnected: connectionState === 'joined-meeting',
    connectionState,
    participantCount: participants.length,
    getParticipantById,
    getAccountType,
    displayName,
    updateParticipants,
  };
};
