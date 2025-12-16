import { EventEmitter } from 'events';

import type { AuthTokens, User } from '../types';

export type AuthState =
  | 'initializing'
  | 'authenticated'
  | 'refreshing'
  | 'expired'
  | 'offline'
  | 'unauthenticated'
  | 'error';

export type AuthEvent =
  | 'INITIALIZE'
  | 'LOGIN_SUCCESS'
  | 'REFRESH_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'NETWORK_ERROR'
  | 'LOGOUT'
  | 'CLEAR_ERROR'
  | 'MEMORY_PRESSURE'
  | 'STORAGE_ERROR';

interface AuthContext {
  user?: User;
  tokens?: AuthTokens;
  error?: string;
  retryCount?: number;
  lastRefreshAttempt?: number;
  memoryPressureDetected?: boolean;
}

interface AuthStateTransition {
  from: AuthState;
  to: AuthState;
  event: AuthEvent;
  timestamp: number;
  context?: Partial<AuthContext>;
}

/**
 * AuthStateMachine
 *
 * Centralized state machine for authentication to prevent race conditions
 * and ensure consistent auth state management across the app.
 *
 * Key Features:
 * - Atomic state transitions
 * - Concurrent operation prevention
 * - Memory pressure handling
 * - Network error recovery
 * - Comprehensive state tracking
 */
class AuthStateMachine extends EventEmitter {
  private static instance: AuthStateMachine | null = null;

  private currentState: AuthState = 'initializing';
  private context: AuthContext = {};
  private transitionHistory: AuthStateTransition[] = [];
  private maxHistorySize = 50;

  // Concurrent operation protection
  private activeOperations = new Set<string>();
  private operationQueue: {
    id: string;
    event: AuthEvent;
    context?: Partial<AuthContext>;
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }[] = [];

  // Rate limiting and retry logic
  private readonly maxRetryAttempts = 3;
  private readonly baseRetryDelay = 1000; // 1 second
  private readonly maxRetryDelay = 30000; // 30 seconds

  // Memory pressure tracking
  private memoryPressureRecoveryAttempts = 0;
  private readonly maxMemoryRecoveryAttempts = 3;

  private constructor() {
    super();
    this.initialize();
  }

  static getInstance(): AuthStateMachine {
    if (!AuthStateMachine.instance) {
      AuthStateMachine.instance = new AuthStateMachine();
    }
    return AuthStateMachine.instance;
  }

