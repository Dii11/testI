import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthTokens } from '../types';

export interface StorageMetrics {
  secureStoreAvailable: boolean;
  asyncStorageAvailable: boolean;
  webStorageAvailable: boolean;
  conflicts: number;
  totalOperations: number;
  lastConsistencyCheck: number;
}

export interface StorageHealthCheck {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  metrics: StorageMetrics;
}

/**
 * StorageConsistencyManager
 *
 * Ensures consistent token storage across all available storage mechanisms
 * and handles fallback scenarios gracefully.
 *
 * Key Features:
 * - Multi-storage synchronization (SecureStore, AsyncStorage, localStorage)
 * - Conflict detection and resolution
 * - Storage health monitoring
 * - Automatic fallback mechanisms
 * - Storage migration utilities
 */
class StorageConsistencyManager {
  private static instance: StorageConsistencyManager | null = null;

  private readonly STORAGE_KEYS = {
    AUTH_TOKENS: 'hopmed_auth_tokens',
    STORAGE_METADATA: 'hopmed_storage_metadata',
    CONSISTENCY_LOG: 'hopmed_storage_consistency_log',
  };

  private metrics: StorageMetrics = {
    secureStoreAvailable: false,
    asyncStorageAvailable: false,
    webStorageAvailable: false,
    conflicts: 0,
    totalOperations: 0,
    lastConsistencyCheck: 0,
  };

  private consistencyLog: {
    timestamp: number;
    operation: string;
    status: 'success' | 'warning' | 'error';
    details: string;
  }[] = [];

