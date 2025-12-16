/**
 * Professional HealthKit Debug Panel
 *
 * ⚠️ MEMORY-OPTIMIZED VERSION ⚠️
 *
 * This component has been heavily optimized to prevent iOS watchdog termination:
 * - Lazy computation with proper memoization
 * - Limited query rendering (max 50)
 * - Memoized child components
 * - Optimized JSON operations
 * - Proper cleanup on unmount
 *
 * Comprehensive debugging UI with:
 * - Raw data visualization
 * - Query history (limited to last 50)
 * - Performance metrics
 * - One-click clipboard export
 * - Sentry snapshot integration
 */

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  healthKitDebugCollector,
  type HealthKitDebugSnapshot,
  type HealthKitQueryDebugData,
} from '../../utils/HealthKitDebugCollector';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants';

// ✅ MEMORY FIX: Limit query rendering to prevent memory overflow
const MAX_QUERIES_TO_RENDER = 50;
const MAX_JSON_STRING_LENGTH = 500; // Limit JSON preview size

interface HealthKitDebugPanelProps {
  isVisible: boolean;
  onClose: () => void;
  currentState: {
    steps: number;
    calories: number;
    heartRate: number | null;
    activeTime: number;
    period: string;
    date: string;
    isAuthorized: boolean;
    hasPermissions: boolean;
    authStatus: number | null;
  };
  chartData: {
    weeklyData?: any[];
    monthlyData?: any[];
    yearlyData?: any[];
  };
}

