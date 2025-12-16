import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';

import { COLORS } from '../../constants';
import AgoraService from '../../services/agoraService';
import DailyService from '../../services/dailyService';
import PermissionGate from '../permissions/PermissionGate';

interface SimpleAudioCallScreenProps {
  channelName: string;
  onEndCall: () => void;
  provider: 'daily' | 'agora';
  contactName: string;
  dailyCallObject?: any;
  agoraEngine?: any;
}

const SimpleAudioCallScreen: React.FC<SimpleAudioCallScreenProps> = ({
  channelName,
  onEndCall,
  provider,
  contactName,
  dailyCallObject,
  agoraEngine,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isCallReady, setIsCallReady] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<
    'excellent' | 'good' | 'poor' | 'unknown'
  >('unknown');
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [localUid, setLocalUid] = useState<number>(0);
  const callObjectRef = useRef<any>(null);
  const engineRef = useRef<any>(null);

  useEffect(() => {
    console.log(`🔊 Starting ${provider.toUpperCase()} audio call: ${channelName}`);

    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Set up provider-specific call object
    if (provider === 'daily' && dailyCallObject) {
      setupDailyCall(dailyCallObject);
    } else if (provider === 'agora') {
      setupAgoraCall(agoraEngine);
    }

    return () => {
      clearInterval(timer);
      console.log(`🔊 Ended ${provider.toUpperCase()} audio call: ${channelName}`);
    };
  }, [channelName, provider, dailyCallObject, agoraEngine]);

  const setupDailyCall = (dailyCallObject: any) => {
    callObjectRef.current = dailyCallObject;

    // Set up event listeners for participants
    const handleParticipantJoined = (event: any) => {
      console.log('Participant joined:', event.participant);
      updateParticipants();
    };

    const handleParticipantLeft = (event: any) => {
      console.log('Participant left:', event.participant);
      updateParticipants();
    };

    const handleJoinedMeeting = () => {
      console.log('Successfully joined audio meeting');
      setIsCallReady(true);
      updateParticipants();
    };

    const handleNetworkQualityChange = (event: any) => {
      const quality = event.quality;
      switch (quality) {
        case 'good':
          setConnectionQuality('excellent');
          break;
        case 'low':
          setConnectionQuality('good');
          break;
        case 'very-low':
          setConnectionQuality('poor');
          break;
        default:
          setConnectionQuality('unknown');
      }
    };

    dailyCallObject.on('participant-joined', handleParticipantJoined);
    dailyCallObject.on('participant-left', handleParticipantLeft);
    dailyCallObject.on('joined-meeting', handleJoinedMeeting);
    dailyCallObject.on('network-quality-change', handleNetworkQualityChange);

    // Initial participant update
    updateParticipants();
  };

  const setupAgoraCall = (engine: any) => {
    const agoraEngine = engine || AgoraService.getEngine();
    if (agoraEngine) {
      engineRef.current = agoraEngine;

      // Set up Agora event listeners
      const handleUserJoined = (uid: number) => {
        console.log('Agora user joined:', uid);
        setRemoteUids(prev => [...prev, uid]);
        updateAgoraParticipants();
      };

      const handleUserLeft = (uid: number) => {
        console.log('Agora user left:', uid);
        setRemoteUids(prev => prev.filter(id => id !== uid));
        updateAgoraParticipants();
      };

      const handleJoinChannelSuccess = (channel: string, uid: number) => {
        console.log('Successfully joined Agora channel:', channel, 'with UID:', uid);
        setLocalUid(uid);
        setIsCallReady(true);
        updateAgoraParticipants();
      };

      agoraEngine.addListener('UserJoined', handleUserJoined);
      agoraEngine.addListener('UserLeft', handleUserLeft);
      agoraEngine.addListener('JoinChannelSuccess', handleJoinChannelSuccess);

      // Get initial state
      setRemoteUids(AgoraService.getRemoteUids());
      setLocalUid(AgoraService.getLocalUid());
      setIsCallReady(true);
    }
  };

  const updateParticipants = () => {
    if (provider === 'daily' && callObjectRef.current) {
      const participants = callObjectRef.current.participants();
      setParticipants(Object.values(participants));
    }
  };

  const updateAgoraParticipants = () => {
    if (provider === 'agora') {
      // Agora participants are tracked via remoteUids
      setParticipants(remoteUids.map(uid => ({ uid, local: false })));
    }
  };

  const toggleMute = async () => {
    try {
      if (provider === 'daily' && callObjectRef.current) {
        await callObjectRef.current.setLocalAudio(!isAudioMuted);
        setIsAudioMuted(!isAudioMuted);
      } else if (provider === 'agora' && engineRef.current) {
        await AgoraService.setLocalAudio(!isAudioMuted);
        setIsAudioMuted(!isAudioMuted);
      }
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      Alert.alert('Error', 'Failed to toggle microphone');
    }
  };

  const toggleSpeaker = async () => {
    try {
      if (provider === 'daily') {
        // Daily.co speaker control - simplified for demo
        setIsSpeakerEnabled(!isSpeakerEnabled);
        console.log(`🔊 Speaker ${!isSpeakerEnabled ? 'enabled' : 'disabled'} on Daily.co`);
      } else if (provider === 'agora') {
        // Agora speaker control - simplified for demo
        setIsSpeakerEnabled(!isSpeakerEnabled);
        console.log(`🔊 Speaker ${!isSpeakerEnabled ? 'enabled' : 'disabled'} on Agora`);
      }
    } catch (error) {
      console.error('Failed to toggle speaker:', error);
      Alert.alert('Error', `Failed to toggle speaker on ${provider.toUpperCase()}`);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    Alert.alert('End Call', `End ${provider.toUpperCase()} audio call with ${contactName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Call', style: 'destructive', onPress: onEndCall },
    ]);
  };

  const handleQuickEndCall = () => {
    onEndCall();
  };

  const providerColor = provider === 'agora' ? '#00A6FB' : '#9C27B0';
  const providerName = provider === 'agora' ? 'AGORA' : 'DAILY.CO';

  return (
    <PermissionGate
      permission="teleconsultation-audio"
      context={{
        feature: 'audio-consultation',
        priority: 'critical',
        userInitiated: true,
        educationalContent: {
          title: 'Audio Consultation Access',
          description: `Connect with ${contactName} via secure audio call for your medical consultation.`,
          benefits: [
            'Clear audio communication with your healthcare provider',
            'Secure and private medical consultation',
            'Perfect for medical discussions and symptom description',
            'Lower bandwidth requirements for reliable connection',
          ],
        },
        fallbackStrategy: {
          mode: 'alternative',
          description: 'Text-based consultation available',
          limitations: ['No voice communication', 'Text-only interaction'],
          alternativeApproach: 'chat-consultation',
        },
      }}
      fallbackContent={
        <View style={styles.container}>
          <View style={styles.fallbackContainer}>
            <Ionicons name="chatbubbles" size={48} color="#0066cc" />
            <Text style={styles.fallbackTitle}>Text-Based Consultation</Text>
            <Text style={styles.fallbackText}>
              Microphone access not available. You can still communicate with {contactName} via text
              messages.
            </Text>
          </View>
        </View>
      }
      onPermissionGranted={() => {
        console.log('✅ Audio consultation permissions granted');
      }}
      onPermissionDenied={() => {
        console.log('❌ Audio consultation permissions denied');
      }}
      onFallbackUsed={() => {
        console.log('🔄 Using text-based fallback for consultation');
      }}
    >
      <SafeAreaView style={styles.container}>
        {/* Background gradient effect */}
        <View style={[styles.backgroundGradient, { backgroundColor: providerColor }]} />

        {/* Header with Quick End Call */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.quickEndButton} onPress={handleQuickEndCall}>
            <Ionicons name="close" size={20} color="#FF3B30" />
          </TouchableOpacity>
          <View style={[styles.providerBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.providerText}>{providerName}</Text>
          </View>
        </View>

        {/* Call Info */}
        <View style={styles.callInfo}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={60} color="#fff" />
            </View>
            <View
              style={[
                styles.audioIndicator,
                { backgroundColor: isAudioMuted ? '#FF3B30' : '#4CAF50' },
              ]}
            >
              <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={16} color="#fff" />
            </View>
          </View>

          <Text style={styles.contactName}>{contactName}</Text>
          <Text style={styles.callStatus}>
            Audio Call • {formatDuration(callDuration)}
            {isCallReady && participants.length > 0 && (
              <Text style={styles.participantInfo}>
                {' '}
                • {participants.filter((p: any) => !p.local).length + 1} participants
              </Text>
            )}
          </Text>
          <Text style={styles.channelInfo}>Channel: {channelName}</Text>
        </View>

        {/* Audio Waveform Effect - Demo */}
        <View style={styles.waveformContainer}>
          {[...Array(5)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: Math.random() * 40 + 10,
                  backgroundColor: isAudioMuted ? '#FF3B30' : '#4CAF50',
                },
              ]}
            />
          ))}
        </View>

        {/* Control Buttons */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, isAudioMuted && styles.controlButtonActive]}
            onPress={toggleMute}
          >
            <Ionicons
              name={isAudioMuted ? 'mic-off' : 'mic'}
              size={24}
              color={isAudioMuted ? '#FF3B30' : '#fff'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isSpeakerEnabled && styles.controlButtonActive]}
            onPress={toggleSpeaker}
          >
            <Ionicons name="volume-high" size={24} color={isSpeakerEnabled ? '#4CAF50' : '#fff'} />
          </TouchableOpacity>

          {/* Primary End Call Button - Quick Action */}
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton, styles.prominentEndCall]}
            onPress={handleQuickEndCall}
          >
            <Ionicons name="call" size={28} color="#fff" />
            <Text style={styles.endCallText}>End</Text>
          </TouchableOpacity>

          {/* Secondary End Call Option with Confirmation */}
          <TouchableOpacity
            style={[styles.controlButton, styles.secondaryEndCall]}
            onPress={handleEndCall}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Connection Quality Indicator */}
        <View style={styles.qualityIndicator}>
          <Ionicons
            name="wifi"
            size={16}
            color={
              connectionQuality === 'excellent'
                ? '#4CAF50'
                : connectionQuality === 'good'
                  ? '#FF9800'
                  : '#FF3B30'
            }
          />
          <Text style={styles.qualityText}>
            {connectionQuality === 'excellent'
              ? 'Excellent'
              : connectionQuality === 'good'
                ? 'Good'
                : connectionQuality === 'poor'
                  ? 'Poor'
                  : 'Unknown'}{' '}
            Connection
          </Text>
        </View>
      </SafeAreaView>
    </PermissionGate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '70%',
    opacity: 0.1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  quickEndButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  providerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  providerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  callInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  audioIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contactName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  callStatus: {
    fontSize: 18,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 4,
  },
  channelInfo: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  participantInfo: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  waveformContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  waveformText: {
    fontSize: 14,
    color: '#999',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 40,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
  },
  qualityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
  },
  qualityText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#fff',
  },
  // Enhanced styles for mobile audio calling experience
  prominentEndCall: {
    width: 80,
    height: 80,
    borderRadius: 40,
    flexDirection: 'column',
    paddingVertical: 8,
  },
  endCallText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  secondaryEndCall: {
    backgroundColor: '#666',
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  // ✅ Permission Gate Fallback Styles
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#000',
  },
  fallbackTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default SimpleAudioCallScreen;
