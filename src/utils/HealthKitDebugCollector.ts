/**
 * HealthKit Debug Data Collector
 *
 * Professional debugging utility for collecting, formatting, and exporting
 * HealthKit data for analysis. Supports clipboard export and Sentry integration.
 */

import { Platform } from 'react-native';
import { sentryTracker } from './sentryErrorTracker';

export interface HealthKitQueryDebugData {
  hookName: string;
  queryType: 'statistics' | 'samples' | 'aggregation';
  timestamp?: string; // ✅ Optional - added automatically by recordQuery
  queryDuration?: number;
  rawResponseSummary?: string; // ✅ MEMORY FIX: Store summary, not full response
  processedData?: any;
  error?: any;
  metadata?: {
    dateRange?: { start: string; end: string };
    sampleCount?: number;
    dataPoints?: number;
    queryParams?: any;
    rawDataSize?: number; // ✅ Track size instead of storing data
  };
}

export interface HealthKitDebugSnapshot {
  capturedAt: string;
  platform: string;
  platformVersion: string | number;
  permissions: {
    isAuthorized: boolean;
    hasPermissions: boolean;
    authStatus: number | null;
  };
  queries: HealthKitQueryDebugData[];
  currentState: {
    steps: number;
    calories: number;
    heartRate: number | null;
    activeTime: number;
    period: string;
    date: string;
  };
  chartData: {
    weeklyDataPoints: number;
    monthlyDataPoints: number;
    yearlyDataPoints: number;
    weeklyData?: any[];
    monthlyData?: any[];
    yearlyData?: any[];
  };
  performance: {
    totalQueries: number;
    averageQueryTime?: number;
    slowestQuery?: string;
    fastestQuery?: string;
  };
}

class HealthKitDebugCollector {
  private queries: HealthKitQueryDebugData[] = [];
  private maxQueries = 10; // ✅ MEMORY FIX: Reduced from 50 to 10
  private maxDataSize = 1000; // ✅ Max chars for any stored data

  /**
   * Safely summarize data without storing full objects
   */
  private summarizeData(data: any): string {
    try {
      if (!data) return 'null';

      if (Array.isArray(data)) {
        const preview = data.slice(0, 2); // Only first 2 items
        const summary = JSON.stringify(preview);
        return `Array(${data.length}) [${summary.slice(0, 100)}...]`;
      }

      const str = JSON.stringify(data);
      if (str.length > this.maxDataSize) {
        return str.slice(0, this.maxDataSize) + '... (truncated)';
      }
      return str;
    } catch (error) {
      return '[Unable to serialize]';
    }
  }

  /**
   * Calculate data size safely
   */
  private getDataSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * Record a HealthKit query for debugging (MEMORY-SAFE)
   */
  recordQuery(data: Omit<HealthKitQueryDebugData, 'rawResponseSummary'> & { rawResponse?: any }) {
    try {
      // ✅ MEMORY FIX: Create memory-safe version
      const safeQuery: HealthKitQueryDebugData = {
        hookName: data.hookName,
        queryType: data.queryType,
        timestamp: new Date().toISOString(),
        queryDuration: data.queryDuration,
        rawResponseSummary: data.rawResponse ? this.summarizeData(data.rawResponse) : undefined,
        processedData: data.processedData ? this.summarizeData(data.processedData) : undefined,
        error: data.error ? String(data.error).slice(0, 500) : undefined,
        metadata: {
          ...data.metadata,
          rawDataSize: data.rawResponse ? this.getDataSize(data.rawResponse) : 0,
        },
      };

      this.queries.unshift(safeQuery);

      // Keep only last N queries
      if (this.queries.length > this.maxQueries) {
        this.queries = this.queries.slice(0, this.maxQueries);
      }

      if (__DEV__) {
        console.log(`📊 [HealthKitDebug] Recorded query from ${data.hookName}:`, {
          type: data.queryType,
          duration: data.queryDuration ? `${data.queryDuration}ms` : 'N/A',
          sampleCount: data.metadata?.sampleCount,
          dataSize: safeQuery.metadata?.rawDataSize,
          error: data.error ? 'YES' : 'NO',
        });
      }
    } catch (error) {
      console.error('Failed to record query:', error);
    }
  }

