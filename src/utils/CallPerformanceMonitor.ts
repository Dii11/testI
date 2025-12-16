/**
 * CallPerformanceMonitor - Real-time performance tracking for video calls
 *
 * Monitors:
 * - Component re-render frequency
 * - Memory usage patterns
 * - Network quality changes
 * - Battery optimization effectiveness
 * - Video frame rates and quality
 */

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderInterval: number;
  memoryWarnings: number;
  networkQualityChanges: number;
  videoFrameDrops: number;
  batteryOptimizationSavings: number;
}

interface NetworkMetrics {
  quality: string;
  latency: number;
  packetLoss: number;
  bandwidth: number;
  timestamp: number;
}

class CallPerformanceMonitor {
  private static instance: CallPerformanceMonitor;
  private metrics: PerformanceMetrics;
  private networkHistory: NetworkMetrics[] = [];
  private renderTimes: number[] = [];
  private sessionStartTime: number = 0;

  private constructor() {
    this.metrics = {
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderInterval: 0,
      memoryWarnings: 0,
      networkQualityChanges: 0,
      videoFrameDrops: 0,
      batteryOptimizationSavings: 0,
    };
  }

  static getInstance(): CallPerformanceMonitor {
    if (!CallPerformanceMonitor.instance) {
      CallPerformanceMonitor.instance = new CallPerformanceMonitor();
    }
    return CallPerformanceMonitor.instance;
  }

  /**
   * Start monitoring a new call session
   */
  startSession(callId: string): void {
    console.log(`📊 CallPerformanceMonitor: Starting session ${callId}`);
    this.sessionStartTime = Date.now();
    this.resetMetrics();
  }

  /**
   * Track component re-render
   */
  trackRender(componentName: string): void {
    const now = Date.now();
    this.metrics.renderCount++;

    if (this.metrics.lastRenderTime > 0) {
      const interval = now - this.metrics.lastRenderTime;
      this.renderTimes.push(interval);

      // Keep only last 100 render times for average calculation
      if (this.renderTimes.length > 100) {
        this.renderTimes.shift();
      }

      this.metrics.averageRenderInterval =
        this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
    }

    this.metrics.lastRenderTime = now;

    // Warn about excessive re-renders
    if (this.metrics.renderCount % 50 === 0) {
      console.warn(
        `🔄 ${componentName}: ${this.metrics.renderCount} renders, avg interval: ${Math.round(this.metrics.averageRenderInterval)}ms`
      );
    }
  }

  /**
   * Track network quality changes
   */
  trackNetworkQuality(
    quality: string,
    latency: number,
    packetLoss: number,
    bandwidth: number = 0
  ): void {
    const now = Date.now();

    // Check if quality changed
    const lastMetric = this.networkHistory[this.networkHistory.length - 1];
    if (lastMetric && lastMetric.quality !== quality) {
      this.metrics.networkQualityChanges++;
      console.log(`📡 Network quality changed: ${lastMetric.quality} → ${quality}`);
    }

    // Store network metrics
    this.networkHistory.push({
      quality,
      latency,
      packetLoss,
      bandwidth,
      timestamp: now,
    });

    // Keep only last 100 network measurements
    if (this.networkHistory.length > 100) {
      this.networkHistory.shift();
    }
  }

  /**
   * Track memory warnings
   */
  trackMemoryWarning(source: string): void {
    this.metrics.memoryWarnings++;
    console.warn(`🧠 Memory warning from ${source} (total: ${this.metrics.memoryWarnings})`);
  }

  /**
   * Track video frame drops
   */
  trackVideoFrameDrop(reason: string): void {
    this.metrics.videoFrameDrops++;
    console.warn(`📹 Video frame drop: ${reason} (total: ${this.metrics.videoFrameDrops})`);
  }

  /**
   * Track battery optimization events
   */
  trackBatteryOptimization(
    type: 'background_poll_reduced' | 'interval_increased' | 'render_skipped'
  ): void {
    this.metrics.batteryOptimizationSavings++;
    console.log(
      `🔋 Battery optimization: ${type} (total savings: ${this.metrics.batteryOptimizationSavings})`
    );
  }

