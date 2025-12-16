/**
 * ✅ IMPROVED: DoctorDetailsScreen following Official Daily.co Patterns
 *
 * Key Improvements:
 * - Removed duplicate call state management
 * - Simplified to official Daily.co App.tsx pattern
 * - Clean separation of concerns
 * - Proper call lifecycle management
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  Platform,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import { useSelector } from 'react-redux';

import AppStateManager from '../../utils/AppStateManager';
import CallNavigationManager from '../../services/CallNavigationManager';
import {
  AdaptiveTouchableOpacity,
  AdaptiveCard,
  AdaptiveAnimatedView,
  useAdaptiveTheme,
} from '../../components/adaptive/AdaptiveComponents';
import { DoctorDetailsSkeleton } from '../../components/common/SkeletonLoader';
import { EnterpriseCallInterface } from '../../components/daily/EnterpriseCallInterface';
import { IntegrationVerifier } from '../../components/daily/IntegrationVerifier';
import { FCMTokenDebugPanel } from '../../components/debug/FCMTokenDebugPanel';
import CallDebugPanel, { type CallDebugInfo } from '../../components/CallDebugPanel';
import { VIDEO_CALL_CONFIG } from '../../config/videoCallConfig';
import { COLORS } from '../../constants';
import { useOptimizedLoading } from '../../hooks/useOptimizedLoading';
import { usePerformanceTracking, useDimensionTracking } from '../../hooks/usePerformanceTracking';
import deviceCapabilityService from '../../services/deviceCapabilityService';
import type { RootState } from '../../store';
import type { HealthSpecialistDto } from '../../types/api';
import { permissionAwareCallInitiator } from '../../utils/PermissionAwareCallInitiator';
import { SentryErrorTracker } from '../../utils/sentryErrorTracker';
import VideoCallDebugger from '../../utils/VideoCallDebugger';
import { validateUUID } from '../../utils/uuidValidator';
import { callsApi } from '../../services/api/callsApi';

interface DoctorDetailsParamList {
  DoctorDetails: {
    doctor: HealthSpecialistDto;
    restoreCall?: boolean;
    incomingCallData?: {
      callUuid: string;
      callerId: string;
      callerName: string;
      callerType: 'customer' | 'doctor';
      callType: 'audio' | 'video';
      roomUrl: string;
      metadata?: Record<string, any>;
    };
  };
  [key: string]: object | undefined; // Add index signature for TypeScript compatibility
}
type DoctorDetailsRoute = RouteProp<DoctorDetailsParamList, 'DoctorDetails'>;

const DoctorDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<DoctorDetailsRoute>();
  const { doctor, restoreCall, incomingCallData } = route.params || {};

  // ✅ CRITICAL: Early validation to prevent undefined access
  useEffect(() => {
    if (!doctor) {
      console.error('❌ DoctorDetailsScreen: doctor is undefined in route params');
      Alert.alert(
        'Error',
        'Doctor information is missing. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }
  }, [doctor, navigation]);

  // Performance tracking
  usePerformanceTracking({
    componentName: 'DoctorDetailsScreen',
    trackDimensions: true,
    trackMemory: true,
    trackRenders: true,
  });

  // Dimension tracking with performance monitoring
  const { dimensions: screenDimensions } = useDimensionTracking('DoctorDetailsScreen');

  const { user } = useSelector((state: RootState) => state.auth);

  // ✅ CRITICAL: Return early if doctor is undefined to prevent crashes
  if (!doctor) {
    return (
      <LinearGradient
        colors={COLORS.BRAND_GRADIENT}
        locations={COLORS.BRAND_GRADIENT_LOCATIONS}
        start={COLORS.BRAND_GRADIENT_START}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
      </LinearGradient>
    );
  }

  // ✅ IMPROVED: Role anomaly tracking
  const roleAnomalyLoggedRef = useRef(false);

  useEffect(() => {
    roleAnomalyLoggedRef.current = false;
  }, [doctor?.id]);

  useEffect(() => {
    const userRole = user?.accountType;
    if (!roleAnomalyLoggedRef.current) {
      if (userRole === 'health_specialist') {
        console.warn('⚠️ Doctor user on DoctorDetailsScreen - possible navigation issue');
        SentryErrorTracker.getInstance().trackWarning(
          'Doctor user navigated to DoctorDetailsScreen',
          {
            screen: 'DoctorDetailsScreen',
            doctorId: doctor.id,
            additional: {
              userRole,
              doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
              severity: 'warning',
            },
          }
        );
        roleAnomalyLoggedRef.current = true;
      } else if (userRole !== 'customer') {
        console.warn('⚠️ Unknown user role on DoctorDetailsScreen:', userRole);
        roleAnomalyLoggedRef.current = true;
      }
    }
  }, [user?.accountType, doctor?.id]);

  // ✅ WORKING PATTERN: Using fixed CallInterface component
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('video');
  const [roomUrl, setRoomUrl] = useState<string | undefined>(undefined);

  // 🔍 DEBUG: FCM Token Debug Panel
  const [showFCMDebugPanel, setShowFCMDebugPanel] = useState(false);

  // 🔍 DEBUG: Call Debug Panel
  const [showCallDebugPanel, setShowCallDebugPanel] = useState(false);
  const [callDebugInfo, setCallDebugInfo] = useState<CallDebugInfo | null>(null);

  // ✅ SIMPLIFIED: Removed duplicate background state management
  // All background/foreground handling is now done by:
  // - EnterpriseCallInterface (UI state)
  // - VideoCallBackgroundManager (video recovery)
  // - CallKit/ForegroundService (native integration)

  // Adaptive theme and optimizations
  const { isLowEndDevice, shouldUseShadows, getAnimationDuration } = useAdaptiveTheme();

  // Optimized loading with proper timing
  const { isLoading, showContent, finishLoading } = useOptimizedLoading({
    minLoadingTime: isLowEndDevice ? 500 : 800,
    delayMs: isLowEndDevice ? 100 : 200,
  });
  const finishLoadingRef = useRef(finishLoading);
  useEffect(() => {
    finishLoadingRef.current = finishLoading;
  }, [finishLoading]);

  // Derived styles for performance/safety with AdaptiveCard typing
  const doctorCardStyle = useMemo(() => {
    if (!shouldUseShadows) {
      return {
        ...styles.doctorCard,
        shadowColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0 as any,
      };
    }
    return styles.doctorCard;
  }, [shouldUseShadows]);

  const screenData = useMemo(() => {
    const { width, height } = screenDimensions;
    const isSmallScreen = width < 375;
    const isLargeScreen = width > 414;
    const isTablet = deviceCapabilityService.getCapabilities().isTablet;

    return {
      width,
      height,
      isSmallScreen,
      isLargeScreen,
      isTablet,
      avatarSize: isTablet ? 100 : isSmallScreen ? 70 : 80,
      headerPadding: isTablet ? 40 : isSmallScreen ? 15 : 20,
    };
  }, [screenDimensions.width, screenDimensions.height]);

  // Initialize loading completion
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) finishLoadingRef.current();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // ✅ IMPROVED: Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup handled by CallInterface component
    };
  }, []);

  // ✅ IMPROVED: Reset state on focus/blur
  useFocusEffect(
    useCallback(() => {
      // On focus - reset call interface if not in call
      return () => {
        // Cleanup handled by CallInterface
      };
    }, [])
  );

  // 🧭 Handle call restoration when screen is opened with restoreCall flag
  useEffect(() => {
    if (restoreCall && !inCall) {
      console.log('🧭 Attempting to restore call session for doctor:', doctor.firstName, doctor.lastName);

      // Get the persisted call state from navigation manager
      const callNavigationManager = CallNavigationManager.getInstance();
      const persistedCallState = callNavigationManager.getCurrentCallState();

      // ✅ CRITICAL FIX: Only restore if we actually have a valid persisted call state
      // This check is synchronous and happens AFTER endCallSession() has cleared the state
      if (persistedCallState && persistedCallState.isInCall) {
        console.log('✅ Found valid persisted call state, restoring call');

        // Restore the call state
        setCallType(persistedCallState.callType);
        setRoomUrl(persistedCallState.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL);
        setInCall(true);

        // ✅ Background recovery is now handled by EnterpriseCallInterface + VideoCallBackgroundManager
      } else {
        console.log('❌ No valid call state to restore (call was ended intentionally or expired)');
      }
    }
  }, [restoreCall, inCall, doctor.firstName, doctor.lastName]);

  // 📞 CRITICAL FIX: Handle incoming call data from push notification
  // This is called when user answers an incoming call via CallKeep/push notification
  useEffect(() => {
    if (incomingCallData && !inCall) {
      console.log('📞 Incoming call detected - automatically showing call interface');
      console.log('   Caller:', incomingCallData.callerName);
      console.log('   Call type:', incomingCallData.callType);
      console.log('   Room URL:', incomingCallData.roomUrl);

      // Set call state to show the call interface
      setCallType(incomingCallData.callType);
      setRoomUrl(incomingCallData.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL);
      setInCall(true);

      // Log for debugging
      VideoCallDebugger.logCallStart({
        userId: user?.id || 'unknown',
        userName: user?.accountType === 'customer'
          ? `${user?.firstName || ''} ${user?.lastName || ''}`
          : `Dr. ${user?.firstName || ''} ${user?.lastName || ''}`,
        userRole: user?.accountType || 'unknown',
        roomUrl: incomingCallData.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL,
        screen: 'DoctorDetailsScreen_IMPROVED (Incoming Call)',
      });

      // 🧭 Register call session for incoming calls
      try {
        CallNavigationManager.getInstance().startCallSession(
          incomingCallData.callType,
          'DoctorDetails',
          { doctor },
          `Dr. ${doctor.firstName} ${doctor.lastName}`,
          'doctor',
          incomingCallData.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL
        );
      } catch {}

      console.log('✅ Incoming call interface activated');
    }
  }, [incomingCallData, inCall, user]);

  // Reset anomaly logging when viewing a different entity
  useEffect(() => {
    roleAnomalyLoggedRef.current = false;
  }, [doctor?.id]);

  // ✅ WORKING PATTERN: Simple call management using fixed CallInterface

  // Call handlers for CallInterface
  const handleCallError = useCallback((error: Error) => {
    console.error('Call error:', error);

    // 🧭 End call session with navigation manager on error
    CallNavigationManager.getInstance().endCallSession();

    setInCall(false);
    Alert.alert('Call Error', error.message || 'An error occurred during the call');
  }, []);

  const handleEndCall = useCallback(() => {
    console.log('🔴 DoctorDetailsScreen: handleEndCall called');
    VideoCallDebugger.logCallEnd();

    // 🧭 CRITICAL: End call session FIRST to clear persisted state
    // This prevents the restoration useEffect from rejoining
    CallNavigationManager.getInstance().endCallSession();
    console.log('🔴 DoctorDetailsScreen: Call session ended in NavigationManager');

    // Clear call state immediately to prevent restoration
    setInCall(false);
    setRoomUrl(undefined);
    console.log('🔴 DoctorDetailsScreen: Call state cleared (inCall=false, roomUrl=undefined)');

    // ✅ Cleanup is handled by EnterpriseCallInterface - no need to call here
    // Calling it here creates race conditions
  }, []);

  // PERFORMANCE: Memoized call handler with optimized dependencies
  const isStartingCallRef = useRef(false);
  const handleCallPress = useCallback(
    async (requestedCallType: 'audio' | 'video') => {
      if (isStartingCallRef.current) return;
      if (!user) {
        Alert.alert('Error', 'User not found. Please log in again.');
        return;
      }
      isStartingCallRef.current = true;

      // ✅ ENHANCED: Send push notification to recipient before joining call
      const startCall = async () => {
        // ✅ FIX: Ensure user is still valid when async function executes
        if (!user || !user.id || !user.accountType) {
          console.error('❌ User data invalid at call start time');
          Alert.alert('Error', 'User session invalid. Please log in again.');
          return;
        }

        if (__DEV__) {
          // Using conditional dev logging to satisfy lint rule prohibiting console in production
          // eslint-disable-next-line no-console
          console.log(`🎯 Starting ${requestedCallType} call with CallInterface`);
        }

        try {
          // 📞 CRITICAL: Send push notification to recipient
          console.log('📞 Sending push notification to recipient...');
          console.log('🔍 DEBUG: doctor.userId =', doctor.userId);
          console.log('🔍 DEBUG: doctor object =', JSON.stringify(doctor, null, 2));
          
          // ✅ CRITICAL: Check if userId exists before validation
          if (!doctor.userId) {
            console.error('❌ doctor.userId is missing - cannot initiate call');
            throw new Error('Doctor user ID is missing. Please refresh the doctor list and try again.');
          }
          
          // ✅ ENHANCED VALIDATION: Ensure userId exists and is valid UUID format
          validateUUID(doctor.userId, 'Doctor userId');
          console.log('✅ Valid doctor userId format confirmed:', doctor.userId);

          // ✅ FIX: Use userId (not doctor.id) to look up user in backend
          const initiateResult = await callsApi.initiateCall(
            doctor.userId,  // ✅ FIX: Use User ID for backend lookup
            requestedCallType,
            {
              doctorId: doctor.id,
              doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
              callerName: user.accountType === 'customer'
                ? `${user.firstName || ''} ${user.lastName || ''}`
                : `Dr. ${user.firstName || ''} ${user.lastName || ''}`,
              // ✅ CRITICAL: Include full doctor object for push notification navigation
              doctor: {
                id: doctor.id,
                userId: doctor.userId,
                firstName: doctor.firstName,
                lastName: doctor.lastName,
                specialistType: doctor.specialistType,
              },
            }
          );

          // ✅ Call ALWAYS succeeds now - push notification is optional
          if (initiateResult.success) {
            console.log('✅ Call initiated successfully');
            
            // Show helpful message based on push status
            const pushStatus = (initiateResult as any).pushStatus;
            if (pushStatus === 'sent') {
              console.log('  📱 Push notification sent to recipient');
            } else if (pushStatus === 'failed' || pushStatus === 'error') {
              console.warn('  ⚠️ Push notification failed (call will still work if recipient is in app)');
              // Show non-intrusive toast message
              if (__DEV__) {
                const pushError = (initiateResult as any).pushError;
                console.log(`  Debug: ${pushError}`);
              }
            }

            // 🔍 Store debug info for troubleshooting
            setCallDebugInfo({
              timestamp: new Date().toISOString(),
              caller: user.accountType === 'customer'
                ? `${user.firstName || ''} ${user.lastName || ''}`
                : `Dr. ${user.firstName || ''} ${user.lastName || ''}`,
              recipient: `Dr. ${doctor.firstName} ${doctor.lastName}`,
              callType: requestedCallType,
              initiationSuccess: true,
              pushStatus: (initiateResult as any).pushStatus,
              pushError: (initiateResult as any).pushError,
              roomUrl: initiateResult.data?.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL,
              requestPayload: {
                recipientId: doctor.userId,
                callType: requestedCallType,
                metadata: {
                  doctorId: doctor.id,
                  doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
                  callerName: user.accountType === 'customer'
                    ? `${user.firstName || ''} ${user.lastName || ''}`
                    : `Dr. ${user.firstName || ''} ${user.lastName || ''}`,
                },
              },
            });
          }

          // Log call session for debugging
          VideoCallDebugger.logCallStart({
            userId: user.id,
            userName:
              user.accountType === 'customer'
                ? `${user.firstName || ''} ${user.lastName || ''}`
                : `Dr. ${user.firstName || ''} ${user.lastName || ''}`,
            userRole: user.accountType || 'unknown',
            roomUrl: initiateResult.data?.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL,
            screen: 'DoctorDetailsScreen_IMPROVED',
          });

          // 🧭 Register call session with navigation manager
          CallNavigationManager.getInstance().startCallSession(
            requestedCallType,
            'DoctorDetails',
            { doctor },
            `Dr. ${doctor.firstName} ${doctor.lastName}`,
            'doctor',
            initiateResult.data?.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL
          );

          // Join the room after sending push notification
          setCallType(requestedCallType);
          setRoomUrl(initiateResult.data?.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL);
          setInCall(true);
        } catch (error: any) {
          console.error('❌ Failed to initiate call:', error);

          // 🔍 Enhanced error capture for debugging
          const errorDetails: any = {
            errorType: error?.constructor?.name || 'Unknown',
            errorMessage: error?.message || String(error),
            errorCode: error?.code,
            errorStack: error?.stack,
          };

          // Capture axios-specific error info
          if (error?.response) {
            errorDetails.httpStatus = error.response.status;
            errorDetails.httpData = error.response.data;
            errorDetails.httpHeaders = error.response.headers;
          }

          // Capture request info if available
          if (error?.config) {
            errorDetails.requestUrl = error.config.url;
            errorDetails.requestMethod = error.config.method;
            errorDetails.requestData = error.config.data;
          }

          // 🔍 Store debug info for troubleshooting
          setCallDebugInfo({
            timestamp: new Date().toISOString(),
            caller: user.accountType === 'customer'
              ? `${user.firstName || ''} ${user.lastName || ''}`
              : `Dr. ${user.firstName || ''} ${user.lastName || ''}`,
            recipient: `Dr. ${doctor.firstName} ${doctor.lastName}`,
            callType: requestedCallType,
            initiationSuccess: false,
            error: error?.message || 'Failed to initiate call',
            requestPayload: {
              recipientId: doctor.userId || 'MISSING',
              callType: requestedCallType,
              metadata: {
                doctorId: doctor.id,
                doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
                callerName: user.accountType === 'customer'
                  ? `${user.firstName || ''} ${user.lastName || ''}`
                  : `Dr. ${user.firstName || ''} ${user.lastName || ''}`,
              },
            },
            additionalInfo: errorDetails,
          });

          // Show error with debug button
          Alert.alert(
            'Call Failed',
            error.userMessage || 'Failed to initiate call. Please try again.',
            [
              {
                text: 'View Debug Info',
                onPress: () => setShowCallDebugPanel(true),
              },
              {
                text: 'OK',
                style: 'cancel',
              },
            ]
          );

          // Track error
          SentryErrorTracker.getInstance().trackCriticalError(error, {
            screen: 'DoctorDetailsScreen_IMPROVED',
            callType: requestedCallType,
            doctorId: doctor.id,
            additional: {
              doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
              severity: 'error',
            },
          });
        }
      };

      try {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log(`🎯 Initiating ${requestedCallType} call`);
        }

        // ✅ SIMPLIFIED: Direct call initiation (permission system causing issues)
        // Permissions are handled by Daily.co SDK when user joins call
        await startCall();
      } catch (error) {
        // Error already handled in startCall() catch block with debug panel
        console.error(`❌ Call initiation error:`, error);
      } finally {
        isStartingCallRef.current = false;
      }
    },
    [
      user, // Include entire user object to capture all changes
      doctor?.id,
      doctor?.firstName,
      doctor?.lastName,
    ]
  );

  // Navigation handler

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // 🧭 Navigation guards to prevent leaving call screen during active calls
  useEffect(() => {
    if (!inCall) return;

    console.log('🧭 Setting up navigation guards for active call');

    const handleBackPress = () => {
      if (inCall) {
        // Show confirmation dialog before leaving call
        Alert.alert(
          'End Call?',
          'You are currently in a call. Do you want to end the call and go back?',
          [
            {
              text: 'Stay in Call',
              style: 'cancel',
            },
            {
              text: 'End Call',
              style: 'destructive',
              onPress: () => {
                handleEndCall();
                navigation.goBack();
              },
            },
          ],
          { cancelable: true }
        );
        return true; // Prevent default back action
      }
      return false; // Allow default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    // Also enable navigation guards in CallNavigationManager
    CallNavigationManager.getInstance().enableNavigationGuards();

    return () => {
      backHandler.remove();
      // Don't disable navigation guards here as they might be needed for other screens
    };
  }, [inCall, handleEndCall, navigation]);

  // Android hardware back button handling (when not in call)
  useEffect(() => {
    if (Platform.OS === 'android' && !inCall) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });

      return () => backHandler.remove();
    }
  }, [goBack, inCall]);

  if (isLoading || !showContent) {
    return (
      <LinearGradient
        colors={COLORS.BRAND_GRADIENT}
        locations={COLORS.BRAND_GRADIENT_LOCATIONS}
        start={COLORS.BRAND_GRADIENT_START}
        style={styles.container}
      >
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: screenData.headerPadding,
              paddingTop: Math.max(
                Platform.OS === 'ios' ? 44 : 24,
                Platform.OS === 'ios' ? 60 : 48
              ),
            },
          ]}
        >
          <AdaptiveTouchableOpacity
            style={[
              styles.backButton,
              Platform.OS === 'android' && {
                paddingLeft: 16,
                paddingRight: 12,
              },
            ]}
            onPress={goBack}
            enableHaptics
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Navigate back to the previous screen"
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.WHITE} />
          </AdaptiveTouchableOpacity>
          <Text style={styles.headerTitle}>Doctor Details</Text>
          <View style={styles.placeholder} />
        </View>
        <DoctorDetailsSkeleton />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
      style={styles.container}
    >
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: screenData.headerPadding,
            paddingTop: Math.max(Platform.OS === 'ios' ? 44 : 24, Platform.OS === 'ios' ? 60 : 48),
          },
        ]}
      >
        <AdaptiveTouchableOpacity
          style={[
            styles.backButton,
            Platform.OS === 'android' && {
              paddingLeft: 16,
              paddingRight: 12,
            },
          ]}
          onPress={goBack}
          enableHaptics
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Navigate back to the previous screen"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.WHITE} />
        </AdaptiveTouchableOpacity>
        <Text style={styles.headerTitle}>Doctor Details</Text>
        <View style={styles.placeholder} />
      </View>

      {/* ✨ ENTERPRISE: Using enhanced EnterpriseCallInterface component */}
      {inCall && roomUrl ? (
        <EnterpriseCallInterface
          roomUrl={roomUrl}
          callType={callType}
          contactName={`Dr. ${doctor.firstName} ${doctor.lastName}`}
          contactTitle={doctor.specialistType}
          onEndCall={handleEndCall}
          onError={handleCallError}
          autoJoin
          userName={
            user?.accountType === 'customer'
              ? `${user.firstName} ${user.lastName}`
              : `Dr. ${user?.firstName} ${user?.lastName}`
          }
          userId={user?.id}
          medicalContext={{
            consultationType: 'routine',
            appointmentTime: new Date(),
          }}
        />
      ) : (
        <>
          {/* <IntegrationVerifier screenName="DoctorDetailsScreen_IMPROVED" /> */}
          {/* <FCMTokenDebugPanel
            visible={showFCMDebugPanel}
            onToggle={() => setShowFCMDebugPanel(!showFCMDebugPanel)}
          /> */}
          {/* <CallDebugPanel
            visible={showCallDebugPanel}
            onClose={() => setShowCallDebugPanel(false)}
            debugInfo={callDebugInfo}
          /> */}

          {/* 🔍 Floating Debug Button */}
          {callDebugInfo && (
            <TouchableOpacity
              style={styles.floatingDebugButton}
              onPress={() => setShowCallDebugPanel(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="bug" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={isLowEndDevice}
            keyboardShouldPersistTaps="handled"
          >
            <AdaptiveAnimatedView
              animationType={isLowEndDevice ? 'fadeIn' : 'slideUp'}
              duration={getAnimationDuration('normal')}
              delay={100}
            >
              <AdaptiveCard style={doctorCardStyle}>
                <View style={styles.doctorHeader}>
                  <View style={styles.avatarContainer}>
                    {doctor.profilePicture ? (
                      <Image
                        source={{ uri: doctor.profilePicture }}
                        style={[
                          styles.avatar,
                          {
                            width: screenData.avatarSize,
                            height: screenData.avatarSize,
                            borderRadius: screenData.avatarSize / 2,
                          },
                        ]}
                        resizeMode="cover"
                        {...(isLowEndDevice && { fadeDuration: 100 })}
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatarPlaceholder,
                          {
                            width: screenData.avatarSize,
                            height: screenData.avatarSize,
                            borderRadius: screenData.avatarSize / 2,
                          },
                        ]}
                      >
                        <Ionicons name="person" size={screenData.avatarSize * 0.5} color="#666" />
                      </View>
                    )}
                    <View
                      style={[
                        styles.onlineIndicator,
                        {
                          backgroundColor: doctor.isOnline ? '#4CAF50' : '#999',
                          width: screenData.isSmallScreen ? 14 : 16,
                          height: screenData.isSmallScreen ? 14 : 16,
                          borderRadius: (screenData.isSmallScreen ? 14 : 16) / 2,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.doctorInfo}>
                    <View style={styles.nameContainer}>
                      <Text
                        style={[
                          styles.doctorName,
                          screenData.isSmallScreen && styles.doctorNameSmall,
                          screenData.isTablet && styles.doctorNameTablet,
                        ]}
                      >
                        Dr. {doctor.firstName} {doctor.lastName}
                      </Text>
                      {doctor.isVerified && (
                        <Ionicons
                          name="checkmark-circle"
                          size={screenData.isSmallScreen ? 18 : 20}
                          color="#4CAF50"
                          style={styles.verifiedIcon}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.specialty,
                        screenData.isSmallScreen && styles.specialtySmall,
                        screenData.isTablet && styles.specialtyTablet,
                      ]}
                    >
                      {doctor.specialistType}
                    </Text>
                    <View style={styles.ratingContainer}>
                      <Ionicons
                        name="star"
                        size={screenData.isSmallScreen ? 14 : 16}
                        color="#FFD700"
                      />
                      <Text style={[styles.rating, screenData.isSmallScreen && styles.ratingSmall]}>
                        {doctor.rating}
                      </Text>
                      <Text
                        style={[styles.reviews, screenData.isSmallScreen && styles.reviewsSmall]}
                      >
                        ({doctor.totalReviews} reviews)
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.status,
                        screenData.isSmallScreen && styles.statusSmall,
                        screenData.isTablet && styles.statusTablet,
                      ]}
                    >
                      {doctor.isOnline ? 'Available Now' : 'Offline'}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.priceSection,
                    ...(screenData.isTablet ? [styles.priceSectionTablet] : []),
                  ]}
                >
                  <Text
                    style={[styles.priceLabel, screenData.isSmallScreen && styles.priceLabelSmall]}
                  >
                    Consultation Fee
                  </Text>
                  <Text
                    style={[
                      styles.price,
                      screenData.isSmallScreen && styles.priceSmall,
                      screenData.isTablet && styles.priceTablet,
                    ]}
                  >
                    ${doctor.teleconsultationFee}
                  </Text>
                </View>
              </AdaptiveCard>
            </AdaptiveAnimatedView>

            {/* ✅ IMPROVED: Simplified demo call section following official Daily.co pattern */}
            <AdaptiveAnimatedView
              animationType={isLowEndDevice ? 'fadeIn' : 'slideUp'}
              duration={getAnimationDuration('normal')}
              delay={400}
            >
              <AdaptiveCard style={styles.testSection}>
                {/* <Text
                  style={[
                    styles.testSectionTitle,
                    screenData.isSmallScreen && styles.testSectionTitleSmall,
                  ]}
                >
                  🔧 ULTRA-VIDEO-TEST v2.2.2 - Multiple DailyMediaView Rendering Approaches
                </Text>

                <Text
                  style={[
                    styles.demoRoomInfo,
                    screenData.isSmallScreen && styles.demoRoomInfoSmall,
                  ]}
                >
                  ✅ UltraMinimalTest (Zero styling) | ✅ DimensionTest (Explicit size) | ✅
                  DelayedTest (Timing)
                </Text>

                <View style={styles.demoReadyContainer}>
                  <Text style={styles.demoReadyText}>
                    🎯 MULTIPLE TESTS: Testing different DailyMediaView rendering approaches to fix
                    black screen
                  </Text>
                </View> */}

                {/* ✅ IMPROVED: Primary Demo Call Button following official Daily.co pattern */}
                <AdaptiveTouchableOpacity
                  style={[
                    styles.primaryDemoButton,
                    screenData.isSmallScreen && styles.primaryDemoButtonSmall,
                  ]}
                  onPress={() => handleCallPress('video')}
                  enableHaptics
                >
                  <Ionicons
                    name="videocam"
                    size={screenData.isSmallScreen ? 18 : 20}
                    color="#fff"
                  />
                  <Text
                    style={[
                      styles.primaryDemoText,
                      screenData.isSmallScreen && styles.primaryDemoTextSmall,
                    ]}
                  >
                    Video Call
                  </Text>
                </AdaptiveTouchableOpacity>

                {/* ✅ IMPROVED: Audio Call Demo Button following official Daily.co pattern */}
                <AdaptiveTouchableOpacity
                  style={[
                    styles.secondaryDemoButton,
                    screenData.isSmallScreen && styles.secondaryDemoButtonSmall,
                  ]}
                  onPress={() => handleCallPress('audio')}
                  enableHaptics
                >
                  <Ionicons name="call" size={screenData.isSmallScreen ? 16 : 18} color="#fff" />
                  <Text
                    style={[
                      styles.secondaryDemoText,
                      screenData.isSmallScreen && styles.secondaryDemoTextSmall,
                    ]}
                  >
                    Audio Call
                  </Text>
                </AdaptiveTouchableOpacity>
              </AdaptiveCard>
            </AdaptiveAnimatedView>
          </ScrollView>
        </>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : Math.max(48, 40),
    paddingBottom: 20,
    minHeight: Platform.OS === 'android' ? 80 : 70,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    padding: 12,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Platform.OS === 'android' ? 4 : 0,
    ...Platform.select({
      android: {
        marginTop: 8,
        shadowColor: 'rgba(0, 0, 0, 0.25)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 3,
      },
      ios: {
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
      },
    }),
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  doctorCard: {
    backgroundColor: COLORS.GLASS_BG,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER_LIGHT,
    shadowColor: 'rgba(55, 120, 92, 0.11)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  doctorHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    // Dynamic sizing handled inline
  },
  avatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
  doctorInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  doctorName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  doctorNameSmall: {
    fontSize: 18,
  },
  doctorNameTablet: {
    fontSize: 26,
  },
  verifiedIcon: {
    marginLeft: 8,
  },
  specialty: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  specialtySmall: {
    fontSize: 14,
  },
  specialtyTablet: {
    fontSize: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginLeft: 4,
  },
  ratingSmall: {
    fontSize: 14,
  },
  reviews: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 4,
  },
  reviewsSmall: {
    fontSize: 12,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.PRIMARY,
  },
  statusSmall: {
    fontSize: 12,
  },
  statusTablet: {
    fontSize: 16,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  priceSectionTablet: {
    padding: 20,
  },
  priceLabel: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
  },
  priceLabelSmall: {
    fontSize: 14,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
  },
  priceSmall: {
    fontSize: 20,
  },
  priceTablet: {
    fontSize: 28,
  },
  testSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  testSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    textAlign: 'center',
    marginBottom: 16,
  },
  testSectionTitleSmall: {
    fontSize: 14,
    marginBottom: 12,
  },
  primaryDemoButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(156, 39, 176, 0.9)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#9C27B0',
  },
  primaryDemoButtonSmall: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryDemoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  primaryDemoTextSmall: {
    fontSize: 14,
    marginLeft: 6,
  },
  secondaryDemoButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  secondaryDemoButtonSmall: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  secondaryDemoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  secondaryDemoTextSmall: {
    fontSize: 12,
    marginLeft: 4,
  },
  demoRoomInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  demoRoomInfoSmall: {
    fontSize: 12,
    marginBottom: 12,
  },
  demoReadyContainer: {
    marginBottom: 10,
  },
  demoReadyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 12,
  },

  // ✅ WORKING PATTERN: Call interface styles following PublicRoomScreen
  callContainer: {
    flex: 1,
    backgroundColor: COLORS.BLACK,
  },
  dailyMediaView: {
    flex: 1,
    aspectRatio: 9 / 16,
  },
  waitingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  waitingText: {
    color: COLORS.WHITE,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  waitingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  tray: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    gap: 20,
  },
  trayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: '#ff4444',
  },
  leaveButton: {
    backgroundColor: '#ff4444',
  },
  statusArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  statusText: {
    color: COLORS.WHITE,
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  floatingDebugButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
});

// PERFORMANCE: Memoize component to prevent unnecessary re-renders
export default memo(DoctorDetailsScreen);
