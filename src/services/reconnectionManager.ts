import type { NetworkState } from './networkMonitorService';
import NetworkMonitorService, { NetworkQuality } from './networkMonitorService';

export enum ReconnectionState {
  IDLE = 'idle',
  ATTEMPTING = 'attempting',
  FAILED = 'failed',
  SUCCESS = 'success',
}

export interface ReconnectionAttempt {
  attempt: number;
  timestamp: number;
  reason: string;
  success: boolean;
  error?: string;
  duration?: number;
}

export interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitterRange: number; // 0-1, adds randomness to prevent thundering herd
  networkQualityThreshold: NetworkQuality;
  enableNetworkAwareReconnection: boolean;
}

export interface ReconnectionCallback {
  onAttemptStarted?: (attempt: number) => void;
  onAttemptFailed?: (attempt: number, error: string) => void;
  onAttemptSuccess?: (attempt: number, duration: number) => void;
  onReconnectionFailed?: (totalAttempts: number) => void;
  onReconnectionSuccess?: (totalAttempts: number, totalDuration: number) => void;
}

export interface ReconnectionTarget {
  reconnect: () => Promise<void>;
  isConnected: () => boolean;
  getConnectionInfo: () => any;
}

class ReconnectionManager {
  private static instance: ReconnectionManager;
  private networkMonitor = NetworkMonitorService;
  private activeReconnections = new Map<string, ReconnectionSession>();
  private defaultConfig: ReconnectionConfig = {
    maxAttempts: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    jitterRange: 0.1,
    networkQualityThreshold: NetworkQuality.POOR,
    enableNetworkAwareReconnection: true,
  };

  private constructor() {
    this.setupNetworkMonitoring();
  }

  public static getInstance(): ReconnectionManager {
    if (!ReconnectionManager.instance) {
      ReconnectionManager.instance = new ReconnectionManager();
    }
    return ReconnectionManager.instance;
  }

  private setupNetworkMonitoring(): void {
    this.networkMonitor.addListener((networkState: NetworkState) => {
      this.handleNetworkStateChange(networkState);
    });
  }

  private handleNetworkStateChange(networkState: NetworkState): void {
    // When network comes back online, resume paused reconnections
    if (networkState.isConnected && networkState.isReachable) {
      console.log('🔄 Network restored, resuming reconnection attempts');
      this.activeReconnections.forEach((session, sessionId) => {
        if (session.state === ReconnectionState.FAILED && session.pausedForNetwork) {
          console.log(`🔄 Resuming reconnection for session: ${sessionId}`);
          session.pausedForNetwork = false;
          this.continueReconnection(sessionId, session);
        }
      });
    }
  }

  startReconnection(
    sessionId: string,
    target: ReconnectionTarget,
    config: Partial<ReconnectionConfig> = {},
    callbacks: ReconnectionCallback = {}
  ): void {
    if (this.activeReconnections.has(sessionId)) {
      console.log(`🔄 Reconnection already active for session: ${sessionId}`);
      return;
    }

    const finalConfig = { ...this.defaultConfig, ...config };
    const session: ReconnectionSession = {
      sessionId,
      target,
      config: finalConfig,
      callbacks,
      state: ReconnectionState.IDLE,
      attempts: [],
      startTime: Date.now(),
      currentAttempt: 0,
      pausedForNetwork: false,
      timeoutId: undefined,
    };

    this.activeReconnections.set(sessionId, session);
    console.log(`🔄 Starting reconnection for session: ${sessionId}`, finalConfig);

    this.attemptReconnection(sessionId, session);
  }

