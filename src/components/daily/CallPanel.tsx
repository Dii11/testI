/**
 * ✅ WORKING PATTERN: CallPanel using PublicRoomScreen patterns
 *
 * This component manages participant display using the same working logic
 * as PublicRoomScreen instead of complex hooks and context
 */

import { DailyMediaView } from '@daily-co/react-native-daily-js';
import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';

import { EnhancedDailyVideoTile, TileType } from '../calls/EnhancedDailyVideoTile';

interface CallPanelProps {
  participants: Record<string, any>;
  videoTrack: any;
  localParticipantId?: string;
  showLocalVideo?: boolean;
}

// ✅ WORKING PATTERN: Direct participant management following PublicRoomScreen
const CallPanel: React.FC<CallPanelProps> = ({
  participants,
  videoTrack,
  localParticipantId,
  showLocalVideo = false,
}) => {
  // ✅ WORKING PATTERN: Filter participants directly like PublicRoomScreen
  const remoteParticipants = useMemo(() => {
    return Object.values(participants).filter((participant: any) => !participant.local);
  }, [participants]);

  const localParticipant = useMemo(() => {
    return Object.values(participants).find((participant: any) => participant.local);
  }, [participants]);

  // ✅ WORKING PATTERN: Main video display (remote participant with video track)
  const mainVideoComponent = useMemo(() => {
    if (videoTrack && remoteParticipants.length > 0) {
      return (
        <DailyMediaView
          videoTrack={videoTrack}
          audioTrack={null}
          mirror={false}
          objectFit="cover"
          style={styles.mainVideo}
        />
      );
    }

    // Fallback when no remote video
    return (
      <View style={styles.waitingArea}>
        <Text style={styles.waitingText}>
          {remoteParticipants.length === 0
            ? 'Waiting for participant to join...'
            : 'Waiting for video...'}
        </Text>
      </View>
    );
  }, [videoTrack, remoteParticipants]);

  // ✅ WORKING PATTERN: Local video tile (thumbnail)
  const localVideoComponent = useMemo(() => {
    if (!showLocalVideo || !localParticipant) return null;

    return (
      <View style={styles.localVideoContainer}>
        <EnhancedDailyVideoTile
          videoTrackState={localParticipant.tracks?.video || null}
          audioTrackState={null} // Don't play local audio
          mirror
          type={TileType.Thumbnail}
          disableAudioIndicators
          isLocal
          style={styles.localVideoTile}
        />
      </View>
    );
  }, [showLocalVideo, localParticipant]);

  return (
    <View style={styles.container}>
      {/* Main video area */}
      <View style={styles.mainVideoContainer}>
        {mainVideoComponent}
        {localVideoComponent}
      </View>

      {/* Participant count indicator */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {remoteParticipants.length} participant{remoteParticipants.length !== 1 ? 's' : ''}{' '}
          connected
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mainVideoContainer: {
    flex: 1,
    position: 'relative',
  },
  mainVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  waitingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  waitingText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  localVideoTile: {
    width: 120,
    height: 160,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
});

export { CallPanel };
