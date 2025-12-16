import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import type { HealthTrend } from '../../types/health';

interface HealthMetricCardProps {
  title: string;
  value: number | null | undefined;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  trend?: HealthTrend | null;
  goal?: number;
  onPress?: () => void;
  color?: string;
}

export const HealthMetricCard: React.FC<HealthMetricCardProps> = ({
  title,
  value,
  unit,
  icon,
  trend,
  goal,
  onPress,
  color = '#4AE890',
}) => {
  const progress = goal && value ? (value / goal) * 100 : undefined;

  const getTrendIcon = () => {
    if (!trend) return null;

    switch (trend.direction) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'remove-outline';
    }
  };

  const getTrendColor = () => {
    if (!trend) return '#666';

    switch (trend.direction) {
      case 'up':
        return '#4AE890';
      case 'down':
        return '#FF6B6B';
      default:
        return '#FFA726';
    }
  };

  const formatValue = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '--';

    if (val >= 1000) {
      return (val / 1000).toFixed(1) + 'K';
    }

    return val.toLocaleString();
  };

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        {trend && (
          <View style={styles.trendContainer}>
            <Ionicons
              name={getTrendIcon() as keyof typeof Ionicons.glyphMap}
              size={16}
              color={getTrendColor()}
            />
            <Text style={[styles.trendText, { color: getTrendColor() }]}>
              {trend.percentage.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>

      <View style={styles.valueContainer}>
        <Text style={styles.value}>{formatValue(value)}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      {goal && progress !== undefined && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progress, 100)}%`,
                  backgroundColor: color,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.toFixed(0)}% of {goal.toLocaleString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    borderLeftWidth: 4,
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
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 232, 144, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  unit: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginLeft: 4,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});