export const HealthKitDebugPanel: React.FC<HealthKitDebugPanelProps> = ({
  isVisible,
  onClose,
  currentState,
  chartData,
}) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'queries' | 'rawData'>('overview');
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);
  const [isSendingToSentry, setIsSendingToSentry] = useState(false);

  // ✅ CRITICAL FIX: Get queries only when panel becomes visible
  // Previously: Empty dependency array [] meant queries never updated
  // Now: Refetch when isVisible changes AND limit to last 50 queries
  const queries = useMemo(() => {
    if (!isVisible) return [];
    const allQueries = healthKitDebugCollector.getQueries();
    // ✅ MEMORY FIX: Limit to last 50 queries to prevent memory overflow
    return allQueries.slice(-MAX_QUERIES_TO_RENDER);
  }, [isVisible]);

  // ✅ CRITICAL FIX: Lazy snapshot creation - only compute when needed
  // Previously: Recalculated on every currentState/chartData change (expensive!)
  // Now: Only compute when panel is visible AND tab requires it
  const snapshot = useMemo((): HealthKitDebugSnapshot | null => {
    // Don't compute if panel is hidden
    if (!isVisible) return null;

    // Don't compute if we're not on a tab that needs it
    if (selectedTab === 'queries') return null;

    // ✅ MEMORY FIX: Create lightweight snapshot without large arrays
    return healthKitDebugCollector.createSnapshot({
      permissions: {
        isAuthorized: currentState.isAuthorized,
        hasPermissions: currentState.hasPermissions,
        authStatus: currentState.authStatus,
      },
      currentState: {
        steps: currentState.steps,
        calories: currentState.calories,
        heartRate: currentState.heartRate,
        activeTime: currentState.activeTime,
        period: currentState.period,
        date: currentState.date,
      },
      chartData: {
        // ✅ CRITICAL: Only pass counts, not full arrays (prevents deep copy)
        weeklyDataPoints: chartData.weeklyData?.length || 0,
        monthlyDataPoints: chartData.monthlyData?.length || 0,
        yearlyDataPoints: chartData.yearlyData?.length || 0,
        // Don't include actual data arrays in snapshot
        weeklyData: undefined,
        monthlyData: undefined,
        yearlyData: undefined,
      },
    });
  }, [isVisible, selectedTab, currentState, chartData]);

  // ✅ MEMORY FIX: Cleanup on unmount
  useEffect(() => {
    return () => {
      // Reset state when component unmounts to free memory
      setExpandedQuery(null);
      setSelectedTab('overview');
    };
  }, []);

  // ✅ OPTIMIZATION: Use useCallback to prevent function recreation on every render
  const copyToClipboard = useCallback(async (data: string, label: string) => {
    try {
      Clipboard.setString(data);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('✅ Copied!', `${label} copied to clipboard`);
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to copy to clipboard');
    }
  }, []);

  const copyFormattedSnapshot = useCallback(() => {
    if (!snapshot) {
      Alert.alert('⚠️ No Data', 'Snapshot not available. Switch to Overview tab first.');
      return;
    }
    const formatted = healthKitDebugCollector.formatSnapshotForClipboard(snapshot);
    copyToClipboard(formatted, 'Debug snapshot');
  }, [snapshot, copyToClipboard]);

  const copyJSONSnapshot = useCallback(() => {
    if (!snapshot) {
      Alert.alert('⚠️ No Data', 'Snapshot not available. Switch to Overview tab first.');
      return;
    }
    const json = healthKitDebugCollector.generateJSONExport(snapshot);
    copyToClipboard(json, 'JSON snapshot');
  }, [snapshot, copyToClipboard]);

  const sendToSentry = useCallback(async () => {
    if (!snapshot) {
      Alert.alert('⚠️ No Data', 'Snapshot not available. Switch to Overview tab first.');
      return;
    }

    try {
      setIsSendingToSentry(true);
      const success = await healthKitDebugCollector.sendToSentry(
        snapshot,
        'User-initiated debug snapshot from Health Dashboard'
      );

      if (success) {
        Alert.alert(
          '📤 Sent to Sentry',
          'Debug snapshot has been sent to Sentry for analysis. Check your Sentry dashboard.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('❌ Failed', 'Could not send to Sentry. Check console for details.');
      }
    } catch (error) {
      Alert.alert('❌ Error', String(error));
    } finally {
      setIsSendingToSentry(false);
    }
  }, [snapshot]);

  const clearQueryHistory = useCallback(() => {
    Alert.alert(
      'Clear Query History?',
      'This will remove all recorded queries from the debug panel.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            healthKitDebugCollector.clearQueries();
            Alert.alert('✅ Cleared', 'Query history has been cleared');
          },
        },
      ]
    );
  }, []);

  // ✅ OPTIMIZATION: Memoize tab change handlers
  const handleOverviewTab = useCallback(() => setSelectedTab('overview'), []);
  const handleQueriesTab = useCallback(() => setSelectedTab('queries'), []);
  const handleRawDataTab = useCallback(() => setSelectedTab('rawData'), []);

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔍 HealthKit Debug Panel</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={COLORS.WHITE} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.tabActive]}
          onPress={handleOverviewTab}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.tabTextActive]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'queries' && styles.tabActive]}
          onPress={handleQueriesTab}
        >
          <Text style={[styles.tabText, selectedTab === 'queries' && styles.tabTextActive]}>
            Queries ({queries.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'rawData' && styles.tabActive]}
          onPress={handleRawDataTab}
        >
          <Text style={[styles.tabText, selectedTab === 'rawData' && styles.tabTextActive]}>
            Raw Data
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content - ✅ MEMORY FIX: Only render active tab */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {selectedTab === 'overview' && snapshot && (
          <OverviewTab snapshot={snapshot} currentState={currentState} />
        )}
        {selectedTab === 'overview' && !snapshot && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading snapshot...</Text>
          </View>
        )}
        {selectedTab === 'queries' && (
          <QueriesTab
            queries={queries}
            expandedQuery={expandedQuery}
            onToggleQuery={setExpandedQuery}
          />
        )}
        {selectedTab === 'rawData' && snapshot && (
          <RawDataTab chartData={chartData} snapshot={snapshot} />
        )}
        {selectedTab === 'rawData' && !snapshot && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Switch to Overview tab to load data</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={copyFormattedSnapshot}>
          <Ionicons name="copy-outline" size={18} color={COLORS.WHITE} />
          <Text style={styles.actionButtonText}>Copy Report</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={copyJSONSnapshot}>
          <Ionicons name="code-slash-outline" size={18} color={COLORS.WHITE} />
          <Text style={styles.actionButtonText}>Copy JSON</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.sentryButton, isSendingToSentry && styles.buttonDisabled]}
          onPress={sendToSentry}
          disabled={isSendingToSentry}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={COLORS.WHITE} />
          <Text style={styles.actionButtonText}>
            {isSendingToSentry ? 'Sending...' : 'Send to Sentry'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={clearQueryHistory}>
          <Ionicons name="trash-outline" size={18} color={COLORS.WHITE} />
          <Text style={styles.actionButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ✅ MEMORY OPTIMIZATION: Memoized Overview Tab Component
// Prevents re-renders when parent state changes but snapshot hasn't
const OverviewTab = memo<{
  snapshot: HealthKitDebugSnapshot;
  currentState: HealthKitDebugPanelProps['currentState'];
}>(({ snapshot }) => (
  <View>
    <Section title="Platform">
      <InfoRow label="OS" value={`${snapshot.platform} ${snapshot.platformVersion}`} />
      <InfoRow label="Captured" value={new Date(snapshot.capturedAt).toLocaleString()} />
    </Section>

    <Section title="Permissions">
      <InfoRow
        label="Authorized"
        value={snapshot.permissions.isAuthorized ? '✅ Yes' : '❌ No'}
        valueColor={snapshot.permissions.isAuthorized ? '#4ADE80' : '#F87171'}
      />
      <InfoRow
        label="Has Permissions"
        value={snapshot.permissions.hasPermissions ? '✅ Yes' : '❌ No'}
        valueColor={snapshot.permissions.hasPermissions ? '#4ADE80' : '#F87171'}
      />
      <InfoRow label="Auth Status" value={String(snapshot.permissions.authStatus ?? 'Unknown')} />
    </Section>

    <Section title="Current Data">
      <InfoRow label="Steps" value={snapshot.currentState.steps.toLocaleString()} />
      <InfoRow label="Calories" value={`${snapshot.currentState.calories} kcal`} />
      <InfoRow
        label="Heart Rate"
        value={snapshot.currentState.heartRate ? `${snapshot.currentState.heartRate} bpm` : '--'}
      />
      <InfoRow label="Active Time" value={`${snapshot.currentState.activeTime} mins`} />
      <InfoRow label="Period" value={snapshot.currentState.period} />
    </Section>

    <Section title="Chart Data">
      <InfoRow label="Weekly Points" value={String(snapshot.chartData.weeklyDataPoints)} />
      <InfoRow label="Monthly Points" value={String(snapshot.chartData.monthlyDataPoints)} />
      <InfoRow label="Yearly Points" value={String(snapshot.chartData.yearlyDataPoints)} />
    </Section>

    <Section title="Performance">
      <InfoRow label="Total Queries" value={String(snapshot.performance.totalQueries)} />
      {snapshot.performance.averageQueryTime && (
        <InfoRow
          label="Avg Query Time"
          value={`${snapshot.performance.averageQueryTime.toFixed(2)}ms`}
        />
      )}
      {snapshot.performance.slowestQuery && (
        <InfoRow label="Slowest" value={snapshot.performance.slowestQuery} />
      )}
      {snapshot.performance.fastestQuery && (
        <InfoRow label="Fastest" value={snapshot.performance.fastestQuery} />
      )}
    </Section>
  </View>
));

// ✅ MEMORY OPTIMIZATION: Memoized Queries Tab Component
// Prevents re-renders when parent state changes but queries haven't
const QueriesTab = memo<{
  queries: HealthKitQueryDebugData[];
  expandedQuery: number | null;
  onToggleQuery: (index: number | null) => void;
}>(({ queries, expandedQuery, onToggleQuery }) => {
  if (queries.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="file-tray-outline" size={48} color="rgba(255,255,255,0.3)" />
        <Text style={styles.emptyText}>No queries recorded yet</Text>
        <Text style={styles.emptySubtext}>
          Queries will appear here as you interact with the dashboard
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.queryLimitWarning}>
        <Text style={styles.emptySubtext}>
          ⚠️ Showing last {queries.length} of {queries.length} queries (max {MAX_QUERIES_TO_RENDER})
        </Text>
      </View>
      {queries.map((query, index) => (
        <QueryItem
          key={`${query.timestamp}-${index}`}
          query={query}
          index={index}
          isExpanded={expandedQuery === index}
          onToggle={() => onToggleQuery(expandedQuery === index ? null : index)}
        />
      ))}
    </View>
  );
});

// ✅ MEMORY OPTIMIZATION: Memoized Query Item Component
// Each query item only re-renders when its own data changes
const QueryItem = memo<{
  query: HealthKitQueryDebugData;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}>(({ query, index, isExpanded, onToggle }) => {
  // ✅ MEMORY FIX: Limit string lengths to prevent memory spikes
  const truncateString = useCallback((str: string, maxLength: number = MAX_JSON_STRING_LENGTH) => {
    if (str.length <= maxLength) return str;
    return `${str.slice(0, maxLength)}... (${str.length - maxLength} more chars)`;
  }, []);

  return (
    <TouchableOpacity style={styles.queryItem} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.queryHeader}>
        <View style={styles.queryHeaderLeft}>
          <Text style={styles.queryIndex}>#{index + 1}</Text>
          <Text style={styles.queryHookName}>{query.hookName}</Text>
          <View style={[styles.queryTypeBadge, styles[`badge${query.queryType}`]]}>
            <Text style={styles.queryTypeText}>{query.queryType}</Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="rgba(255,255,255,0.6)"
        />
      </View>

      <View style={styles.queryMeta}>
        <Text style={styles.queryMetaText}>
          {new Date(query.timestamp).toLocaleTimeString()}
        </Text>
        {query.queryDuration && (
          <Text style={styles.queryMetaText}>⏱️ {query.queryDuration}ms</Text>
        )}
        {query.metadata?.sampleCount && (
          <Text style={styles.queryMetaText}>📊 {query.metadata.sampleCount} samples</Text>
        )}
      </View>

      {isExpanded && (
        <View style={styles.queryDetails}>
          {query.metadata?.dateRange && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date Range:</Text>
              <Text style={styles.detailValue}>
                {query.metadata.dateRange.start} → {query.metadata.dateRange.end}
              </Text>
            </View>
          )}
          {query.error && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, styles.errorLabel]}>Error:</Text>
              <Text style={[styles.detailValue, styles.errorValue]}>
                {truncateString(JSON.stringify(query.error))}
              </Text>
            </View>
          )}
          {query.processedData && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Processed Data:</Text>
              <Text style={styles.detailValue}>
                {truncateString(String(query.processedData), 200)}
              </Text>
            </View>
          )}
          {query.rawResponseSummary && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Raw Response:</Text>
              <Text style={styles.detailValue}>
                {truncateString(query.rawResponseSummary, 300)}
              </Text>
            </View>
          )}
          {query.metadata?.rawDataSize && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Data Size:</Text>
              <Text style={styles.detailValue}>
                {(query.metadata.rawDataSize / 1024).toFixed(2)} KB
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better memoization
  return (
    prevProps.query.timestamp === nextProps.query.timestamp &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.index === nextProps.index
  );
});

