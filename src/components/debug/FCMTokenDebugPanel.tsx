/**
 * FCMTokenDebugPanel
 *
 * Professional debug panel for visualizing and copying FCM push notification tokens
 * Useful for testing push notifications during development
 *
 * Features:
 * - Display FCM token with formatted sections
 * - One-tap copy to clipboard
 * - Platform and token type indicators
 * - Status indicators (available/pending/error)
 * - Professional glass-morphism UI
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Clipboard,
  Alert,
} from 'react-native';

import NotifeeNotificationService from '../../services/NotifeeNotificationService';
import { COLORS } from '../../constants';

interface FCMTokenDebugPanelProps {
  visible?: boolean;
  onToggle?: () => void;
}

export const FCMTokenDebugPanel: React.FC<FCMTokenDebugPanelProps> = ({
  visible = false,
  onToggle
}) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);

  // Poll for FCM token updates
  useEffect(() => {
    const updateToken = () => {
      const pushService = NotifeeNotificationService.getInstance();
      const token = pushService.getFCMToken();
      setFcmToken(token);
    };

    // Initial fetch
    updateToken();

    // Poll every 2 seconds while panel is visible
    const interval = setInterval(updateToken, 2000);

    return () => clearInterval(interval);
  }, []);

  const getPlatformInfo = () => {
    return {
      platform: Platform.OS === 'ios' ? '🍎 iOS' : '🤖 Android',
      tokenType: Platform.OS === 'android' ? 'FCM' : 'Expo',
      color: Platform.OS === 'ios' ? '#007AFF' : '#3DDC84',
    };
  };

  const formatToken = (token: string, truncate: boolean = true) => {
    if (!token) return 'No token available';

    if (truncate && !showFullToken) {
      return `${token.substring(0, 20)}...${token.substring(token.length - 20)}`;
    }

    // Format token in groups of 20 characters for readability
    const groups = [];
    for (let i = 0; i < token.length; i += 20) {
      groups.push(token.substring(i, i + 20));
    }
    return groups.join('\n');
  };

  const copyTokenToClipboard = async () => {
    if (!fcmToken) {
      Alert.alert('⚠️ No Token', 'FCM token is not available yet. Please wait...');
      return;
    }

    try {
      Clipboard.setString(fcmToken);
      setCopySuccess(true);

      // Haptic feedback
      if (Platform.OS === 'ios') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      Alert.alert(
        '✅ Copied!',
        'FCM token copied to clipboard',
        [{ text: 'OK' }]
      );

      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy token:', error);
      Alert.alert('❌ Error', 'Failed to copy token to clipboard');
    }
  };

  const getTokenStatus = () => {
    if (!fcmToken) {
      return {
        text: 'Pending',
        color: '#FF9800',
        icon: 'time-outline' as const,
      };
    }
    return {
      text: 'Available',
      color: '#4CAF50',
      icon: 'checkmark-circle' as const,
    };
  };

  if (!visible) {
    return (
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Ionicons name="notifications" size={20} color="#fff" />
        <Text style={styles.toggleButtonText}>FCM</Text>
      </TouchableOpacity>
    );
  }

  const platformInfo = getPlatformInfo();
  const status = getTokenStatus();

  return (
    <View style={styles.debugPanel}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="notifications" size={24} color="#fff" />
          <Text style={styles.title}>FCM Token Debug</Text>
        </View>
        <TouchableOpacity onPress={onToggle} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Platform & Status Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 Platform Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform:</Text>
            <View style={[styles.badge, { backgroundColor: `${platformInfo.color}33` }]}>
              <Text style={[styles.badgeText, { color: platformInfo.color }]}>
                {platformInfo.platform}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Token Type:</Text>
            <View style={[styles.badge, { backgroundColor: `${platformInfo.color}33` }]}>
              <Text style={[styles.badgeText, { color: platformInfo.color }]}>
                {platformInfo.tokenType}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <View style={[styles.badge, { backgroundColor: `${status.color}33` }]}>
              <Ionicons name={status.icon} size={14} color={status.color} />
              <Text style={[styles.badgeText, { color: status.color, marginLeft: 4 }]}>
                {status.text}
              </Text>
            </View>
          </View>

          {fcmToken && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Length:</Text>
              <Text style={styles.infoValue}>{fcmToken.length} characters</Text>
            </View>
          )}
        </View>

        {/* Token Display */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔑 FCM Token</Text>

          {fcmToken ? (
            <>
              <View style={styles.tokenContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={styles.tokenText} selectable>
                    {formatToken(fcmToken, !showFullToken)}
                  </Text>
                </ScrollView>
              </View>

              <TouchableOpacity
                style={styles.toggleButton2}
                onPress={() => setShowFullToken(!showFullToken)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleButtonText2}>
                  {showFullToken ? 'Show Less' : 'Show Full Token'}
                </Text>
                <Ionicons
                  name={showFullToken ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#4CAF50"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={copyTokenToClipboard}
                style={[styles.copyButton, copySuccess && styles.copyButtonSuccess]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={copySuccess ? 'checkmark-circle' : 'copy'}
                  size={20}
                  color={copySuccess ? '#fff' : '#4CAF50'}
                />
                <Text style={[styles.copyButtonText, copySuccess && styles.copyButtonTextSuccess]}>
                  {copySuccess ? 'Copied!' : 'Copy Token'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.pendingContainer}>
              <Ionicons name="time-outline" size={48} color="#FF9800" />
              <Text style={styles.pendingText}>Waiting for FCM token...</Text>
              <Text style={styles.pendingSubtext}>
                Token will appear here once push notifications are initialized
              </Text>
            </View>
          )}
        </View>

        {/* Usage Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Usage</Text>
          <Text style={styles.instructionText}>
            1. Copy the token using the button above{'\n'}
            2. Use it to send test push notifications from your backend{'\n'}
            3. Token is automatically registered with the backend on login
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
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
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#ccc',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tokenContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  tokenText: {
    fontSize: 12,
    color: '#4CAF50',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  toggleButton2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  toggleButtonText2: {
    color: '#4CAF50',
    fontSize: 12,
    marginRight: 5,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
  copyButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  copyButtonSuccess: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  copyButtonTextSuccess: {
    color: '#fff',
  },
  pendingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  pendingText: {
    fontSize: 16,
    color: '#FF9800',
    fontWeight: 'bold',
    marginTop: 15,
  },
  pendingSubtext: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 20,
  },
});
