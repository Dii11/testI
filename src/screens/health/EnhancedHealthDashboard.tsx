import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { useSelector } from 'react-redux';

import { HealthErrorBoundary } from '../../components/common/HealthErrorBoundary';
import { HealthMetricCard } from '../../components/health/EnhancedHealthMetricCard';
import { HealthActivityRings } from '../../components/health/HealthActivityRings';
import { HealthChart } from '../../components/health/HealthChart';
import { HealthGoalsCard } from '../../components/health/HealthGoalsCard';
import { HealthInsightsCard } from '../../components/health/HealthInsightsCard';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants';
import { AdaptiveLinearGradient } from '../../components/adaptive/AdaptiveComponents';
import {
  selectDashboardMetrics,
  selectHealthLoading,
  selectChartData,
  selectHealthMetrics,
} from '../../store/selectors/healthSelectors';

// Note: HealthTrendIndicator component needs to be created or this import should be removed
import { HealthDataType } from '../../types/health';
import { safeHaptics, safeNavigation } from '../../utils/runtimeSafety';

import { useHealthData } from './useHealthData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_IOS = Platform.OS === 'ios';

// Enhanced color palette for health metrics
const HEALTH_COLORS = {
  heartRate: '#FF3B30',
  steps: '#34C759',
  sleep: '#5856D6',
  calories: '#FF9500',
  activity: '#00C7BE',
  mindfulness: '#FF2D55',
  water: '#007AFF',
  nutrition: '#FFCC00',
};

// Time periods for data visualization
const TIME_PERIODS = ['Day', 'Week', 'Month', 'Year'] as const;
type TimePeriod = (typeof TIME_PERIODS)[number];

