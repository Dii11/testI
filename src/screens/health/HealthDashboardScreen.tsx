import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useSelector } from 'react-redux';

import { AsyncErrorBoundary } from '../../components/common/AsyncErrorBoundary';
import { HealthDashboardSkeleton } from '../../components/common/SkeletonLoader';
import { HealthProviderInfo } from '../../components/health/HealthProviderInfo';
import { PermissionDeniedView } from '../../components/permissions/PermissionDeniedView';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants';
import { AdaptiveLinearGradient } from '../../components/adaptive/AdaptiveComponents';
import { RootState } from '../../store';
import { selectUser } from '../../store/selectors/authSelectors';
import {
  selectDashboardMetrics,
  selectHealthLoading,
  selectHealthError,
  selectLastSync,
} from '../../store/selectors/healthSelectors';
import { HealthDataType } from '../../types/health';

import type { HealthStatus, PermissionState } from './useHealthData';
import { useHealthData } from './useHealthData';

const { width } = Dimensions.get('window');

const HEALTH_PROVIDER_INFO = {
  ios: {
    name: 'Apple HealthKit',
    description: 'Connect your Apple Watch or iPhone to sync health data',
    icon: 'logo-apple',
    color: COLORS.HEALTH_GREEN,
    setupInstructions:
      'Go to Settings > Privacy & Security > Health > HopMed and enable permissions',
  },
  android: {
    name: 'Google Health Connect',
    description:
      'Connect your Wear OS watch, fitness tracker, or Android device to sync health data',
    icon: 'logo-google',
    color: COLORS.HEALTH_BLUE,
    setupInstructions:
      'Install Google Health Connect app from Play Store, then grant permissions to HopMed. For Tecno devices: also disable battery optimization for HopMed in device settings.',
  },
};

