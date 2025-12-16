import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import Svg, { Rect, Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { WeeklyStepData } from '../../hooks/health/useMonthlyWeeks';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants';
import { safeHaptics } from '../../utils/runtimeSafety';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 220;

interface MonthlyWeeksChartProps {
  data: WeeklyStepData[];
  maxSteps?: number;
  isLoading?: boolean;
}

export const MonthlyWeeksChart: React.FC<MonthlyWeeksChartProps> = ({
  data,
  maxSteps: propMaxSteps,
  isLoading = false
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // Calculate chart dimensions based on number of weeks (4 or 5)
  const numWeeks = data.length || 5;
  const CHART_WIDTH = SCREEN_WIDTH - SPACING.XL * 2;
  const BAR_SPACING = numWeeks === 5 ? 6 : 8;
  const BAR_WIDTH = (CHART_WIDTH - BAR_SPACING * (numWeeks - 1)) / numWeeks;

  // FIXED: Always create exactly 5 animated values (max weeks in a month)
  const animatedValues = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0))
  ).current;

  // Calculate max steps for scaling (with 10% padding)
  const maxSteps = propMaxSteps || Math.max(...data.map(d => d.steps), 1000) * 1.1;

  // Show loading skeleton
  if (isLoading || data.length === 0) {
    return (
      <View style={styles.container}>
        <BlurView intensity={15} style={styles.liquidGlassCard}>
          <ExpoLinearGradient
            colors={['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.header}>
            <Text style={styles.title}>Monthly Progress</Text>
            <Text style={styles.subtitle}>Weeks in current month</Text>
          </View>
          <View style={[styles.loadingContainer, { height: CHART_HEIGHT }]}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading monthly data...</Text>
          </View>
        </BlurView>
      </View>
    );
  }

  // Animation values for bars
  useEffect(() => {
    // Reset all animations when data changes
    animatedValues.forEach(anim => anim.setValue(0));

    // Only animate the weeks that have data
    const animations = animatedValues.slice(0, data.length).map((anim, index) =>
      Animated.spring(anim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        delay: index * 80,
        useNativeDriver: false,
      })
    );

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }, [data, animatedValues]);

  // Pulsing animation for current week's bar
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const currentWeekIndex = data.findIndex(d => d.isCurrentWeek);
    if (currentWeekIndex !== -1) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [data]);

  // Generate smooth curve path using cubic bezier curves
  // IMPORTANT: Only connect weeks up to current week (exclude future weeks)
  const generateCurvePath = (): string => {
    if (data.length === 0) return '';

    // Filter out future weeks - curve should stop at current week
    const pastAndCurrentData = data.filter(d => !d.isFuture);

    if (pastAndCurrentData.length === 0) return '';

    const points = pastAndCurrentData.map((d, index) => {
      // Find original index to calculate correct x position
      const originalIndex = data.findIndex(item => item.weekNumber === d.weekNumber);
      return {
        x: BAR_WIDTH / 2 + originalIndex * (BAR_WIDTH + BAR_SPACING),
        y: CHART_HEIGHT - 40 - (d.steps / maxSteps) * (CHART_HEIGHT - 60),
      };
    });

    if (points.length === 1) {
      return `M ${points[0].x},${points[0].y}`;
    }

    let path = `M ${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      // Calculate control points for smooth curve
      const controlX1 = current.x + (next.x - current.x) / 3;
      const controlY1 = current.y;
      const controlX2 = next.x - (next.x - current.x) / 3;
      const controlY2 = next.y;

      path += ` C ${controlX1},${controlY1} ${controlX2},${controlY2} ${next.x},${next.y}`;
    }

    return path;
  };

  const curvePath = generateCurvePath();

  // Calculate totals (exclude future weeks)
  const pastAndCurrentData = data.filter(d => !d.isFuture);
  const totalSteps = pastAndCurrentData.reduce((sum, week) => sum + week.steps, 0);
  const averageSteps = pastAndCurrentData.length > 0 ? Math.round(totalSteps / pastAndCurrentData.length) : 0;

  // Handle week selection with haptic feedback
  const handleWeekPress = (index: number) => {
    safeHaptics.selection();
    setSelectedWeek(selectedWeek === index ? null : index);
  };

  // Get month name
  const getMonthName = () => {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={15} style={styles.liquidGlassCard}>
        <ExpoLinearGradient
          colors={['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      {/* Chart Title */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Monthly Progress</Text>
          <Text style={styles.subtitle}>{getMonthName()}</Text>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalSteps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{averageSteps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Avg/week</Text>
          </View>
        </View>
      </View>

      {/* SVG Chart */}
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={styles.chart}>
        <Defs>
          {/* Gradient for bars */}
          <LinearGradient id="weekBarGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#667eea" stopOpacity="1" />
            <Stop offset="1" stopColor="#764ba2" stopOpacity="0.8" />
          </LinearGradient>

          {/* Gradient for current week's bar */}
          <LinearGradient id="currentWeekGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#34C759" stopOpacity="1" />
            <Stop offset="1" stopColor="#30D158" stopOpacity="0.8" />
          </LinearGradient>

          {/* Gradient for selected bar */}
          <LinearGradient id="selectedWeekGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF9500" stopOpacity="1" />
            <Stop offset="1" stopColor="#FF6B00" stopOpacity="0.8" />
          </LinearGradient>

          {/* Gradient for the area under curve */}
          <LinearGradient id="weekAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#667eea" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#667eea" stopOpacity="0.05" />
          </LinearGradient>

          {/* Gradient for future weeks */}
          <LinearGradient id="futureWeekGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E5E5EA" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#E5E5EA" stopOpacity="0.2" />
          </LinearGradient>
        </Defs>

        {/* Bars */}
        <G>
          {data.map((week, index) => {
            const barHeight = (week.steps / maxSteps) * (CHART_HEIGHT - 60);
            const x = index * (BAR_WIDTH + BAR_SPACING);
            const y = CHART_HEIGHT - 40 - barHeight;

            // Style future weeks differently
            let fill = 'url(#weekBarGradient)';
            let opacity = 0.9;

            if (week.isFuture) {
              // Future weeks: light gray, minimal height
              fill = 'url(#futureWeekGradient)';
              opacity = 0.4;
            } else if (selectedWeek === index) {
              fill = 'url(#selectedWeekGradient)';
            } else if (week.isCurrentWeek) {
              fill = 'url(#currentWeekGradient)';
            }

            // Show minimum bar for future weeks (placeholder)
            const displayHeight = week.isFuture ? 20 : barHeight;
            const displayY = week.isFuture ? CHART_HEIGHT - 40 - 20 : y;

            return (
              <React.Fragment key={index}>
                {/* Bar */}
                <Rect
                  x={x}
                  y={displayY}
                  width={BAR_WIDTH}
                  height={displayHeight}
                  fill={fill}
                  rx={8}
                  ry={8}
                  opacity={opacity}
                  stroke={week.isFuture ? '#C7C7CC' : undefined}
                  strokeWidth={week.isFuture ? 1.5 : 0}
                  strokeDasharray={week.isFuture ? '4,4' : undefined}
                />

                {/* Current week indicator */}
                {week.isCurrentWeek && !week.isFuture && (
                  <Circle
                    cx={x + BAR_WIDTH / 2}
                    cy={y - 10}
                    r={4}
                    fill="#34C759"
                  />
                )}
              </React.Fragment>
            );
          })}
        </G>

        {/* Area under curve */}
        {curvePath && (
          <Path
            d={`${curvePath} L ${CHART_WIDTH},${CHART_HEIGHT - 40} L 0,${CHART_HEIGHT - 40} Z`}
            fill="url(#weekAreaGradient)"
          />
        )}

        {/* Curve Line Glow Effect */}
        <Path
          d={curvePath}
          stroke="#667eea"
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.15}
        />

        {/* Main Curve Line */}
        <Path
          d={curvePath}
          stroke="#667eea"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />

        {/* Data Points - Only show for past and current week */}
        <G>
          {data.map((week, index) => {
            // Skip future weeks
            if (week.isFuture) return null;

            const cx = BAR_WIDTH / 2 + index * (BAR_WIDTH + BAR_SPACING);
            const cy = CHART_HEIGHT - 40 - (week.steps / maxSteps) * (CHART_HEIGHT - 60);

            return (
              <React.Fragment key={`point-${index}`}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={week.isCurrentWeek ? 7 : 5}
                  fill={week.isCurrentWeek ? '#34C759' : '#667eea'}
                  stroke="#fff"
                  strokeWidth={2}
                />
              </React.Fragment>
            );
          })}
        </G>
      </Svg>

      {/* Week Labels and Touch Area */}
      <View style={styles.labelsContainer}>
        {data.map((week, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.weekLabel,
              { width: BAR_WIDTH },
              week.isCurrentWeek && styles.currentWeekLabel,
              selectedWeek === index && styles.selectedLabel,
            ]}
            onPress={() => handleWeekPress(index)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.weekLabelText,
                week.isCurrentWeek && styles.currentWeekLabelText,
                selectedWeek === index && styles.selectedLabelText,
                week.isFuture && styles.futureLabelText,
              ]}
            >
              {week.label}
            </Text>
            <Text
              style={[
                styles.weekDateRange,
                week.isCurrentWeek && styles.currentWeekDateRange,
                selectedWeek === index && styles.selectedDateRange,
                week.isFuture && styles.futureDateRange,
              ]}
            >
              {week.startDate.getDate()}-{week.endDate.getDate()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

        {/* Selected Week Details */}
        {selectedWeek !== null && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsSteps}>{data[selectedWeek].steps.toLocaleString()}</Text>
            <Text style={styles.detailsLabel}>steps</Text>
            <Text style={styles.detailsDate}>
              {data[selectedWeek].startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {data[selectedWeek].endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        )}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.LG,
    marginVertical: SPACING.MD,
  },
  liquidGlassCard: {
    borderRadius: BORDER_RADIUS.XL,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    padding: SPACING.LG,
    ...SHADOWS.MEDIUM,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.LG,
  },
  title: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XS / 2,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.08)',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    marginHorizontal: SPACING.SM,
  },
  chart: {
    marginBottom: SPACING.SM,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.SM,
  },
  weekLabel: {
    alignItems: 'center',
    paddingVertical: SPACING.XS,
    borderRadius: 8,
  },
  currentWeekLabel: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  selectedLabel: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  weekLabelText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '600',
    marginBottom: 2,
  },
  currentWeekLabelText: {
    color: '#34C759',
    fontWeight: '700',
  },
  selectedLabelText: {
    color: '#FF9500',
    fontWeight: '700',
  },
  futureLabelText: {
    color: '#C7C7CC',
    fontWeight: '500',
  },
  weekDateRange: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '500',
  },
  currentWeekDateRange: {
    color: '#34C759',
    fontWeight: '700',
  },
  selectedDateRange: {
    color: '#FF9500',
    fontWeight: '700',
  },
  futureDateRange: {
    color: '#C7C7CC',
    fontWeight: '500',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  loadingText: {
    marginTop: SPACING.MD,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  detailsCard: {
    marginTop: SPACING.MD,
    padding: SPACING.MD,
    backgroundColor: 'rgba(102, 126, 234, 0.08)',
    borderRadius: 12,
    alignItems: 'center',
  },
  detailsSteps: {
    fontSize: 32,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: SPACING.XS / 2,
  },
  detailsLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
    marginBottom: SPACING.XS,
  },
  detailsDate: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '600',
  },
});
