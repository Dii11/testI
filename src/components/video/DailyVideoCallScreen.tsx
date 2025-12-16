import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Text,
  ActivityIndicator,
} from 'react-native';

import DailyService from '../../services/dailyService';

interface DailyVideoCallScreenProps {
  roomUrl: string;
  onEndCall: () => void;
}

export const DailyVideoCallScreen: React.FC<DailyVideoCallScreenProps> = ({
  roomUrl,
  onEndCall,
}) => {
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('new');
  const callObjectRef = useRef<any | null>(null);
  const [sdkReady, setSdkReady] = useState<null | boolean>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ready = await DailyService.ensureReady();
      setSdkReady(ready);
      if (ready) {
        initializeDaily();
      } else {
        setInitError('Daily SDK unavailable in this build');
      }
    })();
    return () => {
      cleanup();
    };
  }, []);

  const initializeDaily = async () => {
    try {
      console.log('Initializing Daily.co...');
      const callObject = await DailyService.initializeEngine();
      if (!callObject) {
        throw new Error('Failed to initialize Daily.co engine');
      }

      callObjectRef.current = callObject;

      // Set up event handlers
      callObject.on('joined-meeting', handleJoinedMeeting);
      callObject.on('participant-joined', handleParticipantJoined);
      callObject.on('participant-left', handleParticipantLeft);
      callObject.on('participant-updated', handleParticipantUpdated);
      callObject.on('error', handleError);
      callObject.on('meeting-session-state-changed', handleMeetingStateChanged);

      console.log('Joining Daily.co room:', roomUrl);
      await DailyService.joinRoom(roomUrl);
    } catch (error) {
      console.error('Failed to initialize Daily.co:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Daily.co Error', `Failed to initialize video call: ${errorMessage}`);
    }
  };

  const handleJoinedMeeting = (event: any) => {
    console.log('Joined Daily.co meeting', event);
    setJoined(true);
    setConnectionState('joined');

    // Get initial participants
    const allParticipants = callObjectRef.current?.participants();
    if (allParticipants) {
      setParticipants(Object.values(allParticipants));
    }
  };

  const handleParticipantJoined = (event: any) => {
    console.log('Participant joined:', event.participant);
    const allParticipants = callObjectRef.current?.participants();
    if (allParticipants) {
      setParticipants(Object.values(allParticipants));
    }
  };

  const handleParticipantLeft = (event: any) => {
    console.log('Participant left:', event.participant);
    const allParticipants = callObjectRef.current?.participants();
    if (allParticipants) {
      setParticipants(Object.values(allParticipants));
    }
  };

  const handleParticipantUpdated = (event: any) => {
    const allParticipants = callObjectRef.current?.participants();
    if (allParticipants) {
      setParticipants(Object.values(allParticipants));
    }
  };

  const handleError = (event: any) => {
    console.error('Daily.co error:', event);
    Alert.alert('Call Error', `Error: ${event.errorMsg || 'Unknown error occurred'}`);
  };

  const handleMeetingStateChanged = (event: any) => {
    console.log('Meeting state changed:', event.meetingSessionState);
    setConnectionState(event.meetingSessionState);

    if (event.meetingSessionState === 'left') {
      setJoined(false);
      setParticipants([]);
    }
  };

  const cleanup = async () => {
    try {
      if (callObjectRef.current) {
        callObjectRef.current.off('joined-meeting', handleJoinedMeeting);
        callObjectRef.current.off('participant-joined', handleParticipantJoined);
        callObjectRef.current.off('participant-left', handleParticipantLeft);
        callObjectRef.current.off('participant-updated', handleParticipantUpdated);
        callObjectRef.current.off('error', handleError);
        callObjectRef.current.off('meeting-session-state-changed', handleMeetingStateChanged);
        callObjectRef.current = null;
      }
      await DailyService.leaveRoom();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  const handleEndCall = async () => {
    await cleanup();
    onEndCall();
  };

  const toggleAudio = async () => {
    const newMutedState = !isAudioMuted;
    await DailyService.setLocalAudio(!newMutedState);
    setIsAudioMuted(newMutedState);
  };

  const toggleVideo = async () => {
    const newMutedState = !isVideoMuted;
    await DailyService.setLocalVideo(!newMutedState);
    setIsVideoMuted(newMutedState);
  };

  const switchCamera = async () => {
    await DailyService.flipCamera();
  };

  const renderConnectionStatus = () => {
    let statusText = '';
    let statusColor = '#ccc';

    switch (connectionState) {
      case 'new':
        statusText = 'Connecting...';
        statusColor = '#ffa500';
        break;
      case 'joined':
        statusText = 'Connected';
        statusColor = '#00ff00';
        break;
      case 'left':
        statusText = 'Disconnected';
        statusColor = '#ff0000';
        break;
      default:
        statusText = connectionState;
        statusColor = '#ccc';
    }

    return (
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText} • Daily.co</Text>
      </View>
    );
  };

  const renderParticipantCount = () => {
    const remoteParticipants = participants.filter(p => !p.local);

    return (
      <View style={styles.participantContainer}>
        {remoteParticipants.length === 0 ? (
          <View style={styles.waitingContainer}>
            <Ionicons name="person" size={100} color="#ccc" />
            <Text style={styles.waitingText}>Waiting for others to join...</Text>
          </View>
        ) : (
          <View style={styles.participantsInfo}>
            <Ionicons name="people" size={24} color="#fff" />
            <Text style={styles.participantCountText}>
              {remoteParticipants.length} participant{remoteParticipants.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (sdkReady === false || initError) {
    return (
      <SafeAreaView style={styles.unavailableContainer}>
        <Ionicons name="warning" size={56} color="#ffb300" />
        <Text style={styles.unavailableTitle}>Video Unavailable</Text>
        <Text style={styles.unavailableMessage}>{initError || 'SDK not ready'}</Text>
        <TouchableOpacity style={styles.closeFallbackButton} onPress={onEndCall}>
          <Text style={styles.closeFallbackText}>Close</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (sdkReady === null) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Preparing Daily...</Text>
        <TouchableOpacity style={styles.abortButton} onPress={onEndCall}>
          <Text style={styles.abortText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderConnectionStatus()}

      <View style={styles.videoContainer}>{renderParticipantCount()}</View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isAudioMuted && styles.mutedButton]}
          onPress={toggleAudio}
        >
          <Ionicons
            name={isAudioMuted ? 'mic-off' : 'mic'}
            size={24}
            color={isAudioMuted ? '#ff4444' : '#fff'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isVideoMuted && styles.mutedButton]}
          onPress={toggleVideo}
        >
          <Ionicons
            name={isVideoMuted ? 'videocam-off' : 'videocam'}
            size={24}
            color={isVideoMuted ? '#ff4444' : '#fff'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  loadingText: { color: '#fff', fontSize: 16 },
  abortButton: {
    backgroundColor: '#444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  abortText: { color: '#fff', fontWeight: '600' },
  unavailableContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  unavailableTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  unavailableMessage: { color: '#ccc', fontSize: 14, textAlign: 'center' },
  closeFallbackButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeFallbackText: { color: '#fff', fontWeight: '600' },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  statusContainer: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  participantContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingContainer: {
    alignItems: 'center',
  },
  waitingText: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 10,
  },
  participantCountText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.3)',
  },
  endCallButton: {
    backgroundColor: '#ff4444',
  },
});

export default DailyVideoCallScreen;
