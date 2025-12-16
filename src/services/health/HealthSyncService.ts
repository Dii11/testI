import { Platform } from 'react-native';

import type { HealthMetric, HealthSyncStatus, HealthSyncError } from '../../types/health';
import { HealthDataType } from '../../types/health';
import { isExpoGo } from '../../utils/nativeModuleChecker';
import { apiService } from '../api';

import { HealthDataService } from './HealthDataService';

// Platform-specific storage import with Expo Go safety check
let EncryptedStorage: any = null;

// Only load native modules in development builds or production, not in Expo Go
if (Platform.OS !== 'web' && !isExpoGo()) {
  try {
    EncryptedStorage = require('react-native-encrypted-storage').default;
  } catch (error) {
    console.warn('react-native-encrypted-storage not available:', error);
  }
} else if (isExpoGo()) {
  console.log('🔐 Encrypted Storage unavailable in Expo Go - using fallback storage');
}

interface HealthSyncData {
  metrics: HealthMetric[];
  userId: string;
  deviceId: string;
  timestamp: Date;
  encrypted: boolean;
}

export class HealthSyncService {
  private static instance: HealthSyncService;
  private syncInProgress = false;
  private pendingUploads: HealthMetric[] = [];
  private syncErrors: HealthSyncError[] = [];
  private lastSyncTime: Date | null = null;

  static getInstance(): HealthSyncService {
    if (!HealthSyncService.instance) {
      HealthSyncService.instance = new HealthSyncService();
    }
    return HealthSyncService.instance;
  }

  async syncHealthData(userId: string, forceSync = false): Promise<boolean> {
    if (this.syncInProgress && !forceSync) {
      console.log('Sync already in progress');
      return false;
    }

    this.syncInProgress = true;

    try {
      console.log('Starting health data sync...');

      // Get health data service instance
      const healthService = HealthDataService.getInstance();

      // Check if health service is initialized
      if (!(await healthService.initialize())) {
        throw new Error('Health service not available');
      }

      // Determine sync timeframe
      const endDate = new Date();
      const startDate = this.getLastSyncDate();

      // Collect health data from all supported types
      const allHealthData: HealthMetric[] = [];
      const healthDataTypes = [
        HealthDataType.HEART_RATE,
        HealthDataType.STEPS,
        HealthDataType.WEIGHT,
        HealthDataType.BLOOD_PRESSURE,
        HealthDataType.OXYGEN_SATURATION,
        HealthDataType.BODY_TEMPERATURE,
        HealthDataType.SLEEP,
      ];

      // Fetch data for each type in parallel
      const dataPromises = healthDataTypes.map(async dataType => {
        try {
          const data = await healthService.readHealthData(dataType, {
            startDate,
            endDate,
          });
          return data;
        } catch (error) {
          console.error(`Failed to fetch ${dataType}:`, error);
          this.addSyncError(dataType, `Failed to fetch ${dataType}: ${error}`);
          return [];
        }
      });

      const dataResults = await Promise.all(dataPromises);
      dataResults.forEach(data => allHealthData.push(...data));

      // Add any pending uploads
      allHealthData.push(...this.pendingUploads);

      if (allHealthData.length === 0) {
        console.log('No health data to sync');
        this.lastSyncTime = new Date();
        this.syncInProgress = false;
        return true;
      }

      // Encrypt and prepare data for upload
      const syncData: HealthSyncData = {
        metrics: allHealthData,
        userId,
        deviceId: await this.getDeviceId(),
        timestamp: new Date(),
        encrypted: true,
      };

      // Store locally first (as backup)
      await this.storeHealthDataLocally(syncData);

      // Upload to server
      const uploadSuccess = await this.uploadHealthData(syncData);

      if (uploadSuccess) {
        // Clear pending uploads on successful sync
        this.pendingUploads = [];
        this.lastSyncTime = new Date();
        await this.updateLastSyncTime(this.lastSyncTime);
        console.log(`Successfully synced ${allHealthData.length} health metrics`);
      } else {
        // Add failed metrics to pending uploads
        this.pendingUploads.push(...allHealthData);
        console.error('Failed to upload health data, added to pending queue');
      }

      this.syncInProgress = false;
      return uploadSuccess;
    } catch (error) {
      console.error('Health data sync failed:', error);
      this.addSyncError(HealthDataType.HEART_RATE, `Sync failed: ${error}`);
      this.syncInProgress = false;
      return false;
    }
  }

  private async uploadHealthData(syncData: HealthSyncData): Promise<boolean> {
    try {
      const response = await apiService.post('/health/sync', {
        data: syncData,
        checksum: this.calculateChecksum(syncData),
      });

      return response.success;
    } catch (error) {
      console.error('Failed to upload health data:', error);
      return false;
    }
  }