// ✅ MEMORY OPTIMIZATION: Memoized Raw Data Tab Component (MEMORY-SAFE)
// Prevents unnecessary JSON operations and large data rendering
const RawDataTab = memo<{
  chartData: HealthKitDebugPanelProps['chartData'];
  snapshot: HealthKitDebugSnapshot;
}>(({ chartData, snapshot }) => {
  // ✅ MEMORY FIX: Don't render full arrays, just summaries
  const getDataSummary = useCallback((data: any[]): string => {
    if (!data || data.length === 0) return 'No data';

    try {
      // ✅ CRITICAL: Limit JSON.stringify to prevent memory spike
      const firstItemStr = JSON.stringify(data[0]);
      const preview = firstItemStr.slice(0, 100);
      return `${data.length} items - First: ${preview}${firstItemStr.length > 100 ? '...' : ''}`;
    } catch (error) {
      return `${data.length} items - [Unable to stringify]`;
    }
  }, []);

  // ✅ MEMORY FIX: Memoize expensive JSON operation
  const snapshotPreview = useMemo(() => {
    try {
      const lightSnapshot = {
        platform: snapshot.platform,
        platformVersion: snapshot.platformVersion,
        capturedAt: snapshot.capturedAt,
        permissions: snapshot.permissions,
        currentState: snapshot.currentState,
        chartData: {
          weeklyDataPoints: snapshot.chartData.weeklyDataPoints,
          monthlyDataPoints: snapshot.chartData.monthlyDataPoints,
          yearlyDataPoints: snapshot.chartData.yearlyDataPoints,
        },
        performance: snapshot.performance,
        // ✅ CRITICAL: Only include first 3 queries (not full array)
        queriesCount: snapshot.queries.length,
        recentQueries: snapshot.queries.slice(0, 3).map(q => ({
          hookName: q.hookName,
          queryType: q.queryType,
          timestamp: q.timestamp,
          duration: q.queryDuration,
        })),
      };

      return JSON.stringify(lightSnapshot, null, 2).slice(0, 2000); // Max 2000 chars
    } catch (error) {
      return 'Error generating preview';
    }
  }, [snapshot]);

  return (
    <View>
      <Section title="Chart Data Summary">
        <InfoRow label="Weekly Data" value={getDataSummary(chartData.weeklyData || [])} />
        <InfoRow label="Monthly Data" value={getDataSummary(chartData.monthlyData || [])} />
        <InfoRow label="Yearly Data" value={getDataSummary(chartData.yearlyData || [])} />
        <Text style={styles.emptySubtext}>
          ⚠️ Full arrays excluded to prevent memory issues
        </Text>
      </Section>

      <Section title="Snapshot Preview (Limited)">
        <ScrollView horizontal style={styles.jsonScroll}>
          <Text style={styles.jsonText}>{snapshotPreview}</Text>
        </ScrollView>
        <Text style={styles.emptySubtext}>
          ⚠️ Preview limited to 2000 chars. Use "Copy JSON" for full export.
        </Text>
      </Section>
    </View>
  );
});

