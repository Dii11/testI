import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Platform,
  Animated,
  ScrollView,
  Alert,
  AppState,
  type AppStateStatus,
} from 'react-native';

import {
  AdaptiveTouchableOpacity,
  AdaptiveAnimatedView,
  useAdaptiveTheme,
  PerformanceMonitor,
} from '../../components/adaptive/AdaptiveComponents';
import { HealthDashboardErrorBoundary } from '../../components/health/HealthDashboardErrorBoundary';
import { UnifiedStepsChart, type ChartDataPoint } from '../../components/health/UnifiedStepsChart';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants';
import { useActiveTime } from '../../hooks/health/useActiveTime';
import { useCalories } from '../../hooks/health/useCalories';
import { useHeartRate } from '../../hooks/health/useHeartRate';
import { useMonthlyWeeks } from '../../hooks/health/useMonthlyWeeks';
import { useStepCounter } from '../../hooks/health/useStepCounter';
import { useWeeklySteps } from '../../hooks/health/useWeeklySteps';
import { useYearlyMonths } from '../../hooks/health/useYearlyMonths';
import type { PeriodFilter } from '../../types/health';
import { safeHaptics, safeNavigation } from '../../utils/runtimeSafety';
import { sentryTracker } from '../../utils/sentryErrorTracker';
import * as Device from 'expo-device';
import { healthConnectManager } from '../../utils/HealthConnectManager';
import { verifyHealthKitReady } from '../../utils/healthKitUtils';

const IS_IOS = Platform.OS === 'ios';
const STEPS_GOAL = 10_000;

