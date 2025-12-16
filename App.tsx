import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, NavigationContainerRef, ParamListBase } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, AppState, Platform, DeviceEventEmitter, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { ErrorBoundary } from './src/components/common';
import LoadingScreen from './src/components/LoadingScreen';
import { getConfig } from './src/config/env.config';
import AppNavigator from './src/navigation/AppNavigator';
import BackgroundTaskManager from './src/services/BackgroundTaskManager';
import CallNavigationManager from './src/services/CallNavigationManager';
import NotifeeNotificationService from './src/services/NotifeeNotificationService';
import { ConsolidatedPermissionManager } from './src/services/PermissionManagerMigrated';
import { store, persistor } from './src/store';
import type { AppDispatch, RootState } from './src/store';
import { initializePermissions, handleAppStateChange } from './src/store/slices/permissionSlice';
import { logNativeModuleCompatibility } from './src/utils/nativeModuleChecker';
import { useIncomingCall } from './src/hooks/useIncomingCall';
import { callsApi } from './src/services/api/callsApi';
import { IncomingCallDebugPanel } from './src/components/debug/IncomingCallDebugPanel';
import IncomingCallProvider from './src/providers/IncomingCallProvider';
import CallKitManager from './src/services/CallKitManager';

// Initialize Sentry with robust configuration
try {
  const config = getConfig();

  if (config.HOPMED_SENTRY_DSN && config.HOPMED_BUILD_SENTRY_ENABLED) {
    console.log('🔧 Sentry Configuration Found:');
    console.log('  - DSN:', config.HOPMED_SENTRY_DSN.substring(0, 30) + '...');
    console.log('  - Environment:', config.HOPMED_BUILD_ENVIRONMENT);
    console.log('  - Debug Mode:', config.HOPMED_DEBUG_MODE);
    console.log('  - Sentry Enabled:', config.HOPMED_BUILD_SENTRY_ENABLED);

    Sentry.init({
      dsn: config.HOPMED_SENTRY_DSN,
      environment: config.HOPMED_BUILD_ENVIRONMENT,
      sendDefaultPii: true,
      replaysSessionSampleRate: config.HOPMED_DEBUG_MODE ? 1 : 0.1,
      replaysOnErrorSampleRate: 1,
      integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
      spotlight: config.HOPMED_DEBUG_MODE,
      debug: config.HOPMED_DEBUG_MODE,
    });

    console.log('✅ Sentry initialized successfully');

    // TEMPORARY: Send a test error to verify Sentry DSN integration
    setTimeout(() => {
      console.log('🧪 Sending intentional test error to Sentry dashboard...');
      Sentry.captureMessage(
        '🚀 Sentry DSN Integration Test - HopMed Mobile App Started Successfully',
        'info'
      );

      const testError = new Error(
        '🧪 INTENTIONAL TEST ERROR: Verifying Sentry DSN integration - This can be safely ignored'
      );
      testError.name = 'SentryDSNTestError';
      Sentry.captureException(testError, {
        tags: {
          test_type: 'dsn_verification',
          app_component: 'App.tsx',
          timestamp: new Date().toISOString(),
        },
        extra: {
          purpose: 'Testing new Sentry DSN configuration',
          dsn_used: config.HOPMED_SENTRY_DSN?.substring(0, 30) + '...',
          environment: config.HOPMED_BUILD_ENVIRONMENT,
        },
      });
      console.log('✅ Test error sent to Sentry - Check your dashboard!');
    }, 2000); // Send after 2 seconds to ensure Sentry is fully initialized
  } else {
    console.log('🔇 Sentry disabled or not configured:');
    console.log('  - DSN Present:', !!config.HOPMED_SENTRY_DSN);
    console.log('  - Sentry Enabled:', config.HOPMED_BUILD_SENTRY_ENABLED);
    if (!config.HOPMED_SENTRY_DSN) {
      console.log('  - Note: HOPMED_SENTRY_DSN not found in environment or app config');
    }
  }
} catch (error) {
  console.warn('⚠️ Sentry initialization failed (non-critical):', error);
}

