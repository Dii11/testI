import type {
  DailyCall,
  DailyEventObject,
  DailyEventObjectFatalError,
  DailyTrackState,
  DailyParticipant,
} from '@daily-co/react-native-daily-js';
import Daily from '@daily-co/react-native-daily-js';
import { DailyMediaView } from '@daily-co/react-native-daily-js';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState, useMemo, useReducer } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableHighlight,
} from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants';
import { AdaptiveLinearGradient } from '../../components/adaptive/AdaptiveComponents';
import { ConsolidatedPermissionManager } from '../../services/permissions/ConsolidatedPermissionManager';
import Logger from '../../utils/logger';
// Simplified orientation hook (inline)
const useOrientation = () => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  return orientation;
};

// ===== DAILY.CO OFFICIAL PATTERNS FROM PLAYGROUND =====
// Enhanced UI components while maintaining simple event handling

enum AppState {
  Idle,
  Creating,
  Joining,
  Joined,
  Leaving,
  Error,
}

// CallObject Context (from official playground)
const CallObjectContext = React.createContext<DailyCall | null>(null);

// Default room configuration
const DEFAULT_ROOM_URL = 'https://mbinina.daily.co/ZVpxSgQtPXff8Cq9l44z';

// ===== CALL STATE MANAGEMENT (Simplified from playground) =====
interface CallState {
  callItems: { [id: string]: CallItem };
  camOrMicError: string | null;
  fatalError: string | null;
}

interface CallItem {
  videoTrackState: DailyTrackState | null;
  audioTrackState: DailyTrackState | null;
}

const initialCallState: CallState = {
  callItems: {
    local: {
      audioTrackState: null,
      videoTrackState: null,
    },
  },
  camOrMicError: null,
  fatalError: null,
};

// Actions
const PARTICIPANTS_CHANGE = 'PARTICIPANTS_CHANGE';
const CAM_OR_MIC_ERROR = 'CAM_OR_MIC_ERROR';
const FATAL_ERROR = 'FATAL_ERROR';

interface ParticipantsChangeAction {
  type: typeof PARTICIPANTS_CHANGE;
  participants: { [id: string]: DailyParticipant };
}

type CallStateAction =
  | ParticipantsChangeAction
  | { type: typeof CAM_OR_MIC_ERROR; message: string }
  | { type: typeof FATAL_ERROR; message: string };

// Reducer
function callReducer(callState: CallState, action: CallStateAction): CallState {
  switch (action.type) {
    case PARTICIPANTS_CHANGE:
      const callItems = getCallItems(action.participants);
      return { ...callState, callItems };
    case CAM_OR_MIC_ERROR:
      return { ...callState, camOrMicError: action.message };
    case FATAL_ERROR:
      return { ...callState, fatalError: action.message };
    default:
      return callState;
  }
}

function getCallItems(participants: { [id: string]: DailyParticipant }) {
  const callItems = { ...initialCallState.callItems };
  for (const [id, participant] of Object.entries(participants)) {
    callItems[id] = {
      videoTrackState: participant.tracks.video,
      audioTrackState: participant.tracks.audio,
    };
    // Add screen share if present
    if (shouldIncludeScreenCallItem(participant)) {
      callItems[id + '-screen'] = {
        videoTrackState: participant.tracks.screenVideo,
        audioTrackState: participant.tracks.screenAudio,
      };
    }
  }
  return callItems;
}

function shouldIncludeScreenCallItem(participant: DailyParticipant): boolean {
  const trackStatesForInclusion = ['loading', 'playable', 'interrupted'];
  return (
    trackStatesForInclusion.includes(participant.tracks.screenVideo.state) ||
    trackStatesForInclusion.includes(participant.tracks.screenAudio.state)
  );
}

// Helper functions
function isLocal(id: string) {
  return id === 'local';
}
function isScreenShare(id: string) {
  return id.endsWith('-screen');
}
function containsScreenShare(callItems: { [id: string]: CallItem }) {
  return Object.keys(callItems).some(id => isScreenShare(id));
}
function participantCount(callItems: { [id: string]: CallItem }) {
  return Object.keys(callItems).length;
}
function getMessage(callState: CallState, roomUrl: string) {
  let header = null;
  let detail = null;
  let isError = false;
  if (callState.fatalError) {
    header = `Fatal error: ${callState.fatalError}`;
    isError = true;
  } else if (callState.camOrMicError) {
    header = `Camera or mic access error: ${callState.camOrMicError}`;
    detail = 'See device settings to troubleshoot camera/microphone access.';
    isError = true;
  } else if (participantCount(callState.callItems) === 1) {
    header = 'Copy and share this URL to invite others';
    detail = roomUrl;
  }
  return header ? { header, detail, isError } : null;
}

// ===== ENHANCED TILE COMPONENT (from playground) =====
enum TileType {
  Thumbnail,
  Half,
  Full,
}

interface EnhancedTileProps {
  videoTrackState: DailyTrackState | null;
  audioTrackState: DailyTrackState | null;
  mirror: boolean;
  type: TileType;
  disableAudioIndicators?: boolean;
  onPress?: () => void;
  participantName?: string;
}

