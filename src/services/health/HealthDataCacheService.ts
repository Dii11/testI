/**
 * Health Data Cache Service
 *
 * Provides intelligent caching for health data with TTL, compression, and smart invalidation.
 * Optimizes performance and reduces API calls while maintaining data freshness.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { HealthMetric, HealthDataType } from '../../types/health';
import { sentryTracker } from '../../utils/sentryErrorTracker';

interface CachedHealthData {
  data: HealthMetric[];
  timestamp: number;
  ttl: number;
  version: string;
  platform: string;
  checksum?: string;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  lastCleanup: number;
  oldestEntry: number;
  newestEntry: number;
}

export class HealthDataCacheService {
  private static instance: HealthDataCacheService;
  private readonly CACHE_VERSION = '1.0';
  private readonly DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_CACHE_SIZE = 50; // Maximum number of cached entries
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  private memoryCache = new Map<string, CachedHealthData>();
  private accessCount = new Map<string, number>();
  private hitCount = 0;
  private missCount = 0;
  private lastCleanup = Date.now();

  static getInstance(): HealthDataCacheService {
    if (!HealthDataCacheService.instance) {
      HealthDataCacheService.instance = new HealthDataCacheService();
    }
    return HealthDataCacheService.instance;
  }

  /**
   * Retrieves cached health data if valid and fresh
   */
  async get(
    dataType: HealthDataType,
    startDate: Date,
    endDate: Date,
    options?: { maxAge?: number }
  ): Promise<HealthMetric[] | null> {
    const key = this.generateCacheKey(dataType, startDate, endDate);
    const maxAge = options?.maxAge || this.DEFAULT_TTL;

    try {
      // Check memory cache first
      let cached = this.memoryCache.get(key);

      // If not in memory, try persistent storage
      if (!cached) {
        cached = await this.getFromStorage(key);
        if (cached) {
          this.memoryCache.set(key, cached);
        }
      }

      // Validate cache entry
      if (cached && this.isValidCache(cached, maxAge)) {
        this.recordHit(key);
        console.log(`🏥 Health cache hit for ${dataType} (${cached.data.length} metrics)`);
        return cached.data;
      }

      // Cache miss or invalid
      this.recordMiss(key);
      if (cached) {
        console.log(
          `🏥 Health cache expired for ${dataType} (age: ${Date.now() - cached.timestamp}ms)`
        );
      }

      return null;
    } catch (error) {
      console.warn('🏥 Health cache retrieval failed:', error);
      this.recordMiss(key);
      return null;
    }
  }

  /**
   * Stores health data in cache with compression and validation
   */
  async set(
    dataType: HealthDataType,
    startDate: Date,
    endDate: Date,
    data: HealthMetric[],
    options?: { ttl?: number }
  ): Promise<boolean> {
    const key = this.generateCacheKey(dataType, startDate, endDate);
    const ttl = options?.ttl || this.DEFAULT_TTL;

    try {
      const cached: CachedHealthData = {
        data: this.compressData(data),
        timestamp: Date.now(),
        ttl,
        version: this.CACHE_VERSION,
        platform: Platform.OS,
        checksum: this.generateChecksum(data),
      };

      // Store in memory cache
      this.memoryCache.set(key, cached);

      // Store in persistent storage (async, non-blocking)
      this.setInStorage(key, cached).catch(error => {
        console.warn('🏥 Health cache storage failed:', error);
      });

      console.log(`🏥 Health data cached for ${dataType} (${data.length} metrics, TTL: ${ttl}ms)`);

      // Trigger cleanup if needed
      this.maybeCleanup();

      return true;
    } catch (error) {
      console.warn('🏥 Health cache storage failed:', error);
      sentryTracker.trackServiceError(error instanceof Error ? error : 'Cache storage failed', {
        service: 'healthDataCache',
        action: 'set',
        additional: { dataType, dataLength: data.length },
      });
      return false;
    }
  }

  /**
   * Invalidates cache entries matching criteria
   */
  async invalidate(dataType?: HealthDataType, olderThan?: Date): Promise<number> {
    let invalidatedCount = 0;

    try {
      const keysToInvalidate: string[] = [];

      this.memoryCache.forEach((cached, key) => {
        const shouldInvalidate =
          (dataType == null || key.includes(dataType)) &&
          (!olderThan || cached.timestamp < olderThan.getTime());

        if (shouldInvalidate) {
          keysToInvalidate.push(key);
        }
      });

      // Remove from memory cache
      keysToInvalidate.forEach(key => {
        this.memoryCache.delete(key);
        this.accessCount.delete(key);
        invalidatedCount++;
      });

      // Remove from persistent storage
      if (keysToInvalidate.length > 0) {
        await Promise.all(
          keysToInvalidate.map(key =>
            AsyncStorage.removeItem(this.getStorageKey(key)).catch(() => {})
          )
        );
      }

      if (invalidatedCount > 0) {
        console.log(`🏥 Invalidated ${invalidatedCount} health cache entries`);
      }

      return invalidatedCount;
    } catch (error) {
      console.warn('🏥 Health cache invalidation failed:', error);
      return 0;
    }
  }

  /**
   * Gets current cache statistics
   */
  getCacheStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const entries = Array.from(this.memoryCache.values());

    return {
      totalEntries: this.memoryCache.size,
      totalSize: this.calculateCacheSize(),
      hitRate: totalRequests > 0 ? this.hitCount / totalRequests : 0,
      lastCleanup: this.lastCleanup,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0,
    };
  }

  /**
   * Clears all cache data
   */
  async clearAll(): Promise<boolean> {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      this.accessCount.clear();
      this.hitCount = 0;
      this.missCount = 0;

      // Clear persistent storage
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('health_cache_'));

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }

      console.log(`🏥 Cleared all health cache data (${cacheKeys.length} storage entries)`);
      return true;
    } catch (error) {
      console.warn('🏥 Health cache clear failed:', error);
      return false;
    }
  }

  private generateCacheKey(dataType: HealthDataType, startDate: Date, endDate: Date): string {
    const start = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const end = endDate.toISOString().split('T')[0];
    return `${dataType}_${start}_${end}`;
  }

  private getStorageKey(cacheKey: string): string {
    return `health_cache_${cacheKey}`;
  }

  private async getFromStorage(key: string): Promise<CachedHealthData | null> {
    try {
      const stored = await AsyncStorage.getItem(this.getStorageKey(key));
      if (!stored) return null;

      const cached: CachedHealthData = JSON.parse(stored);

      // Validate version and platform compatibility
      if (cached.version !== this.CACHE_VERSION) {
        await AsyncStorage.removeItem(this.getStorageKey(key));
        return null;
      }

      // Decompress data
      cached.data = this.decompressData(cached.data);

      return cached;
    } catch (error) {
      console.warn('🏥 Health cache storage retrieval failed:', error);
      return null;
    }
  }

  private async setInStorage(key: string, cached: CachedHealthData): Promise<void> {
    try {
      const serialized = JSON.stringify(cached);
      await AsyncStorage.setItem(this.getStorageKey(key), serialized);
    } catch (error) {
      console.warn('🏥 Health cache storage write failed:', error);
      throw error;
    }
  }

  private isValidCache(cached: CachedHealthData, maxAge: number): boolean {
    const age = Date.now() - cached.timestamp;
    return age < Math.min(cached.ttl, maxAge) && cached.version === this.CACHE_VERSION;
  }

  private compressData(data: HealthMetric[]): HealthMetric[] {
    // Simple compression: remove redundant metadata for cache storage
    return data.map(metric => ({
      ...metric,
      metadata: metric.metadata
        ? {
            quality: metric.metadata.quality,
            confidence: metric.metadata.confidence,
          }
        : undefined,
    }));
  }

  private decompressData(data: HealthMetric[]): HealthMetric[] {
    // Restore full structure (expand compressed data if needed)
    return data.map(metric => ({
      ...metric,
      timestamp: new Date(metric.timestamp), // Ensure Date object
    }));
  }

  private generateChecksum(data: HealthMetric[]): string {
    // Simple checksum based on data length and first/last values
    if (data.length === 0) return '0';

    const first = data[0];
    const last = data[data.length - 1];
    return `${data.length}_${first.value}_${last.value}`;
  }

  private recordHit(key: string): void {
    this.hitCount++;
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
  }

  private recordMiss(key: string): void {
    this.missCount++;
  }

  private calculateCacheSize(): number {
    let totalSize = 0;
    this.memoryCache.forEach(cached => {
      totalSize += JSON.stringify(cached).length;
    });
    return totalSize;
  }

  private maybeCleanup(): void {
    const now = Date.now();

    if (
      now - this.lastCleanup > this.CLEANUP_INTERVAL ||
      this.memoryCache.size > this.MAX_CACHE_SIZE
    ) {
      this.cleanup();
    }
  }

  private cleanup(): void {
    console.log('🏥 Starting health cache cleanup...');
    const now = Date.now();
    let cleanedUp = 0;

    // Remove expired entries
    const keysToRemove: string[] = [];
    this.memoryCache.forEach((cached, key) => {
      if (now - cached.timestamp > cached.ttl) {
        keysToRemove.push(key);
      }
    });

    // If still over limit, remove least accessed entries
    if (this.memoryCache.size - keysToRemove.length > this.MAX_CACHE_SIZE) {
      const accessEntries = Array.from(this.accessCount.entries())
        .filter(([key]) => !keysToRemove.includes(key))
        .sort((a, b) => a[1] - b[1]); // Sort by access count

      const additional = this.memoryCache.size - keysToRemove.length - this.MAX_CACHE_SIZE + 5;
      for (let i = 0; i < Math.min(additional, accessEntries.length); i++) {
        keysToRemove.push(accessEntries[i][0]);
      }
    }

    // Remove entries
    keysToRemove.forEach(key => {
      this.memoryCache.delete(key);
      this.accessCount.delete(key);
      // Remove from storage async
      AsyncStorage.removeItem(this.getStorageKey(key)).catch(() => {});
      cleanedUp++;
    });

    this.lastCleanup = now;

    if (cleanedUp > 0) {
      console.log(`🏥 Health cache cleanup completed: removed ${cleanedUp} entries`);
    }
  }
}

// Export singleton instance
export const healthDataCache = HealthDataCacheService.getInstance();