// Robust environment system with graceful fallbacks
console.log('🌍 ====== HOPMED STARTUP (ROBUST) ======');
console.log('📍 Using robust environment system with fallbacks');
console.log('🔧 Daily.co plugin enabled for video calls');
console.log('🔐 Permission system with graceful error handling');
console.log('🛡️ Sentry enabled for error tracking and performance');
console.log('🌍 =====================================');

// Log native module compatibility on startup
logNativeModuleCompatibility();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Internal component that has access to Redux dispatch
const AppWithPermissions: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState();

  // 🧭 Navigation ref for call navigation management
  const navigationRef = useRef<NavigationContainerRef<ParamListBase>>(null);
  const [hasCheckedForCallRestore, setHasCheckedForCallRestore] = useState(false);

  // 🔐 Get auth state to know when user logs in
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  // 📱 Store push token data for registration after login
  const [pendingPushToken, setPendingPushToken] = useState<{
    token: string;
    platform: 'ios' | 'android';
    type: 'expo' | 'voip' | 'fcm';
  } | null>(null);

  // 📞 Initialize incoming call system
  // ✅ CRITICAL FIX: Use useCallback to stabilize onTokenUpdate reference
  // This prevents re-initialization and memory corruption
  const handleTokenUpdate = useCallback(async (tokenData: {
    token: string;
    platform: 'ios' | 'android';
    type: 'expo' | 'voip' | 'fcm';
  }) => {
    console.log('📞 Push token received:', tokenData.type);
    
    // Store token for registration after login
    setPendingPushToken(tokenData);
    
    // Try to register immediately if already authenticated
    if (isAuthenticated) {
      try {
        console.log('📞 User authenticated, registering push token...');
        await callsApi.registerPushToken(
          tokenData.token,
          tokenData.platform,
          tokenData.type
        );
        console.log('✅ Push token registered with backend successfully');
        setPendingPushToken(null); // Clear pending token
      } catch (error) {
        console.error('❌ Failed to register push token:', error);
      }
    } else {
      console.log('⏳ User not authenticated yet, will register token after login');
    }
  }, [isAuthenticated]); // Only recreate when isAuthenticated changes

  const { isInitialized: incomingCallInitialized, pushToken } = useIncomingCall({
    onTokenUpdate: handleTokenUpdate,
    autoNavigateOnAnswer: true, // Automatically navigate when call is answered
  });

  // 🔐 Register push token when user logs in
  useEffect(() => {
    if (isAuthenticated && pendingPushToken) {
      const registerToken = async () => {
        try {
          console.log('📞 User logged in, registering pending push token...');
          await callsApi.registerPushToken(
            pendingPushToken.token,
            pendingPushToken.platform,
            pendingPushToken.type
          );
          console.log('✅ Push token registered after login');
          setPendingPushToken(null); // Clear pending token
        } catch (error) {
          console.error('❌ Failed to register push token after login:', error);
          // Keep pending token for retry
        }
      };
      
      registerToken();
    }
  }, [isAuthenticated, pendingPushToken]);

  useEffect(() => {
    // Initialize permission system on app start
    console.log('🔐 Initializing permission system...');
    dispatch(initializePermissions());

    // ✅ CRITICAL FIX: Use AppStateManager instead of direct AppState listener
    // This consolidates all app state handling and prevents race conditions
    const handleAppStateChangeInternal = (nextAppState: AppStateStatus) => {
      console.log(`🔐 Permission system app state changed to: ${nextAppState}`);
      dispatch(handleAppStateChange(nextAppState as any));
    };

    // Import AppStateManager dynamically to avoid circular dependencies
    import('./src/utils/AppStateManager').then(({ default: AppStateManager }) => {
      const unsubscribe = AppStateManager.getInstance().addListener(
        'PermissionSystem',
        handleAppStateChangeInternal,
        50 // Medium priority for permission revalidation
      );

      // Store unsubscribe function for cleanup
      return unsubscribe;
    });

    return () => {
      // Cleanup handled by AppStateManager
      import('./src/utils/AppStateManager').then(({ default: AppStateManager }) => {
        AppStateManager.getInstance().removeListener('PermissionSystem');
      });
    };
  }, [dispatch]);

  useEffect(() => {
    const restoreState = async () => {
      try {
        // ✅ ENHANCED: Initialize lifecycle manager FIRST
        const AppLifecycleManager = (await import('./src/utils/AppLifecycleManager')).default;
        const lifecycleManager = AppLifecycleManager.getInstance();
        await lifecycleManager.initialize();

        // ✅ CRITICAL FIX: Clear auth flows on app termination
        const wasTerminated = lifecycleManager.wasAppTerminated();
        if (wasTerminated) {
          console.log('🔄 App was terminated - clearing incomplete auth flows');
          const AuthFlowPersistence = (await import('./src/utils/AuthFlowPersistence')).default;
          await AuthFlowPersistence.getInstance().clearAuthFlow();
        }

        // ✅ CRITICAL FIX: Ensure managers are initialized before restoring navigation
        // This prevents race conditions between call restoration and navigation restoration
        console.log('🔄 Starting coordinated state restoration...');

        const initialUrl = await Linking.getInitialURL();

        // Check if CallNavigationManager has an active call to restore
        const callNavigationManager = CallNavigationManager.getInstance();
        const hasActiveCall = callNavigationManager.isInCall();

        if (hasActiveCall) {
          console.log('📞 Active call detected, prioritizing call state over navigation state');
          // Don't restore navigation state - let CallNavigationManager handle it
        } else if (Platform.OS !== 'web' && initialUrl == null) {
          // Only restore state if there's no deep link, no active call, and we're on native
          console.log('🧭 Restoring navigation state from storage...');
          const savedStateString = await AsyncStorage.getItem('@hopmed_navigation_state');
          if (savedStateString) {
            const savedData = JSON.parse(savedStateString);

            // Handle both old format (direct state) and new format (with metadata)
            const savedState = savedData.state || savedData;
            const savedAt = savedData.savedAt || 0;
            const isAuthRoute = savedData.isAuthRoute || false;

            // ✅ ENHANCED: Different expiry for auth vs main screens
            const stateAge = Date.now() - savedAt;
            const maxStateAge = isAuthRoute
              ? 5 * 60 * 1000 // 5 minutes for auth screens
              : 24 * 60 * 60 * 1000; // 24 hours for main screens

            // ✅ ENHANCED: Don't restore auth navigation if app was terminated
            const shouldRestore = stateAge < maxStateAge && !(wasTerminated && isAuthRoute);

            if (shouldRestore) {
              setInitialState(savedState);
              console.log(`✅ Navigation state restored (${Math.round(stateAge / 1000)}s old)`);
            } else {
              const reason = wasTerminated && isAuthRoute
                ? 'app was terminated on auth screen'
                : 'navigation state too old';
              console.log(`⚠️ Navigation state not restored: ${reason}`);
              await AsyncStorage.removeItem('@hopmed_navigation_state');
            }
          }
        } else if (initialUrl) {
          console.log('🔗 Deep link detected, skipping navigation state restoration');
        }

        console.log('✅ State restoration coordination complete');
      } catch (error) {
        console.error('❌ State restoration failed:', error);
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) {
      restoreState();
    }
  }, [isReady]);

  // 🧭 Initialize CallNavigationManager and register navigation ref
  useEffect(() => {
    if (isReady && navigationRef.current) {
      console.log('🧭 Registering navigation ref with managers');

      // Register navigation ref with CallNavigationManager
      CallNavigationManager.getInstance().setNavigationRef(navigationRef.current);

      // ✅ Register navigation ref with NotifeeNotificationService
      NotifeeNotificationService.getInstance().setNavigationRef(navigationRef.current);

      // ✅ CRITICAL FIX: Register navigation ref with CallNotificationManager
      // This enables incoming call notification taps to navigate to IncomingCallScreen
      const CallNotificationManager = require('./src/services/CallNotificationManager').default;
      CallNotificationManager.getInstance().setNavigationRef(navigationRef.current);
      
      console.log('✅ Navigation ref registered with all managers');
    }
  }, [isReady]);

  // 🚨 CRITICAL: Listen for incoming call events from native Android
  // IncomingCallActivity sends this event via MainActivity when it launches
  useEffect(() => {
    if (!isReady || !navigationRef.current || Platform.OS !== 'android') {
      return;
    }

    console.log('📱 Setting up native incoming call event listener');

    const incomingCallListener = DeviceEventEmitter.addListener(
      'IncomingCallReceived',
      (callData: any) => {
        console.log('📱 Received IncomingCallReceived event from native:', callData.callerName);

        try {
          // Parse metadata if it's a JSON string
          let metadata = callData.metadata;
          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata);
            } catch (e) {
              console.warn('⚠️ Failed to parse metadata:', e);
              metadata = {};
            }
          }

          // Navigate immediately to IncomingCallScreen
          if (navigationRef.current) {
            console.log('✅ Navigating to IncomingCall screen from native event');
            (navigationRef.current as any).navigate('IncomingCall', {
              callData: {
                callId: callData.callId,
                callerId: callData.callerId,
                callerName: callData.callerName,
                callerType: callData.callerType,
                callType: callData.callType,
                roomUrl: callData.roomUrl,
                metadata: metadata,
              },
            });
          }
        } catch (error) {
          console.error('❌ Failed to handle incoming call event:', error);
        }
      }
    );

    return () => {
      console.log('🧹 Removing native incoming call event listener');
      incomingCallListener.remove();
    };
  }, [isReady]);

  // 🧭 Check for call restoration on app ready
  useEffect(() => {
    if (isReady && navigationRef.current && !hasCheckedForCallRestore) {
      const checkForCallRestore = async () => {
        try {
          console.log('🧭 Checking for call restoration on app startup');

          const callNavigationManager = CallNavigationManager.getInstance();
          const restoreResult = await callNavigationManager.checkAndRestoreCallNavigation();

          if (restoreResult.success) {
            if (restoreResult.restoredToCallScreen) {
              console.log('✅ Successfully restored to call screen');
            } else {
              console.log('ℹ️ No call to restore or already on correct screen');
            }
          } else {
            console.log('⚠️ Call restoration failed:', restoreResult.error);
          }
        } catch (error) {
          console.error('❌ Error during call restoration check:', error);
        } finally {
          setHasCheckedForCallRestore(true);
        }
      };

      // Delay the check slightly to ensure navigation is fully ready
      const timeoutId = setTimeout(checkForCallRestore, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [isReady, hasCheckedForCallRestore]);

  const onStateChange = useCallback(async (state: any) => {
    // ✅ ENHANCED: Save navigation state with metadata and validation
    try {
      if (state != null) {
        // Detect if current route is an auth screen
        const currentRoute = navigationRef.current?.getCurrentRoute();
        const authScreens = [
          'Login',
          'Register',
          'ReferralCode',
          'Verification',
          'CreatePassword',
          'AccountReady',
          'ForgotPassword',
        ];
        const isAuthRoute = currentRoute?.name
          ? authScreens.includes(currentRoute.name)
          : false;

        // Add metadata for better state management
        const stateWithMetadata = {
          state,
          savedAt: Date.now(),
          version: '1.0', // For future migration support
          isAuthRoute, // ✅ CRITICAL: Track if this is an auth screen
        };

        await AsyncStorage.setItem('@hopmed_navigation_state', JSON.stringify(stateWithMetadata));

        // Log for debugging (only in dev)
        if (__DEV__) {
          console.log(
            `🧭 Navigation state saved: ${currentRoute?.name || 'unknown'}${isAuthRoute ? ' (auth)' : ''}`
          );
        }
      } else {
        // Remove the stored state if it's null/undefined
        await AsyncStorage.removeItem('@hopmed_navigation_state');
        console.log('🧭 Navigation state cleared');
      }
    } catch (error) {
      console.error('❌ Failed to save navigation state:', error);
      // Non-critical error - app continues
    }
  }, []);

  useEffect(() => {
    const extra = (Constants?.expoConfig?.extra as any) || {};
    const ms = parseInt(extra?.HOPMED_SPLASH_TIMEOUT ?? '10000', 10);
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, ms);
    return () => clearTimeout(t);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        initialState={initialState}
        onStateChange={onStateChange}
      >
        <ErrorBoundary level="screen">
          {/* 🚨 CRITICAL: IncomingCallProvider ensures navigation works reliably */}
          {/* Inspired by TelegramClone's CallProvider architecture */}
          <IncomingCallProvider>
            <AppNavigator />
          </IncomingCallProvider>
        </ErrorBoundary>
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [splashHidden, setSplashHidden] = useState(false);
  const [persistGateBootstrapped, setPersistGateBootstrapped] = useState(false);

  // Test functions for Sentry verification (DISABLED)
  // These functions have been disabled to prevent accidental test triggers
  /*
  const testSentryError = () => {
    if (!settings.enableSentry) {
      console.log('🔇 Sentry test skipped: Sentry is disabled');
      return;
    }
    try {
      console.log('🧪 Testing Sentry with a test error...');
      Sentry.captureMessage('Test message from HopMed app', 'info');
      throw new Error('This is a test error for Sentry verification - Manual trigger');
    } catch (error) {
      Sentry.captureException(error);
      console.log('✅ Test error sent to Sentry');
    }
  };

  const testSentryMessage = () => {
    if (!settings.enableSentry) {
      console.log('🔇 Sentry test skipped: Sentry is disabled');
      return;
    }
    console.log('🧪 Testing Sentry with a test message...');
    Sentry.captureMessage('HopMed app Sentry integration test - Manual trigger', 'info');
    console.log('✅ Test message sent to Sentry');
  };

  const triggerCriticalError = () => {
    if (!settings.enableSentry) {
      console.log('🔇 Sentry test skipped: Sentry is disabled');
      throw new Error('CRITICAL ERROR: This is a manual test error (Sentry disabled)');
    }
    console.log('🚨 Triggering critical error for Sentry...');
    Sentry.captureMessage('CRITICAL: Manual error test triggered by user', 'error');
    throw new Error('CRITICAL ERROR: This is a manual test error to verify Sentry integration');
  };

  const triggerWarning = () => {
    if (!settings.enableSentry) {
      console.log('🔇 Sentry test skipped: Sentry is disabled');
      return;
    }
    console.log('⚠️ Triggering warning for Sentry...');
    Sentry.captureMessage('WARNING: Test warning message', 'warning');
    console.log('✅ Warning sent to Sentry');
  };
  */

  // 🚨 CRITICAL FIX #1: Top-level emergency splash timeout
  // This starts IMMEDIATELY on mount, before PersistGate or any other async operations
  // Ensures splash ALWAYS hides within max timeout, even if everything else fails
  useEffect(() => {
    const extra = (Constants?.expoConfig?.extra as any) || {};
    const emergencyTimeout = parseInt(extra.HOPMED_SPLASH_TIMEOUT || '12000', 10);
    
    console.log(`🚨 EMERGENCY SPLASH TIMEOUT: Starting ${emergencyTimeout}ms countdown`);
    
    const emergencyTimer = setTimeout(() => {
      if (!splashHidden) {
        console.warn('⚠️ EMERGENCY: Forcing splash screen hide after timeout!');
        SplashScreen.hideAsync()
          .then(() => {
            console.log('✅ Emergency splash hide successful');
            setSplashHidden(true);
          })
          .catch((err) => {
            console.error('❌ Emergency splash hide failed:', err);
            // Try again with native module directly
            if (Platform.OS === 'android') {
              try {
                const { NativeModules } = require('react-native');
                NativeModules.SplashScreen?.hide();
                setSplashHidden(true);
              } catch (e) {
                console.error('❌ Native splash hide failed:', e);
              }
            }
          });
      }
    }, emergencyTimeout);

    return () => {
      console.log('🧹 Clearing emergency splash timeout');
      clearTimeout(emergencyTimer);
    };
  }, [splashHidden]);

  // 🚨 CRITICAL FIX #2: Redundant splash hide on app mount (Cross-platform)
  // Both Android's and iOS's onLayout can occasionally fail to fire
  // This provides a redundant trigger mechanism for both platforms
  useEffect(() => {
    if (appIsReady && !splashHidden) {
      const platformName = Platform.OS === 'ios' ? '🍎 iOS' : '🤖 Android';
      console.log(`${platformName}: Attempting redundant splash hide on mount`);
      
      // Platform-specific delays:
      // - Android: 500ms (layout can be slower on some devices)
      // - iOS: 300ms (generally faster, but still need delay for safety)
      const delay = Platform.OS === 'ios' ? 300 : 500;
      
      const timer = setTimeout(() => {
        SplashScreen.hideAsync()
          .then(() => {
            console.log(`✅ ${platformName} redundant splash hide successful`);
            setSplashHidden(true);
          })
          .catch((err) => {
            console.warn(`⚠️ ${platformName} redundant splash hide failed (non-critical):`, err);
          });
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [appIsReady, splashHidden]);

  // 🚨 CRITICAL FIX #2b: iOS Background State Protection
  // iOS can restore app in background, which can cause splash to stay visible
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // If app becomes active and splash is still visible, force hide
      if (nextAppState === 'active' && appIsReady && !splashHidden) {
        console.log('🍎 iOS: App became active with splash still visible - forcing hide');
        setTimeout(() => {
          if (!splashHidden) {
            SplashScreen.hideAsync()
              .then(() => {
                console.log('✅ iOS background-to-foreground splash hide successful');
                setSplashHidden(true);
              })
              .catch(err => console.warn('⚠️ iOS background splash hide failed:', err));
          }
        }, 200);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [appIsReady, splashHidden]);

  // 🚨 CRITICAL FIX #2c: iOS Memory Warning Handler
  // iOS memory warnings during launch can interrupt initialization
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const handleMemoryWarning = () => {
      console.warn('🍎 iOS: Memory warning received during initialization');
      // Don't let memory pressure prevent splash from hiding
      if (appIsReady && !splashHidden) {
        console.log('🍎 iOS: Ensuring splash hides despite memory pressure');
        setTimeout(() => {
          if (!splashHidden) {
            SplashScreen.hideAsync()
              .then(() => setSplashHidden(true))
              .catch(() => {/* ignore */});
          }
        }, 100);
      }
    };

    // Note: DeviceEventEmitter is used for native memory warnings on iOS
    const subscription = DeviceEventEmitter.addListener('memoryWarning', handleMemoryWarning);
    return () => subscription.remove();
  }, [appIsReady, splashHidden]);

  // 🚨 CRITICAL FIX #3: Redux Persist timeout wrapper
  // PersistGate has NO built-in timeout - if AsyncStorage hangs, app hangs forever
  // This forces PersistGate to "bootstrap" after timeout even if rehydration incomplete
  useEffect(() => {
    const extra = (Constants?.expoConfig?.extra as any) || {};
    const persistTimeout = parseInt(extra.HOPMED_REDUX_PERSIST_TIMEOUT || '8000', 10);
    
    console.log(`⏱️ Redux Persist timeout: ${persistTimeout}ms`);
    
    const persistTimer = setTimeout(() => {
      if (!persistGateBootstrapped) {
        console.warn('⚠️ Redux Persist timeout reached - forcing bootstrap');
        console.warn('   This means AsyncStorage may be slow or corrupted');
        console.warn('   App will continue with potentially incomplete state');
        setPersistGateBootstrapped(true);
      }
    }, persistTimeout);

    return () => clearTimeout(persistTimer);
  }, [persistGateBootstrapped]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    async function prepare() {
      try {
        // 🚨 CRITICAL FIX #4: Storage health check before everything else
        // Prevents app freeze from corrupted storage on both platforms
        // Android: SQLite-based AsyncStorage (more prone to corruption)
        // iOS: UserDefaults-backed AsyncStorage (more reliable but can still fail)
        console.log(`🏥 Running storage health check (${Platform.OS})...`);
        try {
          const { checkAsyncStorageHealth, getAsyncStorageMetrics } = await import(
            './src/utils/asyncStorageHealthCheck'
          );
          
          const healthCheck = await checkAsyncStorageHealth();
          
          if (!healthCheck.isHealthy) {
            const platform = Platform.OS === 'ios' ? '🍎 iOS' : '🤖 Android';
            console.error(`💔 ${platform} storage is unhealthy!`);
            console.error('   Errors:', healthCheck.errors);
            console.warn('   App may experience issues with data persistence');
            
            // Get metrics to understand the problem
            const metrics = await getAsyncStorageMetrics();
            console.log('   Storage metrics:', metrics);
            
            if (Platform.OS === 'ios') {
              console.warn('   🍎 iOS storage issue is rare - may indicate low disk space or corruption');
              console.warn('   Consider clearing app data or reinstalling if issues persist');
            }
            
            // For now, just log - don't block the app
            // User can still use the app, they'll just need to re-login
          } else {
            console.log(`✅ ${Platform.OS === 'ios' ? '🍎 iOS' : '🤖 Android'} storage health check passed`);
          }
        } catch (healthCheckError) {
          console.warn('⚠️ Storage health check failed (non-critical):', healthCheckError);
          // Continue anyway - health check failure shouldn't block the app
        }

        // Initialize ConsolidatedPermissionManager with graceful error handling
        console.log('🔄 Initializing ConsolidatedPermissionManager...');
        try {
          const permissionManager = ConsolidatedPermissionManager.getInstance();
          await permissionManager.initialize();
          console.log('✅ ConsolidatedPermissionManager initialized successfully');
        } catch (permissionError) {
          console.warn(
            '⚠️ Permission manager initialization failed (non-critical):',
            permissionError
          );
          // App continues - permission manager failure is not critical for basic app function
        }

        // Initialize BackgroundTaskManager for token refresh
        console.log('🔄 Initializing BackgroundTaskManager...');
        try {
          const backgroundTaskManager = BackgroundTaskManager.getInstance();
          console.log('✅ BackgroundTaskManager initialized successfully');
        } catch (backgroundError) {
          console.warn(
            '⚠️ Background task manager initialization failed (non-critical):',
            backgroundError
          );
          // App continues - background tasks are not critical for basic app function
        }

        // Initialize CallNavigationManager for call navigation persistence
        console.log('🔄 Initializing CallNavigationManager...');
        try {
          const callNavigationManager = CallNavigationManager.getInstance();
          console.log('✅ CallNavigationManager initialized successfully');
        } catch (callNavigationError) {
          console.warn(
            '⚠️ Call navigation manager initialization failed (non-critical):',
            callNavigationError
          );
          // App continues - call navigation is not critical for basic app function
        }

        // Initialize CallKit for iOS native call integration
        console.log('🔄 Initializing CallKit...');
        try {
          CallKitManager.getInstance().initialize({
            appName: 'HopMed',
            supportsVideo: true,
          });
          console.log('✅ CallKit initialized successfully');
        } catch (callKitError) {
          console.warn(
            '⚠️ CallKit initialization failed (non-critical):',
            callKitError
          );
          // App continues - CallKit is not critical for basic app function
        }

        // Set a maximum timeout for initialization (shortened for debugging)
        const initTimeout = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('App initialization timeout'));
          }, 3000); // 5 second timeout for debugging
        });

        // Pre-load fonts, make any API calls you need to do here (shortened for debugging)
        const initPromise = new Promise(resolve => setTimeout(resolve, 100));

        // Race between initialization and timeout
        await Promise.race([initPromise, initTimeout]);

        // Clear timeout if initialization succeeds
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      } catch (e) {
        console.warn('App initialization error:', e);
        setInitError(e instanceof Error ? e.message : 'Unknown initialization error');
      } finally {
        // Always set app as ready, even on error
        setAppIsReady(true);
      }
    }

    prepare();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && !splashHidden) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      console.log('📐 onLayout triggered - hiding splash screen');
      await SplashScreen.hideAsync()
        .then(() => {
          console.log('✅ Primary splash hide successful (onLayout)');
          setSplashHidden(true);
        })
        .catch((err) => {
          console.error('❌ Primary splash hide failed:', err);
        });
    }
  }, [appIsReady, splashHidden]);

  if (!appIsReady) {
    return <LoadingScreen message="Initializing HopMed..." />;
  }

  // Show error state if initialization failed
  if (initError) {
    return (
      <ErrorBoundary
        fallback={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text
              style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}
            >
              App Failed to Initialize
            </Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 }}>
              {initError}
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#007AFF',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
              onPress={() => {
                setInitError(null);
                setAppIsReady(false);
                // Trigger re-initialization
                setTimeout(() => setAppIsReady(true), 100);
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <LoadingScreen message="Retrying initialization..." />
      </ErrorBoundary>
    );
  }

  // Debug panel for Sentry testing
  const SentryDebugPanel = () => {
    const config = getConfig();

    if (!config.HOPMED_DEBUG_MODE || !config.HOPMED_SENTRY_DSN) {
      return null;
    }

    const testSentryError = () => {
      try {
        console.log('🧪 Testing Sentry with a test error...');
        Sentry.captureMessage('Test message from HopMed app - Manual trigger', 'info');
        throw new Error(
          '🚨 SENTRY TEST ERROR: This is a manual test error to verify Sentry integration'
        );
      } catch (error) {
        Sentry.captureException(error);
        console.log('✅ Test error sent to Sentry');
      }
    };

    const testSentryMessage = () => {
      console.log('🧪 Testing Sentry with a test message...');
      Sentry.captureMessage(
        '📱 HopMed app Sentry integration test - Manual message trigger',
        'info'
      );
      console.log('✅ Test message sent to Sentry');
    };

    const testSentryWarning = () => {
      console.log('⚠️ Testing Sentry with a warning...');
      Sentry.captureMessage('⚠️ WARNING: Test warning message from HopMed app', 'warning');
      console.log('✅ Warning sent to Sentry');
    };

    return (
      <View
        style={{
          position: 'absolute',
          top: 100,
          right: 10,
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 10,
          borderRadius: 8,
          zIndex: 1000,
        }}
      >
        <Text style={{ color: 'white', fontSize: 12, marginBottom: 8, fontWeight: 'bold' }}>
          🔧 Sentry Test Panel
        </Text>

        <TouchableOpacity
          style={{
            backgroundColor: '#FF4444',
            padding: 8,
            borderRadius: 4,
            marginBottom: 4,
          }}
          onPress={testSentryError}
        >
          <Text style={{ color: 'white', fontSize: 10, textAlign: 'center' }}>Test Error</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#4444FF',
            padding: 8,
            borderRadius: 4,
            marginBottom: 4,
          }}
          onPress={testSentryMessage}
        >
          <Text style={{ color: 'white', fontSize: 10, textAlign: 'center' }}>Test Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#FF8844',
            padding: 8,
            borderRadius: 4,
          }}
          onPress={testSentryWarning}
        >
          <Text style={{ color: 'white', fontSize: 10, textAlign: 'center' }}>Test Warning</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ErrorBoundary level="app">
      <Provider store={store}>
        <SafeAreaProvider onLayout={onLayoutRootView}>
          <PersistGate
            loading={<LoadingScreen message="Loading your data..." />}
            persistor={persistor}
            onBeforeLift={() => {
              console.log('✅ Redux Persist: Rehydration complete');
              console.log('🚀 Using full featured screens');
              setPersistGateBootstrapped(true);
            }}
          >
            {/* 🚨 CRITICAL: Force render after timeout even if PersistGate hasn't lifted */}
            {persistGateBootstrapped ? (
              <>
                <AppWithPermissions />
                {/* <SentryDebugPanel /> */}
                {/* {__DEV__ && <IncomingCallDebugPanel />} */}
              </>
            ) : (
              <LoadingScreen message="Restoring your session..." />
            )}
          </PersistGate>
        </SafeAreaProvider>
      </Provider>
    </ErrorBoundary>
  );
}

// Export with conditional Sentry wrapping for enhanced error tracking
let WrappedApp: () => React.JSX.Element = App;
try {
  const config = getConfig();
  if (config.HOPMED_SENTRY_DSN && config.HOPMED_BUILD_SENTRY_ENABLED) {
    WrappedApp = Sentry.wrap(App) as () => React.JSX.Element;
    console.log('✅ App wrapped with Sentry error boundary');
  } else {
    console.log('📱 App exported without Sentry wrapping');
  }
} catch (error) {
  console.warn('⚠️ Sentry wrapping failed, using unwrapped app:', error);
}

export default WrappedApp;
