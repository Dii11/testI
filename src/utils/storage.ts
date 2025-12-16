import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { STORAGE_KEYS } from '../constants';

/**
 * Secure storage utilities
 */
export class SecureStorage {
  /**
   * Store sensitive data securely
   */
  static async setItem(key: string, value: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage for web with encryption simulation
        localStorage.setItem(key, btoa(value)); // Basic encoding for web
        return true;
      } else {
        // Use SecureStore for mobile platforms
        await SecureStore.setItemAsync(key, value);
        return true;
      }
    } catch (error) {
      console.error('SecureStorage.setItem error:', error);
      // Fallback to AsyncStorage
      try {
        await AsyncStorage.setItem(key, value);
        return true;
      } catch (fallbackError) {
        console.error('AsyncStorage fallback error:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Retrieve sensitive data securely
   */
  static async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage for web
        const encoded = localStorage.getItem(key);
        return encoded ? atob(encoded) : null; // Basic decoding for web
      } else {
        // Use SecureStore for mobile platforms
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error('SecureStorage.getItem error:', error);
      // Fallback to AsyncStorage
      try {
        return await AsyncStorage.getItem(key);
      } catch (fallbackError) {
        console.error('AsyncStorage fallback error:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Remove sensitive data
   */
  static async removeItem(key: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return true;
      } else {
        await SecureStore.deleteItemAsync(key);
        return true;
      }
    } catch (error) {
      console.error('SecureStorage.removeItem error:', error);
      // Fallback to AsyncStorage
      try {
        await AsyncStorage.removeItem(key);
        return true;
      } catch (fallbackError) {
        console.error('AsyncStorage fallback error:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Check if item exists
   */
  static async hasItem(key: string): Promise<boolean> {
    const value = await this.getItem(key);
    return value !== null;
  }
}

/**
 * Regular storage utilities for non-sensitive data
 */
export class AppStorage {
  /**
   * Store JSON data
   */
  static async setObject<T>(key: string, value: T): Promise<boolean> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
      return true;
    } catch (error) {
      console.error('AppStorage.setObject error:', error);
      return false;
    }
  }

  /**
   * Retrieve JSON data
   */
  static async getObject<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue !== null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('AppStorage.getObject error:', error);
      return null;
    }
  }

  /**
   * Store string data
   */
  static async setString(key: string, value: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('AppStorage.setString error:', error);
      return false;
    }
  }

  /**
   * Retrieve string data
   */
  static async getString(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('AppStorage.getString error:', error);
      return null;
    }
  }

  /**
   * Store boolean data
   */
  static async setBoolean(key: string, value: boolean): Promise<boolean> {
    return this.setString(key, value.toString());
  }

  /**
   * Retrieve boolean data
   */
  static async getBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
    try {
      const value = await this.getString(key);
      return value !== null ? value === 'true' : defaultValue;
    } catch (error) {
      console.error('AppStorage.getBoolean error:', error);
      return defaultValue;
    }
  }

  /**
   * Store number data
   */
  static async setNumber(key: string, value: number): Promise<boolean> {
    return this.setString(key, value.toString());
  }

  /**
   * Retrieve number data
   */
  static async getNumber(key: string, defaultValue: number = 0): Promise<number> {
    try {
      const value = await this.getString(key);
      return value !== null ? parseFloat(value) : defaultValue;
    } catch (error) {
      console.error('AppStorage.getNumber error:', error);
      return defaultValue;
    }
  }

  /**
   * Remove data
   */
  static async removeItem(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('AppStorage.removeItem error:', error);
      return false;
    }
  }

  /**
   * Clear all app data
   */
  static async clear(): Promise<boolean> {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('AppStorage.clear error:', error);
      return false;
    }
  }

  /**
   * Get all keys
   */
  static async getAllKeys(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return [...keys];
    } catch (error) {
      console.error('AppStorage.getAllKeys error:', error);
      return [];
    }
  }

  /**
   * Get multiple items
   */
  static async getMultiple(keys: string[]): Promise<Record<string, string | null>> {
    try {
      const result = await AsyncStorage.multiGet(keys);
      return result.reduce(
        (acc, [key, value]) => {
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string | null>
      );
    } catch (error) {
      console.error('AppStorage.getMultiple error:', error);
      return {};
    }
  }

  /**
   * Check if item exists
   */
  static async hasItem(key: string): Promise<boolean> {
    const value = await this.getString(key);
    return value !== null;
  }
}

/**
 * User preferences storage
 */
export class UserPreferences {
  private static readonly PREFERENCES_KEY = STORAGE_KEYS.USER_PREFERENCES;

  static async getPreferences(): Promise<any> {
    return AppStorage.getObject(this.PREFERENCES_KEY) || {};
  }

  static async setPreference(key: string, value: any): Promise<boolean> {
    try {
      const preferences = await this.getPreferences();
      preferences[key] = value;
      return AppStorage.setObject(this.PREFERENCES_KEY, preferences);
    } catch (error) {
      console.error('UserPreferences.setPreference error:', error);
      return false;
    }
  }

  static async getPreference<T>(key: string, defaultValue?: T): Promise<T> {
    try {
      const preferences = await this.getPreferences();
      return preferences[key] !== undefined ? preferences[key] : defaultValue!;
    } catch (error) {
      console.error('UserPreferences.getPreference error:', error);
      return defaultValue as T;
    }
  }

  static async removePreference(key: string): Promise<boolean> {
    try {
      const preferences = await this.getPreferences();
      delete preferences[key];
      return AppStorage.setObject(this.PREFERENCES_KEY, preferences);
    } catch (error) {
      console.error('UserPreferences.removePreference error:', error);
      return false;
    }
  }

  static async clearPreferences(): Promise<boolean> {
    return AppStorage.removeItem(this.PREFERENCES_KEY);
  }
}

/**
 * Cache management
 */
export class CacheManager {
  /**
   * Set cache with expiration
   */
  static async setCache(key: string, data: any, expirationMinutes: number = 60): Promise<boolean> {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
        expiration: Date.now() + expirationMinutes * 60 * 1000,
      };

      return AppStorage.setObject(`cache_${key}`, cacheItem);
    } catch (error) {
      console.error('CacheManager.setCache error:', error);
      return false;
    }
  }

  /**
   * Get cache if not expired
   */
  static async getCache<T>(key: string): Promise<T | null> {
    try {
      const cacheItem = await AppStorage.getObject<{
        data: T;
        timestamp: number;
        expiration: number;
      }>(`cache_${key}`);

      if (!cacheItem) {
        return null;
      }

      if (Date.now() > cacheItem.expiration) {
        // Cache expired, remove it
        await this.removeCache(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error('CacheManager.getCache error:', error);
      return null;
    }
  }

  /**
   * Remove cache
   */
  static async removeCache(key: string): Promise<boolean> {
    return AppStorage.removeItem(`cache_${key}`);
  }

  /**
   * Clear all expired cache
   */
  static async clearExpiredCache(): Promise<void> {
    try {
      const keys = await AppStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      const now = Date.now();

      for (const key of cacheKeys) {
        const cacheItem = await AppStorage.getObject<{
          expiration: number;
        }>(key);

        if (cacheItem && now > cacheItem.expiration) {
          await AppStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('CacheManager.clearExpiredCache error:', error);
    }
  }

  /**
   * Clear all cache
   */
  static async clearAllCache(): Promise<void> {
    try {
      const keys = await AppStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));

      for (const key of cacheKeys) {
        await AppStorage.removeItem(key);
      }
    } catch (error) {
      console.error('CacheManager.clearAllCache error:', error);
    }
  }
}
