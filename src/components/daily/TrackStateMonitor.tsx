/**
 * ✅ RACE CONDITION FIX: Track State Monitor
 *
 * Monitors track state transitions and handles race conditions
 * between when tracks become available and when they're ready to render
 */

import type { DailyTrackState } from '@daily-co/react-native-daily-js';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TrackStateMonitorProps {
  videoTrackState: DailyTrackState | null;
  audioTrackState: DailyTrackState | null;
  participantId: string;
  isLocal?: boolean;
}

interface TrackState {
  state: string;
  hasTrack: boolean;
  hasPersistentTrack: boolean;
  trackReadyState: string | null;
  persistentTrackReadyState: string | null;
  lastUpdated: number;
}

export const TrackStateMonitor: React.FC<TrackStateMonitorProps> = ({
  videoTrackState,
  audioTrackState,
  participantId,
  isLocal = false,
}) => {
  const [videoState, setVideoState] = useState<TrackState | null>(null);
  const [audioState, setAudioState] = useState<TrackState | null>(null);
  const [stateHistory, setStateHistory] = useState<string[]>([]);

  const updateTrackState = useCallback(
    (
      trackState: DailyTrackState | null,
      setter: (state: TrackState | null) => void,
      trackType: 'video' | 'audio'
    ) => {
      if (!trackState) {
        setter(null);
        return;
      }

      const newState: TrackState = {
        state: trackState.state,
        hasTrack: !!trackState.track,
        hasPersistentTrack: !!trackState.persistentTrack,
        trackReadyState: trackState.track?.readyState || null,
        persistentTrackReadyState: trackState.persistentTrack?.readyState || null,
        lastUpdated: Date.now(),
      };

      setter(newState);

      // Log state transitions
      const stateChange = `${trackType.toUpperCase()}: ${trackState.state} (${newState.hasTrack ? 'T' : 'F'}${newState.hasPersistentTrack ? 'P' : 'F'})`;
      setStateHistory(prev => [...prev.slice(-9), stateChange]);

      console.log(`🔄 Track State Change [${participantId.slice(-6)}]:`, {
        trackType,
        state: trackState.state,
        hasTrack: newState.hasTrack,
        hasPersistentTrack: newState.hasPersistentTrack,
        trackReadyState: newState.trackReadyState,
        persistentTrackReadyState: newState.persistentTrackReadyState,
      });
    },
    [participantId]
  );

  useEffect(() => {
    updateTrackState(videoTrackState, setVideoState, 'video');
  }, [videoTrackState, updateTrackState]);

  useEffect(() => {
    updateTrackState(audioTrackState, setAudioState, 'audio');
  }, [audioTrackState, updateTrackState]);

  // Determine if tracks are ready for rendering
  const isVideoReady =
    videoState &&
    (videoState.state === 'playable' || videoState.state === 'sendable') &&
    (videoState.trackReadyState === 'live' || videoState.persistentTrackReadyState === 'live');

  const isAudioReady =
    audioState &&
    (audioState.state === 'playable' || audioState.state === 'sendable') &&
    (audioState.trackReadyState === 'live' || audioState.persistentTrackReadyState === 'live');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        🔍 Track Monitor - {isLocal ? 'LOCAL' : 'REMOTE'} ({participantId.slice(-6)})
      </Text>

      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>
          🎥 Video: {videoState?.state || 'none'}
          {videoState?.hasTrack ? ' ✅' : ' ❌'}
          {videoState?.hasPersistentTrack ? ' P✅' : ' P❌'}
          {isVideoReady ? ' READY' : ' NOT READY'}
        </Text>

        <Text style={styles.stateText}>
          🎤 Audio: {audioState?.state || 'none'}
          {audioState?.hasTrack ? ' ✅' : ' ❌'}
          {audioState?.hasPersistentTrack ? ' P✅' : ' P❌'}
          {isAudioReady ? ' READY' : ' NOT READY'}
        </Text>
      </View>

      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>State History:</Text>
        {stateHistory.slice(-5).map((change, index) => (
          <Text key={index} style={styles.historyText}>
            {change}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 8,
    margin: 4,
    borderRadius: 4,
  },
  title: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stateContainer: {
    marginBottom: 4,
  },
  stateText: {
    color: 'white',
    fontSize: 10,
    marginBottom: 2,
  },
  historyContainer: {
    marginTop: 4,
  },
  historyTitle: {
    color: 'yellow',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  historyText: {
    color: 'lightgray',
    fontSize: 8,
    marginBottom: 1,
  },
});
