import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

interface PermissionDialogState {
  isActive: boolean;
  dialogType: 'camera' | 'microphone' | 'location' | 'notifications' | 'health' | 'combined' | null;
  startTime: number;
  expectedDuration: number;
  requestContext?: {
    screen?: string;
    feature?: string;
    userId?: string;
    entityId?: string;
  };
}

interface AppStateTransition {
  from: AppStateStatus;
  to: AppStateStatus;
  timestamp: number;
  permissionDialogActive: boolean;
}

/**
 * PermissionDialogStateManager
 *
 * Manages permission dialog states to prevent app state transitions from
 * interfering with navigation during system permission requests.
 *
 * Key Features:
 * - Tracks active permission dialogs
 * - Identifies permission-related app state transitions
 * - Provides protection for navigation during permission flows
 * - Prevents Redux conflicts during system dialogs
 */
class PermissionDialogStateManager {
  private static instance: PermissionDialogStateManager | null = null;

  private currentDialogState: PermissionDialogState = {
    isActive: false,
    dialogType: null,
    startTime: 0,
    expectedDuration: 0,
  };

  private transitionHistory: AppStateTransition[] = [];
  private maxHistorySize = 20;
  private appStateSubscription: any = null;
  private currentAppState: AppStateStatus = AppState.currentState;

  // Protection timeouts
  private dialogProtectionTimeout: NodeJS.Timeout | null = null;
  private transitionCooldownTimeout: NodeJS.Timeout | null = null;

  // Listeners for permission dialog events
  private listeners: {
    id: string;
    callback: (isDialogActive: boolean, dialogType: string | null) => void;
  }[] = [];

  private constructor() {
    this.initialize();
  }

  static getInstance(): PermissionDialogStateManager {
    if (!PermissionDialogStateManager.instance) {
      PermissionDialogStateManager.instance = new PermissionDialogStateManager();
    }
    return PermissionDialogStateManager.instance;
  }

  private initialize() {
    console.log('🔒 PermissionDialogStateManager initializing...');

    // Monitor app state changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );

    // Restore any previous dialog state
    this.restorePreviousState();

    console.log('✅ PermissionDialogStateManager initialized');
  }

  private async restorePreviousState() {
    try {
      const stored = await AsyncStorage.getItem('@hopmed_permission_dialog_state');
      if (stored) {
        const previousState = JSON.parse(stored);

        // Check if previous permission dialog was interrupted
        if (previousState.isActive && Date.now() - previousState.startTime < 60000) {
          console.log('🔒 Restored interrupted permission dialog state');
          this.currentDialogState = {
            ...previousState,
            // Extend protection for recovery
            expectedDuration: Math.max(previousState.expectedDuration, 10000),
          };

          // Set a recovery timeout
          this.setDialogProtection(this.currentDialogState.expectedDuration);
        }
      }
    } catch (error) {
      console.warn('Failed to restore permission dialog state:', error);
    }
  }