const HealthDashboardScreenContent: React.FC = () => {
  const navigation = useNavigation();

  const {
    status,
    deviceInfo,
    emptyData,
    error,
    permissionsGranted,
    permissionState,
    deviceConfig,
    refresh,
    showNoData,
    retryInitialization,
    requestPermissions,
  } = useHealthData();

  // Type guard to ensure proper type inference
  const healthStatus: HealthStatus = status;

  // Enhanced type guards for new permission states
  const isNoData = (s: HealthStatus): s is 'no_data' => s === 'no_data';
  const isConnected = (s: HealthStatus): s is 'connected' => s === 'connected';
  const isInitializing = (s: HealthStatus): s is 'initializing_providers' =>
    s === 'initializing_providers';
  const isCheckingAvailability = (s: HealthStatus): s is 'checking_availability' =>
    s === 'checking_availability';
  const isCheckingPermissions = (s: HealthStatus): s is 'checking_permissions' =>
    s === 'checking_permissions';
  const isRequestingPermissions = (s: HealthStatus): s is 'requesting_permissions' =>
    s === 'requesting_permissions';
  const isPermissionGranted = (s: HealthStatus): s is 'permission_granted' =>
    s === 'permission_granted';
  const isPermissionPartial = (s: HealthStatus): s is 'permission_partial' =>
    s === 'permission_partial';
  const isPermissionDenied = (s: HealthStatus): s is 'permission_denied' =>
    s === 'permission_denied';
  const isDeviceUnavailable = (s: HealthStatus): s is 'device_unavailable' =>
    s === 'device_unavailable';
  const isError = (s: HealthStatus): s is 'error' => s === 'error';
  const isUninitialized = (s: HealthStatus): s is 'uninitialized' => s === 'uninitialized';

  const dashboardMetrics = useSelector(selectDashboardMetrics);
  const isLoading = useSelector(selectHealthLoading);
  const lastSync = useSelector(selectLastSync);

  const isLowEndDevice = width < 375;

  const providerInfo =
    Platform.OS === 'ios' ? HEALTH_PROVIDER_INFO.ios : HEALTH_PROVIDER_INFO.android;

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Best-effort deep link to Health Connect settings on Android with fallbacks
  const openHealthConnectSettings = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    console.log('🤖 Opening Health Connect settings...');

    const intents = [
      // Health Connect specific settings (Android 14+)
      'intent:#Intent;action=androidx.health.action.HEALTH_CONNECT_SETTINGS;end',
      'intent:#Intent;action=androidx.health.connect.action.HEALTH_CONNECT_SETTINGS;end',
      'intent:#Intent;action=androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE;end',
      // System settings
      'intent:#Intent;action=android.settings.HEALTH_CONNECT_SETTINGS;end',
      'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:com.google.android.apps.healthdata;end',
      // App settings
      'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:com.google.android.apps.healthdata;end',
      // General health settings
      'intent:#Intent;action=android.settings.APPLICATION_SETTINGS;end',
    ];

    let opened = false;
    for (const uri of intents) {
      try {
        console.log(`🤖 Trying intent: ${uri}`);
        const supported = await Linking.canOpenURL(uri);
        if (supported) {
          await Linking.openURL(uri);
          console.log('🤖 Successfully opened Health Connect settings');
          opened = true;
          break;
        }
      } catch (error) {
        console.warn(`🤖 Intent failed: ${uri}`, error);
        // Try next fallback
      }
    }

    if (!opened) {
      // Final fallback: open Play Store listing
      const playStoreUrl =
        'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
      try {
        console.log('🤖 Opening Play Store as fallback');
        await Linking.openURL(playStoreUrl);
      } catch (error) {
        console.error('🤖 Failed to open Play Store:', error);
      }
    }
  }, []);

  // Enhanced Health Connect troubleshooting
  const showHealthConnectTroubleshooting = useCallback(() => {
    const troubleshootingSteps = [
      '1. Install Health Connect from Google Play Store',
      '2. Open Health Connect app and complete setup',
      '3. Grant permissions to HopMed in Health Connect',
      '4. Check if your device supports Health Connect (Android 8.0+)',
      '5. Restart your device if issues persist',
    ];

    Alert.alert('Health Connect Troubleshooting', troubleshootingSteps.join('\n\n'), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Play Store', onPress: openHealthConnectSettings },
      { text: 'Retry Connection', onPress: retryInitialization },
    ]);
  }, [openHealthConnectSettings, retryInitialization]);

  const renderMetricCard = useCallback(
    (
      icon: keyof typeof Ionicons.glyphMap,
      label: string,
      value: string | number,
      unit: string,
      color: string
    ) => (
      <View style={styles.metricCard} key={label}>
        <View style={[styles.metricIconContainer, { backgroundColor: color }]}>
          <Ionicons name={icon} size={24} color={COLORS.WHITE} />
        </View>
        <View style={styles.flexFill}>
          <Text style={styles.metricLabel}>{label}</Text>
          <View style={styles.metricValueContainer}>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricUnit}>{unit}</Text>
          </View>
        </View>
      </View>
    ),
    []
  );

  const displayData = useMemo(() => {
    if (isNoData(healthStatus)) {
      return emptyData;
    }

    const defaultSteps = { today: 0, goal: 10000, progress: 0 };
    const defaultSleep = { duration: 'N/A', hours: 0, minutes: 0, quality: 0 };

    const metrics = dashboardMetrics ?? {
      steps: defaultSteps,
      heartRate: null,
      sleep: null,
      calories: null,
    };

    return {
      steps: {
        today: metrics.steps.today || defaultSteps.today,
        goal: metrics.steps.goal || defaultSteps.goal,
        progress: metrics.steps.progress || defaultSteps.progress,
      },
      heartRate: metrics.heartRate ?? 'N/A',
      sleep: metrics.sleep
        ? {
            duration: metrics.sleep.duration || defaultSleep.duration,
            hours: metrics.sleep.hours || defaultSleep.hours,
            minutes: metrics.sleep.minutes || defaultSleep.minutes,
            quality: metrics.sleep.quality || defaultSleep.quality,
          }
        : defaultSleep,
      calories: metrics.calories ?? 'N/A',
      timestamp: new Date().toISOString(),
      dataSource: isNoData(healthStatus)
        ? 'No Data Available'
        : (deviceInfo?.name ?? 'Health Device'),
    };
  }, [dashboardMetrics, healthStatus, emptyData, deviceInfo?.name]);

  // Show skeleton for loading states
  if (
    isUninitialized(healthStatus) ||
    isCheckingAvailability(healthStatus) ||
    isCheckingPermissions(healthStatus) ||
    (isInitializing(healthStatus) && permissionsGranted === null)
  ) {
    return <HealthDashboardSkeleton />;
  }

  // Handle device unavailable state
  if (isDeviceUnavailable(healthStatus)) {
    return (
      <View style={styles.centered}>
        <View style={styles.providerInfoCard}>
          <View style={[styles.providerIconContainer, { backgroundColor: COLORS.ERROR }]}>
            <Ionicons name="warning" size={32} color={COLORS.WHITE} />
          </View>
          <Text style={styles.providerName}>Health Service Unavailable</Text>
          <Text style={styles.providerDescription}>
            {error ?? 'Health Connect or HealthKit is not available on your device'}
          </Text>
        </View>

        {typeof deviceInfo?.installUrl === 'string' && deviceInfo.installUrl.length > 0 && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              // Open installation URL with fallback
              const url =
                typeof deviceInfo.installUrl === 'string' ? deviceInfo.installUrl : undefined;
              if (!url) return;
              Linking.openURL(url).catch(() => {
                if (Platform.OS === 'android') {
                  const fallback =
                    'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
                  Linking.openURL(fallback).catch(err =>
                    console.warn('Failed to open store URL', err)
                  );
                }
              });
            }}
          >
            <Ionicons name="download" size={20} color={COLORS.WHITE} />
            <Text style={styles.primaryButtonText}>Install Health Connect</Text>
          </TouchableOpacity>
        )}

        {Platform.OS === 'android' && (
          <>
            <TouchableOpacity style={styles.secondaryButton} onPress={openHealthConnectSettings}>
              <Text style={styles.secondaryButtonText}>Open Health Connect Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: SPACING.SM }]}
              onPress={showHealthConnectTroubleshooting}
            >
              <Text style={styles.secondaryButtonText}>Troubleshooting Guide</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.demoButton} onPress={showNoData}>
          <Text style={styles.demoButtonText}>Continue Without Health Data</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isRequestingPermissions(healthStatus)) {
    return (
      <View style={styles.centered}>
        <View style={styles.providerInfoCard}>
          <View style={[styles.providerIconContainer, { backgroundColor: providerInfo.color }]}>
            <Ionicons
              name={providerInfo.icon as keyof typeof Ionicons.glyphMap}
              size={32}
              color={COLORS.WHITE}
            />
          </View>
          <Text style={styles.providerName}>{providerInfo.name}</Text>
          <Text style={styles.providerDescription}>{providerInfo.description}</Text>
        </View>

        <View style={styles.permissionRequestCard}>
          <Ionicons name="lock-closed" size={48} color={COLORS.PRIMARY} />
          <Text style={styles.permissionRequestTitle}>Requesting Health Permissions</Text>
          <Text style={styles.permissionRequestText}>
            Please grant access to your health data in the system dialog that appeared. This allows
            HopMed to provide personalized health insights.
          </Text>
        </View>
      </View>
    );
  }

  // Handle partial permissions state
  if (isPermissionPartial(healthStatus)) {
    const availableFeatures = [];
    const unavailableFeatures = [];

    if (permissionState.steps) availableFeatures.push('Steps tracking');
    else unavailableFeatures.push('Steps');

    if (permissionState.heartRate) availableFeatures.push('Heart rate monitoring');
    else unavailableFeatures.push('Heart rate');

    if (permissionState.sleep) availableFeatures.push('Sleep analysis');
    else unavailableFeatures.push('Sleep');

    if (permissionState.calories) availableFeatures.push('Calorie tracking');
    else unavailableFeatures.push('Calories');

    return (
      <View style={styles.centered}>
        <View style={styles.providerInfoCard}>
          <View style={[styles.providerIconContainer, { backgroundColor: COLORS.WARNING }]}>
            <Ionicons name="warning" size={32} color={COLORS.WHITE} />
          </View>
          <Text style={styles.providerName}>Limited Health Access</Text>
          <Text style={styles.providerDescription}>
            Some health data permissions are missing. You have access to:{' '}
            {availableFeatures.join(', ')}
          </Text>
        </View>

        <View style={styles.setupInstructions}>
          <Text style={styles.setupTitle}>Missing Access:</Text>
          <Text style={styles.setupText}>
            {unavailableFeatures.join(', ')} - Tap "Grant More Access" to enable additional features
          </Text>
        </View>

        <View style={styles.permissionActionButtons}>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermissions}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.WHITE} />
            <Text style={styles.primaryButtonText}>Grant More Access</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={retryInitialization}>
            <Text style={styles.secondaryButtonText}>Continue with Available Data</Text>
          </TouchableOpacity>

          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: SPACING.SM }]}
              onPress={openHealthConnectSettings}
            >
              <Text style={styles.secondaryButtonText}>Open Health Connect Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Handle permission denied state
  if (
    isPermissionDenied(healthStatus) ||
    (permissionsGranted === false && !isNoData(healthStatus))
  ) {
    return (
      <View style={styles.centered}>
        <View style={styles.providerInfoCard}>
          <View style={[styles.providerIconContainer, { backgroundColor: providerInfo.color }]}>
            <Ionicons
              name={providerInfo.icon as keyof typeof Ionicons.glyphMap}
              size={32}
              color={COLORS.WHITE}
            />
          </View>
          <Text style={styles.providerName}>{providerInfo.name}</Text>
          <Text style={styles.providerDescription}>{providerInfo.description}</Text>
        </View>

        <PermissionDeniedView
          permissionName="Health Data"
          featureName="Health Dashboard"
          reason={`HopMed needs access to your health data through ${providerInfo.name} to display your activity, sleep, and other metrics.`}
        />

        <View style={styles.setupInstructions}>
          <Text style={styles.setupTitle}>Setup Instructions:</Text>
          <Text style={styles.setupText}>{providerInfo.setupInstructions}</Text>
        </View>

        <View style={styles.permissionActionButtons}>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermissions}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.WHITE} />
            <Text style={styles.primaryButtonText}>Grant Health Access</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={showNoData}>
            <Text style={styles.secondaryButtonText}>Continue Without Data</Text>
          </TouchableOpacity>

          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: SPACING.SM }]}
              onPress={openHealthConnectSettings}
            >
              <Text style={styles.secondaryButtonText}>Open Health Connect Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (isError(healthStatus)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Unable to load health data</Text>
        <Text style={styles.errorSubtext}>
          {error ||
            `Make sure ${providerInfo.name} is properly configured and permissions are granted.`}
        </Text>
        <View style={styles.permissionActionButtons}>
          <TouchableOpacity onPress={retryInitialization} style={styles.primaryButton}>
            <Ionicons name="refresh" size={20} color={COLORS.WHITE} />
            <Text style={styles.primaryButtonText}>Retry Connection</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={showNoData}>
            <Text style={styles.secondaryButtonText}>Continue Without Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <AdaptiveLinearGradient fallbackColor={COLORS.PRIMARY} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !isNoData(healthStatus)}
            onRefresh={onRefresh}
            tintColor={COLORS.PRIMARY}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Health Dashboard
            {isNoData(healthStatus) && <Text style={styles.demoIndicator}> (No Data)</Text>}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 8,
              marginBottom: isLowEndDevice ? 4 : 8,
            }}
          >
            <Ionicons
              name={
                isConnected(healthStatus)
                  ? 'checkmark-circle'
                  : isInitializing(healthStatus) ||
                      isCheckingAvailability(healthStatus) ||
                      isCheckingPermissions(healthStatus)
                    ? 'refresh-circle'
                    : isPermissionPartial(healthStatus)
                      ? 'warning'
                      : isError(healthStatus) ||
                          isPermissionDenied(healthStatus) ||
                          isDeviceUnavailable(healthStatus)
                        ? 'alert-circle'
                        : 'help-circle'
              }
              size={14}
              color={
                isConnected(healthStatus)
                  ? COLORS.SUCCESS
                  : isInitializing(healthStatus) ||
                      isCheckingAvailability(healthStatus) ||
                      isCheckingPermissions(healthStatus)
                    ? COLORS.WARNING
                    : isPermissionPartial(healthStatus)
                      ? COLORS.WARNING
                      : isError(healthStatus) ||
                          isPermissionDenied(healthStatus) ||
                          isDeviceUnavailable(healthStatus)
                        ? COLORS.ERROR
                        : COLORS.TEXT_SECONDARY
              }
            />
            <Text
              style={{
                fontSize: isLowEndDevice ? 11 : 12,
                color: COLORS.TEXT_SECONDARY,
                marginLeft: 4,
              }}
            >
              {isConnected(healthStatus)
                ? `Connected to ${deviceInfo?.name || 'Health Device'}`
                : isInitializing(healthStatus)
                  ? 'Initializing health providers...'
                  : isCheckingAvailability(healthStatus)
                    ? 'Checking device compatibility...'
                    : isCheckingPermissions(healthStatus)
                      ? 'Checking health permissions...'
                      : isRequestingPermissions(healthStatus)
                        ? 'Requesting permissions...'
                        : isPermissionGranted(healthStatus)
                          ? 'Permissions granted, connecting...'
                          : isPermissionPartial(healthStatus)
                            ? 'Limited health access'
                            : isPermissionDenied(healthStatus)
                              ? 'Health access denied'
                              : isDeviceUnavailable(healthStatus)
                                ? 'Health service unavailable'
                                : isError(healthStatus)
                                  ? 'Connection failed'
                                  : 'Using demo data'}
            </Text>
          </View>

          {deviceInfo && isConnected(healthStatus) && (
            <HealthProviderInfo
              providerName={deviceInfo.name || ''}
              lastSyncTime={lastSync || deviceInfo.lastSync || null}
            />
          )}
        </View>

        <View style={styles.metricsGrid}>
          {renderMetricCard(
            'walk',
            'Steps',
            isLowEndDevice
              ? displayData.steps.today.toString()
              : displayData.steps.today.toLocaleString(),
            'steps',
            COLORS.HEALTH_GREEN
          )}
          {renderMetricCard('heart', 'Heart Rate', displayData.heartRate, 'bpm', COLORS.HEALTH_RED)}
          {(() => {
            const sleepValue = displayData.sleep.duration ?? 'N/A';
            const isNumeric =
              typeof sleepValue === 'number' || /^\d+(\.\d+)?$/.test(String(sleepValue));
            const unit = isNumeric ? 'hours' : '';
            return renderMetricCard('moon', 'Sleep', sleepValue, unit, COLORS.HEALTH_PURPLE);
          })()}
          {renderMetricCard(
            'flame',
            'Calories',
            typeof displayData.calories === 'number'
              ? isLowEndDevice
                ? displayData.calories.toString()
                : displayData.calories.toLocaleString()
              : displayData.calories || 'N/A',
            'kcal',
            COLORS.HEALTH_ORANGE
          )}
        </View>

        {isNoData(healthStatus) && (
          <View style={[styles.demoNotice, isLowEndDevice && styles.demoNoticeCompact]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="information-circle" size={20} color={COLORS.WARNING} />
              <Text style={[styles.demoNoticeText, { marginLeft: 8, flex: 1 }]}>
                No health data available. Connect your {providerInfo.name} to view your real health
                metrics.
              </Text>
            </View>

            <Text
              style={{
                fontSize: isLowEndDevice ? 11 : 12,
                color: COLORS.TEXT_SECONDARY,
                marginBottom: isLowEndDevice ? 8 : 12,
              }}
            >
              Data Source: {displayData.dataSource}
              {!isLowEndDevice &&
                ` • Updated: ${new Date(displayData.timestamp).toLocaleTimeString()}`}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.refreshDemoButton, { flex: 1 }]} onPress={refresh}>
                <Ionicons name="refresh" size={16} color={COLORS.PRIMARY} />
                <Text style={styles.refreshDemoButtonText}>Refresh Data</Text>
              </TouchableOpacity>

              {!isInitializing(healthStatus) &&
                !isCheckingAvailability(healthStatus) &&
                !isCheckingPermissions(healthStatus) && (
                  <TouchableOpacity
                    style={[styles.refreshDemoButton, { flex: 1, backgroundColor: COLORS.SUCCESS }]}
                    onPress={retryInitialization}
                  >
                    <Ionicons name="link" size={16} color={COLORS.WHITE} />
                    <Text style={[styles.refreshDemoButtonText, { color: COLORS.WHITE }]}>
                      Connect Health
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        )}
      </ScrollView>
    </AdaptiveLinearGradient>
  );
};

