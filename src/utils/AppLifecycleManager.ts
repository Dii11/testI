/**
 * AppLifecycleManager
 *
 * Professional app lifecycle detection system inspired by Instagram, Facebook, and WhatsApp.
 *
 * PURPOSE:
 * Distinguishes between temporary backgrounding and app termination to provide
 * intelligent state persistence that matches user expectations.
 *
 * BEHAVIOR:
 * - Temporary background (app switcher): Keeps all state
 * - App termination: Clears incomplete auth flows
 * - Fresh launch after termination: Clean slate experience
 *
 * @author HopMed Engineering Team
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus, Platform } from 'react-native';

const LIFECYCLE_STORAGE_KEY = '@hopmed_app_lifecycle';
const TERMINATION_TIMEOUT = 30000; // 30 seconds - if app is inactive longer, consider it terminated

interface AppLifecycleState {
  lastActiveTimestamp: number;
  lastAppState: AppStateStatus;
  launchCount: number;
  wasTerminated: boolean;
  isFirstLaunchEver: boolean;
}

type LifecycleEvent =
  | 'fresh_launch'        // First time app is opened after install
  | 'resumed_from_background' // App was backgrounded briefly and resumed
  | 'app_terminated_detected' // App was fully terminated and restarted
  | 'backgrounding';       // App is going to background

type LifecycleListener = (event: LifecycleEvent, metadata?: any) => void;

class AppLifecycleManager {
  private static instance: AppLifecycleManager | null = null;
  private lifecycleState: AppLifecycleState | null = null;
  private listeners: Map<string, LifecycleListener> = new Map();
  private appStateSubscription: any = null;
  private backgroundTimestamp: number | null = null;
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): AppLifecycleManager {
    if (!AppLifecycleManager.instance) {
      AppLifecycleManager.instance = new AppLifecycleManager();
    }
    return AppLifecycleManager.instance;
  }

  /**
   * Initialize the lifecycle manager
   * Call this early in app startup (App.tsx)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 AppLifecycleManager already initialized, skipping...');
      return;
    }

    console.log('🚀 Initializing AppLifecycleManager...');

    try {
      // Load previous lifecycle state
      const storedState = await this.loadLifecycleState();

      const now = Date.now();
      const wasTerminated = this.detectTermination(storedState, now);

      // Determine lifecycle event
      let event: LifecycleEvent;
      if (!storedState || storedState.isFirstLaunchEver) {
        event = 'fresh_launch';
      } else if (wasTerminated) {
        event = 'app_terminated_detected';
      } else {
        event = 'resumed_from_background';
      }

      // Update lifecycle state
      this.lifecycleState = {
        lastActiveTimestamp: now,
        lastAppState: 'active',
        launchCount: (storedState?.launchCount || 0) + 1,
        wasTerminated,
        isFirstLaunchEver: !storedState,
      };

      // Save initial state
      await this.saveLifecycleState();

      // Set up AppState listener
      this.setupAppStateListener();

      // Notify listeners of the launch event
      this.notifyListeners(event, {
        wasTerminated,
        isFirstLaunch: this.lifecycleState.isFirstLaunchEver,
        launchCount: this.lifecycleState.launchCount,
      });

      this.isInitialized = true;
      console.log(`✅ AppLifecycleManager initialized - Event: ${event}`);
    } catch (error) {
      console.error('❌ AppLifecycleManager initialization failed:', error);
      // Continue anyway - lifecycle detection is important but not critical
      this.isInitialized = true;
    }
  }

  /**
   * Register a listener for lifecycle events
   */
  addListener(name: string, listener: LifecycleListener): () => void {
    this.listeners.set(name, listener);

    return () => {
      this.listeners.delete(name);
    };
  }

  /**
   * Remove a specific listener
   */
  removeListener(name: string): void {
    this.listeners.delete(name);
  }

  /**
   * Check if this is the first launch ever
   */
  isFirstLaunch(): boolean {
    return this.lifecycleState?.isFirstLaunchEver || false;
  }

  /**
   * Check if the app was terminated (not just backgrounded)
   */
  wasAppTerminated(): boolean {
    return this.lifecycleState?.wasTerminated || false;
  }

  /**
   * Get the current launch count
   */
  getLaunchCount(): number {
    return this.lifecycleState?.launchCount || 0;
  }

  /**
   * Get time since last active (in milliseconds)
   */
  getTimeSinceLastActive(): number {
    if (!this.lifecycleState) return 0;
    return Date.now() - this.lifecycleState.lastActiveTimestamp;
  }

  /**
   * Mark the app as having completed first-time setup
   * (e.g., after user logs in for the first time)
   */
  async markFirstLaunchComplete(): Promise<void> {
    if (!this.lifecycleState) return;

    this.lifecycleState.isFirstLaunchEver = false;
    await this.saveLifecycleState();
  }

  /**
   * Clear all lifecycle data (useful for logout/reset)
   */
  async clearLifecycleData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LIFECYCLE_STORAGE_KEY);
      this.lifecycleState = null;
      console.log('🧹 Lifecycle data cleared');
    } catch (error) {
      console.error('❌ Failed to clear lifecycle data:', error);
    }
  }

  /**
   * Cleanup and remove listeners
   */
  destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
    console.log('🧹 AppLifecycleManager destroyed');
  }

  // ==================== PRIVATE METHODS ====================

  private async loadLifecycleState(): Promise<AppLifecycleState | null> {
    try {
      const stored = await AsyncStorage.getItem(LIFECYCLE_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('❌ Failed to load lifecycle state:', error);
    }
    return null;
  }

  private async saveLifecycleState(): Promise<void> {
    if (!this.lifecycleState) return;

    try {
      await AsyncStorage.setItem(LIFECYCLE_STORAGE_KEY, JSON.stringify(this.lifecycleState));
    } catch (error) {
      console.error('❌ Failed to save lifecycle state:', error);
    }
  }

  private detectTermination(storedState: AppLifecycleState | null, now: number): boolean {
    if (!storedState) {
      // First launch ever
      return false;
    }

    const timeSinceLastActive = now - storedState.lastActiveTimestamp;

    // If more than TERMINATION_TIMEOUT has passed, consider it a termination
    // This handles:
    // 1. User force-quit the app
    // 2. System killed the app due to memory pressure
    // 3. User restarted their device
    return timeSinceLastActive > TERMINATION_TIMEOUT;
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (!this.lifecycleState) return;

    const previousAppState = this.lifecycleState.lastAppState;

    console.log(`🔄 App state changed: ${previousAppState} → ${nextAppState}`);

    // Detect backgrounding
    if (previousAppState === 'active' && nextAppState.match(/inactive|background/)) {
      this.backgroundTimestamp = Date.now();
      this.notifyListeners('backgrounding', { timestamp: this.backgroundTimestamp });

      // Save state when backgrounding
      this.lifecycleState.lastAppState = nextAppState;
      await this.saveLifecycleState();
    }

    // Detect foregrounding
    if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
      const backgroundDuration = this.backgroundTimestamp
        ? Date.now() - this.backgroundTimestamp
        : 0;

      const wasTerminated = backgroundDuration > TERMINATION_TIMEOUT;

      if (wasTerminated) {
        this.notifyListeners('app_terminated_detected', { backgroundDuration });
      } else {
        this.notifyListeners('resumed_from_background', { backgroundDuration });
      }

      this.backgroundTimestamp = null;

      // Update state
      this.lifecycleState.lastActiveTimestamp = Date.now();
      this.lifecycleState.lastAppState = nextAppState;
      this.lifecycleState.wasTerminated = wasTerminated;
      await this.saveLifecycleState();
    }
  };

  private notifyListeners(event: LifecycleEvent, metadata?: any): void {
    console.log(`📢 Lifecycle event: ${event}`, metadata);

    this.listeners.forEach((listener, name) => {
      try {
        listener(event, metadata);
      } catch (error) {
        console.error(`❌ Listener ${name} failed:`, error);
      }
    });
  }
}

export default AppLifecycleManager;