const EnhancedHealthDashboard: React.FC = () => {
  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Day');
  const [showInsights, setShowInsights] = useState(true);

  const { status, refresh, requestPermissions, retryInitialization } = useHealthData();

  const dashboardMetrics = useSelector(selectDashboardMetrics);
  const isLoading = useSelector(selectHealthLoading);
  const healthMetrics = useSelector(selectHealthMetrics);

  // Get real chart data based on selected period
  const periodMap = {
    Day: 'daily',
    Week: 'weekly',
    Month: 'monthly',
    Year: 'monthly', // Use monthly for year view too
  } as const;

  const stepsChartData = useSelector(
    selectChartData(HealthDataType.STEPS, periodMap[selectedPeriod] as any)
  );
  const heartRateChartData = useSelector(
    selectChartData(HealthDataType.HEART_RATE, periodMap[selectedPeriod] as any)
  );

  // Animated header collapse
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [220, 120],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  // Entrance animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // Calculate health score based on metrics with null safety
  const healthScore = useMemo(() => {
    try {
      if (!dashboardMetrics) return 0;

      let score = 0;
      let factors = 0;

      // Steps contribution (max 30 points)
      if (dashboardMetrics.steps.today && dashboardMetrics.steps.goal) {
        const today = dashboardMetrics.steps.today || 0;
        const goal = dashboardMetrics.steps.goal || 10000;
        const stepScore = Math.min((today / goal) * 30, 30);
        score += stepScore;
        factors++;
      }

      // Heart rate contribution (max 25 points)
      if (
        dashboardMetrics.heartRate &&
        typeof dashboardMetrics.heartRate === 'number' &&
        dashboardMetrics.heartRate > 0
      ) {
        const hr = dashboardMetrics.heartRate;
        const hrScore = hr >= 60 && hr <= 100 ? 25 : Math.max(15 - Math.abs(hr - 80) / 4, 5);
        score += hrScore;
        factors++;
      }

      // Sleep contribution (max 25 points)
      if (dashboardMetrics.sleep?.hours && dashboardMetrics.sleep.hours > 0) {
        const hours = dashboardMetrics.sleep.hours;
        const sleepScore = Math.min((hours / 8) * 25, 25);
        score += sleepScore;
        factors++;
      }

      // Activity contribution (max 20 points)
      if (
        dashboardMetrics.calories &&
        typeof dashboardMetrics.calories === 'number' &&
        dashboardMetrics.calories > 0
      ) {
        const calories = dashboardMetrics.calories;
        const calorieScore = Math.min((calories / 500) * 20, 20);
        score += calorieScore;
        factors++;
      }

      return factors > 0 ? Math.round(Math.max(0, Math.min(100, score))) : 0;
    } catch (error) {
      console.warn('Error calculating health score:', error);
      return 0;
    }
  }, [dashboardMetrics]);

  // Generate health insights with defensive programming
  const healthInsights = useMemo(() => {
    try {
      const insights = [];

      // Safe steps insights
      if (dashboardMetrics.steps.today !== undefined && dashboardMetrics.steps.goal) {
        const today = Math.max(0, dashboardMetrics.steps.today || 0);
        const goal = Math.max(1, dashboardMetrics.steps.goal || 10000);
        const stepPercentage = (today / goal) * 100;

        if (stepPercentage >= 100) {
          insights.push({
            type: 'success' as const,
            title: 'Step Goal Achieved!',
            message: `You've reached ${today.toLocaleString()} steps today!`,
            icon: 'trophy' as const,
          });
        } else if (stepPercentage >= 75) {
          const remaining = Math.max(0, goal - today);
          insights.push({
            type: 'info' as const,
            title: 'Almost There!',
            message: `Just ${remaining.toLocaleString()} more steps to reach your goal.`,
            icon: 'walk' as const,
          });
        }
      }

      // Safe sleep insights
      if (dashboardMetrics.sleep?.hours && typeof dashboardMetrics.sleep.hours === 'number') {
        const hours = dashboardMetrics.sleep.hours;
        if (hours > 0 && hours < 7) {
          insights.push({
            type: 'warning' as const,
            title: 'Sleep Alert',
            message: `You got ${hours.toFixed(1)} hours of sleep. Try to maintain 7-9 hours for optimal health.`,
            icon: 'moon' as const,
          });
        }
      }

      // Safe heart rate insights
      if (dashboardMetrics.heartRate && typeof dashboardMetrics.heartRate === 'number') {
        const hr = dashboardMetrics.heartRate;
        if (hr > 0 && hr > 100) {
          insights.push({
            type: 'warning' as const,
            title: 'Elevated Heart Rate',
            message: `Your resting heart rate is ${hr} bpm. Consider relaxation techniques if persistently high.`,
            icon: 'heart' as const,
          });
        } else if (hr > 0 && hr < 50) {
          insights.push({
            type: 'info' as const,
            title: 'Low Heart Rate',
            message: `Your resting heart rate is ${hr} bpm. This could indicate good fitness or may need medical attention.`,
            icon: 'heart' as const,
          });
        }
      }

      return insights;
    } catch (error) {
      console.warn('Error generating health insights:', error);
      return [];
    }
  }, [dashboardMetrics]);

  const handleMetricPress = useCallback((metric: HealthDataType) => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Implement metric detail view
    console.log('Metric pressed:', metric);
  }, []);

  const handlePeriodChange = useCallback((period: TimePeriod) => {
    safeHaptics.selection();
    setSelectedPeriod(period);
  }, []);

  const renderHeader = () => (
    <Animated.View style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}>
      <LinearGradient
        colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <BlurView intensity={20} style={styles.headerContent}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.headerTitle}>Health Overview</Text>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => safeNavigation.navigate(navigation, 'HealthSettings')}
          >
            <Ionicons name="settings-outline" size={24} color={COLORS.WHITE} />
          </TouchableOpacity>
        </View>

        <View style={styles.healthScoreContainer}>
          <View style={styles.healthScoreCircle}>
            <Text style={styles.healthScoreValue}>{healthScore}</Text>
            <Text style={styles.healthScoreLabel}>Health Score</Text>
          </View>

          <View style={styles.healthScoreDetails}>
            <Text style={styles.healthScoreTitle}>{getHealthScoreMessage(healthScore)}</Text>
            <Text style={styles.healthScoreSubtitle}>Based on today's activity and vitals</Text>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );

  const renderTimePeriodSelector = () => (
    <View style={styles.periodSelector}>
      {TIME_PERIODS.map(period => (
        <TouchableOpacity
          key={period}
          style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
          onPress={() => handlePeriodChange(period)}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.periodButtonTextActive,
            ]}
          >
            {period}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderActivityRings = () => {
    // Only show activity rings if we have real data
    const hasData = dashboardMetrics.steps.progress || dashboardMetrics.calories;

    return (
      <View style={styles.activitySection}>
        <Text style={styles.sectionTitle}>Activity Rings</Text>
        {hasData ? (
          <HealthActivityRings
            move={dashboardMetrics.steps.progress || 0}
            exercise={dashboardMetrics.calories ? (dashboardMetrics.calories / 500) * 100 : 0}
            stand={0} // Stand hours not available - showing 0 instead of fake data
            size={SCREEN_WIDTH - SPACING.XL * 2}
          />
        ) : (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="analytics-outline" size={48} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.emptyStateText}>No activity data available</Text>
            <Text style={styles.emptyStateSubtext}>
              {status === 'permission_denied' || status === 'permission_partial'
                ? 'Enable permissions to track activity'
                : 'Sync your device to see activity rings'}
            </Text>
            {(status === 'permission_denied' || status === 'permission_partial') && (
              <TouchableOpacity style={styles.retryButton} onPress={requestPermissions}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.PRIMARY} />
                <Text style={styles.retryButtonText}>Enable Access</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderMetricsGrid = () => {
    // Check if we have any real data
    const hasStepsData = dashboardMetrics.steps.today > 0;
    const hasHeartRateData = dashboardMetrics.heartRate && dashboardMetrics.heartRate > 0;
    const hasSleepData = dashboardMetrics.sleep?.hours && dashboardMetrics.sleep.hours > 0;
    const hasCaloriesData = dashboardMetrics.calories && dashboardMetrics.calories > 0;
    const hasAnyData = hasStepsData || hasHeartRateData || hasSleepData || hasCaloriesData;

    // Show permission prompt if no data and permissions are the issue
    if (!hasAnyData && (status === 'permission_denied' || status === 'permission_partial')) {
      return (
        <View style={styles.metricsGrid}>
          <View style={styles.permissionContainer}>
            <Ionicons name="shield-outline" size={48} color={COLORS.PRIMARY} />
            <Text style={styles.permissionTitle}>
              {status === 'permission_partial' ? 'Limited Health Access' : 'Health Access Required'}
            </Text>
            <Text style={styles.permissionSubtext}>
              {status === 'permission_partial'
                ? 'Some health features are limited. Grant more access to see all metrics.'
                : 'Enable health data access to track your wellness metrics.'}
            </Text>

            <View style={styles.permissionButtons}>
              <TouchableOpacity style={styles.primaryPermissionButton} onPress={requestPermissions}>
                <Ionicons name="shield-checkmark" size={20} color={COLORS.WHITE} />
                <Text style={styles.primaryPermissionButtonText}>
                  {status === 'permission_partial' ? 'Grant More Access' : 'Enable Health Access'}
                </Text>
              </TouchableOpacity>

              {status === 'permission_partial' && (
                <TouchableOpacity
                  style={styles.secondaryPermissionButton}
                  onPress={retryInitialization}
                >
                  <Text style={styles.secondaryPermissionButtonText}>
                    Continue with Limited Data
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    }

    // Show general empty state if no data but not a permission issue
    if (!hasAnyData) {
      return (
        <View style={styles.metricsGrid}>
          <View style={styles.emptyStateContainer}>
            <Ionicons name="fitness-outline" size={48} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.emptyStateText}>No health data available</Text>
            <Text style={styles.emptyStateSubtext}>
              {status === 'device_unavailable'
                ? 'Health platform not available on this device'
                : 'Sync your health device to see metrics'}
            </Text>

            {status === 'error' && (
              <TouchableOpacity style={styles.retryButton} onPress={retryInitialization}>
                <Ionicons name="refresh" size={16} color={COLORS.PRIMARY} />
                <Text style={styles.retryButtonText}>Retry Connection</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Calculate real trends based on historical data
    const stepsData = healthMetrics.steps || {};
    const stepsTrend = stepsData.trend || 'stable';

    return (
      <View style={styles.metricsGrid}>
        <HealthMetricCard
          type={HealthDataType.STEPS}
          value={dashboardMetrics.steps.today || 0}
          goal={dashboardMetrics.steps.goal || 10000}
          unit="steps"
          color={HEALTH_COLORS.steps}
          icon="walk"
          trend={stepsTrend as 'up' | 'down' | 'stable'}
          onPress={() => handleMetricPress(HealthDataType.STEPS)}
        />

        <HealthMetricCard
          type={HealthDataType.HEART_RATE}
          value={dashboardMetrics.heartRate || 0}
          unit="bpm"
          color={HEALTH_COLORS.heartRate}
          icon="heart"
          onPress={() => handleMetricPress(HealthDataType.HEART_RATE)}
        />

        <HealthMetricCard
          type={HealthDataType.SLEEP}
          value={dashboardMetrics.sleep?.hours || 0}
          unit="hours"
          color={HEALTH_COLORS.sleep}
          icon="moon"
          onPress={() => handleMetricPress(HealthDataType.SLEEP)}
        />

        <HealthMetricCard
          type={HealthDataType.CALORIES_BURNED}
          value={dashboardMetrics.calories || 0}
          unit="kcal"
          color={HEALTH_COLORS.calories}
          icon="flame"
          goal={500}
          onPress={() => handleMetricPress(HealthDataType.CALORIES_BURNED)}
        />
      </View>
    );
  };

  const renderCharts = () => {
    // Use real chart data from the store
    const hasChartData = stepsChartData.length > 0 || heartRateChartData.length > 0;

    // Transform data to have numeric x values for the chart
    const transformedData =
      stepsChartData.length > 0
        ? stepsChartData.map((point, index) => ({
            x: index,
            y: point.y,
            metadata: point.metadata,
          }))
        : heartRateChartData.map((point, index) => ({
            x: index,
            y: point.y,
            metadata: point.metadata,
          }));

    return (
      <View style={styles.chartsSection}>
        <Text style={styles.sectionTitle}>Trends</Text>
        {hasChartData ? (
          <HealthChart data={transformedData} type="line" period={selectedPeriod} height={200} />
        ) : (
          <View style={styles.emptyChartContainer}>
            <Ionicons name="trending-up-outline" size={48} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.emptyStateText}>No trend data available</Text>
            <Text style={styles.emptyStateSubtext}>
              {status === 'permission_denied' || status === 'permission_partial'
                ? 'Enable health permissions to see trends'
                : 'Sync your health device to see historical trends'}
            </Text>
            {(status === 'permission_denied' || status === 'permission_partial') && (
              <TouchableOpacity style={styles.retryButton} onPress={requestPermissions}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.PRIMARY} />
                <Text style={styles.retryButtonText}>Enable Access</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderInsights = () =>
    showInsights &&
    healthInsights.length > 0 && (
      <View style={styles.insightsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Health Insights</Text>
          <TouchableOpacity onPress={() => setShowInsights(false)}>
            <Ionicons name="close-circle-outline" size={20} color={COLORS.TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>

        {healthInsights.map((insight, index) => (
          <HealthInsightsCard
            key={index}
            type={insight.type}
            title={insight.title}
            message={insight.message}
            icon={insight.icon}
          />
        ))}
      </View>
    );

  const renderGoals = () => (
    <View style={styles.goalsSection}>
      <Text style={styles.sectionTitle}>Daily Goals</Text>
      <HealthGoalsCard
        goals={[
          {
            id: '1',
            type: HealthDataType.STEPS,
            target: dashboardMetrics.steps.goal || 10000,
            current: dashboardMetrics.steps.today || 0,
            unit: 'steps',
            icon: 'walk',
            color: HEALTH_COLORS.steps,
          },
          {
            id: '2',
            type: HealthDataType.CALORIES_BURNED,
            target: 500,
            current: dashboardMetrics.calories || 0,
            unit: 'kcal',
            icon: 'flame',
            color: HEALTH_COLORS.calories,
          },
          {
            id: '3',
            type: HealthDataType.SLEEP,
            target: 8,
            current: dashboardMetrics.sleep?.hours || 0,
            unit: 'hours',
            icon: 'moon',
            color: HEALTH_COLORS.sleep,
          },
        ]}
      />
    </View>
  );

  return (
    <HealthErrorBoundary>
      <AdaptiveLinearGradient fallbackColor={COLORS.PRIMARY} style={styles.container}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <Animated.ScrollView
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
            {renderHeader()}
            {renderTimePeriodSelector()}
            {renderActivityRings()}
            {renderMetricsGrid()}
            {renderCharts()}
            {renderInsights()}
            {renderGoals()}
          </Animated.ScrollView>

          {/* Floating Action Button */}
          <TouchableOpacity
            style={styles.fab}
            onPress={() => safeNavigation.navigate(navigation, 'AddHealthData')}
          >
            <LinearGradient
              colors={COLORS.BRAND_GRADIENT}
          locations={COLORS.BRAND_GRADIENT_LOCATIONS}
          start={COLORS.BRAND_GRADIENT_START}
              style={styles.fabGradient}
            >
              <Ionicons name="add" size={28} color={COLORS.WHITE} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </AdaptiveLinearGradient>
    </HealthErrorBoundary>
  );
};

// Helper functions
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
};

const getHealthScoreMessage = (score: number) => {
  if (score >= 80) return 'Excellent!';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Attention';
};

// Removed generateMockChartData - no fake data generation allowed

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: SPACING.XXL + 60, // Space for FAB
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
  healthScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.WHITE,
  },
  healthScoreValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  healthScoreLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  healthScoreDetails: {
    marginLeft: SPACING.MD,
    flex: 1,
  },
  healthScoreTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: SPACING.XS,
  },
  healthScoreSubtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    justifyContent: 'space-around',
  },
  periodButton: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: BORDER_RADIUS.PILL,
    backgroundColor: COLORS.LIGHT_GRAY,
  },
  periodButtonActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  periodButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: COLORS.WHITE,
  },
  activitySection: {
    padding: SPACING.LG,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.MD,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.MD,
  },
  metricsGrid: {
    paddingHorizontal: SPACING.LG,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  chartsSection: {
    padding: SPACING.LG,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.XXL,
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: BORDER_RADIUS.LG,
    marginTop: SPACING.MD,
  },
  emptyChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: BORDER_RADIUS.LG,
    marginTop: SPACING.MD,
  },
  emptyStateText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.MD,
  },
  emptyStateSubtext: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.XS,
    textAlign: 'center',
    paddingHorizontal: SPACING.XL,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.XXL,
    paddingHorizontal: SPACING.XL,
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.LG,
    marginTop: SPACING.MD,
    ...SHADOWS.MEDIUM,
  },
  permissionTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.MD,
    textAlign: 'center',
  },
  permissionSubtext: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.XS,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButtons: {
    marginTop: SPACING.XL,
    width: '100%',
    gap: SPACING.MD,
  },
  primaryPermissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    gap: SPACING.SM,
  },
  primaryPermissionButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  secondaryPermissionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.TEXT_SECONDARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
  },
  secondaryPermissionButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.MD,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    gap: SPACING.XS,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.PRIMARY,
    fontWeight: '500',
  },
  insightsSection: {
    padding: SPACING.LG,
  },
  goalsSection: {
    padding: SPACING.LG,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.XL,
    right: SPACING.LG,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...SHADOWS.LARGE,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default EnhancedHealthDashboard;
