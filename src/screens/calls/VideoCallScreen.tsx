import type { DailyCall } from '@daily-co/react-native-daily-js';
import { DailyMediaView } from '@daily-co/react-native-daily-js';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
// ✅ REMOVED: Unused imports for conditional logic
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Alert,
  Platform,
  AppState,
  BackHandler,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAdaptiveTheme } from '../../components/adaptive/AdaptiveComponents';
import { EnhancedDailyVideoTile } from '../../components/calls/EnhancedDailyVideoTile';
import VideoCallPreflight from '../../components/calls/VideoCallPreflight';
import PermissionGate from '../../components/permissions/PermissionGate';
import { OFFICIAL_DAILY_CONFIG } from '../../config/dailyOfficialConfig';
import { COLORS } from '../../constants';
import DailyCallContext from '../../hooks/daily/DailyCallContext';
import { useActiveSpeaker } from '../../hooks/daily/useActiveSpeaker';
import { useOfficialCallControls } from '../../hooks/daily/useOfficialCallControls';
import { useOfficialParticipants } from '../../hooks/daily/useOfficialParticipants';
import { OfficialDailyCallManager } from '../../services/OfficialDailyCallManager';
import type { RootStackParamList, CallStackParamList } from '../../types';

// Daily.co video view components
// ✅ FIXED: DailyMediaView imported directly above
// ✅ REMOVED: Conditional import logic that breaks APK builds

type VideoCallScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VideoCall'>;
interface VideoCallScreenRouteProp {
  params: CallStackParamList['VideoCall'];
}

interface VideoCallScreenProps {
  navigation: VideoCallScreenNavigationProp;
  route: VideoCallScreenRouteProp;
}

