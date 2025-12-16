/**
 * Performance Report Component
 *
 * Shows performance metrics and validates our optimization fixes
 * Only renders in development builds
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';

import { COLORS } from '../../constants';
import PerformanceMonitor from '../../utils/PerformanceMonitor';

interface PerformanceReportProps {
  visible: boolean;
  onClose: () => void;
}

const PerformanceReport: React.FC<PerformanceReportProps> = ({ visible, onClose }) => {
  const [report, setReport] = useState(PerformanceMonitor.getPerformanceReport());
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (visible) {
      const interval = setInterval(() => {
        setReport(PerformanceMonitor.getPerformanceReport());
        setRefreshCount(prev => prev + 1);
      }, 2000); // Refresh every 2 seconds

      return () => clearInterval(interval);
    }
  }, [visible]);

  const handleClearMetrics = () => {
    Alert.alert('Clear Metrics', 'This will clear all performance data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        onPress: () => {
          PerformanceMonitor.clearMetrics();
          setReport(PerformanceMonitor.getPerformanceReport());
        },
      },
    ]);
  };

  const getHealthColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return '#4CAF50';
    if (value <= thresholds.warning) return '#FF9800';
    return '#F44336';
  };

  if (!__DEV__) {
    return null; // Only show in development
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Performance Report</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearMetrics}>
              <Ionicons name="trash-outline" size={20} color="#FF5722" />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.PRIMARY} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Dimension Changes</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color: getHealthColor(report.summary.totalDimensionChanges, {
                      good: 5,
                      warning: 20,
                    }),
                  },
                ]}
              >
                {report.summary.totalDimensionChanges}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Active Resources</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color: getHealthColor(
                      report.activeResources.timers + report.activeResources.subscriptions,
                      { good: 5, warning: 15 }
                    ),
                  },
                ]}
              >
                {report.activeResources.timers + report.activeResources.subscriptions}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Memory Leaks</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color: getHealthColor(report.summary.potentialMemoryLeaks.length, {
                      good: 0,
                      warning: 2,
                    }),
                  },
                ]}
              >
                {report.summary.potentialMemoryLeaks.length}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Excessive Renders</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color: getHealthColor(report.summary.componentsWithExcessiveRenders.length, {
                      good: 0,
                      warning: 1,
                    }),
                  },
                ]}
              >
                {report.summary.componentsWithExcessiveRenders.length}
              </Text>
            </View>
          </View>

          {/* Render Counts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Component Render Counts</Text>
            {Object.entries(report.renderCounts).map(([component, count]) => (
              <View key={component} style={styles.metricRow}>
                <Text style={styles.componentName}>{component}</Text>
                <Text
                  style={[
                    styles.metricValue,
                    { color: getHealthColor(count, { good: 10, warning: 50 }) },
                  ]}
                >
                  {count} renders
                </Text>
              </View>
            ))}
          </View>

          {/* Dimension Changes */}
          {report.dimensionChanges.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Dimension Changes</Text>
              {report.dimensionChanges
                .slice(-5)
                .reverse()
                .map((change, index) => (
                  <View key={index} style={styles.dimensionChange}>
                    <Text style={styles.componentName}>{change.componentName}</Text>
                    <Text style={styles.dimensionText}>
                      {change.fromDimensions.width}×{change.fromDimensions.height} →{' '}
                      {change.toDimensions.width}×{change.toDimensions.height}
                    </Text>
                    <Text style={styles.renderCountText}>Render #{change.renderCount}</Text>
                  </View>
                ))}
            </View>
          )}

          {/* Memory Issues */}
          {report.summary.potentialMemoryLeaks.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: '#F44336' }]}>
                ⚠️ Potential Memory Leaks
              </Text>
              {report.summary.potentialMemoryLeaks.map((component, index) => (
                <View key={index} style={[styles.metricRow, { backgroundColor: '#FFEBEE' }]}>
                  <Text style={[styles.componentName, { color: '#F44336' }]}>{component}</Text>
                  <Text style={styles.leakText}>Resource cleanup issue</Text>
                </View>
              ))}
            </View>
          )}

          {/* Excessive Renders Warning */}
          {report.summary.componentsWithExcessiveRenders.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: '#FF9800' }]}>
                ⚠️ Components with Excessive Renders
              </Text>
              {report.summary.componentsWithExcessiveRenders.map((component, index) => (
                <View key={index} style={[styles.metricRow, { backgroundColor: '#FFF3E0' }]}>
                  <Text style={[styles.componentName, { color: '#FF9800' }]}>{component}</Text>
                  <Text style={styles.warningText}>
                    {report.renderCounts[component]} renders (threshold: 20)
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Success Message */}
          {report.summary.potentialMemoryLeaks.length === 0 &&
            report.summary.componentsWithExcessiveRenders.length === 0 && (
              <View style={[styles.section, { backgroundColor: '#E8F5E8' }]}>
                <Text style={[styles.sectionTitle, { color: '#4CAF50' }]}>
                  ✅ Performance Optimizations Working
                </Text>
                <Text style={styles.successText}>
                  No memory leaks or excessive renders detected. The performance fixes are working
                  correctly!
                </Text>
              </View>
            )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Last updated: {new Date().toLocaleTimeString()} (#{refreshCount})
            </Text>
            <Text style={styles.footerText}>Development build only</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#FF5722',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.PRIMARY,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 5,
    borderRadius: 6,
  },
  componentName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  dimensionChange: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  dimensionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  renderCountText: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  leakText: {
    color: '#F44336',
    fontSize: 12,
    fontStyle: 'italic',
  },
  warningText: {
    color: '#FF9800',
    fontSize: 12,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 14,
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default PerformanceReport;
