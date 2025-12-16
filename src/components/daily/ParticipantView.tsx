/* eslint-disable react-native/no-color-literals, react-native/no-unused-styles */
/**
 * ✅ OFFICIAL DAILY.CO PARTICIPANT VIEW PATTERN - ANDROID FIXED v2.2.0
 *
 * Based on official Daily.co Tile component patterns:
 * - Participant video/audio display
 * - Network state indicators
 * - Speaking indicators
 * - Mobile-optimized layout
 *
 * ✅ ANDROID FIXES APPLIED:
 * - Removed borderRadius/overflow on Android for proper video rendering
 * - Enhanced zIndex/elevation for proper layering
 * - SurfaceView/TextureView compatibility improvements
 * - Fixed video container clipping issues
 */

import type { DailyParticipant, DailyTrackState } from '@daily-co/react-native-daily-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Platform,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useActiveSpeaker } from '../../contexts/DailyCallContext';
import { logParticipant, logTrackIssue } from '../../utils/deviceLogger';

import { SimpleVideoTile } from './SimpleVideoTile';
import { VideoTroubleshootingHelper } from './VideoTroubleshootingHelper';

// (DailyMediaView is used inside our tile components)

interface ParticipantViewProps {
  participant: DailyParticipant;
  isLocal?: boolean;
  style?: StyleProp<ViewStyle>;
  mirror?: boolean;
  aspectRatio?: 'cover' | 'contain';
  showLabels?: boolean;
  compact?: boolean;
}

