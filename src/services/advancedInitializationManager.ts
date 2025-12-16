/**
 * Advanced Initialization Manager
 *
 * Solves race conditions and provides safer initialization patterns for medical-grade reliability.
 * Implements timeout-based initialization with proper state management and provider coordination.
 */

import { CallProvider } from '../types/callTypes';

interface InitializationState {
  state: 'idle' | 'initializing' | 'ready' | 'failed' | 'timeout';
  instance?: any;
  error?: string;
  lastAttempt: number;
  attemptCount: number;
}

interface InitializationOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  forceReinitialize?: boolean;
}

class AdvancedInitializationManager {
  private static instance: AdvancedInitializationManager;
  private initStates = new Map<string, InitializationState>();
  private initPromises = new Map<string, Promise<any>>();
  private initTimeouts = new Map<string, NodeJS.Timeout>();

  // Global provider locks to prevent concurrent provider initialization
  private providerLocks = new Map<CallProvider, Promise<any>>();
  private providerInstances = new Map<CallProvider, any>();

  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_RETRY_DELAY = 1000; // 1 second
  private readonly PROVIDER_COOLDOWN = 5000; // 5 seconds between provider switches

  private constructor() {}

  public static getInstance(): AdvancedInitializationManager {
    if (!AdvancedInitializationManager.instance) {
      AdvancedInitializationManager.instance = new AdvancedInitializationManager();
    }
    return AdvancedInitializationManager.instance;
  }

