/**
 * 🔧 VIDEO DEBUG HELPER v1.0
 *
 * Ultimate video track debugging component
 * Shows exactly what's happening with tracks and rendering
 */

import { DailyMediaView } from '@daily-co/react-native-daily-js';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface VideoDebugHelperProps {
  participant: any;
  isLocal?: boolean;
}

export const VideoDebugHelper: React.FC<VideoDebugHelperProps> = ({
  participant,
  isLocal = false,
}) => {
  if (!participant) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>No participant provided</Text>
      </View>
    );
  }

  const videoTrackState = participant.tracks?.video;
  const audioTrackState = participant.tracks?.audio;

  if (!videoTrackState) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>No video track state</Text>
      </View>
    );
  }

  const videoTrack = videoTrackState.persistentTrack || videoTrackState.track;
  const audioTrack = audioTrackState?.persistentTrack || audioTrackState?.track;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        🔬 VIDEO DEBUG - {isLocal ? 'LOCAL' : 'REMOTE'} - {participant.user_name}
      </Text>

      {/* Track state info */}
      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>📹 Video State: {videoTrackState.state}</Text>
        <Text style={styles.infoText}>🎵 Audio State: {audioTrackState?.state || 'none'}</Text>
        <Text style={styles.infoText}>📊 Participant Video: {participant.video ? '✅' : '❌'}</Text>
        <Text style={styles.infoText}>🔊 Participant Audio: {participant.audio ? '✅' : '❌'}</Text>
      </View>

      {/* Track details */}
      {videoTrack && (
        <View style={styles.trackPanel}>
          <Text style={styles.trackTitle}>MediaStreamTrack Details:</Text>
          <Text style={styles.trackText}>ID: {videoTrack.id}</Text>
          <Text style={styles.trackText}>Kind: {videoTrack.kind}</Text>
          <Text style={styles.trackText}>Ready: {videoTrack.readyState}</Text>
          <Text style={styles.trackText}>Enabled: {videoTrack.enabled ? '✅' : '❌'}</Text>
          <Text style={styles.trackText}>Muted: {videoTrack.muted ? '🔇' : '🔊'}</Text>
          <Text style={styles.trackText}>Remote: {videoTrack.remote ? '✅' : '❌'}</Text>
          {videoTrack._settings && (
            <Text style={styles.trackText}>
              Size: {videoTrack._settings.width}x{videoTrack._settings.height}
            </Text>
          )}
        </View>
      )}

      {/* Test different rendering approaches */}
      <View style={styles.testSection}>
        <Text style={styles.testTitle}>DailyMediaView Test:</Text>

        {videoTrack ? (
          <View style={styles.videoContainer}>
            <DailyMediaView
              videoTrack={videoTrack}
              audioTrack={audioTrack ?? undefined}
              style={styles.video}
              objectFit="cover"
              mirror={isLocal}
            />

            {/* Overlay to show container is working */}
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>Container Active</Text>
              <Text style={styles.overlayText}>Track: {videoTrack.id.slice(-6)}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.error}>No MediaStreamTrack available</Text>
        )}
      </View>

      {/* Raw track object inspection */}
      <View style={styles.rawPanel}>
        <Text style={styles.rawTitle}>Raw Track Object:</Text>
        <Text style={styles.rawText}>
          Track Object: {videoTrackState.track ? 'exists' : 'null'}
        </Text>
        <Text style={styles.rawText}>
          Persistent: {videoTrackState.persistentTrack ? 'exists' : 'null'}
        </Text>
        <Text style={styles.rawText}>
          Both Same: {videoTrackState.track === videoTrackState.persistentTrack ? '✅' : '❌'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  infoPanel: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  infoText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  trackPanel: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  trackTitle: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  trackText: {
    color: '#FFC107',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  testSection: {
    marginBottom: 12,
  },
  testTitle: {
    color: '#9C27B0',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  videoContainer: {
    height: 150,
    backgroundColor: '#FF6B35', // Bright orange so we can see the container
    borderRadius: 8,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#9C27B0',
  },
  video: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 4,
    padding: 4,
  },
  overlayText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  rawPanel: {
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#9C27B0',
  },
  rawTitle: {
    color: '#9C27B0',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  rawText: {
    color: '#9C27B0',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  error: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
