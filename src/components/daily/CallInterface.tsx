/**
 * ✅ WORKING PATTERN: CallInterface using PublicRoomScreen patterns
 *
 * This component now uses the exact same working logic as PublicRoomScreen
 * instead of complex hooks and context that were causing video failures
 */

import { DailyMediaView } from '@daily-co/react-native-daily-js';
import Daily from '@daily-co/react-native-daily-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useCallback, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Text, TouchableOpacity } from 'react-native';

interface CallInterfaceProps {
  roomUrl: string;
  callType: 'audio' | 'video';
  contactName?: string;
  onEndCall: () => void;
  onError?: (error: Error) => void;
  autoJoin?: boolean;
}

// ✅ WORKING PATTERN: Direct Daily.co management following PublicRoomScreen
const CallInterface: React.FC<CallInterfaceProps> = ({
  roomUrl,
  callType,
  contactName = 'Participant',
  onEndCall,
  onError,
  autoJoin = true,
}) => {
  // ✅ WORKING PATTERN: Direct state management like PublicRoomScreen
  const [callObject, setCallObject] = useState<any>(null);
  const [participants, setParticipants] = useState<Record<string, any>>({});
  const [videoTrack, setVideoTrack] = useState<any>(null);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'joining' | 'joined' | 'error' | 'leaving'>(
    'idle'
  );

  // ✅ WORKING PATTERN: Create call object (PublicRoomScreen pattern)
  useEffect(() => {
    if (!roomUrl) return;

    const newCallObject = Daily.createCallObject();
    setCallObject(newCallObject);
    console.log('✅ CallInterface: Call object created successfully');
  }, [roomUrl]);

  // ✅ WORKING PATTERN: Direct participant management (PublicRoomScreen pattern)
  const handleNewParticipantsState = useCallback(
    (event: any) => {
      if (!callObject) return;

      const allParticipants = callObject.participants();
      setParticipants(allParticipants);

      // Direct video track management (KEY FIX: Uses persistentTrack)
      const participant = event.participant;
      if (participant && !participant.local) {
        const videoTrack = participant.tracks.video;
        if (videoTrack?.persistentTrack) {
          console.log('🎥 CallInterface: Setting remote video track:', videoTrack);
          setVideoTrack(videoTrack.persistentTrack);
        }
        setRemoteParticipantCount(callObject.participantCounts().present - 1 || 0);
      }
    },
    [callObject]
  );

  // Track mute states
  const updateMuteStates = useCallback(() => {
    if (!callObject) return;
    const cameraMuted = !callObject.localVideo();
    const micMuted = !callObject.localAudio();
    setIsCameraMuted(cameraMuted);
    setIsMicMuted(micMuted);
  }, [callObject]);

  // ✅ WORKING PATTERN: Event handling (PublicRoomScreen pattern)
  useEffect(() => {
    if (!callObject) return;

    const onJoined = () => {
      console.log('🎬 CallInterface: Joined meeting');
      setAppState('joined');
      updateMuteStates();
    };

    const onLeft = () => {
      console.log('🎬 CallInterface: Left meeting');
      setAppState('idle');
      setVideoTrack(null);
      setRemoteParticipantCount(0);
    };

    const onError = (event: any) => {
      console.error('🎬 CallInterface: Meeting error:', event);
      setAppState('error');
      onError(new Error('Connection failed'));
    };

    // Direct event handling (PublicRoomScreen pattern)
    callObject
      .on('joined-meeting', onJoined)
      .on('left-meeting', onLeft)
      .on('error', onError)
      .on('participant-joined', handleNewParticipantsState)
      .on('participant-updated', handleNewParticipantsState)
      .on('participant-left', handleNewParticipantsState)
      .on('participant-updated', updateMuteStates);

    return () => {
      callObject.off('joined-meeting', onJoined);
      callObject.off('left-meeting', onLeft);
      callObject.off('error', onError);
      callObject.off('participant-joined', handleNewParticipantsState);
      callObject.off('participant-updated', handleNewParticipantsState);
      callObject.off('participant-left', handleNewParticipantsState);
      callObject.off('participant-updated', updateMuteStates);
    };
  }, [callObject, handleNewParticipantsState, updateMuteStates, onError]);

  // ✅ WORKING PATTERN: Auto-join (PublicRoomScreen pattern)
  useEffect(() => {
    if (!callObject || !roomUrl || !autoJoin) return;

    console.log('🔗 CallInterface: Joining room:', roomUrl);
    setAppState('joining');

    callObject.join({ url: roomUrl }).catch((error: any) => {
      console.error('❌ CallInterface: Failed to join:', error);
      setAppState('error');
      onError?.(error);
    });
  }, [callObject, roomUrl, autoJoin, onError]);

  // ✅ WORKING PATTERN: Control methods (PublicRoomScreen pattern)
  const toggleCamera = useCallback(() => {
    if (!callObject || appState !== 'joined') return;
    callObject.setLocalVideo(isCameraMuted);
  }, [callObject, isCameraMuted, appState]);

  const toggleMic = useCallback(() => {
    if (!callObject || appState !== 'joined') return;
    callObject.setLocalAudio(isMicMuted);
  }, [callObject, isMicMuted, appState]);

  // ✅ WORKING PATTERN: Leave call handler (PublicRoomScreen pattern)
  const handleEndCall = useCallback(async () => {
    if (!callObject) {
      onEndCall();
      return;
    }

    console.log('👋 CallInterface: Leaving call gracefully...');
    setAppState('leaving');

    try {
      await callObject.leave();
      console.log('✅ CallInterface: Successfully left call');
    } catch (error) {
      console.error('❌ CallInterface: Error during leave:', error);
      try {
        await callObject.destroy();
        console.log('✅ CallInterface: Call object destroyed as fallback');
      } catch (destroyError) {
        console.error('❌ CallInterface: Error during destroy:', destroyError);
      }
    } finally {
      setAppState('idle');
      setVideoTrack(null);
      setRemoteParticipantCount(0);
      onEndCall();
    }
  }, [callObject, onEndCall]);

  // ✅ WORKING PATTERN: Render based on appState (PublicRoomScreen pattern)
  if (appState === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusArea}>
          <Ionicons name="alert-circle" size={60} color="#ff4444" />
          <Text style={styles.statusText}>Connection failed</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleEndCall}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (appState === 'joining' || appState === 'leaving') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusArea}>
          <Ionicons
            name={appState === 'joining' ? 'hourglass' : 'exit'}
            size={60}
            color="#007AFF"
          />
          <Text style={styles.statusText}>
            {appState === 'joining' ? 'Joining call...' : 'Leaving call...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (appState === 'joined') {
    return (
      <SafeAreaView style={styles.container}>
        {remoteParticipantCount > 0 ? (
          <DailyMediaView
            videoTrack={videoTrack}
            audioTrack={null}
            mirror={false}
            objectFit="cover"
            style={styles.dailyMediaView}
          />
        ) : (
          <View style={styles.waitingArea}>
            <Text style={styles.waitingText}>Waiting for {contactName}...</Text>
            <Text style={styles.waitingSubtext}>They will join the call shortly</Text>
          </View>
        )}

        {/* Control tray */}
        <View style={styles.tray}>
          <TouchableOpacity
            style={[styles.trayButton, isMicMuted && styles.mutedButton]}
            onPress={toggleMic}
          >
            <Ionicons name={isMicMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.trayButton, isCameraMuted && styles.mutedButton]}
            onPress={toggleCamera}
          >
            <Ionicons name={isCameraMuted ? 'videocam-off' : 'videocam'} size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.trayButton, styles.leaveButton]} onPress={handleEndCall}>
            <Ionicons name="call" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Default state
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusArea}>
        <Text style={styles.statusText}>Initializing call...</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  dailyMediaView: {
    flex: 1,
  },
  waitingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  waitingText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  waitingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  tray: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    gap: 20,
  },
  trayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: '#ff4444',
  },
  leaveButton: {
    backgroundColor: '#ff4444',
  },
  statusArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  statusText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export { CallInterface };