  /**
   * Safely initialize a provider with race condition protection
   */
  async safeInitialize<T>(
    providerId: string,
    initFn: () => Promise<T>,
    options: InitializationOptions = {}
  ): Promise<T> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      maxRetries = this.DEFAULT_MAX_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      forceReinitialize = false,
    } = options;

    const state = this.initStates.get(providerId);

    // Force reinitialize if requested
    if (forceReinitialize && state) {
      console.log(`🔄 Force reinitializing ${providerId}`);
      await this.cleanup(providerId);
    }

    // Return existing promise if initialization is in progress
    if (state?.state === 'initializing' && this.initPromises.has(providerId)) {
      console.log(`⏳ Waiting for ongoing initialization: ${providerId}`);
      return await this.initPromises.get(providerId)!;
    }

    // Return existing instance if ready and not forced
    if (state?.state === 'ready' && state.instance && !forceReinitialize) {
      console.log(`✅ Using cached instance: ${providerId}`);
      return state.instance;
    }

    // Check if we should retry failed initialization
    if (state?.state === 'failed' && !this.shouldRetryFailedInit(state, maxRetries)) {
      throw new Error(
        `Initialization failed for ${providerId}: ${state.error}. Max retries exceeded.`
      );
    }

    // Create new initialization with timeout protection
    const initPromise = this.createTimeoutPromise(
      async () => {
        const result = await initFn();
        console.log(`✅ Successfully initialized: ${providerId}`);
        return result;
      },
      timeout,
      providerId
    );

    this.initPromises.set(providerId, initPromise);
    this.updateState(providerId, 'initializing');

    try {
      const result = await initPromise;
      this.updateState(providerId, 'ready', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error(`❌ Initialization failed for ${providerId}:`, errorMessage);

      this.updateState(providerId, 'failed', undefined, errorMessage);

      // Retry logic with exponential backoff
      if (this.shouldRetryFailedInit(this.initStates.get(providerId)!, maxRetries)) {
        console.log(`🔄 Retrying initialization for ${providerId} in ${retryDelay}ms`);
        await this.sleep(retryDelay * Math.pow(2, state?.attemptCount || 0));
        return this.safeInitialize(providerId, initFn, options);
      }

      throw error;
    } finally {
      this.initPromises.delete(providerId);
      this.clearTimeout(providerId);
    }
  }

  /**
   * Provider-level initialization with global coordination
   */
  async initializeProvider(provider: CallProvider, initFn: () => Promise<any>): Promise<any> {
    // Check if provider is already being initialized globally
    if (this.providerLocks.has(provider)) {
      console.log(`⏳ Waiting for global ${provider} initialization`);
      return await this.providerLocks.get(provider)!;
    }

    // Check if provider instance already exists
    if (this.providerInstances.has(provider)) {
      console.log(`✅ Using existing ${provider} instance`);
      return this.providerInstances.get(provider);
    }

    // Create provider-level lock
    const providerInitPromise = this.safeInitialize(`provider_${provider}`, initFn, {
      timeout: 15000,
      maxRetries: 2,
    });

    this.providerLocks.set(provider, providerInitPromise);

    try {
      const instance = await providerInitPromise;
      this.providerInstances.set(provider, instance);
      return instance;
    } catch (error) {
      // Clean up failed provider
      this.providerInstances.delete(provider);
      throw error;
    } finally {
      this.providerLocks.delete(provider);
    }
  }

  /**
   * Get provider instance if available
   */
  getProviderInstance(provider: CallProvider): any | null {
    return this.providerInstances.get(provider) || null;
  }

  /**
   * Check if provider is ready
   */
  isProviderReady(provider: CallProvider): boolean {
    const state = this.initStates.get(`provider_${provider}`);
    return state?.state === 'ready' && this.providerInstances.has(provider);
  }

  /**
   * Clean up provider resources
   */
  async cleanupProvider(provider: CallProvider): Promise<void> {
    console.log(`🧹 Cleaning up ${provider} provider`);

    // Cancel any ongoing initialization
    await this.cleanup(`provider_${provider}`);

    // Remove provider instance
    this.providerInstances.delete(provider);

    // Cancel provider lock
    this.providerLocks.delete(provider);
  }

  /**
   * Get current initialization state
   */
  getInitializationState(providerId: string): InitializationState | null {
    return this.initStates.get(providerId) || null;
  }

  /**
   * Force cleanup of a specific initialization
   */
  async cleanup(providerId: string): Promise<void> {
    console.log(`🧹 Cleaning up initialization: ${providerId}`);

    // Cancel timeout
    this.clearTimeout(providerId);

    // Remove from promises and state
    this.initPromises.delete(providerId);
    this.initStates.delete(providerId);
  }

  /**
   * Emergency cleanup of all initializations
   */
  async emergencyCleanup(): Promise<void> {
    console.log('🚨 Emergency cleanup of all initializations');

    // Clear all timeouts
    this.initTimeouts.forEach(timeout => clearTimeout(timeout));
    this.initTimeouts.clear();

    // Clear all promises and states
    this.initPromises.clear();
    this.initStates.clear();
    this.providerLocks.clear();
    this.providerInstances.clear();
  }

  /**
   * Private helper methods
   */
  private createTimeoutPromise<T>(
    promise: () => Promise<T>,
    timeoutMs: number,
    providerId: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`⏰ Initialization timeout for ${providerId} after ${timeoutMs}ms`);
        this.updateState(providerId, 'timeout', undefined, `Timeout after ${timeoutMs}ms`);
        reject(new Error(`Initialization timeout for ${providerId} after ${timeoutMs}ms`));
      }, timeoutMs);

      this.initTimeouts.set(providerId, timeout);

      promise().then(resolve).catch(reject);
    });
  }

  private updateState(
    providerId: string,
    state: InitializationState['state'],
    instance?: any,
    error?: string
  ): void {
    const currentState = this.initStates.get(providerId);
    const newState: InitializationState = {
      state,
      instance,
      error,
      lastAttempt: Date.now(),
      attemptCount:
        state === 'initializing'
          ? (currentState?.attemptCount || 0) + 1
          : currentState?.attemptCount || 0,
    };

    this.initStates.set(providerId, newState);
  }

  private shouldRetryFailedInit(state: InitializationState, maxRetries: number): boolean {
    if (state.attemptCount >= maxRetries) {
      return false;
    }

    // Don't retry timeout errors immediately
    if (state.state === 'timeout' && Date.now() - state.lastAttempt < 5000) {
      return false;
    }

    return true;
  }

  private clearTimeout(providerId: string): void {
    const timeout = this.initTimeouts.get(providerId);
    if (timeout) {
      clearTimeout(timeout);
      this.initTimeouts.delete(providerId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Medical-grade validation methods
   */
  async validateMedicalReadiness(provider: CallProvider): Promise<boolean> {
    const instance = this.getProviderInstance(provider);
    if (!instance) {
      return false;
    }

    try {
      // Provider-specific readiness checks
      if (provider === CallProvider.DAILY) {
        // Check if call object is ready for medical consultations
        return !!(instance && typeof instance.join === 'function');
      }

      return false;
    } catch (error) {
      console.error(`Medical readiness check failed for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get initialization metrics for monitoring
   */
  getInitializationMetrics(): {
    totalInitializations: number;
    successfulInitializations: number;
    failedInitializations: number;
    timeoutInitializations: number;
    averageInitTime: number;
  } {
    const states = Array.from(this.initStates.values());

    return {
      totalInitializations: states.length,
      successfulInitializations: states.filter(s => s.state === 'ready').length,
      failedInitializations: states.filter(s => s.state === 'failed').length,
      timeoutInitializations: states.filter(s => s.state === 'timeout').length,
      averageInitTime: 0, // Could be calculated by tracking init times
    };
  }
}

export default AdvancedInitializationManager.getInstance();
