import { Alert } from 'react-native';

import type { PermissionContext } from '../services/PermissionManagerMigrated';
import PermissionManager, {
  ConsolidatedPermissionManager,
} from '../services/PermissionManagerMigrated';
import UnifiedVideoCallService from '../services/UnifiedVideoCallService';
import type { VideoCallProvider } from '../types/videoCallProvider';

import { dailyModuleLoader } from './nativeModuleChecker';
import { trackVideoCallError } from './sentryErrorTracker';

export interface DefaultRoomJoinerParams {
  isConnecting: boolean;
  isCallActive: boolean;
  user: any;
  currentProvider: VideoCallProvider;
  contextEntity: { id: string; firstName: string; lastName: string };
  contextType: 'doctor' | 'customer';
  screenName: string;
  setIsConnecting: (value: boolean) => void;
  setIsCallActive: (value: boolean) => void;
  setCallObject: (value: any) => void;
  setRoomUrl: (value: string | null) => void;
  setShowVideoCall: (value: boolean) => void;
}

export interface DefaultRoomJoinerResult {
  success: boolean;
  error?: string;
}

/**
 * Centralized function to join the default Daily.co room
 * Used by both DoctorDetailsScreen and CustomerDetailsScreen
 */
export const joinDefaultRoom = async (
  params: DefaultRoomJoinerParams
): Promise<DefaultRoomJoinerResult> => {
  const {
    isConnecting,
    isCallActive,
    user,
    currentProvider,
    contextEntity,
    contextType,
    screenName,
    setIsConnecting,
    setIsCallActive,
    setCallObject,
    setRoomUrl,
    setShowVideoCall,
  } = params;

  // Early returns for invalid states
  if (isConnecting || isCallActive) {
    console.log('Call already in progress');
    return { success: false, error: 'Call already in progress' };
  }

  if (UnifiedVideoCallService.isCallActive()) {
    Alert.alert(
      'Call in Progress',
      'Another call is already active. Please end the current call first.'
    );
    return { success: false, error: 'Another call is already active' };
  }

  if (!user) {
    Alert.alert('Error', 'User not found. Please log in again.');
    return { success: false, error: 'User not found' };
  }

  try {
    setIsConnecting(true);
    const defaultRoomUrl = 'https://mbinina.daily.co/ZVpxSgQtPXff8Cq9l44z';
    console.log('🎯 Joining default room:', defaultRoomUrl);

    // Create context-specific permission context
    const permissionContext: PermissionContext = {
      feature: `${contextType}-consultation-video`,
      priority: 'critical',
      userInitiated: true,
      educationalContent: {
        title: 'Video Consultation Permissions',
        description: `Enable camera and microphone access for your default consultation room.`,
        benefits: [
          contextType === 'doctor'
            ? 'Face-to-face interaction with your doctor'
            : 'Face-to-face consultation experience',
          'Better diagnosis through visual assessment',
          contextType === 'doctor'
            ? 'More effective healthcare consultation'
            : 'Better diagnosis and healthcare delivery',
          'Secure, HIPAA-compliant telemedicine',
        ],
        privacyNote:
          'All consultations are encrypted and HIPAA-compliant. Your medical privacy is fully protected.',
      },
      fallbackStrategy: {
        mode: 'limited',
        description: 'Audio-only consultation available',
        limitations: ['No video sharing', 'Voice consultation only'],
        alternativeApproach: 'audio-only',
      },
    };

    // Request permissions (using different methods based on context type)
    let permissionResult;
    if (contextType === 'doctor') {
      // Doctor screen uses requestPermission with educational context
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      permissionResult = await permissionManager.requestPermission(
        'camera+microphone',
        permissionContext
      );

      if (permissionResult.status !== 'granted') {
        setIsConnecting(false);

        // Enhanced fallback handling for doctor context
        if (permissionResult.fallbackResult?.canProceed) {
          const fallback = permissionResult.fallbackResult;
          console.log('🔄 Fallback strategy available:', fallback.strategy.mode);

          Alert.alert(
            fallback.strategy.userEducation.title,
            `${fallback.strategy.userEducation.explanation}\n\nBenefits:\n${fallback.strategy.userEducation.benefits.map(b => `• ${b}`).join('\n')}`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue',
                onPress: () => {
                  // Could implement fallback strategy here
                  console.log('User chose fallback strategy');
                },
              },
            ]
          );
          return { success: false, error: 'Permission denied with fallback' };
        }

        // Standard permission denial handling
        const alertTitle = 'Permissions Required';
        let alertMessage =
          permissionResult.message ||
          'Camera and microphone permissions are required for video calls.';
        const buttons: any[] = [{ text: 'Cancel', style: 'cancel' }];

        if (permissionResult.educationShown && permissionResult.canAskAgain) {
          buttons.unshift({
            text: 'Try Again',
            onPress: () => {
              // Recursive call - could be improved with a callback pattern
              console.log('User chose to try again');
            },
          });
        }

        if (permissionResult.status === 'blocked') {
          alertMessage +=
            '\n\nTo enable permissions, please go to Settings > Privacy & Security > Permissions.';
          buttons.push({
            text: 'Open Settings',
            onPress: () => {
              const permissionManager = ConsolidatedPermissionManager.getInstance();
              permissionManager.openAppSettings();
            },
          });
        }

        Alert.alert(alertTitle, alertMessage, buttons);
        return { success: false, error: 'Permissions not granted' };
      }
    } else {
      // Customer screen uses requestPermission
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      permissionResult = await permissionManager.requestPermission(
        'camera+microphone',
        permissionContext
      );

      if (permissionResult.status !== 'granted') {
        setIsConnecting(false);

        const alertTitle = 'Permissions Required';
        let alertMessage =
          permissionResult.message ||
          'Camera and microphone permissions are required for video calls.';
        const buttons: any[] = [{ text: 'Cancel', style: 'cancel' }];

        if (permissionResult.fallbackAvailable) {
          buttons.unshift({
            text: 'Use Audio Only',
            onPress: () => {
              console.log('User chose audio-only fallback');
            },
          });
        }

        if (permissionResult.status === 'blocked') {
          alertMessage +=
            '\n\nTo enable permissions, please go to Settings > Privacy & Security > Permissions.';
          buttons.push({
            text: 'Open Settings',
            onPress: () => {
              const permissionManager = ConsolidatedPermissionManager.getInstance();
              permissionManager.openAppSettings();
            },
          });
        }

        Alert.alert(alertTitle, alertMessage, buttons);
        return { success: false, error: 'Permissions not granted' };
      }
    }

    console.log('✅ Video call permissions granted');

    // Check if Daily.co module is available
    const dailyModule = dailyModuleLoader();
    if (!dailyModule.isAvailable) {
      Alert.alert(
        'Video Call Not Available',
        'Video calling requires a development build. This feature is not available in Expo Go.\n\nTo use video calls, please create a development build with: eas build --profile development',
        [{ text: 'OK' }]
      );
      return { success: false, error: 'Daily.co module not available in this build' };
    }

    // Initialize service and create call object
    await UnifiedVideoCallService.initialize();
    const dailyCallObject = dailyModule.module.createCallObject();
    setCallObject(dailyCallObject);

    // Set up event handlers
    const handleJoinedMeeting = () => {
      console.log('✅ Joined default Daily room');
      setIsConnecting(false);
      setIsCallActive(true);
    };

    const handleLeftMeeting = () => {
      console.log('❌ Left default Daily room');
      setIsCallActive(false);
      setIsConnecting(false);
      setCallObject(null);
      setRoomUrl(null);
    };

    const handleError = (error: any) => {
      console.error('Daily call error:', error);
      setIsConnecting(false);
      Alert.alert('Call Error', 'An error occurred during the call.');
    };

    dailyCallObject.on('joined-meeting', handleJoinedMeeting);
    dailyCallObject.on('left-meeting', handleLeftMeeting);
    dailyCallObject.on('error', handleError);

    // Join the default room
    await dailyCallObject.join({ url: defaultRoomUrl });
    setRoomUrl(defaultRoomUrl);
    setShowVideoCall(true);

    return { success: true };
  } catch (error) {
    console.error('Error joining default room:', error);
    setIsConnecting(false);

    const actualError = error instanceof Error ? error : new Error('Failed to join default room');

    // Track error with context
    trackVideoCallError(actualError, {
      screen: screenName,
      action: 'joinDefaultRoom',
      provider: currentProvider,
      callType: 'video',
      userId: user?.id,
      [contextType === 'doctor' ? 'doctorId' : 'customerId']: contextEntity.id,
      additional: {
        defaultRoom: 'https://mbinina.daily.co/ZVpxSgQtPXff8Cq9l44z',
        [`${contextType}Name`]: `${contextType === 'doctor' ? 'Dr. ' : ''}${contextEntity.firstName} ${contextEntity.lastName}`,
        isConnecting,
        isCallActive,
      },
    });

    // Generate appropriate error message
    let errorMessage = 'Failed to join default room. Please try again.';
    if (actualError.message.includes('Another call is already active')) {
      errorMessage = 'Another call is already active. Please end the current call first.';
    } else if (actualError.message.includes('Failed to initialize Daily.co SDK')) {
      errorMessage = 'Video calling is not available on this device or build.';
    } else if (actualError.message.includes('No network connection')) {
      errorMessage = 'No internet connection. Please check your network and try again.';
    } else if (actualError.message.includes('permission')) {
      errorMessage =
        'Camera and microphone permissions are required for video calls. Please enable them in Settings.';
    } else if (
      actualError.message.includes('room not found') ||
      actualError.message.includes('invalid room')
    ) {
      errorMessage = 'The default room is not available. Please try again later.';
    } else {
      errorMessage = `Join failed: ${actualError.message}`;
    }

    Alert.alert('Join Failed', errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Creates a standardized handleJoinExistingCall function for screens
 */
export const createDefaultRoomJoiner = (
  params: Omit<DefaultRoomJoinerParams, 'isConnecting' | 'isCallActive'>
) => {
  return async (isConnecting: boolean, isCallActive: boolean) => {
    return joinDefaultRoom({
      ...params,
      isConnecting,
      isCallActive,
    });
  };
};
