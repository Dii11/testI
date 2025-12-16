/**
 * Memory Monitor Utility
 *
 * Monitors memory usage and provides warnings before iOS watchdog termination.
 * Helps prevent crashes by proactively cleaning up resources.
 *
 * Usage:
 * ```typescript
 * import { memoryMonitor } from './utils/MemoryMonitor';
 *
 * // In component:
 * useEffect(() => {
 *   memoryMonitor.registerComponent('SimpleStepsDashboard', () => {
 *     // Cleanup callback when memory pressure detected
 *     setShowDebugPanel(false);
 *     healthKitDebugCollector.clearQueries();
 *   });
 *
 *   return () => memoryMonitor.unregisterComponent('SimpleStepsDashboard');
 * }, []);
 * ```
 */

import { Platform, AppState, type AppStateStatus } from 'react-native';
import { sentryTracker } from './sentryErrorTracker';

interface ComponentCleanup {
  name: string;
  cleanup: () => void;
  registeredAt: Date;
}

interface MemoryWarning {
  timestamp: Date;
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredCleanup: boolean;
}

class MemoryMonitor {
  private components: Map<string, ComponentCleanup> = new Map();
  private warnings: MemoryWarning[] = [];
  private maxWarnings = 50; // Keep last 50 warnings
  private isMonitoring = false;
  private appStateSubscription: any = null;
  private warningCount = 0;

  /**
   * Start monitoring memory
   */
  startMonitoring() {
    if (this.isMonitoring) return;

    if (Platform.OS === 'ios') {
      // iOS memory warnings are handled by the system
      // We'll use app state changes as a proxy for memory pressure
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange.bind(this)
      );

      this.isMonitoring = true;
      console.log('📊 [MemoryMonitor] Started monitoring');
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.appStateSubscription?.remove();
    this.isMonitoring = false;
    console.log('📊 [MemoryMonitor] Stopped monitoring');
  }

  /**
   * Register a component for cleanup
   */
  registerComponent(name: string, cleanup: () => void) {
    this.components.set(name, {
      name,
      cleanup,
      registeredAt: new Date(),
    });

    console.log(`📊 [MemoryMonitor] Registered ${name} (${this.components.size} total)`);
  }

  /**
   * Unregister a component
   */
  unregisterComponent(name: string) {
    const removed = this.components.delete(name);
    if (removed) {
      console.log(`📊 [MemoryMonitor] Unregistered ${name} (${this.components.size} remaining)`);
    }
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus) {
    if (nextAppState === 'background') {
      // App going to background - likely memory pressure
      this.handleMemoryPressure('medium', 'App backgrounded - proactive cleanup');
    } else if (nextAppState === 'inactive') {
      // App becoming inactive - prepare for cleanup
      this.handleMemoryPressure('low', 'App inactive - preparing for cleanup');
    }
  }

  /**
   * Handle detected memory pressure
   */
  handleMemoryPressure(
    level: 'low' | 'medium' | 'high' | 'critical',
    message: string
  ) {
    this.warningCount++;

    const warning: MemoryWarning = {
      timestamp: new Date(),
      level,
      message,
      triggeredCleanup: false,
    };

    console.warn(`⚠️ [MemoryMonitor] Memory pressure detected (${level}): ${message}`);

    // Trigger cleanup for medium+ pressure
    if (level === 'medium' || level === 'high' || level === 'critical') {
      const cleanedComponents: string[] = [];

      this.components.forEach((component) => {
        try {
          component.cleanup();
          cleanedComponents.push(component.name);
        } catch (error) {
          console.error(`❌ [MemoryMonitor] Cleanup failed for ${component.name}:`, error);
        }
      });

      if (cleanedComponents.length > 0) {
        warning.triggeredCleanup = true;
        console.log(`🧹 [MemoryMonitor] Cleaned up ${cleanedComponents.length} components:`, cleanedComponents);
      }
    }

    // Store warning
    this.warnings.unshift(warning);
    if (this.warnings.length > this.maxWarnings) {
      this.warnings = this.warnings.slice(0, this.maxWarnings);
    }

    // Send to Sentry for critical/high warnings
    if (level === 'critical' || level === 'high') {
      this.reportToSentry(warning);
    }
  }

