// ✅ OFFICIAL PATTERN: Direct imports following Daily.co official example
import type { DailyTrackState } from '@daily-co/react-native-daily-js';
import { DailyMediaView } from '@daily-co/react-native-daily-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import type { ViewStyle } from 'react-native';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';

import { COLORS } from '../../constants';

export enum TileType {
  Thumbnail,
  Half,
  Full,
}

interface EnhancedDailyVideoTileProps {
  videoTrackState: DailyTrackState | null;
  audioTrackState: DailyTrackState | null;
  mirror: boolean;
  type: TileType;
  disableAudioIndicators?: boolean;
  onPress?: () => void;
  participantName?: string;
  isLocal?: boolean;
  isActiveSpeaker?: boolean;
  isHandRaised?: boolean;
  style?: ViewStyle;
}

/**
 * ✅ OFFICIAL PATTERN: Exact copy from official Tile component
 */
function getTrackUnavailableMessage(
  kind: 'video' | 'audio',
  trackState: DailyTrackState | null
): string | void {
  if (!trackState) return;
  switch (trackState.state) {
    case 'blocked':
      if (trackState.blocked?.byPermissions) {
        return `${kind} permission denied`;
      } else if (trackState.blocked?.byDeviceMissing) {
        return `${kind} device missing`;
      }
      return `${kind} blocked`;
    case 'off':
      if (trackState.off?.byUser) {
        // In this particular case the message doesn't really matter, since the
        // special mute overlay is shown over it
        return `${kind} muted`;
      } else if (trackState.off?.byBandwidth) {
        return `${kind} muted to save bandwidth`;
      }
      return `${kind} off`;
    case 'sendable':
      return `${kind} not subscribed`;
    case 'loading':
      return `${kind} loading...`;
    case 'interrupted':
      return `${kind} interrupted`;
    case 'playable':
      return;
  }
}

/**
 * ✅ ENHANCED: Video tile component with official patterns + improvements
 * Based on official Daily.co React Native example with enhancements
 */