const SimpleStepsDashboard: React.FC = () => {
  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { theme, isLowEndDevice } = useAdaptiveTheme();

  const [date, setDate] = useState(new Date());
  const [period, setPeriod] = useState<PeriodFilter>('today');

  // 🔔 Notification states (like iOS)
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const appState = useRef(AppState.currentState);

  // ✅ PROFESSIONAL: Permission state version for propagation
  // Increment this to force all hooks to re-check permissions
  const [permissionVersion, setPermissionVersion] = useState(0);

  // Get step counter data (using FIXED Health Connect hook)
  const stepCounterResult = useStepCounter({ date, period });

  // 🔍 REAL-DEVICE DEBUG: Log hook initialization state
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'ios') {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
      console.log(`[${timestamp}] 📊 [Dashboard] useStepCounter hook state:`, {
        initialized: !!stepCounterResult,
        hasSteps: stepCounterResult ? 'steps' in stepCounterResult : false,
        hasPermissions: stepCounterResult ? 'hasPermissions' in stepCounterResult : false,
        hasError: stepCounterResult ? 'error' in stepCounterResult : false,
      });
    }
  }, [stepCounterResult]);

  // ✅ CRASH-SAFE: Provide safe fallbacks if hook returns undefined (rare edge case)
  const {
    steps = 0,
    isLoading = true,
    error = null,
    hasPermissions = false,
    requestPermissions = async () => {
      console.warn('⚠️ requestPermissions not available - hook not initialized');
    },
  } = stepCounterResult || {};

  // ✅ CRASH-SAFE: Safely extract optional properties with null check for stepCounterResult
  const openSettings =
    stepCounterResult && 'openSettings' in stepCounterResult
      ? stepCounterResult.openSettings
      : undefined;
  const androidData =
    stepCounterResult && 'androidData' in stepCounterResult
      ? stepCounterResult.androidData
      : undefined;
  const platformFile =
    stepCounterResult && '__platformFile' in stepCounterResult
      ? stepCounterResult.__platformFile
      : 'unknown';

  // Extract Android-specific debug data (from fixed hook) with type safety
  const isAndroid = Platform.OS === 'android';
  const androidStatus =
    androidData && typeof androidData === 'object' && 'sdkStatus' in androidData
      ? androidData.sdkStatus
      : null;
  const isHealthConnectAvailable =
    androidData && typeof androidData === 'object' && 'isHealthConnectAvailable' in androidData
      ? androidData.isHealthConnectAvailable
      : false;
  const isInitialized =
    androidData && typeof androidData === 'object' && 'isInitialized' in androidData
      ? androidData.isInitialized
      : false;
  // Note: isInitializing removed from simplified hook implementation

  // ✅ CRASH-SAFE: Chart hooks with comprehensive null safety
  const weeklyStepsHook = useWeeklySteps();
  const monthlyWeeksHook = useMonthlyWeeks();
  const yearlyMonthsHook = useYearlyMonths();

  // ✅ CRITICAL: Always provide fallback empty arrays to prevent undefined access crashes
  const { weeklyData = [], isLoading: isWeeklyLoading = true } = weeklyStepsHook || {};
  const { monthlyData = [], isLoading: isMonthlyLoading = true } = monthlyWeeksHook || {};
  const { yearlyData = [], isLoading: isYearlyLoading = true } = yearlyMonthsHook || {};

  // NEW: Health metrics hooks with defensive null checks
  const heartRateResult = useHeartRate({ date, period });
  const caloriesResult = useCalories({ date, period });
  const activeTimeResult = useActiveTime({ date, period });

  // Debug logging for Android Health Connect issues
  if (__DEV__ && Platform.OS === 'android') {
    console.log('🔍 Health metrics debug:', {
      heartRateResult: heartRateResult ? 'defined' : 'undefined',
      caloriesResult: caloriesResult ? 'defined' : 'undefined',
      activeTimeResult: activeTimeResult ? 'defined' : 'undefined',
      heartRateType: typeof heartRateResult,
      caloriesType: typeof caloriesResult,
      activeTimeType: typeof activeTimeResult,
    });
  }

  // Health metrics with comprehensive fallbacks and null safety
  // Defensive programming: Handle cases where hooks return undefined, null, or unexpected data
  const heartRateData =
    heartRateResult && typeof heartRateResult === 'object' && heartRateResult !== null
      ? heartRateResult
      : {};
  const caloriesData =
    caloriesResult && typeof caloriesResult === 'object' && caloriesResult !== null
      ? caloriesResult
      : {};
  const activeTimeData =
    activeTimeResult && typeof activeTimeResult === 'object' && activeTimeResult !== null
      ? activeTimeResult
      : {};

  // Extract values with enhanced type safety and null checks
  // Additional safety: Check for property existence before accessing
  const heartRate =
    heartRateData && 'heartRate' in heartRateData && typeof heartRateData.heartRate === 'number'
      ? heartRateData.heartRate
      : null;
  const calories =
    caloriesData && 'calories' in caloriesData && typeof caloriesData.calories === 'number'
      ? caloriesData.calories
      : 0;
  const activeMinutes =
    activeTimeData &&
    'activeMinutes' in activeTimeData &&
    typeof activeTimeData.activeMinutes === 'number'
      ? activeTimeData.activeMinutes
      : 0;
  const activeHours =
    activeTimeData &&
    'activeHours' in activeTimeData &&
    typeof activeTimeData.activeHours === 'number'
      ? activeTimeData.activeHours
      : 0;

  // 🔔 Helper: Show toast notification (like iOS)
  const showToast = useCallback((message: string, duration = 3000) => {
    try {
      setToastMessage(message);
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(duration),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setToastMessage(null));
    } catch (error) {
      console.error('❌ [Toast] Error showing toast:', error);
    }
  }, [toastOpacity]);

  // 🔔 Helper: Show refresh banner (like iOS)
  const showBanner = useCallback(() => {
    try {
      setShowRefreshBanner(true);
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 10 seconds
      setTimeout(() => {
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setShowRefreshBanner(false));
      }, 10000);
    } catch (error) {
      console.error('❌ [Banner] Error showing banner:', error);
    }
  }, [bannerOpacity]);

  // 🔔 Helper: Dismiss banner (like iOS)
  const dismissBanner = useCallback(() => {
    try {
      Animated.timing(bannerOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowRefreshBanner(false));
    } catch (error) {
      console.error('❌ [Banner] Error dismissing banner:', error);
    }
  }, [bannerOpacity]);

  // Animated header collapse (increased height for period filter buttons)
  // Memoized to prevent recreation on every render
  const headerHeight = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [270, 160],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  const headerOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 50],
        outputRange: [1, 0.9],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  // ✅ FIXED: Simplified entrance animation - ensure it completes properly
  useEffect(() => {
    const animation = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600, // Reduced duration for faster completion
      useNativeDriver: true,
    });

    // Start animation and ensure it completes
    animation.start((finished: boolean) => {
      if (finished) {
        console.log('✅ [Dashboard] Entrance animation completed successfully');
      } else {
        console.warn('⚠️ [Dashboard] Entrance animation was interrupted');
        // Force completion if interrupted
        fadeAnim.setValue(1);
      }
    });

    // ✅ SAFETY: Force full opacity after 1 second to prevent stuck overlay
    const safetyTimeout = setTimeout(() => {
      console.log('🔧 [Dashboard] Safety timeout - ensuring full opacity');
      fadeAnim.setValue(1);
    }, 1000);

    // Cleanup: stop animation if component unmounts mid-animation
    return () => {
      animation.stop();
      clearTimeout(safetyTimeout);
      // Ensure opacity is set to 1 on cleanup to prevent stuck state
      fadeAnim.setValue(1);
    };
  }, [fadeAnim]);

  // 📱 App State Listener: Detect when returning from Settings (like iOS)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('📱 [AppState] State changed:', {
        from: appState.current,
        to: nextAppState,
      });

      // If app is coming to foreground from background
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('✅ [AppState] App returned to foreground - auto-refreshing data...');

        // Show toast notification
        showToast('✓ Refreshing health data');

        // Trigger refresh
        await refresh();

        // Show banner if permissions might have changed
        if (!hasPermissions) {
          showBanner();
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [hasPermissions, showToast, showBanner, refresh]);

  // ✅ EFFICIENT REAL-DEVICE DEBUG: Sentry breadcrumbs (zero overhead)
  // Logs data snapshot when all hooks finish loading
  useEffect(() => {
    if (!isLoading && !isWeeklyLoading && !isMonthlyLoading && !isYearlyLoading) {
      const hasData = steps > 0 || (weeklyData && weeklyData.length > 0);
      const dataSnapshot = {
        steps,
        hasPermissions,
        error: error || null,
        period,
        heartRate,
        calories,
        activeMinutes,
        weeklyLength: weeklyData?.length ?? 0,
        monthlyLength: monthlyData?.length ?? 0,
        yearlyLength: yearlyData?.length ?? 0,
        // ✅ Show TODAY's data (where isToday: true) instead of first day of week
        weeklySample: weeklyData?.find(d => d?.isToday) || weeklyData?.[weeklyData.length - 1] || null,
        monthlySample: monthlyData?.[0] || null,
        yearlySample: yearlyData?.[0] || null,
        // 🔍 Additional debug: Show full weekly breakdown
        weeklyBreakdown: weeklyData?.map(d => ({
          day: d?.dayName,
          date: d?.dayNumber,
          steps: d?.steps,
          isToday: d?.isToday,
        })) || [],
      };

      if (typeof sentryTracker !== 'undefined' && sentryTracker.addBreadcrumb) {
        sentryTracker.addBreadcrumb({
          category: 'healthkit.data',
          message: hasData ? 'HealthKit data loaded' : 'HealthKit: NO DATA',
          level: hasData ? 'info' : 'warning',
          data: dataSnapshot,
        });
      }
    }
  }, [
    steps,
    weeklyData,
    monthlyData,
    yearlyData,
    isLoading,
    isWeeklyLoading,
    isMonthlyLoading,
    isYearlyLoading,
    hasPermissions,
    error,
    period,
    heartRate,
    calories,
    activeMinutes,
  ]);

  // ✅ OPTIMIZATION REMOVED: Unused syncPermissions logic
  // The HealthConnectManager's cache system automatically handles permission state
  // across all hooks. When permissions are granted, the manager updates its cache,
  // and all hooks (weekly, monthly, yearly) automatically detect granted permissions
  // on their next render cycle. No manual sync needed.

  const changeDate = useCallback(
    (numDays: number) => {
      const currentDate = new Date(date);
      currentDate.setDate(currentDate.getDate() + numDays);
      setDate(currentDate);
      safeHaptics.selection();
    },
    [date]
  );

  const handlePeriodChange = useCallback((newPeriod: PeriodFilter) => {
    setPeriod(newPeriod);
    safeHaptics.selection();
  }, []);

  // ✅ FIXED: Enhanced refresh mechanism that ensures data re-fetch
  // Creates new Date with same timestamp to trigger React re-renders
  // Hook objects removed from dependencies to prevent infinite loop
  const refresh = useCallback(async () => {
    console.log('🔄 [Health] Manual refresh triggered');
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);

    // Dismiss banner if showing (like iOS)
    if (showRefreshBanner) {
      dismissBanner();
    }

    // Create new Date instance with same timestamp to trigger useEffect re-runs
    setDate(new Date(date.getTime()));

    // ✅ BONUS: Explicitly call refetch functions if hooks expose them
    // This ensures data updates even if hooks use custom comparison logic
    // Note: We capture hook results in the effect, not in dependencies
    const refetchPromises = [
      stepCounterResult &&
      'refetch' in stepCounterResult &&
      typeof stepCounterResult.refetch === 'function'
        ? stepCounterResult.refetch()
        : null,
      weeklyStepsHook &&
      'refetch' in weeklyStepsHook &&
      typeof weeklyStepsHook.refetch === 'function'
        ? weeklyStepsHook.refetch()
        : null,
      monthlyWeeksHook &&
      'refetch' in monthlyWeeksHook &&
      typeof monthlyWeeksHook.refetch === 'function'
        ? monthlyWeeksHook.refetch()
        : null,
      yearlyMonthsHook &&
      'refetch' in yearlyMonthsHook &&
      typeof yearlyMonthsHook.refetch === 'function'
        ? yearlyMonthsHook.refetch()
        : null,
    ].filter(p => p !== null);

    // Execute refetch calls in parallel if they exist
    if (refetchPromises.length > 0) {
      await Promise.allSettled(refetchPromises);
    }

    // Show success toast (like iOS)
    showToast('✓ Data refreshed');
  }, [date, stepCounterResult, weeklyStepsHook, monthlyWeeksHook, yearlyMonthsHook, showRefreshBanner, dismissBanner, showToast]);

  // ✅ UNIFIED PERMISSION REQUEST: Request ALL health permissions at once
  // Works for both iOS (HealthKit) and Android (Health Connect)
  const requestAllHealthPermissions = useCallback(async () => {
    // ✅ PROFESSIONAL: Track permission request state
    let permissionRequestInProgress = false;

    try {
      console.log('🔐 [Dashboard] Requesting ALL health permissions...');
      safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);

      // Set loading state to show visual feedback
      permissionRequestInProgress = true;

      if (Platform.OS === 'ios') {
        // ✅ CRITICAL: Check if running on simulator first (HealthKit not supported)
        // @ts-ignore - Platform.constants exists on iOS
        const isSimulator = Platform.constants?.reactNativeVersion?.buildNumber === undefined ||
                           Platform.constants?.interfaceIdiom === 'simulator' ||
                           __DEV__ && !Platform.isTV;

        try {
          // ✅ iOS: Request all HealthKit permissions at once
          // Guard against simulator to avoid Nitro module initialization
          if (!Device.isDevice) {
            const errorMessage = 'HealthKit is not available on iOS Simulator. Please use a real iOS device to track health data.';
            console.error('❌ [Dashboard]', errorMessage);
            Alert.alert('Not Available', errorMessage);
            return;
          }

          const { requestAuthorization, isHealthDataAvailable } = require('@kingstinct/react-native-healthkit');

          console.log('📱 [Dashboard] Checking HealthKit availability...');

          // ✅ CRITICAL: Check if HealthKit is available (returns false on simulator)
          // Wrap in try-catch because this native call itself can crash on simulator
          let available = false;
          try {
            available = await isHealthDataAvailable();
          } catch (availCheckError) {
            console.error('❌ [Dashboard] HealthKit availability check failed:', availCheckError);
            available = false;
          }

          if (!available) {
            const errorMessage = 'HealthKit is not available on this device. Please use a real iOS device to track health data.';
            console.error('❌ [Dashboard]', errorMessage);
            Alert.alert('Not Available', errorMessage);
            return;
          }

          console.log('📱 [Dashboard] Requesting iOS HealthKit permissions...');

          await requestAuthorization(
            [
              'HKQuantityTypeIdentifierStepCount',
              'HKQuantityTypeIdentifierActiveEnergyBurned',
              'HKQuantityTypeIdentifierBasalEnergyBurned',
              'HKQuantityTypeIdentifierHeartRate',
              'HKQuantityTypeIdentifierAppleExerciseTime',
              'HKQuantityTypeIdentifierDistanceWalkingRunning',
              'HKQuantityTypeIdentifierFlightsClimbed',
            ],
            [] // Write permissions (empty array for read-only access)
          );

          console.log('✅ [Dashboard] iOS permissions requested - user dismissed dialog');

          // 🚨 CRITICAL FIX: iOS HealthKit authorization state propagation timing
          //
          // PROBLEM: After user grants permission, iOS needs time to update internal state
          // TIMING: 1-2 seconds on real devices (undocumented by Apple)
          // CONSEQUENCE: Queries before propagation return empty/fail
          //
          // SOLUTION: Progressive verification with increasing delays
          console.log('⏳ [Dashboard] Waiting for iOS to propagate authorization state (2 seconds)...');

          // Stage 1: Initial propagation (2 seconds - tested on iPhone 12 Pro, iOS 15-17)
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('✅ [Dashboard] Stage 1 complete - triggering hook permission update');

          // Stage 2: Update hook-level permission state
          // This triggers useHealthKitPermissions to re-evaluate and set hasRequestedPermission
          await requestPermissions();
          console.log('✅ [Dashboard] Stage 2 complete - hook notified of permissions');

          // Stage 3: Additional safety buffer for hook state propagation
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('✅ [Dashboard] Stage 3 complete - authorization fully propagated');

          // Stage 4: Enhanced verification using dedicated utility
          // This performs 3 rounds of availability checks with delays (1.5 seconds total)
          console.log('🔍 [Dashboard] Starting enhanced readiness verification...');
          const isReady = await verifyHealthKitReady({ hook: 'SimpleStepsDashboard', action: 'requestAllHealthPermissions' });

          if (!isReady) {
            console.error('❌ [Dashboard] Enhanced verification failed - HealthKit not ready');
            Alert.alert(
              'Authorization Issue',
              'HealthKit authorization could not be verified. Please try:\n\n1. Restart the app\n2. Check Settings > Health > Data Access\n3. Ensure this app has permission to read health data',
              [{ text: 'OK' }]
            );
            return;
          }

          console.log('✅ [Dashboard] Enhanced verification passed - HealthKit fully ready for queries');

        } catch (iosError) {
          // Handle any iOS HealthKit errors gracefully
          console.error('❌ [Dashboard] iOS HealthKit error:', iosError);
          const errorMessage = isSimulator
            ? 'HealthKit is not available on iOS Simulator. Please use a real iOS device.'
            : 'Failed to request HealthKit permissions. Please try again.';
          Alert.alert('Error', errorMessage);
        }

        return;
      }

      // ==========================================
      // Android: Health Connect Permission Flow
      // ==========================================
      console.log('🤖 [Dashboard] ========================================');
      console.log('🤖 [Dashboard] Starting Android Permission Grant Flow');
      console.log('🤖 [Dashboard] ========================================');

      // ✅ STAGE 1: Request permissions through centralized manager
      console.log('📋 [Dashboard] Stage 1: Requesting permissions...');
      const permissionStartTime = Date.now();

      await healthConnectManager.requestPermissions([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'TotalCaloriesBurned' },
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'read', recordType: 'Distance' },
        { accessType: 'read', recordType: 'FloorsClimbed' },
        { accessType: 'read', recordType: 'BackgroundAccessPermission' },
      ]);

      const permissionDuration = Date.now() - permissionStartTime;
      console.log(`✅ [Dashboard] Stage 1 complete (${permissionDuration}ms) - User granted permissions`);

      // ✅ STAGE 2: Wait for manager cache to update
      console.log('⏳ [Dashboard] Stage 2: Waiting for cache propagation (200ms)...');
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('✅ [Dashboard] Stage 2 complete - Cache updated');

      // ✅ STAGE 3: Force hooks to re-check permissions
      console.log('🔄 [Dashboard] Stage 3: Notifying hooks of permission change...');
      setPermissionVersion(prev => prev + 1); // This triggers useEffect in hooks

      // Wait for React state update to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('✅ [Dashboard] Stage 3 complete - Hooks notified');

      // ✅ STAGE 4: Explicitly trigger permission sync on hooks
      console.log('🔍 [Dashboard] Stage 4: Syncing hook permission states...');

      // Force permission check on each hook that exposes syncPermissions
      const syncPromises = [];

      if (weeklyStepsHook && 'syncPermissions' in weeklyStepsHook &&
          typeof weeklyStepsHook.syncPermissions === 'function') {
        console.log('  → Syncing useWeeklySteps permissions...');
        syncPromises.push(weeklyStepsHook.syncPermissions());
      }

      if (monthlyWeeksHook && 'syncPermissions' in monthlyWeeksHook &&
          typeof monthlyWeeksHook.syncPermissions === 'function') {
        console.log('  → Syncing useMonthlyWeeks permissions...');
        syncPromises.push(monthlyWeeksHook.syncPermissions());
      }

      if (yearlyMonthsHook && 'syncPermissions' in yearlyMonthsHook &&
          typeof yearlyMonthsHook.syncPermissions === 'function') {
        console.log('  → Syncing useYearlyMonths permissions...');
        syncPromises.push(yearlyMonthsHook.syncPermissions());
      }

      // Wait for all hooks to complete permission sync
      await Promise.allSettled(syncPromises);
      console.log('✅ [Dashboard] Stage 4 complete - All hooks synced');

      // ✅ STAGE 5: Wait for hook state updates to propagate
      console.log('⏳ [Dashboard] Stage 5: Waiting for hook state propagation (300ms)...');
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('✅ [Dashboard] Stage 5 complete - Hook states updated');

      // ✅ STAGE 6: Trigger data refresh
      console.log('📊 [Dashboard] Stage 6: Refreshing data...');
      const refreshStartTime = Date.now();

      await refresh();

      const refreshDuration = Date.now() - refreshStartTime;
      console.log(`✅ [Dashboard] Stage 6 complete (${refreshDuration}ms) - Data refreshed`);

      // ✅ STAGE 7: User feedback
      console.log('🎉 [Dashboard] Stage 7: Showing success feedback...');
      showToast('✓ Health permissions granted');
      showBanner();

      const totalDuration = Date.now() - permissionStartTime;
      console.log('🤖 [Dashboard] ========================================');
      console.log(`🤖 [Dashboard] Permission flow complete! (${totalDuration}ms total)`);
      console.log('🤖 [Dashboard] ========================================');

      permissionRequestInProgress = false;

    } catch (error) {
      console.error('❌ [Dashboard] ========================================');
      console.error('❌ [Dashboard] Permission Grant Flow Failed');
      console.error('❌ [Dashboard] ========================================');
      console.error('❌ [Dashboard] Error:', error);
      console.error('❌ [Dashboard] ========================================');

      permissionRequestInProgress = false;

      // ✅ PROFESSIONAL: Provide helpful error feedback
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('not installed') || errorMessage.includes('unavailable')) {
        Alert.alert(
          'Health Connect Not Available',
          'Health Connect is required but not available on this device. Please ensure:\n\n' +
          '• Health Connect is installed (Android 14+ has it built-in)\n' +
          '• Your device supports Health Connect\n' +
          '• Health Connect is up to date',
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Learn More',
              onPress: () => {
                Linking.openURL('https://health.google/health-connect-android/');
              }
            }
          ]
        );
      } else if (errorMessage.includes('denied') || errorMessage.includes('permission')) {
        Alert.alert(
          'Permissions Required',
          'Health permissions are required to track your steps and health data. Please grant permissions to continue.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Permission Request Failed',
          `An error occurred while requesting permissions: ${errorMessage}\n\nPlease try again or restart the app.`,
          [{ text: 'OK' }]
        );
      }

      // Show error toast
      showToast('✗ Failed to grant permissions');
    }
  }, [requestPermissions, refresh, showToast, showBanner, weeklyStepsHook, monthlyWeeksHook, yearlyMonthsHook]);

  // Memoized goal calculations to prevent recalculation on every render
  const goalData = useMemo(() => {
    let currentGoal: number;
    switch (period) {
      case 'today':
        currentGoal = STEPS_GOAL; // 10,000 steps per day
        break;
      case 'week':
        currentGoal = STEPS_GOAL * 7; // 70,000 steps per week
        break;
      case 'month':
        currentGoal = STEPS_GOAL * 30; // 300,000 steps per month
        break;
      default:
        currentGoal = STEPS_GOAL;
    }

    return {
      currentGoal,
      progress: steps / currentGoal,
      isGoalReached: steps >= currentGoal,
      remainingSteps: Math.max(0, currentGoal - steps),
      percentageComplete: Math.min(100, (steps / currentGoal) * 100),
    };
  }, [steps, period]);

  const { currentGoal, progress, isGoalReached, remainingSteps, percentageComplete } = goalData;

  const renderHeader = () => (
    <Animated.View style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}>
      <LinearGradient
        colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
        style={StyleSheet.absoluteFillObject}
      />
      <BlurView intensity={20} style={styles.headerContent}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.headerTitle}>Step Counter</Text>
          </View>
          <AdaptiveTouchableOpacity
            style={styles.settingsButton}
            onPress={() => safeNavigation.navigate(navigation, 'HealthSettings')}
            enableHaptics={!isLowEndDevice}
          >
            <Ionicons name="settings-outline" size={24} color={COLORS.WHITE} />
          </AdaptiveTouchableOpacity>
        </View>

        <View style={styles.dateContainer}>
          <AdaptiveTouchableOpacity
            onPress={() => changeDate(-1)}
            style={styles.dateButton}
            enableHaptics={!isLowEndDevice}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.WHITE} />
          </AdaptiveTouchableOpacity>

          <Text style={styles.dateText}>{date.toDateString()}</Text>

          <AdaptiveTouchableOpacity
            onPress={() => changeDate(1)}
            style={styles.dateButton}
            enableHaptics={!isLowEndDevice}
          >
            <Ionicons name="chevron-forward" size={20} color={COLORS.WHITE} />
          </AdaptiveTouchableOpacity>
        </View>
      </BlurView>
    </Animated.View>
  );

  // ✅ CRASH-SAFE: Memoized chart data with comprehensive null guards
  const chartData = useMemo<ChartDataPoint[]>(() => {
    // ✅ CRITICAL: Check array existence before mapping to prevent crashes
    if (period === 'today') {
      // Transform weekly data for daily view
      if (!Array.isArray(weeklyData) || weeklyData.length === 0) return [];
      return weeklyData.map(day => ({
        value: day?.steps || 0,
        label: day?.dayName || '',
        isCurrent: day?.isToday || false,
        isFuture: day?.isFuture || false,
      }));
    } else if (period === 'week') {
      // Transform monthly data for weekly view
      if (!Array.isArray(monthlyData) || monthlyData.length === 0) return [];
      return monthlyData.map(week => ({
        value: week?.steps || 0,
        label: week?.label ? week.label.replace('Week ', '') : '',
        isCurrent: week?.isCurrentWeek || false,
        isFuture: week?.isFuture || false,
      }));
    } else if (period === 'month') {
      // Transform yearly data for monthly view
      if (!Array.isArray(yearlyData) || yearlyData.length === 0) return [];
      return yearlyData.map(month => ({
        value: month?.steps || 0,
        label: month?.label || '',
        isCurrent: month?.isCurrentMonth || false,
        isFuture: month?.isFuture || false,
      }));
    }
    return [];
  }, [period, weeklyData, monthlyData, yearlyData]);

  const renderChart = () => {
    if (chartData.length === 0) {
      return null;
    }
    return <UnifiedStepsChart data={chartData} />;
  };

  // Memoized period text
  const periodText = useMemo(() => {
    switch (period) {
      case 'today':
        return 'today';
      case 'week':
        return 'this week';
      case 'month':
        return 'this month';
      default:
        return 'today';
    }
  }, [period]);

  const renderPeriodFilter = () => (
    <View style={styles.periodFilterSection}>
      <View style={styles.periodFilterContainer}>
        <AdaptiveTouchableOpacity
          style={[
            styles.periodButton,
            period === 'today' && styles.periodButtonActive,
            isLowEndDevice && styles.periodButtonSimple,
          ]}
          onPress={() => handlePeriodChange('today')}
          enableHaptics={!isLowEndDevice}
        >
          <Text
            style={[styles.periodButtonText, period === 'today' && styles.periodButtonTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            Today
          </Text>
        </AdaptiveTouchableOpacity>

        <AdaptiveTouchableOpacity
          style={[
            styles.periodButton,
            period === 'week' && styles.periodButtonActive,
            isLowEndDevice && styles.periodButtonSimple,
          ]}
          onPress={() => handlePeriodChange('week')}
          enableHaptics={!isLowEndDevice}
        >
          <Text
            style={[styles.periodButtonText, period === 'week' && styles.periodButtonTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            This week
          </Text>
        </AdaptiveTouchableOpacity>

        <AdaptiveTouchableOpacity
          style={[
            styles.periodButton,
            period === 'month' && styles.periodButtonActive,
            isLowEndDevice && styles.periodButtonSimple,
          ]}
          onPress={() => handlePeriodChange('month')}
          enableHaptics={!isLowEndDevice}
        >
          <Text
            style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            This month
          </Text>
        </AdaptiveTouchableOpacity>
      </View>
    </View>
  );

  const renderTitleAndStats = () => {
    // ✅ PROFESSIONAL: Check authorization to show proper placeholder (like iOS)
    // Android Health Connect: hasPermissions is reliable (unlike iOS HealthKit)
    const isAuthorized = hasPermissions;
    const stepDisplay = isAuthorized ? steps.toLocaleString() : '--';

    return (
      <View style={styles.titleAndStatsSection}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>
            You have taken{' '}
            <Text style={[styles.titleNumber, !isAuthorized && styles.titleNumberLocked]}>
              {stepDisplay}
            </Text>{' '}
            steps {periodText}
          </Text>
          {!isAuthorized && (
            <Text style={styles.permissionHint}>
              Tap cards below to enable health tracking
            </Text>
          )}
        </View>
      </View>
    );
  };

  // 📊 NEW: Individual stat cards (like iOS) with professional locked state
  const renderStats = () => {
    // ✅ PROFESSIONAL: Check authorization status to show appropriate UI
    // For Android: hasPermissions indicates if Health Connect permissions are granted
    const isAuthorized = hasPermissions;

    return (
      <View style={styles.statsCardsContainer}>
        {/* Calories Card */}
        <TouchableOpacity
          style={[
            styles.statCard,
            !isAuthorized && styles.statCardLocked,
          ]}
          onPress={!isAuthorized ? requestAllHealthPermissions : undefined}
          activeOpacity={!isAuthorized ? 0.7 : 1}
          disabled={isAuthorized}
        >
          <View style={styles.statCardHeader}>
            <Ionicons name="water" size={32} color="#4ECDC4" />
            <Text style={styles.statCardLabel}>Calories</Text>
            {!isAuthorized && (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.6)" />
              </View>
            )}
          </View>
          <Text style={[styles.statCardValue, !isAuthorized && styles.statCardValueLocked]}>
            {isAuthorized ? calories.toFixed(0) : '--'}
          </Text>
          <Text style={styles.statCardUnit}>
            {isAuthorized ? 'kcal burned' : 'Tap to enable'}
          </Text>
        </TouchableOpacity>

        {/* Heart Rate Card */}
        <TouchableOpacity
          style={[
            styles.statCard,
            !isAuthorized && styles.statCardLocked,
          ]}
          onPress={!isAuthorized ? requestAllHealthPermissions : undefined}
          activeOpacity={!isAuthorized ? 0.7 : 1}
          disabled={isAuthorized}
        >
          <View style={styles.statCardHeader}>
            <Ionicons name="heart" size={32} color="#FF6B9D" />
            <Text style={styles.statCardLabel}>Heart Rate</Text>
            {!isAuthorized && (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.6)" />
              </View>
            )}
          </View>
          <Text style={[styles.statCardValue, !isAuthorized && styles.statCardValueLocked]}>
            {isAuthorized ? (heartRate !== null ? heartRate.toFixed(0) : '--') : '--'}
          </Text>
          <Text style={styles.statCardUnit}>
            {isAuthorized ? 'bpm' : 'Tap to enable'}
          </Text>
        </TouchableOpacity>

        {/* Activity Time Card */}
        <TouchableOpacity
          style={[
            styles.statCard,
            !isAuthorized && styles.statCardLocked,
          ]}
          onPress={!isAuthorized ? requestAllHealthPermissions : undefined}
          activeOpacity={!isAuthorized ? 0.7 : 1}
          disabled={isAuthorized}
        >
          <View style={styles.statCardHeader}>
            <Ionicons name="time" size={32} color="#FFD93D" />
            <Text style={styles.statCardLabel}>Activity</Text>
            {!isAuthorized && (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.6)" />
              </View>
            )}
          </View>
          <Text style={[styles.statCardValue, !isAuthorized && styles.statCardValueLocked]}>
            {isAuthorized ? (period === 'month' ? activeHours.toFixed(0) : activeMinutes.toFixed(0)) : '--'}
          </Text>
          <Text style={styles.statCardUnit}>
            {isAuthorized ? (period === 'month' ? 'hours' : 'minutes') : 'Tap to enable'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ✅ CRASH-SAFE: Memoized most steps data with array existence checks
  const mostStepsData = useMemo(() => {
    let maxPeriodLabel = '';
    let maxSteps = 0;

    // ✅ CRITICAL: Check array existence and type before accessing
    if (period === 'today' && Array.isArray(weeklyData) && weeklyData.length > 0) {
      const filteredData = weeklyData.filter(d => d && !d.isFuture);
      if (filteredData.length > 0) {
        const maxDay = filteredData.reduce(
          (max, day) => ((day?.steps || 0) > (max?.steps || 0) ? day : max),
          filteredData[0]
        );
        maxPeriodLabel = `${maxDay?.dayName || ''}\n${maxDay?.dayNumber || ''}`;
        maxSteps = maxDay?.steps || 0;
      }
    } else if (period === 'week' && Array.isArray(monthlyData) && monthlyData.length > 0) {
      const filteredData = monthlyData.filter(w => w && !w.isFuture);
      if (filteredData.length > 0) {
        const maxWeek = filteredData.reduce(
          (max, week) => ((week?.steps || 0) > (max?.steps || 0) ? week : max),
          filteredData[0]
        );
        maxPeriodLabel = `week\n${String(maxWeek?.weekNumber || 0).padStart(2, '0')}`;
        maxSteps = maxWeek?.steps || 0;
      }
    } else if (period === 'month' && Array.isArray(yearlyData) && yearlyData.length > 0) {
      const filteredData = yearlyData.filter(m => m && !m.isFuture);
      if (filteredData.length > 0) {
        const maxMonth = filteredData.reduce(
          (max, month) => ((month?.steps || 0) > (max?.steps || 0) ? month : max),
          filteredData[0]
        );
        maxPeriodLabel = `${maxMonth?.label || ''}\n${maxMonth?.startDate?.getDate() || ''}`;
        maxSteps = maxMonth?.steps || 0;
      }
    }

    return { maxPeriodLabel, maxSteps };
  }, [period, weeklyData, monthlyData, yearlyData]);

  const renderMostStepsCard = () => {
    const { maxPeriodLabel, maxSteps } = mostStepsData;

    if (!maxSteps) return null;

    return (
      <AdaptiveAnimatedView
        animationType={isLowEndDevice ? 'none' : 'fadeIn'}
        style={[styles.mostStepsCard, ...(isLowEndDevice ? [styles.mostStepsCardSimple] : [])]}
      >
        <View style={styles.mostStepsContent}>
          <View style={styles.mostStepsDate}>
            <Text style={styles.mostStepsDateText}>{maxPeriodLabel}</Text>
          </View>
          <View style={styles.mostStepsInfo}>
            <Text style={styles.mostStepsTitle}>Most steps taken</Text>
            <Text style={styles.mostStepsValue}>{maxSteps.toLocaleString()}</Text>
          </View>
          <View style={styles.mostStepsCurve}>
            <Ionicons name="footsteps" size={24} color={COLORS.PRIMARY} />
          </View>
        </View>
      </AdaptiveAnimatedView>
    );
  };

  const renderPermissionPrompt = () => {
    const isAndroid = Platform.OS === 'android';
    const androidVersion = Platform.Version as number; // Get Android version for version-specific messaging
    const isAndroid14Plus = isAndroid && androidVersion >= 34; // Android 14+ has system Health Connect
    let showOpenSettings = isAndroid && !!openSettings;

    // DEFENSIVE: Safely access androidData with null checks and type safety
    const safeAndroidData: any = androidData || {};
    const androidStatus = safeAndroidData?.sdkStatus;
    const isHealthConnectAvailable = safeAndroidData?.isHealthConnectAvailable ?? false;
    const isInitialized = safeAndroidData?.isInitialized ?? false;
    const isInitializing = safeAndroidData?.isInitializing ?? false;

    let titleText = 'Enable Step Tracking';
    let subtitleText =
      'Allow access to your health data to track your daily steps and reach your fitness goals.';
    let buttonText = 'Enable Health Access';
    let showInstallButton = false;
    let showRestartButton = false;
    let isButtonDisabled = false;

    if (error) {
      const errorLower = typeof error === 'string' ? error.toLowerCase() : '';

      if (errorLower.includes('not installed') || errorLower.includes('install it from')) {
        if (isAndroid14Plus) {
          // Android 14+ has system Health Connect - installation message doesn't make sense
          titleText = 'Health Connect Unavailable';
          subtitleText =
            'Health Connect is part of Android 14+ but appears to be disabled or corrupted. Please check your system settings or contact device support.';
          buttonText = 'Open System Settings';
          showOpenSettings = true;
        } else {
          // Android 10-13 needs Health Connect app
          titleText = 'Health Connect Not Installed';
          subtitleText =
            'Health Connect is required for step tracking on Android. Please install it from Google Play Store to continue.';
          buttonText = 'Open Play Store';
          showInstallButton = true;
        }
      } else if (
        errorLower.includes('lateinit') ||
        errorLower.includes('delegate') ||
        errorLower.includes('restart')
      ) {
        titleText = 'App Restart Required';
        subtitleText =
          'Health Connect needs to be properly initialized. Please close and reopen the app to continue.';
        buttonText = 'Restart App';
        showRestartButton = true;
      } else if (
        errorLower.includes('not granted') ||
        (errorLower.includes('permission') && errorLower.includes('denied'))
      ) {
        titleText = 'Permission Required';
        subtitleText =
          'We need your permission to read step data from Health Connect. Your health data stays private and secure on your device.';
        buttonText = 'Grant Permission';
      } else if (errorLower.includes('timeout')) {
        titleText = 'Request Timed Out';
        subtitleText = 'The permission request took too long. Please try again.';
        buttonText = 'Try Again';
      } else if (
        errorLower.includes('initialization failed') ||
        errorLower.includes('setup issue')
      ) {
        titleText = 'Setup Issue';
        subtitleText =
          'There was an issue setting up Health Connect. Please try restarting the app.';
        buttonText = 'Retry Setup';
      } else if (errorLower.includes('sdk check failed') || errorLower.includes('unavailable')) {
        titleText = 'Health Connect Unavailable';
        if (isAndroid14Plus) {
          subtitleText =
            "Could not connect to Health Connect. On Android 14+, it's part of the system. Try restarting your device or checking system updates.";
          buttonText = 'Open System Settings';
        } else {
          subtitleText =
            "Could not connect to Health Connect. Make sure it's installed and updated from Google Play Store.";
          buttonText = 'Check Installation';
        }
      } else if (errorLower.includes('update') || errorLower.includes('provider update required')) {
        titleText = 'Health Connect Update Required';
        if (isAndroid14Plus) {
          subtitleText =
            "Health Connect needs to be updated. On Android 14+, this is usually part of system updates. Please check for system updates.";
          buttonText = 'Check System Updates';
        } else {
          subtitleText =
            "Health Connect needs to be updated. Please update it from Google Play Store.";
          buttonText = 'Open Play Store';
          showInstallButton = true;
        }
      } else {
        titleText = 'Setup Issue';
        subtitleText = error;
        buttonText = 'Retry Setup';
      }
    }

    // Note: Removed isInitializing check - simplified implementation

    const handleInstallHealthConnect = () => {
      // Open Play Store to install Health Connect (fallback to web if Play Store not available)
      const playStoreUrl = 'market://details?id=com.google.android.apps.healthdata';
      const webUrl = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
      Linking.openURL(playStoreUrl).catch(() => Linking.openURL(webUrl));
    };

    const handleRestartApp = () => {
      // For now, just show a message - in a real app you might use a restart library
      console.log('App restart requested - implement restart logic');
      // You could use react-native-restart or similar library here
    };

    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="fitness-outline" size={64} color={COLORS.PRIMARY} />
        <Text style={styles.permissionTitle}>{titleText}</Text>
        <Text style={styles.permissionSubtext}>{subtitleText}</Text>

        <AdaptiveTouchableOpacity
          style={[
            styles.permissionButton,
            isLowEndDevice && styles.permissionButtonSimple,
            isButtonDisabled && styles.permissionButtonDisabled,
          ]}
          onPress={
            showInstallButton
              ? handleInstallHealthConnect
              : showRestartButton
                ? handleRestartApp
                : requestAllHealthPermissions // ✅ FIXED: Use unified permission request
          }
          enableHaptics={!isLowEndDevice && !isButtonDisabled}
          disabled={isButtonDisabled}
        >
          <Ionicons
            name={
              showInstallButton
                ? 'download-outline'
                : showRestartButton
                  ? 'refresh-outline'
                  : 'shield-checkmark'
            }
            size={20}
            color={COLORS.WHITE}
          />
          <Text style={styles.permissionButtonText}>{buttonText}</Text>
        </AdaptiveTouchableOpacity>

        {showOpenSettings &&
          openSettings &&
          typeof openSettings === 'function' &&
          !showInstallButton && (
            <AdaptiveTouchableOpacity
              style={[styles.secondaryButton, isLowEndDevice && styles.secondaryButtonSimple]}
              onPress={openSettings as () => void}
              enableHaptics={!isLowEndDevice}
            >
              <Ionicons name="settings-outline" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.secondaryButtonText}>Open Health Connect Settings</Text>
            </AdaptiveTouchableOpacity>
          )}

        {__DEV__ && isAndroid && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugContainerText}>
              SDK Status: {JSON.stringify(androidStatus)} | Available:{' '}
              {String(isHealthConnectAvailable)}
            </Text>
            <Text style={styles.debugContainerText}>
              Initialized: {String(isInitialized)} | Initializing: false (simplified)
            </Text>
            <Text style={styles.debugContainerText}>
              Fixed Hook: ✅ Using simplified permission handling
            </Text>
            {error && <Text style={styles.debugContainerText}>Error: {error}</Text>}
          </View>
        )}
      </View>
    );
  };

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="warning-outline" size={64} color={COLORS.ERROR} />
      <Text style={styles.errorTitle}>Unable to Load Step Data</Text>
      <Text style={styles.errorSubtext}>{error}</Text>

      <AdaptiveTouchableOpacity
        style={[styles.retryButton, isLowEndDevice && styles.retryButtonSimple]}
        onPress={requestAllHealthPermissions} // ✅ FIXED: Use unified permission request
        enableHaptics={!isLowEndDevice}
      >
        <Ionicons name="refresh" size={20} color={COLORS.PRIMARY} />
        <Text style={styles.retryButtonText}>Try Again</Text>
      </AdaptiveTouchableOpacity>
    </View>
  );

  // 🔔 Render: Notification Banner (like iOS)
  const renderRefreshBanner = () => {
    if (!showRefreshBanner) return null;

    return (
      <Animated.View
        style={[
          styles.refreshBanner,
          {
            opacity: bannerOpacity,
            transform: [
              {
                translateY: bannerOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-100, 0],
                }),
              },
            ],
          },
        ]}
      >
        <BlurView intensity={80} tint="dark" style={styles.bannerBlur}>
          <View style={styles.bannerContent}>
            <View style={styles.bannerIcon}>
              <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
            </View>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>Permissions Granted!</Text>
              <Text style={styles.bannerSubtitle}>Pull down to refresh your health data</Text>
            </View>
            <TouchableOpacity
              onPress={dismissBanner}
              style={styles.bannerDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>
    );
  };

  // 🔔 Render: Toast Notification (like iOS)
  const renderToast = () => {
    if (!toastMessage) return null;

    return (
      <Animated.View
        style={[
          styles.toast,
          {
            opacity: toastOpacity,
            transform: [
              {
                translateY: toastOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <BlurView intensity={90} tint="dark" style={styles.toastBlur}>
          <Ionicons name="checkmark-circle" size={20} color="#4ECDC4" style={styles.toastIcon} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </BlurView>
      </Animated.View>
    );
  };

  // ✅ CRITICAL FIX REMOVED: The lazy permission check that was causing crashes
  // With the new centralized HealthConnectManager, all permission checks are queued
  // and handled safely. We no longer need this dashboard-level permission check.
  // The hooks themselves (useStepCounter, useActiveTime, useCalories) now handle
  // permissions internally using the manager, preventing concurrent API calls.

  // ✅ CRITICAL FIX: Show permission prompt when permissions are not granted
  // This ensures users can actually grant permissions when needed

  // 🔍 REAL-DEVICE DEBUG: Log render decision state
  if (__DEV__ && Platform.OS === 'ios') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
    console.log(`[${timestamp}] 🎨 [Dashboard] Render decision:`, {
      stepCounterResult: !!stepCounterResult,
      hasPermissions,
      isLoading,
      error: error || 'none',
      steps,
      decision: !stepCounterResult && isLoading
        ? 'LOADING_SCREEN'
        : !stepCounterResult
          ? 'PERMISSION_PROMPT_NO_HOOK'
          : !hasPermissions && !error && !isLoading
            ? 'PERMISSION_PROMPT_NO_PERMS'
            : error
              ? 'ERROR_STATE'
              : 'DATA_VIEW',
    });
  }

  // Handle hook initialization failure
  if (!stepCounterResult) {
    if (isLoading) {
      // Still loading initial setup, don't show permission screen yet
      if (__DEV__) {
        console.log('⏳ [Dashboard] Hook still initializing, showing loading screen');
      }
      return (
        <HealthDashboardErrorBoundary>
          <View style={styles.container}>
            <LinearGradient
              colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionSubtext}>Loading...</Text>
            </View>
          </View>
        </HealthDashboardErrorBoundary>
      );
    }
    // Hook failed to initialize - show permission screen
    if (__DEV__) {
      console.warn('⚠️ [Dashboard] Hook failed to initialize, showing permission prompt');
    }
    return (
      <HealthDashboardErrorBoundary>
        <View style={styles.container}>
          <LinearGradient
            colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
            style={StyleSheet.absoluteFillObject}
          />
          {renderPermissionPrompt()}
        </View>
      </HealthDashboardErrorBoundary>
    );
  }

  // ✅ CRITICAL FIX: Show permission prompt when permissions are not granted
  // This allows users to grant permissions and start seeing data
  if (!hasPermissions && !error && !isLoading) {
    if (__DEV__) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      console.log(`[${timestamp}] 🔐 [Dashboard] No permissions granted, showing permission prompt`);
    }
    return (
      <HealthDashboardErrorBoundary>
        <View style={styles.container}>{renderPermissionPrompt()}</View>
      </HealthDashboardErrorBoundary>
    );
  }

  if (error) {
    return (
      <HealthDashboardErrorBoundary>
        <View style={styles.container}>
          <LinearGradient
            colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
            style={StyleSheet.absoluteFillObject}
          />
          {renderErrorState()}
        </View>
      </HealthDashboardErrorBoundary>
    );
  }

  return (
    <HealthDashboardErrorBoundary>
      <PerformanceMonitor>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
            style={StyleSheet.absoluteFillObject}
          />
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refresh}
                tintColor={COLORS.PRIMARY}
                colors={[COLORS.PRIMARY]}
              />
            }
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            scrollEventThrottle={16}
          >
            {renderPeriodFilter()}
            {renderTitleAndStats()}
            {renderChart()}
            {renderStats()}
            {renderMostStepsCard()}
          </ScrollView>

          {/* 🔔 Notification Banner (appears after permission grant) - NEW like iOS */}
          {renderRefreshBanner()}

          {/* 🔔 Toast Notification - NEW like iOS */}
          {renderToast()}

          {/* ✅ ENHANCED DEBUG MENU: Multi-option debug (like iOS) */}
          {/* <TouchableOpacity
            style={{
              position: 'absolute',
              bottom: 100,
              right: 20,
              width: 56,
              height: 56,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: 28,
              borderWidth: 2,
              borderColor: steps > 0 ? '#10B981' : '#EF4444',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
            onPress={() => {
              const dataSnapshot = {
                platform: Platform.OS,
                steps,
                hasPermissions,
                error: error || null,
                period,
                heartRate,
                calories,
                activeMinutes,
                activeHours,
                weeklyLength: weeklyData?.length ?? 0,
                monthlyLength: monthlyData?.length ?? 0,
                yearlyLength: yearlyData?.length ?? 0,
                weeklySample: weeklyData?.[0] || null,
                monthlySample: monthlyData?.[0] || null,
                yearlySample: yearlyData?.[0] || null,
                isLoading,
                isWeeklyLoading,
                isMonthlyLoading,
                isYearlyLoading,
                chartDataLength: chartData.length,
              };

              // 📊 Enhanced Debug Menu (like iOS)
              const todayData = weeklyData?.find(d => d?.isToday);
              const weeklyBreakdown = weeklyData?.map(d =>
                `${d?.dayName} ${d?.dayNumber}: ${d?.steps} steps${d?.isToday ? ' ← TODAY' : ''}`
              ).join('\n') || 'No data';

              Alert.alert(
                '🔍 Health Connect Debug Menu',
                `Chart Hook Status:\n` +
                `weeklyData: ${weeklyData?.length || 0} items\n` +
                `monthlyData: ${monthlyData?.length || 0} items\n` +
                `yearlyData: ${yearlyData?.length || 0} items\n` +
                `chartData: ${chartData.length} items\n` +
                `period: ${period}\n\n` +
                `📅 This Week (Mon-Sun):\n${weeklyBreakdown}\n\n` +
                `📊 Today's Data:\n${JSON.stringify(todayData || 'none', null, 2)}\n\n` +
                'Choose an action:',
                [
                  {
                    text: '📊 View Full Debug Info',
                    onPress: () => {
                      Alert.alert(
                        '🔍 Health Connect Debug Info',
                        JSON.stringify(dataSnapshot, null, 2),
                        [{ text: 'OK' }]
                      );
                    },
                  },
                  {
                    text: '🔄 Refresh Data',
                    onPress: refresh,
                  },
                  {
                    text: '📋 View Permissions',
                    onPress: () => {
                      Alert.alert(
                        '🔐 Permission Status',
                        `Has Permissions: ${hasPermissions}\n` +
                        `Platform: ${Platform.OS}\n` +
                        `Error: ${error || 'None'}\n\n` +
                        `Android Specific:\n` +
                        `SDK Status: ${androidStatus || 'N/A'}\n` +
                        `Health Connect Available: ${isHealthConnectAvailable}\n` +
                        `Initialized: ${isInitialized}`,
                        [{ text: 'OK' }]
                      );
                    },
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                ]
              );
            }}
          >
            <Text style={{ fontSize: 28, marginBottom: 2 }}>📊</Text>
            <Text style={{ fontSize: 8, color: 'white', fontWeight: 'bold' }}>DEBUG</Text>
          </TouchableOpacity> */}
        </Animated.View>
      </PerformanceMonitor>
    </HealthDashboardErrorBoundary>
  );
};