  /**
   * Get current performance report
   */
  getPerformanceReport(): any {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const networkStability = this.calculateNetworkStability();

    return {
      session: {
        duration: Math.round(sessionDuration / 1000), // seconds
        startTime: new Date(this.sessionStartTime).toISOString(),
      },
      rendering: {
        totalRenders: this.metrics.renderCount,
        averageRenderInterval: Math.round(this.metrics.averageRenderInterval),
        rendersPerSecond:
          sessionDuration > 0 ? Math.round((this.metrics.renderCount * 1000) / sessionDuration) : 0,
      },
      network: {
        qualityChanges: this.metrics.networkQualityChanges,
        stability: networkStability,
        currentQuality: this.getCurrentNetworkQuality(),
        averageLatency: this.getAverageLatency(),
      },
      optimization: {
        memoryWarnings: this.metrics.memoryWarnings,
        videoFrameDrops: this.metrics.videoFrameDrops,
        batteryOptimizations: this.metrics.batteryOptimizationSavings,
      },
      score: this.calculatePerformanceScore(),
    };
  }

  /**
   * Calculate network stability (0-100)
   */
  private calculateNetworkStability(): number {
    if (this.networkHistory.length < 5) return 100;

    const recentMetrics = this.networkHistory.slice(-20); // Last 20 measurements
    const qualityChanges = recentMetrics.reduce((changes, metric, index) => {
      if (index > 0 && metric.quality !== recentMetrics[index - 1].quality) {
        return changes + 1;
      }
      return changes;
    }, 0);

    return Math.max(0, 100 - qualityChanges * 10);
  }

  /**
   * Get current network quality
   */
  private getCurrentNetworkQuality(): string {
    return this.networkHistory.length > 0
      ? this.networkHistory[this.networkHistory.length - 1].quality
      : 'unknown';
  }

  /**
   * Get average latency
   */
  private getAverageLatency(): number {
    if (this.networkHistory.length === 0) return 0;

    const totalLatency = this.networkHistory.reduce((sum, metric) => sum + metric.latency, 0);
    return Math.round(totalLatency / this.networkHistory.length);
  }

  /**
   * Calculate overall performance score (0-100)
   */
  private calculatePerformanceScore(): number {
    let score = 100;

    // Penalize excessive renders
    if (this.metrics.averageRenderInterval < 16) {
      // < 60fps
      score -= 20;
    } else if (this.metrics.averageRenderInterval < 33) {
      // < 30fps
      score -= 10;
    }

    // Penalize memory warnings
    score -= Math.min(this.metrics.memoryWarnings * 5, 30);

    // Penalize video frame drops
    score -= Math.min(this.metrics.videoFrameDrops * 2, 20);

    // Penalize network instability
    const networkStability = this.calculateNetworkStability();
    score -= (100 - networkStability) * 0.3;

    // Bonus for battery optimizations
    score += Math.min(this.metrics.batteryOptimizationSavings * 0.5, 10);

    return Math.max(0, Math.round(score));
  }

  /**
   * Reset all metrics
   */
  private resetMetrics(): void {
    this.metrics = {
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderInterval: 0,
      memoryWarnings: 0,
      networkQualityChanges: 0,
      videoFrameDrops: 0,
      batteryOptimizationSavings: 0,
    };
    this.networkHistory = [];
    this.renderTimes = [];
  }

  /**
   * End monitoring session and log final report
   */
  endSession(): any {
    const report = this.getPerformanceReport();

    console.log('📊 Call Performance Report:', {
      duration: `${report.session.duration}s`,
      renders: `${report.rendering.totalRenders} (${report.rendering.rendersPerSecond}/s)`,
      networkStability: `${report.network.stability}%`,
      performanceScore: `${report.score}/100`,
    });

    return report;
  }
}

export default CallPerformanceMonitor.getInstance();
