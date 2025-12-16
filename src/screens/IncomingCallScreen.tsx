/**
 * IncomingCallScreen
 * 
 * Full-screen incoming call UI for Android 10+ devices
 * Displays when CallKeep is unavailable (budget devices like Tecno Spark 5 Pro)
 * 
 * Features:
 * - Shows over lock screen
 * - Wakes device
 * - Answer/Decline buttons
 * - Caller information display
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import IncomingCallActivityLauncher from '../services/IncomingCallActivityLauncher';
import type { IncomingCallData } from '../services/IncomingCallActivityLauncher';
import CallNavigationManager from '../services/CallNavigationManager';
import CallNotificationManager from '../services/CallNotificationManager';
import { VIDEO_CALL_CONFIG } from '../config/videoCallConfig';

type IncomingCallScreenParams = {
  IncomingCall: {
    callData?: IncomingCallData;
  };
};

const { width, height } = Dimensions.get('window');

const IncomingCallScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<IncomingCallScreenParams, 'IncomingCall'>>();
  const [pulseAnim] = useState(new Animated.Value(1));

  // ✅ Get data from route params OR fallback to launcher
  const [callData, setCallData] = useState<IncomingCallData | null>(
    route.params?.callData || IncomingCallActivityLauncher.getInstance().getActiveCallData()
  );

  // ✅ Update data if route params change
  useEffect(() => {
    if (route.params?.callData) {
      console.log('✅ IncomingCallScreen: Received call data via route params');
      setCallData(route.params.callData);
    }
  }, [route.params?.callData]);

  // ✅ CLEANUP: Clear data and dismiss notification on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 IncomingCallScreen: Unmounting - cleaning up');
      
      // Clear call data from launcher
      IncomingCallActivityLauncher.getInstance().clearActiveCallData();
      
      // Dismiss any lingering notifications
      CallNotificationManager.getInstance().dismissIncomingCallNotification().catch(error => {
        console.warn('⚠️ Failed to dismiss notification on unmount:', error);
      });
    };
  }, []);

  // Pulsing animation for call indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  // Handle answer call
  const handleAnswer = useCallback(() => {
    if (!callData) return;

    console.log('✅ User answered incoming call from screen');

    // Register call session with navigation manager
    CallNavigationManager.getInstance().startCallSession(
      callData.callType,
      callData.callerType === 'doctor' ? 'DoctorDetails' : 'CustomerDetails',
      callData.metadata || {},
      callData.callerName,
      callData.callerType,
      callData.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL
    );

    // Navigate to appropriate details screen with restoreCall flag
    if (callData.callerType === 'doctor') {
      // Create a complete doctor object with all required fields
      const doctorData = callData.metadata?.doctor || {
        id: callData.callerId,
        firstName: callData.callerName.split(' ')[0] || 'Unknown',
        lastName: callData.callerName.split(' ').slice(1).join(' ') || 'Doctor',
        email: `doctor_${callData.callerId}@hopmed.com`,
        phoneNumber: '',
        specialization: 'General Practice',
        accountType: 'health_specialist' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (navigation as any).navigate('DoctorDetails', {
        doctor: doctorData,
        restoreCall: true,
        incomingCallData: callData,
      });
    } else {
      // Create a complete customer object with all required fields
      const customerData = callData.metadata?.customer || {
        id: callData.callerId,
        firstName: callData.callerName.split(' ')[0] || 'Unknown',
        lastName: callData.callerName.split(' ').slice(1).join(' ') || 'Patient',
        email: `patient_${callData.callerId}@hopmed.com`,
        phoneNumber: '',
        accountType: 'customer' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (navigation as any).navigate('CustomerDetails', {
        customer: customerData,
        restoreCall: true,
        incomingCallData: callData,
      });
    }

    // ✅ Dismiss notification
    CallNotificationManager.getInstance().dismissIncomingCallNotification().catch(error => {
      console.warn('⚠️ Failed to dismiss notification on answer:', error);
    });

    // ✅ Clear call data
    IncomingCallActivityLauncher.getInstance().clearActiveCallData();
  }, [callData, navigation]);

  // Handle decline call
  const handleDecline = useCallback(() => {
    if (!callData) return;

    console.log('❌ User declined incoming call from screen');

    // ✅ Trigger decline callback
    IncomingCallActivityLauncher.getInstance().handleDecline();

    // ✅ Explicitly clear data
    IncomingCallActivityLauncher.getInstance().clearActiveCallData();

    // ✅ Dismiss notification
    CallNotificationManager.getInstance().dismissIncomingCallNotification().catch(error => {
      console.warn('⚠️ Failed to dismiss notification on decline:', error);
    });

    // ✅ Navigate back
    navigation.goBack();
  }, [callData, navigation]);

  // ✅ Handle no call data gracefully
  if (!callData) {
    useEffect(() => {
      console.warn('⚠️ IncomingCallScreen: No call data available - navigating back');
      navigation.goBack();
    }, [navigation]);
    return null;
  }

  const isVideoCall = callData.callType === 'video';
  const callerInitials = callData.callerName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
      
      <LinearGradient
        colors={['#4F46E5', '#6366F1', '#8B5CF6']}
        style={styles.gradient}
      >
        {/* Call Type Indicator */}
        <View style={styles.callTypeContainer}>
          <Animated.View style={[styles.callTypeIndicator, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons
              name={isVideoCall ? 'videocam' : 'call'}
              size={32}
              color="#FFFFFF"
            />
          </Animated.View>
          <Text style={styles.callTypeText}>
            Incoming {isVideoCall ? 'Video' : 'Audio'} Call
          </Text>
        </View>

        {/* Caller Information */}
        <View style={styles.callerContainer}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{callerInitials}</Text>
            </View>
          </View>

          {/* Caller Name */}
          <Text style={styles.callerName}>{callData.callerName}</Text>
          
          {/* Caller Type */}
          <Text style={styles.callerType}>
            {callData.callerType === 'doctor' ? '👨‍⚕️ Healthcare Provider' : '👤 Patient'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Decline Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={handleDecline}
            activeOpacity={0.8}
          >
            <View style={styles.actionButtonInner}>
              <Ionicons name="close" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.actionButtonText}>Decline</Text>
          </TouchableOpacity>

          {/* Answer Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.answerButton]}
            onPress={handleAnswer}
            activeOpacity={0.8}
          >
            <View style={styles.actionButtonInner}>
              <Ionicons name="call" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.actionButtonText}>Answer</Text>
          </TouchableOpacity>
        </View>

        {/* Device Info (for debugging) */}
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>
              Android {Platform.Version} • CallKeep Fallback Mode
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4F46E5',
  },
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  callTypeContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  callTypeIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  callTypeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  callerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  callerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  callerType: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.8,
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionButtonInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  declineButton: {},
  answerButton: {},
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  debugInfo: {
    alignItems: 'center',
    paddingTop: 20,
  },
  debugText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.6,
  },
});

// Apply specific styles for decline and answer buttons
StyleSheet.create({
  declineButtonInner: {
    backgroundColor: '#EF4444',
  },
  answerButtonInner: {
    backgroundColor: '#10B981',
  },
});

// Merge button-specific styles
styles.declineButton = {
  ...styles.declineButton,
  ...StyleSheet.create({
    inner: {
      backgroundColor: '#EF4444',
    },
  }).inner,
};

styles.answerButton = {
  ...styles.answerButton,
  ...StyleSheet.create({
    inner: {
      backgroundColor: '#10B981',
    },
  }).inner,
};

export default IncomingCallScreen;
