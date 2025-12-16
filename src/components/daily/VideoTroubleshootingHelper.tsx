/**
 * Production-friendly video troubleshooting helper
 * Shows user-facing diagnostics without relying on console.log
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';

import { isExpoGo } from '../../utils/nativeModuleChecker';

interface VideoTroubleshootingHelperProps {
  visible: boolean;
  onClose: () => void;
  hasVideo: boolean;
  isDailyMediaViewAvailable: boolean;
  videoTrackState?: string;
  isLocal?: boolean;
}

export const VideoTroubleshootingHelper: React.FC<VideoTroubleshootingHelperProps> = ({
  visible,
  onClose,
  hasVideo,
  isDailyMediaViewAvailable,
  videoTrackState = 'unknown',
  isLocal = false,
}) => {
  if (!visible) return null;

  const getDiagnosticInfo = () => {
    const diagnostics = [];

    // Check build environment
    if (isExpoGo()) {
      diagnostics.push({
        issue: 'Expo Go Environment',
        status: 'error',
        message: 'Video calling requires a development build, not available in Expo Go',
        solution: 'Create a development build with EAS Build',
        critical: true,
      });
    }

    // Check Daily MediaView availability
    if (!isDailyMediaViewAvailable) {
      diagnostics.push({
        issue: 'Daily.co MediaView',
        status: 'error',
        message: 'Native Daily.co components not available',
        solution: 'Ensure @daily-co/react-native-daily-js is properly installed and linked',
        critical: true,
      });
    }

    // Check video track state
    if (!hasVideo) {
      let message = 'Video track not available';
      let solution = 'Check camera permissions and device compatibility';

      switch (videoTrackState) {
        case 'blocked':
          message = 'Video track is blocked';
          solution = 'Check camera permissions in device settings';
          break;
        case 'interrupted':
          message = 'Video track interrupted';
          solution = 'Another app may be using the camera. Close other apps and try again';
          break;
        case 'loading':
          message = 'Video track still loading';
          solution = 'Wait a moment for video to initialize';
          break;
        case 'off':
          message = isLocal ? 'Camera is turned off' : 'Remote participant has camera off';
          solution = isLocal
            ? 'Tap the camera button to enable video'
            : 'Ask the other participant to enable video';
          break;
        default:
          message = `Video track state: ${videoTrackState}`;
          solution = 'Try toggling video on/off or restart the call';
      }

      diagnostics.push({
        issue: 'Video Track',
        status: 'warning',
        message,
        solution,
        critical: false,
      });
    }

    return diagnostics;
  };

  const handleOpenSettings = () => {
    Alert.alert(
      'Open Device Settings',
      'Would you like to open device settings to check camera permissions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings();
          },
        },
      ]
    );
  };

  const diagnostics = getDiagnosticInfo();
  const hasCriticalIssues = diagnostics.some(d => d.critical);

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="help-circle" size={24} color="#4CAF50" />
            <Text style={styles.title}>Video Troubleshooting</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Overall Status */}
        <View style={[styles.statusCard, hasCriticalIssues ? styles.statusError : styles.statusOk]}>
          <Ionicons
            name={hasCriticalIssues ? 'warning' : 'checkmark-circle'}
            size={20}
            color={hasCriticalIssues ? '#FF3B30' : '#4CAF50'}
          />
          <Text
            style={[
              styles.statusText,
              hasCriticalIssues ? styles.statusTextError : styles.statusTextOk,
            ]}
          >
            {hasCriticalIssues ? 'Issues Detected' : hasVideo ? 'Video Working' : 'Minor Issues'}
          </Text>
        </View>

        {/* Diagnostics */}
        <View style={styles.diagnosticsList}>
          {diagnostics.map((diagnostic, index) => (
            <View key={index} style={styles.diagnosticItem}>
              <View style={styles.diagnosticHeader}>
                <Ionicons
                  name={diagnostic.status === 'error' ? 'close-circle' : 'warning'}
                  size={16}
                  color={diagnostic.status === 'error' ? '#FF3B30' : '#FF9800'}
                />
                <Text style={styles.diagnosticTitle}>{diagnostic.issue}</Text>
              </View>
              <Text style={styles.diagnosticMessage}>{diagnostic.message}</Text>
              <Text style={styles.diagnosticSolution}>💡 {diagnostic.solution}</Text>
            </View>
          ))}

          {diagnostics.length === 0 && (
            <View style={styles.allGoodContainer}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
              <Text style={styles.allGoodText}>All systems operational!</Text>
              <Text style={styles.allGoodSubtext}>Video should be working properly</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenSettings}>
            <Ionicons name="settings" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Device Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={onClose}>
            <Text style={styles.actionButtonText}>Got It</Text>
          </TouchableOpacity>
        </View>

        {/* Build Info */}
        <View style={styles.buildInfo}>
          <Text style={styles.buildInfoText}>
            Build: {Constants.appOwnership} • Platform:{' '}
            {Constants.platform?.ios ? 'iOS' : 'Android'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginHorizontal: 20,
    maxHeight: '80%',
    minWidth: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  statusOk: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  statusError: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusTextOk: {
    color: '#4CAF50',
  },
  statusTextError: {
    color: '#FF3B30',
  },
  diagnosticsList: {
    paddingHorizontal: 20,
    maxHeight: 300,
  },
  diagnosticItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  diagnosticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  diagnosticTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  diagnosticMessage: {
    fontSize: 13,
    color: '#ccc',
    marginBottom: 8,
    lineHeight: 18,
  },
  diagnosticSolution: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  allGoodContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  allGoodText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 8,
  },
  allGoodSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  buildInfo: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  buildInfoText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
