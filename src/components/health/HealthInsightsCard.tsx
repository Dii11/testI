import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants';

interface HealthInsightsCardProps {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  actionText?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: ViewStyle;
  showAnimation?: boolean;
}

export const HealthInsightsCard: React.FC<HealthInsightsCardProps> = ({
  type,
  title,
  message,
  icon,
  actionText,
  onAction,
  onDismiss,
  style,
  showAnimation = true,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (showAnimation) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, []);

  const getInsightColors = () => {
    switch (type) {
      case 'success':
        return {
          primary: COLORS.SUCCESS,
          secondary: '#D4F6E8',
          gradient: ['#34C759', '#4AE890'],
        };
      case 'warning':
        return {
          primary: COLORS.WARNING,
          secondary: '#FFF3CD',
          gradient: ['#FFB800', '#FFCC00'],
        };
      case 'error':
        return {
          primary: COLORS.ERROR,
          secondary: '#F8D7DA',
          gradient: ['#FF3B30', '#FF6B6B'],
        };
      case 'info':
      default:
        return {
          primary: COLORS.INFO,
          secondary: '#CCE7FF',
          gradient: ['#007AFF', '#5AC8FA'],
        };
    }
  };

  const colors = getInsightColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onAction?.();
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
        style,
      ]}
    >
      <View style={[styles.card, { backgroundColor: colors.secondary }]}>
        {/* Icon Section */}
        <View style={styles.iconSection}>
          <LinearGradient colors={colors.gradient} style={styles.iconContainer}>
            <Ionicons name={icon} size={24} color={COLORS.WHITE} />
          </LinearGradient>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.primary }]}>{title}</Text>
            {onDismiss && (
              <TouchableOpacity
                onPress={handleDismiss}
                style={styles.dismissButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.message}>{message}</Text>

          {actionText && onAction && (
            <TouchableOpacity
              onPress={handlePress}
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={styles.actionText}>{actionText}</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.WHITE} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress indicator for timed insights */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: `${colors.primary}20` }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary }]} />
        </View>
      </View>
    </Animated.View>
  );
};

// Health Insights List Component
interface HealthInsightsListProps {
  insights: {
    id: string;
    type: 'success' | 'warning' | 'info' | 'error';
    title: string;
    message: string;
    icon: keyof typeof Ionicons.glyphMap;
    actionText?: string;
    timestamp?: Date;
  }[];
  onInsightAction?: (insightId: string) => void;
  onInsightDismiss?: (insightId: string) => void;
  maxVisible?: number;
}

export const HealthInsightsList: React.FC<HealthInsightsListProps> = ({
  insights,
  onInsightAction,
  onInsightDismiss,
  maxVisible = 3,
}) => {
  const visibleInsights = insights.slice(0, maxVisible);

  return (
    <View style={styles.listContainer}>
      {visibleInsights.map((insight, index) => (
        <HealthInsightsCard
          key={insight.id}
          type={insight.type}
          title={insight.title}
          message={insight.message}
          icon={insight.icon}
          actionText={insight.actionText}
          onAction={() => onInsightAction?.(insight.id)}
          onDismiss={() => onInsightDismiss?.(insight.id)}
          showAnimation
          style={{
            marginBottom: index < visibleInsights.length - 1 ? SPACING.SM : 0,
          }}
        />
      ))}

      {insights.length > maxVisible && (
        <TouchableOpacity style={styles.showMoreButton}>
          <Text style={styles.showMoreText}>View {insights.length - maxVisible} more insights</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.PRIMARY} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.SM,
  },
  card: {
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.MD,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...SHADOWS.SMALL,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconSection: {
    marginRight: SPACING.MD,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.SMALL,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.XS,
  },
  title: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    flex: 1,
    marginRight: SPACING.SM,
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.LIGHT_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
    marginBottom: SPACING.SM,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: BORDER_RADIUS.MD,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginRight: SPACING.XS,
  },
  progressContainer: {
    marginTop: SPACING.XS,
    paddingHorizontal: SPACING.MD,
  },
  progressBar: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '70%', // This could be animated based on insight relevance/urgency
    borderRadius: 1.5,
  },
  listContainer: {
    flex: 1,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.MD,
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: BORDER_RADIUS.MD,
    marginTop: SPACING.SM,
  },
  showMoreText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.PRIMARY,
    fontWeight: '500',
    marginRight: SPACING.XS,
  },
});

export default HealthInsightsCard;
