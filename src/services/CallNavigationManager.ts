/**
 * CallNavigationManager
 *
 * Manages navigation state persistence during video calls to ensure users
 * return to the call screen after background/foreground transitions
 *
 * Features:
 * - Tracks active call navigation state
 * - Persists call context during background transitions
 * - Restores users to call screens when returning from background
 * - Prevents unwanted navigation away from active calls
 * - Integrates with React Navigation and VideoCallBackgroundManager
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationContainerRef, ParamListBase } from '@react-navigation/native';
import type { AppStateStatus } from 'react-native';

import AppStateManager from '../utils/AppStateManager';
import VideoCallBackgroundManager from './VideoCallBackgroundManager';
import type { VideoCallBackgroundListener } from './VideoCallBackgroundManager';
import { SentryErrorTracker } from '../utils/sentryErrorTracker';

interface CallNavigationState {
  isInCall: boolean;
  callType: 'audio' | 'video';
  currentScreen: string;
  screenParams: Record<string, any>;
  participantName: string;
  participantType: 'customer' | 'doctor';
  roomUrl?: string;
  callStartTime: number;
  backgroundTransitionTime?: number;
}

interface CallNavigationConfig {
  enableNavigationPersistence: boolean;
  enableNavigationGuards: boolean;
  autoRestoreOnForeground: boolean;
  persistenceKey: string;
  maxBackgroundDuration: number; // ms before considering call potentially ended
}

interface NavigationRestoreResult {
  success: boolean;
  restoredToCallScreen: boolean;
  navigationAction?: string;
  error?: string;
}

class CallNavigationManager {
  private static instance: CallNavigationManager | null = null;

  private config: CallNavigationConfig = {
    enableNavigationPersistence: true,
    enableNavigationGuards: true,
    autoRestoreOnForeground: true,
    persistenceKey: '@hopmed_call_navigation_state',
    maxBackgroundDuration: 300000, // 5 minutes
  };

  private currentCallState: CallNavigationState | null = null;
  private navigationRef: NavigationContainerRef<ParamListBase> | null = null;
  private isInitialized = false;

  // Event listeners
  private appStateUnsubscribe: (() => void) | null = null;
  private backgroundManagerUnsubscribe: (() => void) | null = null;

  // Navigation guards
  private navigationListeners: Array<() => void> = [];
  private isNavigationBlocked = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): CallNavigationManager {
    if (!CallNavigationManager.instance) {
      CallNavigationManager.instance = new CallNavigationManager();
    }
    return CallNavigationManager.instance;
  }

  private async initialize(): Promise<void> {
    console.log('🧭 CallNavigationManager initializing...');

    try {
      // Setup event listeners
      this.setupEventListeners();

      // Load any persisted call state
      await this.loadPersistedCallState();

      this.isInitialized = true;
      console.log('✅ CallNavigationManager initialized successfully');
    } catch (error) {
      console.error('❌ CallNavigationManager initialization failed:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'CallNavigationManager',
        action: 'initialization',
      });
    }
  }

  /**
   * Register navigation reference for programmatic navigation
   */
  public setNavigationRef(ref: NavigationContainerRef<ParamListBase>): void {
    this.navigationRef = ref;
    console.log('🧭 Navigation reference registered');

    // Setup navigation state change listeners
    this.setupNavigationListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to app state changes
    this.appStateUnsubscribe = AppStateManager.getInstance().addListener(
      'CallNavigationManager',
      this.handleAppStateChange.bind(this),
      85 // High priority but lower than VideoCallBackgroundManager
    );

    // Listen to video call background manager events
    this.backgroundManagerUnsubscribe = VideoCallBackgroundManager.getInstance().addListener({
      id: 'CallNavigationManager',
      onAppStateChange: this.handleCallStateChange.bind(this),
      onVideoStateChange: () => {}, // Not needed for navigation
      onCallRecoveryStarted: () => {},
      onCallRecoveryCompleted: this.handleCallRecoveryCompleted.bind(this),
      onQualityDegraded: () => {},
    });

    console.log('🧭 Event listeners setup for call navigation');
  }

  /**
   * Setup navigation listeners for call guards
   */
  private setupNavigationListeners(): void {
    if (!this.navigationRef || !this.config.enableNavigationGuards) {
      return;
    }

    // Listen to navigation state changes to prevent unwanted navigation during calls
    const unsubscribe = this.navigationRef.addListener('state', (e) => {
      if (this.currentCallState?.isInCall && this.isNavigationBlocked) {
        const currentRoute = this.navigationRef?.getCurrentRoute();
        const isCallScreen = this.isCallScreen(currentRoute?.name || '');

        if (!isCallScreen) {
          console.warn('🧭 Preventing navigation away from call screen');
          // Navigate back to call screen
          this.restoreToCallScreen();
        }
      }
    });

    this.navigationListeners.push(unsubscribe);
  }

  /**
   * Start tracking a call session
   */
  public startCallSession(
    callType: 'audio' | 'video',
    currentScreen: string,
    screenParams: Record<string, any>,
    participantName: string,
    participantType: 'customer' | 'doctor',
    roomUrl?: string
  ): void {
    console.log(`🧭 Starting call navigation tracking: ${currentScreen}`);

    this.currentCallState = {
      isInCall: true,
      callType,
      currentScreen,
      screenParams,
      participantName,
      participantType,
      roomUrl,
      callStartTime: Date.now(),
    };

    // Enable navigation blocking during calls
    this.isNavigationBlocked = this.config.enableNavigationGuards;

    // Persist the call state
    this.persistCallState();

    console.log('🧭 Call navigation tracking started');
  }

  /**
   * End call session
   */
  public endCallSession(): void {
    console.log('🧭 Ending call navigation tracking');

    this.currentCallState = null;
    this.isNavigationBlocked = false;

    // Clear persisted state
    this.clearPersistedCallState();

    console.log('🧭 Call navigation tracking ended');
  }

  /**
   * Handle app state changes
   */
  private async handleAppStateChange(appState: AppStateStatus): Promise<void> {
    if (!this.isInitialized || !this.currentCallState) {
      return;
    }

    if (appState === 'background' || appState === 'inactive') {
      // Track when we went to background
      this.currentCallState.backgroundTransitionTime = Date.now();
      await this.persistCallState();
      console.log('🧭 Call state persisted for background transition');

    } else if (appState === 'active') {
      // Check if we should restore navigation
      if (this.config.autoRestoreOnForeground && this.currentCallState) {
        await this.attemptNavigationRestore();
      }
    }
  }

  /**
   * Handle call state changes from background manager
   */
  private handleCallStateChange(appState: AppStateStatus, callState: any): void {
    if (!this.currentCallState) {
      return;
    }

    // Update our call state based on background manager state
    if (callState.isInCall !== this.currentCallState.isInCall) {
      if (!callState.isInCall) {
        // Call ended, clear navigation tracking
        this.endCallSession();
      }
    }
  }

  /**
   * Handle call recovery completion
   */
  private handleCallRecoveryCompleted(success: boolean): void {
    if (!success && this.currentCallState) {
      console.log('🧭 Call recovery failed, ending navigation tracking');
      this.endCallSession();
    }
  }

  /**
   * Attempt to restore navigation to call screen
   */
  private async attemptNavigationRestore(): Promise<NavigationRestoreResult> {
    if (!this.currentCallState || !this.navigationRef) {
      return { success: false, restoredToCallScreen: false, error: 'No call state or navigation ref' };
    }

    try {
      console.log('🧭 Attempting navigation restore to call screen');

      const currentRoute = this.navigationRef.getCurrentRoute();
      const isAlreadyOnCallScreen = this.isCallScreen(currentRoute?.name || '');

      if (isAlreadyOnCallScreen) {
        console.log('🧭 Already on call screen, no restore needed');
        return { success: true, restoredToCallScreen: false, navigationAction: 'already_on_call_screen' };
      }

      // Check if call is still valid (not too old)
      const backgroundDuration = this.currentCallState.backgroundTransitionTime
        ? Date.now() - this.currentCallState.backgroundTransitionTime
        : 0;

      if (backgroundDuration > this.config.maxBackgroundDuration) {
        console.log('🧭 Call too old, not restoring navigation');
        this.endCallSession();
        return { success: false, restoredToCallScreen: false, error: 'Call too old' };
      }

      // Restore to call screen
      await this.restoreToCallScreen();

      return { success: true, restoredToCallScreen: true, navigationAction: 'restored_to_call_screen' };

    } catch (error) {
      console.error('🧭 Navigation restore failed:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'CallNavigationManager',
        action: 'navigation_restore',
        callState: this.currentCallState,
      });

      return { success: false, restoredToCallScreen: false, error: (error as Error).message };
    }
  }

  /**
   * Restore navigation to the call screen
   */
  private async restoreToCallScreen(): Promise<void> {
    if (!this.currentCallState || !this.navigationRef) {
      return;
    }

    console.log(`🧭 Restoring to call screen: ${this.currentCallState.currentScreen}`);

    try {
      // Navigate to the correct call screen based on participant type
      if (this.currentCallState.participantType === 'customer') {
        this.navigationRef.navigate('CustomerDetails' as never, {
          customer: this.currentCallState.screenParams.customer,
          restoreCall: true,
        } as never);
      } else if (this.currentCallState.participantType === 'doctor') {
        this.navigationRef.navigate('DoctorDetails' as never, {
          doctor: this.currentCallState.screenParams.doctor,
          restoreCall: true,
        } as never);
      }

      console.log('✅ Navigation restored to call screen');

    } catch (error) {
      console.error('❌ Failed to restore to call screen:', error);
      throw error;
    }
  }

  /**
   * Check if a screen name is a call screen
   */
  private isCallScreen(screenName: string): boolean {
    const callScreens = ['CustomerDetails', 'DoctorDetails'];
    return callScreens.includes(screenName);
  }

  /**
   * Persist call state to storage
   */
  private async persistCallState(): Promise<void> {
    if (!this.config.enableNavigationPersistence || !this.currentCallState) {
      return;
    }

    try {
      const stateToStore = {
        ...this.currentCallState,
        persistedAt: Date.now(),
      };

      await AsyncStorage.setItem(this.config.persistenceKey, JSON.stringify(stateToStore));
      console.log('🧭 Call navigation state persisted');

    } catch (error) {
      console.error('❌ Failed to persist call navigation state:', error);
    }
  }

  /**
   * Load persisted call state from storage
   */
  private async loadPersistedCallState(): Promise<void> {
    if (!this.config.enableNavigationPersistence) {
      return;
    }

    try {
      const storedState = await AsyncStorage.getItem(this.config.persistenceKey);

      if (storedState) {
        const parsedState = JSON.parse(storedState) as CallNavigationState & { persistedAt: number };

        // Check if the persisted state is not too old
        const age = Date.now() - parsedState.persistedAt;
        if (age < this.config.maxBackgroundDuration) {
          this.currentCallState = {
            isInCall: parsedState.isInCall,
            callType: parsedState.callType,
            currentScreen: parsedState.currentScreen,
            screenParams: parsedState.screenParams,
            participantName: parsedState.participantName,
            participantType: parsedState.participantType,
            roomUrl: parsedState.roomUrl,
            callStartTime: parsedState.callStartTime,
            backgroundTransitionTime: parsedState.backgroundTransitionTime,
          };

          console.log('🧭 Loaded persisted call navigation state');
        } else {
          console.log('🧭 Persisted call state too old, clearing');
          await this.clearPersistedCallState();
        }
      }

    } catch (error) {
      console.error('❌ Failed to load persisted call navigation state:', error);
      await this.clearPersistedCallState();
    }
  }

  /**
   * Clear persisted call state
   */
  private async clearPersistedCallState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.config.persistenceKey);
      console.log('🧭 Cleared persisted call navigation state');
    } catch (error) {
      console.error('❌ Failed to clear persisted call navigation state:', error);
    }
  }

  /**
   * Public API for manual navigation restore (useful for app startup)
   */
  public async checkAndRestoreCallNavigation(): Promise<NavigationRestoreResult> {
    console.log('🧭 Checking for call navigation to restore...');

    // Load persisted state if not already loaded
    if (!this.currentCallState) {
      await this.loadPersistedCallState();
    }

    if (this.currentCallState?.isInCall) {
      console.log('🧭 Found active call state, attempting restore');
      return await this.attemptNavigationRestore();
    }

    return { success: true, restoredToCallScreen: false, navigationAction: 'no_call_to_restore' };
  }

  /**
   * Configuration management
   */
  public updateConfig(newConfig: Partial<CallNavigationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🧭 Call navigation config updated:', this.config);
  }

  public getConfig(): CallNavigationConfig {
    return { ...this.config };
  }

  /**
   * Status getters
   */
  public getCurrentCallState(): CallNavigationState | null {
    return this.currentCallState ? { ...this.currentCallState } : null;
  }

  public isInCall(): boolean {
    return this.currentCallState?.isInCall || false;
  }

  public isNavigationBlocked(): boolean {
    return this.isNavigationBlocked;
  }

  /**
   * Manual controls
   */
  public enableNavigationGuards(): void {
    this.isNavigationBlocked = true;
    console.log('🧭 Navigation guards enabled');
  }

  public disableNavigationGuards(): void {
    this.isNavigationBlocked = false;
    console.log('🧭 Navigation guards disabled');
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    console.log('🧹 CallNavigationManager destroying...');

    // Clear any persisted state
    this.clearPersistedCallState();

    // Remove event listeners
    if (this.appStateUnsubscribe) {
      this.appStateUnsubscribe();
      this.appStateUnsubscribe = null;
    }

    if (this.backgroundManagerUnsubscribe) {
      this.backgroundManagerUnsubscribe();
      this.backgroundManagerUnsubscribe = null;
    }

    // Clear navigation listeners
    this.navigationListeners.forEach(unsubscribe => unsubscribe());
    this.navigationListeners = [];

    this.currentCallState = null;
    this.navigationRef = null;
    this.isNavigationBlocked = false;
    this.isInitialized = false;

    CallNavigationManager.instance = null;

    console.log('✅ CallNavigationManager destroyed');
  }
}

export default CallNavigationManager;
export type { CallNavigationState, CallNavigationConfig, NavigationRestoreResult };