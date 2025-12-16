/**
 * Tests for Enhanced Google Health Connect Provider
 * Verifies new connection monitoring, rate limiting, and permission pre-checks
 */

import { Platform } from 'react-native';

import { HealthDataType } from '../../../../types/health';
import { GoogleHealthConnectProvider } from '../GoogleHealthConnectProvider';

// Mock dependencies
jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 30 },
}));

jest.mock('expo-constants', () => ({
  executionEnvironment: 'standalone',
  modelName: 'Test Device',
  manufacturer: 'TestCorp',
  deviceName: 'Test Device',
}));

jest.mock('../../../../utils/nativeModuleChecker', () => ({
  isExpoGo: jest.fn(() => false),
}));

jest.mock('../../../../utils/sentryErrorTracker', () => ({
  sentryTracker: {
    trackServiceError: jest.fn(),
    trackCriticalError: jest.fn(),
  },
}));

// Mock Health Connect module at module level
const mockHealthConnect = {
  initialize: jest.fn(),
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
  checkPermissions: jest.fn(),
};

// Mock the require for react-native-health-connect
jest.mock('react-native-health-connect', () => mockHealthConnect, { virtual: true });

describe('Enhanced GoogleHealthConnectProvider', () => {
  let provider: GoogleHealthConnectProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GoogleHealthConnectProvider();

    // Setup default successful mocks
    mockHealthConnect.initialize.mockResolvedValue(true);
    mockHealthConnect.checkPermissions.mockResolvedValue([
      { granted: true, status: 'granted' }
    ]);
    mockHealthConnect.readRecords.mockResolvedValue([]);
  });

  describe('Connection State Monitoring', () => {
    it('should start in disconnected state', () => {
      expect(provider.getConnectionState()).toBe('disconnected');
    });

    it('should notify listeners of connection state changes', async () => {
      const stateChanges: string[] = [];
      const unsubscribe = provider.onConnectionStateChange((state) => {
        stateChanges.push(state);
      });

      await provider.initialize();

      expect(stateChanges).toContain('connecting');
      expect(stateChanges).toContain('connected');
      expect(provider.getConnectionState()).toBe('connected');

      unsubscribe();
    });

    it('should handle connection state listener errors gracefully', async () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });

      provider.onConnectionStateChange(errorListener);

      // Should not throw despite listener error
      await expect(provider.initialize()).resolves.toBe(true);
      expect(errorListener).toHaveBeenCalled();
    });

    it('should set state to disconnected on initialization failure', async () => {
      mockHealthConnect.initialize.mockRejectedValue(new Error('Init failed'));

      try {
        await provider.initialize();
      } catch (error) {
        // Expected to fail
      }

      expect(provider.getConnectionState()).toBe('disconnected');
    });
  });

  describe('Rate Limiting Protection', () => {
    it('should allow normal request rates', async () => {
      await provider.initialize();

      // Make several requests within normal limits
      for (let i = 0; i < 10; i++) {
        const permissions = await provider.checkPermissions([HealthDataType.STEPS]);
        expect(permissions).toBeDefined();
      }
    });

    it('should block requests when rate limit is exceeded', async () => {
      await provider.initialize();

      // Mock a high number of requests to trigger rate limiting
      const provider_any = provider as any;
      provider_any.rateLimiter.set(
        `checkPermissions_${Math.floor(Date.now() / 60000)}`,
        100 // Max requests per window
      );

      const permissions = await provider.checkPermissions([HealthDataType.STEPS]);

      // Should return rate limited response
      expect(permissions).toHaveLength(1);
      expect(permissions[0].granted).toBe(false);
    });

    it('should apply rate limiting to readHealthData', async () => {
      await provider.initialize();

      // Set rate limit for read operations
      const provider_any = provider as any;
      provider_any.rateLimiter.set(
        `readHealthData_${Math.floor(Date.now() / 60000)}`,
        100
      );

      const result = await provider.readHealthData(HealthDataType.STEPS, {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      // Should return empty array due to rate limiting
      expect(result).toEqual([]);
    });

    it('should apply rate limiting to requestPermissions', async () => {
      await provider.initialize();

      // Set rate limit for permission requests
      const provider_any = provider as any;
      provider_any.rateLimiter.set(
        `requestPermissions_${Math.floor(Date.now() / 60000)}`,
        100
      );

      const result = await provider.requestPermissions([HealthDataType.STEPS]);

      // Should return false due to rate limiting
      expect(result).toBe(false);
    });
  });

  describe('Permission Pre-checks', () => {
    it('should check permissions before reading data', async () => {
      await provider.initialize();

      // Reset mocks to track calls specifically for this test
      mockHealthConnect.checkPermissions.mockClear();
      mockHealthConnect.readRecords.mockClear();

      // Mock permission denied
      mockHealthConnect.checkPermissions.mockResolvedValue([
        { granted: false, status: 'denied' }
      ]);

      const result = await provider.readHealthData(HealthDataType.STEPS, {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      // Should return empty array due to permission denial
      expect(result).toEqual([]);
      expect(mockHealthConnect.checkPermissions).toHaveBeenCalled();
      expect(mockHealthConnect.readRecords).not.toHaveBeenCalled();
    });

    it('should proceed with reading when permissions are granted', async () => {
      await provider.initialize();

      // Reset mocks to track calls specifically for this test
      mockHealthConnect.checkPermissions.mockClear();
      mockHealthConnect.readRecords.mockClear();

      // Mock permission granted
      mockHealthConnect.checkPermissions.mockResolvedValue([
        { granted: true, status: 'granted' }
      ]);

      mockHealthConnect.readRecords.mockResolvedValue([
        {
          count: 1000,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        }
      ]);

      const result = await provider.readHealthData(HealthDataType.STEPS, {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      // Should proceed with reading
      expect(mockHealthConnect.checkPermissions).toHaveBeenCalled();
      expect(mockHealthConnect.readRecords).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle permission check errors gracefully', async () => {
      await provider.initialize();

      // Mock permission check error
      mockHealthConnect.checkPermissions.mockRejectedValue(new Error('Permission check failed'));

      const result = await provider.readHealthData(HealthDataType.STEPS, {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      // Should return empty array on permission check error
      expect(result).toEqual([]);
    });
  });

  describe('Enhanced Cleanup', () => {
    it('should clear all state on cleanup', async () => {
      await provider.initialize();

      // Add a connection state listener
      const listener = jest.fn();
      provider.onConnectionStateChange(listener);

      // Add some rate limiting entries
      const provider_any = provider as any;
      provider_any.rateLimiter.set('test_key', 5);

      await provider.cleanup();

      // Should be disconnected
      expect(provider.getConnectionState()).toBe('disconnected');

      // Should have cleared rate limiter
      expect(provider_any.rateLimiter.size).toBe(0);
    });
  });

  describe('Service Binding Death Handling', () => {
    it('should set connection state to disconnected on service binding death', async () => {
      await provider.initialize();
      expect(provider.getConnectionState()).toBe('connected');

      // Simulate service binding death
      const provider_any = provider as any;
      provider_any.handleServiceBindingDeath();

      expect(provider.getConnectionState()).toBe('disconnected');
    });
  });
});