const VideoCallScreen: React.FC<VideoCallScreenProps> = () => {
  const navigation = useNavigation<VideoCallScreenNavigationProp>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

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

  // ✅ OFFICIAL: Video-specific state using official patterns
  const [isCallReady, setIsCallReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [preflightReady, setPreflightReady] = useState(false);
  const [preflightSuggestAudio, setPreflightSuggestAudio] = useState(false);
  const [lastButtonPress, setLastButtonPress] = useState<string>('None');

  // ✅ OFFICIAL: Screen-specific state for immersive experience
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isAppActive, setIsAppActive] = useState(true);
  const { isLowEndDevice, shouldUseShadows } = useAdaptiveTheme();

  // Standardized logging helpers for this screen
  const LOG_PREFIX = '🎬 [OfficialVideoCall]';
  const log = useCallback((...args: any[]) => console.log(LOG_PREFIX, ...args), []);
  const warn = useCallback((...args: any[]) => console.warn(LOG_PREFIX, ...args), []);
  const error = useCallback((...args: any[]) => console.error(LOG_PREFIX, ...args), []);

  // ✅ OFFICIAL: Performance optimizations with official call manager
  const callObjectRef = useRef<any>(null);
  const appStateRef = useRef<string>('active');
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const screenDimensionsRef = useRef(Dimensions.get('window'));
  const hasNavigatedRef = useRef(false);
  const hasEndedRef = useRef(false);

  // Adaptive overlay shadow style
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

  // ✅ CRITICAL: Screen focus effects for proper lifecycle management
  useFocusEffect(
    useCallback(() => {
      log('VideoCallScreen focused - entering immersive mode');

      // ✅ Enter immersive call mode
      const enterImmersiveMode = async () => {
        try {
          // Hide status bar for immersive experience
          StatusBar.setHidden(true, 'fade');

          // Allow screen rotation for video calls
          await ScreenOrientation.unlockAsync();

          // Prevent screen from sleeping during calls
          await activateKeepAwakeAsync('video-call');

          log('✅ Entered immersive video call mode');
        } catch (err) {
          warn('⚠️ Failed to enter immersive mode:', err);
        }
      };

      // ✅ Android back button handling
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleEndCallConfirmation();
        return true; // Prevent default behavior
      });

      enterImmersiveMode();

      return () => {
        log('VideoCallScreen unfocused - exiting immersive mode');

        // ✅ Exit immersive mode
        const exitImmersiveMode = async () => {
          try {
            // Show status bar
            StatusBar.setHidden(false, 'fade');

            // Lock orientation to portrait for other screens
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);

            // Allow screen to sleep
            deactivateKeepAwake('video-call');

            log('✅ Exited immersive video call mode');
          } catch (err) {
            warn('⚠️ Failed to exit immersive mode:', err);
          }
        };

        exitImmersiveMode();
        backHandler.remove();
      };
    }, [])
  );

  // ✅ ENHANCED: Orientation change handling for video calls
  useEffect(() => {
    const subscription = ScreenOrientation.addOrientationChangeListener(event => {
      const newOrientation = event.orientationInfo.orientation;
      const isLandscape =
        newOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        newOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

      setOrientation(isLandscape ? 'landscape' : 'portrait');
      log('🔄 Orientation changed to:', isLandscape ? 'landscape' : 'portrait');

      // Update screen dimensions
      const scaled = Dimensions.get('window');
      screenDimensionsRef.current = scaled;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ✅ ENHANCED: App state monitoring for video call protection
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      const wasBackground = appStateRef.current === 'background';
      const isNowActive = nextAppState === 'active';

      setIsAppActive(nextAppState === 'active');

      // ✅ Handle video call resume logic
      if (wasBackground && isNowActive && isConnected) {
        log('App resumed during active call, checking video state');
        handleCallResume();
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isConnected]);

  // ✅ OFFICIAL: Call setup using official call manager
  useEffect(() => {
    log(`Starting ${provider.toUpperCase()} video call with official patterns: ${roomUrl}`);

    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // ✅ OFFICIAL: Initialize call manager with video configuration
    const initializeCall = async () => {
      try {
        if (!preflightReady) {
          log('⏳ Waiting for preflight readiness before joining...');
          return;
        }
        const callManager = new OfficialDailyCallManager();
        callManagerRef.current = callManager;

        await callManager.initialize(
          {
            roomUrl,
            userName: contactName,
            callType: 'video', // ✅ OFFICIAL: Video mode
            joinMuted: OFFICIAL_DAILY_CONFIG.CALL_DEFAULTS.JOIN_MUTED,
          },
          {
            onJoinedMeeting: () => {
              log('✅ Joined video call successfully');
              setIsCallReady(true);
              setDebugInfo('Connected to video call');
            },
            onLeftMeeting: () => {
              log('❌ Left video call');
              setDebugInfo('Disconnected from video call');
              hasEndedRef.current = true;

              setTimeout(() => {
                if (!hasNavigatedRef.current) {
                  hasNavigatedRef.current = true;
                  navigation.goBack();
                }
              }, 1000);
            },
            onError: error => {
              error('❌ Video call error:', error);
              setDebugInfo(`Error: ${error.errorMsg || 'Unknown error'}`);
            },
            onActiveSpeakerChange: speaker => {
              log('🎤 Active speaker changed:', speaker?.displayName || 'None');
            },
            onTrackStarted: event => {
              log('🎥 Track started:', event);
              // ✅ DEBUG: Log track details
              console.log('🎥 [TRACK STARTED] Track details:', {
                participant: event?.participant?.user_name,
                sessionId: event?.participant?.session_id,
                track: event?.track?.kind,
                trackState: event?.track?.readyState,
              });
            },
            onTrackStopped: event => {
              log('🎥 Track stopped:', event);
              console.log('🎥 [TRACK STOPPED] Track details:', {
                participant: event?.participant?.user_name,
                sessionId: event?.participant?.session_id,
                track: event?.track?.kind,
              });
            },
          }
        );

        callObjectRef.current = callManager.getCallObject();
        setCallObject(callObjectRef.current);
      } catch (err) {
        error('Failed to initialize video call:', err);
      }
    };

    initializeCall();

    // Auto-hide controls after 5 seconds
    const hideControls = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(
        () => {
          setControlsVisible(false);
        },
        isLowEndDevice ? 3000 : 5000
      );
    };

    hideControls();

    return () => {
      clearInterval(timer);

      // ✅ OFFICIAL: Cleanup using official patterns
      if (callManagerRef.current) {
        callManagerRef.current
          .cleanup()
          .catch(err => warn('⚠️ Failed to cleanup video call manager', err));
      }

      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }

      log(`Ended ${provider.toUpperCase()} video call screen: ${roomUrl}`);
    };
  }, [roomUrl, provider, contactName, preflightReady]);

  // ✅ ENHANCED: Call resume logic for app state changes
  const handleCallResume = useCallback(async () => {
    if (!callManagerRef.current || !isCallReady) return;

    try {
      // Check if still connected using official manager
      const callObject = callManagerRef.current.getCallObject();
      if (callObject) {
        const meetingState = await callObject.meetingState();
        if (meetingState !== 'joined-meeting') {
          log('No longer in meeting, ending call');
          navigation.goBack();
        } else {
          log('✅ Call resume completed successfully');
        }
      }
    } catch (err) {
      error('❌ Failed to resume call:', err);
    }
  }, [isCallReady, navigation]);

  // ✅ ENHANCED: Screen interaction handlers
  const handleScreenTap = useCallback(() => {
    setControlsVisible(!controlsVisible);

    if (!controlsVisible) {
      // Auto-hide controls after showing them
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 5000);
    }
  }, [controlsVisible]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
    setControlsVisible(true);

    // Auto-hide controls in fullscreen mode
    if (!isFullscreen) {
      setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [isFullscreen]);

  // ✅ OFFICIAL: End call using official patterns
  const handleEndCall = useCallback(async () => {
    try {
      log('Ending video call with official patterns...');

      // ✅ OFFICIAL: Use official call controls
      await endCall();
      hasEndedRef.current = true;

      log('✅ Video call ended successfully');
    } catch (err) {
      error('Error ending video call:', err);
    } finally {
      // Always navigate back
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        navigation.goBack();
      }
    }
  }, [endCall, navigation]);

  // ✅ ENHANCED: End call handlers with confirmation
  const handleEndCallConfirmation = useCallback(() => {
    Alert.alert('End Call', `End video call with ${contactName}?`, [
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

  // ✅ RESPONSIVE: Get screen dimensions for layout
  const isLandscape = orientation === 'landscape';

  return (
    <PermissionGate
      permission="teleconsultation-video"
      context={{
        feature: 'video-consultation-screen',
        priority: 'critical',
        userInitiated: true,
        educationalContent: {
          title: 'Video Call Access Required',
          description: `Join video consultation with ${contactName}. Camera and microphone access are required for the call.`,
          benefits: [
            'High-quality video communication with healthcare providers',
            'Face-to-face consultation experience',
            'Visual examination capabilities',
            'Real-time interaction for better healthcare outcomes',
          ],
        },
        fallbackStrategy: {
          mode: 'alternative',
          description: 'Audio-only consultation available',
          limitations: ['No video communication', 'Limited visual examination'],
          alternativeApproach: 'audio-consultation',
        },
      }}
      fallbackContent={
        <View style={styles.container}>
          <View style={styles.fallbackContainer}>
            <Ionicons name="call" size={48} color="#0066cc" />
            <Text style={styles.fallbackTitle}>Audio-Only Consultation</Text>
            <Text style={styles.fallbackText}>
              Video access not available. You can still have an audio consultation with{' '}
              {contactName}.
            </Text>
            <TouchableOpacity
              style={styles.fallbackButton}
              onPress={() =>
                navigation.replace('AudioCall', { ...route.params, callType: 'audio' })
              }
            >
              <Text style={styles.fallbackButtonText}>Switch to Audio Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      onPermissionGranted={() => {
        console.log('✅ Video consultation screen permissions granted');
      }}
      onPermissionDenied={() => {
        console.log('❌ Video consultation screen permissions denied');
      }}
      onFallbackUsed={() => {
        console.log('🔄 Using audio-only fallback for video consultation screen');
      }}
    >
      <DailyCallContext.Provider value={callObject}>
        <View style={styles.container}>
          {/* Preflight gating block */}
          {!preflightReady && (
            <View style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 5 }}>
              <VideoCallPreflight
                callType="video"
                slim
                onReadyChange={setPreflightReady}
                onAssessmentChange={a => setPreflightSuggestAudio(!a.videoReady && a.audioReady)}
              />
              {/* ✅ REMOVED: DailyMediaView is now directly imported and available */}
            </View>
          )}
          <TouchableOpacity
            style={styles.videoArea}
            activeOpacity={1}
            onPress={handleScreenTap}
            accessibilityLabel="Video call area - Tap to show/hide controls"
          >
            {/* ✅ OFFICIAL: Remote Video with Native Track Access */}
            <View style={[styles.remoteVideo, isLandscape && styles.remoteVideoLandscape]}>
              {isCallReady && remoteParticipants.length > 0 ? (
                remoteParticipants.map((participant: any) => (
                  <EnhancedDailyVideoTile
                    key={participant.session_id}
                    videoTrackState={participant.tracks?.video || null}
                    audioTrackState={participant.tracks?.audio || null}
                    mirror={false}
                    type={remoteParticipants.length > 2 ? 1 : 2}
                    participantName={participant.user_name || 'Guest'}
                    isActiveSpeaker={activeSpeaker?.session_id === participant.session_id}
                    style={styles.remoteVideoView}
                  />
                ))
              ) : isCallReady && participants.length > 0 ? (
                participants
                  .filter((p: any) => !p.local)
                  .map((participant: any) => (
                    <DailyMediaView
                      key={participant.session_id}
                      style={styles.remoteVideoView}
                      videoTrack={
                        participant.tracks?.video?.state === 'playable'
                          ? participant.tracks.video.track
                          : null
                      }
                      audioTrack={
                        participant.tracks?.audio?.state === 'playable'
                          ? participant.tracks.audio.track
                          : null
                      }
                      mirror={false}
                      objectFit="cover"
                      zOrder={1}
                    />
                  ))
              ) : (
                <View style={styles.videoPlaceholder}>
                  <Ionicons name="person" size={80} color="#666" />
                  <Text style={styles.placeholderText}>
                    {!isConnected
                      ? `Connecting to ${contactName}...`
                      : `Waiting for ${contactName}`}
                  </Text>
                  <Text style={styles.placeholderSubtext}>
                    {!isCallReady
                      ? 'Establishing connection...'
                      : participants.length === 0
                        ? 'No remote participants'
                        : 'Daily.co Video Stream'}
                  </Text>
                </View>
              )}
            </View>

            {/* ✅ OFFICIAL: Local Video with Native Track Access */}
            <View
              style={[
                styles.localVideo,
                isLandscape ? styles.localVideoLandscape : styles.localVideoPortrait,
              ]}
            >
              {localParticipant && (
                <EnhancedDailyVideoTile
                  videoTrackState={localParticipant.tracks.video || null}
                  audioTrackState={localParticipant.tracks.audio || null}
                  mirror
                  type={0}
                  isLocal
                  isActiveSpeaker={false}
                  participantName={localParticipant.user_name || 'You'}
                  style={styles.localVideoView}
                />
              )}
              {!localParticipant && isCallReady && callObject && (
                <DailyMediaView
                  style={styles.localVideoView}
                  videoTrack={
                    callObject.participants().local.tracks.video.state === 'playable'
                      ? callObject.participants().local.tracks.video.track || null
                      : null
                  }
                  audioTrack={null}
                  mirror
                  objectFit="cover"
                  zOrder={2}
                />
              )}
              {!isCallReady && (
                <View style={[styles.localVideoPlaceholder, isVideoMuted && styles.mutedVideo]}>
                  {isVideoMuted ? (
                    <Ionicons name="videocam-off" size={24} color="#fff" />
                  ) : (
                    <Text style={styles.localVideoText}>You</Text>
                  )}
                </View>
              )}
            </View>

            {/* ✅ VISUAL DEBUG INFO: Always visible for real device debugging */}
            {true && (
              <View style={styles.debugPanel}>
                <Text style={styles.debugTitle}>🎬 Official Video Call Debug</Text>

                {/* ✅ CORE METRICS */}
                <Text style={styles.debugSectionTitle}>Core Status</Text>
                <Text style={styles.debugDetail}>Participants: {participantCount}</Text>
                <Text style={styles.debugDetail}>Connected: {isConnected ? '✅' : '❌'}</Text>
                <Text style={styles.debugDetail}>State: {connectionState}</Text>
                <Text style={styles.debugDetail}>Call Ready: {isCallReady ? '✅' : '❌'}</Text>
                <Text style={styles.debugDetail}>Video Muted: {isVideoMuted ? '✅' : '❌'}</Text>
                <Text style={styles.debugDetail}>Audio Muted: {isAudioMuted ? '✅' : '❌'}</Text>
                <Text style={styles.debugDetail}>
                  CallObj Available: {callObject ? '✅' : '❌'}
                </Text>
                <Text style={styles.debugDetail}>Last Button: {lastButtonPress}</Text>

                {/* ✅ SYSTEM INFO */}
                <Text style={styles.debugSectionTitle}>System</Text>
                <Text style={styles.debugDetail}>Platform: {Platform.OS}</Text>
                <Text style={styles.debugDetail}>Orientation: {orientation}</Text>
                <Text style={styles.debugDetail}>App Active: {isAppActive ? '✅' : '❌'}</Text>
                <Text style={styles.debugDetail}>
                  Controls: {controlsVisible ? 'Visible' : 'Hidden'}
                </Text>
                <Text style={styles.debugDetail}>
                  Active Speaker: {activeSpeaker?.user_name || 'None'}
                </Text>

                {/* ✅ VISUAL DEBUG: REMOTE PARTICIPANTS DETAILS */}
                {remoteParticipants.map((p: any, index: number) => (
                  <View key={p.session_id}>
                    <Text style={styles.debugSectionTitle}>Remote {index + 1}</Text>
                    <Text style={styles.debugDetail}>ID: {p.session_id?.substring(0, 8)}...</Text>
                    <Text style={styles.debugDetail}>
                      VideoState: {p.tracks?.video?.state || 'unknown'}
                    </Text>
                    <Text style={styles.debugDetail}>
                      AudioState: {p.tracks?.audio?.state || 'unknown'}
                    </Text>
                    <Text style={styles.debugDetail}>
                      HasVideoTrack: {p.tracks?.video?.track ? '✅' : '❌'}
                    </Text>
                    <Text style={styles.debugDetail}>
                      HasAudioTrack: {p.tracks?.audio?.track ? '✅' : '❌'}
                    </Text>
                  </View>
                ))}

                {/* ✅ VISUAL DEBUG: LOCAL PARTICIPANT DETAILS */}
                {localParticipant && (
                  <View>
                    <Text style={styles.debugSectionTitle}>Local</Text>
                    <Text style={styles.debugDetail}>
                      VideoState: {localParticipant.tracks.video.state || 'unknown'}
                    </Text>
                    <Text style={styles.debugDetail}>
                      AudioState: {localParticipant.tracks.audio.state || 'unknown'}
                    </Text>
                    <Text style={styles.debugDetail}>
                      HasVideoTrack: {localParticipant.tracks.video.track ? '✅' : '❌'}
                    </Text>
                    <Text style={styles.debugDetail}>
                      HasAudioTrack: {localParticipant.tracks.audio.track ? '✅' : '❌'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* ✅ OFFICIAL: Overlay Controls with Auto-hide */}
          {controlsVisible && (
            <>
              {/* Header */}
              <SafeAreaView style={[styles.headerOverlay, overlayShadowStyle]}>
                <View style={styles.header}>
                  <View style={styles.headerInfo}>
                    <Text style={styles.contactName}>{contactName}</Text>
                    <Text style={styles.callInfo}>Video Call • {formatDuration(callDuration)}</Text>
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.connectionIndicator,
                          {
                            backgroundColor: isConnected ? '#4CAF50' : '#FF9800',
                          },
                        ]}
                      />
                      <Text style={styles.connectionText}>
                        {isConnected ? 'Connected' : 'Connecting...'}
                      </Text>
                      {activeSpeaker && (
                        <View style={styles.activeSpeakerIndicator}>
                          <Ionicons name="mic" size={14} color="#4CAF50" />
                          <Text style={styles.activeSpeakerText}>
                            {activeSpeaker.user_name || 'Speaking'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.minimizeButton, overlayShadowStyle]}
                    onPress={toggleFullscreen}
                  >
                    <Ionicons
                      name={isFullscreen ? 'contract-outline' : 'expand-outline'}
                      size={24}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </SafeAreaView>

              {/* Controls - Fixed positioning with proper safe area handling */}
              <View style={[styles.controlsOverlay, overlayShadowStyle]}>
                <View
                  style={[
                    styles.controls,
                    isLandscape && styles.controlsLandscape,
                    { paddingBottom: Math.max(insets.bottom + 20, 30) },
                  ]}
                >
                  {preflightSuggestAudio && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -40,
                        left: 20,
                        right: 20,
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          padding: 8,
                          backgroundColor: 'rgba(255, 193, 7, 0.15)',
                          borderColor: 'rgba(255, 193, 7, 0.35)',
                          borderWidth: 1,
                          borderRadius: 10,
                        }}
                      >
                        <Ionicons name="information-circle-outline" size={14} color="#FFC107" />
                        <Text style={{ color: '#FFC107', fontSize: 12, flex: 1 }}>
                          Weak network detected. Audio-only may work better.
                        </Text>
                      </View>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      overlayShadowStyle,
                      isAudioMuted && styles.mutedButton,
                    ]}
                    onPress={() => {
                      console.log('🎤 Microphone button pressed, current state:', isAudioMuted);
                      console.log('🔧 Call object available:', !!callObject);
                      setLastButtonPress(`MIC at ${new Date().toLocaleTimeString()}`);
                      toggleAudio();
                    }}
                    activeOpacity={0.7}
                    accessibilityLabel={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                    accessibilityRole="button"
                  >
                    <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      overlayShadowStyle,
                      isVideoMuted && styles.mutedButton,
                    ]}
                    onPress={() => {
                      console.log('📹 Camera button pressed, current state:', isVideoMuted);
                      console.log('🔧 Call object available:', !!callObject);
                      setLastButtonPress(`CAM at ${new Date().toLocaleTimeString()}`);
                      toggleVideo();
                    }}
                    activeOpacity={0.7}
                    accessibilityLabel={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={isVideoMuted ? 'videocam-off' : 'videocam'}
                      size={24}
                      color="#fff"
                    />
                  </TouchableOpacity>

                  {/* ✅ OFFICIAL: Hand raise button for video calls */}
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      overlayShadowStyle,
                      hasRaisedHand && styles.activeButton,
                    ]}
                    onPress={toggleHandRaise}
                    activeOpacity={0.7}
                    accessibilityLabel={hasRaisedHand ? 'Lower hand' : 'Raise hand'}
                    accessibilityRole="button"
                  >
                    <Text style={styles.handRaiseButtonText}>
                      {OFFICIAL_DAILY_CONFIG.AUDIO_CALL_CONFIG.HAND_RAISE_EMOJI}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.controlButton, overlayShadowStyle, styles.endCallButton]}
                    onPress={handleEndCallConfirmation}
                    activeOpacity={0.7}
                    accessibilityLabel="End video call"
                    accessibilityRole="button"
                  >
                    <Ionicons name="call" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </DailyCallContext.Provider>
    </PermissionGate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoArea: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#222',
  },
  remoteVideoLandscape: {
    // Additional landscape-specific styles if needed
  },
  remoteVideoView: {
    flex: 1,
    backgroundColor: '#222',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  localVideo: {
    position: 'absolute',
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: '#444',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  localVideoPortrait: {
    top: 100,
    right: 20,
  },
  localVideoLandscape: {
    top: 20,
    right: 20,
    width: 100,
    height: 133,
  },
  localVideoView: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  localVideoPlaceholder: {
    flex: 1,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  mutedVideo: {
    backgroundColor: '#666',
  },
  localVideoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // ✅ OFFICIAL: Overlay styles for full-screen experience
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 15,
  },
  headerInfo: {
    flex: 1,
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
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    color: '#ccc',
  },
  activeSpeakerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeSpeakerText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  minimizeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },

  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 25,
    paddingHorizontal: 20,
    gap: 35,
    minHeight: 80,
  },
  controlsLandscape: {
    paddingVertical: 15,
    gap: 25,
    minHeight: 60,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  mutedButton: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  handRaiseButtonText: {
    fontSize: 24,
  },

  // ✅ DEBUG: Development panel
  debugPanel: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    maxHeight: 300,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 6,
    textAlign: 'center',
  },
  debugSectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 4,
    marginBottom: 2,
  },
  debugDetail: {
    fontSize: 9,
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

export default VideoCallScreen;
