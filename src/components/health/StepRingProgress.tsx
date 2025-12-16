import { View, Text, StyleSheet } from 'react-native';
import SVG, { Circle, CircleProps } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY } from '../../constants';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type StepRingProgressProps = {
  radius?: number;
  strokeWidth?: number;
  progress: number; // 0-1
  steps: number;
  goal: number;
};

const color = '#34C759'; // Green color for steps

export const StepRingProgress = ({
  radius = 100,
  strokeWidth = 35,
  progress,
  steps,
  goal,
}: StepRingProgressProps) => {
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(progress, { duration: 1500 });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [circumference * fill.value, circumference],
  }));

  const circleDefaultProps: CircleProps = {
    r: innerRadius,
    cx: radius,
    cy: radius,
    originX: radius,
    originY: radius,
    strokeWidth: strokeWidth,
    stroke: color,
    strokeLinecap: 'round',
    rotation: '-90',
  };

  return (
    <View style={styles.container}>
      <View
        style={{
          width: radius * 2,
          height: radius * 2,
          alignSelf: 'center',
        }}
      >
        <SVG>
          {/* Background */}
          <Circle {...circleDefaultProps} opacity={0.2} />
          {/* Foreground */}
          <AnimatedCircle animatedProps={animatedProps} {...circleDefaultProps} />
        </SVG>

        {/* Center content */}
        <View style={styles.centerContent}>
          <Text style={styles.stepsValue}>{steps.toLocaleString()}</Text>
          <Text style={styles.stepsLabel}>steps</Text>
          <Text style={styles.goalText}>of {goal.toLocaleString()}</Text>
        </View>

        {/* Step icon */}
        <Ionicons
          name="footsteps"
          size={strokeWidth * 0.6}
          color={color}
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: strokeWidth * 0.2,
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerContent: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  stepsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  stepsLabel: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 2,
  },
  goalText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
});

export default StepRingProgress;