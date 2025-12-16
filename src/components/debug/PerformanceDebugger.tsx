import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants';
import deviceCapabilityService from '../../services/deviceCapabilityService';
import { useAdaptiveTheme } from '../../theme/adaptiveTheme';

const { width } = Dimensions.get('window');

interface PerformanceDebuggerProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  autoHide?: boolean;
  hideDelay?: number;
  showModal?: boolean;
  onToggleModal?: () => void;
}

export const PerformanceDebugger: React.FC<PerformanceDebuggerProps> = ({
  enabled = true,
  position = 'top-right',
  autoHide = true,
  hideDelay = 3000,
  showModal = false,
  onToggleModal,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    frameDrops: 0,
    interactionBlocked: false,
  });

  const renderTimes = useRef<number[]>([]);
  const lastRenderRef = useRef(Date.now());
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const { isLowEndDevice } = useAdaptiveTheme();

  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    const timeSinceLastRender = now - lastRenderRef.current;

    renderTimes.current.push(timeSinceLastRender);
    if (renderTimes.current.length > 100) {
      renderTimes.current.shift(); // Keep only last 100 measurements
    }

    const avgRenderTime =
      renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;

    setMetrics(prev => ({
      ...prev,
      renderCount: prev.renderCount + 1,
      lastRenderTime: timeSinceLastRender,
      averageRenderTime: avgRenderTime,
      frameDrops: timeSinceLastRender > 16.67 ? prev.frameDrops + 1 : prev.frameDrops, // 60fps = 16.67ms per frame
      interactionBlocked: timeSinceLastRender > 100, // Consider interaction blocked if render takes >100ms
    }));

    lastRenderRef.current = now;

    // Show debugger briefly when performance issues are detected
    if (timeSinceLastRender > 50 || avgRenderTime > 30) {
      setIsVisible(true);

      if (autoHide) {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
        }, hideDelay);
      }
    }
  });

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  if (!enabled || (!isVisible && !showModal)) {
    return null;
  }

  const getPositionStyles = () => {
    const styles: any = {
      position: 'absolute',
      zIndex: 9999,
    };

    switch (position) {
      case 'top-left':
        styles.top = 50;
        styles.left = 10;
        break;
      case 'top-right':
        styles.top = 50;
        styles.right = 10;
        break;
      case 'bottom-left':
        styles.bottom = 50;
        styles.left = 10;
        break;
      case 'bottom-right':
        styles.bottom = 50;
        styles.right = 10;
        break;
    }

    return styles;
  };

  const getPerformanceColor = (value: number, threshold: number) => {
    if (value < threshold * 0.5) return '#4CAF50'; // Green
    if (value < threshold) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const capabilities = deviceCapabilityService.getCapabilities();
  const benchmarkScore = deviceCapabilityService.getBenchmarkScore();

  return (
    <>
      {/* Floating Performance Indicator */}
      <View style={[debuggerStyles.floatingIndicator, getPositionStyles()]}>
        <TouchableOpacity
          style={[
            debuggerStyles.indicator,
            { backgroundColor: metrics.interactionBlocked ? '#F44336' : '#4CAF50' },
          ]}
          onPress={() => onToggleModal?.()}
        >
          <Text style={debuggerStyles.indicatorText}>{metrics.lastRenderTime.toFixed(0)}ms</Text>
          <Text style={debuggerStyles.indicatorSubtext}>{isLowEndDevice ? 'LOW' : 'HIGH'}</Text>
        </TouchableOpacity>
      </View>

      {/* Detailed Performance Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => onToggleModal?.()}
      >
        <View style={debuggerStyles.modalOverlay}>
          <View style={debuggerStyles.modalContent}>
            <View style={debuggerStyles.modalHeader}>
              <Text style={debuggerStyles.modalTitle}>Performance Monitor</Text>
              <TouchableOpacity
                style={debuggerStyles.closeButton}
                onPress={() => onToggleModal?.()}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={debuggerStyles.modalBody}>
              {/* Device Information */}
              <View style={debuggerStyles.section}>
                <Text style={debuggerStyles.sectionTitle}>Device Information</Text>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Performance Tier:</Text>
                  <Text
                    style={[
                      debuggerStyles.value,
                      {
                        color:
                          capabilities.tier === 'high'
                            ? '#4CAF50'
                            : capabilities.tier === 'medium'
                              ? '#FF9800'
                              : '#F44336',
                      },
                    ]}
                  >
                    {capabilities.tier.toUpperCase()}
                  </Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Manufacturer:</Text>
                  <Text style={debuggerStyles.value}>{capabilities.manufacturer}</Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Model:</Text>
                  <Text style={debuggerStyles.value}>{capabilities.model}</Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>API Level:</Text>
                  <Text style={debuggerStyles.value}>{capabilities.apiLevel}</Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Memory:</Text>
                  <Text style={debuggerStyles.value}>{capabilities.totalMemoryMB}MB</Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>CPU Cores:</Text>
                  <Text style={debuggerStyles.value}>{capabilities.cpuCores}</Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Benchmark Score:</Text>
                  <Text style={debuggerStyles.value}>{benchmarkScore.toFixed(2)}</Text>
                </View>
              </View>

              {/* Performance Metrics */}
              <View style={debuggerStyles.section}>
                <Text style={debuggerStyles.sectionTitle}>Performance Metrics</Text>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Render Count:</Text>
                  <Text style={debuggerStyles.value}>{metrics.renderCount}</Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Last Render:</Text>
                  <Text
                    style={[
                      debuggerStyles.value,
                      { color: getPerformanceColor(metrics.lastRenderTime, 33) },
                    ]}
                  >
                    {metrics.lastRenderTime.toFixed(2)}ms
                  </Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Avg Render:</Text>
                  <Text
                    style={[
                      debuggerStyles.value,
                      { color: getPerformanceColor(metrics.averageRenderTime, 25) },
                    ]}
                  >
                    {metrics.averageRenderTime.toFixed(2)}ms
                  </Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Frame Drops:</Text>
                  <Text
                    style={[
                      debuggerStyles.value,
                      { color: getPerformanceColor(metrics.frameDrops, 10) },
                    ]}
                  >
                    {metrics.frameDrops}
                  </Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Interaction:</Text>
                  <Text
                    style={[
                      debuggerStyles.value,
                      { color: metrics.interactionBlocked ? '#F44336' : '#4CAF50' },
                    ]}
                  >
                    {metrics.interactionBlocked ? 'BLOCKED' : 'RESPONSIVE'}
                  </Text>
                </View>
              </View>

              {/* Theme Configuration */}
              <View style={debuggerStyles.section}>
                <Text style={debuggerStyles.sectionTitle}>Theme Configuration</Text>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Gradients:</Text>
                  <Text style={debuggerStyles.value}>
                    {theme.colors.gradient.enabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Shadows:</Text>
                  <Text style={debuggerStyles.value}>
                    {theme.colors.shadow.enabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Glass Effect:</Text>
                  <Text style={debuggerStyles.value}>
                    {theme.colors.glass.enabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Animations:</Text>
                  <Text style={debuggerStyles.value}>
                    {theme.animations.enabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </View>
                <View style={debuggerStyles.row}>
                  <Text style={debuggerStyles.label}>Transforms:</Text>
                  <Text style={debuggerStyles.value}>
                    {theme.animations.transforms.enabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </View>
              </View>

              {/* Optimization Recommendations */}
              <View style={debuggerStyles.section}>
                <Text style={debuggerStyles.sectionTitle}>Recommendations</Text>
                {metrics.averageRenderTime > 25 && (
                  <Text style={debuggerStyles.recommendation}>
                    • High render times detected. Consider reducing animation complexity.
                  </Text>
                )}
                {metrics.frameDrops > 5 && (
                  <Text style={debuggerStyles.recommendation}>
                    • Frequent frame drops. Try enabling removeClippedSubviews on lists.
                  </Text>
                )}
                {capabilities.tier === 'low' && theme.colors.gradient.enabled && (
                  <Text style={debuggerStyles.recommendation}>
                    • Low-end device with gradients enabled. Consider disabling for better
                    performance.
                  </Text>
                )}
                {metrics.interactionBlocked && (
                  <Text style={debuggerStyles.recommendation}>
                    • Interactions blocked. Check for heavy computations in render methods.
                  </Text>
                )}
              </View>

              {/* Actions */}
              <View style={debuggerStyles.section}>
                <TouchableOpacity
                  style={debuggerStyles.actionButton}
                  onPress={() => {
                    deviceCapabilityService.debugInfo();
                    adaptiveTheme.debugInfo();
                  }}
                >
                  <Text style={debuggerStyles.actionButtonText}>Log Debug Info to Console</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[debuggerStyles.actionButton, debuggerStyles.clearButton]}
                  onPress={() => {
                    setMetrics({
                      renderCount: 0,
                      lastRenderTime: 0,
                      averageRenderTime: 0,
                      frameDrops: 0,
                      interactionBlocked: false,
                    });
                    renderTimes.current = [];
                  }}
                >
                  <Text style={debuggerStyles.actionButtonText}>Clear Metrics</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const debuggerStyles = StyleSheet.create({
  floatingIndicator: {
    // Position styles are added dynamically
  },
  indicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  indicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  indicatorSubtext: {
    color: 'white',
    fontSize: 8,
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: Dimensions.get('window').width * 0.9,
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'right',
  },
  recommendation: {
    fontSize: 12,
    color: '#FF9800',
    marginBottom: 4,
    lineHeight: 16,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#757575',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PerformanceDebugger;
