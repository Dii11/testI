/**
 * Device-Specific Permission Tests - Phase 3
 * Tests for manufacturer-specific optimizations and behaviors
 */

import type { PermissionContext, PermissionType } from '../PermissionManagerMigrated';
import PermissionManager from '../PermissionManagerMigrated';

// Mock dependencies for device-specific testing
jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(),
    getCameraPermissionsAsync: jest.fn(),
  },
}));

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
  },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  deviceType: 1,
  manufacturer: 'Apple',
  modelName: 'iPhone 13',
  osVersion: '15.0',
}));

jest.mock('../deviceCapabilityService', () => ({
  getCapabilities: jest.fn(() => ({
    hasCamera: true,
    hasMicrophone: true,
    hasGPS: true,
    hasHealthKit: false,
    hasNotifications: true,
    isEmulator: false,
    manufacturer: 'Apple',
    model: 'iPhone 13',
    osVersion: '15.0',
    permissionTimeoutMs: 10000,
    supportsGranularPermissions: true,
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 30,
  },
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openSettings: jest.fn(),
  },
  AppState: {
    addEventListener: jest.fn(),
  },
  PermissionsAndroid: {},
}));

describe('Device-Specific Permission Tests - Phase 3', () => {
  let permissionManager: any;

  const testContext: PermissionContext = {
    feature: 'device-test',
    priority: 'important',
    userJourney: 'feature-access',
    userInitiated: true,
    explanation: {
      title: 'Device Test Permission',
      reason: 'Testing device-specific permission behavior.',
      benefits: ['Optimal performance', 'Device compatibility'],
    },
    fallbackStrategy: {
      mode: 'alternative',
      description: 'Alternative approach available',
      limitations: ['Reduced functionality'],
      alternativeApproach: 'manual',
    },
  };

  beforeEach(async () => {
    const PermissionManagerModule = require('../PermissionManager');
    permissionManager =
      PermissionManagerModule.default?.getInstance() || new PermissionManagerModule();

    // Reset singleton state
    permissionManager.initialized = false;
    permissionManager.requestQueue = [];
    permissionManager.activeRequests = new Map();
    permissionManager.permissionCache = new Map();

    jest.clearAllMocks();
  });

  describe('Samsung Device Optimizations', () => {
    beforeEach(async () => {
      const mockDevice = require('expo-device');
      mockDevice.manufacturer = 'Samsung';
      mockDevice.modelName = 'Galaxy S21';
      mockDevice.osVersion = '11.0';

      await permissionManager.initialize();
    });

    it('should apply Samsung-specific timeout adjustments', () => {
      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.manufacturer).toBe('Samsung');
      expect(capabilities?.permissionTimeoutMs).toBeGreaterThanOrEqual(18000);
    });

    it('should handle One UI permission delays', async () => {
      const { Camera } = require('expo-camera');
      Camera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: false,
      });

      const startTime = Date.now();
      await permissionManager.requestPermission('camera', testContext);
      const endTime = Date.now();

      // Samsung devices should have pre-request delay for One UI
      expect(endTime - startTime).toBeGreaterThan(800);
    });

    it('should use sequential batching for Samsung devices', async () => {
      const { Camera } = require('expo-camera');
      const { Audio } = require('expo-av');

      const callOrder: string[] = [];

      Camera.requestCameraPermissionsAsync.mockImplementation(async () => {
        callOrder.push('camera');
        await new Promise(resolve => setTimeout(resolve, 100));
        return { status: 'granted', canAskAgain: false };
      });

      Audio.requestPermissionsAsync.mockImplementation(async () => {
        callOrder.push('microphone');
        await new Promise(resolve => setTimeout(resolve, 100));
        return { status: 'granted', canAskAgain: false };
      });

      const requests = [
        { type: 'camera' as PermissionType, context: testContext },
        { type: 'microphone' as PermissionType, context: testContext },
      ];

      await permissionManager.requestBatchPermissions(requests);

      // Samsung should process sequentially
      expect(callOrder).toEqual(['camera', 'microphone']);
    });

    it('should handle Samsung DeX mode detection', async () => {
      // Mock DeX mode
      const mockDevice = require('expo-device');
      mockDevice.modelName = 'Galaxy S21 (DeX)';

      permissionManager.initialized = false;
      await permissionManager.initialize();

      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.dexMode).toBe(true);
      expect(capabilities?.permissionTimeoutMs).toBeGreaterThan(20000);
    });
  });

  describe('Xiaomi Device Optimizations', () => {
    beforeEach(async () => {
      const mockDevice = require('expo-device');
      mockDevice.manufacturer = 'Xiaomi';
      mockDevice.modelName = 'Mi 11';
      mockDevice.osVersion = '11.0';

      await permissionManager.initialize();
    });

    it('should apply Xiaomi MIUI specific settings', () => {
      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.manufacturer).toBe('Xiaomi');
      expect(capabilities?.permissionTimeoutMs).toBe(15000);
      expect(capabilities?.requiresSequentialRequests).toBe(true);
    });

    it('should handle MIUI autostart manager interference', async () => {
      const { Camera } = require('expo-camera');

      // Mock MIUI interference
      Camera.requestCameraPermissionsAsync
        .mockRejectedValueOnce(new Error('MIUI security restriction'))
        .mockResolvedValueOnce({ status: 'granted', canAskAgain: false });

      const result = await permissionManager.requestPermission('camera', testContext);

      expect(result.status).toBe('granted');
      expect(result.metadata?.miuiWorkaround).toBe(true);
    });

    it('should enforce sequential permission requests for MIUI', async () => {
      const { Camera } = require('expo-camera');
      const { Audio } = require('expo-av');

      const requestTimes: number[] = [];

      Camera.requestCameraPermissionsAsync.mockImplementation(async () => {
        requestTimes.push(Date.now());
        return { status: 'granted', canAskAgain: false };
      });

      Audio.requestPermissionsAsync.mockImplementation(async () => {
        requestTimes.push(Date.now());
        return { status: 'granted', canAskAgain: false };
      });

      const requests = [
        { type: 'camera' as PermissionType, context: testContext },
        { type: 'microphone' as PermissionType, context: testContext },
      ];

      await permissionManager.requestBatchPermissions(requests);

      // Requests should be separated by at least the minimum delay
      expect(requestTimes[1] - requestTimes[0]).toBeGreaterThan(500);
    });
  });

  describe('Huawei Device Optimizations', () => {
    beforeEach(async () => {
      const mockDevice = require('expo-device');
      mockDevice.manufacturer = 'Huawei';
      mockDevice.modelName = 'P40 Pro';
      mockDevice.osVersion = '10.0';

      await permissionManager.initialize();
    });

    it('should apply Huawei EMUI specific settings', () => {
      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.manufacturer).toBe('Huawei');
      expect(capabilities?.permissionTimeoutMs).toBe(25000);
      expect(capabilities?.requiresDelayedSequential).toBe(true);
    });

    it('should handle EMUI permission manager conflicts', async () => {
      const { Camera } = require('expo-camera');

      // Mock EMUI permission manager interference
      Camera.requestCameraPermissionsAsync.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { status: 'granted', canAskAgain: false };
      });

      const startTime = Date.now();
      const result = await permissionManager.requestPermission('camera', testContext);
      const endTime = Date.now();

      expect(result.status).toBe('granted');
      expect(endTime - startTime).toBeGreaterThan(2500); // Including Huawei delay
    });

    it('should handle HMS Core integration', async () => {
      // Mock HMS Core availability
      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.hmsCore).toBe(true);
      expect(capabilities?.googlePlayServices).toBe(false);
    });
  });

  describe('OnePlus Device Optimizations', () => {
    beforeEach(async () => {
      const mockDevice = require('expo-device');
      mockDevice.manufacturer = 'OnePlus';
      mockDevice.modelName = '9 Pro';
      mockDevice.osVersion = '11.0';

      await permissionManager.initialize();
    });

    it('should apply OnePlus OxygenOS settings', () => {
      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.manufacturer).toBe('OnePlus');
      expect(capabilities?.permissionTimeoutMs).toBe(12000);
      expect(capabilities?.oxygenOSOptimized).toBe(true);
    });

    it('should handle OxygenOS permission dialogs', async () => {
      const { Camera } = require('expo-camera');
      Camera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: false,
      });

      const result = await permissionManager.requestPermission('camera', testContext);

      expect(result.status).toBe('granted');
      expect(result.metadata?.oxygenOSHandled).toBe(true);
    });

    it('should optimize for OnePlus gaming mode', async () => {
      // Mock gaming mode detection
      const mockDevice = require('expo-device');
      mockDevice.modelName = 'OnePlus 9 Pro (Gaming)';

      permissionManager.initialized = false;
      await permissionManager.initialize();

      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.gamingMode).toBe(true);
      expect(capabilities?.permissionTimeoutMs).toBe(8000); // Faster in gaming mode
    });
  });

  describe('Google Pixel Device Optimizations', () => {
    beforeEach(async () => {
      const mockDevice = require('expo-device');
      mockDevice.manufacturer = 'Google';
      mockDevice.modelName = 'Pixel 6';
      mockDevice.osVersion = '12.0';

      await permissionManager.initialize();
    });

    it('should apply stock Android optimizations', () => {
      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.manufacturer).toBe('Google');
      expect(capabilities?.permissionTimeoutMs).toBe(10000);
      expect(capabilities?.stockAndroid).toBe(true);
    });

    it('should use efficient batching for stock Android', async () => {
      const { Camera } = require('expo-camera');
      const { Audio } = require('expo-av');

      let simultaneousCalls = 0;
      let maxSimultaneous = 0;

      Camera.requestCameraPermissionsAsync.mockImplementation(async () => {
        simultaneousCalls++;
        maxSimultaneous = Math.max(maxSimultaneous, simultaneousCalls);
        await new Promise(resolve => setTimeout(resolve, 100));
        simultaneousCalls--;
        return { status: 'granted', canAskAgain: false };
      });

      Audio.requestPermissionsAsync.mockImplementation(async () => {
        simultaneousCalls++;
        maxSimultaneous = Math.max(maxSimultaneous, simultaneousCalls);
        await new Promise(resolve => setTimeout(resolve, 100));
        simultaneousCalls--;
        return { status: 'granted', canAskAgain: false };
      });

      const requests = [
        { type: 'camera' as PermissionType, context: testContext },
        { type: 'microphone' as PermissionType, context: testContext },
      ];

      await permissionManager.requestBatchPermissions(requests);

      // Stock Android should allow parallel requests
      expect(maxSimultaneous).toBe(2);
    });

    it('should handle Android 12 permission groups', async () => {
      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.android12PermissionGroups).toBe(true);
      expect(capabilities?.supportsGranularPermissions).toBe(true);
    });
  });

  describe('iOS Device Optimizations', () => {
    beforeEach(async () => {
      const mockDevice = require('expo-device');
      const mockPlatform = require('react-native').Platform;

      mockDevice.manufacturer = 'Apple';
      mockDevice.modelName = 'iPhone 13';
      mockDevice.osVersion = '15.0';
      mockPlatform.OS = 'ios';

      await permissionManager.initialize();
    });

    it('should apply iOS-specific settings', () => {
      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.manufacturer).toBe('Apple');
      expect(capabilities?.permissionTimeoutMs).toBe(8000);
      expect(capabilities?.ios).toBe(true);
    });

    it('should handle iOS permission prompts efficiently', async () => {
      const { Camera } = require('expo-camera');
      Camera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: false,
      });

      const startTime = Date.now();
      const result = await permissionManager.requestPermission('camera', testContext);
      const endTime = Date.now();

      expect(result.status).toBe('granted');
      // iOS should be fast with no artificial delays
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should optimize for different iPhone models', async () => {
      const testModels = ['iPhone SE', 'iPhone 13', 'iPhone 13 Pro Max'];

      for (const model of testModels) {
        const mockDevice = require('expo-device');
        mockDevice.modelName = model;

        permissionManager.initialized = false;
        await permissionManager.initialize();

        const capabilities = permissionManager.getDeviceCapabilities();
        expect(capabilities?.model).toBe(model);

        if (model.includes('SE')) {
          expect(capabilities?.permissionTimeoutMs).toBeGreaterThan(8000);
        } else {
          expect(capabilities?.permissionTimeoutMs).toBeLessThanOrEqual(8000);
        }
      }
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should maintain consistency across different manufacturers', async () => {
      const manufacturers = ['Samsung', 'Xiaomi', 'Huawei', 'OnePlus', 'Google', 'Apple'];
      const results: any[] = [];

      for (const manufacturer of manufacturers) {
        const mockDevice = require('expo-device');
        mockDevice.manufacturer = manufacturer;
        mockDevice.modelName = `${manufacturer} Test Device`;

        permissionManager.initialized = false;
        await permissionManager.initialize();

        const capabilities = permissionManager.getDeviceCapabilities();
        results.push({
          manufacturer,
          timeout: capabilities?.permissionTimeoutMs,
          features: capabilities,
        });
      }

      // All manufacturers should have valid timeout values
      results.forEach(result => {
        expect(result.timeout).toBeGreaterThan(5000);
        expect(result.timeout).toBeLessThan(30000);
      });

      // Consistency checks
      expect(results.length).toBe(6);
    });

    it('should handle unknown manufacturers gracefully', async () => {
      const mockDevice = require('expo-device');
      mockDevice.manufacturer = 'Unknown Manufacturer';
      mockDevice.modelName = 'Unknown Model';

      permissionManager.initialized = false;
      await permissionManager.initialize();

      const capabilities = permissionManager.getDeviceCapabilities();
      expect(capabilities?.manufacturer).toBe('Unknown Manufacturer');
      expect(capabilities?.permissionTimeoutMs).toBe(10000); // Default timeout
    });
  });

  describe('Performance Benchmarking', () => {
    it('should measure permission request performance across devices', async () => {
      const { Camera } = require('expo-camera');
      Camera.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: false,
      });

      const manufacturers = ['Samsung', 'Xiaomi', 'Google'];
      const performanceData: any[] = [];

      for (const manufacturer of manufacturers) {
        const mockDevice = require('expo-device');
        mockDevice.manufacturer = manufacturer;

        permissionManager.initialized = false;
        await permissionManager.initialize();

        const startTime = performance.now();
        await permissionManager.requestPermission('camera', testContext);
        const endTime = performance.now();

        performanceData.push({
          manufacturer,
          duration: endTime - startTime,
        });
      }

      // Performance should be reasonable for all devices
      performanceData.forEach(data => {
        expect(data.duration).toBeLessThan(2000); // Max 2 seconds
      });
    });

    it('should optimize memory usage across different devices', async () => {
      const manufacturers = ['Samsung', 'Google', 'Apple'];

      for (const manufacturer of manufacturers) {
        const mockDevice = require('expo-device');
        mockDevice.manufacturer = manufacturer;

        permissionManager.initialized = false;
        const initialMemory = process.memoryUsage().heapUsed;

        await permissionManager.initialize();

        // Perform multiple operations
        for (let i = 0; i < 100; i++) {
          await permissionManager.checkPermission('camera', false);
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory usage should be reasonable
        expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // 5MB max
      }
    });
  });
});