  private async attemptReconnection(
    sessionId: string,
    session: ReconnectionSession
  ): Promise<void> {
    // Check if we should pause for network issues
    if (
      session.config.enableNetworkAwareReconnection &&
      !this.isNetworkSuitableForReconnection(session.config)
    ) {
      console.log(`🔄 Pausing reconnection for network quality: ${sessionId}`);
      session.pausedForNetwork = true;
      session.state = ReconnectionState.FAILED;
      return;
    }

    session.currentAttempt++;
    session.state = ReconnectionState.ATTEMPTING;

    const attempt: ReconnectionAttempt = {
      attempt: session.currentAttempt,
      timestamp: Date.now(),
      reason: this.getReconnectionReason(),
      success: false,
    };

    session.attempts.push(attempt);

    console.log(
      `🔄 Reconnection attempt ${session.currentAttempt}/${session.config.maxAttempts} for ${sessionId}`
    );

    // Notify attempt started
    session.callbacks.onAttemptStarted?.(session.currentAttempt);

    try {
      const attemptStartTime = Date.now();
      await session.target.reconnect();

      // Verify connection was successful
      if (session.target.isConnected()) {
        const duration = Date.now() - attemptStartTime;
        attempt.success = true;
        attempt.duration = duration;

        session.state = ReconnectionState.SUCCESS;

        console.log(
          `✅ Reconnection successful for ${sessionId} after ${session.currentAttempt} attempts`
        );

        // Notify success
        session.callbacks.onAttemptSuccess?.(session.currentAttempt, duration);
        session.callbacks.onReconnectionSuccess?.(
          session.currentAttempt,
          Date.now() - session.startTime
        );

        // Clean up
        this.activeReconnections.delete(sessionId);
        return;
      } else {
        throw new Error('Connection verification failed after reconnection attempt');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      attempt.error = errorMessage;

      console.log(
        `❌ Reconnection attempt ${session.currentAttempt} failed for ${sessionId}: ${errorMessage}`
      );

      // Notify attempt failed
      session.callbacks.onAttemptFailed?.(session.currentAttempt, errorMessage);

      // Check if we should continue
      if (session.currentAttempt >= session.config.maxAttempts) {
        session.state = ReconnectionState.FAILED;

        console.log(`❌ All reconnection attempts failed for ${sessionId}`);

        // Notify final failure
        session.callbacks.onReconnectionFailed?.(session.currentAttempt);

        // Clean up
        this.activeReconnections.delete(sessionId);
        return;
      }

      // Schedule next attempt with exponential backoff
      this.scheduleNextAttempt(sessionId, session);
    }
  }

  private scheduleNextAttempt(sessionId: string, session: ReconnectionSession): void {
    const delay = this.calculateBackoffDelay(session.currentAttempt, session.config);

    console.log(`🔄 Scheduling next reconnection attempt for ${sessionId} in ${delay}ms`);

    session.timeoutId = setTimeout(() => {
      if (this.activeReconnections.has(sessionId)) {
        this.continueReconnection(sessionId, session);
      }
    }, delay);
  }

  private continueReconnection(sessionId: string, session: ReconnectionSession): void {
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = undefined;
    }

    this.attemptReconnection(sessionId, session);
  }

  private calculateBackoffDelay(attempt: number, config: ReconnectionConfig): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ (attempt - 1))
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);

    // Cap at maxDelay
    delay = Math.min(delay, config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = delay * config.jitterRange * (Math.random() - 0.5);
    delay += jitter;

    return Math.round(delay);
  }

  private isNetworkSuitableForReconnection(config: ReconnectionConfig): boolean {
    const networkState = this.networkMonitor.getCurrentState();

    if (!networkState.isConnected || !networkState.isReachable) {
      return false;
    }

    // Check if network quality meets threshold
    const qualityHierarchy = {
      [NetworkQuality.EXCELLENT]: 4,
      [NetworkQuality.GOOD]: 3,
      [NetworkQuality.POOR]: 2,
      [NetworkQuality.DISCONNECTED]: 1,
      [NetworkQuality.UNKNOWN]: 0,
    };

    const currentQuality = qualityHierarchy[networkState.quality] || 0;
    const thresholdQuality = qualityHierarchy[config.networkQualityThreshold] || 0;

    return currentQuality >= thresholdQuality;
  }

  private getReconnectionReason(): string {
    const networkState = this.networkMonitor.getCurrentState();

    if (!networkState.isConnected) {
      return 'Network disconnected';
    }

    if (!networkState.isReachable) {
      return 'Internet unreachable';
    }

    if (networkState.quality === NetworkQuality.POOR) {
      return 'Poor network quality';
    }

    return 'Connection lost';
  }

  stopReconnection(sessionId: string): boolean {
    const session = this.activeReconnections.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }

    this.activeReconnections.delete(sessionId);
    console.log(`🔄 Stopped reconnection for session: ${sessionId}`);

    return true;
  }

  getReconnectionStatus(sessionId: string): ReconnectionSession | null {
    return this.activeReconnections.get(sessionId) || null;
  }

  isReconnectionActive(sessionId: string): boolean {
    return this.activeReconnections.has(sessionId);
  }

  getActiveReconnections(): string[] {
    return Array.from(this.activeReconnections.keys());
  }

  // Utility method to create a quick reconnection for simple cases
  quickReconnect(
    sessionId: string,
    reconnectFn: () => Promise<void>,
    isConnectedFn: () => boolean,
    maxAttempts: number = 3
  ): Promise<boolean> {
    return new Promise(resolve => {
      const target: ReconnectionTarget = {
        reconnect: reconnectFn,
        isConnected: isConnectedFn,
        getConnectionInfo: () => ({}),
      };

      const callbacks: ReconnectionCallback = {
        onReconnectionSuccess: () => resolve(true),
        onReconnectionFailed: () => resolve(false),
      };

      this.startReconnection(sessionId, target, { maxAttempts, baseDelay: 500 }, callbacks);
    });
  }

  destroy(): void {
    // Stop all active reconnections
    this.activeReconnections.forEach((session, sessionId) => {
      this.stopReconnection(sessionId);
    });

    this.activeReconnections.clear();
    console.log('🔄 Reconnection manager destroyed');
  }
}

interface ReconnectionSession {
  sessionId: string;
  target: ReconnectionTarget;
  config: ReconnectionConfig;
  callbacks: ReconnectionCallback;
  state: ReconnectionState;
  attempts: ReconnectionAttempt[];
  startTime: number;
  currentAttempt: number;
  pausedForNetwork: boolean;
  timeoutId?: NodeJS.Timeout;
}

export default ReconnectionManager.getInstance();
