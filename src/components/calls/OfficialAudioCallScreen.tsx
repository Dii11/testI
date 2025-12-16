import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';

import { COLORS } from '../../constants';
import { useActiveSpeaker } from '../../hooks/daily/useActiveSpeaker';
import { useMeetingState } from '../../hooks/daily/useMeetingState';
import { useOfficialCallControls } from '../../hooks/daily/useOfficialCallControls';
import { useOfficialParticipants } from '../../hooks/daily/useOfficialParticipants';

interface OfficialAudioCallScreenProps {
  contactName: string;
  onEndCall: () => void;
}

/**
 * ✅ OFFICIAL PATTERN: Audio call participant component
 * Following exact pattern from audio-only-react-native example
 */
const AudioParticipant: React.FC<{
  participant: any;
  isActive: boolean;
  isLocal: boolean;
  displayName: string;
  isHandRaised: boolean;
}> = ({ participant, isActive, isLocal, displayName, isHandRaised }) => {
  const isMuted = !participant.audio;

  return (
    <View
      style={[
        styles.participantContainer,
        isActive && styles.activeSpeaker,
        isLocal && styles.localParticipant,
      ]}
    >
      <View
        style={[
          styles.participantAvatar,
          isActive && styles.activeSpeakerAvatar,
          isMuted && styles.mutedAvatar,
        ]}
      >
        {isHandRaised ? (
          <Text style={styles.handRaised}>✋</Text>
        ) : (
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color={isActive ? '#4CAF50' : '#666'}
          />
        )}
      </View>
      <Text
        style={[
          styles.participantName,
          isActive && styles.activeSpeakerName,
          isLocal && styles.localParticipantName,
        ]}
      >
        {displayName} {isLocal && '(You)'}
      </Text>
      {isMuted && !isHandRaised && (
        <View style={styles.mutedIndicator}>
          <Ionicons name="mic-off" size={12} color="#ff4444" />
        </View>
      )}
    </View>
  );
};

/**
 * ✅ OFFICIAL PATTERN: Audio call tray following audio example
 */
const AudioCallTray: React.FC<{
  isMuted: boolean;
  isHandRaised: boolean;
  onToggleAudio: () => void;
  onToggleHand: () => void;
  onEndCall: () => void;
}> = ({ isMuted, isHandRaised, onToggleAudio, onToggleHand, onEndCall }) => {
  return (
    <View style={styles.tray}>
      {/* Audio Control */}
      <TouchableOpacity
        style={[styles.controlButton, isMuted && styles.mutedButton]}
        onPress={onToggleAudio}
      >
        <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
        <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
      </TouchableOpacity>

      {/* Hand Raise */}
      <TouchableOpacity
        style={[styles.controlButton, isHandRaised && styles.handRaisedButton]}
        onPress={onToggleHand}
      >
        <Text style={styles.handIcon}>{isHandRaised ? '✋' : '👋'}</Text>
        <Text style={styles.controlLabel}>{isHandRaised ? 'Lower' : 'Raise'} Hand</Text>
      </TouchableOpacity>

      {/* End Call */}
      <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={onEndCall}>
        <Ionicons name="call" size={24} color="#fff" />
        <Text style={styles.controlLabel}>End</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * ✅ OFFICIAL PATTERN: Audio call screen following official audio-only example
 */
export const OfficialAudioCallScreen: React.FC<OfficialAudioCallScreenProps> = ({
  contactName,
  onEndCall,
}) => {
  const { participants, displayName, getLocal } = useOfficialParticipants();
  const { activeSpeakerId, isActiveSpeaker } = useActiveSpeaker();
  const { isMuted, toggleAudio, leaveCall, isHandRaised, toggleHand } = useOfficialCallControls();
  const meetingState = useMeetingState();

  const local = getLocal();

  /**
   * ✅ OFFICIAL PATTERN: Participant categorization like audio example
   */
  const { speakers, listeners } = useMemo(() => {
    const speakers = participants.filter(
      p =>
        p.owner || // Moderators can speak
        p.local || // Local user can speak
        !p.user_name.includes('_LST') // Not a listener
    );

    const listeners = participants
      .filter(p => p.user_name.includes('_LST'))
      .sort((a, _) => {
        // Move raised hands to front
        if (a.user_name.includes('✋')) return -1;
        return 0;
      });

    return { speakers, listeners };
  }, [participants]);

  /**
   * Handle end call
   */
  const handleEndCall = useCallback(async () => {
    try {
      await leaveCall();
      onEndCall();
    } catch (error) {
      console.error('Failed to end call:', error);
      onEndCall(); // Still navigate away
    }
  }, [leaveCall, onEndCall]);

  /**
   * ✅ OFFICIAL PATTERN: Render participants like audio example
   */
  const renderParticipants = (participantsList: any[], title: string) => {
    if (participantsList.length === 0) return null;

    return (
      <View style={styles.participantSection}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.participantsGrid}>
          {participantsList.map((participant, index) => (
            <AudioParticipant
              key={participant.session_id || index}
              participant={participant}
              isActive={isActiveSpeaker(participant.session_id)}
              isLocal={participant.local}
              displayName={displayName(participant.user_name) || participant.user_name || 'Unknown'}
              isHandRaised={participant.user_name?.includes('✋') || false}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Audio Call</Text>
        <Text style={styles.subtitle}>with {contactName}</Text>
        <Text style={styles.status}>
          {meetingState === 'joined-meeting' ? 'Connected' : 'Connecting...'}
        </Text>
        {participants.length > 0 && (
          <Text style={styles.participantCount}>
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Participants */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {renderParticipants(speakers, 'Speakers')}
        {renderParticipants(listeners, 'Listeners')}

        {participants.length === 0 && meetingState === 'joined-meeting' && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#666" />
            <Text style={styles.emptyStateText}>Waiting for others to join...</Text>
          </View>
        )}
      </ScrollView>

      {/* ✅ OFFICIAL PATTERN: Audio controls tray */}
      <AudioCallTray
        isMuted={isMuted}
        isHandRaised={isHandRaised}
        onToggleAudio={toggleAudio}
        onToggleHand={toggleHand}
        onEndCall={handleEndCall}
      />
    </SafeAreaView>
  );
};

const { height, width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginTop: 4,
  },
  status: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 8,
  },
  participantCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  participantSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  participantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  participantContainer: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    minWidth: (width - 60) / 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeSpeaker: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  localParticipant: {
    borderColor: '#2196F3',
  },
  participantAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeSpeakerAvatar: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  mutedAvatar: {
    backgroundColor: 'rgba(255, 68, 68, 0.3)',
  },
  participantName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
  activeSpeakerName: {
    color: '#4CAF50',
  },
  localParticipantName: {
    color: '#2196F3',
  },
  mutedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    padding: 4,
  },
  handRaised: {
    fontSize: 24,
  },
  handIcon: {
    fontSize: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  // ✅ OFFICIAL PATTERN: Tray styles from audio example
  tray: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  mutedButton: {
    backgroundColor: '#ff4444',
  },
  handRaisedButton: {
    backgroundColor: '#FF9800',
  },
  endCallButton: {
    backgroundColor: '#f44336',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
  },
});

export default OfficialAudioCallScreen;
