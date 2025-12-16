/**
 * Advanced Health Data Cache
 *
 * Implements smart caching with data-type-specific TTLs,
 * cache invalidation strategies, and performance optimization
 */

import { Platform } from 'react-native';

import { HealthDataType } from '../../types/health';
import { sentryTracker } from '../../utils/sentryErrorTracker';

import type { UnifiedHealthResponse } from './WearableHealthManager';

export interface CacheEntry {
  data: UnifiedHealthResponse;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  dataIntegrity: number; // 0-1 score
  platform: string;
  memorySize: number; // Estimated memory usage in bytes
  isPaginated: boolean;
  pageInfo?: {
    totalPages: number;
    currentPage: number;
    hasMore: boolean;
  };
}

export interface CacheConfiguration {
  maxSize: number;
  defaultTTL: number;
  enableCompression: boolean;
  autoCleanupInterval: number;
  enablePagination: boolean;
  maxEntriesPerPage: number;
  maxMemoryUsageMB: number;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalSize: number;
  oldestEntry?: number;
  newestEntry?: number;
}

export class AdvancedHealthCache {
  private cache = new Map<string, CacheEntry>();
  private hitCount = 0;
  private missCount = 0;
  private cleanupTimer?: NodeJS.Timeout;

  private readonly config: CacheConfiguration = {
    maxSize: 500, // Reduced for memory optimization
    defaultTTL: 5 * 60 * 1000, // 5 minutes default
    enableCompression: false, // Disabled for now, could implement later
    autoCleanupInterval: 10 * 60 * 1000, // 10 minutes
    enablePagination: true,
    maxEntriesPerPage: 50, // Paginate large datasets
    maxMemoryUsageMB: 20, // 20MB memory limit
  };

  // Data-type specific TTLs optimized for health data patterns
  private readonly TTL_BY_DATA_TYPE: Record<HealthDataType, number> = {
    [HealthDataType.STEPS]: 2 * 60 * 1000, // 2 minutes - frequently updated
    [HealthDataType.HEART_RATE]: 1 * 60 * 1000, // 1 minute - real-time data
    [HealthDataType.SLEEP]: 60 * 60 * 1000, // 1 hour - daily data
    [HealthDataType.WEIGHT]: 24 * 60 * 60 * 1000, // 24 hours - rarely changes
    [HealthDataType.BLOOD_PRESSURE]: 30 * 60 * 1000, // 30 minutes - medical data
    [HealthDataType.OXYGEN_SATURATION]: 5 * 60 * 1000, // 5 minutes - health monitoring
    [HealthDataType.BODY_TEMPERATURE]: 15 * 60 * 1000, // 15 minutes - health monitoring
    [HealthDataType.BLOOD_GLUCOSE]: 10 * 60 * 1000, // 10 minutes - medical monitoring
    [HealthDataType.CALORIES_BURNED]: 5 * 60 * 1000, // 5 minutes - activity data
    [HealthDataType.ACTIVE_ENERGY]: 5 * 60 * 1000, // 5 minutes - activity data
    [HealthDataType.DISTANCE]: 5 * 60 * 1000, // 5 minutes - activity data
    [HealthDataType.EXERCISE]: 30 * 60 * 1000, // 30 minutes - session data
    [HealthDataType.RESTING_HEART_RATE]: 60 * 60 * 1000, // 1 hour - daily metric
    [HealthDataType.RESPIRATORY_RATE]: 15 * 60 * 1000, // 15 minutes - health monitoring
  };

  constructor() {
    this.startAutoCleanup();
  }

  /**
   * Get cached data with intelligent expiration checks
   */
  getCached(key: string, dataType: HealthDataType): UnifiedHealthResponse | null {
    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.missCount++;
        return null;
      }

      const now = Date.now();

      // Check if entry has expired
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.missCount++;
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = now;

      this.hitCount++;

      console.log(`💾 Cache hit for ${dataType}: ${key}`);

