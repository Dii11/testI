import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import Svg, { Rect, Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { DailyStepData } from '../../hooks/health/useWeeklySteps';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants';
import { safeHaptics } from '../../utils/runtimeSafety';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - SPACING.XL * 2;
const CHART_HEIGHT = 220;
const BAR_SPACING = 8;
const BAR_WIDTH = (CHART_WIDTH - BAR_SPACING * 6) / 7;

interface WeeklyStepsChartProps {
  data: DailyStepData[];
  maxSteps?: number;
  isLoading?: boolean;
}

export const WeeklyStepsChart: React.FC<WeeklyStepsChartProps> = ({
  data,
  maxSteps: propMaxSteps,
  isLoading = false
}) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // FIXED: Always create exactly 7 animated values (one per day of week)
  // This prevents "Rendered more hooks than during the previous render" error
  const animatedValues = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(0))
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
            <Text style={styles.title}>Weekly Activity</Text>
            <Text style={styles.subtitle}>Last 7 days</Text>
          </View>
          <View style={[styles.loadingContainer, { height: CHART_HEIGHT }]}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading weekly data...</Text>
          </View>
        </BlurView>
      </View>
    );
  }

  // Animation values for bars
  useEffect(() => {
    // Reset all animations when data changes
    animatedValues.forEach(anim => anim.setValue(0));

    // Only animate the days that have data
    const animations = animatedValues.slice(0, data.length).map((anim, index) =>
      Animated.spring(anim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        delay: index * 60,
        useNativeDriver: false,
      })
    );

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }, [data, animatedValues]);

  // Pulsing animation for today's bar
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const todayIndex = data.findIndex(d => d.isToday);
    if (todayIndex !== -1) {
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
  // IMPORTANT: Only connect days up to today (exclude future days)
  const generateCurvePath = (): string => {
    if (data.length === 0) return '';

    // Filter out future days - curve should stop at today
    const pastAndTodayData = data.filter(d => !d.isFuture);

    if (pastAndTodayData.length === 0) return '';

    const points = pastAndTodayData.map((d, index) => {
      // Find original index to calculate correct x position
      const originalIndex = data.findIndex(item => item.date === d.date);
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

  // Calculate totals (exclude future days)
  const pastAndTodayData = data.filter(d => !d.isFuture);
  const totalSteps = pastAndTodayData.reduce((sum, day) => sum + day.steps, 0);
  const averageSteps = pastAndTodayData.length > 0 ? Math.round(totalSteps / pastAndTodayData.length) : 0;
  const todaySteps = data.find(d => d.isToday)?.steps || 0;

  // Handle day selection with haptic feedback
  const handleDayPress = (index: number) => {
    safeHaptics.selection();
    setSelectedDay(selectedDay === index ? null : index);
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
            <Text style={styles.title}>Weekly Activity</Text>
            <Text style={styles.subtitle}>Last 7 days</Text>
          </View>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalSteps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{averageSteps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Avg/day</Text>
          </View>
        </View>
      </View>

      {/* SVG Chart */}
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={styles.chart}>
        <Defs>
          {/* Gradient for bars */}
          <LinearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#667eea" stopOpacity="1" />
            <Stop offset="1" stopColor="#764ba2" stopOpacity="0.8" />
          </LinearGradient>

          {/* Gradient for today's bar */}
          <LinearGradient id="todayGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#34C759" stopOpacity="1" />
            <Stop offset="1" stopColor="#30D158" stopOpacity="0.8" />
          </LinearGradient>

          {/* Gradient for selected bar */}
          <LinearGradient id="selectedGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF9500" stopOpacity="1" />
            <Stop offset="1" stopColor="#FF6B00" stopOpacity="0.8" />
          </LinearGradient>

          {/* Gradient for the area under curve */}
          <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#667eea" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#667eea" stopOpacity="0.05" />
          </LinearGradient>

          {/* Gradient for future days */}
          <LinearGradient id="futureGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E5E5EA" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#E5E5EA" stopOpacity="0.2" />
          </LinearGradient>
        </Defs>

        {/* Bars */}
        <G>
          {data.map((day, index) => {
            const barHeight = (day.steps / maxSteps) * (CHART_HEIGHT - 60);
            const x = index * (BAR_WIDTH + BAR_SPACING);
            const y = CHART_HEIGHT - 40 - barHeight;

            // Style future days differently
            let fill = 'url(#barGradient)';
            let opacity = 0.9;

            if (day.isFuture) {
              // Future days: light gray, minimal height
              fill = 'url(#futureGradient)';
              opacity = 0.4;
            } else if (selectedDay === index) {
              fill = 'url(#selectedGradient)';
            } else if (day.isToday) {
              fill = 'url(#todayGradient)';
            }

            // Show minimum bar for future days (placeholder)
            const displayHeight = day.isFuture ? 20 : barHeight;
            const displayY = day.isFuture ? CHART_HEIGHT - 40 - 20 : y;

            return (
              <React.Fragment key={index}>
                {/* Bar */}
                <Rect
                  x={x}
                  y={displayY}
                  width={BAR_WIDTH}
                  height={displayHeight}
                  fill={fill}
                  rx={6}
                  ry={6}
                  opacity={opacity}
                  stroke={day.isFuture ? '#C7C7CC' : undefined}
                  strokeWidth={day.isFuture ? 1.5 : 0}
                  strokeDasharray={day.isFuture ? '4,4' : undefined}
                />

                {/* Today indicator */}
                {day.isToday && !day.isFuture && (
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
            fill="url(#areaGradient)"
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

        {/* Data Points - Only show for past and today */}
        <G>
          {data.map((day, index) => {
            // Skip future days
            if (day.isFuture) return null;

            const cx = BAR_WIDTH / 2 + index * (BAR_WIDTH + BAR_SPACING);
            const cy = CHART_HEIGHT - 40 - (day.steps / maxSteps) * (CHART_HEIGHT - 60);

            return (
              <React.Fragment key={`point-${index}`}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={day.isToday ? 7 : 5}
                  fill={day.isToday ? '#34C759' : '#667eea'}
                  stroke="#fff"
                  strokeWidth={2}
                />
              </React.Fragment>
            );
          })}
        </G>
      </Svg>

      {/* Day Labels and Touch Area */}
      <View style={styles.labelsContainer}>
        {data.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayLabel,
              { width: BAR_WIDTH },
              day.isToday && styles.todayLabel,
              selectedDay === index && styles.selectedLabel,
            ]}
            onPress={() => handleDayPress(index)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.dayName,
                day.isToday && styles.todayDayName,
                selectedDay === index && styles.selectedDayName,
                day.isFuture && styles.futureDayName,
              ]}
            >
              {day.dayName}
            </Text>
            <Text
              style={[
                styles.dayNumber,
                day.isToday && styles.todayDayNumber,
                selectedDay === index && styles.selectedDayNumber,
                day.isFuture && styles.futureDayNumber,
              ]}
            >
              {day.dayNumber}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

        {/* Selected Day Details */}
        {selectedDay !== null && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsSteps}>{data[selectedDay].steps.toLocaleString()}</Text>
            <Text style={styles.detailsLabel}>steps</Text>
            <Text style={styles.detailsDate}>
              {data[selectedDay].date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
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
  dayLabel: {
    alignItems: 'center',
    paddingVertical: SPACING.XS,
    borderRadius: 8,
  },
  todayLabel: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  selectedLabel: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  dayName: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '600',
    marginBottom: 2,
  },
  todayDayName: {
    color: '#34C759',
    fontWeight: '700',
  },
  selectedDayName: {
    color: '#FF9500',
    fontWeight: '700',
  },
  dayNumber: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '600',
  },
  todayDayNumber: {
    color: '#34C759',
    fontWeight: '700',
  },
  selectedDayNumber: {
    color: '#FF9500',
    fontWeight: '700',
  },
  futureDayName: {
    color: '#C7C7CC',
    fontWeight: '500',
  },
  futureDayNumber: {
    color: '#C7C7CC',
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
});
