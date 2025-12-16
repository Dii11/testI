/**
 * ✅ DEVICE-VISIBLE DEBUG PANEL - ANDROID FIXED v2.2.0
 *
 * Shows real-time video call state on device screen
 * Perfect for debugging on real devices where console logs aren't visible
 *
 * ✅ ANDROID FIXES APPLIED:
 * - Enhanced zIndex/elevation for proper overlay display
 * - Improved positioning for Android compatibility
 * - Better component version tracking
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Clipboard,
} from 'react-native';

import { useCallObject, useParticipants, useMeetingState } from '../../contexts/DailyCallContext';

interface DebugPanelProps {
  visible?: boolean;
  onToggle?: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ visible = false, onToggle }) => {
  const callObject = useCallObject();
  const participants = useParticipants();
  const meetingState = useMeetingState();
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // Add log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [logEntry, ...prev.slice(0, 19)]); // Keep last 20 logs
  };

  // Monitor call state changes
  useEffect(() => {
    if (!callObject) return;

    const handleParticipantUpdate = () => {
      const participantList = Object.values(participants);
      participantList.forEach(participant => {
        const videoState = participant.tracks.video.state || 'unknown';
        const audioState = participant.tracks.audio.state || 'unknown';
        const hasVideo = participant.tracks.video.state === 'playable';
        const hasAudio = participant.tracks.audio.state === 'playable';

        addLog(
          `${participant.local ? 'LOCAL' : 'REMOTE'}: Video=${videoState}(${hasVideo}) Audio=${audioState}(${hasAudio})`
        );
      });
    };

    const handleMeetingStateChange = () => {
      addLog(`Meeting State: ${meetingState}`);
    };

    // Initial state
    handleMeetingStateChange();
    handleParticipantUpdate();

    // Listen for changes
    callObject.on('participant-updated', handleParticipantUpdate);
    callObject.on('joined-meeting', handleMeetingStateChange);
    callObject.on('left-meeting', handleMeetingStateChange);

    return () => {
      callObject.off('participant-updated', handleParticipantUpdate);
      callObject.off('joined-meeting', handleMeetingStateChange);
      callObject.off('left-meeting', handleMeetingStateChange);
    };
  }, [callObject, participants, meetingState]);

  if (!visible) {
    return (
      <TouchableOpacity style={styles.toggleButton} onPress={onToggle}>
        <Ionicons name="bug" size={20} color="#fff" />
        <Text style={styles.toggleButtonText}>v2.2.0</Text>
      </TouchableOpacity>
    );
  }

  const participantList = Object.values(participants);
  const localParticipant = participantList.find(p => p.local);
  const remoteParticipants = participantList.filter(p => !p.local);

  // Deep object inspection helper
  const deepInspectObject = (obj: any, prefix = '', maxDepth = 3, currentDepth = 0): string => {
    if (currentDepth >= maxDepth || obj === null || obj === undefined) {
      return `${prefix}: ${JSON.stringify(obj)}\n`;
    }

    let result = '';

    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        result += `${prefix}: [Array with ${obj.length} items]\n`;
        obj.forEach((item, index) => {
          result += deepInspectObject(item, `${prefix}[${index}]`, maxDepth, currentDepth + 1);
        });
      } else {
        result += `${prefix}: [Object]\n`;
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          if (typeof value === 'function') {
            result += `${prefix}.${key}: [Function]\n`;
          } else if (typeof value === 'object' && value !== null) {
            result += deepInspectObject(value, `${prefix}.${key}`, maxDepth, currentDepth + 1);
          } else {
            result += `${prefix}.${key}: ${JSON.stringify(value)}\n`;
          }
        });
      }
    } else {
      result += `${prefix}: ${JSON.stringify(obj)}\n`;
    }

    return result;
  };

  // Enhanced track inspection
  const inspectTrack = (track: any, trackName: string): string => {
    if (!track) return `${trackName}: null\n`;

    let result = `\n🔍 ${trackName.toUpperCase()} TRACK DEEP INSPECTION:\n`;
    result += `==========================================\n`;

    // Basic properties
    result += `ID: ${track.id || 'null'}\n`;
    result += `Kind: ${track.kind || 'null'}\n`;
    result += `Label: ${track.label || 'null'}\n`;
    result += `Enabled: ${track.enabled}\n`;
    result += `Muted: ${track.muted}\n`;
    result += `Ready State: ${track.readyState || 'null'}\n`;

    // MediaStreamTrack properties
    if (track.getSettings) {
      try {
        const settings = track.getSettings();
        result += `Settings: ${JSON.stringify(settings, null, 2)}\n`;
      } catch (e) {
        result += `Settings: Error getting settings - ${e instanceof Error ? e.message : String(e)}\n`;
      }
    }

    if (track.getConstraints) {
      try {
        const constraints = track.getConstraints();
        result += `Constraints: ${JSON.stringify(constraints, null, 2)}\n`;
      } catch (e) {
        result += `Constraints: Error getting constraints - ${e instanceof Error ? e.message : String(e)}\n`;
      }
    }

    if (track.getCapabilities) {
      try {
        const capabilities = track.getCapabilities();
        result += `Capabilities: ${JSON.stringify(capabilities, null, 2)}\n`;
      } catch (e) {
        result += `Capabilities: Error getting capabilities - ${e instanceof Error ? e.message : String(e)}\n`;
      }
    }

    // Additional MediaStreamTrack analysis
    if (track.getStats) {
      try {
        const stats = track.getStats();
        result += `\n📊 TRACK STATISTICS:\n`;
        result += `Stats: ${JSON.stringify(stats, null, 2)}\n`;
      } catch (e) {
        result += `Stats: Error getting stats - ${e instanceof Error ? e.message : String(e)}\n`;
      }
    }

    // Track event listeners
    if (track.addEventListener) {
      result += `\n🎧 TRACK EVENT LISTENERS:\n`;
      result += `Event Listener Support: Available\n`;
    }

    // Deep inspection of all properties
    result += `\n🔬 ALL TRACK PROPERTIES:\n`;
    result += deepInspectObject(track, trackName, 2, 0);

    return result;
  };

  // Copy debug logs to clipboard
  const copyLogsToClipboard = async () => {
    try {
      const timestamp = new Date().toISOString();
      let debugText = `🔍 COMPREHENSIVE VIDEO CALL DEBUG LOG - ${timestamp}\n`;
      debugText += `====================================================\n\n`;

      // System Information
      debugText += `🖥️ SYSTEM INFORMATION:\n`;
      debugText += `Platform: ${Platform.OS}\n`;
      debugText += `Platform Version: ${Platform.Version}\n`;
      debugText += `Timestamp: ${timestamp}\n`;
      debugText += `User Agent: ${navigator.userAgent || 'N/A'}\n`;
      debugText += `Screen Dimensions: ${JSON.stringify(require('react-native').Dimensions.get('window'))}\n`;
      debugText += `Device Info: ${JSON.stringify(require('expo-device').DeviceInfo || {}, null, 2)}\n`;
      debugText += `Memory Usage: ${JSON.stringify(require('react-native').Performance?.getMemoryInfo?.() || 'N/A')}\n\n`;

      // Meeting State - Deep Inspection
      debugText += `📡 MEETING STATE DEEP INSPECTION:\n`;
      debugText += `================================\n`;
      debugText += `Status: ${meetingState || 'Unknown'}\n`;
      debugText += `Call Object Available: ${callObject ? '✅ Active' : '❌ Missing'}\n`;

      if (callObject) {
        debugText += `\n🔬 CALL OBJECT DEEP INSPECTION:\n`;
        try {
          // Get call object state
          const participants = callObject.participants();
          const localParticipant = callObject.participants().local;
          const meetingState = callObject.meetingState();
          const networkQuality = callObject.getNetworkStats();

          debugText += `Meeting State: ${meetingState}\n`;
          debugText += `Participants Count: ${Object.keys(participants).length}\n`;
          debugText += `Local Participant Available: ${localParticipant ? '✅' : '❌'}\n`;

          if (networkQuality) {
            debugText += `Network Quality: ${JSON.stringify(networkQuality, null, 2)}\n`;
          }

          // Network connection info
          try {
            const networkInfo = callObject.getNetworkStats();
            if (networkInfo) {
              debugText += `Network Stats: ${JSON.stringify(networkInfo, null, 2)}\n`;
            }
          } catch (e) {
            debugText += `Network Stats: Error getting network stats - ${e instanceof Error ? e.message : String(e)}\n`;
          }

          // Call object methods available
          try {
            const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(callObject));
            debugText += `Available Methods: ${methods.filter(m => typeof (callObject as any)[m] === 'function').join(', ')}\n`;
          } catch (e) {
            debugText += `Methods: Error getting methods - ${e instanceof Error ? e.message : String(e)}\n`;
          }

          // Deep inspection of call object methods and properties
          debugText += `\n🔬 CALL OBJECT PROPERTIES:\n`;
          debugText += deepInspectObject(callObject, 'callObject', 2, 0);
        } catch (error) {
          debugText += `Error inspecting call object: ${error instanceof Error ? error.message : String(error)}\n`;
        }
      }
      debugText += `\n`;

      // Local Participant - Comprehensive Analysis
      if (localParticipant) {
        debugText += `👤 LOCAL PARTICIPANT COMPREHENSIVE ANALYSIS:\n`;
        debugText += `==========================================\n`;
        debugText += `Name: ${localParticipant.user_name || 'Unknown'}\n`;
        debugText += `Session ID: ${localParticipant.session_id || 'null'}\n`;
        debugText += `User ID: ${localParticipant.user_id || 'null'}\n`;
        debugText += `Local: ${localParticipant.local}\n`;
        debugText += `Owner: ${localParticipant.owner || false}\n`;
        debugText += `Joined At: ${localParticipant.joined_at ? new Date(localParticipant.joined_at).toISOString() : 'null'}\n`;
        debugText += `Permissions: ${JSON.stringify(localParticipant.permissions || {}, null, 2)}\n`;

        // Video Track Deep Inspection
        if (localParticipant.tracks.video) {
          const videoTrack = localParticipant.tracks.video;
          debugText += `\n📹 VIDEO TRACK STATE:\n`;
          debugText += `State: ${videoTrack.state}\n`;
          debugText += `Off Reason: ${JSON.stringify(videoTrack.off || 'none')}\n`;
          debugText += `Blocked: ${JSON.stringify(videoTrack.blocked || 'none')}\n`;
          debugText += `Subscribed: ${videoTrack.subscribed}\n`;

          // Deep track inspection
          if (videoTrack.track) {
            debugText += inspectTrack(videoTrack.track, 'localVideoTrack');
          }
          if (videoTrack.persistentTrack) {
            debugText += inspectTrack(videoTrack.persistentTrack, 'localVideoPersistentTrack');
          }
        }

        // Audio Track Deep Inspection
        if (localParticipant.tracks.audio) {
          const audioTrack = localParticipant.tracks.audio;
          debugText += `\n🎙️ AUDIO TRACK STATE:\n`;
          debugText += `State: ${audioTrack.state}\n`;
          debugText += `Off Reason: ${JSON.stringify(audioTrack.off || 'none')}\n`;
          debugText += `Blocked: ${JSON.stringify(audioTrack.blocked || 'none')}\n`;
          debugText += `Subscribed: ${audioTrack.subscribed}\n`;

          // Deep track inspection
          if (audioTrack.track) {
            debugText += inspectTrack(audioTrack.track, 'localAudioTrack');
          }
          if (audioTrack.persistentTrack) {
            debugText += inspectTrack(audioTrack.persistentTrack, 'localAudioPersistentTrack');
          }
        }

        // Complete participant object inspection
        debugText += `\n🔬 COMPLETE LOCAL PARTICIPANT OBJECT:\n`;
        debugText += deepInspectObject(localParticipant, 'localParticipant', 3, 0);
        debugText += `\n`;
      }

      // Remote Participants - Ultra Deep Analysis
      if (remoteParticipants.length > 0) {
        debugText += `🔍 REMOTE PARTICIPANTS ULTRA DEEP ANALYSIS (${remoteParticipants.length}):\n`;
        debugText += `================================================================\n`;

        remoteParticipants.forEach((participant, index) => {
          debugText += `\n👥 PARTICIPANT #${index + 1}: ${participant.user_name || 'unnamed'}\n`;
          debugText += `==========================================\n`;
          debugText += `Session ID: ${participant.session_id}\n`;
          debugText += `User ID: ${participant.user_id || 'null'}\n`;
          debugText += `Local: ${participant.local}\n`;
          debugText += `Owner: ${participant.owner || false}\n`;
          debugText += `Joined At: ${participant.joined_at ? new Date(participant.joined_at).toISOString() : 'null'}\n`;
          debugText += `Will Eject At: ${participant.will_eject_at ? new Date(participant.will_eject_at).toISOString() : 'null'}\n`;
          debugText += `Permissions: ${JSON.stringify(participant.permissions || {}, null, 2)}\n`;
          debugText += `Network Quality State: ${participant.networkQualityState || 'unknown'}\n`;
          debugText += `Network Threshold: ${participant.networkThreshold || 'unknown'}\n`;

          // Video Track Ultra Deep Inspection
          if (participant.tracks.video) {
            const videoTrack = participant.tracks.video;
            debugText += `\n📹 VIDEO TRACK ULTRA DEEP ANALYSIS:\n`;
            debugText += `State: ${videoTrack.state}\n`;
            debugText += `Off Reason: ${JSON.stringify(videoTrack.off || 'none')}\n`;
            debugText += `Blocked: ${JSON.stringify(videoTrack.blocked || 'none')}\n`;
            debugText += `Subscribed: ${videoTrack.subscribed}\n`;
            debugText += `Video Enabled: ${participant.video}\n`;

            // Deep track inspection
            if (videoTrack.track) {
              debugText += inspectTrack(videoTrack.track, `remoteVideoTrack_${index}`);
            }
            if (videoTrack.persistentTrack) {
              debugText += inspectTrack(
                videoTrack.persistentTrack,
                `remoteVideoPersistentTrack_${index}`
              );
            }
          }

          // Audio Track Ultra Deep Inspection
          if (participant.tracks.audio) {
            const audioTrack = participant.tracks.audio;
            debugText += `\n🎙️ AUDIO TRACK ULTRA DEEP ANALYSIS:\n`;
            debugText += `State: ${audioTrack.state}\n`;
            debugText += `Off Reason: ${JSON.stringify(audioTrack.off || 'none')}\n`;
            debugText += `Blocked: ${JSON.stringify(audioTrack.blocked || 'none')}\n`;
            debugText += `Subscribed: ${audioTrack.subscribed}\n`;
            debugText += `Audio Enabled: ${participant.audio}\n`;

            // Deep track inspection
            if (audioTrack.track) {
              debugText += inspectTrack(audioTrack.track, `remoteAudioTrack_${index}`);
            }
            if (audioTrack.persistentTrack) {
              debugText += inspectTrack(
                audioTrack.persistentTrack,
                `remoteAudioPersistentTrack_${index}`
              );
            }
          }

          // Screen sharing info
          if (participant.tracks.screenVideo) {
            debugText += `\n🖥️ SCREEN SHARING TRACK:\n`;
            debugText += `State: ${participant.tracks.screenVideo.state}\n`;
            debugText += `Subscribed: ${participant.tracks.screenVideo.subscribed}\n`;
            if (participant.tracks.screenVideo.track) {
              debugText += inspectTrack(
                participant.tracks.screenVideo.track,
                `screenVideoTrack_${index}`
              );
            }
          }

          // Complete participant object inspection
          debugText += `\n🔬 COMPLETE PARTICIPANT OBJECT INSPECTION:\n`;
          debugText += deepInspectObject(participant, `participant_${index}`, 4, 0);
        });
        debugText += `\n`;
      }

      // Call Status Comprehensive
      debugText += `📊 COMPREHENSIVE CALL STATUS:\n`;
      debugText += `============================\n`;
      debugText += `Meeting State: ${meetingState || 'Unknown'}\n`;
      debugText += `Total Participants: ${participantList.length}\n`;
      debugText += `Local Participants: ${participantList.filter(p => p.local).length}\n`;
      debugText += `Remote Participants: ${participantList.filter(p => !p.local).length}\n`;
      debugText += `Participants with Video: ${participantList.filter(p => p.tracks.video.state === 'playable').length}\n`;
      debugText += `Participants with Audio: ${participantList.filter(p => p.tracks.audio.state === 'playable').length}\n`;

      // Participants object deep inspection
      debugText += `\n🔬 PARTICIPANTS OBJECT DEEP INSPECTION:\n`;
      debugText += deepInspectObject(participants, 'participants', 3, 0);

      // Debug Logs
      if (debugLogs.length > 0) {
        debugText += `\n📝 RECENT DEBUG LOGS:\n`;
        debugText += `====================\n`;
        debugLogs.forEach(log => {
          debugText += `${log}\n`;
        });
      }

      // Environment and Context
      debugText += `\n🌍 ENVIRONMENT CONTEXT:\n`;
      debugText += `======================\n`;
      debugText += `React Native Version: ${require('react-native/package.json').version}\n`;
      debugText += `Expo Version: ${require('expo/package.json').version}\n`;
      debugText += `Daily.co Version: ${require('@daily-co/react-native-daily-js/package.json').version}\n`;
      debugText += `Platform: ${Platform.OS} ${Platform.Version}\n`;
      debugText += `Timestamp: ${new Date().toISOString()}\n`;

      Clipboard.setString(debugText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      Alert.alert('✅ Copied!', 'Comprehensive debug logs copied to clipboard');
    } catch (error) {
      console.error('Failed to copy logs:', error);
      Alert.alert('❌ Error', 'Failed to copy logs to clipboard');
    }
  };

  return (
    <View style={styles.debugPanel}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Video Call Debug v2.2.0-ANDROID-FIXED</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={copyLogsToClipboard}
            style={[styles.copyButton, copySuccess && styles.copyButtonSuccess]}
            activeOpacity={0.7}
          >
            <Ionicons
              name={copySuccess ? 'checkmark' : 'copy'}
              size={20}
              color={copySuccess ? '#fff' : '#4CAF50'}
            />
            <Text style={[styles.copyButtonText, copySuccess && styles.copyButtonTextSuccess]}>
              {copySuccess ? 'Copied!' : 'Copy'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onToggle} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Meeting State */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📡 Meeting State</Text>
          <Text style={styles.info}>Status: {meetingState || 'Unknown'}</Text>
          <Text style={styles.info}>Call Object: {callObject ? '✅ Active' : '❌ Missing'}</Text>
        </View>

        {/* Local Participant */}
        {localParticipant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Local Participant</Text>
            <Text style={styles.info}>Name: {localParticipant.user_name || 'Unknown'}</Text>
            <Text style={styles.info}>
              Video State: {localParticipant.tracks.video.state || 'unknown'}
            </Text>
            <Text style={styles.info}>
              Audio State: {localParticipant.tracks.audio.state || 'unknown'}
            </Text>
            <Text style={styles.info}>
              Has Video: {localParticipant.tracks.video.state === 'playable' ? '✅' : '❌'}
            </Text>
            <Text style={styles.info}>
              Has Audio: {localParticipant.tracks.audio.state === 'playable' ? '✅' : '❌'}
            </Text>

            {/* ✅ CRITICAL DEBUG: Video track details */}
            {localParticipant.tracks.video && (
              <View style={styles.trackDetails}>
                <Text style={styles.info}>
                  Video Track ID: {localParticipant.tracks.video.track?.id || 'No ID'}
                </Text>
                <Text style={styles.info}>
                  Video Track Ready: {localParticipant.tracks.video.track?.readyState || 'Unknown'}
                </Text>
                <Text style={styles.info}>
                  Video Track Kind: {localParticipant.tracks.video.track?.kind || 'Unknown'}
                </Text>
                <Text style={styles.info}>
                  Video Track Enabled: {localParticipant.tracks.video.track?.enabled ? '✅' : '❌'}
                </Text>
                <Text style={styles.info}>
                  Video Track Muted: {localParticipant.tracks.video.track?.muted ? '❌' : '✅'}
                </Text>
              </View>
            )}

            {localParticipant.tracks.video.blocked && (
              <Text style={styles.error}>
                Video Blocked: {JSON.stringify(localParticipant.tracks.video.blocked)}
              </Text>
            )}
            {localParticipant.tracks.video.off && (
              <Text style={styles.warning}>
                Video Off: {JSON.stringify(localParticipant.tracks.video.off)}
              </Text>
            )}
          </View>
        )}

        {/* Remote Participants - DETAILED OBJECT INSPECTION */}
        {remoteParticipants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              🔍 Remote Participants Object Inspection ({remoteParticipants.length})
            </Text>
            {remoteParticipants.map((participant, index) => (
              <View key={participant.session_id} style={styles.participantInfo}>
                <Text style={styles.participantHeader}>
                  #{index + 1}: {participant.user_name || 'unnamed'}
                </Text>
                <Text style={styles.info}>
                  Session ID: {participant.session_id.substring(0, 16)}...
                </Text>

                {/* Video Track Object Inspection */}
                <View style={styles.trackInspection}>
                  <Text style={styles.trackTitle}>📹 VIDEO TRACK OBJECT:</Text>
                  <Text style={styles.info}>State: {participant.tracks.video.state || 'none'}</Text>
                  <Text style={styles.info}>
                    Has Track: {participant.tracks.video.track ? '✅ YES' : '❌ NO'}
                  </Text>
                  <Text style={styles.info}>
                    Track ID: {participant.tracks.video.track?.id || 'null'}
                  </Text>
                  <Text style={styles.info}>
                    Camera Enabled: {participant.video ? '✅ YES' : '❌ NO'}
                  </Text>
                  <Text style={styles.info}>
                    Video Off Reason: {JSON.stringify(participant.tracks.video.off || 'none')}
                  </Text>
                  <Text style={styles.info}>
                    Video Blocked: {JSON.stringify(participant.tracks.video.blocked || 'none')}
                  </Text>
                </View>

                {/* Audio Track Object Inspection */}
                <View style={styles.trackInspection}>
                  <Text style={styles.trackTitle}>🎙️ AUDIO TRACK OBJECT:</Text>
                  <Text style={styles.info}>State: {participant.tracks.audio.state || 'none'}</Text>
                  <Text style={styles.info}>
                    Has Track: {participant.tracks.audio.track ? '✅ YES' : '❌ NO'}
                  </Text>
                  <Text style={styles.info}>
                    Track ID: {participant.tracks.audio.track?.id || 'null'}
                  </Text>
                  <Text style={styles.info}>
                    Mic Enabled: {participant.audio ? '✅ YES' : '❌ NO'}
                  </Text>
                  <Text style={styles.info}>
                    Audio Off Reason: {JSON.stringify(participant.tracks.audio.off || 'none')}
                  </Text>
                </View>

                {/* Raw Participant Properties */}
                <View style={styles.trackInspection}>
                  <Text style={styles.trackTitle}>🔧 RAW PARTICIPANT PROPERTIES:</Text>
                  <Text style={styles.infoSmall}>
                    Available Keys: {Object.keys(participant).join(', ')}
                  </Text>
                  <Text style={styles.info}>Local: {participant.local ? 'true' : 'false'}</Text>
                  <Text style={styles.info}>Owner: {participant.owner ? 'true' : 'false'}</Text>
                  <Text style={styles.info}>User ID: {participant.user_id || 'none'}</Text>
                  <Text style={styles.info}>
                    Joined At:{' '}
                    {participant.joined_at
                      ? new Date(participant.joined_at).toLocaleTimeString()
                      : 'none'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Essential Debug Info Only */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Call Status</Text>
          <Text style={styles.info}>Meeting State: {meetingState || 'Unknown'}</Text>
          <Text style={styles.info}>Total Participants: {participantList.length}</Text>
          <Text style={styles.info}>
            Local Participants: {participantList.filter(p => p.local).length}
          </Text>
          <Text style={styles.info}>
            Remote Participants: {participantList.filter(p => !p.local).length}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    // ✅ ANDROID FIX: Enhanced positioning for debug button
    ...Platform.select({
      android: {
        zIndex: 9999,
        elevation: 25,
      },
      ios: {
        zIndex: 1000,
      },
    }),
  },
  toggleButtonText: {
    color: '#4CAF50',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 2,
  },
  debugPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    // ✅ ANDROID FIX: Enhanced positioning for debug panel overlay
    ...Platform.select({
      android: {
        zIndex: 9998,
        elevation: 24,
      },
      ios: {
        zIndex: 1000,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.5)',
    gap: 4,
  },
  copyButtonText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  copyButtonSuccess: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  copyButtonTextSuccess: {
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  info: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  error: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  warning: {
    fontSize: 14,
    color: '#FF9800',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  participantInfo: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 5,
  },
  logEntry: {
    fontSize: 12,
    color: '#ccc',
    marginBottom: 3,
    fontFamily: 'monospace',
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  trackDetails: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  participantHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  trackInspection: {
    marginTop: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#FF9800',
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 6,
  },
  infoSmall: {
    fontSize: 11,
    color: '#ccc',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});
