/**
 * Basic Tests for PermissionManager - Simplified for migration verification
 */

import { ConsolidatedPermissionManager } from '../permissions/ConsolidatedPermissionManager';

// Additional test-specific mocks (global mocks are in jest.setup.js)

describe('ConsolidatedPermissionManager - Basic Tests', () => {
  let permissionManager: ConsolidatedPermissionManager;

  beforeEach(async () => {
    permissionManager = ConsolidatedPermissionManager.getInstance();
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should initialize successfully', async () => {
      await expect(permissionManager.initialize()).resolves.not.toThrow();
    });

    it('should check permission status', async () => {
      const result = await permissionManager.checkPermission('camera');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('canAskAgain');
      expect(result).toHaveProperty('fallbackAvailable');
      expect(result).toHaveProperty('metadata');
    });

    it('should request permission with context', async () => {
      const context = {
        feature: 'test-feature',
        priority: 'important' as const,
        userInitiated: true,
        fallbackStrategy: {
          mode: 'alternative' as const,
          description: 'Test fallback',
          limitations: ['Test limitation'],
          alternativeApproach: 'manual',
        },
      };

      const result = await permissionManager.requestPermission('camera', context);
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('canAskAgain');
      expect(result).toHaveProperty('fallbackAvailable');
    });

    it('should handle multiple permission requests', async () => {
      const context = {
        feature: 'test-feature',
        priority: 'important' as const,
        userInitiated: true,
        fallbackStrategy: {
          mode: 'alternative' as const,
          description: 'Test fallback',
          limitations: ['Test limitation'],
          alternativeApproach: 'manual',
        },
      };

      const requests = [
        { type: 'camera' as const, context },
        { type: 'microphone' as const, context },
      ];

      const results = await permissionManager.requestMultiplePermissions(requests);
      expect(results).toHaveProperty('camera');
      expect(results).toHaveProperty('microphone');
    });
  });

  describe('Utility Methods', () => {
    it('should provide device configuration', () => {
      const config = permissionManager.getDeviceConfiguration();
      expect(config).toBeDefined();
    });

    it('should provide performance stats', () => {
      const stats = permissionManager.getPerformanceStats();
      expect(stats).toBeDefined();
    });

    it('should invalidate permission cache', () => {
      expect(() => permissionManager.invalidatePermission('camera')).not.toThrow();
    });
  });
});
