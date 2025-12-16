import * as Haptics from 'expo-haptics';
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Animated, TouchableOpacity } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { COLORS, TYPOGRAPHY, SPACING } from '../../constants';

interface HealthActivityRingsProps {
  move: number; // Percentage 0-100
  exercise: number; // Percentage 0-100
  stand: number; // Percentage 0-100
  size: number;
  strokeWidth?: number;
  showLabels?: boolean;
  onRingPress?: (ring: 'move' | 'exercise' | 'stand') => void;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const HealthActivityRings: React.FC<HealthActivityRingsProps> = ({
  move,
  exercise,
  stand,
  size,
  strokeWidth = 12,
  showLabels = true,
  onRingPress,
}) => {
  const moveAnim = useRef(new Animated.Value(0)).current;
  const exerciseAnim = useRef(new Animated.Value(0)).current;
  const standAnim = useRef(new Animated.Value(0)).current;

  const center = size / 2;
  const outerRadius = center - strokeWidth / 2 - 10;
  const middleRadius = outerRadius - strokeWidth - 8;
  const innerRadius = middleRadius - strokeWidth - 8;

  useEffect(() => {
    // Staggered animations for each ring
    const animations = [
      Animated.timing(moveAnim, {
        toValue: Math.min(move, 100),
        duration: 1500,
        useNativeDriver: false,
      }),
      Animated.timing(exerciseAnim, {
        toValue: Math.min(exercise, 100),
        duration: 1500,
        delay: 300,
        useNativeDriver: false,
      }),
      Animated.timing(standAnim, {
        toValue: Math.min(stand, 100),
        duration: 1500,
        delay: 600,
        useNativeDriver: false,
      }),
    ];

    Animated.parallel(animations).start();
  }, [move, exercise, stand]);

  const calculateCircumference = (radius: number) => 2 * Math.PI * radius;

  const getRingPath = (radius: number, percentage: number) => {
    const circumference = calculateCircumference(radius);
    const strokeDashoffset = circumference - (circumference * percentage) / 100;
    return { circumference, strokeDashoffset };
  };

  const handleRingPress = (ringType: 'move' | 'exercise' | 'stand') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRingPress?.(ringType);
  };

  const renderRing = (
    radius: number,
    animatedValue: Animated.Value,
    color: string,
    gradientId: string,
    ringType: 'move' | 'exercise' | 'stand'
  ) => {
    const { circumference } = getRingPath(radius, 100);

    return (
      <TouchableOpacity
        onPress={() => handleRingPress(ringType)}
        style={StyleSheet.absoluteFillObject}
        activeOpacity={0.7}
      >
        {/* Background ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`${color}20`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Animated progress ring */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedValue.interpolate({
            inputRange: [0, 100],
            outputRange: [circumference, 0],
          })}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.ringsContainer, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Defs>
            {/* Move Ring Gradient (Red) */}
            <SvgLinearGradient id="moveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FF3B30" />
              <Stop offset="100%" stopColor="#FF6B6B" />
            </SvgLinearGradient>

            {/* Exercise Ring Gradient (Green) */}
            <SvgLinearGradient id="exerciseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#34C759" />
              <Stop offset="100%" stopColor="#4AE890" />
            </SvgLinearGradient>

            {/* Stand Ring Gradient (Blue) */}
            <SvgLinearGradient id="standGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#007AFF" />
              <Stop offset="100%" stopColor="#5AC8FA" />
            </SvgLinearGradient>
          </Defs>

          {renderRing(outerRadius, moveAnim, '#FF3B30', 'moveGradient', 'move')}
          {renderRing(middleRadius, exerciseAnim, '#34C759', 'exerciseGradient', 'exercise')}
          {renderRing(innerRadius, standAnim, '#007AFF', 'standGradient', 'stand')}
        </Svg>

        {/* Center content */}
        <View style={styles.centerContent}>
          <Text style={styles.centerTitle}>Activity</Text>
          <Text style={styles.centerSubtitle}>Today</Text>
        </View>
      </View>

      {showLabels && (
        <View style={styles.labelsContainer}>
          <View style={styles.labelRow}>
            <View style={styles.labelItem}>
              <View style={[styles.labelDot, { backgroundColor: '#FF3B30' }]} />
              <View style={styles.labelText}>
                <Text style={styles.labelTitle}>Move</Text>
                <Text style={styles.labelValue}>{move.toFixed(0)}%</Text>
              </View>
            </View>

            <View style={styles.labelItem}>
              <View style={[styles.labelDot, { backgroundColor: '#34C759' }]} />
              <View style={styles.labelText}>
                <Text style={styles.labelTitle}>Exercise</Text>
                <Text style={styles.labelValue}>{exercise.toFixed(0)}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.labelRow}>
            <View style={styles.labelItem}>
              <View style={[styles.labelDot, { backgroundColor: '#007AFF' }]} />
              <View style={styles.labelText}>
                <Text style={styles.labelTitle}>Stand</Text>
                <Text style={styles.labelValue}>{stand.toFixed(0)}%</Text>
              </View>
            </View>

            <View style={styles.labelItem}>
              <View style={styles.achievementBadge}>
                <Text style={styles.achievementText}>
                  {[move, exercise, stand].filter(val => val >= 100).length}/3
                </Text>
              </View>
              <View style={styles.labelText}>
                <Text style={styles.labelTitle}>Goals</Text>
                <Text style={styles.labelValue}>Complete</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  ringsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centerContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  centerSubtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  labelsContainer: {
    marginTop: SPACING.LG,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.SM,
  },
  labelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: SPACING.SM,
  },
  labelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.SM,
  },
  labelText: {
    flex: 1,
  },
  labelTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
  },
  labelValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 2,
  },
  achievementBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.SUCCESS,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.SM,
  },
  achievementText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
});

export default HealthActivityRings;
