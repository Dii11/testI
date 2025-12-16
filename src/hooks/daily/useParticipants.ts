import type { DailyEvent, DailyParticipant } from '@daily-co/react-native-daily-js';
import { useCallback, useEffect, useState } from 'react';

import { useCallObject } from './useCallObject';

/**
 * Hook to track Daily.co participant changes
 * Based on official Daily.co React Native example patterns
 */
export const useParticipants = () => {
  const callObject = useCallObject();
  const [participants, setParticipants] = useState<Record<string, DailyParticipant>>({});

  const handleParticipantsChange = useCallback(() => {
    if (callObject) {
      setParticipants(callObject.participants());
    }
  }, [callObject]);

  /**
   * Start listening for participant changes when callObject is set
   */
  useEffect(() => {
    if (!callObject) {
      return;
    }

    const events: DailyEvent[] = ['participant-joined', 'participant-updated', 'participant-left'];

    // Use initial state
    handleParticipantsChange();

    // Listen for changes in state
    for (const event of events) {
      callObject.on(event, handleParticipantsChange);
    }

    // Stop listening for changes in state
    return function cleanup() {
      for (const event of events) {
        callObject.off(event, handleParticipantsChange);
      }
    };
  }, [callObject, handleParticipantsChange]);

  return participants;
};
