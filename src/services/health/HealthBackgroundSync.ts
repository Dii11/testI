import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';

import { store } from '../../store';
import { fetchLatestHealthData } from '../../store/slices/healthSlice';
import { sentryTracker } from '../../utils/sentryErrorTracker';

class HealthBackgroundSync {
  private static instance: HealthBackgroundSync;
  private lastSync: number = 0;
  private appState: AppStateStatus = 'active';
  private intervalId: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private started = false;

  static getInstance() {
    if (!HealthBackgroundSync.instance) {
      HealthBackgroundSync.instance = new HealthBackgroundSync();
    }
    return HealthBackgroundSync.instance;
  }

  start() {
    if (this.started) return;
    this.started = true;

    // Modern React Native event listener with proper cleanup
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Start with adaptive sync interval
    this.scheduleNextSync();
    this.maybeSync('start');
  }

  stop() {
    if (!this.started) return;
    this.started = false;

    // Proper cleanup for modern React Native
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Intelligent sync scheduling based on usage patterns and device state
   */
  private scheduleNextSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const interval = this.calculateOptimalInterval();
    this.intervalId = setInterval(() => this.maybeSync('interval'), interval);

    console.log(`📅 Next health sync scheduled in ${interval / 1000 / 60} minutes`);
  }

  /**
   * Calculate optimal sync interval based on various factors
   */
  private calculateOptimalInterval(): number {
    if (!this.config.adaptiveSync) {
      return this.config.baseInterval;
    }

    let interval = this.config.baseInterval;

    // Adjust based on failure rate
    const failureRate =
      this.syncMetrics.syncCount > 0
        ? this.syncMetrics.failureCount / this.syncMetrics.syncCount
        : 0;

    if (failureRate > 0.3) {
      // High failure rate - sync less frequently
      interval = Math.min(interval * 1.5, this.config.maxInterval);
    } else if (failureRate < 0.1) {
      // Low failure rate - can sync more frequently
      interval = Math.max(interval * 0.8, this.config.minInterval);
    }

    // Adjust based on time since last successful sync
    const timeSinceLastSync = Date.now() - this.syncMetrics.lastSync;
    if (timeSinceLastSync > 2 * 60 * 60 * 1000) {
      // 2 hours
      // Force more frequent syncing if it's been too long
      interval = this.config.minInterval;
    }

    // Battery optimization (simplified - in real app would use battery API)
    if (this.config.batteryOptimization) {
      const hour = new Date().getHours();
      if (hour >= 22 || hour <= 6) {
        // Night time - reduce sync frequency
        interval = Math.min(interval * 2, this.config.maxInterval);
      }
    }

    return Math.round(interval);
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    const wasInBackground = this.appState.match(/inactive|background/);

    if (wasInBackground && nextState === 'active') {
      // App came to foreground - immediate sync if it's been a while
      const timeSinceLastSync = Date.now() - this.syncMetrics.lastSync;
      if (timeSinceLastSync > 30 * 60 * 1000) {
        // 30 minutes
        console.log('📱 App returned to foreground - performing immediate sync');
        this.maybeSync('resume');
      } else {
        console.log('📱 App returned to foreground - recent sync, skipping');
      }

      // Reschedule with fresh interval calculation
      this.scheduleNextSync();
    }

    if (nextState === 'background') {
      // App going to background - record metrics
      console.log('📱 App going to background - pausing adaptive sync');
    }

    this.appState = nextState;
  };

  private async maybeSync(reason: string) {
    try {
      const now = Date.now();
      const timeSinceLastSync = now - this.syncMetrics.lastSync;

      // Intelligent sync frequency based on reason
      const minIntervalForReason = {
        start: 0, // Always sync on start
        resume: 2 * 60 * 1000, // 2 minutes when resuming
        interval: this.calculateOptimalInterval(), // Adaptive interval
        manual: 0, // Always sync when manual
      };

      const minInterval =
        minIntervalForReason[reason as keyof typeof minIntervalForReason] || 5 * 60 * 1000;

      if (timeSinceLastSync < minInterval && reason !== 'start') {
        console.log(`⏭️ Skipping sync - too soon (${timeSinceLastSync / 1000}s since last)`);
        return;
      }

      const state: any = store.getState();
      if (!state.health.permissions?.granted) {
        console.log('🚫 Skipping sync - no health permissions');
        return;
      }

      // Detect Expo Go
      try {
        const Constants = require('expo-constants').default;
        if (Constants?.appOwnership === 'expo') {
          console.log('📱 Skipping sync - running in Expo Go');
          return;
        }
      } catch {}

      console.log(`🔄 Starting intelligent health sync (${reason})`);
      const startTime = Date.now();

      await store
        .dispatch(
          fetchLatestHealthData({
            forceRefresh: reason === 'manual' || reason === 'start',
            selectedPeriod: 'Today', // Focus on today's data for efficiency
          })
        )
        .unwrap();

      const duration = Date.now() - startTime;

      // Update metrics
      this.syncMetrics.lastSync = now;
      this.syncMetrics.syncCount++;
      this.syncMetrics.averageSyncDuration =
        (this.syncMetrics.averageSyncDuration * (this.syncMetrics.syncCount - 1) + duration) /
        this.syncMetrics.syncCount;

      this.lastSync = now; // Backward compatibility

      console.log(
        `✅ Background health sync (${reason}) completed in ${duration}ms (avg: ${this.syncMetrics.averageSyncDuration.toFixed(0)}ms)`
      );

      // Reschedule next sync based on success
      if (reason === 'interval') {
        this.scheduleNextSync();
      }
    } catch (e) {
      console.warn('🏥 Background health sync failed', e);

      // Update failure metrics
      this.syncMetrics.failureCount++;

      // Reschedule with longer interval after failure
      if (reason === 'interval') {
        this.scheduleNextSync();
      }

      // Track background sync error to Sentry
      sentryTracker.trackCriticalError(e instanceof Error ? e : 'Background health sync failed', {
        service: 'healthBackgroundSync',
        action: 'maybeSync',
        additional: {
          reason,
          platform: Platform.OS,
          lastSync: this.lastSync,
          appState: this.appState,
          failureRate: this.syncMetrics.failureCount / Math.max(this.syncMetrics.syncCount, 1),
          averageDuration: this.syncMetrics.averageSyncDuration,
        },
      });
    }
  }

  /**
   * Get sync statistics for debugging
   */
  getSyncMetrics(): SyncMetrics {
    return { ...this.syncMetrics };
  }

  /**
   * Force immediate sync (for manual triggers)
   */
  forceSyncNow(): Promise<void> {
    return this.maybeSync('manual');
  }

  /**
   * Update sync configuration
   */
  updateConfig(newConfig: Partial<SyncConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Updated background sync configuration:', this.config);

    // Reschedule with new configuration
    if (this.started) {
      this.scheduleNextSync();
    }
  }
}

export const startHealthBackgroundSync = () => {
  HealthBackgroundSync.getInstance().start();
};
