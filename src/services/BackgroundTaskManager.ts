import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { authService } from './authService';
import AuthStateMachine from './AuthStateMachine';
import StorageConsistencyManager from './StorageConsistencyManager';
import { getJwtExpirationMs } from '../utils/jwt';

const BACKGROUND_FETCH_TASK = 'background-token-refresh';

export interface BackgroundTaskConfig {
  tokenRefreshEnabled: boolean;
  minimumInterval: number; // seconds
  storageMaintenanceEnabled: boolean;
}

export interface BackgroundTaskMetrics {
  totalExecutions: number;
  successfulRefreshes: number;
  failedRefreshes: number;
  lastExecutionTime: number;
  lastSuccessTime: number;
  averageExecutionTime: number;
}

/**
 * BackgroundTaskManager
 *
 * Manages background tasks for authentication and storage maintenance
 * to ensure seamless user experience across app lifecycle events.
 *
 * Key Features:
 * - Background token refresh
 * - Storage consistency maintenance
 * - Network-aware execution
 * - Performance metrics tracking
 * - Graceful degradation
 */
class BackgroundTaskManager {
  private static instance: BackgroundTaskManager | null = null;

  private config: BackgroundTaskConfig = {
    tokenRefreshEnabled: true,
    minimumInterval: 15 * 60, // 15 minutes
    storageMaintenanceEnabled: true,
  };

  private metrics: BackgroundTaskMetrics = {
    totalExecutions: 0,
    successfulRefreshes: 0,
    failedRefreshes: 0,
    lastExecutionTime: 0,
    lastSuccessTime: 0,
    averageExecutionTime: 0,
  };

  private isRegistered = false;
  private authStateMachine: AuthStateMachine;
  private storageManager: StorageConsistencyManager;

  private constructor() {
    this.authStateMachine = AuthStateMachine.getInstance();
    this.storageManager = StorageConsistencyManager.getInstance();
    this.initialize();
  }

  static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  private async initialize(): Promise<void> {
    console.log('📋 BackgroundTaskManager initializing...');

    try {
      await this.registerBackgroundTask();
      await this.loadMetrics();

      console.log('✅ BackgroundTaskManager initialized successfully');
    } catch (error) {
      console.error('❌ BackgroundTaskManager initialization failed:', error);
      // Continue without background tasks - not critical for app function
    }
  }

  /**
   * Register the background task with TaskManager
   */
  private async registerBackgroundTask(): Promise<void> {
    if (Platform.OS === 'web') {
      console.log('📋 Background tasks not supported on web platform');
      return;
    }

    try {
      // Define the background task
      TaskManager.defineTask(BACKGROUND_FETCH_TASK, async ({ data, error, executionInfo }) => {
        console.log('📋 Background task executing...');
        const startTime = Date.now();

        try {
          if (error) {
            console.error('Background task error:', error);
            return BackgroundFetch.BackgroundFetchResult.Failed;
          }

          const result = await this.executeBackgroundMaintenance();

          const executionTime = Date.now() - startTime;
          this.updateMetrics(true, executionTime);

          console.log(`✅ Background task completed successfully in ${executionTime}ms`);
          return result;
        } catch (taskError) {
          const executionTime = Date.now() - startTime;
          this.updateMetrics(false, executionTime);

          console.error('❌ Background task failed:', taskError);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      // Check if task is already registered
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      if (isRegistered) {
        console.log('📋 Background task already registered');
        this.isRegistered = true;
        return;
      }

      // Register the background fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: this.config.minimumInterval,
        stopOnTerminate: false,
        startOnBoot: false, // Don't auto-start on device boot for privacy
      });

      this.isRegistered = true;
      console.log('✅ Background task registered successfully');
    } catch (error) {
      console.error('❌ Failed to register background task:', error);
      this.isRegistered = false;
    }
  }

  /**
   * Execute background maintenance tasks
   */
  private async executeBackgroundMaintenance(): Promise<BackgroundFetch.BackgroundFetchResult> {
    const tasks: Promise<any>[] = [];
    let hasNewData = false;

    try {
      console.log('🔧 Starting background maintenance tasks...');

      // Task 1: Token refresh if needed
      if (this.config.tokenRefreshEnabled) {
        tasks.push(this.performBackgroundTokenRefresh());
      }

      // Task 2: Storage consistency check
      if (this.config.storageMaintenanceEnabled) {
        tasks.push(this.performStorageMaintenance());
      }

      // Execute all tasks concurrently with timeout
      const results = await Promise.allSettled(
        tasks.map(task =>
          Promise.race([
            task,
            new Promise(
              (_, reject) => setTimeout(() => reject(new Error('Background task timeout')), 25000) // 25s timeout
            ),
          ])
        )
      );

      // Analyze results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          hasNewData = true;
          console.log(`✅ Background task ${index + 1} completed successfully`);
        } else {
          console.warn(`⚠️ Background task ${index + 1} failed:`, result.reason);
        }
      });

