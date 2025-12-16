import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

interface AppStateListener {
  id: string;
  callback: (appState: AppStateStatus) => void;
  priority?: number;
}

class AppStateManager {
  private static instance: AppStateManager | null = null;
  private currentState: AppStateStatus = AppState.currentState;
  private listeners: AppStateListener[] = [];
  private subscription: any = null;
  private transitionHistory: { from: AppStateStatus; to: AppStateStatus; timestamp: number }[] = [];
  private maxHistorySize = 10;
  private lastForegroundTime = Date.now();
  private backgroundDuration = 0;

  private constructor() {
    this.initialize();
  }

  static getInstance(): AppStateManager {
    if (!AppStateManager.instance) {
      AppStateManager.instance = new AppStateManager();
    }
    return AppStateManager.instance;
  }

  private initialize() {
    console.log('🎛️ AppStateManager initializing...');

    // Store initial state
    this.currentState = AppState.currentState;
    this.lastForegroundTime = Date.now();

    // Set up AppState listener
    this.subscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

    console.log('✅ AppStateManager initialized');
  }

  private async handleAppStateChange(nextAppState: AppStateStatus) {
    const previousState = this.currentState;
    const timestamp = Date.now();

    // Record transition
    this.recordTransition(previousState, nextAppState, timestamp);

    // Calculate background duration
    if (previousState.match(/inactive|background/) && nextAppState === 'active') {
      this.backgroundDuration = timestamp - this.lastForegroundTime;
      console.log(
        `📱 App returned from background after ${Math.round(this.backgroundDuration / 1000)}s`
      );
    } else if (nextAppState.match(/inactive|background/) && previousState === 'active') {
      this.lastForegroundTime = timestamp;
      console.log('📱 App going to background');
    }

    // Update current state
    this.currentState = nextAppState;

    // Persist app state info
    await this.persistAppStateInfo();

    // Notify listeners in priority order
    const sortedListeners = [...this.listeners].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    for (const listener of sortedListeners) {
      try {
        listener.callback(nextAppState);
      } catch (error) {
        console.error(`🚨 Error in AppState listener ${listener.id}:`, error);
      }
    }
  }

  private recordTransition(from: AppStateStatus, to: AppStateStatus, timestamp: number) {
    this.transitionHistory.push({ from, to, timestamp });

    // Trim history to max size
    if (this.transitionHistory.length > this.maxHistorySize) {
      this.transitionHistory = this.transitionHistory.slice(-this.maxHistorySize);
    }

    console.log(`📱 State transition: ${from} → ${to}`);
  }

  private async persistAppStateInfo() {
    try {
      const appStateInfo = {
        lastForegroundTime: this.lastForegroundTime,
        backgroundDuration: this.backgroundDuration,
        transitionHistory: this.transitionHistory.slice(-5), // Keep last 5 transitions
        lastSavedAt: Date.now(),
      };

      await AsyncStorage.setItem('@hopmed_app_state_info', JSON.stringify(appStateInfo));
    } catch (error) {
      console.warn('Failed to persist app state info:', error);
    }
  }

  public addListener(
    id: string,
    callback: (appState: AppStateStatus) => void,
    priority: number = 0
  ): () => void {
    const listener: AppStateListener = { id, callback, priority };
    this.listeners.push(listener);

    console.log(`📱 Added AppState listener: ${id} (priority: ${priority})`);

    // Return unsubscribe function
    return () => {
      this.removeListener(id);
    };
  }

  public removeListener(id: string) {
    const index = this.listeners.findIndex(l => l.id === id);
    if (index !== -1) {
      this.listeners.splice(index, 1);
      console.log(`📱 Removed AppState listener: ${id}`);
    }
  }

  public getCurrentState(): AppStateStatus {
    return this.currentState;
  }

  public getBackgroundDuration(): number {
    return this.backgroundDuration;
  }

  public getTransitionHistory(): { from: AppStateStatus; to: AppStateStatus; timestamp: number }[] {
    return [...this.transitionHistory];
  }

  public wasRecentlyInBackground(): boolean {
    return this.backgroundDuration > 0 && this.backgroundDuration < 300000; // 5 minutes
  }

  public async getPersistedAppStateInfo(): Promise<any> {
    try {
      const stored = await AsyncStorage.getItem('@hopmed_app_state_info');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to get persisted app state info:', error);
      return null;
    }
  }

