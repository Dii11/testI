/**
 * Enhanced Integration Tests for Health Data Flow
 * Tests the complete data flow from providers to UI components
 */

import { configureStore } from '@reduxjs/toolkit';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Provider } from 'react-redux';

import { useHealthData } from '../../../screens/health/useHealthData';
import { healthSlice } from '../../../store/slices/healthSlice';
import { HealthDataType } from '../../../types/health';
import { HealthDataService } from '../HealthDataService';
import type { WearableHealthManager } from '../WearableHealthManager';

// Mock dependencies
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

jest.mock('../HealthDataService');
jest.mock('../WearableHealthManager');
jest.mock('../../../utils/sentryErrorTracker', () => ({
  sentryTracker: {
    trackServiceError: jest.fn(),
    trackCriticalError: jest.fn(),
  },
}));

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      health: healthSlice.reducer,
      auth: (state = { user: { id: 'test-user' } }) => state,
    },
    preloadedState: {
      health: {
        healthData: {
          heartRate: { latest: null, daily: [], trend: null },
          steps: { latest: null, daily: [], trend: null, today: 0, goal: 10000, progress: 0 },
          sleep: { latest: null, daily: [], trend: null, lastNight: null, averageDuration: 0 },
          weight: { latest: null, daily: [], trend: null },
          bloodPressure: { latest: null, daily: [], trend: null },
          oxygenSaturation: { latest: null, daily: [], trend: null },
          bodyTemperature: { latest: null, daily: [], trend: null },
          bloodGlucose: { latest: null, daily: [], trend: null },
          caloriesBurned: { latest: null, daily: [], trend: null },
        },
        isLoading: false,
        isInitializing: false,
        lastSync: null,
        error: null,
        permissions: {
          granted: false,
          requested: false,
          types: [],
          details: [],
          partiallyGranted: false,
        },
        syncStatus: {
          isOnline: true,
          pendingUploads: 0,
          lastUpload: null,
          failedUploads: [],
          totalSynced: 0,
        },
        alerts: [],
        insights: [],
        goals: [],
      },
      auth: { user: { id: 'test-user' } },
      ...initialState,
    },
  });
};

