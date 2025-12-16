/**
 * SimpleStepsDashboard - iOS Only (Simplified)
 *
 * Following EXACT patterns from @kingstinct/react-native-healthkit official examples
 * Reference: react-native-healthkit-master/apps/example
 *
 * Key Simplifications:
 * 1. Direct API calls (no custom hooks)
 * 2. Simple promise-based queries
 * 3. No delays or workarounds
 * 4. No Android code
 * 5. Single responsibility per component
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Animated,
  ScrollView,
  Alert,
  AppState,
  type AppStateStatus,
  Linking,
} from 'react-native';

// ✅ OFFICIAL PATTERN: Direct imports from library
import {
  isHealthDataAvailable,
  requestAuthorization,
  getRequestStatusForAuthorization,
  AuthorizationRequestStatus,
  authorizationStatusFor,
  AuthorizationStatus,
  saveQuantitySample,
  type QuantitySample,
} from '@kingstinct/react-native-healthkit';
import { QuantityTypes } from '@kingstinct/react-native-healthkit/modules';

import {
  AdaptiveTouchableOpacity,
  AdaptiveAnimatedView,
  useAdaptiveTheme,
  PerformanceMonitor,
} from '../../components/adaptive/AdaptiveComponents';
import { HealthDashboardErrorBoundary } from '../../components/health/HealthDashboardErrorBoundary';
import { UnifiedStepsChart, type ChartDataPoint } from '../../components/health/UnifiedStepsChart';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants';
import type { PeriodFilter } from '../../types/health';
import { getPeriodRange } from '../../types/health';
import { safeHaptics, safeNavigation } from '../../utils/runtimeSafety';
import { UserHealthStorage } from '../../utils/userHealthStorage';

const STEPS_GOAL = 10_000;

// ✅ OFFICIAL PATTERN: Define required permissions once
const REQUIRED_PERMISSIONS = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierHeartRate',
] as const;

// 📝 Write permissions for adding sample data (dev/testing only)
const WRITE_PERMISSIONS = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierHeartRate',
] as const;

// 🔍 Helper function to validate dates
const validateDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

interface HealthData {
  steps: number;
  calories: number;
  heartRate: number | null;
  sampleCount: number;
}

const SimpleStepsDashboard: React.FC = () => {
  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { theme, isLowEndDevice } = useAdaptiveTheme();

  const [date, setDate] = useState(new Date());
  const [period, setPeriod] = useState<PeriodFilter>('today');

  // ✅ SIMPLIFIED STATE: Single object for all health data
  const [healthData, setHealthData] = useState<HealthData>({
    steps: 0,
    calories: 0,
    heartRate: null,
    sampleCount: 0,
  });

  // 📊 Chart data state (fetched directly like healthData)
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [yearlyData, setYearlyData] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthorizationRequestStatus | null>(null);
  const [hasEverRequestedPermission, setHasEverRequestedPermission] = useState<boolean | null>(null);

  // 🔔 Notification states
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const appState = useRef(AppState.currentState);
  const [justGrantedPermission, setJustGrantedPermission] = useState(false);

  // 🔧 Stable function refs to avoid circular dependencies
  const fetchHealthDataRef = useRef<() => Promise<void>>();
  const fetchChartDataRef = useRef<() => Promise<void>>();

  // 🔐 PERMISSION TRACKING HELPERS
  // These helpers differentiate between "never asked", "dismissed without choice", and "explicitly denied"

  // 🔐 Helper: Check if CURRENT USER has ever made a permission decision (granted OR denied)
  // ✅ USER-SCOPED: Each user has their own permission state (HIPAA/GDPR compliant)
  const checkPermissionRequestHistory = useCallback(async (): Promise<boolean> => {
    try {
      const hasRequested = await UserHealthStorage.hasRequestedPermissions();
      console.log('📋 [Permission History] Current user has made a permission decision:', hasRequested);
      return hasRequested;
    } catch (error) {
      console.error('❌ [Permission History] Error checking history:', error);
      return false; // Default to false (never requested) on error
    }
  }, []);

  // 🔐 Helper: Mark that CURRENT USER has made a permission decision
  // ✅ USER-SCOPED: Only affects current user, not other users on same device
  // Only call this when user actually granted OR explicitly denied (not when dismissed)
  const markPermissionAsRequested = useCallback(async (): Promise<void> => {
    try {
      await UserHealthStorage.markPermissionsRequested();
      setHasEverRequestedPermission(true);
      console.log('✅ [Permission History] Marked that current user made a permission decision');
    } catch (error) {
      console.error('❌ [Permission History] Error saving decision state:', error);
    }
  }, []);

  // 🔔 Helper: Show toast notification
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

  // 🔔 Helper: Show refresh banner
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

  // 🔔 Helper: Dismiss banner
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

  // 🔐 BEST PRACTICE: Guide users to Settings (iOS won't re-show permission dialog)
  const showSettingsGuidance = useCallback(() => {
    Alert.alert(
      '🔐 Health Permissions Required',
      'To track your health data, please enable permissions in Settings:\n\n' +
      '1. Open Settings app\n' +
      '2. Scroll to and tap your app name\n' +
      '3. Tap "Health"\n' +
      '4. Enable "Steps", "Heart Rate", and "Active Energy"',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            // iOS will open app settings where users can navigate to Health permissions
            Linking.openSettings();
          }
        }
      ]
    );
  }, []);

  // ✅ OFFICIAL PATTERN: Check authorization status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        console.log('🔍 [HealthKit] Starting authorization check...');
        console.log('📱 [HealthKit] Platform:', Platform.OS);
        console.log('📱 [HealthKit] Platform Version:', Platform.Version);

        if (!isHealthDataAvailable()) {
          console.error('❌ [HealthKit] HealthKit is not available on this device');
          setError('HealthKit is not available on this device');
          setIsLoading(false);
          return;
        }

        console.log('✅ [HealthKit] HealthKit is available');

        // 🔐 STEP 1: Check if user has ever made a permission decision (from storage)
        const hasDecided = await checkPermissionRequestHistory();
        setHasEverRequestedPermission(hasDecided);
        console.log('📋 [HealthKit] Permission decision history:', hasDecided ? 'User has decided before' : 'First time / Dismissed before');

        console.log('🔐 [HealthKit] Checking authorization for permissions:', REQUIRED_PERMISSIONS);

        const status = await getRequestStatusForAuthorization(
          REQUIRED_PERMISSIONS,  // Check READ permissions
          REQUIRED_PERMISSIONS   // Check WRITE permissions (must match request)
        );

        console.log('📊 [HealthKit] Authorization status:', {
          statusCode: status,
          statusName: status === 0 ? 'unknown' : status === 1 ? 'shouldRequest' : status === 2 ? 'unnecessary' : 'INVALID',
          shouldRequest: status === AuthorizationRequestStatus.shouldRequest,
          // 🔥 FIX: Use 'unknown' instead of non-existent 'notDetermined'
          unknown: status === AuthorizationRequestStatus.unknown,
        });

        // 🔐 CRITICAL FIX: Check individual permission status to detect Settings changes
        // iOS HealthKit: getRequestStatusForAuthorization shows "unnecessary" even if user
        // revoked permissions in Settings. We need to check each type individually.
        console.log('🔍 [HealthKit] Checking individual permission statuses...');
        const stepsStatus = authorizationStatusFor('HKQuantityTypeIdentifierStepCount');
        const caloriesStatus = authorizationStatusFor('HKQuantityTypeIdentifierActiveEnergyBurned');
        const heartRateStatus = authorizationStatusFor('HKQuantityTypeIdentifierHeartRate');

        console.log('🔐 [HealthKit] Individual permission details:', {
          steps: {
            code: stepsStatus,
            status: stepsStatus === 0 ? 'notDetermined' : stepsStatus === 1 ? 'DENIED' : stepsStatus === 2 ? 'authorized' : 'unknown'
          },
          calories: {
            code: caloriesStatus,
            status: caloriesStatus === 0 ? 'notDetermined' : caloriesStatus === 1 ? 'DENIED' : caloriesStatus === 2 ? 'authorized' : 'unknown'
          },
          heartRate: {
            code: heartRateStatus,
            status: heartRateStatus === 0 ? 'notDetermined' : heartRateStatus === 1 ? 'DENIED' : heartRateStatus === 2 ? 'authorized' : 'unknown'
          }
        });

        // 🚨 DETECTION: If ANY permission is explicitly denied, override the general status
        const anyDenied = stepsStatus === AuthorizationStatus.sharingDenied ||
                         caloriesStatus === AuthorizationStatus.sharingDenied ||
                         heartRateStatus === AuthorizationStatus.sharingDenied;

        if (anyDenied) {
          console.warn('⚠️ [HealthKit] DETECTED: Permissions denied in Settings!');
          console.warn('⚠️ [HealthKit] Overriding status from "unnecessary" to "shouldRequest"');
          setAuthStatus(AuthorizationRequestStatus.shouldRequest);
        } else {
          setAuthStatus(status);
        }

        // 🔥 FIX: Use 'unknown' instead of 'notDetermined'
        // Also stop loading if permissions are denied in Settings
        if (status === AuthorizationRequestStatus.shouldRequest ||
            status === AuthorizationRequestStatus.unknown ||
            anyDenied) {
          console.log('⏸️ [HealthKit] Need to request permissions - stopping loading');
          setIsLoading(false);

          // 🎯 AUTO-PROMPT LOGIC: Show permission dialog automatically for true first-time users
          // Only auto-prompt if user has NEVER made a decision (granted/denied) before
          // This covers:
          // - True first-time users (never seen dialog)
          // - Users who dismissed without choosing (can be prompted again)
          // Does NOT auto-prompt if user explicitly denied before (respects their choice)
          if (!hasDecided) {
            console.log('🎬 [HealthKit] First-time user or dismissed before - auto-prompting for permissions...');
            // Small delay to ensure UI is ready
            setTimeout(() => {
              requestHealthPermissions();
            }, 500);
          } else {
            console.log('⏭️ [HealthKit] User has made a decision before - showing dashboard with locked cards');
          }
        } else {
          console.log('✅ [HealthKit] Already authorized - will fetch data');
        }
      } catch (error) {
        console.error('❌ [HealthKit] Error checking auth status:', error);
        console.error('❌ [HealthKit] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        setError(error instanceof Error ? error.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, [checkPermissionRequestHistory]);

  // ✅ OFFICIAL PATTERN: Simple request authorization function
  const requestHealthPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔐 [HealthKit] Requesting permissions...');
      console.log('📋 [HealthKit] Requesting read access for:', REQUIRED_PERMISSIONS);
      console.log('⏰ [HealthKit] Request started at:', new Date().toISOString());

      // ✅ CRITICAL FIX: Request BOTH read AND write permissions (like official example)
      // iOS will show write permissions in dialog, and grant read permissions simultaneously
      // This is the standard pattern - see react-native-healthkit/apps/example/app/auth.tsx
      await requestAuthorization(
        REQUIRED_PERMISSIONS,  // Request READ access to these types
        REQUIRED_PERMISSIONS   // Request WRITE access to same types (enables silent read grant)
      );

      console.log('✅ [HealthKit] Authorization request completed');
      console.log('⏰ [HealthKit] Request completed at:', new Date().toISOString());

      // 🔥 CRITICAL FIX #3: Wait for iOS to propagate permissions internally
      console.log('⏳ [HealthKit] Waiting 1000ms for iOS to propagate permissions...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 🎯 CORRECT APPROACH: Check INDIVIDUAL permission statuses (not overall request status)
      // getRequestStatusForAuthorization() only tells us "did we ask", NOT "did user grant"
      console.log('🔍 [HealthKit] Checking INDIVIDUAL permission statuses to detect actual grant/deny...');

      const stepsStatus = authorizationStatusFor('HKQuantityTypeIdentifierStepCount');
      const caloriesStatus = authorizationStatusFor('HKQuantityTypeIdentifierActiveEnergyBurned');
      const heartRateStatus = authorizationStatusFor('HKQuantityTypeIdentifierHeartRate');

      console.log('📊 [HealthKit] Individual permission statuses:', {
        steps: {
          code: stepsStatus,
          status: stepsStatus === 0 ? 'notDetermined' : stepsStatus === 1 ? 'DENIED' : stepsStatus === 2 ? 'AUTHORIZED' : 'unknown'
        },
        calories: {
          code: caloriesStatus,
          status: caloriesStatus === 0 ? 'notDetermined' : caloriesStatus === 1 ? 'DENIED' : caloriesStatus === 2 ? 'AUTHORIZED' : 'unknown'
        },
        heartRate: {
          code: heartRateStatus,
          status: heartRateStatus === 0 ? 'notDetermined' : heartRateStatus === 1 ? 'DENIED' : heartRateStatus === 2 ? 'AUTHORIZED' : 'unknown'
        }
      });

      // Check if ALL required permissions were granted
      const allGranted = stepsStatus === AuthorizationStatus.sharingAuthorized &&
                        caloriesStatus === AuthorizationStatus.sharingAuthorized &&
                        heartRateStatus === AuthorizationStatus.sharingAuthorized;

      // Check if ANY permission was explicitly denied
      const anyDenied = stepsStatus === AuthorizationStatus.sharingDenied ||
                       caloriesStatus === AuthorizationStatus.sharingDenied ||
                       heartRateStatus === AuthorizationStatus.sharingDenied;

      // Update overall auth status based on results
      const newStatus = allGranted
        ? AuthorizationRequestStatus.unnecessary
        : AuthorizationRequestStatus.shouldRequest;
      setAuthStatus(newStatus);

      // 🎯 SCENARIO 1: User GRANTED all permissions ✅
      if (allGranted) {
        console.log('✅ [HealthKit] ALL permissions GRANTED! User made a POSITIVE decision.');

        // Mark that user made a decision (granted)
        await markPermissionAsRequested();
        setJustGrantedPermission(true);

        // Show success toast
        showToast('✓ Health permissions granted');

        // Force immediate fetch - don't rely on useEffect timing
        try {
          if (fetchHealthDataRef.current && fetchChartDataRef.current) {
            await Promise.all([
              fetchHealthDataRef.current(),
              fetchChartDataRef.current()
            ]);
            console.log('✅ [HealthKit] Initial data fetch completed after permission grant');
          } else {
            console.warn('⚠️ [HealthKit] Fetch function refs not yet initialized');
          }

          // Show banner with pull-to-refresh hint
          showBanner();
        } catch (fetchError) {
          console.error('❌ [HealthKit] Error during initial data fetch:', fetchError);
          // Show fallback banner even if fetch fails
          showBanner();
        }
      }
      // 🎯 SCENARIO 2: User EXPLICITLY DENIED permissions ❌
      else if (anyDenied) {
        console.log('❌ [HealthKit] User EXPLICITLY DENIED at least one permission - marking as decided');

        // Mark that user made a decision (denied)
        await markPermissionAsRequested();

        // Show denial toast
        showToast('⚠️ Permissions denied. Tap cards to enable.');

        // Stop loading - will show locked cards
        setIsLoading(false);
      }
      // 🎯 SCENARIO 3: User DISMISSED without choosing ⏭️
      else {
        console.log('⏭️ [HealthKit] User DISMISSED without deciding (all permissions still notDetermined)');
        console.log('💡 [HealthKit] NOT marking as decided - user can be prompted again');

        // Show dismissal hint
        showToast('💡 Permission needed. We\'ll ask again next time.');

        // Don't mark as requested - user can be prompted again
        // Stop loading - will show locked cards or retry
        setIsLoading(false);
      }

    } catch (error) {
      console.error('❌ [HealthKit] Error requesting permissions:', error);
      console.error('❌ [HealthKit] Error details:', {
        message: error instanceof Error ? error.message : 'Failed to request permissions',
        stack: error instanceof Error ? error.stack : undefined,
      });
      setError(error instanceof Error ? error.message : 'Failed to request permissions');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, showBanner, markPermissionAsRequested]); // 🔧 Added markPermissionAsRequested

  // ✅ OFFICIAL PATTERN: Direct query using QuantityTypes module
  const fetchHealthData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const periodRange = getPeriodRange(period, date);

      console.log('📊 [HealthKit] ========================================');
      console.log('📊 [HealthKit] Starting health data fetch');
      console.log('📊 [HealthKit] ========================================');
      console.log('📅 [HealthKit] Period:', period);
      console.log('📅 [HealthKit] Reference date:', date.toISOString());
      console.log('📅 [HealthKit] Date range:', {
        from: periodRange.startDate.toISOString(),
        to: periodRange.endDate.toISOString(),
        durationDays: Math.round((periodRange.endDate.getTime() - periodRange.startDate.getTime()) / (1000 * 60 * 60 * 24)),
      });

      // 🔥 CRITICAL FIX #5: Validate dates before querying
      if (!validateDate(periodRange.startDate) || !validateDate(periodRange.endDate)) {
        console.error('❌ [HealthKit] Invalid date range');
        setError('Invalid date range');
        setIsLoading(false);
        return;
      }

      if (periodRange.startDate > periodRange.endDate) {
        console.error('❌ [HealthKit] Start date must be before end date');
        setError('Start date must be before end date');
        setIsLoading(false);
        return;
      }

      console.log('✅ [HealthKit] Date validation passed');

      // ✅ SEQUENTIAL QUERIES: Prevent race conditions
      // Query steps first
      console.log('🚶 [HealthKit] Querying step count...');
      console.log('🚶 [HealthKit] Query params:', {
        identifier: 'HKQuantityTypeIdentifierStepCount',
        startDate: periodRange.startDate.toISOString(),
        endDate: periodRange.endDate.toISOString(),
      });

      const queryStartTime = Date.now();
      const stepSamples = await QuantityTypes.queryQuantitySamples(
        'HKQuantityTypeIdentifierStepCount',
        {
          filter: {
            startDate: periodRange.startDate,
            endDate: periodRange.endDate,
          },
          // 🔥 CRITICAL FIX #6: Add limit to prevent memory issues
          limit: 10000,
          ascending: false, // Most recent first
        }
      );
      const queryDuration = Date.now() - queryStartTime;
      console.log('-----------FAKO----------------', stepSamples);
      console.log('✅ [HealthKit] Step count query completed in', queryDuration, 'ms');
      console.log('📊 [HealthKit] Step samples received:', {
        count: stepSamples.length,
        firstSample: stepSamples[0] ? {
          quantity: stepSamples[0].quantity,
          startDate: stepSamples[0].startDate?.toISOString(),
          endDate: stepSamples[0].endDate?.toISOString(),
          unit: stepSamples[0].unit,
          uuid: stepSamples[0].uuid,
        } : null,
        lastSample: stepSamples[stepSamples.length - 1] ? {
          quantity: stepSamples[stepSamples.length - 1].quantity,
          startDate: stepSamples[stepSamples.length - 1].startDate?.toISOString(),
          endDate: stepSamples[stepSamples.length - 1].endDate?.toISOString(),
        } : null,
      });

      // Log first 5 samples for debugging
      if (stepSamples.length > 0) {
        console.log('📋 [HealthKit] First 5 step samples:', stepSamples.slice(0, 5).map(s => ({
          quantity: s.quantity,
          start: s.startDate?.toISOString(),
          end: s.endDate?.toISOString(),
          device: s.device?.name,
        })));
      }

      const totalSteps = stepSamples.reduce((sum, sample) => sum + (sample.quantity || 0), 0);
      console.log('🎯 [HealthKit] Total steps calculated:', {
        total: totalSteps,
        rounded: Math.round(totalSteps),
        sampleCount: stepSamples.length,
        average: stepSamples.length > 0 ? (totalSteps / stepSamples.length).toFixed(2) : 0,
      });

      // Query calories (active + basal)
      console.log('🔥 [HealthKit] Querying calories (active + basal)...');
      const caloriesStartTime = Date.now();

      const [activeSamples, basalSamples] = await Promise.all([
        QuantityTypes.queryQuantitySamples(
          'HKQuantityTypeIdentifierActiveEnergyBurned',
          {
            filter: {
              startDate: periodRange.startDate,
              endDate: periodRange.endDate,
            },
            // 🔥 CRITICAL FIX #6: Add limit to prevent memory issues
            limit: 10000,
          }
        ),
        QuantityTypes.queryQuantitySamples(
          'HKQuantityTypeIdentifierBasalEnergyBurned',
          {
            filter: {
              startDate: periodRange.startDate,
              endDate: periodRange.endDate,
            },
            // 🔥 CRITICAL FIX #6: Add limit to prevent memory issues
            limit: 10000,
          }
        ),
      ]);
      const caloriesDuration = Date.now() - caloriesStartTime;

      console.log('✅ [HealthKit] Calories queries completed in', caloriesDuration, 'ms');
      console.log('📊 [HealthKit] Active energy samples:', {
        count: activeSamples.length,
        firstSample: activeSamples[0] ? {
          quantity: activeSamples[0].quantity,
          unit: activeSamples[0].unit,
          startDate: activeSamples[0].startDate?.toISOString(),
        } : null,
      });
      console.log('📊 [HealthKit] Basal energy samples:', {
        count: basalSamples.length,
        firstSample: basalSamples[0] ? {
          quantity: basalSamples[0].quantity,
          unit: basalSamples[0].unit,
          startDate: basalSamples[0].startDate?.toISOString(),
        } : null,
      });

      const activeCalories = activeSamples.reduce((sum, sample) => sum + (sample.quantity || 0), 0);
      const basalCalories = basalSamples.reduce((sum, sample) => sum + (sample.quantity || 0), 0);
      const totalCalories = activeCalories + basalCalories;

      console.log('🎯 [HealthKit] Calories calculated:', {
        active: activeCalories.toFixed(2),
        basal: basalCalories.toFixed(2),
        total: totalCalories.toFixed(2),
        rounded: Math.round(totalCalories),
      });

      // Query heart rate
      console.log('❤️ [HealthKit] Querying heart rate...');
      const hrStartTime = Date.now();

      const heartRateSamples = await QuantityTypes.queryQuantitySamples(
        'HKQuantityTypeIdentifierHeartRate',
        {
          filter: {
            startDate: periodRange.startDate,
            endDate: periodRange.endDate,
          },
          limit: 1,
          ascending: false, // Most recent first
        }
      );
      const hrDuration = Date.now() - hrStartTime;

      console.log('✅ [HealthKit] Heart rate query completed in', hrDuration, 'ms');
      console.log('📊 [HealthKit] Heart rate samples:', {
        count: heartRateSamples.length,
        latestSample: heartRateSamples[0] ? {
          quantity: heartRateSamples[0].quantity,
          unit: heartRateSamples[0].unit,
          startDate: heartRateSamples[0].startDate?.toISOString(),
          endDate: heartRateSamples[0].endDate?.toISOString(),
          device: heartRateSamples[0].device?.name,
        } : null,
      });

      const latestHeartRate = heartRateSamples[0]?.quantity || null;
      console.log('🎯 [HealthKit] Latest heart rate:', latestHeartRate ? `${latestHeartRate.toFixed(0)} bpm` : 'No data');

      // ✅ UPDATE STATE ONCE
      const finalHealthData = {
        steps: Math.round(totalSteps),
        calories: Math.round(totalCalories),
        heartRate: latestHeartRate ? Math.round(latestHeartRate) : null,
        sampleCount: stepSamples.length,
      };

      setHealthData(finalHealthData);

      console.log('========================================');
      console.log('✅ [HealthKit] All health data loaded successfully');
      console.log('========================================');
      console.log('📊 [HealthKit] Final summary:', {
        steps: {
          value: finalHealthData.steps,
          formatted: finalHealthData.steps.toLocaleString(),
          samples: stepSamples.length,
        },
        calories: {
          value: finalHealthData.calories,
          formatted: `${finalHealthData.calories} kcal`,
          active: Math.round(activeCalories),
          basal: Math.round(basalCalories),
          activeSamples: activeSamples.length,
          basalSamples: basalSamples.length,
        },
        heartRate: {
          value: finalHealthData.heartRate,
          formatted: finalHealthData.heartRate ? `${finalHealthData.heartRate} bpm` : 'No data',
          samples: heartRateSamples.length,
        },
        period,
        dateRange: {
          from: periodRange.startDate.toISOString(),
          to: periodRange.endDate.toISOString(),
        },
      });
      console.log('========================================\n');

    } catch (error) {
      console.error('========================================');
      console.error('❌ [HealthKit] Error fetching health data');
      console.error('========================================');
      console.error('❌ [HealthKit] Error:', error);
      console.error('❌ [HealthKit] Error details:', {
        message: error instanceof Error ? error.message : 'Failed to fetch health data',
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error('========================================\n');
      setError(error instanceof Error ? error.message : 'Failed to fetch health data');
    } finally {
      setIsLoading(false);
    }
  }, [date, period]);

  // 📊 FETCH CHART DATA (weekly/monthly/yearly) - Direct queries like fetchHealthData
  const fetchChartData = useCallback(async () => {
    try {
      console.log('📊 [Chart] Fetching chart data...');

      const { QuantityTypes } = require('@kingstinct/react-native-healthkit/modules');
      const today = new Date();

      // ===== WEEKLY DATA (for "Today" view - last 7 days) =====
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weeklySamples = await QuantityTypes.queryQuantitySamples(
        'HKQuantityTypeIdentifierStepCount',
        {
          filter: { startDate: monday, endDate: sunday },
          limit: 10000,
          ascending: false,
        }
      );

      // ✅ PLATFORM PARITY: Group by day using local date (not UTC)
      // This matches the Android implementation's timezone-safe approach
      const dailySteps = new Map<string, number>();
      weeklySamples.forEach((sample: any) => {
        if (!sample.startDate) return;
        const sampleDate = new Date(sample.startDate);
        // Use local date components to avoid timezone shift
        const dayKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}-${String(sampleDate.getDate()).padStart(2, '0')}`;
        dailySteps.set(dayKey, (dailySteps.get(dayKey) || 0) + (sample.quantity || 0));
      });

      const weekly = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        // ✅ PLATFORM PARITY: Use local date components (same as Android)
        const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const isFuture = date > today;

        weekly.push({
          date,
          steps: isFuture ? 0 : Math.round(dailySteps.get(dayKey) || 0),
          isToday: date.toDateString() === today.toDateString(),
          isFuture,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNumber: date.getDate(),
        });
      }
      setWeeklyData(weekly);

      // ===== MONTHLY DATA (for "Week" view - last 4 weeks) =====
      // Find the Monday of the current week
      const currentWeekMonday = new Date(today);
      const currentDayOffset = currentWeekMonday.getDay() === 0 ? -6 : 1 - currentWeekMonday.getDay();
      currentWeekMonday.setDate(currentWeekMonday.getDate() + currentDayOffset);
      currentWeekMonday.setHours(0, 0, 0, 0);

      // Go back 3 more weeks to get 4 weeks total
      const fourWeeksMonday = new Date(currentWeekMonday);
      fourWeeksMonday.setDate(currentWeekMonday.getDate() - 21); // 3 weeks back

      const monthlySamples = await QuantityTypes.queryQuantitySamples(
        'HKQuantityTypeIdentifierStepCount',
        {
          filter: { startDate: fourWeeksMonday, endDate: today },
          limit: 10000,
          ascending: false,
        }
      );

      // Group by week
      const weeklySteps = new Map<string, number>();
      monthlySamples.forEach((sample: any) => {
        if (!sample.startDate) return;
        const sampleDate = new Date(sample.startDate);

        // Find which week this sample belongs to (0-3)
        const daysDiff = Math.floor((sampleDate.getTime() - fourWeeksMonday.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = Math.floor(daysDiff / 7);

        if (weekIndex >= 0 && weekIndex < 4) {
          const key = `week${weekIndex}`;
          weeklySteps.set(key, (weeklySteps.get(key) || 0) + (sample.quantity || 0));
        }
      });

      const monthly = [];
      for (let i = 0; i < 4; i++) {
        const weekStart = new Date(fourWeeksMonday);
        weekStart.setDate(fourWeeksMonday.getDate() + i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const isFuture = weekStart > today;
        const isCurrentWeek = i === 3; // Last week is current week

        monthly.push({
          startDate: weekStart,
          steps: Math.round(weeklySteps.get(`week${i}`) || 0),
          label: `Week ${i + 1}`,
          weekNumber: i + 1,
          isCurrentWeek,
          isFuture,
        });
      }
      setMonthlyData(monthly);

      // ===== YEARLY DATA (for "Month" view - last 12 months) =====
      const twelveMonthsAgo = new Date(today);
      twelveMonthsAgo.setMonth(today.getMonth() - 12);
      twelveMonthsAgo.setHours(0, 0, 0, 0);

      const yearlySamples = await QuantityTypes.queryQuantitySamples(
        'HKQuantityTypeIdentifierStepCount',
        {
          filter: { startDate: twelveMonthsAgo, endDate: today },
          limit: 10000,
          ascending: false,
        }
      );

      // Group by month
      const monthlySteps = new Map<string, number>();
      yearlySamples.forEach((sample: any) => {
        if (!sample.startDate) return;
        const sampleDate = new Date(sample.startDate);
        const monthKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}`;
        monthlySteps.set(monthKey, (monthlySteps.get(monthKey) || 0) + (sample.quantity || 0));
      });

      const yearly = [];
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(today);
        monthDate.setMonth(today.getMonth() - (11 - i));
        monthDate.setDate(1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const isFuture = monthDate > today;
        const isCurrentMonth = monthDate.getMonth() === today.getMonth() && monthDate.getFullYear() === today.getFullYear();

        yearly.push({
          startDate: monthDate,
          steps: isFuture ? 0 : Math.round(monthlySteps.get(monthKey) || 0),
          label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
          isCurrentMonth,
          isFuture,
        });
      }
      setYearlyData(yearly);

      console.log('✅ [Chart] All chart data loaded:', { weekly: weekly.length, monthly: monthly.length, yearly: yearly.length });

    } catch (error) {
      console.error('❌ [Chart] Error fetching chart data:', error);
    }
  }, []);

  // 🔧 Update function refs whenever they change (for stable references)
  useEffect(() => {
    console.log('🔧 [Refs] Updating function references');
    fetchHealthDataRef.current = fetchHealthData;
    fetchChartDataRef.current = fetchChartData;
  }, [fetchHealthData, fetchChartData]);

  // ✅ FETCH DATA when authorized
  useEffect(() => {
    console.log('🔄 [HealthKit] Auth status or filters changed:', {
      authStatus,
      authStatusName: authStatus === 0 ? 'unknown' : authStatus === 1 ? 'shouldRequest' : authStatus === 2 ? 'unnecessary' : 'null',
      period,
      date: date.toISOString(),
    });

    // 🔥 CRITICAL FIX #2: Only fetch when status is 'unnecessary' (authorized)
    // shouldRequest = 1 means "not authorized yet, need to request"
    // unnecessary = 2 means "already authorized, safe to query"
    if (authStatus === AuthorizationRequestStatus.unnecessary) {
      console.log('✅ [HealthKit] Conditions met (unnecessary = authorized) - triggering data fetch');
      fetchHealthData();
      fetchChartData(); // 📊 Also fetch chart data
    } else {
      console.log('⏸️ [HealthKit] Not fetching - auth status:', authStatus, '(need status = 2 / unnecessary)');
    }
  }, [authStatus, date, period, fetchHealthData, fetchChartData]);

  // Entrance animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // 📱 App State Listener: Detect when returning from Settings
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('📱 [AppState] State changed:', {
        from: appState.current,
        to: nextAppState,
        justGrantedPermission,
      });

      // If app is coming to foreground from background
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('✅ [AppState] App returned to foreground - checking permissions...');

        try {
          // Re-check authorization status
          const status = await getRequestStatusForAuthorization(
            REQUIRED_PERMISSIONS,
            REQUIRED_PERMISSIONS
          );

          console.log('📊 [AppState] Current auth status:', {
            statusCode: status,
            statusName: status === 0 ? 'unknown' : status === 1 ? 'shouldRequest' : status === 2 ? 'unnecessary' : 'INVALID',
          });

          // If now authorized and wasn't before
          if (status === AuthorizationRequestStatus.unnecessary && authStatus !== status) {
            console.log('🎉 [AppState] Permissions granted while in background! Auto-refreshing...');

            // Mark that user made a decision (granted in Settings)
            await markPermissionAsRequested();

            setAuthStatus(status);
            setJustGrantedPermission(true);

            // Show toast notification
            showToast('✓ Health permissions granted');

            // Auto-refresh data using refs to avoid dependency issues
            if (fetchHealthDataRef.current && fetchChartDataRef.current) {
              await Promise.all([
                fetchHealthDataRef.current(),
                fetchChartDataRef.current()
              ]);
            } else {
              console.warn('⚠️ [AppState] Fetch function refs not yet initialized');
            }

            // Show banner with pull-to-refresh hint
            showBanner();
          } else if (status === AuthorizationRequestStatus.unnecessary && justGrantedPermission) {
            // Already authorized, just refresh
            console.log('🔄 [AppState] Already authorized - refreshing data...');
            if (fetchHealthDataRef.current && fetchChartDataRef.current) {
              await Promise.all([
                fetchHealthDataRef.current(),
                fetchChartDataRef.current()
              ]);
            }
          }
        } catch (error) {
          console.error('❌ [AppState] Error checking permissions:', error);
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [authStatus, justGrantedPermission, showToast, showBanner, markPermissionAsRequested]); // 🔧 Added markPermissionAsRequested

  const changeDate = useCallback(
    (numDays: number) => {
      const currentDate = new Date(date);
      currentDate.setDate(currentDate.getDate() + numDays);
      console.log('📅 [HealthKit] Date changed:', {
        direction: numDays > 0 ? 'forward' : 'backward',
        days: numDays,
        oldDate: date.toISOString(),
        newDate: currentDate.toISOString(),
      });
      setDate(currentDate);
      safeHaptics.selection();
    },
    [date]
  );

  const handlePeriodChange = useCallback((newPeriod: PeriodFilter) => {
    console.log('🔄 [HealthKit] Period changed:', {
      from: period,
      to: newPeriod,
    });
    setPeriod(newPeriod);
    safeHaptics.selection();
  }, []);

  const refresh = useCallback(async () => {
    console.log('🔄 [HealthKit] Manual refresh triggered');
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);

    // Dismiss banner if showing
    if (showRefreshBanner) {
      dismissBanner();
    }

    // Use refs to avoid circular dependencies
    if (fetchHealthDataRef.current && fetchChartDataRef.current) {
      await fetchHealthDataRef.current();
      await fetchChartDataRef.current(); // 📊 Also refresh chart data

      // Show success toast
      showToast('✓ Data refreshed');
    } else {
      console.warn('⚠️ [Refresh] Fetch function refs not yet initialized');
    }
  }, [showRefreshBanner, dismissBanner, showToast]); // 🔧 Removed fetchHealthData and fetchChartData - using refs instead

  // 🧪 Generate realistic sample data for testing (dev only)
  const generateSampleData = useCallback(async (days: number = 30, label: string = '30 days') => {
    try {
      console.log('🧪 [HealthKit] ========================================');
      console.log(`🧪 [HealthKit] Starting sample data generation (${label})`);
      console.log('🧪 [HealthKit] ========================================');

      // Step 1: Check current write permission status
      console.log('🔐 [HealthKit] Checking write permissions...');
      const currentStatus = await getRequestStatusForAuthorization(
        [], // No additional read permissions needed
        WRITE_PERMISSIONS
      );

      console.log('📊 [HealthKit] Current write permission status:', {
        statusCode: currentStatus,
        statusName: currentStatus === 0 ? 'unknown' : currentStatus === 1 ? 'shouldRequest' : currentStatus === 2 ? 'unnecessary' : 'INVALID',
      });

      // Step 2: Request write permissions if needed
      if (currentStatus === AuthorizationRequestStatus.shouldRequest ||
          currentStatus === AuthorizationRequestStatus.unknown) {
        console.log('🔐 [HealthKit] Requesting write permissions...');

        await requestAuthorization(
          REQUIRED_PERMISSIONS, // Keep read permissions
          WRITE_PERMISSIONS     // Add write permissions
        );

        // Wait for iOS to propagate
        console.log('⏳ [HealthKit] Waiting for permission propagation...');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Re-check status
        const newStatus = await getRequestStatusForAuthorization([], WRITE_PERMISSIONS);
        console.log('📊 [HealthKit] New write permission status:', newStatus);

        if (newStatus !== AuthorizationRequestStatus.unnecessary) {
          Alert.alert(
            'Write Permission Required',
            'Please grant write permission to Health data to add sample data for testing.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      console.log('✅ [HealthKit] Write permissions granted');

      // Step 3: Generate realistic sample data
      const now = new Date();
      const samplesAdded = {
        steps: 0,
        heartRate: 0,
        activeCalories: 0,
        basalCalories: 0,
      };

      console.log(`📝 [HealthKit] Generating sample data for last ${days} days...`);

      // Generate data for specified number of days
      for (let daysAgo = 0; daysAgo < days; daysAgo++) {
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);
        date.setHours(12, 0, 0, 0); // Noon

        // Realistic step count (varies by day of week)
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const baseSteps = isWeekend ? 4000 : 8000;
        const variation = Math.random() * 4000 - 2000;
        const steps = Math.max(1000, Math.floor(baseSteps + variation));

        // Add steps
        await saveQuantitySample(
          'HKQuantityTypeIdentifierStepCount',
          'count',
          steps,
          new Date(date.getTime() - 3600000 * 12), // 12 hours before
          date,
          {}
        );
        samplesAdded.steps++;

        // Realistic active calories (proportional to steps)
        const activeCalories = Math.floor((steps / 100) * (15 + Math.random() * 10));
        await saveQuantitySample(
          'HKQuantityTypeIdentifierActiveEnergyBurned',
          'kcal',
          activeCalories,
          new Date(date.getTime() - 3600000 * 12),
          date,
          {}
        );
        samplesAdded.activeCalories++;

        // Realistic basal calories (BMR ~1500-2000 per day)
        const basalCalories = Math.floor(1500 + Math.random() * 500);
        await saveQuantitySample(
          'HKQuantityTypeIdentifierBasalEnergyBurned',
          'kcal',
          basalCalories,
          new Date(date.getTime() - 3600000 * 24),
          date,
          {}
        );
        samplesAdded.basalCalories++;

        // Add 3-5 heart rate readings per day
        const hrReadings = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < hrReadings; i++) {
          const hrDate = new Date(date);
          hrDate.setHours(8 + i * 4); // Spread throughout day

          // Realistic heart rate (60-100 bpm at rest, varies by activity)
          const baseHR = 65 + Math.random() * 15; // 65-80 base
          const activityBoost = i === 2 ? 20 : 0; // Midday spike (activity)
          const heartRate = Math.floor(baseHR + activityBoost + Math.random() * 10);

          await saveQuantitySample(
            'HKQuantityTypeIdentifierHeartRate',
            'count/min',
            heartRate,
            hrDate,
            hrDate,
            {}
          );
          samplesAdded.heartRate++;
        }

        // Log progress every 5 days (or 10% for large datasets)
        const progressInterval = days > 50 ? Math.floor(days / 10) : 5;
        if ((daysAgo + 1) % progressInterval === 0 || daysAgo === days - 1) {
          console.log(`📊 [HealthKit] Generated data for ${daysAgo + 1}/${days} days...`);
        }
      }

      const totalSamples = Object.values(samplesAdded).reduce((a, b) => a + b, 0);

      console.log('========================================');
      console.log('✅ [HealthKit] Sample data generation complete!');
      console.log('========================================');
      console.log('📊 [HealthKit] Samples added:', {
        steps: `${samplesAdded.steps} samples (${days} days)`,
        heartRate: `${samplesAdded.heartRate} samples (~${Math.floor(samplesAdded.heartRate / days)} per day)`,
        activeCalories: `${samplesAdded.activeCalories} samples (${days} days)`,
        basalCalories: `${samplesAdded.basalCalories} samples (${days} days)`,
        totalSamples,
        period: label,
      });
      console.log('========================================\n');

      // Show success alert
      Alert.alert(
        '✅ Sample Data Added',
        `Successfully added ${totalSamples} health samples for ${label}.\n\n` +
        `• ${samplesAdded.steps} step samples\n` +
        `• ${samplesAdded.heartRate} heart rate readings\n` +
        `• ${samplesAdded.activeCalories} active calorie samples\n` +
        `• ${samplesAdded.basalCalories} basal calorie samples\n\n` +
        '💡 Note: New data merged with any existing HealthKit data.\n\n' +
        'Refreshing data...',
        [
          {
            text: 'OK',
            onPress: () => {
              // Refresh data to show new samples
              fetchHealthData();
            },
          },
        ]
      );

    } catch (error) {
      console.error('❌ [HealthKit] Error generating sample data:', error);
      console.error('❌ [HealthKit] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      Alert.alert(
        '❌ Error',
        `Failed to generate sample data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  }, [fetchHealthData]);

  // Goal calculations
  const currentGoal = period === 'today' ? STEPS_GOAL :
                      period === 'week' ? STEPS_GOAL * 7 :
                      STEPS_GOAL * 30;
  const progress = healthData.steps / currentGoal;
  const percentageComplete = Math.min(100, (healthData.steps / currentGoal) * 100);

  const renderHeader = () => (
    <Animated.View style={styles.header}>
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

  // Chart data transformation
  const chartData = React.useMemo<ChartDataPoint[]>(() => {
    if (period === 'today') {
      if (!Array.isArray(weeklyData) || weeklyData.length === 0) return [];
      return weeklyData.map(day => ({
        value: day?.steps || 0,
        label: day?.dayName || '',
        isCurrent: day?.isToday || false,
        isFuture: day?.isFuture || false,
      }));
    } else if (period === 'week') {
      if (!Array.isArray(monthlyData) || monthlyData.length === 0) return [];
      return monthlyData.map(week => ({
        value: week?.steps || 0,
        label: week?.label ? week.label.replace('Week ', '') : '',
        isCurrent: week?.isCurrentWeek || false,
        isFuture: week?.isFuture || false,
      }));
    } else if (period === 'month') {
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
    console.log('🎨 [renderChart] called with chartData.length:', chartData.length);
    console.log('✅ [renderChart] Rendering chart with data');
    return <UnifiedStepsChart data={chartData} />;
  };

  const renderPeriodFilter = () => (
    <View style={styles.periodFilterSection}>
      <View style={styles.periodFilterContainer}>
        <AdaptiveTouchableOpacity
          style={[
            styles.periodButton,
            period === 'today' && styles.periodButtonActive,
          ]}
          onPress={() => handlePeriodChange('today')}
          enableHaptics={!isLowEndDevice}
        >
          <Text
            style={[styles.periodButtonText, period === 'today' && styles.periodButtonTextActive]}
          >
            Today
          </Text>
        </AdaptiveTouchableOpacity>

        <AdaptiveTouchableOpacity
          style={[
            styles.periodButton,
            period === 'week' && styles.periodButtonActive,
          ]}
          onPress={() => handlePeriodChange('week')}
          enableHaptics={!isLowEndDevice}
        >
          <Text
            style={[styles.periodButtonText, period === 'week' && styles.periodButtonTextActive]}
          >
            This week
          </Text>
        </AdaptiveTouchableOpacity>

        <AdaptiveTouchableOpacity
          style={[
            styles.periodButton,
            period === 'month' && styles.periodButtonActive,
          ]}
          onPress={() => handlePeriodChange('month')}
          enableHaptics={!isLowEndDevice}
        >
          <Text
            style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}
          >
            This month
          </Text>
        </AdaptiveTouchableOpacity>
      </View>
    </View>
  );

  const renderTitleAndStats = () => {
    const periodText = period === 'today' ? 'today' :
                       period === 'week' ? 'this week' :
                       'this month';

    // ✅ PROFESSIONAL: Check authorization to show proper placeholder
    const isAuthorized = authStatus === AuthorizationRequestStatus.unnecessary;
    const stepDisplay = isAuthorized ? healthData.steps.toLocaleString() : '--';

    return (
      <View style={styles.titleAndStatsSection}>
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

  const renderStats = () => {
    // ✅ PROFESSIONAL: Check authorization status to show appropriate UI
    const isAuthorized = authStatus === AuthorizationRequestStatus.unnecessary;
    const isRejected = authStatus === AuthorizationRequestStatus.shouldRequest;
    const isFirstTime = authStatus === AuthorizationRequestStatus.unknown;

    // 🔐 BEST PRACTICE: Different handlers based on state
    // - First time: Request permissions (shows iOS dialog)
    // - Rejected: Guide to Settings (iOS won't re-show dialog)
    const handleLockedCardPress = isRejected ? showSettingsGuidance : requestHealthPermissions;

    return (
      <View style={styles.statsCardsContainer}>
        {/* Calories Card */}
        <TouchableOpacity
          style={[
            styles.statCard,
            !isAuthorized && styles.statCardLocked,
          ]}
          onPress={!isAuthorized ? handleLockedCardPress : undefined}
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
            {isAuthorized ? healthData.calories.toFixed(0) : '--'}
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
          onPress={!isAuthorized ? handleLockedCardPress : undefined}
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
            {isAuthorized ? (healthData.heartRate !== null ? healthData.heartRate.toFixed(0) : '--') : '--'}
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
          onPress={!isAuthorized ? handleLockedCardPress : undefined}
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
            {isAuthorized ? Math.round(healthData.steps / 100) : '--'}
          </Text>
          <Text style={styles.statCardUnit}>
            {isAuthorized ? 'minutes' : 'Tap to enable'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPermissionPrompt = () => (
    <View style={styles.permissionContainer}>
      <Ionicons name="fitness-outline" size={64} color={COLORS.PRIMARY} />
      <Text style={styles.permissionTitle}>Enable Step Tracking</Text>
      <Text style={styles.permissionSubtext}>
        Allow access to your health data to track your daily steps and reach your fitness goals.
      </Text>

      <AdaptiveTouchableOpacity
        style={styles.permissionButton}
        onPress={requestHealthPermissions}
        enableHaptics={!isLowEndDevice}
      >
        <Ionicons name="shield-checkmark" size={20} color={COLORS.WHITE} />
        <Text style={styles.permissionButtonText}>Enable Health Access</Text>
      </AdaptiveTouchableOpacity>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="warning-outline" size={64} color={COLORS.ERROR} />
      <Text style={styles.errorTitle}>Unable to Load Step Data</Text>
      <Text style={styles.errorSubtext}>{error}</Text>

      <AdaptiveTouchableOpacity
        style={styles.retryButton}
        onPress={refresh}
        enableHaptics={!isLowEndDevice}
      >
        <Ionicons name="refresh" size={20} color={COLORS.PRIMARY} />
        <Text style={styles.retryButtonText}>Try Again</Text>
      </AdaptiveTouchableOpacity>
    </View>
  );

  // 🔔 Render: Notification Banner
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

  // 🔔 Render: Toast Notification
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

  // ✅ BEST PRACTICE RENDER LOGIC (Following Apple Health, Fitbit, Strava patterns)
  //
  // STATE FLOW:
  // 1. NEVER ASKED (unknown) → Show full-screen prompt (first time only)
  // 2. REJECTED (shouldRequest) → Show dashboard with locked cards (respects user choice)
  // 3. GRANTED (unnecessary) → Show dashboard with real data
  //
  const isFirstTime = authStatus === AuthorizationRequestStatus.unknown;
  const isRejected = authStatus === AuthorizationRequestStatus.shouldRequest;
  const isGranted = authStatus === AuthorizationRequestStatus.unnecessary;

  // 🎯 FIRST TIME: Show full-screen permission prompt (one-time, never asked before)
  if (isFirstTime && !isLoading) {
    console.log('🔐 [Render] First time - showing full-screen permission prompt');
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

  // 🎯 ERROR STATE: Show error screen with retry option
  if (error) {
    console.log('❌ [Render] Error state - showing error screen');
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

  // 🎯 BEST PRACTICE: Always show dashboard (with locked cards if rejected, data if granted)
  // This respects user choice and provides graceful degradation
  console.log('📊 [Render] Showing dashboard -', isRejected ? 'LOCKED cards (rejected)' : isGranted ? 'DATA (granted)' : 'LOADING');

  return (
    <HealthDashboardErrorBoundary>
      <PerformanceMonitor>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
            style={StyleSheet.absoluteFillObject}
          />
          <ScrollView
            style={styles.scrollView}
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
          </ScrollView>

          {/* 🔔 Notification Banner (appears after permission grant) */}
          {renderRefreshBanner()}

          {/* 🔔 Toast Notification */}
          {renderToast()}
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
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: SPACING.XXL,
  },
  header: {
    height: 200,
    overflow: 'hidden',
    borderBottomLeftRadius: BORDER_RADIUS.XL,
    borderBottomRightRadius: BORDER_RADIUS.XL,
  },
  headerContent: {
    flex: 1,
    padding: SPACING.LG,
    paddingTop: SPACING.XXL + 20,
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
  periodFilterSection: {
    paddingHorizontal: SPACING.MD,
    paddingTop: SPACING.XXL,
    paddingBottom: SPACING.MD,
  },
  periodFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.SM,
    backgroundColor: 'rgba(74,78,138,0.4)',
    borderRadius: BORDER_RADIUS.XL,
    padding: SPACING.XS,
  },
  periodButton: {
    flex: 1,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.MD,
    borderRadius: BORDER_RADIUS.XL,
    backgroundColor: 'rgba(74,78,138,0.5)',
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  periodButtonActive: {
    backgroundColor: '#4ECDC4',
    borderColor: 'transparent',
  },
  periodButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: COLORS.WHITE,
    fontWeight: '600',
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
  // 🔒 PROFESSIONAL: Locked title number (when permissions denied)
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
  // 📊 Simple Card Stats (no complex graph)
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
  // 🔒 PROFESSIONAL: Locked stat card styles (missing authorization)
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
  // 🧪 Generate Sample Data Card (dev only)
  generateDataCard: {
    backgroundColor: 'rgba(155, 89, 182, 0.3)', // Purple tint (no data)
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.LG,
    borderWidth: 2,
    borderColor: '#9B59B6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateDataCardWithData: {
    backgroundColor: 'rgba(52, 152, 219, 0.3)', // Blue tint (has data)
    borderColor: '#3498DB',
  },
  generateDataText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: 'bold',
    color: '#9B59B6',
    marginVertical: SPACING.SM,
  },
  generateDataSubtext: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '500',
    color: 'rgba(155, 89, 182, 0.8)',
  },
  existingDataBadge: {
    marginTop: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.XS,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: BORDER_RADIUS.SM,
  },
  existingDataBadgeText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    fontWeight: '600',
    color: '#3498DB',
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
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  debugButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  debugButtonText: {
    fontSize: 28,
  },
  // 🔔 Notification Banner Styles
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
  // 🔔 Toast Styles
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
