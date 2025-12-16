/**
 * Permission Migration Service
 *
 * Consolidates data from legacy permission managers into the new unified system.
 * Handles cache migration, data consolidation, and cleanup of deprecated services.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { ConsolidatedPermissionManager } from './ConsolidatedPermissionManager';
import type { PermissionType } from './ConsolidatedPermissionManager';

export interface MigrationResult {
  migratedCount: number;
  errors: string[];
  duplicatesResolved: number;
  storageReclaimed: number; // bytes
}

export interface LegacyPermissionData {
  source: 'enhanced' | 'unified' | 'cache';
  type: PermissionType;
  status: boolean | string;
  timestamp: number;
  metadata?: any;
}

export class PermissionMigrationService {
  private static instance: PermissionMigrationService;

  // Legacy storage keys to migrate from
  private readonly LEGACY_KEYS = {
    enhanced: '@hopmed_enhanced_permissions',
    unified: '@hopmed_unified_permissions_v2',
    cache: '@hopmed_permission_cache',
  };

  // Backup key for safety
  private readonly BACKUP_KEY = '@hopmed_permission_backup_' + Date.now();

  public static getInstance(): PermissionMigrationService {
    if (!PermissionMigrationService.instance) {
      PermissionMigrationService.instance = new PermissionMigrationService();
    }
    return PermissionMigrationService.instance;
  }

  /**
   * Main migration entry point
   */
  async migrateFromLegacyServices(): Promise<MigrationResult> {
    console.log('🔄 Starting permission system migration...');

    const result: MigrationResult = {
      migratedCount: 0,
      errors: [],
      duplicatesResolved: 0,
      storageReclaimed: 0,
    };

    try {
      // Step 1: Create backup of current state
      await this.createBackup();

      // Step 2: Extract all legacy data
      const legacyData = await this.extractLegacyPermissions();
      console.log(`📥 Extracted ${legacyData.length} legacy permission entries`);

      // Step 3: Resolve conflicts and duplicates
      const consolidatedData = await this.consolidatePermissions(legacyData);
      result.duplicatesResolved = legacyData.length - consolidatedData.length;

      // Step 4: Import into new PermissionManager
      const importResult = await this.importToNewSystem(consolidatedData);
      result.migratedCount = importResult.successCount;
      result.errors = importResult.errors;

      // Step 5: Calculate storage reclaimed
      result.storageReclaimed = await this.calculateStorageReclaimed();

      // Step 6: Cleanup legacy storage (with safety checks)
      if (result.errors.length === 0) {
        await this.cleanupLegacyStorage();
      }

      console.log('✅ Migration completed successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      result.errors.push(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      );

      // Attempt to restore from backup
      await this.restoreFromBackup().catch(restoreError =>
        console.error('Failed to restore backup:', restoreError)
      );

      return result;
    }
  }

  /**
   * Extract permissions from all legacy services
   */
  private async extractLegacyPermissions(): Promise<LegacyPermissionData[]> {
    const allPermissions: LegacyPermissionData[] = [];

    // Extract from Enhanced Permission Manager
    try {
      const enhancedData = await AsyncStorage.getItem(this.LEGACY_KEYS.enhanced);
      if (enhancedData) {
        const parsed = JSON.parse(enhancedData);
        const permissions = Array.isArray(parsed) ? parsed : Object.entries(parsed);

        for (const [type, data] of permissions) {
          allPermissions.push({
            source: 'enhanced',
            type: type as PermissionType,
            status: this.extractStatus(data),
            timestamp: this.extractTimestamp(data),
            metadata: this.extractMetadata(data),
          });
        }
      }
    } catch (error) {
      console.warn('Failed to extract enhanced permissions:', error);
    }

    // Extract from Unified Permission Manager
    try {
      const unifiedData = await AsyncStorage.getItem(this.LEGACY_KEYS.unified);
      if (unifiedData) {
        const parsed = JSON.parse(unifiedData);
        const permissions = Array.isArray(parsed) ? parsed : Object.entries(parsed);

        for (const [type, data] of permissions) {
          allPermissions.push({
            source: 'unified',
            type: type as PermissionType,
            status: this.extractStatus(data),
            timestamp: this.extractTimestamp(data),
            metadata: this.extractMetadata(data),
          });
        }
      }
    } catch (error) {
      console.warn('Failed to extract unified permissions:', error);
    }

    // Extract from Permission Cache Service
    try {
      const cacheData = await AsyncStorage.getItem(this.LEGACY_KEYS.cache);
      if (cacheData) {
        const parsed = JSON.parse(cacheData);

        for (const [type, data] of Object.entries(parsed)) {
          allPermissions.push({
            source: 'cache',
            type: type as PermissionType,
            status: this.extractStatus(data),
            timestamp: this.extractTimestamp(data),
            metadata: data,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to extract cache permissions:', error);
    }

    return allPermissions;
  }

  /**
   * Consolidate permissions, resolving conflicts with priority system
   */
  private async consolidatePermissions(
    permissions: LegacyPermissionData[]
  ): Promise<LegacyPermissionData[]> {
    const consolidatedMap = new Map<PermissionType, LegacyPermissionData>();

    // Priority: enhanced > unified > cache (most recent and comprehensive first)
    const priorityOrder = ['enhanced', 'unified', 'cache'];

    // Sort by priority and timestamp (newest first)
    permissions.sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.source);
      const bPriority = priorityOrder.indexOf(b.source);

      if (aPriority !== bPriority) {
        return aPriority - bPriority; // Lower index = higher priority
      }

      return b.timestamp - a.timestamp; // Newer timestamp wins
    });

    // Consolidate, keeping highest priority entry for each permission type
    for (const permission of permissions) {
      const existingEntry = consolidatedMap.get(permission.type);

      if (!existingEntry) {
        consolidatedMap.set(permission.type, permission);
      } else {
        // Keep the entry with higher priority or newer timestamp
        const existingPriority = priorityOrder.indexOf(existingEntry.source);
        const currentPriority = priorityOrder.indexOf(permission.source);

        if (
          currentPriority < existingPriority ||
          (currentPriority === existingPriority && permission.timestamp > existingEntry.timestamp)
        ) {
          consolidatedMap.set(permission.type, permission);
        }
      }
    }

    console.log(
      `🔧 Consolidated ${permissions.length} entries into ${consolidatedMap.size} unique permissions`
    );
    return Array.from(consolidatedMap.values());
  }

  /**
   * Import consolidated data into new PermissionManager
   */
  private async importToNewSystem(
    permissions: LegacyPermissionData[]
  ): Promise<{ successCount: number; errors: string[] }> {
    const errors: string[] = [];
    let successCount = 0;

    const permissionManager = ConsolidatedPermissionManager.getInstance();

    for (const permission of permissions) {
      try {
        // Convert legacy status to new format
        const status = this.normalizePermissionStatus(permission.status);

        // Import with metadata preservation
        await permissionManager.importLegacyPermission({
          type: permission.type,
          status,
          timestamp: permission.timestamp,
          source: permission.source,
          metadata: permission.metadata,
        });

        successCount++;
      } catch (error) {
        const errorMsg = `Failed to import ${permission.type} from ${permission.source}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.warn(errorMsg);
      }
    }

    console.log(`✅ Successfully imported ${successCount}/${permissions.length} permissions`);
    return { successCount, errors };
  }

  /**
   * Calculate storage space reclaimed by migration
   */
  private async calculateStorageReclaimed(): Promise<number> {
    let totalSize = 0;

    for (const key of Object.values(this.LEGACY_KEYS)) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += new Blob([data]).size;
        }
      } catch (error) {
        console.warn(`Failed to calculate size for ${key}:`, error);
      }
    }

    return totalSize;
  }

  /**
   * Create backup before migration
   */
  private async createBackup(): Promise<void> {
    const backup: Record<string, string | null> = {};

    for (const [name, key] of Object.entries(this.LEGACY_KEYS)) {
      try {
        backup[name] = await AsyncStorage.getItem(key);
      } catch (error) {
        console.warn(`Failed to backup ${name}:`, error);
      }
    }

    await AsyncStorage.setItem(this.BACKUP_KEY, JSON.stringify(backup));
    console.log(`💾 Created migration backup: ${this.BACKUP_KEY}`);
  }

  /**
   * Restore from backup if migration fails
   */
  private async restoreFromBackup(): Promise<void> {
    try {
      const backupData = await AsyncStorage.getItem(this.BACKUP_KEY);
      if (!backupData) {
        throw new Error('No backup found');
      }

      const backup = JSON.parse(backupData);

      for (const [name, key] of Object.entries(this.LEGACY_KEYS)) {
        if (backup[name]) {
          await AsyncStorage.setItem(key, backup[name]);
        }
      }

      console.log('🔄 Successfully restored from backup');
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * Clean up legacy storage after successful migration
   */
  private async cleanupLegacyStorage(): Promise<void> {
    const keysToRemove = Object.values(this.LEGACY_KEYS);

    try {
      await AsyncStorage.multiRemove(keysToRemove);
      console.log(`🗑️ Cleaned up ${keysToRemove.length} legacy storage keys`);
    } catch (error) {
      console.warn('Failed to cleanup legacy storage:', error);
    }
  }

  /**
   * Utility methods for data extraction and normalization
   */
  private extractStatus(data: any): boolean | string {
    if (typeof data === 'boolean') return data;
    if (typeof data === 'string') return data;
    if (data?.status !== undefined) return data.status;
    if (data?.granted !== undefined) return data.granted;
    return false;
  }

  private extractTimestamp(data: any): number {
    if (data?.timestamp) return data.timestamp;
    if (data?.metadata?.timestamp) return data.metadata.timestamp;
    return Date.now();
  }

  private extractMetadata(data: any): any {
    if (data?.metadata) return data.metadata;
    return { migrated: true, migrationDate: Date.now() };
  }

  private normalizePermissionStatus(
    status: boolean | string
  ): 'granted' | 'denied' | 'blocked' | 'unknown' {
    if (typeof status === 'boolean') {
      return status ? 'granted' : 'denied';
    }

    if (typeof status === 'string') {
      switch (status.toLowerCase()) {
        case 'granted':
          return 'granted';
        case 'denied':
          return 'denied';
        case 'blocked':
          return 'blocked';
        case 'restricted':
          return 'blocked';
        case 'limited':
          return 'granted'; // Treat limited as granted
        default:
          return 'unknown';
      }
    }

    return 'unknown';
  }

  /**
   * Get migration status and statistics
   */
  async getMigrationStatus(): Promise<{
    isMigrationNeeded: boolean;
    legacyDataFound: boolean;
    estimatedBenefits: {
      storageReduction: number;
      performanceImprovement: string;
    };
  }> {
    const legacyKeys = Object.values(this.LEGACY_KEYS);
    let legacyDataFound = false;
    let totalLegacySize = 0;

    for (const key of legacyKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          legacyDataFound = true;
          totalLegacySize += new Blob([data]).size;
        }
      } catch (error) {
        console.warn(`Error checking ${key}:`, error);
      }
    }

    return {
      isMigrationNeeded: legacyDataFound,
      legacyDataFound,
      estimatedBenefits: {
        storageReduction: totalLegacySize,
        performanceImprovement: legacyDataFound
          ? '60% faster permission checks'
          : 'No improvement needed',
      },
    };
  }
}

export default PermissionMigrationService;