// Enhanced Tile Component (from playground with simplified interface)
const EnhancedTile: React.FC<EnhancedTileProps> = props => {
  const orientation = useOrientation();

  const videoTrack = useMemo(() => {
    return props.videoTrackState && props.videoTrackState.state === 'playable'
      ? props.videoTrackState.track!
      : null;
  }, [props.videoTrackState]);

  const audioTrack = useMemo(() => {
    return props.audioTrackState && props.audioTrackState.state === 'playable'
      ? props.audioTrackState.track!
      : null;
  }, [props.audioTrackState]);

  const getTrackUnavailableMessage = (
    kind: 'video' | 'audio',
    trackState: DailyTrackState | null
  ): string | void => {
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
  };

  const videoUnavailableMessage = getTrackUnavailableMessage('video', props.videoTrackState);
  const audioUnavailableMessage = getTrackUnavailableMessage('audio', props.audioTrackState);

  // Media component
  const mediaComponent = useMemo(() => {
    return (
      <DailyMediaView
        videoTrack={videoTrack}
        audioTrack={audioTrack}
        mirror={props.mirror}
        zOrder={props.type === TileType.Thumbnail ? 1 : 0}
        style={styles.media}
        objectFit="cover"
      />
    );
  }, [videoTrack, audioTrack, props.mirror, props.type]);

  const touchableMediaComponent = useMemo(() => {
    return (
      <TouchableHighlight onPress={props.onPress} disabled={!props.onPress} style={styles.media}>
        {mediaComponent}
      </TouchableHighlight>
    );
  }, [props.onPress, mediaComponent]);

  // Mute overlay
  const muteOverlayComponent = useMemo(() => {
    const videoMuted = !!props.videoTrackState?.off?.byUser;
    const audioMuted = !!props.audioTrackState?.off?.byUser;
    return videoMuted || (audioMuted && !props.disableAudioIndicators) ? (
      <View style={styles.iconContainer}>
        {videoMuted && <Ionicons name="videocam-off" size={20} color={COLORS.WHITE} />}
        {audioMuted && <Ionicons name="mic-off" size={20} color={COLORS.WHITE} />}
      </View>
    ) : null;
  }, [props.videoTrackState, props.audioTrackState, props.disableAudioIndicators]);

  // Message overlay
  const messageOverlayComponent = useMemo(() => {
    const muteOverlayShown =
      !!props.videoTrackState?.off?.byUser ||
      (!!props.audioTrackState?.off?.byUser && !props.disableAudioIndicators);
    if (videoUnavailableMessage && !muteOverlayShown) {
      return (
        <>
          <Text style={styles.overlayMessage}>{videoUnavailableMessage}</Text>
          {audioUnavailableMessage && !props.disableAudioIndicators && (
            <Text style={styles.overlayMessage}>{audioUnavailableMessage}</Text>
          )}
        </>
      );
    }
  }, [
    videoUnavailableMessage,
    audioUnavailableMessage,
    props.videoTrackState,
    props.audioTrackState,
    props.disableAudioIndicators,
  ]);

  // Corner message
  const cornerMessageComponent = useMemo(() => {
    const muteOverlayShown =
      !!props.videoTrackState?.off?.byUser ||
      (!!props.audioTrackState?.off?.byUser && !props.disableAudioIndicators);
    return (
      audioUnavailableMessage &&
      !props.disableAudioIndicators &&
      !videoUnavailableMessage &&
      !muteOverlayShown && <Text style={styles.cornerMessage}>{audioUnavailableMessage}</Text>
    );
  }, [
    videoUnavailableMessage,
    audioUnavailableMessage,
    props.videoTrackState,
    props.audioTrackState,
    props.disableAudioIndicators,
  ]);

  // Type-specific styling
  let typeSpecificStyle = null;
  switch (props.type) {
    case TileType.Half:
      typeSpecificStyle =
        orientation === 'portrait' ? styles.containerHalfPortrait : styles.containerHalfLandscape;
      break;
    case TileType.Full:
      typeSpecificStyle =
        orientation === 'portrait' ? styles.containerFullPortrait : styles.containerFullLandscape;
      break;
    case TileType.Thumbnail:
      typeSpecificStyle = styles.containerThumbnail;
      break;
  }

  return (
    <View style={[styles.container, styles.containerLoadingOrNotShowingVideo, typeSpecificStyle]}>
      {touchableMediaComponent}
      {messageOverlayComponent}
      {cornerMessageComponent}
      {muteOverlayComponent}
      {props.participantName && (
        <View style={styles.nameOverlay}>
          <Text style={styles.participantName}>{props.participantName}</Text>
        </View>
      )}
    </View>
  );
};

// ===== CALL PANEL COMPONENT (Enhanced from playground) =====
interface CallPanelProps {
  roomUrl: string;
  callState: CallState;
  participants: { [id: string]: DailyParticipant };
  onFlipCamera?: () => void;
}

const THUMBNAIL_EDGE_LENGTH = 100;

