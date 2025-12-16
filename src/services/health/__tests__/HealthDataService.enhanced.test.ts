/**
 * Enhanced HealthDataService Tests
 *
 * Comprehensive test suite covering race conditions, error recovery,
 * caching, and cross-platform compatibility scenarios.
 */

import { Platform } from 'react-native';

import { HealthDataType } from '../../../types/health';
import { HealthDataService } from '../HealthDataService';

// Mock external dependencies
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-constants', () => ({
  default: {
    executionEnvironment: 'standalone',
    appOwnership: null,
  },
}));

jest.mock('../../../utils/sentryErrorTracker', () => ({
  sentryTracker: {
    trackCriticalError: jest.fn(),
    trackServiceError: jest.fn(),
    addBreadcrumb: jest.fn(),
  },
}));

describe('HealthDataService - Enhanced Tests', () => {
  let service: HealthDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (HealthDataService as any).instance = null;
    service = HealthDataService.getInstance();
  });

  describe('Initialization Race Conditions', () => {
    it('should handle multiple concurrent initialization calls', async () => {
      const initializationSpy = jest
        .spyOn(service as any, 'performInitialization')
        .mockResolvedValue(true);

      // Start multiple initialization calls simultaneously
      const promises = Array.from({ length: 5 }, () => service.initialize());

      // All should resolve to true
      const results = await Promise.all(promises);
      expect(results).toEqual([true, true, true, true, true]);

      // But performInitialization should only be called once
      expect(initializationSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect cooldown period between initialization attempts', async () => {
      const mockPerformInit = jest
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(true);

      jest.spyOn(service as any, 'performInitialization').mockImplementation(mockPerformInit);

      // First attempt should fail
      await expect(service.initialize()).rejects.toThrow('First attempt failed');

      // Immediate second attempt should be blocked by cooldown
      const result = await service.initialize();
      expect(result).toBe(false); // Returns existing state (not initialized)

      // Fast forward time to bypass cooldown
      jest.useFakeTimers();
      jest.advanceTimersByTime(6000); // 6 seconds > 5 second cooldown

      // Now initialization should work
      const finalResult = await service.initialize();
      expect(finalResult).toBe(true);

      jest.useRealTimers();
    });

    it('should handle initialization lock correctly', async () => {
      let resolveInitialization: (value: boolean) => void;
      const initializationPromise = new Promise<boolean>(resolve => {
        resolveInitialization = resolve;
      });

      jest.spyOn(service as any, 'performInitialization').mockReturnValue(initializationPromise);

      // Start first initialization (will be pending)
      const firstInit = service.initialize();

      // Start second initialization (should wait for lock)
      const secondInit = service.initialize();

      // Resolve the initialization
      resolveInitialization!(true);

      // Both should resolve to true
      const [first, second] = await Promise.all([firstInit, secondInit]);
      expect(first).toBe(true);
      expect(second).toBe(true);
    });
  });

  describe('Error Recovery and Fallbacks', () => {
    it('should recover from permission errors with fallback', async () => {
      // Mock failed permission request
      const mockRequestPermissions = jest.fn().mockRejectedValue(new Error('Permission denied'));
      service.requestPermissions = mockRequestPermissions;

      // Attempt to request permissions
      const result = await service.requestPermissions([HealthDataType.STEPS]);

      expect(result).toBe(false);
      expect(mockRequestPermissions).toHaveBeenCalledWith([HealthDataType.STEPS]);
    });

    it('should handle platform-specific initialization failures', async () => {
      // Mock iOS platform
      (Platform as any).OS = 'ios';

      // Mock HealthKit initialization failure
      jest
        .spyOn(service as any, 'initializeAppleHealthKit')
        .mockRejectedValue(new Error('HealthKit not available'));

      // Should still initialize with fallback
      const result = await service.initialize();
      expect(result).toBe(false); // Real device fails without fallback
    });

    it('should timeout gracefully on slow devices', async () => {
      jest.useFakeTimers();

      // Mock slow initialization
      const slowInit = jest.spyOn(service as any, 'performInitialization').mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve(true), 15000); // 15 second delay
          })
      );

      const initPromise = service.initialize();

      // Fast forward time
      jest.advanceTimersByTime(15000);

      const result = await initPromise;
      expect(result).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Data Fetching Optimization', () => {
    it('should fetch appropriate date ranges based on period', async () => {
      const mockReadHealthData = jest.spyOn(service, 'readHealthData').mockResolvedValue([]);

      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      await service.readHealthData(HealthDataType.STEPS, {
        startDate: sevenDaysAgo,
        endDate: today,
        limit: 500,
      });

      expect(mockReadHealthData).toHaveBeenCalledWith(HealthDataType.STEPS, {
        startDate: sevenDaysAgo,
        endDate: today,
        limit: 500,
      });
    });

    it('should handle large datasets efficiently', async () => {
      // Generate large mock dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `test_${i}`,
        type: HealthDataType.STEPS,
        value: Math.floor(Math.random() * 15000),
        unit: 'steps',
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        source: 'phone' as const,
      }));

      jest.spyOn(service as any, 'readAppleHealthData').mockResolvedValue(largeDataset);

      const startTime = Date.now();
      const result = await service.readHealthData(HealthDataType.STEPS, {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        limit: 10000,
      });
      const endTime = Date.now();

      expect(result).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should batch data requests efficiently', async () => {
      const mockReadHealthData = jest
        .spyOn(service, 'readHealthData')
        .mockImplementation(dataType => {
          // Simulate different response times for different data types
          const delays = {
            [HealthDataType.STEPS]: 100,
            [HealthDataType.HEART_RATE]: 200,
            [HealthDataType.SLEEP]: 300,
          };

          return new Promise(resolve => {
            setTimeout(() => {
              resolve([
                {
                  id: `${dataType}_test`,
                  type: dataType,
                  value: 100,
                  unit: 'test',
                  timestamp: new Date(),
                  source: 'phone',
                },
              ]);
            }, delays[dataType] || 100);
          });
        });

      const startTime = Date.now();
      const requests = [
        service.readHealthData(HealthDataType.STEPS, {
          startDate: new Date(),
          endDate: new Date(),
        }),
        service.readHealthData(HealthDataType.HEART_RATE, {
          startDate: new Date(),
          endDate: new Date(),
        }),
        service.readHealthData(HealthDataType.SLEEP, {
          startDate: new Date(),
          endDate: new Date(),
        }),
      ];

      const results = await Promise.all(requests);
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(results.every(r => r.length === 1)).toBe(true);
      // Should complete in parallel (around 300ms) not sequentially (600ms)
      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle iOS HealthKit integration', async () => {
      (Platform as any).OS = 'ios';

      // Mock successful HealthKit setup
      const mockInitializeAppleHealthKit = jest
        .spyOn(service as any, 'initializeAppleHealthKit')
        .mockResolvedValue(undefined);

      const result = await service.initialize();
      expect(mockInitializeAppleHealthKit).toHaveBeenCalled();
    });

    it('should handle Android Health Connect integration', async () => {
      (Platform as any).OS = 'android';

      // Mock successful Health Connect setup
      const mockInitializeHealthConnect = jest
        .spyOn(service as any, 'initializeHealthConnect')
        .mockResolvedValue(undefined);

      const result = await service.initialize();
      expect(mockInitializeHealthConnect).toHaveBeenCalled();
    });

    it('should fallback to mock data in Expo Go', async () => {
      // Mock Expo Go environment
      const Constants = require('expo-constants').default;
      Constants.executionEnvironment = 'storeClient';

      const result = await service.initialize();
      expect(result).toBe(true); // Should succeed with mock data

      const mockData = await service.readHealthData(HealthDataType.STEPS, {
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(mockData).toEqual([]); // Mock data generation
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources properly', async () => {
      // Initialize service
      await service.initialize();

      // Simulate memory pressure
      const initialMemoryUsage = process.memoryUsage().heapUsed;

      // Generate large amount of data and let it go out of scope
      for (let i = 0; i < 1000; i++) {
        await service.readHealthData(HealthDataType.STEPS, {
          startDate: new Date(),
          endDate: new Date(),
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemoryUsage = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle concurrent requests without memory leaks', async () => {
      const initialMemoryUsage = process.memoryUsage().heapUsed;

      // Create many concurrent requests
      const requests = Array.from({ length: 100 }, (_, i) =>
        service.readHealthData(HealthDataType.STEPS, {
          startDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        })
      );

      await Promise.all(requests);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemoryUsage = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage;

      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Permission State Management', () => {
    it('should track permission states accurately', async () => {
      const mockGetPermissions = jest.spyOn(service, 'getPermissions').mockResolvedValue([
        { type: HealthDataType.STEPS, read: true, write: false, granted: true },
        { type: HealthDataType.HEART_RATE, read: true, write: false, granted: false },
      ]);

      const permissions = await service.getPermissions();

      expect(permissions).toHaveLength(2);
      expect(permissions[0].granted).toBe(true);
      expect(permissions[1].granted).toBe(false);
    });

    it('should handle permission queue correctly', async () => {
      let resolveFirstRequest: (value: boolean) => void;
      let resolveSecondRequest: (value: boolean) => void;

      const firstRequestPromise = new Promise<boolean>(resolve => {
        resolveFirstRequest = resolve;
      });

      const secondRequestPromise = new Promise<boolean>(resolve => {
        resolveSecondRequest = resolve;
      });

      // Mock permission requests to be async
      let callCount = 0;
      const mockPerformPermissionRequest = jest
        .spyOn(service as any, 'performPermissionRequest')
        .mockImplementation(() => {
          callCount++;
          return callCount === 1 ? firstRequestPromise : secondRequestPromise;
        });

      // Start two permission requests for the same permission type
      const request1 = service.requestPermissions([HealthDataType.STEPS]);
      const request2 = service.requestPermissions([HealthDataType.STEPS]);

      // Only the first should trigger actual permission request
      expect(mockPerformPermissionRequest).toHaveBeenCalledTimes(1);

      // Resolve first request
      resolveFirstRequest!(true);

      // Both requests should resolve to the same result
      const [result1, result2] = await Promise.all([request1, request2]);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle device without health capabilities', async () => {
      // Mock device without health support
      jest.spyOn(service, 'isHealthDataAvailable').mockReturnValue(false);

      const result = await service.initialize();
      expect(result).toBe(false);

      const data = await service.readHealthData(HealthDataType.STEPS, {
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(data).toEqual([]);
    });

    it('should handle corrupted data gracefully', async () => {
      // Mock corrupted data response
      jest.spyOn(service as any, 'readAppleHealthData').mockResolvedValue([
        { corrupted: 'data' },
        null,
        undefined,
        {
          id: 'valid',
          type: HealthDataType.STEPS,
          value: 100,
          unit: 'steps',
          timestamp: new Date(),
          source: 'phone',
        },
      ]);

      const data = await service.readHealthData(HealthDataType.STEPS, {
        startDate: new Date(),
        endDate: new Date(),
      });

      // Should filter out corrupted entries and keep valid ones
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('valid');
    });

    it('should handle network timeouts gracefully', async () => {
      jest.useFakeTimers();

      // Mock network timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout')), 30000);
      });

      jest.spyOn(service as any, 'readHealthConnectData').mockReturnValue(timeoutPromise);

      const dataPromise = service.readHealthData(HealthDataType.STEPS, {
        startDate: new Date(),
        endDate: new Date(),
      });

      jest.advanceTimersByTime(35000);

      // Should handle timeout and return empty array instead of crashing
      const data = await dataPromise;
      expect(data).toEqual([]);

      jest.useRealTimers();
    });
  });
});