  private async persistDialogState() {
    try {
      await AsyncStorage.setItem(
        '@hopmed_permission_dialog_state',
        JSON.stringify({
          ...this.currentDialogState,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.warn('Failed to persist permission dialog state:', error);
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus) {
    const timestamp = Date.now();
    const previousState = this.currentAppState;

    // Record transition
    const transition: AppStateTransition = {
      from: previousState,
      to: nextAppState,
      timestamp,
      permissionDialogActive: this.currentDialogState.isActive,
    };

    this.transitionHistory.push(transition);
    if (this.transitionHistory.length > this.maxHistorySize) {
      this.transitionHistory = this.transitionHistory.slice(-this.maxHistorySize);
    }

    console.log(
      `🔒 App state transition: ${previousState} → ${nextAppState} (permission dialog: ${this.currentDialogState.isActive ? 'active' : 'inactive'})`
    );

    // Detect permission dialog patterns
    this.analyzeTransitionForPermissionDialog(transition);

    this.currentAppState = nextAppState;
  }

  private analyzeTransitionForPermissionDialog(transition: AppStateTransition) {
    const recentTransitions = this.transitionHistory.slice(-3);

    // Pattern 1: active → background (permission dialog opens)
    if (
      transition.from === 'active' &&
      transition.to === 'background' &&
      !this.currentDialogState.isActive
    ) {
      const timeSinceLastTransition =
        recentTransitions.length > 1
          ? transition.timestamp - recentTransitions[recentTransitions.length - 2].timestamp
          : 0;

      // If rapid transition, likely permission dialog
      if (timeSinceLastTransition < 500 || this.isProbablyPermissionDialog()) {
        console.log('🔒 Detected potential permission dialog opening');
        // Don't auto-start protection here, wait for explicit dialog start
      }
    }

    // Pattern 2: background → active (permission dialog closes)
    if (
      transition.from === 'background' &&
      transition.to === 'active' &&
      this.currentDialogState.isActive
    ) {
      const dialogDuration = transition.timestamp - this.currentDialogState.startTime;
      console.log(`🔒 Detected permission dialog closing after ${dialogDuration}ms`);

      // End dialog protection with a brief cooldown
      this.endDialogProtection(true);
    }
  }

  private isProbablyPermissionDialog(): boolean {
    const recentTransitions = this.transitionHistory.slice(-2);
    if (recentTransitions.length < 2) return false;

    const [prev, curr] = recentTransitions;
    const timeDiff = curr.timestamp - prev.timestamp;

    // Quick successive transitions suggest system dialog
    return (
      timeDiff < 1000 &&
      ((prev.from === 'active' && prev.to === 'inactive') ||
        (prev.from === 'inactive' && prev.to === 'background'))
    );
  }

  // Public API for permission managers
  public startPermissionDialog(
    dialogType: PermissionDialogState['dialogType'],
    context?: PermissionDialogState['requestContext'],
    expectedDuration = 15000
  ): void {
    console.log(`🔒 Starting permission dialog protection: ${dialogType}`);

    this.currentDialogState = {
      isActive: true,
      dialogType,
      startTime: Date.now(),
      expectedDuration,
      requestContext: context,
    };

    this.setDialogProtection(expectedDuration);
    this.persistDialogState();
    this.notifyListeners(true, dialogType);
  }

  public endPermissionDialog(
    dialogType?: PermissionDialogState['dialogType'],
    withCooldown = false
  ): void {
    if (!this.currentDialogState.isActive) return;

    // Verify dialog type matches if specified
    if (dialogType && this.currentDialogState.dialogType !== dialogType) {
      console.warn(
        `🔒 Dialog type mismatch: expected ${dialogType}, active ${this.currentDialogState.dialogType}`
      );
      return;
    }

    const duration = Date.now() - this.currentDialogState.startTime;
    console.log(
      `🔒 Ending permission dialog protection: ${this.currentDialogState.dialogType} (duration: ${duration}ms)`
    );

    this.endDialogProtection(withCooldown);
  }

  private setDialogProtection(duration: number) {
    // Clear existing timeout
    if (this.dialogProtectionTimeout) {
      clearTimeout(this.dialogProtectionTimeout);
    }

    // Set new protection timeout
    this.dialogProtectionTimeout = setTimeout(() => {
      console.log('🔒 Permission dialog protection timeout reached');
      this.endDialogProtection(true);
    }, duration);
  }

  private endDialogProtection(withCooldown: boolean) {
    const prevType = this.currentDialogState.dialogType;

    this.currentDialogState = {
      isActive: false,
      dialogType: null,
      startTime: 0,
      expectedDuration: 0,
    };

    if (this.dialogProtectionTimeout) {
      clearTimeout(this.dialogProtectionTimeout);
      this.dialogProtectionTimeout = null;
    }

    this.persistDialogState();
    this.notifyListeners(false, null);

    // Optional cooldown to prevent immediate re-triggers
    if (withCooldown) {
      this.transitionCooldownTimeout = setTimeout(() => {
        console.log('🔒 Permission dialog cooldown ended');
        this.transitionCooldownTimeout = null;
      }, 2000);
    }
  }

  // Public state accessors
  public isPermissionDialogActive(): boolean {
    return this.currentDialogState.isActive;
  }

  public getCurrentDialogType(): string | null {
    return this.currentDialogState.dialogType;
  }

  public getDialogContext(): PermissionDialogState['requestContext'] | undefined {
    return this.currentDialogState.requestContext;
  }

  public isInCooldownPeriod(): boolean {
    return this.transitionCooldownTimeout !== null;
  }

  // Should app state changes be ignored?
  public shouldIgnoreAppStateChange(nextAppState: AppStateStatus): boolean {
    // Ignore during active permission dialogs
    if (this.currentDialogState.isActive) {
      console.log(`🔒 Ignoring app state change during permission dialog: ${nextAppState}`);
      return true;
    }

    // Ignore during cooldown period
    if (this.isInCooldownPeriod()) {
      console.log(`🔒 Ignoring app state change during cooldown: ${nextAppState}`);
      return true;
    }

    return false;
  }

  // Should navigation be preserved?
  public shouldPreserveNavigation(): boolean {
    return this.currentDialogState.isActive || this.isInCooldownPeriod();
  }

  // Listener management
  public addListener(
    id: string,
    callback: (isDialogActive: boolean, dialogType: string | null) => void
  ): () => void {
    this.listeners.push({ id, callback });
    console.log(`🔒 Added permission dialog listener: ${id}`);

    return () => {
      const index = this.listeners.findIndex(l => l.id === id);
      if (index !== -1) {
        this.listeners.splice(index, 1);
        console.log(`🔒 Removed permission dialog listener: ${id}`);
      }
    };
  }

  private notifyListeners(isActive: boolean, dialogType: string | null) {
    for (const listener of this.listeners) {
      try {
        listener.callback(isActive, dialogType);
      } catch (error) {
        console.error(`🚨 Error in permission dialog listener ${listener.id}:`, error);
      }
    }
  }

  // Debug utilities
  public getTransitionHistory(): AppStateTransition[] {
    return [...this.transitionHistory];
  }

  public getCurrentDialogState(): PermissionDialogState {
    return { ...this.currentDialogState };
  }

  public debugState(): void {
    console.log('🔒 PermissionDialogStateManager Debug:', {
      dialogActive: this.currentDialogState.isActive,
      dialogType: this.currentDialogState.dialogType,
      dialogDuration: this.currentDialogState.isActive
        ? Date.now() - this.currentDialogState.startTime
        : 0,
      cooldownActive: this.isInCooldownPeriod(),
      currentAppState: this.currentAppState,
      recentTransitions: this.transitionHistory.slice(-5),
    });
  }

  // Cleanup
  public destroy(): void {
    console.log('🧹 PermissionDialogStateManager destroying...');

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    if (this.dialogProtectionTimeout) {
      clearTimeout(this.dialogProtectionTimeout);
    }

    if (this.transitionCooldownTimeout) {
      clearTimeout(this.transitionCooldownTimeout);
    }

    this.listeners = [];
    PermissionDialogStateManager.instance = null;
  }
}

export default PermissionDialogStateManager;
