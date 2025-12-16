/**
 * ✅ WORKING PATTERN: Simple Video Tile using PublicRoomScreen patterns
 *
 * Clean implementation based on working PublicRoomScreen logic:
 * - Uses persistentTrack for video track consistency
 * - Simple track state validation (only 'playable' state)
 * - Minimal styling without debug code
 */

import { DailyMediaView } from '@daily-co/react-native-daily-js';
import type { DailyTrackState } from '@daily-co/react-native-daily-js';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SimpleVideoTileProps {
  videoTrackState: DailyTrackState | null;
  audioTrackState: DailyTrackState | null;
  mirror: boolean;
  isLocal?: boolean;
  style?: any;
}

export const SimpleVideoTile: React.FC<SimpleVideoTileProps> = ({
  videoTrackState,
  audioTrackState,
  mirror,
  isLocal = false,
  style,
}) => {
  // ✅ WORKING PATTERN: Simple track extraction like PublicRoomScreen
  const videoTrack = useMemo(() => {
    if (!videoTrackState || videoTrackState.state !== 'playable') return null;
    // KEY FIX: Use persistentTrack for consistency with PublicRoomScreen
    return videoTrackState.persistentTrack || videoTrackState.track || null;
  }, [videoTrackState]);

  const audioTrack = useMemo(() => {
    if (!audioTrackState || audioTrackState.state !== 'playable') return null;
    // KEY FIX: Use persistentTrack for consistency with PublicRoomScreen
    return audioTrackState.persistentTrack || audioTrackState.track || null;
  }, [audioTrackState]);

  // ✅ WORKING PATTERN: Simple media component like official Tile
  const mediaComponent = useMemo(() => {
    return (
      <DailyMediaView
        videoTrack={videoTrack}
        audioTrack={audioTrack}
        mirror={mirror}
        style={styles.media}
        objectFit="cover"
      />
    );
  }, [videoTrack, audioTrack, mirror]);

  return (
    <View style={[styles.container, style]}>
      {mediaComponent}

      {/* Show fallback when no video track */}
      {!videoTrack && (
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackText}>
            {isLocal ? 'Your camera is off' : 'No video from participant'}
          </Text>
          {videoTrackState?.state === 'blocked' && (
            <Text style={styles.errorText}>Camera blocked - check permissions</Text>
          )}
          {videoTrackState?.state === 'off' && (
            <Text style={styles.warningText}>Camera is off</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    borderRadius: 8,
  },
  media: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  fallbackContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
  },
  fallbackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  warningText: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});