  /**
   * Get all recorded queries
   */
  getQueries(): HealthKitQueryDebugData[] {
    return [...this.queries];
  }

  /**
   * Get queries filtered by hook name
   */
  getQueriesByHook(hookName: string): HealthKitQueryDebugData[] {
    return this.queries.filter(q => q.hookName === hookName);
  }

  /**
   * Clear all recorded queries
   */
  clearQueries() {
    this.queries = [];
    if (__DEV__) {
      console.log('🧹 [HealthKitDebug] Cleared all query records');
    }
  }

  /**
   * Create a comprehensive debug snapshot (MEMORY-SAFE)
   */
  createSnapshot(currentState: Partial<HealthKitDebugSnapshot>): HealthKitDebugSnapshot {
    try {
      const queries = this.getQueries();

      // Calculate performance metrics
      const queriesWithDuration = queries.filter(q => q.queryDuration !== undefined);
      const totalDuration = queriesWithDuration.reduce((sum, q) => sum + (q.queryDuration || 0), 0);
      const averageQueryTime = queriesWithDuration.length > 0
        ? totalDuration / queriesWithDuration.length
        : undefined;

      const slowestQuery = queriesWithDuration.sort((a, b) =>
        (b.queryDuration || 0) - (a.queryDuration || 0)
      )[0];

      const fastestQuery = queriesWithDuration.sort((a, b) =>
        (a.queryDuration || 0) - (b.queryDuration || 0)
      )[0];

      // ✅ MEMORY FIX: Don't include full chart data, just counts
      const safeChartData = {
        weeklyDataPoints: currentState.chartData?.weeklyDataPoints || 0,
        monthlyDataPoints: currentState.chartData?.monthlyDataPoints || 0,
        yearlyDataPoints: currentState.chartData?.yearlyDataPoints || 0,
        // Don't include actual data arrays - too large!
      };

      return {
        capturedAt: new Date().toISOString(),
        platform: Platform.OS,
        platformVersion: Platform.Version,
        permissions: currentState.permissions || {
          isAuthorized: false,
          hasPermissions: false,
          authStatus: null,
        },
        queries,
        currentState: currentState.currentState || {
          steps: 0,
          calories: 0,
          heartRate: null,
          activeTime: 0,
          period: 'today',
          date: new Date().toISOString(),
        },
        chartData: safeChartData,
        performance: {
          totalQueries: queries.length,
          averageQueryTime,
          slowestQuery: slowestQuery?.hookName,
          fastestQuery: fastestQuery?.hookName,
        },
      };
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      // Return minimal safe snapshot
      return {
        capturedAt: new Date().toISOString(),
        platform: Platform.OS,
        platformVersion: Platform.Version,
        permissions: { isAuthorized: false, hasPermissions: false, authStatus: null },
        queries: [],
        currentState: {
          steps: 0,
          calories: 0,
          heartRate: null,
          activeTime: 0,
          period: 'today',
          date: new Date().toISOString(),
        },
        chartData: { weeklyDataPoints: 0, monthlyDataPoints: 0, yearlyDataPoints: 0 },
        performance: { totalQueries: 0 },
      };
    }
  }

