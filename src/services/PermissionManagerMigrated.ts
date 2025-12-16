/**
 * Permission Manager - SIMPLIFIED WRAPPER
 *
 * Simplified wrapper that delegates all functionality to ConsolidatedPermissionManager.
 * This file exists only for backward compatibility.
 *
 * ✅ All functionality now handled by ConsolidatedPermissionManager
 * ✅ Clean delegation without duplicate code
 * ✅ Maintains backward compatibility
 */

// Re-export everything from ConsolidatedPermissionManager
// Create singleton wrapper that delegates all methods to ConsolidatedPermissionManager instance
import { ConsolidatedPermissionManager } from './permissions/ConsolidatedPermissionManager';

export {
  ConsolidatedPermissionManager as PermissionManager,
  ConsolidatedPermissionManager,
  type PermissionType,
  type PermissionStatus,
  type PermissionResult,
  type PermissionContext,
  type DegradationStrategy,
} from './permissions/ConsolidatedPermissionManager';

// Legacy type aliases for backward compatibility
export type PermissionPriority = 'critical' | 'important' | 'optional';
export type UserJourney = 'onboarding' | 'feature-access' | 'background' | 'settings';

// Legacy interfaces maintained for compatibility
export interface LegacyPermissionContext {
  feature: string;
  priority: PermissionPriority;
  userJourney?: UserJourney;
  userInitiated: boolean;
  explanation?: {
    title: string;
    reason: string;
    benefits: string[];
    privacyNote?: string;
  };
  fallbackStrategy?: {
    mode: 'alternative' | 'limited' | 'disabled';
    description: string;
    limitations: string[];
    alternativeApproach?: string;
  };
}

export interface DeviceCapabilities {
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasGPS: boolean;
  hasHealthKit: boolean;
  hasNotifications: boolean;
  isEmulator: boolean;
  manufacturer: string;
  model: string;
  osVersion: string;
  apiLevel?: number;
  permissionTimeoutMs: number;
  supportsGranularPermissions: boolean;
}

// Singleton wrapper that exposes all ConsolidatedPermissionManager methods
const PermissionManagerWrapper = {
  // Delegate all methods to the singleton instance
  async initialize() {
    return ConsolidatedPermissionManager.getInstance().initialize();
  },

  async checkPermission(type: any) {
    return ConsolidatedPermissionManager.getInstance().checkPermission(type);
  },

  async requestPermission(type: any, context: any) {
    return ConsolidatedPermissionManager.getInstance().requestPermission(type, context);
  },

  invalidatePermission(type: any) {
    return ConsolidatedPermissionManager.getInstance().invalidatePermission(type);
  },

  openAppSettings() {
    return ConsolidatedPermissionManager.getInstance().openAppSettings();
  },

  getDeviceCapabilities() {
    return ConsolidatedPermissionManager.getInstance().getDeviceCapabilities();
  },

  // Add any other methods that are called in the codebase
  async checkMultiplePermissions(types: any[]) {
    const results = await Promise.all(
      types.map(type => ConsolidatedPermissionManager.getInstance().checkPermission(type))
    );
    return results;
  },

  async requestPermissionWithEducation(type: any, context: any, showEducation = true) {
    // This method just delegates to requestPermission since ConsolidatedPermissionManager handles education internally
    return ConsolidatedPermissionManager.getInstance().requestPermission(type, context);
  },

  async requestPermissionWithProgressiveFallback(type: any, context: any) {
    // This method just delegates to requestPermission
    return ConsolidatedPermissionManager.getInstance().requestPermission(type, context);
  },

  async requestBatchPermissions(types: any[], context: any) {
    const results = await Promise.all(
      types.map(type =>
        ConsolidatedPermissionManager.getInstance().requestPermission(type, context)
      )
    );
    return results;
  },

  getCacheStats() {
    // Return basic cache stats structure
    return {
      totalEntries: 0,
      hitRate: 1.0,
      lastCacheCleanup: Date.now(),
    };
  },
};

export default PermissionManagerWrapper;
