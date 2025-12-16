/**
 * IncomingCallDebugPanel
 * 
 * On-device debug panel to diagnose incoming call issues
 * Shows real-time status of CallKeep, notifications, and call flow
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import IncomingCallManager from '../../services/IncomingCallManager';
import PushNotificationService from '../../services/PushNotificationService';
import IncomingCallActivityLauncher from '../../services/IncomingCallActivityLauncher';

interface DebugLog {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export const IncomingCallDebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [callKeepStatus, setCallKeepStatus] = useState<string>('Checking...');
  const [isCallKeepActive, setIsCallKeepActive] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<string>('Checking...');
  const [pushToken, setPushToken] = useState<string | null>(null);

  // Add log entry with safety check
  const addLog = (level: DebugLog['level'], message: string) => {
    try {
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [...prev, { timestamp, level, message }].slice(-50)); // Keep last 50 logs
    } catch (error) {
      // Silently fail to prevent render issues
      console.warn('Failed to add log entry:', error);
    }
  };

  // Check CallKeep status
  const checkCallKeepStatus = async () => {
    try {
      addLog('info', 'Checking CallKeep status...');
      const manager = IncomingCallManager.getInstance();
      await manager.initialize();
      
      const status = manager.getCallKeepStatus();
      const isActive = manager.isCallKeepActive();
      
      setCallKeepStatus(status);
      setIsCallKeepActive(isActive);
      
      if (isActive) {
        addLog('success', `CallKeep is ACTIVE: ${status}`);
      } else {
        addLog('warning', `CallKeep is INACTIVE: ${status}`);
      }
    } catch (error) {
      addLog('error', `CallKeep check failed: ${error}`);
      setCallKeepStatus('Error checking status');
    }
  };

  // Check notification permissions
  const checkNotificationPermissions = async () => {
    try {
      addLog('info', 'Checking notification permissions...');
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationPermission(status);
      
      if (status === 'granted') {
        addLog('success', `Notification permission: ${status}`);
      } else {
        addLog('warning', `Notification permission: ${status}`);
      }
    } catch (error) {
      addLog('error', `Permission check failed: ${error}`);
    }
  };

  // Check push token
  const checkPushToken = async () => {
    try {
      addLog('info', 'Checking push token...');
      const pushService = PushNotificationService.getInstance();
      const token = pushService.getPushToken();
      
      if (token) {
        setPushToken(token.substring(0, 30) + '...');
        addLog('success', `Push token exists: ${token.substring(0, 30)}...`);
      } else {
        addLog('warning', 'No push token found');
      }
    } catch (error) {
      addLog('error', `Push token check failed: ${error}`);
    }
  };

  // Send test incoming call
  const sendTestCall = async () => {
    try {
      addLog('info', '🧪 Sending test incoming call...');
      
      const manager = IncomingCallManager.getInstance();
      const callUuid = await manager.displayIncomingCall({
        callerId: 'test-doctor-123',
        callerName: 'Dr. Test Smith',
        callerType: 'doctor',
        callType: 'video',
        roomUrl: 'https://mbinina.daily.co/ZVpxSgQtPXff8Cq9l44z',
        metadata: {
          test: true,
          doctor: {
            id: 'test-doctor-123',
            firstName: 'Test',
            lastName: 'Smith',
            email: 'test.smith@hopmed.com',
            phoneNumber: '+1234567890',
            specialization: 'Cardiology',
            accountType: 'health_specialist' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
      
      addLog('success', `✅ Test call displayed! UUID: ${callUuid}`);
      Alert.alert(
        'Test Call Sent',
        `Call UUID: ${callUuid}\n\nCheck if you see the incoming call UI!`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      addLog('error', `❌ Test call failed: ${error}`);
      Alert.alert('Test Call Failed', String(error));
    }
  };

  // Test notification
  const testNotification = async () => {
    try {
      addLog('info', '🔔 Sending test notification...');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📞 Test Incoming Call',
          body: 'Dr. Test Smith is calling...',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: {
            type: 'test_notification',
          },
        },
        trigger: null,
      });
      
      addLog('success', '✅ Test notification sent!');
    } catch (error) {
      addLog('error', `❌ Test notification failed: ${error}`);
    }
  };

  // Test activity launcher
  const testActivityLauncher = async () => {
    try {
      addLog('info', '🚀 Testing activity launcher...');
      
      const launcher = IncomingCallActivityLauncher.getInstance();
      await launcher.launchIncomingCallUI({
        callId: 'test-call-123',
        callerId: 'test-doctor-123',
        callerName: 'Dr. Test Smith',
        callerType: 'doctor',
        callType: 'video',
        roomUrl: 'https://mbinina.daily.co/ZVpxSgQtPXff8Cq9l44z',
        metadata: {
          test: true,
          doctor: {
            id: 'test-doctor-123',
            firstName: 'Test',
            lastName: 'Smith',
            email: 'test.smith@hopmed.com',
            phoneNumber: '+1234567890',
            specialization: 'Cardiology',
            accountType: 'health_specialist' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
      
      addLog('success', '✅ Activity launcher triggered!');
    } catch (error) {
      addLog('error', `❌ Activity launcher failed: ${error}`);
    }
  };

  // Run all checks on mount
  useEffect(() => {
    if (isVisible) {
      addLog('info', '=== Starting Diagnostic Checks ===');
      checkCallKeepStatus();
      checkNotificationPermissions();
      checkPushToken();
    }
  }, [isVisible]);

  // Intercept console logs - only when panel is visible to prevent render issues
  useEffect(() => {
    if (!isVisible) return;

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      const message = args.join(' ');
      if (message.includes('CallKeep') || message.includes('FALLBACK') || message.includes('📞') || message.includes('📱')) {
        // Use setTimeout to defer state update outside render phase
        setTimeout(() => addLog('info', message), 0);
      }
      originalLog(...args);
    };

    console.warn = (...args) => {
      const message = args.join(' ');
      if (message.includes('CallKeep') || message.includes('FALLBACK') || message.includes('⚠️')) {
        // Use setTimeout to defer state update outside render phase
        setTimeout(() => addLog('warning', message), 0);
      }
      originalWarn(...args);
    };

    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('CallKeep') || message.includes('FALLBACK') || message.includes('❌')) {
        // Use setTimeout to defer state update outside render phase
        setTimeout(() => addLog('error', message), 0);
      }
      originalError(...args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [isVisible]); // Only intercept when panel is visible

  if (!isVisible) {
    return (
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setIsVisible(true)}
      >
        <Ionicons name="bug" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔍 Incoming Call Debug</Text>
        <TouchableOpacity onPress={() => setIsVisible(false)}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Device Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 Device Info</Text>
          <Text style={styles.infoText}>Platform: {Platform.OS} {Platform.Version}</Text>
          <Text style={styles.infoText}>Device: {Device.modelName || 'Unknown'}</Text>
          <Text style={styles.infoText}>Is Physical: {Device.isDevice ? 'Yes' : 'No (Simulator)'}</Text>
        </View>

        {/* CallKeep Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📞 CallKeep Status</Text>
          <View style={[styles.statusBadge, isCallKeepActive ? styles.statusActive : styles.statusInactive]}>
            <Text style={styles.statusText}>
              {isCallKeepActive ? '✅ ACTIVE' : '❌ INACTIVE'}
            </Text>
          </View>
          <Text style={styles.infoText}>{callKeepStatus}</Text>
        </View>

        {/* Notification Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Notifications</Text>
          <Text style={styles.infoText}>Permission: {notificationPermission}</Text>
          {pushToken && <Text style={styles.infoText}>Token: {pushToken}</Text>}
        </View>

        {/* Test Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Test Actions</Text>
          
          <TouchableOpacity style={styles.testButton} onPress={sendTestCall}>
            <Text style={styles.testButtonText}>📞 Send Test Incoming Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={testNotification}>
            <Text style={styles.testButtonText}>🔔 Send Test Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={testActivityLauncher}>
            <Text style={styles.testButtonText}>🚀 Test Activity Launcher</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={checkCallKeepStatus}>
            <Text style={styles.testButtonText}>🔄 Refresh Status</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.clearButton]} 
            onPress={() => setLogs([])}
          >
            <Text style={styles.testButtonText}>🗑️ Clear Logs</Text>
          </TouchableOpacity>
        </View>

        {/* Logs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Live Logs ({logs.length})</Text>
          {logs.length === 0 ? (
            <Text style={styles.infoText}>No logs yet...</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={styles.logEntry}>
                <Text style={[styles.logLevel, styles[`log_${log.level}`]]}>
                  {log.level.toUpperCase()}
                </Text>
                <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                <Text style={styles.logMessage}>{log.message}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 9999,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1F2937',
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  statusActive: {
    backgroundColor: '#10B981',
  },
  statusInactive: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  testButton: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#6B7280',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  logEntry: {
    backgroundColor: '#1F2937',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#6B7280',
  },
  logLevel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  log_info: {
    color: '#3B82F6',
  },
  log_success: {
    color: '#10B981',
  },
  log_warning: {
    color: '#F59E0B',
  },
  log_error: {
    color: '#EF4444',
  },
  logTimestamp: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 12,
    color: '#D1D5DB',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
