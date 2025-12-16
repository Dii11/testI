import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, SafeAreaView } from 'react-native';

import { useVideoCall } from '../../hooks/useVideoCall';
import { CallProvider } from '../../types/callTypes';

import { FallbackVideoCallScreen } from './FallbackVideoCallScreen';

/**
 * Enhanced Video Call Demo
 *
 * Demonstrates the new reliability features:
 * 1. Automatic reconnection on network drops
 * 2. Runtime fallback with Daily.co
 * 3. Network-aware quality adaptation
 * 4. Manual retry and provider switching
 * 5. Real-time connection status monitoring
 */

interface EnhancedVideoCallDemoProps {
  doctorId: string;
  customerId: string;
  onClose: () => void;
}

export const EnhancedVideoCallDemo: React.FC<EnhancedVideoCallDemoProps> = ({
  doctorId,
  customerId,
  onClose,
}) => {
  const [callStarted, setCallStarted] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('video');
  const [preferredProvider, setPreferredProvider] = useState<CallProvider>(CallProvider.DAILY);

  const {
    startConsultation,
    endConsultation,
    retryConnection,
    switchProvider,
    getConnectionInfo,
    isNetworkSuitable,
    // Enhanced state
    isCallActive,
    isConnecting,
    isReconnecting,
    callState,
    currentProvider,
    networkQuality,
    reconnectionAttempts,
    canRetry,
    canSwitchProvider,
    hasPermissions,
    error,
    lastError,
  } = useVideoCall();

  const handleStartCall = async () => {
    if (!hasPermissions) {
      Alert.alert('Permissions Required', 'Please grant camera and microphone permissions');
      return;
    }

    const networkSuitable = isNetworkSuitable(callType === 'video');
    if (!networkSuitable) {
      const proceed = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Poor Network Quality',
          'Your network quality may not be suitable for video calls. Continue anyway?',
          [
            { text: 'Cancel', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) },
          ]
        );
      });

      if (!proceed) return;
    }

    const success = await startConsultation(doctorId, customerId, callType, preferredProvider);
    if (success) {
      setCallStarted(true);
    }
  };

  const handleEndCall = async () => {
    await endConsultation();
    setCallStarted(false);
    onClose();
  };

  const handleRetry = async () => {
    const success = await retryConnection();
    if (!success) {
      Alert.alert('Retry Failed', 'Unable to reconnect. Please try switching providers.');
    }
  };

  const handleSwitchProvider = async () => {
    const success = await switchProvider();
    if (!success) {
      Alert.alert('Switch Failed', 'Unable to switch providers. Please try again.');
    }
  };

  const getStatusColor = () => {
    if (isCallActive) return '#00ff00';
    if (isConnecting || isReconnecting) return '#ffa500';
    if (error) return '#ff4444';
    return '#ccc';
  };

  const getStatusText = () => {
    if (isReconnecting) return `Reconnecting (Attempt ${reconnectionAttempts})...`;
    if (isConnecting) return 'Connecting...';
    if (isCallActive) return 'Connected';
    if (error) return 'Connection Failed';
    return 'Ready';
  };

  const getProviderName = (provider: CallProvider) => {
    return 'Daily.co';
  };

  const connectionInfo = getConnectionInfo();

  if (callStarted) {
    return (
      <FallbackVideoCallScreen
        channelName={`consultation_${doctorId}_${customerId}`}
        doctorId={doctorId}
        customerId={customerId}
        callType={callType}
        onEndCall={handleEndCall}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Video Call</Text>
      </View>

      <View style={styles.content}>
        {/* Connection Status */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Provider:</Text>
              <Text style={styles.infoValue}>{getProviderName(currentProvider)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Network:</Text>
              <Text style={styles.infoValue}>{networkQuality}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Call State:</Text>
              <Text style={styles.infoValue}>{callState}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Reconnections:</Text>
              <Text style={styles.infoValue}>{reconnectionAttempts}</Text>
            </View>
          </View>

          {lastError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Last Error: {lastError}</Text>
            </View>
          )}
        </View>

        {/* Call Configuration */}
        <View style={styles.configSection}>
          <Text style={styles.sectionTitle}>Call Configuration</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Call Type:</Text>
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                style={[styles.toggleButton, callType === 'audio' && styles.toggleButtonActive]}
                onPress={() => setCallType('audio')}
              >
                <Text style={[styles.toggleText, callType === 'audio' && styles.toggleTextActive]}>
                  Audio
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, callType === 'video' && styles.toggleButtonActive]}
                onPress={() => setCallType('video')}
              >
                <Text style={[styles.toggleText, callType === 'video' && styles.toggleTextActive]}>
                  Video
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Provider:</Text>
            <View style={styles.toggleGroup}>
              <TouchableOpacity style={[styles.toggleButton, styles.toggleButtonActive]} disabled>
                <Text style={[styles.toggleText, styles.toggleTextActive]}>Daily.co</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Network Quality Info */}
        <View style={styles.networkSection}>
          <Text style={styles.sectionTitle}>Network Assessment</Text>
          <View style={styles.networkInfo}>
            <View style={styles.networkItem}>
              <Ionicons
                name={isNetworkSuitable(true) ? 'checkmark-circle' : 'warning'}
                size={20}
                color={isNetworkSuitable(true) ? '#00ff00' : '#ffa500'}
              />
              <Text style={styles.networkText}>Video Call Viable</Text>
            </View>
            <View style={styles.networkItem}>
              <Ionicons
                name={isNetworkSuitable(false) ? 'checkmark-circle' : 'warning'}
                size={20}
                color={isNetworkSuitable(false) ? '#00ff00' : '#ffa500'}
              />
              <Text style={styles.networkText}>Audio Call Viable</Text>
            </View>
          </View>
        </View>

        {/* Connection Info (when call is active) */}
        {connectionInfo && (
          <View style={styles.connectionInfoSection}>
            <Text style={styles.sectionTitle}>Live Connection Info</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Duration:</Text>
                <Text style={styles.infoValue}>{Math.floor(connectionInfo.duration / 1000)}s</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Provider Switches:</Text>
                <Text style={styles.infoValue}>{connectionInfo.providerSwitches}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          {!isCallActive && !isConnecting && (
            <TouchableOpacity style={styles.startButton} onPress={handleStartCall}>
              <Ionicons name="call" size={24} color="#fff" />
              <Text style={styles.buttonText}>Start {callType} Call</Text>
            </TouchableOpacity>
          )}

          {canRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.buttonText}>Retry Connection</Text>
            </TouchableOpacity>
          )}

          {canSwitchProvider && (
            <TouchableOpacity style={styles.switchButton} onPress={handleSwitchProvider}>
              <Ionicons name="swap-horizontal" size={20} color="#fff" />
              <Text style={styles.buttonText}>Switch Provider</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Demo Information */}
        <View style={styles.demoInfo}>
          <Text style={styles.demoTitle}>🚀 New Reliability Features:</Text>
          <Text style={styles.demoText}>• Automatic reconnection on network drops</Text>
          <Text style={styles.demoText}>• Runtime fallback between providers</Text>
          <Text style={styles.demoText}>• Network-aware quality adaptation</Text>
          <Text style={styles.demoText}>• Manual retry and provider switching</Text>
          <Text style={styles.demoText}>• Real-time connection monitoring</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    marginRight: 15,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  infoItem: {
    flexDirection: 'row',
    minWidth: '45%',
  },
  infoLabel: {
    color: '#ccc',
    fontSize: 12,
    width: 80,
  },
  infoValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
  },
  configSection: {
    marginBottom: 25,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  optionLabel: {
    color: '#ccc',
    fontSize: 14,
    width: 120,
  },
  toggleGroup: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 5,
    overflow: 'hidden',
  },
  toggleButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#333',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    color: '#ccc',
    fontSize: 12,
  },
  toggleTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  networkSection: {
    marginBottom: 25,
  },
  networkInfo: {
    gap: 10,
  },
  networkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
  },
  connectionInfoSection: {
    marginBottom: 25,
  },
  actionsSection: {
    gap: 15,
    marginBottom: 25,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ff00',
    padding: 15,
    borderRadius: 10,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 10,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    padding: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  demoInfo: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  demoTitle: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  demoText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 3,
  },
});

export default EnhancedVideoCallDemo;
