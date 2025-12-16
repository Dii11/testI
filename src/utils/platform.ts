import { Platform, Dimensions, StatusBar } from 'react-native';

// Device info
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Platform detection utilities
 */
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

/**
 * Device size detection
 */
export const isTablet = (): boolean => {
  const aspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
  return (
    (Platform.OS === 'ios' && aspectRatio < 1.6) ||
    (Platform.OS === 'android' && SCREEN_WIDTH >= 600)
  );
};

export const isSmallDevice = (): boolean => {
  return SCREEN_WIDTH < 375;
};

export const isLargeDevice = (): boolean => {
  return SCREEN_WIDTH > 414;
};

/**
 * iPhone model detection
 */
export const isIPhoneX = (): boolean => {
  if (!isIOS) return false;

  return (
    // iPhone X, XS
    (SCREEN_HEIGHT === 812 && SCREEN_WIDTH === 375) ||
    // iPhone XR, 11
    (SCREEN_HEIGHT === 896 && SCREEN_WIDTH === 414) ||
    // iPhone XS Max, 11 Pro Max
    (SCREEN_HEIGHT === 896 && SCREEN_WIDTH === 414) ||
    // iPhone 12, 12 Pro
    (SCREEN_HEIGHT === 844 && SCREEN_WIDTH === 390) ||
    // iPhone 12 Pro Max
    (SCREEN_HEIGHT === 926 && SCREEN_WIDTH === 428) ||
    // iPhone 13 mini
    (SCREEN_HEIGHT === 812 && SCREEN_WIDTH === 375) ||
    // iPhone 14, 14 Pro
    (SCREEN_HEIGHT === 844 && SCREEN_WIDTH === 390) ||
    // iPhone 14 Plus, 14 Pro Max
    (SCREEN_HEIGHT === 926 && SCREEN_WIDTH === 428)
  );
};

export const hasNotch = (): boolean => {
  return isIPhoneX();
};

/**
 * Safe area insets
 */
export const getSafeAreaInsets = () => {
  if (isIOS && hasNotch()) {
    return {
      top: 44,
      bottom: 34,
      left: 0,
      right: 0,
    };
  } else if (isAndroid) {
    return {
      top: StatusBar.currentHeight || 24,
      bottom: 0,
      left: 0,
      right: 0,
    };
  } else {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    };
  }
};

/**
 * Platform-specific spacing
 */
export const getStatusBarHeight = (): number => {
  if (isIOS) {
    return hasNotch() ? 44 : 20;
  } else if (isAndroid) {
    return StatusBar.currentHeight || 24;
  }
  return 0;
};

export const getBottomSpace = (): number => {
  return hasNotch() ? 34 : 0;
};

/**
 * Platform-specific keyboard behavior
 */
export const getKeyboardVerticalOffset = (): number => {
  if (isIOS) {
    return hasNotch() ? 88 : 64;
  }
  return 0;
};

/**
 * Platform-specific haptic feedback
 */
export const hapticFeedback = {
  light: () => {
    if (isIOS && !isWeb) {
      try {
        const { HapticFeedback } = require('expo-haptics');
        HapticFeedback?.impactAsync(HapticFeedback.ImpactFeedbackStyle.Light);
      } catch (error) {
        // expo-haptics not available
      }
    }
  },
  medium: () => {
    if (isIOS && !isWeb) {
      try {
        const { HapticFeedback } = require('expo-haptics');
        HapticFeedback?.impactAsync(HapticFeedback.ImpactFeedbackStyle.Medium);
      } catch (error) {
        // expo-haptics not available
      }
    }
  },
  heavy: () => {
    if (isIOS && !isWeb) {
      try {
        const { HapticFeedback } = require('expo-haptics');
        HapticFeedback?.impactAsync(HapticFeedback.ImpactFeedbackStyle.Heavy);
      } catch (error) {
        // expo-haptics not available
      }
    }
  },
  success: () => {
    if (isIOS && !isWeb) {
      try {
        const { HapticFeedback } = require('expo-haptics');
        HapticFeedback?.notificationAsync(HapticFeedback.NotificationFeedbackType.Success);
      } catch (error) {
        // expo-haptics not available
      }
    }
  },
  warning: () => {
    if (isIOS && !isWeb) {
      try {
        const { HapticFeedback } = require('expo-haptics');
        HapticFeedback?.notificationAsync(HapticFeedback.NotificationFeedbackType.Warning);
      } catch (error) {
        // expo-haptics not available
      }
    }
  },
  error: () => {
    if (isIOS && !isWeb) {
      try {
        const { HapticFeedback } = require('expo-haptics');
        HapticFeedback?.notificationAsync(HapticFeedback.NotificationFeedbackType.Error);
      } catch (error) {
        // expo-haptics not available
      }
    }
  },
};

/**
 * Platform-specific shadows
 */
export const getPlatformShadow = (elevation: number) => {
  if (isIOS) {
    return {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: elevation / 2,
      },
      shadowOpacity: 0.1 + elevation * 0.02,
      shadowRadius: elevation,
    };
  } else {
    return {
      elevation,
    };
  }
};

/**
 * Platform-specific font weights
 */
export const getFontWeight = (weight: string) => {
  if (isIOS) {
    switch (weight) {
      case 'light':
        return '300';
      case 'normal':
        return '400';
      case 'medium':
        return '500';
      case 'semibold':
        return '600';
      case 'bold':
        return '700';
      default:
        return '400';
    }
  } else {
    // Android uses different font family names for weights
    switch (weight) {
      case 'light':
        return 'sans-serif-light';
      case 'normal':
        return 'sans-serif';
      case 'medium':
        return 'sans-serif-medium';
      case 'bold':
        return 'sans-serif';
      default:
        return 'sans-serif';
    }
  }
};

/**
 * Device orientation utilities
 */
export const getOrientation = (): 'portrait' | 'landscape' => {
  return SCREEN_WIDTH < SCREEN_HEIGHT ? 'portrait' : 'landscape';
};

export const isLandscape = (): boolean => {
  return getOrientation() === 'landscape';
};

export const isPortrait = (): boolean => {
  return getOrientation() === 'portrait';
};

/**
 * Platform-specific navigation header height
 */
export const getHeaderHeight = (): number => {
  if (isIOS) {
    return hasNotch() ? 88 : 64;
  } else {
    return 56;
  }
};

/**
 * Platform-specific tab bar height
 */
export const getTabBarHeight = (): number => {
  if (isIOS) {
    return hasNotch() ? 83 : 49;
  } else {
    return 56;
  }
};

/**
 * Check if device supports biometric authentication
 */
export const supportsBiometrics = async (): Promise<boolean> => {
  try {
    if (isWeb) return false;

    // Dynamic import to avoid bundling issues on web
    const LocalAuthentication = require('expo-local-authentication');
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    return hasHardware && isEnrolled;
  } catch (error) {
    // expo-local-authentication not available (web or missing dependency)
    console.warn('Biometrics check error:', error);
    return false;
  }
};

/**
 * Get available biometric types
 */
export const getBiometricTypes = async (): Promise<string[]> => {
  try {
    if (isWeb) return [];

    const { LocalAuthentication } = require('expo-local-authentication');
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    return types.map((type: number) => {
      switch (type) {
        case 1:
          return 'fingerprint';
        case 2:
          return 'facial_recognition';
        case 3:
          return 'iris';
        default:
          return 'unknown';
      }
    });
  } catch (error) {
    console.error('Biometric types error:', error);
    return [];
  }
};
