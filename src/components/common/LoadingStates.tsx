import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

import { COLORS, SPACING, TYPOGRAPHY } from '../../constants';

import { DoctorSkeleton, HealthMetricSkeleton, HealthChartSkeleton } from './SkeletonLoader';

const { width } = Dimensions.get('window');

interface LoadingStateProps {
  type: 'doctors' | 'health' | 'general';
  message?: string;
  testID?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type,
  message,
  testID = 'loading-state',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const renderSkeletons = () => {
    switch (type) {
      case 'doctors':
        return (
          <View style={styles.skeletonsContainer}>
            {Array.from({ length: 4 }, (_, index) => (
              <DoctorSkeleton key={index} />
            ))}
          </View>
        );

      case 'health':
        return (
          <View style={styles.skeletonsContainer}>
            <HealthChartSkeleton />
            <View style={styles.metricsGrid}>
              {Array.from({ length: 4 }, (_, index) => (
                <HealthMetricSkeleton key={index} />
              ))}
            </View>
          </View>
        );

      default:
        return (
          <View style={styles.defaultLoading}>
            <Text style={styles.loadingText}>{message || 'Loading...'}</Text>
          </View>
        );
    }
  };

  return (
    <LinearGradient colors={COLORS.BRAND_GRADIENT} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]} testID={testID}>
        {renderSkeletons()}
      </Animated.View>
    </LinearGradient>
  );
};

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onPress: () => void;
  };
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  subtitle,
  icon,
  action,
  testID = 'empty-state',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.emptyContainer} testID={testID}>
      <Animated.View
        style={[
          styles.emptyContent,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {icon && <View style={styles.emptyIcon}>{icon}</View>}
        <Text style={styles.emptyTitle}>{title}</Text>
        {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
        {action && (
          <Animated.View style={[styles.emptyAction, { opacity: fadeAnim }]}>
            <Text style={styles.emptyActionText} onPress={action.onPress}>
              {action.label}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: SPACING.XXL,
  },
  skeletonsContainer: {
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.MD,
    gap: SPACING.MD,
  },
  defaultLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.XL,
  },
  emptyContent: {
    alignItems: 'center',
    maxWidth: width * 0.8,
  },
  emptyIcon: {
    marginBottom: SPACING.LG,
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: SPACING.MD,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_NORMAL,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.XL,
  },
  emptyAction: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
  },
  emptyActionText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
    color: COLORS.TEXT_DARK,
    textAlign: 'center',
  },
});