  public destroy() {
    console.log('🧹 AppStateManager destroying...');

    if (this.subscription) {
      try {
        this.subscription.remove();
      } catch (error) {
        console.warn('Error removing AppState subscription:', error);
      }
    }

    this.listeners = [];
    this.transitionHistory = [];
    AppStateManager.instance = null;
  }

  // Memory pressure recovery tracking
  private memoryPressureRecoveryAttempts = 0;
  private readonly maxMemoryRecoveryAttempts = 3;
  private memoryPressureDetectedAt = 0;
  private readonly memoryRecoveryWindowMs = 5 * 60 * 1000; // 5 minutes

  // Utility method to check if app state transitions suggest memory pressure
  public hasMemoryPressureIndicators(): boolean {
    const recentTransitions = this.transitionHistory.slice(-3);

    // Check for rapid background/foreground cycles (potential memory pressure)
    const rapidCycles = recentTransitions.filter((transition, index) => {
      if (index === 0) return false;
      const prevTransition = recentTransitions[index - 1];
      const timeDiff = transition.timestamp - prevTransition.timestamp;
      return timeDiff < 2000; // Less than 2 seconds between transitions
    }).length;

    const hasMemoryPressure = rapidCycles >= 2;

    if (hasMemoryPressure && this.memoryPressureDetectedAt === 0) {
      this.memoryPressureDetectedAt = Date.now();
      console.log('🧠 Memory pressure detected, starting recovery window');
    }

    return hasMemoryPressure;
  }

  /**
   * Check if we can attempt memory pressure recovery
   */
  public canAttemptMemoryRecovery(): boolean {
    const withinRecoveryWindow =
      this.memoryPressureDetectedAt > 0 &&
      Date.now() - this.memoryPressureDetectedAt < this.memoryRecoveryWindowMs;

    return (
      withinRecoveryWindow && this.memoryPressureRecoveryAttempts < this.maxMemoryRecoveryAttempts
    );
  }

  /**
   * Attempt memory pressure recovery
   */
  public async attemptMemoryPressureRecovery(): Promise<boolean> {
    if (!this.canAttemptMemoryRecovery()) {
      console.log('🚫 Cannot attempt memory recovery: outside window or max attempts reached');
      return false;
    }

    this.memoryPressureRecoveryAttempts++;
    const attempt = this.memoryPressureRecoveryAttempts;

    console.log(
      `🔄 Attempting memory pressure recovery (${attempt}/${this.maxMemoryRecoveryAttempts})`
    );

    try {
      // Progressive recovery strategy
      const recoveryDelay = Math.min(attempt * 2000, 10000); // 2s, 4s, 6s max

      // Wait for memory to stabilize
      await new Promise(resolve => setTimeout(resolve, recoveryDelay));

      // Check if memory pressure has subsided
      if (!this.hasMemoryPressureIndicators()) {
        console.log('✅ Memory pressure subsided, recovery successful');
        this.resetMemoryPressureTracking();
        return true;
      }

      // If we're at max attempts, reset tracking but return false
      if (attempt >= this.maxMemoryRecoveryAttempts) {
        console.log('🚫 Max memory recovery attempts reached, giving up');
        this.resetMemoryPressureTracking();
        return false;
      }

      console.log(
        `⚠️ Memory pressure persists, will retry (${attempt}/${this.maxMemoryRecoveryAttempts})`
      );
      return false;
    } catch (error) {
      console.error('❌ Memory recovery attempt failed:', error);
      return false;
    }
  }

  /**
   * Reset memory pressure tracking
   */
  private resetMemoryPressureTracking(): void {
    this.memoryPressureDetectedAt = 0;
    this.memoryPressureRecoveryAttempts = 0;
    console.log('🧠 Memory pressure tracking reset');
  }

  /**
   * Get memory recovery status
   */
  public getMemoryRecoveryStatus(): {
    hasMemoryPressure: boolean;
    recoveryAttempts: number;
    maxAttempts: number;
    canAttemptRecovery: boolean;
    timeSinceDetection: number;
  } {
    return {
      hasMemoryPressure: this.hasMemoryPressureIndicators(),
      recoveryAttempts: this.memoryPressureRecoveryAttempts,
      maxAttempts: this.maxMemoryRecoveryAttempts,
      canAttemptRecovery: this.canAttemptMemoryRecovery(),
      timeSinceDetection:
        this.memoryPressureDetectedAt > 0 ? Date.now() - this.memoryPressureDetectedAt : 0,
    };
  }
}

export default AppStateManager;