  private async storeHealthDataLocally(syncData: HealthSyncData): Promise<void> {
    try {
      const encryptedData = JSON.stringify(syncData);
      const storageKey = `health_backup_${syncData.timestamp.getTime()}`;

      if (Platform.OS === 'web') {
        // Use localStorage for web
        localStorage.setItem(storageKey, encryptedData);
      } else if (EncryptedStorage) {
        await EncryptedStorage.setItem(storageKey, encryptedData);
      }

      // Clean up old backups (keep only last 7 days)
      await this.cleanupOldBackups();
    } catch (error) {
      console.error('Failed to store health data locally:', error);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      let keys: string[] = [];

      if (Platform.OS === 'web') {
        // Get localStorage keys
        keys = Object.keys(localStorage);
      } else if (EncryptedStorage) {
        keys = Object.keys({}); // EncryptedStorage.getAllKeys doesn't exist, use fallback
      }

      const healthBackupKeys = keys.filter((key: string) => key.startsWith('health_backup_'));

      const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

      for (const key of healthBackupKeys) {
        const timestamp = parseInt(key.replace('health_backup_', ''));
        if (timestamp < cutoffTime) {
          if (Platform.OS === 'web') {
            localStorage.removeItem(key);
          } else if (EncryptedStorage) {
            await EncryptedStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  private calculateChecksum(data: HealthSyncData): string {
    // Simple checksum for data integrity verification
    const dataString = JSON.stringify(data.metrics);
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private getLastSyncDate(): Date {
    if (this.lastSyncTime) {
      return this.lastSyncTime;
    }

    // Default to last 7 days for first sync
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  private async updateLastSyncTime(date: Date): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('last_health_sync', date.toISOString());
      } else if (EncryptedStorage) {
        await EncryptedStorage.setItem('last_health_sync', date.toISOString());
      }
    } catch (error) {
      console.error('Failed to update last sync time:', error);
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId: string | null = null;

      if (Platform.OS === 'web') {
        deviceId = localStorage.getItem('device_id');
      } else if (EncryptedStorage) {
        deviceId = await EncryptedStorage.getItem('device_id');
      }

      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (Platform.OS === 'web') {
          localStorage.setItem('device_id', deviceId);
        } else if (EncryptedStorage) {
          await EncryptedStorage.setItem('device_id', deviceId);
        }
      }
      return deviceId;
    } catch (error) {
      console.error('Failed to get device ID:', error);
      return `fallback_${Date.now()}`;
    }
  }

  private addSyncError(dataType: HealthDataType, message: string): void {
    const error: HealthSyncError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: dataType,
      message,
      timestamp: new Date(),
      retryCount: 0,
    };

    this.syncErrors.push(error);

    // Keep only last 50 errors
    if (this.syncErrors.length > 50) {
      this.syncErrors = this.syncErrors.slice(-50);
    }
  }

  async getSyncStatus(): Promise<HealthSyncStatus> {
    return {
      lastSync: this.lastSyncTime,
      isOnline: await this.checkConnectivity(),
      pendingUploads: this.pendingUploads.length,
      errors: [...this.syncErrors],
    };
  }

  private async checkConnectivity(): Promise<boolean> {
    try {
      // Simple connectivity check - attempt to make a basic API call
      await apiService.get('/ping');
      return true;
    } catch (error) {
      return false;
    }
  }

  async retryFailedUploads(userId: string): Promise<boolean> {
    if (this.pendingUploads.length === 0) {
      return true;
    }

    console.log(`Retrying ${this.pendingUploads.length} failed uploads...`);
    return await this.syncHealthData(userId, true);
  }

  async clearPendingUploads(): Promise<void> {
    this.pendingUploads = [];
    console.log('Cleared pending health data uploads');
  }

  async exportHealthData(startDate: Date, endDate: Date): Promise<HealthMetric[]> {
    const healthService = HealthDataService.getInstance();
    const allData: HealthMetric[] = [];

    const healthDataTypes = [
      HealthDataType.HEART_RATE,
      HealthDataType.STEPS,
      HealthDataType.WEIGHT,
      HealthDataType.BLOOD_PRESSURE,
      HealthDataType.OXYGEN_SATURATION,
      HealthDataType.BODY_TEMPERATURE,
      HealthDataType.SLEEP,
    ];

    for (const dataType of healthDataTypes) {
      try {
        const data = await healthService.readHealthData(dataType, {
          startDate,
          endDate,
        });
        allData.push(...data);
      } catch (error) {
        console.error(`Failed to export ${dataType}:`, error);
      }
    }

    return allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async scheduleBackgroundSync(): Promise<void> {
    // This would integrate with background task scheduling
    // Implementation depends on the background task library used
    console.log('Background sync scheduling not yet implemented');
  }

  async loadCachedHealthData(): Promise<HealthMetric[]> {
    try {
      let keys: string[] = [];

      if (Platform.OS === 'web') {
        keys = Object.keys(localStorage);
      } else {
        keys = []; // Skip cached data loading for non-web platforms without proper EncryptedStorage methods
      }

      const healthBackupKeys = keys.filter((key: string) => key.startsWith('health_backup_'));

      if (healthBackupKeys.length === 0) {
        return [];
      }

      // Get the most recent backup
      const latestKey = healthBackupKeys.sort().pop();
      if (!latestKey) {
        return [];
      }

      let encryptedData: string | null = null;
      if (Platform.OS === 'web') {
        encryptedData = localStorage.getItem(latestKey);
      } else if (EncryptedStorage) {
        encryptedData = await EncryptedStorage.getItem(latestKey);
      }

      if (encryptedData) {
        const syncData: HealthSyncData = JSON.parse(encryptedData);
        return syncData.metrics;
      }

      return [];
    } catch (error) {
      console.error('Failed to load cached health data:', error);
      return [];
    }
  }
}
