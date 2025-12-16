/**
 * Enhanced Video Call Integration Example
 *
 * Demonstrates how to integrate the enhanced permission system
 * with video calling functionality
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';

import { usePermissionContext } from '../../contexts/PermissionContext';
import usePermission from '../../hooks/usePermission';
import type { PermissionContext } from '../../services/permissions/ConsolidatedPermissionManager';
import { PermissionGate } from '../permissions/PermissionGate';

interface EnhancedVideoCallProps {
  doctorId: string;
  patientId: string;
  onCallStarted?: () => void;
  onCallEnded?: () => void;
  onError?: (error: string) => void;
}

export const EnhancedVideoCallIntegration: React.FC<EnhancedVideoCallProps> = ({
  doctorId,
  patientId,
  onCallStarted,
  onCallEnded,
  onError,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const { checkSystemHealth } = usePermissionContext();

  // Enhanced permission context for video calls
  const videoCallContext: PermissionContext = {
    feature: 'video_consultation',
    priority: 'critical',
    userInitiated: true,
    educationalContent: {
      title: 'Video Call Permissions',
      description:
        'To start your video consultation with the doctor, we need access to your camera and microphone.',
      benefits: [
        'High-quality video communication with your healthcare provider',
        'Real-time visual assessment for better diagnosis',
        'Secure, encrypted video calls for privacy protection',
        'Ability to share visual symptoms or concerns instantly',
      ],
    },
    fallbackStrategy: {
      mode: 'alternative',
      description: 'You can continue with an audio-only call if camera access is not available',
      limitations: ['No video'],
      alternativeApproach: 'audio-only',
    },
  };

  const handleCallStart = async () => {
    setIsConnecting(true);

    try {
      // Check system health first
      const isHealthy = await checkSystemHealth();
      if (!isHealthy) {
        throw new Error('Permission system not ready. Please try again.');
      }

      // Simulate call initialization
      console.log(`Starting video call between doctor ${doctorId} and patient ${patientId}`);

      // In a real implementation, this would:
      // 1. Initialize video calling SDK
      // 2. Create call session
      // 3. Handle connection events

      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate async operation

      setCallActive(true);
      onCallStarted?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start video call';
      console.error('Video call error:', error);
      onError?.(errorMessage);
      Alert.alert('Call Failed', errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCallEnd = async () => {
    try {
      // Simulate call termination
      console.log('Ending video call');
      setCallActive(false);
      onCallEnded?.();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  // Audio-only fallback component
  const AudioOnlyFallback = () => (
    <View style={styles.fallbackContainer}>
      <View style={styles.fallbackHeader}>
        <Ionicons name="call" size={24} color="#0066cc" />
        <Text style={styles.fallbackTitle}>Audio-Only Call</Text>
      </View>

      <Text style={styles.fallbackDescription}>
        Camera access is not available, but you can still have an audio consultation with your
        doctor.
      </Text>

      <TouchableOpacity
        style={styles.audioCallButton}
        onPress={handleCallStart}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="call" size={20} color="#fff" />
        )}
        <Text style={styles.audioCallButtonText}>
          {isConnecting ? 'Connecting...' : 'Start Audio Call'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Active call interface
  if (callActive) {
    return (
      <View style={styles.activeCallContainer}>
        <View style={styles.activeCallHeader}>
          <Text style={styles.activeCallTitle}>Video Consultation Active</Text>
          <Text style={styles.activeCallSubtitle}>Dr. Smith • Connected</Text>
        </View>

        <View style={styles.videoContainer}>
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam" size={48} color="#0066cc" />
            <Text style={styles.videoPlaceholderText}>Video Stream</Text>
          </View>
        </View>

        <View style={styles.callControls}>
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="mic" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="videocam" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleCallEnd}
          >
            <Ionicons name="call" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="chatbubble" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <PermissionGate
      permission="camera+microphone"
      context={videoCallContext}
      fallbackContent={<AudioOnlyFallback />}
      onPermissionGranted={() => console.log('Video call permissions granted')}
      onPermissionDenied={() => console.log('Video call permissions denied')}
      onFallbackUsed={() => console.log('Using audio-only fallback')}
    >
      <View style={styles.videoCallContainer}>
        <View style={styles.videoCallHeader}>
          <Ionicons name="videocam" size={32} color="#0066cc" />
          <Text style={styles.videoCallTitle}>Ready for Video Call</Text>
          <Text style={styles.videoCallDescription}>
            Your camera and microphone are ready. Tap below to start your consultation.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.startCallButton}
          onPress={handleCallStart}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="videocam" size={24} color="#fff" />
          )}
          <Text style={styles.startCallButtonText}>
            {isConnecting ? 'Starting Call...' : 'Start Video Consultation'}
          </Text>
        </TouchableOpacity>

        <View style={styles.callInfo}>
          <View style={styles.infoItem}>
            <Ionicons name="shield-checkmark" size={16} color="#28a745" />
            <Text style={styles.infoText}>End-to-end encrypted</Text>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="time" size={16} color="#6c757d" />
            <Text style={styles.infoText}>No time limit</Text>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="people" size={16} color="#6c757d" />
            <Text style={styles.infoText}>Doctor + Patient only</Text>
          </View>
        </View>
      </View>
    </PermissionGate>
  );
};

// Example usage with permission monitoring
export const VideoCallWithMonitoring: React.FC<EnhancedVideoCallProps> = props => {
  const {
    result: cameraResult,
    isChecking: isCheckingCamera,
    error: cameraError,
  } = usePermission('camera', {
    autoCheck: true,
    refreshOnAppActive: true,
  });

  const {
    result: micResult,
    isChecking: isCheckingMic,
    error: micError,
  } = usePermission('microphone', {
    autoCheck: true,
    refreshOnAppActive: true,
  });

  // Show loading state while checking permissions
  if (isCheckingCamera || isCheckingMic) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Checking camera and microphone access...</Text>
      </View>
    );
  }

  // Show error state if there are issues
  if (cameraError || micError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={48} color="#dc3545" />
        <Text style={styles.errorTitle}>Permission Check Failed</Text>
        <Text style={styles.errorMessage}>
          {cameraError || micError || 'Unknown error occurred'}
        </Text>
      </View>
    );
  }

  return <EnhancedVideoCallIntegration {...props} />;
};

const styles = StyleSheet.create({
  // Video Call Container
  videoCallContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  videoCallHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  videoCallTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  videoCallDescription: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Start Call Button
  startCallButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
  },
  startCallButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Call Info
  callInfo: {
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 6,
  },

  // Fallback Container
  fallbackContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  fallbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  fallbackDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
    marginBottom: 20,
  },
  audioCallButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  audioCallButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Active Call Interface
  activeCallContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  activeCallHeader: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  activeCallTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  activeCallSubtitle: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  videoContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    color: '#a0a0a0',
    fontSize: 16,
    marginTop: 8,
  },

  // Call Controls
  callControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 20,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallButton: {
    backgroundColor: '#dc3545',
  },

  // Loading States
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
    textAlign: 'center',
  },

  // Error States
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#dc3545',
    marginTop: 12,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default EnhancedVideoCallIntegration;