  /**
   * Report memory warning to Sentry
   */
  private reportToSentry(warning: MemoryWarning) {
    try {
      sentryTracker.trackServiceError(
        new Error('Memory pressure detected'),
        {
          service: 'MemoryMonitor',
          action: 'memoryWarning',
          additional: {
            level: warning.level,
            message: warning.message,
            triggeredCleanup: warning.triggeredCleanup,
            registeredComponents: Array.from(this.components.keys()),
            totalWarnings: this.warningCount,
          },
        }
      );
    } catch (error) {
      console.error('❌ [MemoryMonitor] Failed to report to Sentry:', error);
    }
  }

  /**
   * Get all warnings
   */
  getWarnings(): MemoryWarning[] {
    return [...this.warnings];
  }

  /**
   * Get warning count
   */
  getWarningCount(): number {
    return this.warningCount;
  }

  /**
   * Get registered components
   */
  getRegisteredComponents(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Clear all warnings
   */
  clearWarnings() {
    this.warnings = [];
    this.warningCount = 0;
    console.log('🧹 [MemoryMonitor] Cleared all warnings');
  }

  /**
   * Generate memory report
   */
  generateReport(): string {
    const lines: string[] = [];

    lines.push('# Memory Monitor Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toLocaleString()}`);
    lines.push(`**Platform:** ${Platform.OS} ${Platform.Version}`);
    lines.push(`**Monitoring:** ${this.isMonitoring ? '✅ Active' : '❌ Inactive'}`);
    lines.push('');

    // Registered Components
    lines.push('## Registered Components');
    if (this.components.size === 0) {
      lines.push('_No components registered_');
    } else {
      this.components.forEach((component) => {
        lines.push(`- **${component.name}** (registered ${component.registeredAt.toLocaleTimeString()})`);
      });
    }
    lines.push('');

    // Warning Summary
    lines.push('## Warning Summary');
    lines.push(`- Total Warnings: ${this.warningCount}`);
    lines.push(`- Recent Warnings: ${this.warnings.length}`);

    const criticalCount = this.warnings.filter(w => w.level === 'critical').length;
    const highCount = this.warnings.filter(w => w.level === 'high').length;
    const mediumCount = this.warnings.filter(w => w.level === 'medium').length;
    const lowCount = this.warnings.filter(w => w.level === 'low').length;

    lines.push(`- Critical: ${criticalCount}`);
    lines.push(`- High: ${highCount}`);
    lines.push(`- Medium: ${mediumCount}`);
    lines.push(`- Low: ${lowCount}`);
    lines.push('');

    // Recent Warnings
    lines.push('## Recent Warnings');
    const recentWarnings = this.warnings.slice(0, 10);
    if (recentWarnings.length === 0) {
      lines.push('_No warnings recorded_');
    } else {
      recentWarnings.forEach((warning, index) => {
        lines.push(`### ${index + 1}. ${warning.level.toUpperCase()} - ${warning.timestamp.toLocaleTimeString()}`);
        lines.push(`- Message: ${warning.message}`);
        lines.push(`- Triggered Cleanup: ${warning.triggeredCleanup ? '✅ Yes' : '❌ No'}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  /**
   * Manually trigger cleanup for testing
   */
  triggerManualCleanup() {
    console.log('🧪 [MemoryMonitor] Manual cleanup triggered');
    this.handleMemoryPressure('high', 'Manual cleanup triggered for testing');
  }
}

// Singleton instance
export const memoryMonitor = new MemoryMonitor();

// Auto-start monitoring in production
if (!__DEV__) {
  memoryMonitor.startMonitoring();
}
