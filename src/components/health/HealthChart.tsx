import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Animated, TouchableOpacity, Text } from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  ClipPath,
  Rect,
  G,
} from 'react-native-svg';

import { COLORS, TYPOGRAPHY, SPACING } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChartDataPoint {
  x: number;
  y: number;
  date?: Date;
  value?: number;
  label?: string;
}

interface HealthChartProps {
  data: ChartDataPoint[];
  type: 'line' | 'bar' | 'area';
  period: 'Day' | 'Week' | 'Month' | 'Year';
  height?: number;
  color?: string;
  showGrid?: boolean;
  animated?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
}

export const HealthChart: React.FC<HealthChartProps> = ({
  data,
  type = 'line',
  period,
  height = 200,
  color = COLORS.PRIMARY,
  showGrid = true,
  animated = true,
  yAxisLabel,
  xAxisLabel,
}) => {
  const animationValue = useRef(new Animated.Value(0)).current;
  const [activePoint] = useState<ChartDataPoint | null>(null);
  const [chartType, setChartType] = useState(type);

  const chartWidth = SCREEN_WIDTH - SPACING.LG * 2 - 40; // Account for padding and y-axis
  const chartHeight = height - 60; // Account for labels

  useEffect(() => {
    if (animated) {
      Animated.timing(animationValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }).start();
    } else {
      animationValue.setValue(1);
    }
  }, [data]);

  // Calculate chart bounds
  const minY = Math.min(...data.map(d => d.y));
  const maxY = Math.max(...data.map(d => d.y));
  const minX = Math.min(...data.map(d => d.x));
  const maxX = Math.max(...data.map(d => d.x));

  const padding = (maxY - minY) * 0.1;
  const yMin = minY - padding;
  const yMax = maxY + padding;

  // Scale functions
  const scaleX = (x: number) => ((x - minX) / (maxX - minX)) * chartWidth;
  const scaleY = (y: number) => chartHeight - ((y - yMin) / (yMax - yMin)) * chartHeight;

  // Generate path for line/area chart
  const generatePath = (): string => {
    if (data.length === 0) return '';

    let path = `M ${scaleX(data[0].x)} ${scaleY(data[0].y)}`;

    for (let i = 1; i < data.length; i++) {
      const point = data[i];
      const prevPoint = data[i - 1];

      if (type === 'line' || type === 'area') {
        // Smooth curve using quadratic bezier
        const cp1x = scaleX(prevPoint.x) + (scaleX(point.x) - scaleX(prevPoint.x)) / 2;
        const cp1y = scaleY(prevPoint.y);
        const cp2x = scaleX(prevPoint.x) + (scaleX(point.x) - scaleX(prevPoint.x)) / 2;
        const cp2y = scaleY(point.y);

        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${scaleX(point.x)} ${scaleY(point.y)}`;
      }
    }

    if (type === 'area') {
      path += ` L ${scaleX(data[data.length - 1].x)} ${chartHeight}`;
      path += ` L ${scaleX(data[0].x)} ${chartHeight}`;
      path += ' Z';
    }

    return path;
  };

  // Generate grid lines
  const generateGridLines = () => {
    const lines = [];
    const gridCount = 5;

    // Horizontal grid lines
    for (let i = 0; i <= gridCount; i++) {
      const y = (chartHeight / gridCount) * i;
      lines.push(
        <Line
          key={`h-${i}`}
          x1="0"
          y1={y}
          x2={chartWidth}
          y2={y}
          stroke={COLORS.LIGHT_GRAY}
          strokeWidth="0.5"
          opacity="0.5"
        />
      );
    }

    // Vertical grid lines
    for (let i = 0; i <= gridCount; i++) {
      const x = (chartWidth / gridCount) * i;
      lines.push(
        <Line
          key={`v-${i}`}
          x1={x}
          y1="0"
          x2={x}
          y2={chartHeight}
          stroke={COLORS.LIGHT_GRAY}
          strokeWidth="0.5"
          opacity="0.5"
        />
      );
    }

    return lines;
  };

  // Generate axis labels
  const generateAxisLabels = () => {
    const labels = [];
    const labelCount = 5;

    // Y-axis labels
    for (let i = 0; i <= labelCount; i++) {
      const value = yMin + ((yMax - yMin) / labelCount) * i;
      const y = chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;

      labels.push(
        <SvgText
          key={`y-label-${i}`}
          x="-5"
          y={y + 4}
          fill={COLORS.TEXT_SECONDARY}
          fontSize="10"
          textAnchor="end"
        >
          {value.toFixed(0)}
        </SvgText>
      );
    }

    // X-axis labels
    const xLabelStep = Math.ceil(data.length / labelCount);
    for (let i = 0; i < data.length; i += xLabelStep) {
      const point = data[i];
      const x = scaleX(point.x);

      labels.push(
        <SvgText
          key={`x-label-${i}`}
          x={x}
          y={chartHeight + 15}
          fill={COLORS.TEXT_SECONDARY}
          fontSize="10"
          textAnchor="middle"
        >
          {formatXAxisLabel(point, period)}
        </SvgText>
      );
    }

    return labels;
  };

  const formatXAxisLabel = (point: ChartDataPoint, period: string): string => {
    if (point.date) {
      switch (period) {
        case 'Day':
          return point.date.getHours().toString();
        case 'Week':
          return point.date.toLocaleDateString('en', { weekday: 'short' });
        case 'Month':
          return point.date.getDate().toString();
        case 'Year':
          return point.date.toLocaleDateString('en', { month: 'short' });
        default:
          return point.x.toString();
      }
    }
    return point.x.toString();
  };

  const renderLineChart = () => (
    <>
      <Defs>
        <SvgLinearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>

      {type === 'area' && <Path d={generatePath()} fill="url(#gradient)" opacity={1} />}

      <Path
        d={generatePath()}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={1}
      />

      {data.map((point, index) => (
        <Circle
          key={index}
          cx={scaleX(point.x)}
          cy={scaleY(point.y)}
          r={activePoint === point ? 6 : 4}
          fill={color}
          stroke={COLORS.WHITE}
          strokeWidth="2"
          opacity={1}
        />
      ))}
    </>
  );

  const renderBarChart = () => {
    const barWidth = (chartWidth / data.length) * 0.8;

    return data.map((point, index) => {
      const x = scaleX(point.x) - barWidth / 2;
      const y = scaleY(point.y);
      const height = chartHeight - y;

      return (
        <Rect
          key={index}
          x={x}
          y={y}
          width={barWidth}
          height={height}
          fill={color}
          opacity={0.8}
          rx="2"
        />
      );
    });
  };

  const toggleChartType = () => {
    const types: ('line' | 'bar' | 'area')[] = ['line', 'area', 'bar'];
    const currentIndex = types.indexOf(chartType);
    const nextIndex = (currentIndex + 1) % types.length;
    setChartType(types[nextIndex]);
  };

  const getChartIcon = () => {
    switch (chartType) {
      case 'line':
        return 'trending-up';
      case 'area':
        return 'analytics';
      case 'bar':
        return 'bar-chart';
      default:
        return 'trending-up';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>{yAxisLabel && <Text style={styles.axisLabel}>{yAxisLabel}</Text>}</View>
        <TouchableOpacity style={styles.toggleButton} onPress={toggleChartType}>
          <Ionicons name={getChartIcon()} size={20} color={COLORS.TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>

      <View style={styles.chartContainer}>
        <Svg width={chartWidth + 40} height={chartHeight + 30}>
          {showGrid && generateGridLines()}
          {generateAxisLabels()}

          <ClipPath id="chartArea">
            <Rect x="0" y="0" width={chartWidth} height={chartHeight} />
          </ClipPath>

          <G transform="translate(40, 0)">
            {chartType === 'bar' ? renderBarChart() : renderLineChart()}
          </G>
        </Svg>
      </View>

      {xAxisLabel && <Text style={[styles.axisLabel, styles.xAxisLabel]}>{xAxisLabel}</Text>}

      {activePoint && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>
            Value: {activePoint.value || activePoint.y.toFixed(1)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: SPACING.MD,
    margin: SPACING.SM,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.LIGHT_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContainer: {
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  xAxisLabel: {
    textAlign: 'center',
    marginTop: SPACING.SM,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: COLORS.TEXT_PRIMARY,
    padding: SPACING.SM,
    borderRadius: 8,
    top: 50,
    right: 20,
  },
  tooltipText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
  },
});

export default HealthChart;