  /**
   * Format snapshot for clipboard (human-readable markdown)
   */
  formatSnapshotForClipboard(snapshot: HealthKitDebugSnapshot): string {
    const lines: string[] = [];

    lines.push('# HealthKit Debug Snapshot');
    lines.push('');
    lines.push(`**Captured:** ${new Date(snapshot.capturedAt).toLocaleString()}`);
    lines.push(`**Platform:** ${snapshot.platform} ${snapshot.platformVersion}`);
    lines.push('');

    // Permissions
    lines.push('## Permissions');
    lines.push(`- Authorized: ${snapshot.permissions.isAuthorized ? '✅' : '❌'}`);
    lines.push(`- Has Permissions: ${snapshot.permissions.hasPermissions ? '✅' : '❌'}`);
    lines.push(`- Auth Status: ${snapshot.permissions.authStatus ?? 'Unknown'}`);
    lines.push('');

    // Current State
    lines.push('## Current State');
    lines.push(`- Steps: ${snapshot.currentState.steps}`);
    lines.push(`- Calories: ${snapshot.currentState.calories} kcal`);
    lines.push(`- Heart Rate: ${snapshot.currentState.heartRate ?? '--'} bpm`);
    lines.push(`- Active Time: ${snapshot.currentState.activeTime} mins`);
    lines.push(`- Period: ${snapshot.currentState.period}`);
    lines.push(`- Date: ${snapshot.currentState.date}`);
    lines.push('');

    // Chart Data
    lines.push('## Chart Data');
    lines.push(`- Weekly Data Points: ${snapshot.chartData.weeklyDataPoints}`);
    lines.push(`- Monthly Data Points: ${snapshot.chartData.monthlyDataPoints}`);
    lines.push(`- Yearly Data Points: ${snapshot.chartData.yearlyDataPoints}`);
    lines.push('');

    // Performance
    lines.push('## Performance');
    lines.push(`- Total Queries: ${snapshot.performance.totalQueries}`);
    if (snapshot.performance.averageQueryTime) {
      lines.push(`- Average Query Time: ${snapshot.performance.averageQueryTime.toFixed(2)}ms`);
    }
    if (snapshot.performance.slowestQuery) {
      lines.push(`- Slowest Query: ${snapshot.performance.slowestQuery}`);
    }
    if (snapshot.performance.fastestQuery) {
      lines.push(`- Fastest Query: ${snapshot.performance.fastestQuery}`);
    }
    lines.push('');

    // Recent Queries
    lines.push('## Recent Queries');
    const recentQueries = snapshot.queries.slice(0, 10);
    if (recentQueries.length === 0) {
      lines.push('_No queries recorded_');
    } else {
      recentQueries.forEach((query, index) => {
        lines.push(`### ${index + 1}. ${query.hookName} (${query.queryType})`);
        if (query.timestamp) {
          lines.push(`- Time: ${new Date(query.timestamp).toLocaleTimeString()}`);
        }
        if (query.queryDuration) {
          lines.push(`- Duration: ${query.queryDuration}ms`);
        }
        if (query.metadata?.sampleCount) {
          lines.push(`- Samples: ${query.metadata.sampleCount}`);
        }
        if (query.metadata?.dateRange) {
          lines.push(`- Range: ${query.metadata.dateRange.start} → ${query.metadata.dateRange.end}`);
        }
        if (query.error) {
          lines.push(`- Error: ${JSON.stringify(query.error)}`);
        }
        lines.push('');
      });
    }

    // ✅ MEMORY FIX: Don't include chart data - too large
    lines.push('_Chart data excluded to save memory_');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Send debug snapshot to Sentry
   */
  async sendToSentry(snapshot: HealthKitDebugSnapshot, userNote?: string) {
    try {
      const context = {
        platform: snapshot.platform,
        platformVersion: snapshot.platformVersion,
        permissions: snapshot.permissions,
        currentState: snapshot.currentState,
        chartData: {
          weeklyDataPoints: snapshot.chartData.weeklyDataPoints,
          monthlyDataPoints: snapshot.chartData.monthlyDataPoints,
          yearlyDataPoints: snapshot.chartData.yearlyDataPoints,
        },
        performance: snapshot.performance,
        recentQueries: snapshot.queries.slice(0, 5).map(q => ({
          hookName: q.hookName,
          queryType: q.queryType,
          timestamp: q.timestamp,
          duration: q.queryDuration,
          sampleCount: q.metadata?.sampleCount,
          hasError: !!q.error,
        })),
        userNote,
      };

      sentryTracker.trackServiceError(
        new Error('HealthKit Debug Snapshot'),
        {
          service: 'HealthKitDebug',
          action: 'debugSnapshot',
          additional: context,
        }
      );

      if (__DEV__) {
        console.log('📤 [HealthKitDebug] Snapshot sent to Sentry:', {
          totalQueries: snapshot.queries.length,
          capturedAt: snapshot.capturedAt,
        });
      }

      return true;
    } catch (error) {
      console.error('❌ [HealthKitDebug] Failed to send snapshot to Sentry:', error);
      return false;
    }
  }

  /**
   * Generate detailed JSON export (for advanced debugging)
   */
  generateJSONExport(snapshot: HealthKitDebugSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }
}

// Singleton instance
export const healthKitDebugCollector = new HealthKitDebugCollector();
