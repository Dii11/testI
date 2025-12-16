import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Rect, Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - SPACING.LG * 2;
const CHART_HEIGHT = 240;

export interface ChartDataPoint {
  value: number;
  label: string;
  isCurrent: boolean;
  isFuture?: boolean;
}

interface UnifiedStepsChartProps {
  data: ChartDataPoint[];
  maxValue?: number;
}

export const UnifiedStepsChart: React.FC<UnifiedStepsChartProps> = ({
  data,
  maxValue: propMaxValue,
}) => {
  const numPoints = data.length;
  const BAR_SPACING = numPoints > 7 ? 4 : 8;
  const POINT_WIDTH = (CHART_WIDTH - BAR_SPACING * (numPoints - 1)) / numPoints;

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [data]);

  // Calculate max value for scaling (with 10% padding)
  const maxValue = propMaxValue || Math.max(...data.map(d => d.value), 1000) * 1.1;

  // Generate smooth curve path
  const generateCurvePath = (): string => {
    if (data.length === 0) return '';

    // Filter out future data points
    const pastAndCurrentData = data.filter(d => !d.isFuture);
    if (pastAndCurrentData.length === 0) return '';

    const points = pastAndCurrentData.map((d, index) => {
      const originalIndex = data.findIndex(item => item.label === d.label);
      return {
        x: POINT_WIDTH / 2 + originalIndex * (POINT_WIDTH + BAR_SPACING),
        y: CHART_HEIGHT - 60 - (d.value / maxValue) * (CHART_HEIGHT - 80),
      };
    });

    if (points.length === 1) {
      return `M ${points[0].x},${points[0].y}`;
    }

    let path = `M ${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      // Cubic bezier control points for smooth curve
      const controlX1 = current.x + (next.x - current.x) / 3;
      const controlY1 = current.y;
      const controlX2 = next.x - (next.x - current.x) / 3;
      const controlY2 = next.y;

      path += ` C ${controlX1},${controlY1} ${controlX2},${controlY2} ${next.x},${next.y}`;
    }

    return path;
  };

  const curvePath = generateCurvePath();

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* SVG Chart */}
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={styles.chart}>
        <Defs>
          {/* Gradient for current day bar */}
          <LinearGradient id="currentBarGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#6B7FE8" stopOpacity="0.7" />
            <Stop offset="1" stopColor="#4A90E2" stopOpacity="0.4" />
          </LinearGradient>

          {/* Gradient for the area under curve */}
          <LinearGradient id="curveAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#6B7FE8" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#6B7FE8" stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Area under curve */}
        {curvePath && (
          <Path
            d={`${curvePath} L ${CHART_WIDTH},${CHART_HEIGHT - 40} L 0,${CHART_HEIGHT - 40} Z`}
            fill="url(#curveAreaGradient)"
          />
        )}

        {/* Bar - Only show for current period */}
        <G>
          {data.map((point, index) => {
            if (!point.isCurrent || point.isFuture) return null;

            const barHeight = (point.value / maxValue) * (CHART_HEIGHT - 80);
            const x = index * (POINT_WIDTH + BAR_SPACING);
            const y = CHART_HEIGHT - 60 - barHeight;

            return (
              <Rect
                key={`bar-${index}`}
                x={x}
                y={y}
                width={POINT_WIDTH}
                height={barHeight}
                fill="url(#currentBarGradient)"
                rx={12}
                ry={12}
                opacity={0.75}
              />
            );
          })}
        </G>

        {/* Curve Line Glow Effect */}
        <Path
          d={curvePath}
          stroke="#A8B3F0"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.25}
        />

        {/* Main Curve Line */}
        <Path
          d={curvePath}
          stroke="#B8C1F5"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />

        {/* Data Points - Only for past and current */}
        <G>
          {data.map((point, index) => {
            if (point.isFuture) return null;

            const cx = POINT_WIDTH / 2 + index * (POINT_WIDTH + BAR_SPACING);
            const cy = CHART_HEIGHT - 60 - (point.value / maxValue) * (CHART_HEIGHT - 80);

            return (
              <Circle
                key={`point-${index}`}
                cx={cx}
                cy={cy}
                r={point.isCurrent ? 8 : 0}
                fill="#34D399"
                stroke="#fff"
                strokeWidth={2}
              />
            );
          })}
        </G>
      </Svg>

      {/* Labels */}
      <View style={styles.labelsContainer}>
        {data.map((point, index) => (
          <View
            key={index}
            style={[
              styles.labelItem,
              { width: POINT_WIDTH },
            ]}
          >
            <View style={[
              styles.labelBadge,
              point.isCurrent && styles.labelBadgeCurrent,
              point.isFuture && styles.labelBadgeFuture,
            ]}>
              <Text
                style={[
                  styles.labelText,
                  point.isCurrent && styles.labelTextCurrent,
                  point.isFuture && styles.labelTextFuture,
                ]}
              >
                {point.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.LG,
    marginTop: SPACING.MD,
    marginBottom: SPACING.LG,
  },
  chart: {
    marginBottom: SPACING.XS,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.SM,
  },
  labelItem: {
    alignItems: 'center',
  },
  labelBadge: {
    paddingHorizontal: SPACING.XS - 2,
    paddingVertical: SPACING.XS / 3,
    borderRadius: BORDER_RADIUS.MD,
    backgroundColor: 'transparent',
  },
  labelBadgeCurrent: {
    backgroundColor: '#34D399',
    paddingHorizontal: SPACING.SM + 2,
    paddingVertical: SPACING.XS / 2,
    borderRadius: BORDER_RADIUS.MD,
  },
  labelBadgeFuture: {
    opacity: 0.4,
  },
  labelText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '400',
  },
  labelTextCurrent: {
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  labelTextFuture: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
});