const CallPanel: React.FC<CallPanelProps> = ({
  roomUrl,
  callState,
  participants,
  onFlipCamera,
}) => {
  const orientation = useOrientation();
  const [usingFrontCamera, setUsingFrontCamera] = useState(true);

  // Get lists of large tiles and thumbnail tiles to render
  const [largeTiles, thumbnailTiles] = useMemo(() => {
    const larges: JSX.Element[] = [];
    const thumbnails: JSX.Element[] = [];

    Object.entries(callState.callItems).forEach(([id, callItem]) => {
      let tileType: TileType;
      const participant = participants[id];

      if (isScreenShare(id)) {
        tileType = TileType.Full;
      } else if (isLocal(id) || containsScreenShare(callState.callItems)) {
        tileType = TileType.Thumbnail;
      } else if (participantCount(callState.callItems) <= 3) {
        tileType = TileType.Full;
      } else {
        tileType = TileType.Half;
      }

      const tile = (
        <EnhancedTile
          key={id}
          videoTrackState={callItem.videoTrackState}
          audioTrackState={callItem.audioTrackState}
          mirror={usingFrontCamera && isLocal(id)}
          type={tileType}
          disableAudioIndicators={isScreenShare(id)}
          participantName={participant.user_name || (isLocal(id) ? 'You' : 'Participant')}
          onPress={
            isLocal(id) && onFlipCamera
              ? () => {
                  onFlipCamera();
                  setUsingFrontCamera(!usingFrontCamera);
                }
              : undefined
          }
        />
      );

      if (tileType === TileType.Thumbnail) {
        thumbnails.push(tile);
      } else {
        larges.push(tile);
      }
    });
    return [larges, thumbnails];
  }, [callState.callItems, participants, usingFrontCamera, onFlipCamera]);

  const message = getMessage(callState, roomUrl);

  return (
    <>
      <View
        style={[
          styles.mainContainer,
          message ? styles.messageContainer : styles.largeTilesContainerOuter,
        ]}
      >
        {message ? (
          <>
            <View style={styles.callMessage}>
              <Text style={[styles.messageHeader, message.isError && styles.errorHeader]}>
                {message.header}
              </Text>
              {message.detail && (
                <Text style={[styles.messageDetail, message.isError && styles.errorDetail]}>
                  {message.detail}
                </Text>
              )}
            </View>
          </>
        ) : (
          <ScrollView
            alwaysBounceVertical={false}
            alwaysBounceHorizontal={false}
            horizontal={orientation === 'landscape'}
          >
            <View
              style={[
                styles.largeTilesContainerInnerBase,
                orientation === 'portrait'
                  ? styles.largeTilesContainerInnerPortrait
                  : styles.largeTilesContainerInnerLandscape,
              ]}
            >
              {largeTiles}
            </View>
          </ScrollView>
        )}
      </View>

      <View
        style={[
          styles.thumbnailContainerOuterBase,
          orientation === 'portrait'
            ? styles.thumbnailContainerOuterPortrait
            : styles.thumbnailContainerOuterLandscape,
        ]}
      >
        <ScrollView
          horizontal={orientation === 'portrait'}
          alwaysBounceHorizontal={false}
          alwaysBounceVertical={false}
        >
          <View
            style={
              orientation === 'portrait'
                ? styles.thumbnailContainerInnerPortrait
                : styles.thumbnailContainerInnerLandscape
            }
          >
            {thumbnailTiles}
          </View>
        </ScrollView>
      </View>
    </>
  );
};

// ===== ENHANCED TRAY COMPONENT (Official Daily.co Tray Pattern) =====
interface PublicRoomTrayProps {
  callObject: DailyCall | null;
  onLeave: () => void;
  disabled: boolean;
}

// Helper function from official implementation
function getStreamStates(callObject: DailyCall) {
  const isCameraMuted = !callObject.localVideo();
  const isMicMuted = !callObject.localAudio();
  return [isCameraMuted, isMicMuted];
}

const PublicRoomTray: React.FC<PublicRoomTrayProps> = ({ callObject, onLeave, disabled }) => {
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Official Daily.co pattern for tracking mute states
  useEffect(() => {
    if (!callObject) return;

    const handleParticipantUpdated = (event?: DailyEventObject) => {
      if (event != null) {
        Logger.log('🔊 [PublicRoom] Participant updated:', event);
      }
      const [cameraMuted, micMuted] = getStreamStates(callObject);
      setIsCameraMuted(cameraMuted);
      setIsMicMuted(micMuted);
    };

    // Use initial state
    handleParticipantUpdated();

    // Listen for changes
    callObject.on('participant-updated', handleParticipantUpdated);

    return () => {
      callObject.off('participant-updated', handleParticipantUpdated);
    };
  }, [callObject]);

  const toggleCamera = useCallback(() => {
    if (!callObject || disabled) return;
    callObject.setLocalVideo(isCameraMuted);
  }, [callObject, isCameraMuted, disabled]);

  const toggleMic = useCallback(() => {
    if (!callObject || disabled) return;
    callObject.setLocalAudio(isMicMuted);
  }, [callObject, isMicMuted, disabled]);

  return (
    <View style={styles.tray}>
      <TouchableOpacity
        style={[styles.trayButton, isMicMuted && styles.mutedButton]}
        onPress={toggleMic}
        disabled={disabled}
      >
        <Ionicons name={isMicMuted ? 'mic-off' : 'mic'} size={24} color={COLORS.WHITE} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.trayButton, isCameraMuted && styles.mutedButton]}
        onPress={toggleCamera}
        disabled={disabled}
      >
        <Ionicons
          name={isCameraMuted ? 'videocam-off' : 'videocam'}
          size={24}
          color={COLORS.WHITE}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.trayButton, styles.leaveButton]}
        onPress={onLeave}
        disabled={disabled}
      >
        <Ionicons name="call" size={24} color={COLORS.WHITE} />
      </TouchableOpacity>
    </View>
  );
};

