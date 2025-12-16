import type { DailyEvent } from '@daily-co/react-native-daily-js';
import { useCallback, useEffect, useState } from 'react';

import { useCallObject } from './useCallObject';

/**
 * Hook to track Daily.co meeting state changes
 * Based on official Daily.co React Native example patterns
 */
export const useMeetingState = () => {
  const callObject = useCallObject();
  const [meetingState, setMeetingState] = useState<string | undefined>();

  const handleMeetingState = useCallback(async () => {
    const currentMeetingState = callObject?.meetingState();
    setMeetingState(currentMeetingState);
  }, [callObject]);

  /**
   * Start listening for meeting changes, when the callObject is set.
   */
  useEffect(() => {
    if (!callObject) {
      return;
    }

    const events: DailyEvent[] = [
      'loading',
      'loaded',
      'load-attempt-failed',
      'joining-meeting',
      'joined-meeting',
      'left-meeting',
      'error',
    ];

    // Use initial state
    handleMeetingState();

    // Listen for changes in state
    for (const event of events) {
      callObject.on(event, handleMeetingState);
    }

    // Stop listening for changes in state
    return function cleanup() {
      for (const event of events) {
        callObject.off(event, handleMeetingState);
      }
    };
  }, [callObject, handleMeetingState]);

  return meetingState;
};
