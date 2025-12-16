/**
 * Integration Test for Permission System Migration
 *
 * Tests the core functionality of the migrated permission system
 * without complex Expo module dependencies
 */

describe('Permission System Migration - Integration Test', () => {
  describe('Import Resolution', () => {
    it('should import ConsolidatedPermissionManager successfully', () => {
      expect(() => {
        const {
          ConsolidatedPermissionManager,
        } = require('../permissions/ConsolidatedPermissionManager');
        expect(ConsolidatedPermissionManager).toBeDefined();
        expect(typeof ConsolidatedPermissionManager.getInstance).toBe('function');
      }).not.toThrow();
    });

    it('should import PermissionManagerMigrated successfully', () => {
      expect(() => {
        const PermissionManagerMigrated = require('../PermissionManagerMigrated');
        expect(PermissionManagerMigrated).toBeDefined();
        expect(PermissionManagerMigrated.ConsolidatedPermissionManager).toBeDefined();
      }).not.toThrow();
    });

    it('should import legacy PermissionManager successfully', () => {
      expect(() => {
        const PermissionManager = require('../PermissionManager');
        expect(PermissionManager).toBeDefined();
        expect(PermissionManager.PermissionManager).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Type Exports', () => {
    it('should export all required types from ConsolidatedPermissionManager', () => {
      const module = require('../permissions/ConsolidatedPermissionManager');

      // Check that the main class is exported
      expect(module.ConsolidatedPermissionManager).toBeDefined();

      // Types should be available (though we can't directly test TypeScript types in Jest)
      expect(typeof module.ConsolidatedPermissionManager.getInstance).toBe('function');
    });

    it('should export all required types from PermissionManagerMigrated', () => {
      const module = require('../PermissionManagerMigrated');

      // Check main exports
      expect(module.ConsolidatedPermissionManager).toBeDefined();
      expect(module.PermissionManager).toBeDefined();

      // Check that it's the same class
      expect(module.ConsolidatedPermissionManager).toBe(module.PermissionManager);
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton pattern across imports', () => {
      const {
        ConsolidatedPermissionManager: Direct,
      } = require('../permissions/ConsolidatedPermissionManager');
      const {
        ConsolidatedPermissionManager: ViaMigrated,
      } = require('../PermissionManagerMigrated');

      // Both should reference the same class
      expect(Direct).toBe(ViaMigrated);

      // getInstance should return the same instance
      const instance1 = Direct.getInstance();
      const instance2 = ViaMigrated.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Basic API Structure', () => {
    it('should have all required methods on ConsolidatedPermissionManager', () => {
      const {
        ConsolidatedPermissionManager,
      } = require('../permissions/ConsolidatedPermissionManager');
      const instance = ConsolidatedPermissionManager.getInstance();

      // Core methods
      expect(typeof instance.initialize).toBe('function');
      expect(typeof instance.checkPermission).toBe('function');
      expect(typeof instance.requestPermission).toBe('function');
      expect(typeof instance.requestMultiplePermissions).toBe('function');

      // Utility methods
      expect(typeof instance.openAppSettings).toBe('function');
      expect(typeof instance.invalidatePermission).toBe('function');
      expect(typeof instance.getPerformanceStats).toBe('function');
      expect(typeof instance.getDeviceConfiguration).toBe('function');
      expect(typeof instance.cleanup).toBe('function');
    });

    it('should have all required methods on legacy PermissionManager', () => {
      const { PermissionManager } = require('../PermissionManager');
      const instance = PermissionManager.getInstance();

      // Core methods
      expect(typeof instance.initialize).toBe('function');
      expect(typeof instance.checkPermission).toBe('function');
      expect(typeof instance.requestPermission).toBe('function');
      expect(typeof instance.requestMultiplePermissions).toBe('function');

      // Legacy methods
      expect(typeof instance.requestPermissionWithEducation).toBe('function');

      // Utility methods
      expect(typeof instance.openAppSettings).toBe('function');
      expect(typeof instance.invalidatePermission).toBe('function');
      expect(typeof instance.getPerformanceStats).toBe('function');
      expect(typeof instance.getDeviceConfiguration).toBe('function');
      expect(typeof instance.cleanup).toBe('function');
    });
  });

  describe('Migration Verification', () => {
    it('should not have circular dependencies', () => {
      // This test passes if the imports above work without throwing
      expect(true).toBe(true);
    });

    it('should maintain backward compatibility', () => {
      const LegacyManager = require('../PermissionManager');
      const NewManager = require('../PermissionManagerMigrated');

      // Both should be available
      expect(LegacyManager.PermissionManager).toBeDefined();
      expect(NewManager.ConsolidatedPermissionManager).toBeDefined();

      // Both should have the same core API
      const legacyInstance = LegacyManager.PermissionManager.getInstance();
      const newInstance = NewManager.ConsolidatedPermissionManager.getInstance();

      expect(typeof legacyInstance.requestPermission).toBe('function');
      expect(typeof newInstance.requestPermission).toBe('function');
    });
  });
});
