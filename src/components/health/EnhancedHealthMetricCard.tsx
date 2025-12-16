import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants';
import { HealthDataType } from '../../types/health';

interface HealthMetricCardProps {
  type: HealthDataType;
  value: number;
  unit: string;
  goal?: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
  onPress?: () => void;
  style?: ViewStyle;
  compact?: boolean;
}

export const HealthMetricCard: React.FC<HealthMetricCardProps> = ({
  type,
  value,
  unit,
  goal,
  color,
  icon,
  trend,
  subtitle,
  onPress,
  style,
  compact = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (goal) {
      const progress = Math.min((value / goal) * 100, 100);
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [value, goal]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const formatValue = (val: number): string => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    if (val < 1 && val > 0) {
      return val.toFixed(2);
    }
    return val.toLocaleString();
  };

  const getTrendIcon = (): keyof typeof Ionicons.glyphMap | null => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      case 'stable':
        return 'remove-outline';
      default:
        return null;
    }
  };

  const getTrendColor = (): string => {
    switch (trend) {
      case 'up':
        return COLORS.SUCCESS;
      case 'down':
        return COLORS.ERROR;
      case 'stable':
        return COLORS.WARNING;
      default:
        return COLORS.TEXT_SECONDARY;
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (compact) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[styles.compactContainer, { transform: [{ scale: scaleAnim }] }, style]}
        >
          <View style={[styles.compactIconContainer, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>

          <View style={styles.compactContent}>
            <Text style={styles.compactValue}>
              {formatValue(value)}
              <Text style={styles.compactUnit}> {unit}</Text>
            </Text>
            {subtitle && <Text style={styles.compactSubtitle}>{subtitle}</Text>}
          </View>

          {trend && <Ionicons name={getTrendIcon()!} size={16} color={getTrendColor()} />}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.touchable}
    >
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }, style]}>
        <LinearGradient
          colors={[`${color}10`, `${color}05`]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon} size={24} color={color} />
          </View>

          {trend && (
            <View style={styles.trendContainer}>
              <Ionicons name={getTrendIcon()!} size={14} color={getTrendColor()} />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>{getMetricLabel(type)}</Text>

          <View style={styles.valueContainer}>
            <Text style={[styles.value, { color }]}>{formatValue(value)}</Text>
            <Text style={styles.unit}>{unit}</Text>
          </View>

          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {goal && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressWidth,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round((value / goal) * 100)}% of goal</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const getMetricLabel = (type: HealthDataType): string => {
  const labels: Record<HealthDataType, string> = {
    [HealthDataType.HEART_RATE]: 'Heart Rate',
    [HealthDataType.STEPS]: 'Steps',
    [HealthDataType.SLEEP]: 'Sleep',
    [HealthDataType.WEIGHT]: 'Weight',
    [HealthDataType.BLOOD_PRESSURE]: 'Blood Pressure',
    [HealthDataType.OXYGEN_SATURATION]: 'Oxygen',
    [HealthDataType.BODY_TEMPERATURE]: 'Temperature',
    [HealthDataType.BLOOD_GLUCOSE]: 'Glucose',
    [HealthDataType.DISTANCE]: 'Distance',
    [HealthDataType.CALORIES_BURNED]: 'Calories',
    [HealthDataType.ACTIVE_ENERGY]: 'Active Energy',
    [HealthDataType.RESTING_HEART_RATE]: 'Resting HR',
    [HealthDataType.RESPIRATORY_RATE]: 'Respiratory',
    [HealthDataType.EXERCISE]: 'Exercise',
  };
  return labels[type] || 'Health Metric';
};

const styles = StyleSheet.create({
  touchable: {
    width: '48%',
    marginBottom: SPACING.MD,
  },
  container: {
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.MD,
    minHeight: 140,
    ...SHADOWS.MEDIUM,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.LIGHT_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.XS,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.XS,
  },
  value: {
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: SPACING.XS,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
  },
  progressContainer: {
    marginTop: SPACING.SM,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.XS,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.SM,
    marginBottom: SPACING.SM,
    ...SHADOWS.SMALL,
  },
  compactIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.SM,
  },
  compactContent: {
    flex: 1,
  },
  compactValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  compactUnit: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: 'normal',
    color: COLORS.TEXT_SECONDARY,
  },
  compactSubtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
});

export default HealthMetricCard;
