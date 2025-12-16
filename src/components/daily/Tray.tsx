/**
 * ✅ WORKING PATTERN: Tray using PublicRoomScreen patterns
 *
 * This component provides call controls using direct Daily.co API calls
 * following the same working logic as PublicRoomScreen
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';

interface TrayProps {
  callObject: any;
  isCameraMuted: boolean;
  isMicMuted: boolean;
  onEndCall: () => void;
  appState: 'idle' | 'joining' | 'joined' | 'error' | 'leaving';
}

// ✅ WORKING PATTERN: Direct Daily.co API calls following PublicRoomScreen
const Tray: React.FC<TrayProps> = ({
  callObject,
  isCameraMuted,
  isMicMuted,
  onEndCall,
  appState,
}) => {
  // ✅ FIXED: Direct camera toggle - Use isCameraMuted directly (not negated)
  const toggleCamera = () => {
    if (!callObject || appState !== 'joined') return;
    console.log('🎥 Tray: Toggling camera', { currentlyMuted: isCameraMuted });
    // When muted=true (OFF), setLocalVideo(true) turns it ON
    // When muted=false (ON), setLocalVideo(false) turns it OFF
    callObject.setLocalVideo(isCameraMuted);
  };

  // ✅ FIXED: Direct mic toggle - Use isMicMuted directly (not negated)
  const toggleMic = () => {
    if (!callObject || appState !== 'joined') return;
    console.log('🎤 Tray: Toggling microphone', { currentlyMuted: isMicMuted });
    // When muted=true (OFF), setLocalAudio(true) turns it ON
    // When muted=false (ON), setLocalAudio(false) turns it OFF
    callObject.setLocalAudio(isMicMuted);
  };

  // Don't render tray if not in proper state
  if (appState !== 'joined') {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Microphone button */}
      <TouchableOpacity
        style={[styles.button, isMicMuted && styles.mutedButton]}
        onPress={toggleMic}
      >
        <Ionicons name={isMicMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
      </TouchableOpacity>

      {/* Camera button */}
      <TouchableOpacity
        style={[styles.button, isCameraMuted && styles.mutedButton]}
        onPress={toggleCamera}
      >
        <Ionicons name={isCameraMuted ? 'videocam-off' : 'videocam'} size={24} color="#fff" />
      </TouchableOpacity>

      {/* End call button */}
      <TouchableOpacity style={[styles.button, styles.endCallButton]} onPress={onEndCall}>
        <Ionicons name="call" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 20,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  mutedButton: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
  endCallButton: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
});

export { Tray };