      return hasNewData
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.error('❌ Background maintenance execution failed:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  }

  /**
   * Perform background token refresh if needed
   */
  private async performBackgroundTokenRefresh(): Promise<void> {
    try {
      console.log('🔑 Checking if token refresh is needed...');

      // Check if user is authenticated and has tokens
      const tokens = authService.getStoredTokens();
      if (!tokens) {
        console.log('🔑 No tokens found, skipping background refresh');
        return;
      }

      // Check if tokens are nearing expiration (refresh if < 10 minutes remaining)
      const shouldRefresh = this.shouldRefreshInBackground();
      if (!shouldRefresh) {
        console.log('🔑 Tokens are still valid, no refresh needed');
        return;
      }

      console.log('🔄 Performing background token refresh...');

      // Use auth service to refresh tokens
      const refreshResponse = await authService.refreshToken();

      if (refreshResponse.success && refreshResponse.data) {
        console.log('✅ Background token refresh successful');
        this.metrics.successfulRefreshes++;

        // Notify state machine of successful refresh
        await this.authStateMachine.refreshToken(refreshResponse.data);
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.warn('⚠️ Background token refresh failed:', error);
      this.metrics.failedRefreshes++;

      // Notify state machine of failure
      await this.authStateMachine.networkError(
        `Background refresh failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Perform storage maintenance tasks
   */
  private async performStorageMaintenance(): Promise<void> {
    try {
      console.log('🗄️ Performing storage maintenance...');

      // Get storage health check
      const healthCheck = await this.storageManager.getStorageHealth();

      if (healthCheck.status === 'critical') {
        console.warn('🚨 Storage in critical state:', healthCheck.issues);

        // Attempt storage recovery
        const tokens = await this.storageManager.retrieveTokens();
        if (tokens) {
          await this.storageManager.storeTokens(tokens);
          console.log('✅ Storage recovery attempted');
        }
      } else if (healthCheck.status === 'warning') {
        console.warn('⚠️ Storage issues detected:', healthCheck.issues);
      } else {
        console.log('✅ Storage health check passed');
      }
    } catch (error) {
      console.warn('⚠️ Storage maintenance failed:', error);
    }
  }

  /**
   * Check if tokens should be refreshed in background
   */
  private shouldRefreshInBackground(): boolean {
    try {
      const tokens = authService.getStoredTokens();
      if (!tokens?.accessToken) {
        return false;
      }

      // Decode JWT to get expiration
      const expirationTime = getJwtExpirationMs(tokens.accessToken);
      if (!expirationTime) return false;
      const currentTime = Date.now();
      const timeUntilExpiry = expirationTime - currentTime;

      // Refresh if token expires within 10 minutes
      return timeUntilExpiry < 10 * 60 * 1000;
    } catch (error) {
      console.warn('Error checking token expiration:', error);
      return false;
    }
  }

  /**
   * Update background task metrics
   */
  private updateMetrics(success: boolean, executionTime: number): void {
    this.metrics.totalExecutions++;
    this.metrics.lastExecutionTime = Date.now();

    if (success) {
      this.metrics.lastSuccessTime = Date.now();
    }

    // Calculate average execution time
    const totalTime =
      this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1) + executionTime;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecutions;

    // Persist metrics
    this.persistMetrics();
  }

  /**
   * Configuration management
   */
  public updateConfig(newConfig: Partial<BackgroundTaskConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📋 Background task config updated:', this.config);

    // Re-register task with new config if needed
    if (this.isRegistered && newConfig.minimumInterval) {
      this.reregisterBackgroundTask();
    }
  }

  private async reregisterBackgroundTask(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      this.isRegistered = false;
      await this.registerBackgroundTask();
    } catch (error) {
      console.error('Failed to re-register background task:', error);
    }
  }

  /**
   * Status and metrics
   */
  public getStatus(): {
    isRegistered: boolean;
    config: BackgroundTaskConfig;
    metrics: BackgroundTaskMetrics;
    backgroundFetchStatus: Promise<BackgroundFetch.BackgroundFetchStatus>;
  } {
    return {
      isRegistered: this.isRegistered,
      config: { ...this.config },
      metrics: { ...this.metrics },
      backgroundFetchStatus: BackgroundFetch.getStatusAsync(),
    };
  }

  public async getBackgroundFetchStatus(): Promise<string> {
    if (Platform.OS === 'web') {
      return 'not_supported';
    }

    try {
      const status = await BackgroundFetch.getStatusAsync();

      switch (status) {
        case BackgroundFetch.BackgroundFetchStatus.Available:
          return 'available';
        case BackgroundFetch.BackgroundFetchStatus.Denied:
          return 'denied';
        case BackgroundFetch.BackgroundFetchStatus.Restricted:
          return 'restricted';
        default:
          return 'unknown';
      }
    } catch (error) {
      console.error('Error getting background fetch status:', error);
      return 'error';
    }
  }

  /**
   * Metrics persistence
   */
  private async persistMetrics(): Promise<void> {
    try {
      await this.storageManager.storeTokens({
        accessToken: 'metrics_placeholder',
        refreshToken: JSON.stringify(this.metrics),
      } as any); // Using storage manager for simplicity - in real app would use separate storage
    } catch (error) {
      console.warn('Failed to persist background task metrics:', error);
    }
  }

  private async loadMetrics(): Promise<void> {
    try {
      // In a real implementation, you'd load metrics from a separate storage location
      // This is simplified for the example
    } catch (error) {
      console.warn('Failed to load background task metrics:', error);
    }
  }

  /**
   * Manual task execution for testing
   */
  public async executeManualMaintenance(): Promise<void> {
    console.log('🔧 Executing manual background maintenance...');

    try {
      const result = await this.executeBackgroundMaintenance();
      console.log(`✅ Manual maintenance completed with result: ${result}`);
    } catch (error) {
      console.error('❌ Manual maintenance failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup
   */
  public async destroy(): Promise<void> {
    console.log('🧹 BackgroundTaskManager destroying...');

    try {
      if (this.isRegistered && Platform.OS !== 'web') {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
        await TaskManager.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      }

      this.isRegistered = false;
      BackgroundTaskManager.instance = null;

      console.log('✅ BackgroundTaskManager destroyed successfully');
    } catch (error) {
      console.error('❌ Error destroying BackgroundTaskManager:', error);
    }
  }
}

export default BackgroundTaskManager;
