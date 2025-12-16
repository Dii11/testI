import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * AsyncStorage Health Check Utility
 * 
 * Detects and recovers from corrupted AsyncStorage on Android devices.
 * Critical for preventing splash screen freeze caused by storage issues.
 */

interface HealthCheckResult {
  isHealthy: boolean;
  canRead: boolean;
  canWrite: boolean;
  errors: string[];
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
}

const HEALTH_CHECK_KEY = '@hopmed_health_check';
const HEALTH_CHECK_VALUE = 'health_check_ok';
const HEALTH_CHECK_TIMEOUT = 3000; // 3 seconds max for health check

/**
 * Performs a quick health check on AsyncStorage
 * Tests read/write capabilities with timeout protection
 */
export async function checkAsyncStorageHealth(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    isHealthy: false,
    canRead: false,
    canWrite: false,
    errors: [],
    recoveryAttempted: false,
    recoverySuccessful: false,
  };

  console.log('🏥 Starting AsyncStorage health check...');

  // Test write capability
  try {
    const writePromise = AsyncStorage.setItem(HEALTH_CHECK_KEY, HEALTH_CHECK_VALUE);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Write timeout')), HEALTH_CHECK_TIMEOUT)
    );

    await Promise.race([writePromise, timeoutPromise]);
    result.canWrite = true;
    console.log('✅ AsyncStorage write: OK');
  } catch (error) {
    result.errors.push(`Write failed: ${error}`);
    console.error('❌ AsyncStorage write: FAILED', error);
  }

  // Test read capability
  try {
    const readPromise = AsyncStorage.getItem(HEALTH_CHECK_KEY);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Read timeout')), HEALTH_CHECK_TIMEOUT)
    );

    const value = await Promise.race([readPromise, timeoutPromise]);
    
    if (value === HEALTH_CHECK_VALUE) {
      result.canRead = true;
      console.log('✅ AsyncStorage read: OK');
    } else {
      result.errors.push(`Read mismatch: expected "${HEALTH_CHECK_VALUE}", got "${value}"`);
      console.error('❌ AsyncStorage read: MISMATCH');
    }
  } catch (error) {
    result.errors.push(`Read failed: ${error}`);
    console.error('❌ AsyncStorage read: FAILED', error);
  }

  // Cleanup health check key
  try {
    await AsyncStorage.removeItem(HEALTH_CHECK_KEY);
  } catch (error) {
    console.warn('⚠️ Failed to cleanup health check key (non-critical):', error);
  }

  result.isHealthy = result.canRead && result.canWrite;

  if (!result.isHealthy) {
    console.error('💔 AsyncStorage is unhealthy:', result.errors);
  } else {
    console.log('✅ AsyncStorage health check: PASSED');
  }

  return result;
}

/**
 * Attempts to recover corrupted AsyncStorage
 * WARNING: This clears ALL app data - only use as last resort
 */
export async function recoverAsyncStorage(): Promise<boolean> {
  console.warn('🔧 Attempting AsyncStorage recovery...');
  console.warn('   This will clear all stored app data!');

  try {
    // Try to clear all keys
    const clearPromise = AsyncStorage.clear();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Clear timeout')), HEALTH_CHECK_TIMEOUT)
    );

    await Promise.race([clearPromise, timeoutPromise]);
    console.log('✅ AsyncStorage cleared');

    // Verify it's working now
    const healthCheck = await checkAsyncStorageHealth();
    
    if (healthCheck.isHealthy) {
      console.log('✅ AsyncStorage recovery: SUCCESSFUL');
      return true;
    } else {
      console.error('❌ AsyncStorage recovery: FAILED - storage still unhealthy');
      return false;
    }
  } catch (error) {
    console.error('❌ AsyncStorage recovery: FAILED', error);
    return false;
  }
}

/**
 * Safe AsyncStorage wrapper with automatic health check and recovery
 * Use this for critical storage operations during app initialization
 */
export async function safeAsyncStorageOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  shouldAttemptRecovery: boolean = false
): Promise<{ success: boolean; data?: T; error?: string }> {
  console.log(`🛡️ Safe storage operation: ${operationName}`);

  try {
    // Add timeout to operation
    const operationPromise = operation();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timeout`)), HEALTH_CHECK_TIMEOUT)
    );

    const data = await Promise.race([operationPromise, timeoutPromise]) as T;
    console.log(`✅ ${operationName}: SUCCESS`);
    
    return { success: true, data };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${operationName}: FAILED -`, errorMsg);

    // Attempt recovery if enabled
    if (shouldAttemptRecovery && Platform.OS === 'android') {
      console.warn('🔧 Attempting automatic recovery...');
      const recovered = await recoverAsyncStorage();
      
      if (recovered) {
        // Try operation again after recovery
        try {
          const data = await operation();
          console.log(`✅ ${operationName}: SUCCESS (after recovery)`);
          return { success: true, data };
        } catch (retryError) {
          const retryErrorMsg = retryError instanceof Error ? retryError.message : String(retryError);
          return { success: false, error: `Recovery failed: ${retryErrorMsg}` };
        }
      }
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Gets critical metrics about AsyncStorage performance
 * Useful for debugging and monitoring
 */
export async function getAsyncStorageMetrics(): Promise<{
  totalKeys: number;
  estimatedSize: number;
  healthScore: number;
  warnings: string[];
}> {
  const metrics = {
    totalKeys: 0,
    estimatedSize: 0,
    healthScore: 100,
    warnings: [] as string[],
  };

  try {
    // Get all keys
    const keys = await AsyncStorage.getAllKeys();
    metrics.totalKeys = keys.length;

    // Estimate size (rough approximation)
    if (keys.length > 0) {
      const sampleSize = Math.min(10, keys.length);
      const sampleKeys = keys.slice(0, sampleSize);
      
      let totalSampleSize = 0;
      for (const key of sampleKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSampleSize += value.length;
        }
      }
      
      // Extrapolate to estimate total size
      metrics.estimatedSize = Math.round((totalSampleSize / sampleSize) * keys.length);
    }

    // Health score based on metrics
    if (metrics.totalKeys > 1000) {
      metrics.healthScore -= 20;
      metrics.warnings.push('High key count (>1000) may impact performance');
    }

    if (metrics.estimatedSize > 5 * 1024 * 1024) { // 5MB
      metrics.healthScore -= 30;
      metrics.warnings.push('Large storage size (>5MB) may cause issues');
    }

    console.log('📊 AsyncStorage metrics:', metrics);
  } catch (error) {
    console.error('❌ Failed to get AsyncStorage metrics:', error);
    metrics.healthScore = 0;
    metrics.warnings.push('Failed to retrieve metrics');
  }

  return metrics;
}