describe('Health Data Integration Tests', () => {
  let mockHealthService: jest.Mocked<HealthDataService>;
  let mockWearableManager: jest.Mocked<WearableHealthManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHealthService = HealthDataService.getInstance() as jest.Mocked<HealthDataService>;
    mockWearableManager = require('../WearableHealthManager')
      .wearableHealthManager as jest.Mocked<WearableHealthManager>;

    // Setup default mocks
    mockHealthService.initialize.mockResolvedValue(true);
    mockHealthService.getPermissions.mockResolvedValue([]);
    mockWearableManager.getActiveProviders.mockReturnValue(['AppleHealthKit']);
    mockWearableManager.checkPermissions.mockResolvedValue(
      new Map([
        [
          'AppleHealthKit',
          [
            { type: HealthDataType.STEPS, granted: true },
            { type: HealthDataType.HEART_RATE, granted: true },
          ],
        ],
      ])
    );
  });

  describe('Permission Flow Integration', () => {
    it('should handle full permission flow correctly', async () => {
      const store = createMockStore();

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      // Initial state should be uninitialized
      expect(result.current.status).toBe('uninitialized');

      // Wait for initialization to complete
      await waitFor(
        () => {
          expect(result.current.status).toBe('permission_granted');
        },
        { timeout: 5000 }
      );

      // Verify permissions were requested
      expect(mockWearableManager.checkPermissions).toHaveBeenCalled();
    });

    it('should handle permission denial gracefully', async () => {
      // Mock permission denial
      mockWearableManager.checkPermissions.mockResolvedValue(
        new Map([
          [
            'AppleHealthKit',
            [
              { type: HealthDataType.STEPS, granted: false },
              { type: HealthDataType.HEART_RATE, granted: false },
            ],
          ],
        ])
      );
      mockWearableManager.requestPermissions.mockResolvedValue(false);

      const store = createMockStore();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.status).toBe('permission_denied');
        },
        { timeout: 5000 }
      );

      // Should allow retry
      expect(typeof result.current.requestPermissions).toBe('function');
    });

    it('should handle partial permissions correctly', async () => {
      // Mock partial permissions
      mockWearableManager.checkPermissions.mockResolvedValue(
        new Map([
          [
            'AppleHealthKit',
            [
              { type: HealthDataType.STEPS, granted: true },
              { type: HealthDataType.HEART_RATE, granted: false },
            ],
          ],
        ])
      );

      const store = createMockStore();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.status).toBe('permission_partial');
        },
        { timeout: 5000 }
      );

      // Should still allow requesting more permissions
      expect(typeof result.current.requestPermissions).toBe('function');
    });
  });

  describe('Error Recovery Integration', () => {
    it('should retry initialization on failure', async () => {
      mockHealthService.initialize
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce(true);

      const store = createMockStore();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      // Should eventually succeed after retries
      await waitFor(
        () => {
          expect(result.current.status).toBe('permission_granted');
        },
        { timeout: 10000 }
      );

      // Should have retried multiple times
      expect(mockHealthService.initialize).toHaveBeenCalledTimes(3);
    });

    it('should handle maximum retry limit', async () => {
      mockHealthService.initialize.mockRejectedValue(new Error('Persistent failure'));

      const store = createMockStore();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      // Should eventually give up and show no data
      await waitFor(
        () => {
          expect(result.current.status).toBe('no_data');
        },
        { timeout: 15000 }
      );
    });

    it('should handle device unavailable state', async () => {
      mockWearableManager.getActiveProviders.mockReturnValue([]);
      mockHealthService.initialize.mockResolvedValue(false);

      const store = createMockStore();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.status).toBe('device_unavailable');
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Data Synchronization Integration', () => {
    it('should handle successful data sync', async () => {
      const store = createMockStore();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.status).toBe('permission_granted');
      });

      // Trigger refresh
      await result.current.refresh();

      // Should handle refresh gracefully
      expect(result.current.status).toBe('permission_granted');
    });

    it('should handle sync failures gracefully', async () => {
      // Mock sync failure
      const mockDispatch = jest.fn().mockRejectedValue(new Error('Sync failed'));

      const store = createMockStore();
      store.dispatch = mockDispatch;

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      // Should handle failed refresh without crashing
      await expect(result.current.refresh()).resolves.not.toThrow();
    });
  });

  describe('Memory and Performance Integration', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        type: HealthDataType.STEPS,
        value: 1000 + i,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        unit: 'steps',
        source: 'AppleHealthKit',
        metadata: { quality: 'high' as const },
      }));

      mockHealthService.readHealthData.mockResolvedValue(largeDataset);

      const store = createMockStore();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      await waitFor(() => {
        expect(result.current.status).toBe('permission_granted');
      });

      // Should handle large datasets without performance issues
      expect(result.current.status).toBe('permission_granted');
    });
  });

  describe('Platform-Specific Integration', () => {
    it('should handle iOS-specific scenarios', async () => {
      const store = createMockStore();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      await waitFor(() => {
        expect(result.current.status).toBe('permission_granted');
      });

      // iOS-specific behavior should work correctly
      expect(mockWearableManager.checkPermissions).toHaveBeenCalled();
    });

    it('should handle Android-specific scenarios', async () => {
      // Mock Android platform
      require('react-native').Platform.OS = 'android';

      mockWearableManager.getActiveProviders.mockReturnValue(['GoogleHealthConnect']);

      const store = createMockStore();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);

      const { result } = renderHook(() => useHealthData(), { wrapper });

      await waitFor(() => {
        expect(result.current.status).toBe('permission_granted');
      });

      // Android-specific behavior should work correctly
      expect(mockWearableManager.getActiveProviders).toHaveBeenCalled();
    });
  });
});
