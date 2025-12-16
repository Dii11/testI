/**
 * Performance Monitor
 *
 * Tracks and reports performance metrics for our optimization fixes
 * - Dimension change frequency and render impact
 * - Memory leak detection for timers and subscriptions
 * - Component mount/unmount cycles
 * - Permission check performance
 */

import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

interface PerformanceMetric {
  name: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface DimensionChangeMetric {
  timestamp: number;
  fromDimensions: { width: number; height: number };
  toDimensions: { width: number; height: number };
  renderCount: number;
  componentName: string;
}

interface MemoryMetric {
  timestamp: number;
  activeTimers: number;
  activeSubscriptions: number;
  componentName: string;
  phase: 'mount' | 'unmount' | 'cleanup';
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private dimensionMetrics: DimensionChangeMetric[] = [];
  private memoryMetrics: MemoryMetric[] = [];
  private renderCounts: Map<string, number> = new Map();
  private isEnabled: boolean = __DEV__; // Only enable in development

  // Track active resources for leak detection
  private activeTimers: Set<string> = new Set();
  private activeSubscriptions: Set<string> = new Set();

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private constructor() {
    if (this.isEnabled) {
      console.log('📊 PerformanceMonitor initialized');
      this.setupAppStateMonitoring();
    }
  }

  /**
   * Track dimension changes and their render impact
   */
  trackDimensionChange(
    componentName: string,
    fromDimensions: { width: number; height: number },
    toDimensions: { width: number; height: number }
  ): void {
    if (!this.isEnabled) return;

    const renderCount = this.incrementRenderCount(componentName);

    const metric: DimensionChangeMetric = {
      timestamp: Date.now(),
      fromDimensions,
      toDimensions,
      renderCount,
      componentName,
    };

    this.dimensionMetrics.push(metric);

    // Keep only last 100 dimension changes
    if (this.dimensionMetrics.length > 100) {
      this.dimensionMetrics.shift();
    }

    console.log(`📐 [${componentName}] Dimension change #${renderCount}:`, {
      from: `${fromDimensions.width}x${fromDimensions.height}`,
      to: `${toDimensions.width}x${toDimensions.height}`,
      rendersSinceMount: renderCount,
    });

    // Alert on excessive renders (potential infinite loop)
    if (renderCount > 50) {
      console.error(
        `🚨 [${componentName}] Excessive renders detected: ${renderCount} renders since mount!`
      );
    }
  }

  /**
   * Track memory usage and resource cleanup
   */
  trackMemoryUsage(
    componentName: string,
    phase: 'mount' | 'unmount' | 'cleanup',
    activeTimers: number = 0,
    activeSubscriptions: number = 0
  ): void {
    if (!this.isEnabled) return;

    const metric: MemoryMetric = {
      timestamp: Date.now(),
      activeTimers,
      activeSubscriptions,
      componentName,
      phase,
    };

    this.memoryMetrics.push(metric);

    // Keep only last 100 memory metrics
    if (this.memoryMetrics.length > 100) {
      this.memoryMetrics.shift();
    }

    if (phase === 'unmount' && (activeTimers > 0 || activeSubscriptions > 0)) {
      console.warn(`💧 [${componentName}] Potential memory leak detected:`, {
        activeTimers,
        activeSubscriptions,
        phase,
      });
    }
  }

  /**
   * Start performance timing
   */
  startTiming(name: string, metadata?: Record<string, any>): string {
    if (!this.isEnabled) return '';

    const timingId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.metrics.push({
      name: `${name}_start`,
      timestamp: performance.now(),
      metadata: { ...metadata, timingId },
    });

    return timingId;
  }

  /**
   * End performance timing
   */
  endTiming(timingId: string, name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled || !timingId) return;

    const endTime = performance.now();
    const startMetric = this.metrics.find(
      m => m.name === `${name}_start` && m.metadata?.timingId === timingId
    );

    if (startMetric) {
      const duration = endTime - startMetric.timestamp;

      this.metrics.push({
        name: `${name}_end`,
        timestamp: endTime,
        duration,
        metadata: { ...metadata, timingId },
      });

      console.log(`⏱️ [${name}] Completed in ${duration.toFixed(2)}ms`);

      // Alert on slow operations
      if (duration > 1000) {
        console.warn(`🐌 [${name}] Slow operation detected: ${duration.toFixed(2)}ms`);
      }
    }
  }

  /**
   * Track timer creation/cleanup for leak detection
   */
  trackTimer(id: string, action: 'create' | 'clear'): void {
    if (!this.isEnabled) return;

    if (action === 'create') {
      this.activeTimers.add(id);
    } else {
      this.activeTimers.delete(id);
    }
  }

  /**
   * Track subscription creation/cleanup for leak detection
   */
  trackSubscription(id: string, action: 'create' | 'remove'): void {
    if (!this.isEnabled) return;

    if (action === 'create') {
      this.activeSubscriptions.add(id);
    } else {
      this.activeSubscriptions.delete(id);
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    dimensionChanges: DimensionChangeMetric[];
    memoryUsage: MemoryMetric[];
    renderCounts: Record<string, number>;
    activeResources: {
      timers: number;
      subscriptions: number;
    };
    summary: {
      totalDimensionChanges: number;
      componentsWithExcessiveRenders: string[];
      potentialMemoryLeaks: string[];
    };
  } {
    const componentsWithExcessiveRenders = Array.from(this.renderCounts.entries())
      .filter(([_, count]) => count > 20)
      .map(([component]) => component);

    const potentialMemoryLeaks = this.memoryMetrics
      .filter(m => m.phase === 'unmount' && (m.activeTimers > 0 || m.activeSubscriptions > 0))
      .map(m => m.componentName);

    return {
      dimensionChanges: [...this.dimensionMetrics],
      memoryUsage: [...this.memoryMetrics],
      renderCounts: Object.fromEntries(this.renderCounts),
      activeResources: {
        timers: this.activeTimers.size,
        subscriptions: this.activeSubscriptions.size,
      },
      summary: {
        totalDimensionChanges: this.dimensionMetrics.length,
        componentsWithExcessiveRenders,
        potentialMemoryLeaks: [...new Set(potentialMemoryLeaks)],
      },
    };
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics = [];
    this.dimensionMetrics = [];
    this.memoryMetrics = [];
    this.renderCounts.clear();
    this.activeTimers.clear();
    this.activeSubscriptions.clear();
  }

  private incrementRenderCount(componentName: string): number {
    const current = this.renderCounts.get(componentName) || 0;
    const newCount = current + 1;
    this.renderCounts.set(componentName, newCount);
    return newCount;
  }

  private setupAppStateMonitoring(): void {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('📊 Performance Report on App Focus:', this.getPerformanceReport().summary);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Store subscription for cleanup if needed
    return subscription;
  }
}

export default PerformanceMonitor.getInstance();
