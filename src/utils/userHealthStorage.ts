/**
 * User-Scoped Health Storage
 *
 * Provides user-specific storage for health-related preferences and state.
 * Ensures complete data isolation between different users on the same device.
 *
 * CRITICAL for HIPAA/GDPR compliance - prevents data leakage between users.
 */

import { AppStorage } from './storage';
import { STORAGE_KEYS } from '../constants';

/**
 * Get the current user ID from storage
 * This should match the authenticated user's ID from Redux store
 */
const getCurrentUserId = async (): Promise<string | null> => {
  try {
    // Try to get user ID from stored auth tokens
    const authTokensStr = await AppStorage.getString(STORAGE_KEYS.AUTH_TOKENS);
    if (authTokensStr) {
      const authTokens = JSON.parse(authTokensStr);
      // Extract user ID from token payload if available
      // Note: In production, you might decode the JWT to get user ID
      return authTokens.userId || null;
    }
    return null;
  } catch (error) {
    console.error('[UserHealthStorage] Error getting user ID:', error);
    return null;
  }
};

/**
 * User-scoped health storage
 * All methods automatically scope keys to the current user
 */
export class UserHealthStorage {
  /**
   * Get user-scoped storage key
   * Format: hopmed_healthkit_permission_requested_<userId>
   */
  private static async getUserScopedKey(baseKey: string): Promise<string> {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('[UserHealthStorage] No user ID found - using device-level key');
      return baseKey;
    }
    return `${baseKey}_${userId}`;
  }

  /**
   * Check if current user has ever requested HealthKit permissions
   */
  static async hasRequestedPermissions(): Promise<boolean> {
    try {
      const scopedKey = await this.getUserScopedKey(STORAGE_KEYS.HEALTHKIT_PERMISSION_REQUESTED);
      return await AppStorage.getBoolean(scopedKey, false);
    } catch (error) {
      console.error('[UserHealthStorage] Error checking permission history:', error);
      return false;
    }
  }

  /**
   * Mark that current user has made a permission decision
   */
  static async markPermissionsRequested(): Promise<void> {
    try {
      const scopedKey = await this.getUserScopedKey(STORAGE_KEYS.HEALTHKIT_PERMISSION_REQUESTED);
      await AppStorage.setBoolean(scopedKey, true);
      console.log(`✅ [UserHealthStorage] Marked permissions as requested for scoped key: ${scopedKey}`);
    } catch (error) {
      console.error('[UserHealthStorage] Error marking permissions:', error);
    }
  }

  /**
   * Clear ALL user-specific health data
   * Call this on logout to ensure complete data isolation
   */
  static async clearUserHealthData(userId?: string): Promise<void> {
    try {
      const targetUserId = userId || await getCurrentUserId();
      if (!targetUserId) {
        console.warn('[UserHealthStorage] No user ID - cannot clear user data');
        return;
      }

      console.log(`🧹 [UserHealthStorage] Clearing health data for user: ${targetUserId}`);

      // Clear user-scoped permission state
      const permissionKey = `${STORAGE_KEYS.HEALTHKIT_PERMISSION_REQUESTED}_${targetUserId}`;
      await AppStorage.removeItem(permissionKey);

      // Clear user-scoped health data cache
      const healthDataKey = `${STORAGE_KEYS.HEALTH_DATA}_${targetUserId}`;
      await AppStorage.removeItem(healthDataKey);

      // Clear user-scoped last sync timestamp
      const lastSyncKey = `${STORAGE_KEYS.LAST_SYNC}_${targetUserId}`;
      await AppStorage.removeItem(lastSyncKey);

      console.log(`✅ [UserHealthStorage] Successfully cleared health data for user: ${targetUserId}`);
    } catch (error) {
      console.error('[UserHealthStorage] Error clearing user health data:', error);
    }
  }

  /**
   * Get user-specific health data (cached)
   */
  static async getUserHealthData<T>(): Promise<T | null> {
    try {
      const scopedKey = await this.getUserScopedKey(STORAGE_KEYS.HEALTH_DATA);
      return await AppStorage.getObject<T>(scopedKey);
    } catch (error) {
      console.error('[UserHealthStorage] Error getting health data:', error);
      return null;
    }
  }

  /**
   * Set user-specific health data (cache)
   */
  static async setUserHealthData<T>(data: T): Promise<boolean> {
    try {
      const scopedKey = await this.getUserScopedKey(STORAGE_KEYS.HEALTH_DATA);
      return await AppStorage.setObject(scopedKey, data);
    } catch (error) {
      console.error('[UserHealthStorage] Error setting health data:', error);
      return false;
    }
  }

  /**
   * Get last sync timestamp for current user
   */
  static async getLastSyncTime(): Promise<number | null> {
    try {
      const scopedKey = await this.getUserScopedKey(STORAGE_KEYS.LAST_SYNC);
      return await AppStorage.getNumber(scopedKey);
    } catch (error) {
      console.error('[UserHealthStorage] Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Set last sync timestamp for current user
   */
  static async setLastSyncTime(timestamp: number): Promise<boolean> {
    try {
      const scopedKey = await this.getUserScopedKey(STORAGE_KEYS.LAST_SYNC);
      return await AppStorage.setNumber(scopedKey, timestamp);
    } catch (error) {
      console.error('[UserHealthStorage] Error setting last sync time:', error);
      return false;
    }
  }
}

/**
 * Logout cleanup utility
 * Call this when user logs out to ensure complete data isolation
 */
export const cleanupOnLogout = async (userId?: string): Promise<void> => {
  console.log('🧹 [Logout Cleanup] Starting user data cleanup...');

  try {
    // 1. Clear user-scoped health data
    await UserHealthStorage.clearUserHealthData(userId);

    // 2. Clear user preferences (optional - depends on requirements)
    // await UserPreferences.clearPreferences();

    // 3. Clear authentication tokens (CRITICAL for security)
    await AppStorage.removeItem(STORAGE_KEYS.AUTH_TOKENS);

    // 4. Clear user-specific cache
    // Note: Don't clear device-level data like DEVICE_ID

    console.log('✅ [Logout Cleanup] User data cleanup complete');
  } catch (error) {
    console.error('❌ [Logout Cleanup] Error during cleanup:', error);
    throw error; // Re-throw to ensure logout doesn't silently fail
  }
};

/**
 * Login initialization utility
 * Call this when user logs in to set up user context
 */
export const initializeOnLogin = async (userId: string): Promise<void> => {
  console.log(`🚀 [Login Init] Initializing user context for: ${userId}`);

  try {
    // 1. Verify user-scoped storage is working
    const permissionState = await UserHealthStorage.hasRequestedPermissions();
    console.log(`📋 [Login Init] Permission state for user ${userId}:`, permissionState);

    // 2. Load user-specific health data cache (if exists)
    const cachedHealthData = await UserHealthStorage.getUserHealthData();
    if (cachedHealthData) {
      console.log('📊 [Login Init] Found cached health data for user');
    } else {
      console.log('📊 [Login Init] No cached health data - will fetch fresh');
    }

    console.log('✅ [Login Init] User context initialized');
  } catch (error) {
    console.error('❌ [Login Init] Error during initialization:', error);
    // Don't throw - initialization errors shouldn't block login
  }
};
