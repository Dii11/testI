/**
 * ✅ IMPROVED: CustomerDetailsScreen following Official Daily.co Patterns
 * ✨ ENTERPRISE: Enhanced with EnterpriseCallInterface
 *
 * Key Improvements:
 * - Enterprise-grade video call interface
 * - Enhanced permission handling with PermissionAwareCallInitiator
 * - Clean separation of concerns
 * - Professional medical UI/UX
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
import { CustomerDetailsSkeleton } from '../../components/common/SkeletonLoader';
import { EnterpriseCallInterface } from '../../components/daily/EnterpriseCallInterface';
import { IntegrationVerifier } from '../../components/daily/IntegrationVerifier';
import { FCMTokenDebugPanel } from '../../components/debug/FCMTokenDebugPanel';
import CallDebugPanel, { type CallDebugInfo } from '../../components/CallDebugPanel';
import { VIDEO_CALL_CONFIG } from '../../config/videoCallConfig';
import { COLORS } from '../../constants';
import { useOptimizedLoading } from '../../hooks/useOptimizedLoading';
import { useDimensionTracking } from '../../hooks/usePerformanceTracking';
import deviceCapabilityService from '../../services/deviceCapabilityService';
import type { RootState } from '../../store';
import type { CustomerDto } from '../../types/api';
import { permissionAwareCallInitiator } from '../../utils/PermissionAwareCallInitiator';
import { SentryErrorTracker } from '../../utils/sentryErrorTracker';
import VideoCallDebugger from '../../utils/VideoCallDebugger';
import { validateUUID } from '../../utils/uuidValidator';
import { callsApi } from '../../services/api/callsApi';

interface CustomerDetailsParamList {
  CustomerDetails: { 
    customer: CustomerDto; 
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

type CustomerDetailsRoute = RouteProp<CustomerDetailsParamList, 'CustomerDetails'>;

const CustomerDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CustomerDetailsRoute>();
  const { customer, restoreCall, incomingCallData } = route.params || {};

  // ✅ CRITICAL: Early validation to prevent undefined access
  useEffect(() => {
    if (!customer) {
      console.error('❌ CustomerDetailsScreen: customer is undefined in route params');
      Alert.alert(
        'Error',
        'Patient information is missing. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }
  }, [customer, navigation]);

  // Dimension tracking with performance monitoring
  const { dimensions: screenDimensions } = useDimensionTracking('CustomerDetailsScreen');

  const { user } = useSelector((state: RootState) => state.auth);

  // ✅ CRITICAL: Return early if customer is undefined to prevent crashes
  if (!customer) {
    return (
      <LinearGradient
        colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
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
  }, [customer?.id]);

  useEffect(() => {
    const userRole = user?.accountType;
    if (!roleAnomalyLoggedRef.current) {
      if (userRole === 'customer') {
        console.warn('⚠️ Customer user on CustomerDetailsScreen - possible navigation issue');
        SentryErrorTracker.getInstance().trackWarning(
          'Customer user navigated to CustomerDetailsScreen',
          {
            screen: 'CustomerDetailsScreen',
            customerId: customer.id,
            additional: {
              userRole,
              customerName: `${customer.firstName} ${customer.lastName}`,
              severity: 'warning',
            },
          }
        );
        roleAnomalyLoggedRef.current = true;
      } else if (userRole !== 'health_specialist') {
        console.warn('⚠️ Unknown user role on CustomerDetailsScreen:', userRole);
        roleAnomalyLoggedRef.current = true;
      }
    }
  }, [user?.accountType, customer?.id]);

  // ✨ ENTERPRISE: Enhanced call state management
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('video');
  const [roomUrl, setRoomUrl] = useState<string | undefined>(undefined);

  // 🔍 DEBUG: FCM Token Debug Panel
  const [showFCMDebugPanel, setShowFCMDebugPanel] = useState(false);

  // 🔍 DEBUG: Call Debug Panel
  const [showCallDebugPanel, setShowCallDebugPanel] = useState(false);
  const [callDebugInfo, setCallDebugInfo] = useState<CallDebugInfo | null>(null);

  // Adaptive theme and optimizations
  const { isLowEndDevice, getAnimationDuration } = useAdaptiveTheme();

  // Optimized loading with proper timing
  const { isLoading, showContent, finishLoading } = useOptimizedLoading({
    minLoadingTime: isLowEndDevice ? 500 : 800,
    delayMs: isLowEndDevice ? 100 : 200,
  });
  const finishLoadingRef = useRef(finishLoading);
  useEffect(() => {
    finishLoadingRef.current = finishLoading;
  }, [finishLoading]);

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
      avatarSize: isTablet ? 140 : isSmallScreen ? 100 : 120,
      headerPadding: isTablet ? 40 : isSmallScreen ? 15 : 20,
    };
  }, [screenDimensions]);

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
      // Cleanup handled by EnterpriseCallInterface
    };
  }, []);

  // ✅ IMPROVED: Reset state on focus/blur
  useFocusEffect(
    useCallback(() => {
      // On focus - reset call interface if not in call
      return () => {
        // Cleanup handled by EnterpriseCallInterface
      };
    }, [])
  );

  // 🧭 Handle call restoration when screen is opened with restoreCall flag
  useEffect(() => {
    if (restoreCall && !inCall) {
      console.log('🧭 Restoring call session for customer:', customer.firstName, customer.lastName);

      // Get the persisted call state from navigation manager
      const callNavigationManager = CallNavigationManager.getInstance();
      const persistedCallState = callNavigationManager.getCurrentCallState();

      if (persistedCallState && persistedCallState.isInCall) {
        console.log('🧭 Found persisted call state, restoring call');

        // Restore the call state
        setCallType(persistedCallState.callType);
        setRoomUrl(persistedCallState.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL);
        setInCall(true);
      } else {
        console.log('🧭 No valid call state to restore, clearing restoreCall flag');
      }
    }
  }, [restoreCall, inCall, customer.firstName, customer.lastName]);

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
        userName: user?.accountType === 'health_specialist'
          ? `Dr. ${user?.firstName || ''} ${user?.lastName || ''}`
          : `${user?.firstName || ''} ${user?.lastName || ''}`,
        userRole: user?.accountType || 'unknown',
        roomUrl: incomingCallData.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL,
        screen: 'CustomerDetailsScreen_IMPROVED (Incoming Call)',
      });

      console.log('✅ Incoming call interface activated');

      // 🧭 Register call session for incoming calls (symmetry with Doctor screen)
      try {
        CallNavigationManager.getInstance().startCallSession(
          incomingCallData.callType,
          'CustomerDetails',
          { customer },
          `${customer.firstName} ${customer.lastName}`,
          'customer',
          incomingCallData.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL
        );
      } catch {}
    }
  }, [incomingCallData, inCall, user]);


  // Reset anomaly logging when viewing a different entity
  useEffect(() => {
    roleAnomalyLoggedRef.current = false;
  }, [customer?.id]);

  // ✨ ENHANCED: Permission-aware call handler with fallback to ensure calls work
  const isStartingCallRef = useRef(false);
  const handleCallPress = useCallback(
    async (requestedCallType: 'audio' | 'video') => {
      if (isStartingCallRef.current) {
        return; // Prevent double tap
      }
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
          console.log(`🎯 Starting ${requestedCallType} call with EnterpriseCallInterface`);
        }

        try {
          // 📞 CRITICAL: Send push notification to recipient
          console.log('📞 Sending push notification to recipient...');
          console.log('🔍 DEBUG: customer.userId =', customer.userId);
          console.log('🔍 DEBUG: customer object =', JSON.stringify(customer, null, 2));
          
          // ✅ CRITICAL: Check if userId exists before validation
          if (!customer.userId) {
            console.error('❌ customer.userId is missing - cannot initiate call');
            throw new Error('Patient user ID is missing. Please refresh the patient list and try again.');
          }
          
          // ✅ ENHANCED VALIDATION: Ensure userId exists and is valid UUID format
          validateUUID(customer.userId, 'Customer userId');
          console.log('✅ Valid customer userId format confirmed:', customer.userId);

          // ✅ FIX: Use userId (not customer.id) to look up user in backend
          const initiateResult = await callsApi.initiateCall(
            customer.userId,  // ✅ FIX: Use User ID for backend lookup
            requestedCallType,
            {
              customerId: customer.id,
              customerName: `${customer.firstName} ${customer.lastName}`,
              callerName: user.accountType === 'health_specialist'
                ? `Dr. ${user.firstName || ''} ${user.lastName || ''}`
                : `${user.firstName || ''} ${user.lastName || ''}`,
              // ✅ CRITICAL: Include full customer object for push notification navigation
              customer: {
                id: customer.id,
                userId: customer.userId,
                firstName: customer.firstName,
                lastName: customer.lastName,
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
            caller: user.accountType === 'health_specialist'
              ? `Dr. ${user.firstName || ''} ${user.lastName || ''}`
              : `${user.firstName || ''} ${user.lastName || ''}`,
            recipient: `${customer.firstName} ${customer.lastName}`,
            callType: requestedCallType,
            initiationSuccess: true,
            pushStatus: (initiateResult as any).pushStatus,
            pushError: (initiateResult as any).pushError,
            roomUrl: initiateResult.data?.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL,
            requestPayload: {
              recipientId: customer.userId,
              callType: requestedCallType,
              metadata: {
                customerId: customer.id,
                customerName: `${customer.firstName} ${customer.lastName}`,
                callerName: user.accountType === 'health_specialist'
                  ? `Dr. ${user.firstName || ''} ${user.lastName || ''}`
                  : `${user.firstName || ''} ${user.lastName || ''}`,
              },
            },
          });
          }

          // Log call session for debugging
          VideoCallDebugger.logCallStart({
            userId: user.id,
            userName:
              user.accountType === 'health_specialist'
                ? `Dr. ${user.firstName || ''} ${user.lastName || ''}`
                : `${user.firstName || ''} ${user.lastName || ''}`,
            userRole: user.accountType || 'unknown',
            roomUrl: initiateResult.data?.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL,
            screen: 'CustomerDetailsScreen_IMPROVED',
          });

          // 🧭 Register call session with navigation manager
          CallNavigationManager.getInstance().startCallSession(
            requestedCallType,
            'CustomerDetails',
            { customer },
            `${customer.firstName} ${customer.lastName}`,
            'customer',
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
            caller: user.accountType === 'health_specialist'
              ? `Dr. ${user.firstName || ''} ${user.lastName || ''}`
              : `${user.firstName || ''} ${user.lastName || ''}`,
            recipient: `${customer.firstName} ${customer.lastName}`,
            callType: requestedCallType,
            initiationSuccess: false,
            error: error?.message || 'Failed to initiate call',
            requestPayload: {
              recipientId: customer.userId || 'MISSING',
              callType: requestedCallType,
              metadata: {
                customerId: customer.id,
                customerName: `${customer.firstName} ${customer.lastName}`,
                callerName: user.accountType === 'health_specialist'
                  ? `Dr. ${user.firstName || ''} ${user.lastName || ''}`
                  : `${user.firstName || ''} ${user.lastName || ''}`,
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
            screen: 'CustomerDetailsScreen_IMPROVED',
            callType: requestedCallType,
            customerId: customer.id,
            additional: {
              customerName: `${customer.firstName} ${customer.lastName}`,
              severity: 'error',
            },
          });
        }
      };

      try {
        if (__DEV__) {
          console.log(`🎯 Initiating ${requestedCallType} call`);
        }

        // ✅ SIMPLIFIED: Direct call (permission system causing Sentry errors)
        // Permissions handled by Daily.co SDK
        await startCall();
      } catch (error) {
        // Error handled in startCall() with debug panel
        console.error(`❌ Call error:`, error);
      } finally {
        isStartingCallRef.current = false;
      }
    },
    [
      user, // Include entire user object to capture all changes
      customer?.id,
      customer?.firstName,
      customer?.lastName,
    ]
  );

  // ✨ ENTERPRISE: Enhanced call handlers
  const handleEndCall = useCallback(() => {
    console.log('🔴 CustomerDetailsScreen: handleEndCall called');
    VideoCallDebugger.logCallEnd();

    // 🧭 CRITICAL: End call session FIRST to clear persisted state
    // This prevents the restoration useEffect from rejoining
    CallNavigationManager.getInstance().endCallSession();
    console.log('🔴 CustomerDetailsScreen: Call session ended in NavigationManager');

    // Clear call state immediately to prevent restoration
    setInCall(false);
    setRoomUrl(undefined);
    console.log('🔴 CustomerDetailsScreen: Call state cleared (inCall=false, roomUrl=undefined)');

    // ✅ Cleanup is handled by EnterpriseCallInterface - no need to call here
    // Calling it here creates race conditions
  }, []);

  const handleCallError = useCallback((error: Error) => {
    console.error('Call error:', error);

    // 🧭 End call session with navigation manager on error
    CallNavigationManager.getInstance().endCallSession();

    setInCall(false);
    Alert.alert('Call Error', error.message || 'An error occurred during the call');
  }, []);

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
        colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
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
          <Text style={styles.headerTitle}>Patient Details</Text>
          <View style={styles.placeholder} />
        </View>
        <CustomerDetailsSkeleton />
      </LinearGradient>
    );
  }

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
        <Text style={styles.headerTitle}>Patient Details</Text>
        <View style={styles.placeholder} />
      </View>

      {/* ✨ ENTERPRISE: Using enhanced EnterpriseCallInterface */}
      {inCall && roomUrl ? (
        <EnterpriseCallInterface
          roomUrl={roomUrl}
          callType={callType}
          contactName={`${customer.firstName} ${customer.lastName}`}
          contactTitle="Patient"
          onEndCall={handleEndCall}
          onError={handleCallError}
          autoJoin
          userName={
            user?.accountType === 'health_specialist'
              ? `Dr. ${user.firstName} ${user.lastName}`
              : `${user?.firstName} ${user?.lastName}`
          }
          userId={user?.id}
          medicalContext={{
            consultationType: 'routine',
            appointmentTime: new Date(),
          }}
        />
      ) : (
        <>
          {/* <IntegrationVerifier screenName="CustomerDetailsScreen_IMPROVED" /> */}
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
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={isLowEndDevice}
            keyboardShouldPersistTaps="handled"
          >
            <AdaptiveAnimatedView
              animationType={isLowEndDevice ? 'fadeIn' : 'slideUp'}
              duration={getAnimationDuration('normal')}
              delay={100}
            >
              <View
                style={[styles.profileSection, screenData.isTablet && styles.profileSectionTablet]}
              >
                <View style={styles.avatarContainer}>
                  {customer.profilePicture ? (
                    <Image
                      source={{ uri: customer.profilePicture }}
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
                        backgroundColor: customer.isOnline ? '#4CAF50' : '#999',
                        width: screenData.isSmallScreen ? 20 : 24,
                        height: screenData.isSmallScreen ? 20 : 24,
                        borderRadius: (screenData.isSmallScreen ? 20 : 24) / 2,
                      },
                    ]}
                  />
                </View>
                <View style={styles.profileInfo}>
                  <View style={styles.nameContainer}>
                    <Text
                      style={[
                        styles.name,
                        screenData.isSmallScreen && styles.nameSmall,
                        screenData.isTablet && styles.nameTablet,
                      ]}
                    >
                      {customer.firstName} {customer.lastName}
                    </Text>
                    {customer.emailVerified && (
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
                      styles.email,
                      screenData.isSmallScreen && styles.emailSmall,
                      screenData.isTablet && styles.emailTablet,
                    ]}
                  >
                    {customer.email}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      screenData.isSmallScreen && styles.statusSmall,
                      screenData.isTablet && styles.statusTablet,
                    ]}
                  >
                    {customer.isOnline ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>
            </AdaptiveAnimatedView>

            {/* ✨ ENHANCED: Professional demo call section */}
            <AdaptiveAnimatedView
              animationType={isLowEndDevice ? 'fadeIn' : 'slideUp'}
              duration={getAnimationDuration('normal')}
              delay={400}
            >
              <AdaptiveCard style={styles.testSection}>
                {/* ✨ ENHANCED: Professional Demo Call Button */}
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

                {/* ✨ ENHANCED: Audio Call Demo Button */}
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
                    📞 Audio Call
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
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileSectionTablet: {
    marginBottom: 40,
    paddingHorizontal: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: '#fff',
  },
  profileInfo: {
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    textAlign: 'center',
  },
  nameSmall: {
    fontSize: 20,
  },
  nameTablet: {
    fontSize: 28,
  },
  verifiedIcon: {
    marginLeft: 8,
  },
  email: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  emailSmall: {
    fontSize: 14,
  },
  emailTablet: {
    fontSize: 18,
  },
  status: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusSmall: {
    fontSize: 12,
  },
  statusTablet: {
    fontSize: 16,
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
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
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
export default memo(CustomerDetailsScreen);