export const EnhancedDailyVideoTile: React.FC<EnhancedDailyVideoTileProps> = ({
  videoTrackState,
  audioTrackState,
  mirror,
  type,
  disableAudioIndicators = false,
  onPress,
  participantName,
  isLocal = false,
  isActiveSpeaker = false,
  isHandRaised = false,
  style,
}) => {
  // ✅ WORKING PATTERN: Use persistentTrack like PublicRoomScreen
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

  // Get track messages
  const videoUnavailableMessage = useMemo(() => {
    return getTrackUnavailableMessage('video', videoTrackState);
  }, [videoTrackState]);

  const audioUnavailableMessage = useMemo(() => {
    return getTrackUnavailableMessage('audio', audioTrackState);
  }, [audioTrackState]);

  // ✅ OFFICIAL PATTERN: Media component exactly like official Tile
  const mediaComponent = useMemo(() => {
    return (
      <DailyMediaView
        videoTrack={videoTrack}
        audioTrack={audioTrack}
        mirror={mirror}
        // Assumption: thumbnails should appear layered on top of other tiles
        zOrder={type === TileType.Thumbnail ? 1 : 0}
        style={styles.media}
        objectFit="cover"
      />
    );
  }, [videoTrack, audioTrack, mirror, type]);

  // ✅ OFFICIAL PATTERN: Touchable wrapper exactly like official Tile
  const touchableMediaComponent = useMemo(() => {
    return (
      <TouchableOpacity onPress={onPress} disabled={!onPress} style={styles.media}>
        {mediaComponent}
      </TouchableOpacity>
    );
  }, [onPress, mediaComponent]);

  // ✅ OFFICIAL PATTERN: Mute overlay exactly like official Tile
  const muteOverlayComponent = useMemo(() => {
    // Show mute overlay when at least one track is muted by the sender
    const videoMuted = !!videoTrackState?.off?.byUser;
    const audioMuted = !!audioTrackState?.off?.byUser;
    return videoMuted || (audioMuted && !disableAudioIndicators) ? (
      <View style={styles.iconContainer}>
        {videoMuted && <Ionicons name="videocam-off" size={24} color="#fff" style={styles.icon} />}
        {audioMuted && !disableAudioIndicators && (
          <Ionicons name="mic-off" size={24} color="#fff" style={styles.icon} />
        )}
      </View>
    ) : null;
  }, [videoTrackState, audioTrackState, disableAudioIndicators]);

  // ✅ OFFICIAL PATTERN: Message overlay exactly like official Tile
  const messageOverlayComponent = useMemo(() => {
    // Show message overlay when video track is unavailable, and when the mute
    // overlay is *not* shown (to avoid clash/clutter). Audio may be unavailable
    // too.
    const muteOverlayShown =
      !!videoTrackState?.off?.byUser || (!!audioTrackState?.off?.byUser && !disableAudioIndicators);
    if (videoUnavailableMessage && !muteOverlayShown) {
      return (
        <>
          <Text style={styles.overlayMessage}>{videoUnavailableMessage}</Text>
          {audioUnavailableMessage && !disableAudioIndicators && (
            <Text style={styles.overlayMessage}>{audioUnavailableMessage}</Text>
          )}
        </>
      );
    }
  }, [
    videoUnavailableMessage,
    audioUnavailableMessage,
    videoTrackState,
    audioTrackState,
    disableAudioIndicators,
  ]);

  // ✅ OFFICIAL PATTERN: Corner message exactly like official Tile
  const cornerMessageComponent = useMemo(() => {
    // Show corner message when only audio is unavailable, and when the mute
    // overlay is *not* shown (to avoid clash/clutter).
    const muteOverlayShown =
      !!videoTrackState?.off?.byUser || (!!audioTrackState?.off?.byUser && !disableAudioIndicators);
    if (
      audioUnavailableMessage &&
      !disableAudioIndicators &&
      !videoUnavailableMessage &&
      !muteOverlayShown
    ) {
      return <Text style={styles.cornerMessage}>{audioUnavailableMessage}</Text>;
    }
    return null;
  }, [
    videoUnavailableMessage,
    audioUnavailableMessage,
    videoTrackState,
    audioTrackState,
    disableAudioIndicators,
  ]);

  // ✅ OFFICIAL PATTERN: Type-specific styles with orientation support
  let typeSpecificStyle: ViewStyle | null = null;
  switch (type) {
    case TileType.Half:
      typeSpecificStyle = styles.containerHalfPortrait; // Could add orientation logic here
      break;
    case TileType.Full:
      typeSpecificStyle = styles.containerFullPortrait; // Could add orientation logic here
      break;
    default:
      typeSpecificStyle = styles.containerThumbnail;
      break;
  }

  return (
    <View
      style={[styles.container, styles.containerLoadingOrNotShowingVideo, typeSpecificStyle, style]}
    >
      {touchableMediaComponent}
      {messageOverlayComponent}
      {cornerMessageComponent}
      {muteOverlayComponent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
    aspectRatio: 1,
  },
  containerHalfPortrait: {
    width: '50%',
  },
  containerHalfLandscape: {
    height: '50%',
  },
  containerFullPortrait: {
    width: '100%',
  },
  containerFullLandscape: {
    height: '100%',
  },
  containerThumbnail: {
    width: 120,
    height: 160,
    borderRadius: 8,
    margin: 4,
  },
  containerLoadingOrNotShowingVideo: {
    backgroundColor: '#2a2a2a',
  },
  media: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlayMessage: {
    color: '#fff',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  cornerMessage: {
    color: '#fff',
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: '#2a2a2a',
    padding: 12,
  },
  iconContainer: {
    flexDirection: 'row',
  },
  icon: {
    marginHorizontal: 4,
    marginBottom: 16,
  },
});