const HealthDashboardScreen: React.FC = () => (
  <AsyncErrorBoundary>
    <HealthDashboardScreenContent />
  </AsyncErrorBoundary>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollViewContent: {
    padding: SPACING.MD,
    paddingBottom: SPACING.XL,
  },
  header: {
    marginBottom: SPACING.LG,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_HEADING,
    fontSize: TYPOGRAPHY.FONT_SIZE_3XL,
    color: COLORS.TEXT_PRIMARY,
  },
  demoIndicator: {
    fontSize: TYPOGRAPHY.FONT_SIZE_3XL,
    color: COLORS.PRIMARY,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -SPACING.SM / 2,
  },
  metricCard: {
    width: '48%',
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
    marginBottom: SPACING.MD,
    ...SHADOWS.MEDIUM,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.MD,
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.XS,
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    color: COLORS.TEXT_PRIMARY,
  },
  metricUnit: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: SPACING.XS,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
    backgroundColor: 'transparent',
  },
  errorText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    color: COLORS.ERROR,
    textAlign: 'center',
    marginBottom: SPACING.MD,
  },
  errorSubtext: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    marginBottom: SPACING.MD,
  },
  retryText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.WHITE,
  },
  demoButton: {
    backgroundColor: COLORS.SECONDARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
  },
  demoButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.WHITE,
  },
  secondaryButton: {
    backgroundColor: COLORS.LIGHT_GRAY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.TEXT_SECONDARY,
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  providerInfoCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.LG,
    alignItems: 'center',
    marginBottom: SPACING.LG,
    ...SHADOWS.MEDIUM,
    width: '100%',
  },
  providerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.MD,
  },
  providerName: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
  },
  providerDescription: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  setupInstructions: {
    marginTop: SPACING.LG,
    padding: SPACING.MD,
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: BORDER_RADIUS.MD,
    width: '100%',
  },
  setupTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
  },
  setupText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
  },
  demoNotice: {
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
    marginTop: SPACING.LG,
  },
  demoNoticeCompact: {
    padding: SPACING.SM,
  },
  demoNoticeText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
  },
  refreshDemoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.SM,
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.SM,
    ...SHADOWS.SMALL,
  },
  refreshDemoButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.PRIMARY,
    marginLeft: SPACING.SM,
  },
  permissionRequestCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.LG,
    alignItems: 'center',
    marginTop: SPACING.LG,
    ...SHADOWS.MEDIUM,
    width: '100%',
  },
  permissionRequestTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.MD,
    marginBottom: SPACING.SM,
    textAlign: 'center',
  },
  permissionRequestText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionActionButtons: {
    width: '100%',
    marginTop: SPACING.LG,
  },
  flexFill: { flex: 1 },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    marginBottom: SPACING.MD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.WHITE,
    marginLeft: SPACING.SM,
    fontWeight: '600',
  },
});

export default HealthDashboardScreen;
// Also export named for test/import compatibility
export { HealthDashboardScreen };