// ✅ MEMORY OPTIMIZATION: Memoized Helper Components
// Prevents re-renders of static UI elements
const Section = memo<{ title: string; children: React.ReactNode }>(({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
));

const InfoRow = memo<{ label: string; value: string; valueColor?: string }>(({
  label,
  value,
  valueColor,
}) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}:</Text>
    <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
  </View>
));

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: SPACING.XL + 70,
    left: SPACING.LG,
    right: SPACING.LG,
    maxHeight: '75%',
    backgroundColor: 'rgba(0, 0, 0, 0.97)',
    borderRadius: BORDER_RADIUS.LG,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    overflow: 'hidden',
    zIndex: 999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(45, 226, 179, 0.1)',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.SM,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.PRIMARY,
  },
  tabText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  content: {
    maxHeight: 400,
    padding: SPACING.MD,
  },
  section: {
    marginBottom: SPACING.LG,
    paddingBottom: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginBottom: SPACING.SM,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.XS,
  },
  infoLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: 'rgba(255, 255, 255, 0.6)',
    flex: 1,
  },
  infoValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.WHITE,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
    textAlign: 'right',
  },
  queryItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
    marginBottom: SPACING.SM,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  queryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.XS,
  },
  queryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  queryIndex: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: 'rgba(255, 255, 255, 0.4)',
    marginRight: SPACING.SM,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  queryHookName: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.WHITE,
    fontWeight: '600',
    marginRight: SPACING.SM,
  },
  queryTypeBadge: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.SM,
  },
  badgestatistics: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  badgesamples: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  badgeaggregation: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  queryTypeText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.WHITE,
    fontWeight: '500',
  },
  queryMeta: {
    flexDirection: 'row',
    gap: SPACING.MD,
  },
  queryMetaText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  queryDetails: {
    marginTop: SPACING.SM,
    paddingTop: SPACING.SM,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailRow: {
    marginBottom: SPACING.SM,
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.WHITE,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorLabel: {
    color: '#F87171',
  },
  errorValue: {
    color: '#FCA5A5',
  },
  jsonScroll: {
    maxHeight: 200,
  },
  jsonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: '#A5F3FC',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.SM,
    padding: SPACING.MD,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: BORDER_RADIUS.SM,
    flex: 1,
    minWidth: '45%',
    justifyContent: 'center',
  },
  sentryButton: {
    backgroundColor: '#6B46C1',
  },
  clearButton: {
    backgroundColor: '#EF4444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XXL,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: SPACING.MD,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: SPACING.XS,
    textAlign: 'center',
  },
  queryLimitWarning: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: BORDER_RADIUS.SM,
    padding: SPACING.SM,
    marginBottom: SPACING.MD,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
});
