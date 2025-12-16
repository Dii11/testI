import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useMemoryManagement } from '../../hooks/usePerformance';

interface PerformanceMetrics {
  fps: number;
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
  } | null;
  renderTime: number;
  componentCount: number;
  reRenderCount: number;
}

interface PerformanceMonitorProps {
  visible?: boolean;
  onToggle?: () => void;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  visible = __DEV__,
  onToggle,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memoryUsage: null,
    renderTime: 0,
    componentCount: 0,
    reRenderCount: 0,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const { getMemoryUsage } = useMemoryManagement();

  const updateMetrics = useCallback(() => {
    const memoryUsage = getMemoryUsage();

    setMetrics(prev => ({
      ...prev,
      memoryUsage,
      reRenderCount: prev.reRenderCount + 1,
    }));
  }, [getMemoryUsage]);

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, [visible, updateMetrics]);

  const getMemoryStatus = (usage: typeof metrics.memoryUsage) => {
    if (!usage) return 'unknown';

    const percentage = (usage.used / usage.limit) * 100;
    if (percentage > 80) return 'critical';
    if (percentage > 60) return 'warning';
    return 'good';
  };

  const getFPSStatus = (fps: number) => {
    if (fps < 30) return 'critical';
    if (fps < 50) return 'warning';
    return 'good';
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.toggle} onPress={() => setIsExpanded(!isExpanded)}>
        <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-up'} size={16} color="#FFF" />
        <Text style={styles.toggleText}>Performance</Text>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                getMemoryStatus(metrics.memoryUsage) === 'good' ? '#4CAF50' : '#FF9800',
            },
          ]}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          {/* FPS */}
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>FPS</Text>
            <View style={styles.metricValue}>
              <Text
                style={[
                  styles.metricText,
                  { color: getFPSStatus(metrics.fps) === 'good' ? '#4CAF50' : '#FF9800' },
                ]}
              >
                {metrics.fps.toFixed(1)}
              </Text>
            </View>
          </View>

          {/* Memory Usage */}
          {metrics.memoryUsage && (
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Memory</Text>
              <View style={styles.metricValue}>
                <Text
                  style={[
                    styles.metricText,
                    {
                      color:
                        getMemoryStatus(metrics.memoryUsage) === 'good' ? '#4CAF50' : '#FF9800',
                    },
                  ]}
                >
                  {metrics.memoryUsage.used}MB
                </Text>
                <Text style={styles.metricSubtext}>/ {metrics.memoryUsage.total}MB</Text>
              </View>
            </View>
          )}

          {/* Render Count */}
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Re-renders</Text>
            <View style={styles.metricValue}>
              <Text style={styles.metricText}>{metrics.reRenderCount}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                // Force garbage collection if available
                if ((global as any).gc) {
                  (global as any).gc();
                }
                updateMetrics();
              }}
            >
              <Text style={styles.actionText}>GC</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setMetrics(prev => ({ ...prev, reRenderCount: 0 }))}
            >
              <Text style={styles.actionText}>Reset</Text>
            </TouchableOpacity>

            {onToggle && (
              <TouchableOpacity style={styles.actionButton} onPress={onToggle}>
                <Text style={styles.actionText}>Hide</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    zIndex: 9999,
    minWidth: 120,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  toggleText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    color: '#FFF',
    fontSize: 10,
    opacity: 0.7,
  },
  metricValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  metricSubtext: {
    color: '#FFF',
    fontSize: 10,
    opacity: 0.5,
    marginLeft: 2,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flex: 1,
  },
  actionText: {
    color: '#FFF',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
});
