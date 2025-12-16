import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text, TouchableOpacity } from 'react-native';

import CallStateManager from '../../services/callStateManager';
import NetworkMonitorService from '../../services/networkMonitorService';
import { CallState, CallProvider } from '../../types/callTypes';
import { VideoCallProvider } from '../../types/videoCallProvider';

import { DailyVideoCallScreen } from './DailyVideoCallScreen';

interface FallbackVideoCallScreenProps {
  channelName: string;
  onEndCall: () => void;
  token?: string;
  doctorId?: string;
  customerId?: string;
  callType?: 'audio' | 'video';
}

interface ReconnectionState {
  isReconnecting: boolean;
  provider: CallProvider;
  attempts: number;
  showManualRetry: boolean;
}

export const FallbackVideoCallScreen: React.FC<FallbackVideoCallScreenProps> = ({
  channelName,
  onEndCall,
  token,
  doctorId,
  customerId,
  callType = 'video',
}) => {
  const [currentProvider, setCurrentProvider] = useState<CallProvider>(CallProvider.DAILY);
  const [roomUrl, setRoomUrl] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reconnectionState, setReconnectionState] = useState<ReconnectionState>({
    isReconnecting: false,
    provider: CallProvider.DAILY,
    attempts: 0,
    showManualRetry: false,
  });
  const [connectionStatus, setConnectionStatus] = useState<CallState>(CallState.IDLE);
  const [networkQuality, setNetworkQuality] = useState<string>('unknown');
  const callStateManager = CallStateManager;
  const networkMonitor = NetworkMonitorService;

  useEffect(() => {
    initializeCall();
    setupListeners();

    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = async () => {
    if (!doctorId || !customerId) {
      console.error('Missing required IDs for call initialization');
      Alert.alert('Error', 'Missing required information to start the call');
      onEndCall();
      return;
    }

    try {
      // Create call session
      const newSessionId = callStateManager.createSession(
        {
          callId: `fallback_${Date.now()}`,
          channelName,
          participants: { doctorId, customerId },
          callType,
          roomUrl: '', // Will be set by provider
          provider: VideoCallProvider.DAILY,
        },
        CallProvider.DAILY,
        { token }
      );

      setSessionId(newSessionId);

      // Start call
      const success = await callStateManager.startCall(newSessionId, 0);

      if (!success) {
        console.log('Failed to start call, will handle via state manager');
      }
    } catch (error) {
      console.error('Failed to initialize call:', error);
      Alert.alert('Call Failed', 'Unable to initialize the call. Please try again.');
      onEndCall();
    }
  };

  const setupListeners = () => {
    // Listen to call state changes
    const unsubscribeCallState = callStateManager.addListener(session => {
      if (session.sessionId === sessionId) {
        setConnectionStatus(session.state);
        setCurrentProvider(session.currentProvider);

        // Update room URL for Daily.co
        if (session.currentProvider === CallProvider.DAILY && session.channelInfo.roomUrl) {
          setRoomUrl(session.channelInfo.roomUrl);
        }

        // Handle provider switching
        if (session.state === CallState.SWITCHING_PROVIDER) {
          setReconnectionState(prev => ({
            ...prev,
            isReconnecting: true,
            provider: session.currentProvider,
            attempts: session.providerSwitchAttempts,
          }));
        } else {
          setReconnectionState(prev => ({
            ...prev,
            isReconnecting: session.state === CallState.RECONNECTING,
            showManualRetry: session.state === CallState.FAILED,
          }));
        }
      }
    });

    // Listen to network changes
    const unsubscribeNetwork = networkMonitor.addListener(networkState => {
      setNetworkQuality(networkState.quality);
    });

    return () => {
      unsubscribeCallState();
      unsubscribeNetwork();
    };
  };

  const cleanup = () => {
    if (sessionId) {
      callStateManager.endCall(sessionId);
    }
  };

  const handleManualRetry = async () => {
    if (!sessionId) return;

    setReconnectionState(prev => ({ ...prev, showManualRetry: false }));

    try {
      // Try to restart the call with the original provider
      const success = await callStateManager.startCall(sessionId, 0);
      if (!success) {
        setReconnectionState(prev => ({ ...prev, showManualRetry: true }));
      }
    } catch (error) {
      console.error('Manual retry failed:', error);
      setReconnectionState(prev => ({ ...prev, showManualRetry: true }));
    }
  };

  const handleForceSwitch = async () => {
    if (!sessionId || !doctorId || !customerId) return;

    const session = callStateManager.getSession(sessionId);
    if (!session) return;

    setReconnectionState(prev => ({ ...prev, showManualRetry: false }));

    // This will trigger the fallback mechanism
    await callStateManager.handleRuntimeError(
      sessionId,
      new Error('Manual provider switch'),
      'connection'
    );
  };

  const getProviderName = (provider: CallProvider): string => {
    return 'Daily.co';
  };

  const getConnectionStatusText = (): string => {
    switch (connectionStatus) {
      case CallState.CONNECTING:
        return 'Connecting...';
      case CallState.CONNECTED:
        return 'Connected';
      case CallState.RECONNECTING:
        return `Reconnecting (${getProviderName(currentProvider)})...`;
      case CallState.SWITCHING_PROVIDER:
        return `Switching to ${getProviderName(currentProvider)}...`;
      case CallState.FAILED:
        return 'Connection Failed';
      default:
        return 'Initializing...';
    }
  };

  const getConnectionStatusColor = (): string => {
    switch (connectionStatus) {
      case CallState.CONNECTED:
        return '#00ff00';
      case CallState.CONNECTING:
      case CallState.RECONNECTING:
      case CallState.SWITCHING_PROVIDER:
        return '#ffa500';
      case CallState.FAILED:
        return '#ff4444';
      default:
        return '#ccc';
    }
  };

  const renderConnectionStatus = () => (
    <View style={styles.statusContainer}>
      <View style={styles.statusRow}>
        <View style={[styles.statusIndicator, { backgroundColor: getConnectionStatusColor() }]} />
        <Text style={styles.statusText}>{getConnectionStatusText()}</Text>
      </View>

      <View style={styles.providerInfo}>
        <Text style={styles.providerText}>Provider: {getProviderName(currentProvider)}</Text>
        <Text style={styles.networkText}>Network: {networkQuality}</Text>
      </View>

      {reconnectionState.isReconnecting && (
        <View style={styles.reconnectionInfo}>
          <ActivityIndicator size="small" color="#ffa500" />
          <Text style={styles.reconnectionText}>
            {connectionStatus === CallState.SWITCHING_PROVIDER
              ? `Switching to ${getProviderName(currentProvider)}...`
              : `Reconnecting... (Attempt ${reconnectionState.attempts})`}
          </Text>
        </View>
      )}

      {reconnectionState.showManualRetry && (
        <View style={styles.retryContainer}>
          <Text style={styles.retryText}>Connection failed. Try again?</Text>
          <View style={styles.retryButtons}>
            <TouchableOpacity style={styles.retryButton} onPress={handleManualRetry}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.switchButton} onPress={handleForceSwitch}>
              <Ionicons name="swap-horizontal" size={16} color="#fff" />
              <Text style={styles.retryButtonText}>Switch Provider</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderLoadingScreen = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.loadingText}>
        {connectionStatus === CallState.SWITCHING_PROVIDER
          ? `Switching to ${getProviderName(currentProvider)}...`
          : 'Initializing call...'}
      </Text>
    </View>
  );

  // Show loading during initial setup or provider switching
  if (connectionStatus === CallState.IDLE || connectionStatus === CallState.SWITCHING_PROVIDER) {
    return (
      <View style={styles.container}>
        {renderConnectionStatus()}
        {renderLoadingScreen()}
      </View>
    );
  }

  // Show status overlay on all call screens
  const statusOverlay = renderConnectionStatus();

  if (currentProvider === CallProvider.DAILY && roomUrl) {
    return (
      <View style={styles.container}>
        {statusOverlay}
        <DailyVideoCallScreen
          roomUrl={roomUrl}
          onEndCall={() => {
            cleanup();
            onEndCall();
          }}
        />
      </View>
    );
  }

  // Only Daily.co is supported
  return (
    <View style={styles.container}>
      {statusOverlay}
      <DailyVideoCallScreen
        roomUrl={roomUrl}
        onEndCall={() => {
          cleanup();
          onEndCall();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  statusContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 15,
    zIndex: 1000,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  providerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  providerText: {
    color: '#ccc',
    fontSize: 12,
  },
  networkText: {
    color: '#ccc',
    fontSize: 12,
  },
  reconnectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  reconnectionText: {
    color: '#ffa500',
    fontSize: 12,
    marginLeft: 8,
  },
  retryContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  retryButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
});

export default FallbackVideoCallScreen;