      return {
        ...entry.data,
        cached: true,
        metadata: {
          ...entry.data.metadata,
          cacheAge: now - entry.timestamp,
          accessCount: entry.accessCount,
        },
      };
    } catch (error) {
      console.error('💾 Cache retrieval error:', error);
      sentryTracker.trackServiceError(error instanceof Error ? error : 'Cache retrieval failed', {
        service: 'healthDataCache',
        action: 'getCached',
        additional: { key, dataType },
      });
      return null;
    }
  }

  /**
   * Cache data with smart expiration and integrity tracking
   */
  setCached(key: string, data: UnifiedHealthResponse, dataType: HealthDataType): void {
    try {
      const now = Date.now();
      const ttl = this.getTTL(dataType, data);

      // Calculate data integrity score and memory usage
      const dataIntegrity = this.calculateDataIntegrity(data);
      const memorySize = this.estimateMemoryUsage(data);

      const entry: CacheEntry = {
        data: { ...data },
        timestamp: now,
        expiresAt: now + ttl,
        accessCount: 0,
        lastAccessed: now,
        dataIntegrity,
        platform: Platform.OS,
        memorySize,
        isPaginated: false,
      };

      // Check cache size and evict if necessary
      if (this.cache.size >= this.config.maxSize) {
        this.evictLeastRecentlyUsed();
      }

      this.cache.set(key, entry);

      // Check memory usage after adding entry
      if (this.checkMemoryUsage()) {
        this.performMemoryOptimization();
      }

      console.log(
        `💾 Cached ${dataType}: ${key} (TTL: ${ttl}ms, Size: ${(memorySize / 1024).toFixed(1)}KB, Integrity: ${dataIntegrity.toFixed(2)})`
      );
    } catch (error) {
      console.error('💾 Cache storage error:', error);
      sentryTracker.trackServiceError(error instanceof Error ? error : 'Cache storage failed', {
        service: 'healthDataCache',
        action: 'setCached',
        additional: { key, dataType },
      });
    }
  }

  /**
   * Cache with pagination for large datasets
   */
  setCachedWithPagination(
    key: string,
    data: UnifiedHealthResponse,
    dataType: HealthDataType,
    page: number = 1
  ): void {
    try {
      const paginatedData = this.paginateHealthData(data, page);
      const memorySize = this.estimateMemoryUsage(paginatedData);

      // Skip caching if entry is too large
      if (memorySize > (this.config.maxMemoryUsageMB * 1024 * 1024) / 10) {
        console.warn('⚠️ Health data entry too large for cache:', memorySize / 1024, 'KB');
        return;
      }

      const ttl = this.getTTL(dataType, paginatedData);
      const now = Date.now();

      const entry: CacheEntry = {
        data: paginatedData,
        timestamp: now,
        expiresAt: now + ttl,
        accessCount: 0,
        lastAccessed: now,
        dataIntegrity: this.calculateDataIntegrity(paginatedData),
        platform: Platform.OS,
        memorySize,
        isPaginated: data.data ? data.data.length > this.config.maxEntriesPerPage : false,
        pageInfo: paginatedData.metadata.pagination
          ? {
              totalPages: paginatedData.metadata.pagination.totalPages,
              currentPage: page,
              hasMore: paginatedData.metadata.pagination.hasMore,
            }
          : undefined,
      };

      this.cache.set(`${key}_page_${page}`, entry);

      // Memory optimization check
      if (this.checkMemoryUsage()) {
        this.performMemoryOptimization();
      }

      console.log(
        `💾 Cached paginated ${dataType}: ${key} page ${page} (Size: ${(memorySize / 1024).toFixed(1)}KB)`
      );
    } catch (error) {
      console.error('❌ Failed to cache health data with pagination:', error);
    }
  }

  /**
   * Get TTL based on data type and data quality
   */
  private getTTL(dataType: HealthDataType, data: UnifiedHealthResponse): number {
    let baseTTL = this.TTL_BY_DATA_TYPE[dataType] || this.config.defaultTTL;

    // Adjust TTL based on data quality
    if (data.metadata.dataQuality === 'high') {
      baseTTL *= 1.5; // Keep high-quality data longer
    } else if (data.metadata.dataQuality === 'low') {
      baseTTL *= 0.5; // Expire low-quality data faster
    }

    // Adjust TTL based on data freshness
    if (data.metadata.fetchTime) {
      const age = Date.now() - data.metadata.fetchTime;
      if (age > 60 * 60 * 1000) {
        // Data older than 1 hour
        baseTTL *= 0.3; // Expire faster
      }
    }

    // Ensure minimum and maximum TTL bounds
    const minTTL = 30 * 1000; // 30 seconds minimum
    const maxTTL = 24 * 60 * 60 * 1000; // 24 hours maximum

    return Math.max(minTTL, Math.min(maxTTL, baseTTL));
  }

  /**
   * Calculate data integrity score
   */
  private calculateDataIntegrity(data: UnifiedHealthResponse): number {
    let score = 0.5; // Base score

    // Success status
    if (data.success) score += 0.2;

    // Data availability
    if (data.data && data.data.length > 0) score += 0.1;

    // Provider reliability
    if (data.provider && data.provider !== 'failed') score += 0.1;

    // Error count
    if (!data.errors || data.errors.length === 0) score += 0.1;

    // Data quality from metadata
    if (data.metadata.dataQuality === 'high') score += 0.1;
    else if (data.metadata.dataQuality === 'medium') score += 0.05;

    return Math.min(score, 1.0);
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`💾 Evicted LRU entry: ${oldestKey}`);
    }
  }

  /**
   * Clear cache for specific data type or all
   */
  clearCache(dataType?: HealthDataType): void {
    if (dataType != null) {
      // Clear cache entries for specific data type
      const keysToDelete: string[] = [];

      for (const key of this.cache.keys()) {
        if (key.includes(dataType)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`💾 Cleared cache for ${dataType}: ${keysToDelete.length} entries`);
    } else {
      // Clear all cache
      const count = this.cache.size;
      this.cache.clear();
      this.hitCount = 0;
      this.missCount = 0;
      console.log(`💾 Cleared all cache: ${count} entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    let oldestEntry: number | undefined;
    let newestEntry: number | undefined;
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.data).length;

      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }

      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    return {
      totalEntries: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      totalHits: this.hitCount,
      totalMisses: this.missCount,
      totalSize,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Estimate memory usage of an entry
   */
  private estimateMemoryUsage(data: UnifiedHealthResponse): number {
    try {
      const jsonString = JSON.stringify(data);
      return jsonString.length * 2; // Approximate bytes (UTF-16)
    } catch {
      return 1000; // Default estimate
    }
  }

  /**
   * Check if cache exceeds memory limits
   */
  private checkMemoryUsage(): boolean {
    const totalMemory = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.memorySize,
      0
    );

    const memoryLimitBytes = this.config.maxMemoryUsageMB * 1024 * 1024;
    return totalMemory > memoryLimitBytes;
  }

  /**
   * Paginate large health datasets
   */
  paginateHealthData(data: UnifiedHealthResponse, page: number = 1): UnifiedHealthResponse {
    if (
      !this.config.enablePagination ||
      !data.data ||
      data.data.length <= this.config.maxEntriesPerPage
    ) {
      return data;
    }

    const startIndex = (page - 1) * this.config.maxEntriesPerPage;
    const endIndex = startIndex + this.config.maxEntriesPerPage;
    const paginatedData = data.data.slice(startIndex, endIndex);

    const totalPages = Math.ceil(data.data.length / this.config.maxEntriesPerPage);

    return {
      ...data,
      data: paginatedData,
      metadata: {
        ...data.metadata,
        pagination: {
          currentPage: page,
          totalPages,
          totalEntries: data.data.length,
          hasMore: page < totalPages,
          entriesPerPage: this.config.maxEntriesPerPage,
        },
      },
    };
  }

  /**
   * Perform aggressive memory optimization
   */
  private performMemoryOptimization(): void {
    console.log('🔄 Performing memory optimization on health cache');

    const entries = Array.from(this.cache.entries()).sort((a, b) => {
      const scoreA = a[1].accessCount / (a[1].memorySize / 1000);
      const scoreB = b[1].accessCount / (b[1].memorySize / 1000);
      return scoreA - scoreB;
    });

    const entriesToRemove = Math.floor(entries.length * 0.3);
    for (let i = 0; i < entriesToRemove; i++) {
      this.cache.delete(entries[i][0]);
    }

    console.log(`🗑️ Removed ${entriesToRemove} entries for memory optimization`);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`💾 Cleaned up ${keysToDelete.length} expired cache entries`);
    }

    // Check memory usage after cleanup
    if (this.checkMemoryUsage()) {
      this.performMemoryOptimization();
    }
  }

  /**
   * Start automatic cleanup process
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.autoCleanupInterval);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Invalidate cache entries based on conditions
   */
  invalidateStaleData(maxAge: number = 60 * 60 * 1000): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > maxAge || entry.dataIntegrity < 0.5) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`💾 Invalidated ${keysToDelete.length} stale cache entries`);
    }
  }

  /**
   * Pre-warm cache with commonly requested data
   */
  async preWarm(
    commonDataTypes: HealthDataType[],
    fetchFunction: (dataType: HealthDataType) => Promise<UnifiedHealthResponse>
  ): Promise<void> {
    console.log('💾 Pre-warming cache...');

    const promises = commonDataTypes.map(async dataType => {
      try {
        const data = await fetchFunction(dataType);
        const key = `prewarm_${dataType}_${Date.now()}`;
        this.setCached(key, data, dataType);
      } catch (error) {
        console.warn(`💾 Pre-warm failed for ${dataType}:`, error);
      }
    });

    await Promise.allSettled(promises);
    console.log('💾 Cache pre-warming completed');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clearCache();
    console.log('💾 Health data cache destroyed');
  }
}

// Export singleton instance
export const healthDataCache = new AdvancedHealthCache();
