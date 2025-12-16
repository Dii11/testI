/**
 * Runtime Safety Utilities
 *
 * Provides defensive programming utilities to prevent runtime crashes
 * in health dashboard and related components.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Safe number operations
export const safeNumber = (value: any, fallback: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  return fallback;
};

// Safe string operations
export const safeString = (value: any, fallback: string = ''): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value !== null && value !== undefined) {
    return String(value);
  }
  return fallback;
};

// Safe array operations
export const safeArray = <T>(value: any, fallback: T[] = []): T[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return fallback;
};

// Safe object operations
export const safeObject = <T extends Record<string, any>>(value: any, fallback: T | {} = {}): T => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return fallback as T;
};

// Safe percentage calculation
export const safePercentage = (current: number, total: number): number => {
  const safeCurrent = safeNumber(current, 0);
  const safeTotal = safeNumber(total, 1); // Avoid division by zero

  if (safeTotal === 0) return 0;

  const percentage = (safeCurrent / safeTotal) * 100;
  return Math.max(0, Math.min(100, percentage));
};

// Safe haptic feedback
export const safeHaptics = {
  impact: async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      if (Platform.OS === 'ios') {
        await Haptics.impactAsync(style);
      }
    } catch (error) {
      // Silently fail - haptics is not critical
    }
  },

  selection: async () => {
    try {
      if (Platform.OS === 'ios') {
        await Haptics.selectionAsync();
      }
    } catch (error) {
      // Silently fail - haptics is not critical
    }
  },

  notification: async (
    type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success
  ) => {
    try {
      if (Platform.OS === 'ios') {
        await Haptics.notificationAsync(type);
      }
    } catch (error) {
      // Silently fail - haptics is not critical
    }
  },
};

// Safe async operation wrapper
export const safeAsync = async <T>(
  operation: () => Promise<T>,
  fallback: T,
  errorContext?: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (errorContext) {
      console.warn(`Safe async operation failed (${errorContext}):`, error);
    }
    return fallback;
  }
};

// Safe function execution
export const safeExecute = <T>(fn: () => T, fallback: T, errorContext?: string): T => {
  try {
    return fn();
  } catch (error) {
    if (errorContext) {
      console.warn(`Safe execution failed (${errorContext}):`, error);
    }
    return fallback;
  }
};

// Safe navigation
export const safeNavigation = {
  navigate: (navigation: any, routeName: string, params?: any) => {
    try {
      if (navigation?.navigate) {
        navigation.navigate(routeName, params);
      }
    } catch (error) {
      console.warn(`Navigation failed to ${routeName}:`, error);
    }
  },

  goBack: (navigation: any) => {
    try {
      if (navigation?.goBack) {
        navigation.goBack();
      }
    } catch (error) {
      console.warn('Navigation goBack failed:', error);
    }
  },

  replace: (navigation: any, routeName: string, params?: any) => {
    try {
      if (navigation?.replace) {
        navigation.replace(routeName, params);
      }
    } catch (error) {
      console.warn(`Navigation replace failed to ${routeName}:`, error);
    }
  },
};

// Health data validation
export const validateHealthData = {
  heartRate: (value: number): boolean => {
    const hr = safeNumber(value);
    return hr > 0 && hr >= 30 && hr <= 250; // Reasonable heart rate range
  },

  steps: (value: number): boolean => {
    const steps = safeNumber(value);
    return steps >= 0 && steps <= 100000; // Reasonable daily steps range
  },

  sleepHours: (value: number): boolean => {
    const hours = safeNumber(value);
    return hours >= 0 && hours <= 24; // Reasonable sleep duration
  },

  bloodPressure: (systolic: number, diastolic: number): boolean => {
    const sys = safeNumber(systolic);
    const dia = safeNumber(diastolic);
    return sys > 0 && dia > 0 && sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150;
  },

  weight: (value: number, unit: 'kg' | 'lb' = 'kg'): boolean => {
    const weight = safeNumber(value);
    if (unit === 'kg') {
      return weight > 0 && weight >= 20 && weight <= 300; // 20kg to 300kg
    } else {
      return weight > 0 && weight >= 44 && weight <= 660; // 44lb to 660lb
    }
  },

  temperature: (value: number, unit: 'C' | 'F' = 'C'): boolean => {
    const temp = safeNumber(value);
    if (unit === 'C') {
      return temp >= 30 && temp <= 45; // 30°C to 45°C
    } else {
      return temp >= 86 && temp <= 113; // 86°F to 113°F
    }
  },

  oxygenSaturation: (value: number): boolean => {
    const spo2 = safeNumber(value);
    return spo2 >= 70 && spo2 <= 100; // Reasonable SpO2 range
  },

  bloodGlucose: (value: number): boolean => {
    const glucose = safeNumber(value);
    return glucose > 0 && glucose >= 20 && glucose <= 600; // mg/dL range
  },
};

// Safe date operations
export const safeDateOperations = {
  isValidDate: (date: any): boolean => {
    return date instanceof Date && !isNaN(date.getTime());
  },

  safeDate: (date: any, fallback: Date = new Date()): Date => {
    if (safeDateOperations.isValidDate(date)) {
      return date;
    }
    if (typeof date === 'string' || typeof date === 'number') {
      const parsed = new Date(date);
      if (safeDateOperations.isValidDate(parsed)) {
        return parsed;
      }
    }
    return fallback;
  },

  formatSafeDate: (date: any, format: 'short' | 'long' | 'time' = 'short'): string => {
    const safeDate = safeDateOperations.safeDate(date);

    try {
      switch (format) {
        case 'short':
          return safeDate.toLocaleDateString();
        case 'long':
          return safeDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        case 'time':
          return safeDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });
        default:
          return safeDate.toLocaleDateString();
      }
    } catch (error) {
      return 'Invalid Date';
    }
  },
};

// Performance-safe operations
export const performanceSafe = {
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastExecTime = 0;

    return (...args: Parameters<T>) => {
      const currentTime = Date.now();

      if (currentTime - lastExecTime > delay) {
        func(...args);
        lastExecTime = currentTime;
      } else {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          func(...args);
          lastExecTime = Date.now();
        }, delay);
      }
    };
  },

  debounce: <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },
};

// Environment checks
export const environmentSafe = {
  isProduction: () => {
    try {
      return process.env.NODE_ENV === 'production';
    } catch {
      return false;
    }
  },

  isDevelopment: () => {
    try {
      return process.env.NODE_ENV === 'development';
    } catch {
      return true; // Default to development for safety
    }
  },

  isExpoGo: () => {
    try {
      return process.env.EXPO_PUBLIC_PLATFORM === 'expo-go';
    } catch {
      return false;
    }
  },

  hasFeature: (feature: string): boolean => {
    const features = {
      haptics: Platform.OS === 'ios',
      notifications: true,
      camera: true,
      location: true,
      healthKit: Platform.OS === 'ios',
      googleFit: Platform.OS === 'android',
    };

    return features[feature as keyof typeof features] ?? false;
  },
};

export default {
  safeNumber,
  safeString,
  safeArray,
  safeObject,
  safePercentage,
  safeHaptics,
  safeAsync,
  safeExecute,
  safeNavigation,
  validateHealthData,
  safeDateOperations,
  performanceSafe,
  environmentSafe,
};
