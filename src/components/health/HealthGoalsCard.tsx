import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants';
import { HealthDataType } from '../../types/health';

interface HealthGoal {
  id: string;
  type: HealthDataType;
  target: number;
  current: number;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  streak?: number;
  bestStreak?: number;
  isAchieved?: boolean;
}

interface HealthGoalsCardProps {
  goals: HealthGoal[];
  onGoalPress?: (goal: HealthGoal) => void;
  onEditGoal?: (goal: HealthGoal) => void;
  showProgress?: boolean;
  compactView?: boolean;
}

export const HealthGoalsCard: React.FC<HealthGoalsCardProps> = ({
  goals,
  onGoalPress,
  onEditGoal,
  showProgress = true,
  compactView = false,
}) => {
  const animatedValues = useRef(goals.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = goals.map((goal, index) => {
      const progress = Math.min((goal.current / goal.target) * 100, 100);
      return Animated.timing(animatedValues[index], {
        toValue: progress,
        duration: 1500,
        delay: index * 200,
        useNativeDriver: false,
      });
    });

    Animated.parallel(animations).start();
  }, [goals]);

  const handleGoalPress = (goal: HealthGoal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onGoalPress?.(goal);
  };

  const handleGoalLongPress = (goal: HealthGoal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert('Edit Goal', `Would you like to modify your ${getGoalLabel(goal.type)} goal?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => onEditGoal?.(goal) },
    ]);
  };

  const calculateProgress = (goal: HealthGoal): number => {
    return Math.min((goal.current / goal.target) * 100, 100);
  };

  const formatGoalValue = (value: number): string => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  const getGoalStatus = (goal: HealthGoal): string => {
    const progress = calculateProgress(goal);

    if (progress >= 100) return 'Completed!';
    if (progress >= 80) return 'Almost there!';
    if (progress >= 50) return 'Great progress!';
    if (progress >= 25) return 'Keep going!';
    return 'Just started';
  };

  const renderGoalItem = (goal: HealthGoal, index: number) => {
    const progress = calculateProgress(goal);
    const isCompleted = progress >= 100;

    if (compactView) {
      return (
        <TouchableOpacity
          key={goal.id}
          style={styles.compactGoalItem}
          onPress={() => handleGoalPress(goal)}
          activeOpacity={0.7}
        >
          <View style={[styles.compactIcon, { backgroundColor: `${goal.color}20` }]}>
            <Ionicons name={goal.icon} size={16} color={goal.color} />
          </View>

          <View style={styles.compactContent}>
            <Text style={styles.compactLabel}>{getGoalLabel(goal.type)}</Text>
            <Text style={styles.compactProgress}>
              {formatGoalValue(goal.current)} / {formatGoalValue(goal.target)} {goal.unit}
            </Text>
          </View>

          <View style={styles.compactStatus}>
            <Text style={[styles.compactPercentage, { color: goal.color }]}>
              {progress.toFixed(0)}%
            </Text>
            {isCompleted && <Ionicons name="checkmark-circle" size={16} color={COLORS.SUCCESS} />}
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={goal.id}
        style={styles.goalItem}
        onPress={() => handleGoalPress(goal)}
        onLongPress={() => handleGoalLongPress(goal)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={[`${goal.color}10`, `${goal.color}05`]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={styles.goalHeader}>
          <View style={styles.goalIconContainer}>
            <LinearGradient colors={[goal.color, `${goal.color}DD`]} style={styles.goalIcon}>
              <Ionicons name={goal.icon} size={24} color={COLORS.WHITE} />
            </LinearGradient>

            {isCompleted && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark" size={12} color={COLORS.WHITE} />
              </View>
            )}
          </View>

          <View style={styles.goalInfo}>
            <Text style={styles.goalTitle}>{getGoalLabel(goal.type)}</Text>
            <Text style={styles.goalStatus}>{getGoalStatus(goal)}</Text>
          </View>

          {goal.streak && goal.streak > 0 && (
            <View style={styles.streakContainer}>
              <Ionicons name="flame" size={16} color={COLORS.WARNING} />
              <Text style={styles.streakText}>{goal.streak}</Text>
            </View>
          )}
        </View>

        <View style={styles.goalProgress}>
          <View style={styles.progressInfo}>
            <Text style={styles.currentValue}>
              {formatGoalValue(goal.current)}
              <Text style={styles.progressUnit}> {goal.unit}</Text>
            </Text>
            <Text style={styles.targetValue}>
              Goal: {formatGoalValue(goal.target)} {goal.unit}
            </Text>
          </View>

          {showProgress && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor: goal.color,
                      width: animatedValues[index].interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressPercentage, { color: goal.color }]}>
                {progress.toFixed(0)}%
              </Text>
            </View>
          )}
        </View>

        {goal.bestStreak && (
          <View style={styles.achievementRow}>
            <Ionicons name="trophy" size={14} color={COLORS.WARNING} />
            <Text style={styles.achievementText}>Best streak: {goal.bestStreak} days</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const completedGoals = goals.filter(goal => calculateProgress(goal) >= 100).length;
  const totalGoals = goals.length;

  return (
    <View style={styles.container}>
      {!compactView && (
        <View style={styles.header}>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              {completedGoals} of {totalGoals} goals completed
            </Text>
            <View style={styles.summaryProgress}>
              <View
                style={[
                  styles.summaryProgressFill,
                  {
                    width: `${(completedGoals / totalGoals) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>

          {completedGoals === totalGoals && totalGoals > 0 && (
            <View style={styles.celebrationContainer}>
              <Ionicons name="party-outline" size={20} color={COLORS.SUCCESS} />
              <Text style={styles.celebrationText}>All goals completed!</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
        horizontal={compactView}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compactView ? styles.compactScrollContent : undefined}
      >
        <View style={compactView ? styles.compactContainer : styles.goalsContainer}>
          {goals.map(renderGoalItem)}
        </View>
      </ScrollView>
    </View>
  );
};

const getGoalLabel = (type: HealthDataType): string => {
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
  return labels[type] || 'Health Goal';
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.MD,
    ...SHADOWS.MEDIUM,
  },
  header: {
    marginBottom: SPACING.MD,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  summaryText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  summaryProgress: {
    width: 60,
    height: 4,
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: 2,
    overflow: 'hidden',
  },
  summaryProgressFill: {
    height: '100%',
    backgroundColor: COLORS.SUCCESS,
  },
  celebrationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.SUCCESS}20`,
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.MD,
  },
  celebrationText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.SUCCESS,
    fontWeight: '600',
    marginLeft: SPACING.XS,
  },
  goalsContainer: {
    gap: SPACING.MD,
  },
  goalItem: {
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
    backgroundColor: COLORS.WHITE,
    ...SHADOWS.SMALL,
    overflow: 'hidden',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  goalIconContainer: {
    position: 'relative',
    marginRight: SPACING.MD,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.SUCCESS,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.WHITE,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  goalStatus: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.WARNING}20`,
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.SM,
  },
  streakText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '600',
    color: COLORS.WARNING,
    marginLeft: 4,
  },
  goalProgress: {
    marginBottom: SPACING.SM,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACING.SM,
  },
  currentValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  progressUnit: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: 'normal',
    color: COLORS.TEXT_SECONDARY,
  },
  targetValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: SPACING.SM,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercentage: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '600',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: SPACING.XS,
  },
  // Compact view styles
  compactScrollContent: {
    paddingRight: SPACING.MD,
  },
  compactContainer: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  compactGoalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.SM,
    minWidth: 200,
    ...SHADOWS.SMALL,
  },
  compactIcon: {
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
  compactLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  compactProgress: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  compactStatus: {
    alignItems: 'center',
  },
  compactPercentage: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '600',
  },
});

export default HealthGoalsCard;
