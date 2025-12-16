import type { DailyCall } from '@daily-co/react-native-daily-js';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
  AppState,
  BackHandler,
  StatusBar,
  Animated,
} from 'react-native';

import { useAdaptiveTheme } from '../../components/adaptive/AdaptiveComponents';
import PermissionGate from '../../components/permissions/PermissionGate';
import { OFFICIAL_DAILY_CONFIG } from '../../config/dailyOfficialConfig';
import { COLORS } from '../../constants';
import DailyCallContext from '../../hooks/daily/DailyCallContext';
import { useActiveSpeaker } from '../../hooks/daily/useActiveSpeaker';
import { useOfficialCallControls } from '../../hooks/daily/useOfficialCallControls';
import { useOfficialParticipants } from '../../hooks/daily/useOfficialParticipants';
import { OfficialDailyCallManager } from '../../services/OfficialDailyCallManager';
import type { RootStackParamList, CallStackParamList } from '../../types';

type AudioCallScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AudioCall'>;
interface AudioCallScreenRouteProp {
  params: CallStackParamList['AudioCall'];
}

const AudioCallScreen: React.FC = () => {
  const navigation = useNavigation<AudioCallScreenNavigationProp>();
  const route = useRoute<any>();
  const { isLowEndDevice, shouldUseShadows } = useAdaptiveTheme();

  const overlayShadowStyle = useMemo(
    () =>
      shouldUseShadows()
        ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 6,
          }
        : {
            shadowColor: 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
          },
    [shouldUseShadows]
  );

  const LOG = '🔊 [OfficialAudioCall]';
  const log = (...args: any[]) => console.log(LOG, ...args);
  const warn = (...args: any[]) => console.warn(LOG, ...args);
  const error = (...args: any[]) => console.error(LOG, ...args);

  const { roomUrl, contactName, callType, contactId, contextType, provider, dailyCallObject } =
    route.params;

  // ✅ OFFICIAL: Use new official hooks for state management
  const [callDuration, setCallDuration] = useState(0);
  const [callManagerRef] = useState(() => React.createRef<OfficialDailyCallManager>());
  const [callObject, setCallObject] = useState<DailyCall | null>(
    route.params?.dailyCallObject || null
  );

  // ✅ OFFICIAL: Use official hooks for all call management
  const {
    participants,
    localParticipant,
    remoteParticipants,
    isConnected,
    connectionState,
    participantCount,
  } = useOfficialParticipants();

  const {
    isAudioMuted,
    isVideoMuted,
    toggleAudio,
    toggleVideo,
    toggleHandRaise,
    hasRaisedHand,
    endCall,
  } = useOfficialCallControls();

  const { activeSpeaker, speakerHistory } = useActiveSpeaker();

  // ✅ OFFICIAL: Audio-specific state using official patterns
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  const [isAppActive, setIsAppActive] = useState(true);
  const [isCallReady, setIsCallReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // ✅ OFFICIAL: Performance optimizations with official call manager
  const callObjectRef = useRef<any>(null);
  const hasNavigatedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const appStateRef = useRef<string>('active');
  const waveformAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const audioVisualizationInterval = useRef<NodeJS.Timeout | null>(null);

  // ✅ CRITICAL: Screen focus effects for audio call lifecycle management
  useFocusEffect(
    useCallback(() => {
      log('AudioCallScreen focused - entering audio mode');

      // ✅ Enter audio call mode
      const enterAudioMode = async () => {
        try {
          // Configure audio session for calls
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            staysActiveInBackground: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });

          // Prevent screen from sleeping during calls
          await activateKeepAwakeAsync('audio-call');

          log('✅ Entered audio call mode');
        } catch (err) {
          warn('⚠️ Failed to enter audio mode:', err);
        }
      };

      // ✅ Android back button handling
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleEndCallConfirmation();
        return true; // Prevent default behavior
      });

      enterAudioMode();

      return () => {
        log('AudioCallScreen unfocused - exiting audio mode');

        // ✅ Exit audio mode
        const exitAudioMode = async () => {
          try {
            // Reset audio session
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              staysActiveInBackground: false,
              playsInSilentModeIOS: false,
              shouldDuckAndroid: false,
              playThroughEarpieceAndroid: false,
            });

            // Allow screen to sleep
            deactivateKeepAwake('audio-call');

            log('✅ Exited audio call mode');
          } catch (err) {
            warn('⚠️ Failed to exit audio mode:', err);
          }
        };

        exitAudioMode();
        backHandler.remove();
      };
    }, [])
  );

  // ✅ ENHANCED: App state monitoring for audio call protection
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      setIsAppActive(nextAppState === 'active');
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // ✅ OFFICIAL: Call setup using official call manager
  useEffect(() => {
    log(`Starting ${provider.toUpperCase()} audio call with official patterns: ${roomUrl}`);

    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // ✅ OFFICIAL: Initialize call manager with audio-only configuration
    const initializeCall = async () => {
      try {
        const callManager = new OfficialDailyCallManager();
        callManagerRef.current = callManager;

        await callManager.initialize(
          {
            roomUrl,
            userName: contactName,
            callType: 'audio', // ✅ OFFICIAL: Audio-only mode
            joinMuted: OFFICIAL_DAILY_CONFIG.CALL_DEFAULTS.JOIN_MUTED,
          },
          {
            onJoinedMeeting: () => {
              log('✅ Joined audio call successfully');
              setIsCallReady(true);
              setDebugInfo('Connected to audio call');
              startAudioVisualization();
            },
            onLeftMeeting: () => {
              log('❌ Left audio call');
              setDebugInfo('Disconnected from audio call');
              hasEndedRef.current = true;
              stopAudioVisualization();

              setTimeout(() => {
                if (!hasNavigatedRef.current) {
                  hasNavigatedRef.current = true;
                  navigation.goBack();
                }
              }, 1000);
            },
            onError: error => {
              error('❌ Audio call error:', error);
              setDebugInfo(`Error: ${error.errorMsg || 'Unknown error'}`);
            },
            onActiveSpeakerChange: speaker => {
              log('🎤 Active speaker changed:', speaker?.displayName || 'None');
            },
          }
        );

        callObjectRef.current = callManager.getCallObject();
        setCallObject(callObjectRef.current);
      } catch (err) {
        error('Failed to initialize audio call:', err);
      }
    };

    initializeCall();

    return () => {
      clearInterval(timer);

      // ✅ OFFICIAL: Cleanup using official patterns
      if (callManagerRef.current) {
        callManagerRef.current
          .cleanup()
          .catch(err => warn('⚠️ Failed to cleanup audio call manager', err));
      }

      stopAudioVisualization();
      log(`Ended ${provider.toUpperCase()} audio call screen: ${roomUrl}`);
    };
  }, [roomUrl, provider, contactName]);

  // ✅ ENHANCED: Audio visualization for better UX
  const startAudioVisualization = useCallback(() => {
    if (audioVisualizationInterval.current) return;

    // Start waveform animation
    const startWaveform = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveformAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(waveformAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    // Start pulse animation for active speaker
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startWaveform();
    if (activeSpeaker) {
      startPulse();
    }

    log('✅ Started audio visualization');
  }, [activeSpeaker, waveformAnimation, pulseAnimation]);

  const stopAudioVisualization = useCallback(() => {
    if (audioVisualizationInterval.current) {
      clearInterval(audioVisualizationInterval.current);
      audioVisualizationInterval.current = null;
    }
    waveformAnimation.stopAnimation();
    pulseAnimation.stopAnimation();
    log('✅ Stopped audio visualization');
  }, [waveformAnimation, pulseAnimation]);

  // ✅ ENHANCED: Speaker toggle for audio calls
  const toggleSpeaker = useCallback(async () => {
    try {
      const newSpeakerState = !isSpeakerEnabled;
      setIsSpeakerEnabled(newSpeakerState);

      // Configure audio output
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: !newSpeakerState,
      });

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      log(`Speaker ${newSpeakerState ? 'enabled' : 'disabled'}`);
    } catch (err) {
      error('Error toggling speaker:', err);
      Alert.alert('Error', 'Failed to toggle speaker');
    }
  }, [isSpeakerEnabled]);

  // ✅ OFFICIAL: End call using official patterns
  const handleEndCall = useCallback(async () => {
    try {
      log('Ending audio call with official patterns...');

      // ✅ OFFICIAL: Use official call controls
      await endCall();
      hasEndedRef.current = true;

      log('✅ Audio call ended successfully');
    } catch (err) {
      error('Error ending audio call:', err);
    } finally {
      // Always navigate back
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        navigation.goBack();
      }
    }
  }, [endCall, navigation]);

  const handleEndCallConfirmation = useCallback(() => {
    Alert.alert('End Call', `End audio call with ${contactName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Call', style: 'destructive', onPress: handleEndCall },
    ]);
  }, [contactName, handleEndCall]);

  // ✅ ENHANCED: Utility functions
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <PermissionGate
      permission="teleconsultation-audio"
      context={{
        feature: 'audio-consultation-screen',
        priority: 'critical',
        userInitiated: true,
        educationalContent: {
          title: 'Audio Call Access Required',
          description: `Join audio consultation with ${contactName}. Microphone access is required for the call.`,
          benefits: [
            'Clear audio communication with healthcare providers',
            'Secure and private medical consultation',
            'Real-time medical discussion and consultation',
            'Lower bandwidth requirements for stable connection',
          ],
        },
        fallbackStrategy: {
          mode: 'alternative',
          description: 'Text-based consultation available',
          limitations: ['No voice communication', 'Text-only interaction'],
          alternativeApproach: 'text-consultation',
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
            <TouchableOpacity style={styles.fallbackButton} onPress={() => navigation.goBack()}>
              <Text style={styles.fallbackButtonText}>Return to Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      onPermissionGranted={() => {
        console.log('✅ Audio consultation screen permissions granted');
      }}
      onPermissionDenied={() => {
        console.log('❌ Audio consultation screen permissions denied');
      }}
      onFallbackUsed={() => {
        console.log('🔄 Using text-based fallback for audio consultation screen');
      }}
    >
      <DailyCallContext.Provider value={callObject}>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />

          {/* ✅ ENHANCED: Header with call info */}
          <View style={[styles.header, overlayShadowStyle]}>
            <View style={styles.headerInfo}>
              <Text style={styles.contactName}>{contactName}</Text>
              <Text style={styles.callInfo}>
                Audio Call • {formatDuration(callDuration)} • {participantCount} participant
                {participantCount !== 1 ? 's' : ''}
              </Text>
              <View style={styles.connectionStatus}>
                <View
                  style={[
                    styles.connectionDot,
                    {
                      backgroundColor: isConnected ? '#4CAF50' : '#FF9800',
                    },
                  ]}
                />
                <Text style={styles.connectionText}>
                  {isConnected ? 'Connected' : 'Connecting...'}
                </Text>
              </View>
            </View>
          </View>

          {/* ✅ ENHANCED: Audio visualization area */}
          <View style={styles.visualizationArea}>
            <Animated.View
              style={[
                styles.audioWaveform,
                {
                  opacity: waveformAnimation,
                  transform: [{ scale: activeSpeaker ? pulseAnimation : 1 }],
                },
              ]}
            >
              <View style={styles.waveformContainer}>
                {[...Array(5)].map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveformBar,
                      {
                        height: 20 + (i % 3) * 15,
                        opacity: waveformAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                      },
                    ]}
                  />
                ))}
              </View>
            </Animated.View>

            {activeSpeaker && (
              <Text style={styles.activeSpeakerText}>
                🎤 {activeSpeaker.user_name || 'Speaking'}
              </Text>
            )}
          </View>

          {/* ✅ OFFICIAL: Participants List using official patterns */}
          <ScrollView
            style={styles.participantsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.participantsContainer}
          >
            {/* ✅ OFFICIAL: LOCAL PARTICIPANT */}
            {localParticipant && (
              <View style={[styles.participantItem, styles.localParticipant]}>
                <View style={styles.participantInfo}>
                  <View style={[styles.avatarContainer, styles.localAvatar]}>
                    <Text style={styles.avatarText}>
                      {localParticipant.user_name.charAt(0).toUpperCase() || 'M'}
                    </Text>
                    <View
                      style={[
                        styles.micIndicator,
                        {
                          backgroundColor: isAudioMuted ? '#FF3B30' : '#4CAF50',
                        },
                      ]}
                    >
                      <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={12} color="#fff" />
                    </View>
                  </View>
                  <View style={styles.participantDetails}>
                    <Text style={styles.participantName}>You</Text>
                    <Text style={styles.participantRole}>Host</Text>
                    <Text style={styles.participantStatus}>
                      {isAudioMuted ? 'Muted' : 'Speaking'}
                    </Text>
                  </View>
                </View>

                {hasRaisedHand && (
                  <View style={styles.handRaiseIndicator}>
                    <Text style={styles.handRaiseEmoji}>
                      {OFFICIAL_DAILY_CONFIG.AUDIO_CALL_CONFIG.HAND_RAISE_EMOJI}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ✅ OFFICIAL: REMOTE PARTICIPANTS using official hooks */}
            {remoteParticipants.map((participant: any, index: number) => {
              const isCurrentSpeaker = activeSpeaker?.session_id === participant.session_id;
              const hasHandRaised =
                participant.user_name?.includes(
                  OFFICIAL_DAILY_CONFIG.AUDIO_CALL_CONFIG.HAND_RAISE_EMOJI
                ) || false;
              const displayName =
                participant.user_name
                  ?.replace(OFFICIAL_DAILY_CONFIG.AUDIO_CALL_CONFIG.HAND_RAISE_EMOJI, '')
                  .trim() || `Participant ${index + 1}`;

              return (
                <View
                  key={participant.session_id}
                  style={[styles.participantItem, isCurrentSpeaker && styles.activeSpeakerItem]}
                >
                  <View style={styles.participantInfo}>
                    <View
                      style={[
                        styles.avatarContainer,
                        isCurrentSpeaker && styles.activeSpeakerAvatar,
                      ]}
                    >
                      <Text style={[styles.avatarText]}>{displayName.charAt(0).toUpperCase()}</Text>
                      <View
                        style={[
                          styles.micIndicator,
                          {
                            backgroundColor: participant.audio ? '#4CAF50' : '#666',
                          },
                        ]}
                      >
                        <Ionicons
                          name={participant.audio ? 'mic' : 'mic-off'}
                          size={12}
                          color="#fff"
                        />
                      </View>

                      {/* ✅ OFFICIAL: Active speaker visual indicator */}
                      {isCurrentSpeaker && (
                        <View style={styles.speakingIndicator}>
                          <View style={[styles.speakingDot, { opacity: 1 }]} />
                          <View style={[styles.speakingDot, { opacity: 0.7 }]} />
                          <View style={[styles.speakingDot, { opacity: 0.4 }]} />
                        </View>
                      )}
                    </View>

                    <View style={styles.participantDetails}>
                      <Text
                        style={[
                          styles.participantName,
                          isCurrentSpeaker && styles.activeSpeakerName,
                        ]}
                      >
                        {displayName}
                      </Text>
                      <Text style={styles.participantRole}>
                        {index === 0 ? 'Guest' : 'Listener'}
                      </Text>
                      <Text
                        style={[
                          styles.participantStatus,
                          isCurrentSpeaker && styles.activeSpeakerStatus,
                        ]}
                      >
                        {isCurrentSpeaker ? 'Speaking' : participant.audio ? 'Connected' : 'Muted'}
                      </Text>
                    </View>
                  </View>

                  {/* ✅ OFFICIAL: Hand raise indicator */}
                  {hasHandRaised && (
                    <View style={styles.handRaiseIndicator}>
                      <Text style={styles.handRaiseEmoji}>
                        {OFFICIAL_DAILY_CONFIG.AUDIO_CALL_CONFIG.HAND_RAISE_EMOJI}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            {participantCount === 1 && (
              <View style={styles.emptyState}>
                <Ionicons name="people" size={48} color="#666" />
                <Text style={styles.emptyStateText}>Waiting for participants to join...</Text>
                <Text style={styles.emptyStateSubtext}>Share the room link to invite others</Text>
              </View>
            )}
          </ScrollView>

          {/* ✅ ENHANCED: Control buttons for audio calls */}
          <View style={[styles.controlsContainer, overlayShadowStyle]}>
            <View style={styles.controls}>
              <TouchableOpacity
                style={[styles.controlButton, isSpeakerEnabled && styles.activeButton]}
                onPress={toggleSpeaker}
              >
                <Ionicons
                  name={isSpeakerEnabled ? 'volume-high' : 'volume-low'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, isAudioMuted && styles.mutedButton]}
                onPress={toggleAudio}
              >
                <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, hasRaisedHand && styles.activeButton]}
                onPress={toggleHandRaise}
              >
                <Text style={styles.handRaiseButtonText}>
                  {OFFICIAL_DAILY_CONFIG.AUDIO_CALL_CONFIG.HAND_RAISE_EMOJI}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, styles.endCallButton]}
                onPress={handleEndCallConfirmation}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ✅ OFFICIAL DEBUG INFO: Development and testing with official patterns */}
          {(__DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEBUG === 'true') && (
            <View style={styles.debugPanel}>
              <Text style={styles.debugTitle}>🔊 Official Audio Call Debug</Text>
              <Text style={styles.debugDetail}>Participants: {participantCount}</Text>
              <Text style={styles.debugDetail}>Ready: {isCallReady ? '✅' : '❌'}</Text>
              <Text style={styles.debugDetail}>Connected: {isConnected ? '✅' : '❌'}</Text>
              <Text style={styles.debugDetail}>State: {connectionState}</Text>
              <Text style={styles.debugDetail}>Muted: {isAudioMuted ? '✅' : '❌'}</Text>
              <Text style={styles.debugDetail}>
                Hand:{' '}
                {hasRaisedHand ? OFFICIAL_DAILY_CONFIG.AUDIO_CALL_CONFIG.HAND_RAISE_EMOJI : '❌'}
              </Text>
              <Text style={styles.debugDetail}>
                Active Speaker: {activeSpeaker?.user_name || 'None'}
              </Text>
              <Text style={styles.debugDetail}>App Active: {isAppActive ? '✅' : '❌'}</Text>

              {/* ✅ OFFICIAL: PARTICIPANT DETAILS */}
              {localParticipant && (
                <Text style={styles.debugDetail}>
                  Local: {localParticipant.audio ? '🎤' : '🔇'}{' '}
                  {localParticipant.user_name || 'Unknown'}
                </Text>
              )}
              {remoteParticipants.map((p: any, i: number) => (
                <Text key={p.session_id || i} style={styles.debugDetail}>
                  Remote{i}: {p.audio ? '🎤' : '🔇'} {p.user_name || 'Unknown'}
                </Text>
              ))}
            </View>
          )}
        </SafeAreaView>
      </DailyCallContext.Provider>
    </PermissionGate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerInfo: {
    alignItems: 'center',
  },
  contactName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  callInfo: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 8,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    color: '#ccc',
  },

  visualizationArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  audioWaveform: {
    marginBottom: 20,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 4,
  },
  waveformBar: {
    width: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  activeSpeakerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
  },

  participantsList: {
    flex: 1,
    maxHeight: 300,
  },
  participantsContainer: {
    padding: 20,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  localParticipant: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  activeSpeakerItem: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  localAvatar: {
    backgroundColor: '#4CAF50',
  },
  activeSpeakerAvatar: {
    backgroundColor: '#4CAF50',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  activeSpeakerAvatarText: {
    color: '#fff',
  },
  micIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakingIndicator: {
    position: 'absolute',
    top: -5,
    right: -5,
    flexDirection: 'row',
    gap: 2,
  },
  speakingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4CAF50',
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  activeSpeakerName: {
    color: '#4CAF50',
  },
  participantRole: {
    fontSize: 14,
    color: '#999',
    marginBottom: 2,
  },
  participantStatus: {
    fontSize: 12,
    color: '#ccc',
  },
  activeSpeakerStatus: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  handRaiseIndicator: {
    marginLeft: 10,
  },
  handRaiseEmoji: {
    fontSize: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },

  controlsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#4CAF50',
  },
  mutedButton: {
    backgroundColor: '#FF3B30',
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  handRaiseButtonText: {
    fontSize: 24,
  },

  // Debug panel
  debugPanel: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    maxHeight: 200,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
  },
  debugDetail: {
    fontSize: 10,
    color: '#ccc',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 12,
  },

  // ✅ Permission Gate Fallback Styles
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#1a1a1a',
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
    marginBottom: 30,
  },
  fallbackButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  fallbackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AudioCallScreen;