// ✅ OFFICIAL PATTERN: Participant tile following Daily.co Tile component
export const ParticipantView: React.FC<ParticipantViewProps> = ({
  participant,
  isLocal = false,
  style,
  mirror = false,
  // ✅ REMOVED: aspectRatio unused, using objectFit="cover" directly
  showLabels = true,
  compact = false,
}) => {
  const activeSpeakerId = useActiveSpeaker();
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // ✅ RACE CONDITION FIX: Handle track state transitions properly
  const videoTrack = useMemo(() => {
    if (!participant.tracks.video) return null;

    // CRITICAL: Handle all track states, not just 'playable'
    // Tracks may be in 'sendable' state initially before becoming 'playable'
    if (
      participant.tracks.video.state === 'playable' ||
      participant.tracks.video.state === 'sendable'
    ) {
      const track = participant.tracks.video.track || participant.tracks.video.persistentTrack;

      // Additional check: ensure track is actually ready
      if (track && track.readyState === 'live') {
        return track;
      }
    }
    return null;
  }, [
    participant.tracks.video.state,
    participant.tracks.video.track,
    participant.tracks.video.persistentTrack,
  ]);

  const audioTrack = useMemo(() => {
    if (!participant.tracks.audio) return null;

    // CRITICAL: Handle all track states, not just 'playable'
    if (
      participant.tracks.audio.state === 'playable' ||
      participant.tracks.audio.state === 'sendable'
    ) {
      const track = participant.tracks.audio.track || participant.tracks.audio.persistentTrack;

      // Additional check: ensure track is actually ready
      if (track && track.readyState === 'live') {
        return track;
      }
    }
    return null;
  }, [
    participant.tracks.audio.state,
    participant.tracks.audio.track,
    participant.tracks.audio.persistentTrack,
  ]);

  // ✅ OFFICIAL PATTERN: Simplified participant state following Daily.co Tile component
  const participantState = useMemo(() => {
    const videoTrackState: DailyTrackState = participant.tracks.video;
    const audioTrackState: DailyTrackState = participant.tracks.audio;

    const displayName = participant.user_name || (isLocal ? 'You' : 'Participant');
    const isSpeaking = activeSpeakerId === participant.session_id;

    const hasVideo = !!videoTrack;
    const hasAudio = !!audioTrack;

    // DEVICE-VISIBLE: Log participant/track status without console noise
    logParticipant(participant, isLocal);
    if (videoTrackState.state === 'blocked') {
      logTrackIssue(participant, 'video', 'Video track is blocked');
    }
    if (videoTrackState.state === 'off' && videoTrackState.off?.byUser === false) {
      logTrackIssue(participant, 'video', 'Video track is off (not by user)');
    }

    return {
      hasVideo,
      hasAudio,
      isSpeaking,
      displayName,
      isVideoBlocked: videoTrackState.state === 'blocked',
      isAudioBlocked: audioTrackState.state === 'blocked',
      videoTrackState,
      audioTrackState,
    };
  }, [participant, activeSpeakerId, isLocal, videoTrack, audioTrack]);

  const containerStyle = [
    styles.container,
    isLocal ? styles.localParticipantContainer : styles.remoteParticipantContainer,
    compact && styles.compactContainer,
    participantState.isSpeaking && styles.speakingContainer,
    style,
  ];

  return (
    <View style={containerStyle}>
      {/* Video View */}
      <View style={styles.videoContainer}>
        {participantState.hasVideo ? (
          <SimpleVideoTile
            videoTrackState={participant.tracks.video}
            audioTrackState={participant.tracks.audio}
            mirror={isLocal ? mirror : false}
            isLocal={isLocal}
          />
        ) : (
          <View
            style={[
              styles.avatarContainer,
              isLocal ? styles.localAvatarContainer : styles.remoteAvatarContainer,
              participantState.isSpeaking && styles.speakingAvatar,
            ]}
          >
            {/* Participant Type Label */}
            <View
              style={[
                styles.participantTypeLabel,
                isLocal ? styles.localTypeLabel : styles.remoteTypeLabel,
              ]}
            >
              <Text style={styles.participantTypeLabelText}>
                {isLocal ? '👤 YOU' : '👥 REMOTE'}
              </Text>
            </View>

            <View style={styles.avatar}>
              <Ionicons name="person" size={compact ? 32 : 48} color="rgba(255, 255, 255, 0.8)" />
            </View>

            {/* ✅ OFFICIAL PATTERN: Simplified video status following Tile component */}
            <View style={styles.videoStatusContainer}>
              <TouchableOpacity
                style={styles.videoStatusIndicator}
                onPress={() => setShowTroubleshooting(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="videocam-off" size={16} color="#FF3B30" />
                <Text style={styles.videoStatusText}>
                  {participantState.videoTrackState.state === 'blocked'
                    ? 'Video blocked'
                    : participantState.videoTrackState.state === 'interrupted'
                      ? 'Video interrupted'
                      : participantState.videoTrackState.state === 'loading'
                        ? 'Loading video...'
                        : participantState.videoTrackState.state === 'playable'
                          ? 'Video track exists but not rendering'
                          : isLocal
                            ? 'Camera off'
                            : 'No video'}
                </Text>
                <Ionicons name="help-circle" size={14} color="#FFC107" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Audio Indicator */}
        {showLabels && (
          <View style={styles.audioIndicator}>
            <View
              style={[
                styles.micIndicator,
                participantState.hasAudio ? styles.micOn : styles.micOff,
                participantState.isSpeaking && styles.micSpeaking,
              ]}
            >
              <Ionicons
                name={participantState.hasAudio ? 'mic' : 'mic-off'}
                size={12}
                color="#fff"
              />
            </View>
          </View>
        )}

        {/* Video Blocked Indicator */}
        {participantState.isVideoBlocked && (
          <View style={styles.blockedIndicator}>
            <Ionicons name="eye-off" size={16} color="#FF3B30" />
            <Text style={styles.blockedText}>Video blocked</Text>
          </View>
        )}

        {/* ✅ ENHANCED: Video Rendering Debug Panel */}
        {__DEV__ && (
          <View style={styles.enhancedDebugPanel}>
            <View style={styles.trackStateIndicator}>
              <Text style={styles.trackStateText}>
                V:{participantState.videoTrackState.state} A:
                {participantState.audioTrackState.state}
              </Text>
            </View>

            {/* Critical video track debug info */}
            <View style={styles.videoDebugInfo}>
              <Text style={styles.videoDebugText}>
                📹 Track: {videoTrack ? '✅' : '❌'} | Ready: {videoTrack?.readyState}
              </Text>
              <Text style={styles.videoDebugText}>
                🎥 ID: {videoTrack?.id.slice(-6) || 'none'} | Muted:{' '}
                {videoTrack?.muted ? '🔇' : '🔊'}
              </Text>
              <Text style={styles.videoDebugText}>
                🏷️ {isLocal ? 'LOCAL' : 'REMOTE'} | Mirror: {mirror ? '↔️' : '➡️'}
              </Text>
            </View>

            {/* Container visibility test */}
            <View style={styles.containerTest}>
              <View style={styles.testBorder} />
              <Text style={styles.containerTestText}>Container Visible</Text>
            </View>
          </View>
        )}
      </View>

      {/* Video Troubleshooting Helper */}
      <VideoTroubleshootingHelper
        visible={showTroubleshooting}
        onClose={() => setShowTroubleshooting(false)}
        hasVideo={participantState.hasVideo}
        isDailyMediaViewAvailable
        videoTrackState={participantState.videoTrackState.state}
        isLocal={isLocal}
      />

      {/* Participant Label */}
      {showLabels && !compact && (
        <View style={styles.labelContainer}>
          <Text style={styles.participantName} numberOfLines={1}>
            {participantState.displayName}
          </Text>
          {participantState.isSpeaking && (
            <View style={styles.speakingLabel}>
              <Ionicons name="volume-high" size={12} color="#4CAF50" />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ✅ OFFICIAL PATTERN: Local participant view following Daily.co examples
export const LocalParticipantView: React.FC<Omit<ParticipantViewProps, 'isLocal'>> = props => {
  return <ParticipantView {...props} isLocal mirror />;
};

// ✅ OFFICIAL PATTERN: Remote participant view following Daily.co examples
export const RemoteParticipantView: React.FC<Omit<ParticipantViewProps, 'isLocal'>> = props => {
  return <ParticipantView {...props} isLocal={false} />;
};

// ✅ OFFICIAL PATTERN: Participant grid following Daily.co examples
interface ParticipantGridProps {
  localParticipant: DailyParticipant | null;
  remoteParticipants: DailyParticipant[];
  style?: StyleProp<ViewStyle>;
  showLocalParticipant?: boolean;
  localParticipantStyle?: StyleProp<ViewStyle>;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  localParticipant,
  remoteParticipants,
  style,
  showLocalParticipant = true,
  localParticipantStyle,
}) => {
  // Enhanced UX: Allow swapping local/remote video positions
  const [isLocalVideoExpanded, setIsLocalVideoExpanded] = useState(false);

  const gridStyle = useMemo(() => {
    const totalParticipants =
      remoteParticipants.length + (showLocalParticipant && localParticipant ? 1 : 0);

    if (totalParticipants === 1) {
      return styles.singleParticipant;
    } else if (totalParticipants === 2) {
      return styles.twoParticipants;
    } else {
      return styles.multipleParticipants;
    }
  }, [remoteParticipants.length, localParticipant, showLocalParticipant]);

  const handleLocalVideoTap = () => {
    setIsLocalVideoExpanded(!isLocalVideoExpanded);
  };

  return (
    <View style={[styles.grid, gridStyle, style]}>
      {/* Conditional rendering based on expanded state */}
      {isLocalVideoExpanded ? (
        <>
          {/* Local Video in Main View */}
          {showLocalParticipant && localParticipant && (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={handleLocalVideoTap}
              activeOpacity={0.9}
            >
              <LocalParticipantView
                participant={localParticipant}
                style={styles.expandedLocalItem}
                compact={false}
              />
              <View style={styles.expandedLabel}>
                <Text style={styles.expandedLabelText}>You (tap to minimize)</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Remote Participants as PiP */}
          {remoteParticipants.map(participant => (
            <RemoteParticipantView
              key={participant.session_id}
              participant={participant}
              style={[styles.remotePiPItem]}
            />
          ))}
        </>
      ) : (
        <>
          {/* Default Layout: Remote Main, Local PiP */}
          {remoteParticipants.map(participant => (
            <RemoteParticipantView
              key={participant.session_id}
              participant={participant}
              style={styles.gridItem}
            />
          ))}

          {/* Local Participant as PiP with tap interaction */}
          {showLocalParticipant && localParticipant && (
            <TouchableOpacity
              style={[styles.gridItem, styles.localGridItem, localParticipantStyle]}
              onPress={handleLocalVideoTap}
              activeOpacity={0.8}
            >
              <LocalParticipantView
                participant={localParticipant}
                style={styles.localVideoContainer}
                compact={remoteParticipants.length > 0}
              />
              {/* Subtle tap indicator */}
              <View style={styles.tapIndicator}>
                <Text style={styles.tapIndicatorText}>You</Text>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

// ✅ OFFICIAL PATTERN: Audio-only participant list following Daily.co audio example
interface AudioParticipantListProps {
  participants: DailyParticipant[];
  style?: StyleProp<ViewStyle>;
}

export const AudioParticipantList: React.FC<AudioParticipantListProps> = ({
  participants,
  style,
}) => {
  const activeSpeakerId = useActiveSpeaker();

  return (
    <View style={[styles.audioList, style]}>
      {participants.map(participant => {
        const isSpeaking = activeSpeakerId === participant.session_id;
        const hasAudio = participant.tracks.audio.state === 'playable';
        const displayName = participant.user_name || (participant.local ? 'You' : 'Participant');

        return (
          <View
            key={participant.session_id}
            style={[styles.audioParticipant, isSpeaking && styles.audioSpeaking]}
          >
            <View style={[styles.audioAvatar, isSpeaking && styles.audioAvatarSpeaking]}>
              <Ionicons
                name="person"
                size={24}
                color={isSpeaking ? '#4CAF50' : 'rgba(255, 255, 255, 0.8)'}
              />
            </View>

            <View style={styles.audioParticipantInfo}>
              <Text style={[styles.audioParticipantName, isSpeaking && styles.speakingName]}>
                {displayName}
              </Text>
              <View style={styles.audioIndicators}>
                <View
                  style={[
                    styles.audioMicIndicator,
                    hasAudio ? styles.audioMicOn : styles.audioMicOff,
                    isSpeaking && styles.audioMicSpeaking,
                  ]}
                >
                  <Ionicons name={hasAudio ? 'mic' : 'mic-off'} size={12} color="#fff" />
                </View>
                {isSpeaking && <Ionicons name="volume-high" size={16} color="#4CAF50" />}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222',
    position: 'relative',
    // ✅ CRITICAL ANDROID FIX: Prevent video clipping on Android
    // IMPORTANT (Android): SurfaceView/TextureView don't play well with
    // overflow clipping and rounded corners. These fixes ensure proper video display.
    ...Platform.select({
      android: {
        borderRadius: 0,
        overflow: 'visible',
        elevation: 3, // Enhanced elevation for proper layering
      },
      ios: {
        borderRadius: 12,
        overflow: 'hidden',
      },
    }),
  },
  localParticipantContainer: {
    backgroundColor: '#1a3d5c', // Blue background for local
    borderWidth: 2,
    borderColor: '#4A90E2',
    ...Platform.select({
      android: {
        borderRadius: 0,
      },
      ios: {
        borderRadius: 14,
      },
    }),
  },
  remoteParticipantContainer: {
    backgroundColor: '#3d1a2e', // Purple background for remote
    borderWidth: 2,
    borderColor: '#9C27B0',
    ...Platform.select({
      android: {
        borderRadius: 0,
      },
      ios: {
        borderRadius: 14,
      },
    }),
  },
  compactContainer: {
    // ✅ ANDROID FIX: Platform-specific styling
    ...Platform.select({
      android: {
        borderRadius: 0,
      },
      ios: {
        borderRadius: 8,
      },
    }),
  },
  speakingContainer: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    // ✅ ANDROID FIX: Platform-specific styling
    ...Platform.select({
      android: {
        borderRadius: 0,
      },
      ios: {
        borderRadius: 14,
      },
    }),
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  // Removed explicit absolute positioning for the tile wrapper.
  // The inner DailyMediaView handles its own absolute fill.
  avatarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    position: 'relative',
  },
  localAvatarContainer: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  remoteAvatarContainer: {
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
  },
  speakingAvatar: {
    backgroundColor: '#2E5233',
  },
  participantTypeLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    zIndex: 10,
  },
  localTypeLabel: {
    backgroundColor: 'rgba(74, 144, 226, 0.9)',
  },
  remoteTypeLabel: {
    backgroundColor: 'rgba(156, 39, 176, 0.9)',
  },
  participantTypeLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  audioIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
  },
  micIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  micOn: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
  },
  micOff: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  micSpeaking: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  blockedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  blockedText: {
    fontSize: 10,
    color: '#FF3B30',
    fontWeight: '500',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  participantName: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    flex: 1,
  },
  speakingLabel: {
    marginLeft: 4,
  },

  // Grid styles
  grid: {
    flex: 1,
  },
  singleParticipant: {
    justifyContent: 'center',
  },
  twoParticipants: {
    flexDirection: 'column',
    gap: 8,
  },
  multipleParticipants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridItem: {
    flex: 1,
    minHeight: 120,
  },
  localGridItem: {
    position: 'absolute',
    bottom: 16, // Better positioning for thumb access and visibility
    right: 16,
    width: 140, // Slightly larger for better visibility
    height: 180,
    flex: 0,
    // ✅ ANDROID FIX: Enhanced zIndex and elevation
    zIndex: 15,
    elevation: 15, // Increased for Android
    // Enhanced visual prominence
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    // ✅ ANDROID FIX: Platform-specific border radius
    ...Platform.select({
      android: {
        borderRadius: 0,
      },
      ios: {
        borderRadius: 12,
      },
    }),
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  tile: {
    flex: 1,
    minWidth: '48%', // Ensure at least two tiles can fit side-by-side
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaView: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  participantInfo: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    padding: 8,
  },

  // Audio list styles
  audioList: {
    gap: 16,
    paddingVertical: 16,
  },
  audioParticipant: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    gap: 12,
  },
  audioSpeaking: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  audioAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  audioAvatarSpeaking: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  audioParticipantInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audioParticipantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  speakingName: {
    color: '#4CAF50',
  },
  audioIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioMicIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioMicOn: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
  },
  audioMicOff: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  audioMicSpeaking: {
    backgroundColor: '#4CAF50',
  },

  // Video status styles (production-friendly)
  videoStatusContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  videoStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  videoStatusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },

  // ✅ ENHANCED: Interactive local video styles
  expandedLocalItem: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },

  expandedLabel: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  expandedLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  remotePiPItem: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
  },

  localVideoContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },

  tapIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },

  tapIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ✅ ENHANCED: Debug panel styles
  enhancedDebugPanel: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    zIndex: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  trackStateIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  trackStateText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  videoDebugInfo: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderRadius: 4,
    padding: 4,
    marginBottom: 4,
  },
  videoDebugText: {
    color: '#FFC107',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  containerTest: {
    position: 'relative',
    height: 20,
    backgroundColor: 'rgba(156, 39, 176, 0.3)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#9C27B0',
    borderRadius: 4,
    borderStyle: 'dashed',
  },
  containerTestText: {
    color: '#9C27B0',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },

  // ✅ CRITICAL FIX: Video wrapper and debug styles
  videoWrapper: {
    flex: 1,
    position: 'relative',
  },
  videoDebugIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
  },
  trackDetailsIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
  },
  trackDetailsText: {
    color: '#000',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});
