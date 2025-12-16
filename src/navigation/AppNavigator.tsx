import {
  createStackNavigator,
  CardStyleInterpolators,
  TransitionPresets,
} from '@react-navigation/stack';
import React, { useEffect, useState, useRef } from 'react';
import { DeviceEventEmitter, Platform, BackHandler, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';

import LoadingScreen from '../components/LoadingScreen';
import { useAuthSession } from '../hooks/useAuthSession';
import type { RootState, AppDispatch } from '../store';
import { loadStoredAuth, clearAuth } from '../store/slices/authSlice';
import { isExpoGo } from '../utils/nativeModuleChecker';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import BackgroundTaskManager from '../services/BackgroundTaskManager';

// Conditional imports for call screens to prevent Expo Go errors
let AudioCallScreen: any = null;
let VideoCallScreen: any = null;
let IncomingCallScreen: any = null;

if (!isExpoGo()) {
  try {
    AudioCallScreen = require('../screens/calls/AudioCallScreen').default;
    VideoCallScreen = require('../screens/calls/VideoCallScreen').default;
    IncomingCallScreen = require('../screens/IncomingCallScreen').default;
  } catch (error) {
    console.warn('Call screens not available:', error);
  }
} else {
  console.log('📹 Call screens unavailable in Expo Go - using mock components');
  // Create mock components for Expo Go
  AudioCallScreen = () => <LoadingScreen message="Audio calls require a development build" />;
  VideoCallScreen = () => <LoadingScreen message="Video calls require a development build" />;
  IncomingCallScreen = () => <LoadingScreen message="Incoming calls require a development build" />;
}

// ✅ NEW: Import dedicated call screens

const Stack = createStackNavigator();

const AppNavigator: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
  const [isInitializing, setIsInitializing] = useState(true);
  const initializationPromiseRef = useRef<Promise<any> | null>(null);

  // Use auth session hook for app state changes
  useAuthSession();

  // Debug logging
  console.log(
    'AppNavigator: isAuthenticated:',
    isAuthenticated,
    'isLoading:',
    isLoading,
    'isInitializing:',
    isInitializing
  );

  useEffect(() => {
    // Prevent multiple concurrent initialization attempts
    if (initializationPromiseRef.current) {
      console.log('🔄 Session restoration already in progress, skipping...');
      return;
    }

    const initializeApp = async () => {
      try {
        setIsInitializing(true);

        // Debug auth status before restoration
        const { authService } = await import('../services/authService');
        authService.debugAuthStatus();

        // Restore session from storage with safe error handling
        try {
          const INIT_TIMEOUT = 10000;
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Initialization timeout after 10s')), INIT_TIMEOUT);
          });
          await Promise.race([
            dispatch(loadStoredAuth()).unwrap(),
            timeoutPromise,
          ]);
          console.log('✅ Session restoration completed successfully');
        } catch (error: any) {
          // Re-throw to be handled by outer catch block
          throw error;
        }
      } catch (error: any) {
        console.warn('Session restoration failed:', error);
        // The restoreSessionFromStorage thunk handles session clearing internally
        // Only clear here if we have a definitive authentication failure
        if (
          error?.message?.includes('Token expired') ||
          error?.message?.includes('No valid session')
        ) {
          console.log('🔑 Clearing authentication state due to token issues');
          dispatch(clearAuth());
        } else {
          console.log('📡 Network error - keeping stored session for retry');
        }
      } finally {
        setIsInitializing(false);
        initializationPromiseRef.current = null;
      }
    };

    initializationPromiseRef.current = initializeApp();

    // Listen for token expiration events
    const handleTokenExpired = (event?: any) => {
      const type = Platform.OS === 'web' ? event?.detail?.type : event?.type;
      const reason = Platform.OS === 'web' ? event?.detail?.reason : event?.reason;
      console.log(`🔑 Token issue received: type=${type} reason=${reason}`);

      // Only perform logout for definitive authentication failures
      if (type === 'definitive_auth_failure') {
        console.log('🔑 Definitive auth failure, clearing session');
        import('../services/authService').then(({ authService }) => {
          authService.clearSession();
        });
        dispatch(clearAuth());
      } else {
        console.log('📡 Non-definitive token issue, keeping user logged in');
      }
    };

    // Android hardware back button handler
    const handleBackPress = () => {
      if (isAuthenticated) {
        // In authenticated state, show exit confirmation
        Alert.alert(
          'Exit App',
          'Are you sure you want to exit?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => {} },
            { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
          ],
          { cancelable: true }
        );
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior in auth screens
    };

    // For React Native, we can use DeviceEventEmitter for custom events
    let tokenExpiredSubscription: any;
    let backHandler: any;
    let pageVisibilityHandler: any;

    if (Platform.OS === 'web') {
      // Web platform
      window.addEventListener('tokenExpired', handleTokenExpired as any);

      // Handle page visibility changes (page reload, tab switch, etc.)
      const handlePageVisibilityChange = () => {
        if (!document.hidden) {
          console.log('🔄 Page became visible, checking session...');
          dispatch(loadStoredAuth()).catch((error: any) => {
            console.warn('Session restoration on page visibility failed:', error);
          });
        }
      };

      pageVisibilityHandler = () => {
        document.addEventListener('visibilitychange', handlePageVisibilityChange);
      };
      pageVisibilityHandler();
    } else {
      // React Native platform
      tokenExpiredSubscription = DeviceEventEmitter.addListener('tokenExpired', handleTokenExpired);

      // Android back button handler
      if (Platform.OS === 'android') {
        backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      }
    }

    return () => {
      if (Platform.OS === 'web') {
        window.removeEventListener('tokenExpired', handleTokenExpired as any);
        if (pageVisibilityHandler) {
          document.removeEventListener('visibilitychange', pageVisibilityHandler);
        }
      } else {
        if (tokenExpiredSubscription) {
          tokenExpiredSubscription.remove();
        }
        if (backHandler) {
          backHandler.remove();
        }
      }
    };
  }, [dispatch, isAuthenticated]);

  if (isLoading || isInitializing) {
    return <LoadingScreen message={isInitializing ? 'Initializing app...' : 'Loading...'} />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        ...TransitionPresets.SlideFromRightIOS,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        gestureResponseDistance: Platform.OS === 'ios' ? 25 : 50,
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: {
          open: {
            animation: 'timing',
            config: {
              duration: 300,
            },
          },
          close: {
            animation: 'timing',
            config: {
              duration: 300,
            },
          },
        },
      }}
    >
      {isAuthenticated ? (
        <>
          {/** Initialize background tasks when authenticated */}
          {BackgroundTaskManager.getInstance() && null}
          <Stack.Screen
            name="Main"
            component={MainNavigator}
            options={{
              cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
            }}
          />
          {/* ✅ NEW: Call screens at root level for optimal performance */}
          {/* 🚨 CRITICAL: IncomingCallScreen for Android 10+ fallback */}
          <Stack.Screen
            name="IncomingCall"
            component={IncomingCallScreen as any}
            options={{
              headerShown: false,
              presentation: 'modal', // Full-screen modal for incoming calls
              gestureEnabled: false, // Prevent dismissal during incoming call
              cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
              animationEnabled: true,
              transitionSpec: {
                open: {
                  animation: 'timing',
                  config: {
                    duration: 200,
                  },
                },
                close: {
                  animation: 'timing',
                  config: {
                    duration: 150,
                  },
                },
              },
            }}
          />
          <Stack.Screen
            name="VideoCall"
            component={VideoCallScreen as any}
            options={{
              headerShown: false,
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              gestureEnabled: false, // Prevent accidental swipe dismissal
              cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS,
              transitionSpec: {
                open: {
                  animation: 'timing',
                  config: {
                    duration: 300,
                  },
                },
                close: {
                  animation: 'timing',
                  config: {
                    duration: 250,
                  },
                },
              },
            }}
          />
          <Stack.Screen
            name="AudioCall"
            component={AudioCallScreen as any}
            options={{
              headerShown: false,
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              gestureEnabled: true, // Allow back gesture for audio calls
              cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
              transitionSpec: {
                open: {
                  animation: 'timing',
                  config: {
                    duration: 300,
                  },
                },
                close: {
                  animation: 'timing',
                  config: {
                    duration: 250,
                  },
                },
              },
            }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{
            cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
          }}
        />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