  private initialize(): void {
    console.log('🔄 AuthStateMachine initializing...');

    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupHistory();
      this.processQueue();
    }, 60000); // Every minute

    console.log('✅ AuthStateMachine initialized');
  }

  private cleanupHistory(): void {
    if (this.transitionHistory.length > this.maxHistorySize) {
      this.transitionHistory = this.transitionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Process queued operations to prevent race conditions
   */
  private async processQueue(): Promise<void> {
    if (this.operationQueue.length === 0 || this.activeOperations.size > 0) {
      return;
    }

    const operation = this.operationQueue.shift();
    if (!operation) return;

    try {
      this.activeOperations.add(operation.id);
      const result = await this.handleEvent(operation.event, operation.context);
      operation.resolve(result);
    } catch (error) {
      operation.reject(error);
    } finally {
      this.activeOperations.delete(operation.id);
      // Process next operation
      if (this.operationQueue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  /**
   * Queue an event for atomic processing
   */
  private queueEvent(event: AuthEvent, context?: Partial<AuthContext>): Promise<any> {
    return new Promise((resolve, reject) => {
      const operationId = `${event}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.operationQueue.push({
        id: operationId,
        event,
        context,
        resolve,
        reject,
      });

      // Start processing if no active operations
      if (this.activeOperations.size === 0) {
        this.processQueue();
      }
    });
  }

  /**
   * Get current authentication state
   */
  public getCurrentState(): AuthState {
    return this.currentState;
  }

  /**
   * Get current authentication context
   */
  public getContext(): Readonly<AuthContext> {
    return { ...this.context };
  }

  /**
   * Check if an operation is currently in progress
   */
  public isOperationInProgress(): boolean {
    return this.activeOperations.size > 0;
  }

  /**
   * Transition to a new state with proper validation
   */
  private transition(toState: AuthState, event: AuthEvent, context?: Partial<AuthContext>): void {
    const fromState = this.currentState;

    // Validate transition
    if (!this.isValidTransition(fromState, toState, event)) {
      console.warn(`🚫 Invalid transition: ${fromState} -> ${toState} (${event})`);
      return;
    }

    // Update state and context
    this.currentState = toState;
    this.context = { ...this.context, ...context };

    // Record transition
    const transition: AuthStateTransition = {
      from: fromState,
      to: toState,
      event,
      timestamp: Date.now(),
      context: context ? { ...context } : undefined,
    };

    this.transitionHistory.push(transition);

    console.log(`🔄 Auth state: ${fromState} -> ${toState} (${event})`);

    // Emit state change event
    this.emit('stateChange', {
      from: fromState,
      to: toState,
      event,
      context: this.context,
    });
  }

  /**
   * Validate if a state transition is allowed
   */
  private isValidTransition(from: AuthState, to: AuthState, event: AuthEvent): boolean {
    const validTransitions: Record<AuthState, Partial<Record<AuthEvent, AuthState[]>>> = {
      initializing: {
        INITIALIZE: ['authenticated', 'unauthenticated', 'error'],
        NETWORK_ERROR: ['offline'],
        STORAGE_ERROR: ['error'],
      },
      unauthenticated: {
        LOGIN_SUCCESS: ['authenticated'],
        NETWORK_ERROR: ['offline'],
      },
      authenticated: {
        REFRESH_TOKEN: ['refreshing'],
        TOKEN_EXPIRED: ['expired', 'refreshing'],
        LOGOUT: ['unauthenticated'],
        NETWORK_ERROR: ['offline'],
        MEMORY_PRESSURE: ['offline'],
      },
      refreshing: {
        LOGIN_SUCCESS: ['authenticated'],
        TOKEN_EXPIRED: ['expired'],
        NETWORK_ERROR: ['offline'],
        STORAGE_ERROR: ['error'],
      },
      expired: {
        LOGIN_SUCCESS: ['authenticated'],
        LOGOUT: ['unauthenticated'],
        REFRESH_TOKEN: ['refreshing'],
      },
      offline: {
        LOGIN_SUCCESS: ['authenticated'],
        INITIALIZE: ['authenticated', 'unauthenticated'],
        LOGOUT: ['unauthenticated'],
        CLEAR_ERROR: ['authenticated', 'unauthenticated'],
      },
      error: {
        CLEAR_ERROR: ['unauthenticated'],
        LOGOUT: ['unauthenticated'],
        INITIALIZE: ['authenticated', 'unauthenticated'],
      },
    };

    const allowedStates = validTransitions[from][event];
    return allowedStates ? allowedStates.includes(to) : false;
  }

  /**
   * Handle authentication events
   */
  private async handleEvent(event: AuthEvent, context?: Partial<AuthContext>): Promise<any> {
    const currentState = this.currentState;

    switch (event) {
      case 'INITIALIZE':
        return this.handleInitialize(context);

      case 'LOGIN_SUCCESS':
        this.transition('authenticated', event, context);
        this.resetRetryCount();
        return this.context;

      case 'REFRESH_TOKEN':
        return this.handleRefreshToken(context);

      case 'TOKEN_EXPIRED':
        return this.handleTokenExpired(context);

      case 'NETWORK_ERROR':
        return this.handleNetworkError(context);

      case 'LOGOUT':
        this.transition('unauthenticated', event);
        this.resetContext();
        return null;

      case 'CLEAR_ERROR':
        return this.handleClearError(context);

      case 'MEMORY_PRESSURE':
        return this.handleMemoryPressure(context);

      case 'STORAGE_ERROR':
        this.transition('error', event, context);
        return null;

      default:
        console.warn(`🚫 Unknown auth event: ${event}`);
        return null;
    }
  }

  private async handleInitialize(context?: Partial<AuthContext>): Promise<any> {
    try {
      if (context?.tokens && context.user) {
        this.transition('authenticated', 'INITIALIZE', context);
        return this.context;
      } else {
        this.transition('unauthenticated', 'INITIALIZE');
        return null;
      }
    } catch (error) {
      this.transition('error', 'INITIALIZE', { error: (error as Error).message });
      throw error;
    }
  }

  private async handleRefreshToken(context?: Partial<AuthContext>): Promise<any> {
    if (this.currentState !== 'authenticated') {
      throw new Error('Cannot refresh token in current state');
    }

    this.transition('refreshing', 'REFRESH_TOKEN', context);

    try {
      // The actual refresh logic will be handled by the caller
      // State machine just manages the state transitions
      return this.context;
    } catch (error) {
      if (this.shouldRetry()) {
        this.incrementRetryCount();
        // Stay in refreshing state for retry
        return this.context;
      } else {
        this.transition('expired', 'TOKEN_EXPIRED', {
          error: (error as Error).message,
        });
        throw error;
      }
    }
  }

  private async handleTokenExpired(context?: Partial<AuthContext>): Promise<any> {
    if (this.currentState === 'authenticated' || this.currentState === 'refreshing') {
      this.transition('expired', 'TOKEN_EXPIRED', context);
    }
    return null;
  }

  private async handleNetworkError(context?: Partial<AuthContext>): Promise<any> {
    // Don't transition to offline if we're already in an error state
    if (this.currentState !== 'error') {
      this.transition('offline', 'NETWORK_ERROR', context);
    }
    return null;
  }

  private async handleClearError(context?: Partial<AuthContext>): Promise<any> {
    if (context?.tokens && context.user) {
      this.transition('authenticated', 'CLEAR_ERROR', context);
      return this.context;
    } else {
      this.transition('unauthenticated', 'CLEAR_ERROR');
      return null;
    }
  }

  private async handleMemoryPressure(context?: Partial<AuthContext>): Promise<any> {
    this.transition('offline', 'MEMORY_PRESSURE', {
      ...context,
      memoryPressureDetected: true,
    });

    // Attempt recovery if within limits
    if (this.canAttemptMemoryRecovery()) {
      setTimeout(() => {
        this.attemptMemoryRecovery();
      }, 5000); // Wait 5 seconds before recovery attempt
    }

    return null;
  }

  /**
   * Public API methods for external use
   */
  public async initialize(tokens?: AuthTokens, user?: User): Promise<any> {
    return this.queueEvent('INITIALIZE', { tokens, user });
  }

  public async loginSuccess(tokens: AuthTokens, user: User): Promise<any> {
    return this.queueEvent('LOGIN_SUCCESS', { tokens, user });
  }

  public async refreshToken(tokens?: AuthTokens): Promise<any> {
    return this.queueEvent('REFRESH_TOKEN', tokens ? { tokens } : undefined);
  }

  public async tokenExpired(error?: string): Promise<any> {
    return this.queueEvent('TOKEN_EXPIRED', error ? { error } : undefined);
  }

  public async networkError(error: string): Promise<any> {
    return this.queueEvent('NETWORK_ERROR', { error });
  }

  public async logout(): Promise<any> {
    return this.queueEvent('LOGOUT');
  }

  public async clearError(tokens?: AuthTokens, user?: User): Promise<any> {
    return this.queueEvent('CLEAR_ERROR', { tokens, user });
  }

  public async memoryPressure(): Promise<any> {
    return this.queueEvent('MEMORY_PRESSURE');
  }

  public async storageError(error: string): Promise<any> {
    return this.queueEvent('STORAGE_ERROR', { error });
  }

  /**
   * Retry logic helpers
   */
  private shouldRetry(): boolean {
    const retryCount = this.context.retryCount || 0;
    return retryCount < this.maxRetryAttempts;
  }

  private incrementRetryCount(): void {
    this.context.retryCount = (this.context.retryCount || 0) + 1;
  }

  private resetRetryCount(): void {
    this.context.retryCount = 0;
  }

  private resetContext(): void {
    this.context = {};
    this.memoryPressureRecoveryAttempts = 0;
  }

  /**
   * Memory pressure recovery
   */
  private canAttemptMemoryRecovery(): boolean {
    return this.memoryPressureRecoveryAttempts < this.maxMemoryRecoveryAttempts;
  }

  private async attemptMemoryRecovery(): Promise<void> {
    if (!this.canAttemptMemoryRecovery()) {
      console.log('🚫 Max memory recovery attempts reached');
      return;
    }

    this.memoryPressureRecoveryAttempts++;
    console.log(
      `🔄 Attempting memory pressure recovery (${this.memoryPressureRecoveryAttempts}/${this.maxMemoryRecoveryAttempts})`
    );

    try {
      // Emit recovery event for external handlers
      this.emit('memoryRecoveryAttempt', {
        attempt: this.memoryPressureRecoveryAttempts,
        maxAttempts: this.maxMemoryRecoveryAttempts,
      });
    } catch (error) {
      console.error('Memory recovery attempt failed:', error);
    }
  }

  /**
   * State validation and debugging
   */
  public isAuthenticated(): boolean {
    return this.currentState === 'authenticated';
  }

  public isInitializing(): boolean {
    return this.currentState === 'initializing';
  }

  public isOffline(): boolean {
    return this.currentState === 'offline';
  }

  public hasError(): boolean {
    return this.currentState === 'error';
  }

  public getTransitionHistory(): AuthStateTransition[] {
    return [...this.transitionHistory];
  }

  public getRecentTransitions(count: number = 10): AuthStateTransition[] {
    return this.transitionHistory.slice(-count);
  }

  /**
   * Debug utilities
   */
  public debugState(): void {
    console.log('🔍 AuthStateMachine Debug State:', {
      currentState: this.currentState,
      context: this.context,
      activeOperations: Array.from(this.activeOperations),
      queuedOperations: this.operationQueue.length,
      memoryRecoveryAttempts: this.memoryPressureRecoveryAttempts,
      recentTransitions: this.getRecentTransitions(5),
    });
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    console.log('🧹 AuthStateMachine destroying...');

    this.removeAllListeners();
    this.activeOperations.clear();
    this.operationQueue.length = 0;
    this.transitionHistory.length = 0;
    this.resetContext();

    AuthStateMachine.instance = null;
  }
}

export default AuthStateMachine;