  private readonly maxLogSize = 100;
  private consistencyCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initialize();
  }

  static getInstance(): StorageConsistencyManager {
    if (!StorageConsistencyManager.instance) {
      StorageConsistencyManager.instance = new StorageConsistencyManager();
    }
    return StorageConsistencyManager.instance;
  }

  private async initialize(): Promise<void> {
    console.log('🗄️ StorageConsistencyManager initializing...');

    try {
      await this.detectAvailableStorage();
      await this.loadMetrics();
      await this.performInitialConsistencyCheck();
      this.startPeriodicConsistencyCheck();

      console.log('✅ StorageConsistencyManager initialized successfully');
    } catch (error) {
      console.error('❌ StorageConsistencyManager initialization failed:', error);
      this.logOperation(
        'initialize',
        'error',
        `Initialization failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Detect which storage mechanisms are available
   */
  private async detectAvailableStorage(): Promise<void> {
    // Test SecureStore (mobile only)
    if (Platform.OS !== 'web') {
      try {
        await SecureStore.setItemAsync('hopmed_test_key', 'test');
        await SecureStore.deleteItemAsync('hopmed_test_key');
        this.metrics.secureStoreAvailable = true;
        console.log('✅ SecureStore available');
      } catch (error) {
        console.warn('⚠️ SecureStore not available:', error);
        this.metrics.secureStoreAvailable = false;
      }
    }

    // Test AsyncStorage
    try {
      await AsyncStorage.setItem('hopmed_test_key', 'test');
      await AsyncStorage.removeItem('hopmed_test_key');
      this.metrics.asyncStorageAvailable = true;
      console.log('✅ AsyncStorage available');
    } catch (error) {
      console.warn('⚠️ AsyncStorage not available:', error);
      this.metrics.asyncStorageAvailable = false;
    }

    // Test Web localStorage
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem('hopmed_test_key', 'test');
        localStorage.removeItem('hopmed_test_key');
        this.metrics.webStorageAvailable = true;
        console.log('✅ Web localStorage available');
      } catch (error) {
        console.warn('⚠️ Web localStorage not available:', error);
        this.metrics.webStorageAvailable = false;
      }
    }

    this.logOperation(
      'detectStorage',
      'success',
      `Storage availability: SecureStore=${this.metrics.secureStoreAvailable}, ` +
        `AsyncStorage=${this.metrics.asyncStorageAvailable}, ` +
        `WebStorage=${this.metrics.webStorageAvailable}`
    );
  }

  /**
   * Store tokens consistently across all available storage mechanisms
   */
  public async storeTokens(tokens: AuthTokens): Promise<void> {
    this.metrics.totalOperations++;
    const tokenString = JSON.stringify(tokens);
    const errors: string[] = [];
    let successfulStores = 0;

    console.log('🗄️ Storing tokens across all available storage mechanisms...');

    // Primary storage: SecureStore (mobile) or localStorage (web)
    if (Platform.OS === 'web' && this.metrics.webStorageAvailable) {
      try {
        localStorage.setItem(this.STORAGE_KEYS.AUTH_TOKENS, tokenString);
        successfulStores++;
        console.log('✅ Tokens stored in localStorage');
      } catch (error) {
        errors.push(`localStorage: ${(error as Error).message}`);
        console.error('❌ Failed to store tokens in localStorage:', error);
      }
    } else if (this.metrics.secureStoreAvailable) {
      try {
        await SecureStore.setItemAsync(this.STORAGE_KEYS.AUTH_TOKENS, tokenString);
        successfulStores++;
        console.log('✅ Tokens stored in SecureStore');
      } catch (error) {
        errors.push(`SecureStore: ${(error as Error).message}`);
        console.error('❌ Failed to store tokens in SecureStore:', error);
      }
    }

    // Fallback storage: AsyncStorage
    if (this.metrics.asyncStorageAvailable) {
      try {
        await AsyncStorage.setItem(this.STORAGE_KEYS.AUTH_TOKENS, tokenString);
        successfulStores++;
        console.log('✅ Tokens stored in AsyncStorage (fallback)');
      } catch (error) {
        errors.push(`AsyncStorage: ${(error as Error).message}`);
        console.error('❌ Failed to store tokens in AsyncStorage:', error);
      }
    }

    // Store metadata about successful storage operations
    await this.storeMetadata({
      timestamp: Date.now(),
      successfulStores,
      errors: errors.length,
      storageUsed: this.getActiveStorageMechanisms(),
    });

    if (successfulStores === 0) {
      const errorMessage = `All storage mechanisms failed: ${errors.join(', ')}`;
      this.logOperation('storeTokens', 'error', errorMessage);
      throw new Error(errorMessage);
    } else if (errors.length > 0) {
      this.logOperation(
        'storeTokens',
        'warning',
        `Partial storage success (${successfulStores} succeeded, ${errors.length} failed): ${errors.join(', ')}`
      );
    } else {
      this.logOperation(
        'storeTokens',
        'success',
        `Tokens stored successfully in ${successfulStores} storage mechanisms`
      );
    }
  }

  /**
   * Retrieve tokens with consistency checking
   */
  public async retrieveTokens(): Promise<AuthTokens | null> {
    this.metrics.totalOperations++;
    const retrievedTokens: Record<string, AuthTokens | null> = {};

    console.log('🗄️ Retrieving tokens from available storage mechanisms...');

    // Retrieve from all available storage mechanisms
    if (Platform.OS === 'web' && this.metrics.webStorageAvailable) {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEYS.AUTH_TOKENS);
        retrievedTokens.localStorage = stored ? JSON.parse(stored) : null;
      } catch (error) {
        console.warn('⚠️ Failed to retrieve from localStorage:', error);
        retrievedTokens.localStorage = null;
      }
    }

    if (this.metrics.secureStoreAvailable) {
      try {
        const stored = await SecureStore.getItemAsync(this.STORAGE_KEYS.AUTH_TOKENS);
        retrievedTokens.secureStore = stored ? JSON.parse(stored) : null;
      } catch (error) {
        console.warn('⚠️ Failed to retrieve from SecureStore:', error);
        retrievedTokens.secureStore = null;
      }
    }

    if (this.metrics.asyncStorageAvailable) {
      try {
        const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.AUTH_TOKENS);
        retrievedTokens.asyncStorage = stored ? JSON.parse(stored) : null;
      } catch (error) {
        console.warn('⚠️ Failed to retrieve from AsyncStorage:', error);
        retrievedTokens.asyncStorage = null;
      }
    }

    // Check for consistency and resolve conflicts
    const resolvedTokens = await this.resolveStorageConflicts(retrievedTokens);

    if (resolvedTokens) {
      this.logOperation('retrieveTokens', 'success', 'Tokens retrieved and verified successfully');
    } else {
      this.logOperation('retrieveTokens', 'warning', 'No tokens found in any storage mechanism');
    }

    return resolvedTokens;
  }

  /**
   * Clear tokens from all storage mechanisms
   */
  public async clearTokens(): Promise<void> {
    this.metrics.totalOperations++;
    const errors: string[] = [];
    let successfulClears = 0;

    console.log('🗄️ Clearing tokens from all storage mechanisms...');

    // Clear from all storage mechanisms
    if (Platform.OS === 'web' && this.metrics.webStorageAvailable) {
      try {
        localStorage.removeItem(this.STORAGE_KEYS.AUTH_TOKENS);
        successfulClears++;
        console.log('✅ Tokens cleared from localStorage');
      } catch (error) {
        errors.push(`localStorage: ${(error as Error).message}`);
      }
    }

    if (this.metrics.secureStoreAvailable) {
      try {
        await SecureStore.deleteItemAsync(this.STORAGE_KEYS.AUTH_TOKENS);
        successfulClears++;
        console.log('✅ Tokens cleared from SecureStore');
      } catch (error) {
        errors.push(`SecureStore: ${(error as Error).message}`);
      }
    }

    if (this.metrics.asyncStorageAvailable) {
      try {
        await AsyncStorage.removeItem(this.STORAGE_KEYS.AUTH_TOKENS);
        successfulClears++;
        console.log('✅ Tokens cleared from AsyncStorage');
      } catch (error) {
        errors.push(`AsyncStorage: ${(error as Error).message}`);
      }
    }

    if (errors.length > 0) {
      this.logOperation(
        'clearTokens',
        'warning',
        `Partial clear success (${successfulClears} succeeded, ${errors.length} failed): ${errors.join(', ')}`
      );
    } else {
      this.logOperation(
        'clearTokens',
        'success',
        `Tokens cleared from ${successfulClears} storage mechanisms`
      );
    }
  }

  /**
   * Resolve conflicts when different storage mechanisms have different token values
   */
  private async resolveStorageConflicts(
    retrievedTokens: Record<string, AuthTokens | null>
  ): Promise<AuthTokens | null> {
    const validTokens = Object.entries(retrievedTokens)
      .filter(([_, tokens]) => tokens !== null)
      .map(([source, tokens]) => ({ source, tokens: tokens! }));

    if (validTokens.length === 0) {
      return null;
    }

    if (validTokens.length === 1) {
      console.log(`🗄️ Single token source found: ${validTokens[0].source}`);
      return validTokens[0].tokens;
    }

    // Check for conflicts
    const firstTokens = validTokens[0].tokens;
    const conflicts = validTokens.filter(
      ({ tokens }) => JSON.stringify(tokens) !== JSON.stringify(firstTokens)
    );

    if (conflicts.length === 0) {
      console.log('🗄️ All storage mechanisms have consistent tokens');
      return firstTokens;
    }

    // Resolve conflicts using priority order
    this.metrics.conflicts++;
    console.warn(
      `⚠️ Storage conflict detected between: ${validTokens.map(v => v.source).join(', ')}`
    );

    const resolvedTokens = this.selectBestTokens(validTokens);

    // Update all storage mechanisms with the resolved tokens
    await this.synchronizeStorage(resolvedTokens);

    this.logOperation(
      'resolveConflict',
      'warning',
      `Conflict resolved, selected tokens from priority source`
    );

    return resolvedTokens;
  }

  /**
   * Select the best tokens from conflicting sources based on priority
   */
  private selectBestTokens(tokenSources: { source: string; tokens: AuthTokens }[]): AuthTokens {
    // Priority order: SecureStore > localStorage > AsyncStorage
    const priorityOrder = ['secureStore', 'localStorage', 'asyncStorage'];

    for (const priority of priorityOrder) {
      const found = tokenSources.find(({ source }) => source === priority);
      if (found) {
        console.log(`🗄️ Selected tokens from priority source: ${priority}`);
        return found.tokens;
      }
    }

    // Fallback to most recent tokens (if we can determine that)
    console.log('🗄️ Using fallback token selection');
    return tokenSources[0].tokens;
  }

  /**
   * Synchronize all storage mechanisms with the resolved tokens
   */
  private async synchronizeStorage(tokens: AuthTokens): Promise<void> {
    console.log('🔄 Synchronizing all storage mechanisms...');

    try {
      await this.storeTokens(tokens);
      console.log('✅ Storage synchronization completed');
    } catch (error) {
      console.error('❌ Storage synchronization failed:', error);
      this.logOperation(
        'synchronizeStorage',
        'error',
        `Synchronization failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Perform periodic consistency checks
   */
  private startPeriodicConsistencyCheck(): void {
    // Check consistency every 5 minutes
    this.consistencyCheckInterval = setInterval(
      () => {
        this.performConsistencyCheck().catch(error => {
          console.error('Periodic consistency check failed:', error);
        });
      },
      5 * 60 * 1000
    );
  }

  private async performInitialConsistencyCheck(): Promise<void> {
    console.log('🔍 Performing initial storage consistency check...');
    await this.performConsistencyCheck();
  }

  private async performConsistencyCheck(): Promise<void> {
    this.metrics.lastConsistencyCheck = Date.now();

    try {
      const tokens = await this.retrieveTokens();
      // The retrieve process already handles conflict resolution

      this.logOperation('consistencyCheck', 'success', 'Consistency check completed');
    } catch (error) {
      this.logOperation(
        'consistencyCheck',
        'error',
        `Consistency check failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get storage health status
   */
  public async getStorageHealth(): Promise<StorageHealthCheck> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check storage availability
    const availableCount = [
      this.metrics.secureStoreAvailable,
      this.metrics.asyncStorageAvailable,
      this.metrics.webStorageAvailable,
    ].filter(Boolean).length;

    if (availableCount === 0) {
      status = 'critical';
      issues.push('No storage mechanisms available');
      recommendations.push('Check device storage permissions and available disk space');
    } else if (availableCount === 1) {
      status = 'warning';
      issues.push('Only one storage mechanism available');
      recommendations.push('Enable additional storage mechanisms for redundancy');
    }

    // Check conflict rate
    const conflictRate =
      this.metrics.totalOperations > 0 ? this.metrics.conflicts / this.metrics.totalOperations : 0;

    if (conflictRate > 0.1) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`High conflict rate: ${Math.round(conflictRate * 100)}%`);
      recommendations.push('Check for storage inconsistencies and consider clearing cache');
    }

    // Check recent errors
    const recentErrors = this.consistencyLog.filter(
      log => log.status === 'error' && Date.now() - log.timestamp < 60000
    ).length;

    if (recentErrors > 0) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`${recentErrors} recent storage errors`);
      recommendations.push('Check device storage health and app permissions');
    }

    return {
      status,
      issues,
      recommendations,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Storage utilities
   */
  private getActiveStorageMechanisms(): string[] {
    const active: string[] = [];

    if (this.metrics.secureStoreAvailable) active.push('SecureStore');
    if (this.metrics.asyncStorageAvailable) active.push('AsyncStorage');
    if (this.metrics.webStorageAvailable) active.push('localStorage');

    return active;
  }

  private async storeMetadata(metadata: any): Promise<void> {
    try {
      if (this.metrics.asyncStorageAvailable) {
        await AsyncStorage.setItem(this.STORAGE_KEYS.STORAGE_METADATA, JSON.stringify(metadata));
      }
    } catch (error) {
      console.warn('Failed to store metadata:', error);
    }
  }

  private async loadMetrics(): Promise<void> {
    try {
      if (this.metrics.asyncStorageAvailable) {
        const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.STORAGE_METADATA);
        if (stored) {
          const metadata = JSON.parse(stored);
          // Merge stored metrics while preserving current availability status
          this.metrics = {
            ...this.metrics,
            conflicts: metadata.conflicts || 0,
            totalOperations: metadata.totalOperations || 0,
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load stored metrics:', error);
    }
  }

  private logOperation(
    operation: string,
    status: 'success' | 'warning' | 'error',
    details: string
  ): void {
    const logEntry = {
      timestamp: Date.now(),
      operation,
      status,
      details,
    };

    this.consistencyLog.push(logEntry);

    // Trim log to max size
    if (this.consistencyLog.length > this.maxLogSize) {
      this.consistencyLog = this.consistencyLog.slice(-this.maxLogSize);
    }

    // Persist log
    this.persistConsistencyLog();
  }

  private async persistConsistencyLog(): Promise<void> {
    try {
      if (this.metrics.asyncStorageAvailable) {
        await AsyncStorage.setItem(
          this.STORAGE_KEYS.CONSISTENCY_LOG,
          JSON.stringify(this.consistencyLog.slice(-50)) // Keep last 50 entries
        );
      }
    } catch (error) {
      console.warn('Failed to persist consistency log:', error);
    }
  }

  /**
   * Debug utilities
   */
  public debugStorage(): void {
    console.log('🗄️ StorageConsistencyManager Debug:', {
      metrics: this.metrics,
      activeStorage: this.getActiveStorageMechanisms(),
      recentLog: this.consistencyLog.slice(-10),
    });
  }

  public getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  public getConsistencyLog(): typeof this.consistencyLog {
    return [...this.consistencyLog];
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    console.log('🧹 StorageConsistencyManager destroying...');

    if (this.consistencyCheckInterval) {
      clearInterval(this.consistencyCheckInterval);
      this.consistencyCheckInterval = null;
    }

    this.consistencyLog.length = 0;
    StorageConsistencyManager.instance = null;
  }
}

export default StorageConsistencyManager;