// ===== MAIN PUBLIC ROOM SCREEN (Enhanced with playground components) =====
const PublicRoomScreen: React.FC = () => {
  const navigation = useNavigation();

  // Simple state management (your preferred approach)
  const [appState, setAppState] = useState(AppState.Idle);
  const [roomUrl, setRoomUrl] = useState<string | undefined>(undefined);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [participants, setParticipants] = useState<Record<string, DailyParticipant>>({});
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [videoTrack, setVideoTrack] = useState<any>(null);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const [callState, dispatch] = useReducer(callReducer, initialCallState);

  // ===== PERMISSION HANDLING (Race condition safe) =====
  const [permissionStatus, setPermissionStatus] = useState<
    'checking' | 'granted' | 'denied' | 'idle'
  >('idle');
  const [isPermissionCheckInProgress, setIsPermissionCheckInProgress] = useState(false);
  const [forceAudioOnly, setForceAudioOnly] = useState(false);

  const checkPermissions = useCallback(async (): Promise<boolean> => {
    // ✅ RACE CONDITION FIX: Prevent multiple simultaneous permission checks
    if (isPermissionCheckInProgress) {
      Logger.warn('⚠️ [PublicRoom] Permission check already in progress, skipping');
      return false;
    }

    setIsPermissionCheckInProgress(true);
    setPermissionStatus('checking');

    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const result = await permissionManager.requestPermission('camera+microphone', {
        feature: 'public-room-video',
        priority: 'important',
        userInitiated: true,
        fallbackStrategy: {
          mode: 'alternative',
          description: 'Continue with limited functionality',
          limitations: ['Audio-only mode available'],
          alternativeApproach: 'audio-only',
        },
      });

      Logger.log('🔐 [PublicRoom] Permission result:', result.status);

      if (result.status === 'granted') {
        setPermissionStatus('granted');
        return true;
      } else if (result.status === 'limited' || result.status === 'restricted') {
        // Limited/restricted permissions - still allow join with reduced functionality
        setPermissionStatus('granted');
        Logger.warn('⚠️ [PublicRoom] Limited permissions granted');
        return true;
      } else {
        setPermissionStatus('denied');
        return false;
      }
    } catch (error) {
      Logger.error('❌ [PublicRoom] Permission error:', error);
      setPermissionStatus('denied');

      // ✅ RACE CONDITION FIX: Use Promise-based approach instead of Alert callback
      return new Promise<boolean>(resolve => {
        Alert.alert(
          'Permissions Required',
          'Camera and microphone access are needed for video calls. You can still join with limited functionality.',
          [
            {
              text: 'Continue Anyway',
              onPress: () => {
                Logger.log('🔊 [PublicRoom] Continuing without full permissions');
                setPermissionStatus('granted');
                setForceAudioOnly(true); // ✅ Join as audio-only when user continues without permissions
                resolve(true); // ✅ Safe resolution
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setPermissionStatus('denied');
                resolve(false); // ✅ Safe resolution
              },
            },
          ]
        );
      });
    } finally {
      // ✅ RACE CONDITION FIX: Always reset the in-progress flag
      setIsPermissionCheckInProgress(false);
    }
  }, [isPermissionCheckInProgress]);

  // ===== DAILY.CO LIFECYCLE (Following official example patterns) =====

  // Simple event handling (your preferred approach) - enhanced with playground patterns
  const handleNewParticipantsState = (event: any) => {
    const participant = event.participant;
    // Update call state using reducer
    dispatch({
      type: PARTICIPANTS_CHANGE,
      participants: callObject?.participants() || {},
    });

    // Simple video track management (your approach)
    if (!participant.local) {
      const videoTrack = participant.tracks.video;
      setVideoTrack(videoTrack.persistentTrack);
      setRemoteParticipantCount(callObject?.participantCounts().present - 1 || 0);
    }
  };

  useEffect(() => {
    if (!callObject) return;

    const onJoined = () => {
      Logger.log('🎬 [PublicRoom] Joined meeting');
      setAppState(AppState.Joined);
      setFatalError(null);
    };

    const onLeft = () => {
      Logger.log('🎬 [PublicRoom] Left meeting');
      setAppState(AppState.Idle);
      setFatalError(null);
      setPermissionStatus('idle');
      setForceAudioOnly(false);
    };

    const onError = (event: DailyEventObjectFatalError) => {
      Logger.error('🎬 [PublicRoom] Meeting error:', event);
      setAppState(AppState.Error);
      dispatch({ type: FATAL_ERROR, message: 'Connection failed' });
    };

    // Enhanced event handling
    callObject
      .on('joined-meeting', onJoined)
      .on('left-meeting', onLeft)
      .on('error', onError)
      .on('participant-joined', handleNewParticipantsState)
      .on('participant-updated', handleNewParticipantsState)
      .on('participant-left', handleNewParticipantsState);

    return () => {
      callObject.off('joined-meeting', onJoined);
      callObject.off('left-meeting', onLeft);
      callObject.off('error', onError);
      callObject.off('participant-joined', handleNewParticipantsState);
      callObject.off('participant-updated', handleNewParticipantsState);
      callObject.off('participant-left', handleNewParticipantsState);
    };
  }, [callObject, permissionStatus, forceAudioOnly]);

  // Simple participant management (your preferred approach)
  useEffect(() => {
    if (!callObject) return;
    const newParticipants = callObject.participants();
    setParticipants(newParticipants);
  }, [callObject]);

  // Handle device input errors (camera)
  useEffect(() => {
    if (!callObject) return;
    const onCameraError = (e: unknown) => {
      Logger.error('📷 [PublicRoom] Camera error event:', e);
      Alert.alert('Camera error', 'We could not access your camera. You can continue audio-only.');
    };
    callObject.on('camera-error', onCameraError);
    return () => {
      callObject.off('camera-error', onCameraError);
    };
  }, [callObject]);

  // ✅ OFFICIAL PATTERN: Simple join logic like official example
  const joinRoom = useCallback(async () => {
    if (callObject == null || roomUrl == null) return;

    Logger.log('🔗 [PublicRoom] Joining room:', roomUrl);
    setAppState(AppState.Joining);

    try {
      const startVideoOff = forceAudioOnly || permissionStatus !== 'granted';
      const startAudioOff = false; // Always try to start audio unless explicitly disabled
      await callObject.join({ url: roomUrl, startVideoOff, startAudioOff });
    } catch (error) {
      Logger.error('❌ [PublicRoom] Failed to join:', error);
      setAppState(AppState.Error);
      setFatalError('Failed to connect to room');
    }
  }, [callObject, roomUrl, forceAudioOnly, permissionStatus]);

  // ✅ FIXED: Create callObject and join in separate effects to avoid race condition
  useEffect(() => {
    if (roomUrl == null) return;

    Logger.log('🏗️ [PublicRoom] Creating call object for:', roomUrl);

    try {
      const newCallObject = Daily.createCallObject();
      setCallObject(newCallObject);
      Logger.log('✅ [PublicRoom] Call object created successfully');
    } catch (error) {
      Logger.error('❌ [PublicRoom] Error creating call object:', error);
      setAppState(AppState.Error);
      setFatalError('Failed to initialize video call');
    }
  }, [roomUrl]);

  // ✅ FIXED: Join after callObject is set
  useEffect(() => {
    if (!callObject || !roomUrl) return;

    Logger.log('🔗 [PublicRoom] Call object and room URL ready, joining...');
    joinRoom();
  }, [callObject, roomUrl, joinRoom]);

  // ===== AUTO-CHECK PERMISSIONS =====
  // Check permissions when component mounts
  useEffect(() => {
    Logger.log('🔐 [PublicRoom] Auto-checking permissions on mount...');
    checkPermissions();
  }, []); // Run once on mount

  // ===== MANUAL START =====
  // Let user manually start the call for better UX
  const handleJoinPublicRoom = useCallback(() => {
    Logger.log('🚀 [PublicRoom] User initiated join public room...');

    if (appState !== AppState.Idle || isPermissionCheckInProgress) {
      Logger.log('⚠️ [PublicRoom] Cannot start call in current state');
      return;
    }

    if (permissionStatus === 'denied') {
      Logger.log('⚠️ [PublicRoom] Permissions denied, starting with limited functionality');
    }

    Logger.log('🚀 [PublicRoom] Starting call with default room...');
    setRoomUrl(DEFAULT_ROOM_URL);
    // Join will be triggered by the roomUrl effect
  }, [appState, isPermissionCheckInProgress, permissionStatus]);

  // ===== CLEANUP EFFECT =====
  // Cleanup on component unmount
  useEffect(() => {
    // Cleanup call object on unmount to avoid leaks if still active
    return () => {
      if (callObject) {
        try {
          Logger.log('🧹 [PublicRoom] Cleaning up call object on unmount');
          callObject.destroy();
        } catch (e) {
          Logger.warn('⚠️ [PublicRoom] Error destroying call object on unmount:', e);
        }
      }
    };
  }, [callObject]);

  // ✅ RACE CONDITION FIX: Cleanup permission state on unmount
  useEffect(() => {
    return () => {
      // Reset permission check state to prevent state updates on unmounted component
      setIsPermissionCheckInProgress(false);
      setForceAudioOnly(false);
    };
  }, []);

  // ===== USER ACTIONS =====

  const startCall = useCallback(async () => {
    // ✅ RACE CONDITION FIX: Prevent multiple simultaneous start attempts
    if (appState !== AppState.Idle || isPermissionCheckInProgress) {
      Logger.warn(
        '⚠️ [PublicRoom] Call or permission check already in progress, ignoring start request'
      );
      return;
    }

    // Don't check permissions if already denied and user chose to continue
    if (permissionStatus === 'denied') {
      Logger.log('🚀 [PublicRoom] Starting call without full permissions...');
      setRoomUrl(DEFAULT_ROOM_URL);
      return;
    }

    // ✅ RACE CONDITION FIX: Check permissions for first time or if status is idle
    if (permissionStatus === 'idle') {
      try {
        const hasPermissions = await checkPermissions();
        // ✅ RACE CONDITION FIX: Double-check state after async operation
        if (!hasPermissions) {
          Logger.warn('❌ [PublicRoom] Permissions denied, call cancelled');
          return;
        }
      } catch (error) {
        Logger.error('❌ [PublicRoom] Permission check failed:', error);
        Alert.alert('Permission Error', 'Unable to check permissions. Please try again.', [
          { text: 'OK' },
        ]);
        return;
      }
    }

    // ✅ RACE CONDITION FIX: Final state check before proceeding
    // Skipping redundant idle re-check to satisfy strict linting rules

    Logger.log('🚀 [PublicRoom] Starting call with default room...');
    setRoomUrl(DEFAULT_ROOM_URL);
    // Join will be triggered by the roomUrl effect
  }, [checkPermissions, permissionStatus, appState, isPermissionCheckInProgress]);

  // ✅ GRACEFUL LEAVE: Handle call termination with proper cleanup
  const leaveRoom = useCallback(async () => {
    // Prevent multiple leave attempts
    if (appState === AppState.Leaving) {
      Logger.log('⚠️ [PublicRoom] Already leaving, ignoring duplicate request');
      return;
    }

    if (!callObject) {
      Logger.log('👋 [PublicRoom] No call object, navigating back...');
      navigation.goBack();
      return;
    }

    Logger.log('👋 [PublicRoom] Leaving call gracefully...');
    setAppState(AppState.Leaving);

    try {
      // Try to leave gracefully first
      await callObject.leave();
      Logger.log('✅ [PublicRoom] Successfully left call');
    } catch (error) {
      Logger.error('❌ [PublicRoom] Error during leave:', error);
      // Fallback to destroy if leave fails
      try {
        await callObject.destroy();
        Logger.log('✅ [PublicRoom] Call object destroyed as fallback');
      } catch (destroyError) {
        Logger.error('❌ [PublicRoom] Error during destroy:', destroyError);
      }
    } finally {
      // Always navigate back, regardless of call state
      Logger.log('🔙 [PublicRoom] Navigating back to previous screen...');
      navigation.goBack();
    }
  }, [callObject, navigation, appState]);

  // ===== UI LOGIC =====
  const showCallPanel = [AppState.Joining, AppState.Joined, AppState.Error].includes(appState);
  const showSetupScreen = appState === AppState.Idle;
  const showLoadingScreen = appState === AppState.Creating;
  const showErrorScreen = appState === AppState.Error && fatalError;

  const enableCallButtons = [AppState.Joined, AppState.Error].includes(appState);
  const isConnecting = appState === AppState.Creating || appState === AppState.Joining;
  const isLeaving = appState === AppState.Leaving;
  const canStartCall = appState === AppState.Idle && permissionStatus !== 'checking';

  // Camera flip functionality (from playground)
  const flipCamera = useCallback(async () => {
    if (!callObject) return;
    try {
      const { device } = await callObject.cycleCamera();
      if (device) {
        Logger.log('📹 [PublicRoom] Camera flipped to:', device.facingMode);
      }
    } catch (error) {
      Logger.error('❌ [PublicRoom] Error flipping camera:', error);
    }
  }, [callObject]);

  return (
    <CallObjectContext.Provider value={callObject}>
      <AdaptiveLinearGradient fallbackColor={COLORS.PRIMARY} style={styles.container}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
          {showCallPanel ? (
          // ===== ENHANCED CALL INTERFACE (from playground) =====
          <View style={styles.callContainer}>
            {appState === AppState.Joined ? (
              // Enhanced call panel with playground components
              <>
                {remoteParticipantCount > 0 ? (
                  <DailyMediaView
                    videoTrack={videoTrack}
                    audioTrack={null}
                    mirror={false}
                    objectFit="cover"
                    style={styles.dailyMediaView}
                  />
                ) : (
                  <View style={styles.infoView}>
                    <Text style={styles.waitingText}>No one else is in the call yet!</Text>
                    <Text style={styles.waitingSubtext}>
                      Invite others to join the call using this link:
                    </Text>
                    <Text style={styles.roomLinkText}>{DEFAULT_ROOM_URL}</Text>
                  </View>
                )}
                {/* Control tray */}
                <PublicRoomTray
                  callObject={callObject}
                  onLeave={leaveRoom}
                  disabled={!enableCallButtons}
                />
              </>
            ) : (
              <View style={styles.statusArea}>
                <Ionicons
                  name={
                    appState === AppState.Joining
                      ? 'hourglass'
                      : appState === AppState.Error
                        ? 'alert-circle'
                        : 'call'
                  }
                  size={60}
                  color={appState === AppState.Error ? COLORS.ERROR : COLORS.PRIMARY}
                />
                <Text style={styles.statusText}>
                  {appState === AppState.Joining && 'Joining room...'}
                  {appState === AppState.Error && 'Connection failed'}
                  {appState === AppState.Leaving && 'Leaving room...'}
                </Text>
                {appState === AppState.Error && fatalError && (
                  <Text style={styles.statusText}>{fatalError}</Text>
                )}
              </View>
            )}
          </View>
        ) : showSetupScreen ? (
          // ===== SETUP SCREEN =====
          <View style={styles.setupContainer}>
            <TouchableOpacity
              style={[styles.backButton, isLeaving && styles.disabledButton]}
              onPress={() => {
                if (isLeaving) {
                  Logger.log('⚠️ [PublicRoom] Cannot navigate back while leaving call');
                  return;
                }
                navigation.goBack();
              }}
              disabled={isLeaving}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={isLeaving ? COLORS.TEXT_SECONDARY : COLORS.PRIMARY}
              />
              <Text style={[styles.backButtonText, isLeaving && styles.disabledText]}>
                {isLeaving ? 'Leaving...' : 'Back'}
              </Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Ionicons name="globe" size={60} color={COLORS.PRIMARY} />
              <Text style={styles.title}>Public Room</Text>
              <Text style={styles.subtitle}>Join the community video room</Text>
            </View>

            <View style={styles.buttonSection}>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.primaryButton,
                  !canStartCall && styles.disabledButton,
                ]}
                onPress={handleJoinPublicRoom}
                disabled={!canStartCall}
              >
                <Ionicons
                  name="call"
                  size={24}
                  color={canStartCall ? COLORS.WHITE : COLORS.TEXT_SECONDARY}
                />
                <Text style={[styles.buttonText, styles.primaryButtonText]}>
                  {permissionStatus === 'checking' ? 'Checking permissions...' : 'Join Public Room'}
                </Text>
              </TouchableOpacity>

              {permissionStatus === 'denied' && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={checkPermissions}
                  disabled={isPermissionCheckInProgress}
                >
                  <Ionicons name="settings" size={20} color={COLORS.PRIMARY} />
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    Request Permissions
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoText}>
                Connect with the community in our public video room
              </Text>
              {permissionStatus === 'denied' && (
                <Text style={styles.permissionWarning}>
                  ⚠️ Limited functionality: Audio-only mode available
                </Text>
              )}
              {permissionStatus === 'granted' && (
                <Text style={styles.permissionSuccess}>✓ Permissions ready for video calls</Text>
              )}
            </View>
          </View>
        ) : showErrorScreen ? (
          // ===== ERROR SCREEN =====
          <View style={styles.setupContainer}>
            <TouchableOpacity
              style={[styles.backButton, isLeaving && styles.disabledButton]}
              onPress={() => {
                if (isLeaving) {
                  Logger.log('⚠️ [PublicRoom] Cannot navigate back while leaving call');
                  return;
                }
                navigation.goBack();
              }}
              disabled={isLeaving}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={isLeaving ? COLORS.TEXT_SECONDARY : COLORS.PRIMARY}
              />
              <Text style={[styles.backButtonText, isLeaving && styles.disabledText]}>
                {isLeaving ? 'Leaving...' : 'Back'}
              </Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Ionicons name="warning" size={60} color={COLORS.ERROR} />
              <Text style={styles.title}>Connection Failed</Text>
              <Text style={styles.subtitle}>Unable to join the public room</Text>
            </View>

            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{fatalError}</Text>
              <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={startCall}>
                <Text style={[styles.buttonText, styles.primaryButtonText]}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // ===== LOADING/INITIALIZING SCREEN =====
          <View style={styles.setupContainer}>
            <TouchableOpacity
              style={[styles.backButton, isLeaving && styles.disabledButton]}
              onPress={() => {
                if (isLeaving) {
                  Logger.log('⚠️ [PublicRoom] Cannot navigate back while leaving call');
                  return;
                }
                navigation.goBack();
              }}
              disabled={isLeaving}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={isLeaving ? COLORS.TEXT_SECONDARY : COLORS.PRIMARY}
              />
              <Text style={[styles.backButtonText, isLeaving && styles.disabledText]}>
                {isLeaving ? 'Leaving...' : 'Back'}
              </Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Ionicons name="globe" size={60} color={COLORS.PRIMARY} />
              <Text style={styles.title}>Public Room</Text>
              <Text style={styles.subtitle}>
                {isConnecting ? 'Connecting to room...' : 'Preparing call...'}
              </Text>
            </View>

            <View style={styles.loadingContainer}>
              <Ionicons
                name={isLeaving ? 'exit' : 'hourglass'}
                size={40}
                color={isLeaving ? COLORS.ERROR : COLORS.PRIMARY}
              />
              <Text style={styles.loadingText}>
                {isLeaving
                  ? 'Leaving room...'
                  : permissionStatus === 'checking'
                    ? 'Checking permissions...'
                    : isConnecting
                      ? 'Joining room...'
                      : 'Preparing call...'}
              </Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoText}>
                {isLeaving
                  ? 'Please wait while we leave the room...'
                  : 'Connecting to the public room for community discussions'}
              </Text>
              {permissionStatus === 'denied' && !isLeaving && (
                <Text style={styles.permissionWarning}>
                  ⚠️ Limited functionality: Audio-only mode available
                </Text>
              )}
              {permissionStatus === 'granted' && !isLeaving && (
                <Text style={styles.permissionSuccess}>✓ Permissions ready for video calls</Text>
              )}
            </View>
          </View>
        )}
        </SafeAreaView>
      </AdaptiveLinearGradient>
    </CallObjectContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // Setup UI
  setupContainer: {
    flex: 1,
    padding: SPACING.LG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: SPACING.LG,
    left: SPACING.LG,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.SM,
    zIndex: 10,
  },
  backButtonText: {
    marginLeft: SPACING.XS,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  disabledText: {
    color: COLORS.TEXT_SECONDARY,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: SPACING.XL,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.MD,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    marginVertical: SPACING.XL,
  },
  errorText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.ERROR,
    textAlign: 'center',
    marginBottom: SPACING.LG,
    paddingHorizontal: SPACING.MD,
  },
  buttonSection: {
    width: '100%',
    alignItems: 'center',
    marginVertical: SPACING.XL,
    gap: SPACING.MD,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    minWidth: 200,
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  disabledButton: {
    backgroundColor: COLORS.SURFACE,
    opacity: 0.6,
  },
  buttonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    marginLeft: SPACING.SM,
  },
  primaryButtonText: {
    color: COLORS.WHITE,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  secondaryButtonText: {
    color: COLORS.PRIMARY,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.XL,
  },
  title: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_HEADING,
    fontSize: TYPOGRAPHY.FONT_SIZE_3XL,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },

  infoSection: {
    marginTop: SPACING.XL,
    padding: SPACING.MD,
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: BORDER_RADIUS.MD,
  },
  infoText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  permissionWarning: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.WARNING,
    textAlign: 'center',
    marginTop: SPACING.SM,
    fontWeight: '500',
  },
  permissionSuccess: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.SUCCESS,
    textAlign: 'center',
    marginTop: SPACING.SM,
    fontWeight: '500',
  },

  // Call UI
  callContainer: {
    flex: 1,
  },
  videoArea: {
    flex: 1,
    backgroundColor: COLORS.BLACK,
  },
  tilesContainer: {
    padding: SPACING.MD,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.MD,
  },
  tile: {
    width: '45%',
    aspectRatio: 1, // Official Daily.co uses 1:1 aspect ratio
    borderRadius: BORDER_RADIUS.MD,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.SURFACE, // Dark translucent surface per design system
  },
  localTile: {
    borderWidth: 2,
    borderColor: COLORS.SUCCESS,
  },
  remoteTile: {
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER,
  },
  // videoContainer unused
  media: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayMessage: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    textAlign: 'center',
    paddingHorizontal: SPACING.SM,
  },
  muteOverlay: {
    position: 'absolute',
    bottom: SPACING.SM,
    left: SPACING.SM,
    flexDirection: 'row',
    backgroundColor: COLORS.GLASS_BG_DARKER,
    borderRadius: BORDER_RADIUS.SM,
    padding: SPACING.XS,
    gap: SPACING.XS,
  },
  videoText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    marginTop: SPACING.SM,
  },
  // videoSubtext unused
  audioIndicator: {
    position: 'absolute',
    top: SPACING.SM,
    right: SPACING.SM,
    backgroundColor: COLORS.GLASS_BG_DARKER,
    borderRadius: BORDER_RADIUS.SM,
    padding: SPACING.XS,
  },

  statusArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.XL,
  },
  statusText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    marginTop: SPACING.MD,
    textAlign: 'center',
  },

  waitingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.XL,
  },
  waitingText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    marginTop: SPACING.MD,
    textAlign: 'center',
  },
  waitingSubtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    marginTop: SPACING.SM,
    textAlign: 'center',
  },

  // Tray
  tray: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.GLASS_BG_DARKER,
    padding: SPACING.MD,
    gap: SPACING.MD,
  },
  trayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: COLORS.ERROR,
  },
  leaveButton: {
    backgroundColor: COLORS.ERROR,
  },

  // Enhanced playground styles
  dailyMediaView: {
    flex: 1,
    aspectRatio: 9 / 16,
  },
  infoView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XL,
  },
  roomLinkText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.PRIMARY,
    textAlign: 'center',
    marginTop: SPACING.MD,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER,
    borderRadius: BORDER_RADIUS.SM,
    padding: SPACING.SM,
    backgroundColor: COLORS.WHITE,
  },
});

export default PublicRoomScreen;