// Helper functions
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.XXL,
  },
  header: {
    overflow: 'hidden',
    borderBottomLeftRadius: BORDER_RADIUS.XL,
    borderBottomRightRadius: BORDER_RADIUS.XL,
  },
  headerContent: {
    flex: 1,
    padding: SPACING.LG,
    paddingTop: IS_IOS ? SPACING.XXL + 20 : SPACING.XL,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.MD,
  },
  greeting: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: SPACING.XS,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.MD,
  },
  dateButton: {
    padding: SPACING.SM,
  },
  dateText: {
    color: COLORS.WHITE,
    fontWeight: '500',
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    marginHorizontal: SPACING.MD,
  },
  chartSection: {
    marginTop: SPACING.MD,
  },
  statsSection: {
    padding: SPACING.LG,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.LG,
  },
  congratsCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.LG,
    alignItems: 'center',
    marginBottom: SPACING.MD,
    ...SHADOWS.MEDIUM,
  },
  congratsText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.SM,
  },
  congratsSubtext: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.XS,
    textAlign: 'center',
  },
  motivationCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.LG,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.MEDIUM,
  },
  motivationText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_PRIMARY,
    marginLeft: SPACING.SM,
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XL,
    marginTop: SPACING.XXL,
  },
  permissionTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.LG,
    textAlign: 'center',
  },
  permissionSubtext: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.SM,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: SPACING.LG,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.XL,
    borderRadius: BORDER_RADIUS.MD,
    marginTop: SPACING.XL,
    gap: SPACING.SM,
    ...SHADOWS.SMALL_GREEN,
  },
  permissionButtonSimple: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: BORDER_RADIUS.MD,
    shadowOpacity: 0,
    elevation: 0,
  },
  permissionButtonDisabled: {
    backgroundColor: 'rgba(74, 78, 138, 0.5)',
    opacity: 0.6,
  },
  permissionButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XL,
    marginTop: SPACING.XXL,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.LG,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.SM,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: SPACING.LG,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.XL,
    borderRadius: BORDER_RADIUS.MD,
    marginTop: SPACING.XL,
    gap: SPACING.SM,
    backgroundColor: COLORS.GLASS_BG,
    ...SHADOWS.CARD_GLASS,
  },
  retryButtonSimple: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    shadowOpacity: 0,
    elevation: 0,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    marginTop: SPACING.MD,
    gap: SPACING.SM,
    backgroundColor: COLORS.GLASS_BG,
    ...SHADOWS.CARD_GLASS,
  },
  secondaryButtonSimple: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.PRIMARY,
    fontWeight: '500',
  },
  debugContainer: {
    marginTop: SPACING.LG,
    padding: SPACING.MD,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.SM,
  },
  debugContainerText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  periodFilterSection: {
    paddingHorizontal: SPACING.MD,
    paddingTop: SPACING.XXL, // Increased from MD to XXL (48px) for proper top spacing
    paddingBottom: SPACING.MD,
  },
  periodFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.SM, // Increased from XS to SM (8px) for better spacing
    backgroundColor: 'rgba(74,78,138,0.4)', // Subtle container background
    borderRadius: BORDER_RADIUS.XL, // Rounded pill container
    padding: SPACING.XS, // Inner padding for pill effect
  },
  periodButton: {
    flex: 1,
    paddingVertical: SPACING.MD, // Increased from SM+2 to MD (16px) for taller buttons
    paddingHorizontal: SPACING.MD, // Increased horizontal padding
    borderRadius: BORDER_RADIUS.XL, // Increased from MD to XL (16px) for more rounded corners
    backgroundColor: 'rgba(74,78,138,0.5)', // Muted purple/blue for inactive state
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER_LIGHT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    ...SHADOWS.CARD_GLASS,
  },
  periodButtonActive: {
    backgroundColor: '#4ECDC4', // Bright teal for active state (matches expected design)
    borderColor: 'transparent',
  },
  periodButtonSimple: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    shadowOpacity: 0,
    elevation: 0,
  },
  periodButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE, // Increased from SM to BASE (16px) for better readability
    color: 'rgba(255, 255, 255, 0.7)', // Slightly more muted for inactive
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3, // Better letter spacing for premium feel
  },
  periodButtonTextActive: {
    color: COLORS.WHITE,
    fontWeight: '600',
    letterSpacing: 0.5, // Slightly more spacing for active state
  },
  // Liquid Glass Styles
  liquidGlassCard: {
    borderRadius: BORDER_RADIUS.XL,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    ...SHADOWS.MEDIUM,
  },
  titleAndStatsSection: {
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.LG,
    paddingBottom: SPACING.MD,
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: '400',
    color: COLORS.WHITE,
    textAlign: 'center',
    lineHeight: 32,
  },
  titleNumber: {
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
  },
  // 🔒 PROFESSIONAL: Locked title number (when permissions denied) - unified with iOS
  titleNumberLocked: {
    color: 'rgba(255, 255, 255, 0.5)', // Dimmed
    fontStyle: 'italic', // Visual indicator
  },
  permissionHint: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: SPACING.SM,
    fontStyle: 'italic',
  },
  // 📊 NEW: Individual stat cards styles (like iOS)
  statsCardsContainer: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    gap: SPACING.MD,
  },
  statCard: {
    backgroundColor: 'rgba(74, 78, 138, 0.5)',
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.LG,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...SHADOWS.SMALL_GREEN,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginBottom: SPACING.SM,
  },
  statCardLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statCardValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    marginVertical: SPACING.XS,
  },
  statCardUnit: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  // 🔒 PROFESSIONAL: Locked stat card styles (missing authorization) - like iOS
  statCardLocked: {
    backgroundColor: 'rgba(74, 78, 138, 0.3)', // More transparent
    borderColor: 'rgba(255, 193, 7, 0.4)', // Amber/warning border
    borderWidth: 1.5,
    opacity: 0.85, // Slightly dimmed
  },
  statCardValueLocked: {
    color: 'rgba(255, 255, 255, 0.5)', // Dimmed text
    fontStyle: 'italic', // Visual indicator
  },
  lockBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255, 193, 7, 0.2)', // Amber background
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS / 2,
    borderRadius: BORDER_RADIUS.SM,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // OLD: Inline stats row (keeping for reference, can be removed later)
  statsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    marginVertical: SPACING.LG,
  },
  statItemInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.XS,
  },
  statValueInline: {
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginLeft: SPACING.XS,
  },
  statUnitInline: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    marginVertical: SPACING.XL,
    gap: SPACING.MD,
  },
  statIcon: {
    marginRight: SPACING.XS / 2,
  },
  statTextContainer: {
    flexDirection: 'column',
  },
  statLabelInline: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS - 1,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    marginTop: SPACING.SM,
  },
  statUnit: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: SPACING.XS,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: SPACING.XS,
    lineHeight: 16,
  },
  mostStepsCard: {
    marginHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
    backgroundColor: COLORS.GLASS_BG,
    borderRadius: BORDER_RADIUS.LG,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER_LIGHT,
    ...SHADOWS.CARD_GLASS,
  },
  mostStepsCardSimple: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowOpacity: 0,
    elevation: 0,
  },
  mostStepsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.LG,
  },
  mostStepsDate: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.MD,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.MD,
  },
  mostStepsDateText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '700',
    color: COLORS.WHITE,
    textAlign: 'center',
    lineHeight: 18,
  },
  mostStepsInfo: {
    flex: 1,
  },
  mostStepsTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: '#6B7280',
    marginBottom: SPACING.XS,
    fontWeight: '500',
  },
  mostStepsValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
  },
  mostStepsCurve: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.SM,
    backgroundColor: 'rgba(45, 226, 179, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Debug Panel Styles
  debugToggleButton: {
    position: 'absolute',
    bottom: SPACING.XL,
    right: SPACING.LG,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.LARGE,
    zIndex: 1000,
  },
  debugPanel: {
    position: 'absolute',
    bottom: SPACING.XL + 70,
    left: SPACING.LG,
    right: SPACING.LG,
    maxHeight: '70%',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: BORDER_RADIUS.LG,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    ...SHADOWS.LARGE,
    zIndex: 999,
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  debugTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  debugHeaderActions: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  debugCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: BORDER_RADIUS.SM,
  },
  debugCopyButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  debugCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  debugContent: {
    maxHeight: 400,
    padding: SPACING.MD,
  },
  debugSection: {
    marginBottom: SPACING.MD,
    paddingBottom: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  debugSectionTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginBottom: SPACING.SM,
  },
  debugPanelText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.WHITE,
    marginBottom: SPACING.XS,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  debugSuccess: {
    color: '#4ADE80',
  },
  debugWarning: {
    color: '#FBBF24',
  },
  debugError: {
    color: '#F87171',
  },
  debugTimestamp: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // 🔔 NEW: Notification Banner Styles (like iOS)
  refreshBanner: {
    position: 'absolute',
    top: 60,
    left: SPACING.MD,
    right: SPACING.MD,
    zIndex: 1000,
  },
  bannerBlur: {
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
    gap: SPACING.SM,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  bannerDismiss: {
    padding: SPACING.XS,
  },
  // 🔔 NEW: Toast Styles (like iOS)
  toast: {
    position: 'absolute',
    bottom: 120,
    left: SPACING.MD,
    right: SPACING.MD,
    zIndex: 1000,
  },
  toastBlur: {
    borderRadius: BORDER_RADIUS.MD,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    gap: SPACING.SM,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  toastIcon: {
    marginRight: SPACING.XS,
  },
  toastText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});

export default SimpleStepsDashboard;
