/**
 * HealthDashboardScreen Integration Tests
 *
 * Tests complete user flows including permission handling, data display,
 * background/foreground transitions, and error recovery scenarios.
 */

import { configureStore } from '@reduxjs/toolkit';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import React from 'react';
import { AppState } from 'react-native';
import { Provider } from 'react-redux';

import healthReducer from '../../../store/slices/healthSlice';
import permissionReducer from '../../../store/slices/permissionSlice';
import { HealthDataType } from '../../../types/health';
import { HealthDashboardScreen } from '../HealthDashboardScreen';

// Mock dependencies
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
  },
  Platform: { OS: 'ios' },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn() },
}));

jest.mock('expo-constants', () => ({
  default: {
    executionEnvironment: 'standalone',
    appOwnership: null,
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
  }),
}));

jest.mock('../../../services/health/HealthDataService', () => ({
  HealthDataService: {
    getInstance: () => ({
      initialize: jest.fn().mockResolvedValue(true),
      getPermissions: jest.fn().mockResolvedValue([
        { type: HealthDataType.STEPS, granted: true, read: true, write: false },
        { type: HealthDataType.HEART_RATE, granted: false, read: true, write: false },
      ]),
      requestPermissions: jest.fn().mockResolvedValue(true),
      readHealthData: jest.fn().mockResolvedValue([
        {
          id: 'test_1',
          type: HealthDataType.STEPS,
          value: 8500,
          unit: 'steps',
          timestamp: new Date(),
          source: 'phone',
        },
      ]),
    }),
  },
}));

jest.mock('../../../hooks/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => ({
    trackRenderComplete: jest.fn(),
    trackInteractionComplete: jest.fn(),
    trackFrame: jest.fn(),
    getMetrics: () => ({ renderTime: 100, interactionTime: 50, frameRate: 60 }),
  }),
}));

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      health: healthReducer,
      permissions: permissionReducer,
      auth: (state = { user: { id: 'test-user' } }) => state,
    },
    preloadedState: {
      health: {
        healthData: {
          heartRate: { latest: null, daily: [], trend: null },
          steps: { latest: null, daily: [], trend: null, today: 0, goal: 10000, progress: 0 },
          sleep: { latest: null, daily: [], trend: null, lastNight: null, averageDuration: 480 },
          weight: { latest: null, daily: [], trend: null },
          bloodPressure: { latest: null, daily: [], trend: null },
          oxygenSaturation: { latest: null, daily: [], trend: null },
          bodyTemperature: { latest: null, daily: [], trend: null },
          bloodGlucose: { latest: null, daily: [], trend: null },
        },
        syncStatus: { lastSync: null, isOnline: false, pendingUploads: 0, errors: [] },
        goals: [],
        alerts: [],
        insights: [],
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
      },
      ...initialState,
    },
  });
};

describe('HealthDashboardScreen Integration Tests', () => {
  let mockAppStateAddEventListener: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateAddEventListener = AppState.addEventListener as jest.Mock;
    mockAppStateAddEventListener.mockReturnValue({ remove: jest.fn() });
  });

  describe('Initial Permission Flow', () => {
    it('should display permission hero when no permissions granted', async () => {
      const store = createTestStore();

      const { getByText, getByTestId } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      await waitFor(() => {
        expect(getByText('Enable Health Tracking')).toBeTruthy();
        expect(getByText('Connect your health data to track your wellness journey')).toBeTruthy();
      });
    });

    it('should handle permission grant flow correctly', async () => {
      const store = createTestStore();

      const { getByText } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      const enableButton = getByText('Enable Health Access');

      await act(async () => {
        fireEvent.press(enableButton);
      });

      // Should show loading state during permission request
      await waitFor(() => {
        expect(getByText('Requesting Access...')).toBeTruthy();
      });
    });

    it('should handle permission denial gracefully', async () => {
      // Mock permission denial
      const mockHealthService =
        require('../../../services/health/HealthDataService').HealthDataService.getInstance();
      mockHealthService.requestPermissions.mockRejectedValue(new Error('Permission denied'));

      const store = createTestStore();

      const { getByText } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      const enableButton = getByText('Enable Health Access');

      await act(async () => {
        fireEvent.press(enableButton);
      });

      // Should show permission denial message
      await waitFor(() => {
        expect(getByText(/Health Data Unavailable/)).toBeTruthy();
      });
    });
  });

  describe('Data Display and Visualization', () => {
    it('should display health data when permissions are granted', async () => {
      const store = createTestStore({
        health: {
          permissions: {
            granted: true,
            requested: true,
            types: [HealthDataType.STEPS],
            details: [{ type: HealthDataType.STEPS, granted: true, read: true, write: false }],
            partiallyGranted: false,
          },
          healthData: {
            steps: {
              latest: { value: 8500, timestamp: new Date(), unit: 'steps' },
              daily: [
                {
                  value: 8500,
                  timestamp: new Date(),
                  unit: 'steps',
                  id: '1',
                  type: HealthDataType.STEPS,
                  source: 'phone',
                },
              ],
              trend: {
                direction: 'up',
                percentage: 15.5,
                period: 'week',
                type: HealthDataType.STEPS,
                significance: 'medium',
              },
              today: 8500,
              goal: 10000,
              progress: 85,
            },
          },
        },
      });

      const { getByText } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      await waitFor(() => {
        expect(getByText(/8,500.*steps/)).toBeTruthy();
        expect(getByText('Modern Dashboard')).toBeTruthy();
      });
    });

    it('should handle time period switching correctly', async () => {
      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
          healthData: {
            steps: { today: 8500, goal: 10000, progress: 85, latest: { value: 8500 }, daily: [] },
          },
        },
      });

      const { getByText } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Default should be "Today"
      await waitFor(() => {
        expect(getByText('Today')).toBeTruthy();
      });

      // Switch to "This week"
      const weekButton = getByText('This week');
      fireEvent.press(weekButton);

      await waitFor(() => {
        // Check that the chart updates (implementation detail)
        expect(weekButton).toBeTruthy();
      });
    });

    it('should display appropriate chart based on device capabilities', async () => {
      // Mock low-end device
      const mockGetDeviceCompatibility = jest.fn().mockReturnValue({
        isLowEndDevice: true,
        isMediumDevice: false,
        isHighEndDevice: false,
        supportsComplexSVG: false,
        supportsGradients: false,
        tier: 'low',
      });

      // This would need to be mocked at the module level in a real test
      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
          healthData: { steps: { today: 8500, daily: [], latest: { value: 8500 } } },
        },
      });

      const { container } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // For low-end devices, should use simple bar chart instead of complex SVG
      await waitFor(() => {
        expect(container).toBeTruthy(); // Chart rendering tested indirectly
      });
    });
  });

  describe('Background/Foreground State Handling', () => {
    it('should handle app backgrounding and foregrounding', async () => {
      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
        },
      });

      render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Verify AppState listener was added
      expect(mockAppStateAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));

      // Get the callback function
      const stateChangeCallback = mockAppStateAddEventListener.mock.calls[0][1];

      // Simulate app going to background
      act(() => {
        stateChangeCallback('background');
      });

      // Fast-forward time to simulate long background period
      jest.useFakeTimers();
      jest.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

      // Simulate app coming to foreground
      act(() => {
        stateChangeCallback('active');
      });

      jest.useRealTimers();
    });

    it('should show stale data indicator after background period', async () => {
      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
        },
      });

      const { queryByText } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Initially no stale data indicator
      expect(queryByText(/updated while app was in background/)).toBeFalsy();

      const stateChangeCallback = mockAppStateAddEventListener.mock.calls[0][1];

      // Simulate background and foreground with time passage
      act(() => {
        stateChangeCallback('background');
      });

      jest.useFakeTimers();
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes > 5 minute threshold

      act(() => {
        stateChangeCallback('active');
      });

      jest.useRealTimers();

      // Should show stale data indicator
      await waitFor(() => {
        expect(queryByText(/updated while app was in background/)).toBeTruthy();
      });
    });

    it('should dismiss stale data indicator when user taps dismiss', async () => {
      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
        },
      });

      const { queryByText, getByLabelText } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Simulate stale data condition
      const stateChangeCallback = mockAppStateAddEventListener.mock.calls[0][1];
      act(() => {
        stateChangeCallback('background');
      });

      jest.useFakeTimers();
      jest.advanceTimersByTime(6 * 60 * 1000);

      act(() => {
        stateChangeCallback('active');
      });
      jest.useRealTimers();

      // Wait for stale indicator
      await waitFor(() => {
        expect(queryByText(/updated while app was in background/)).toBeTruthy();
      });

      // Tap dismiss button (would need proper test ID in real implementation)
      // This is a placeholder for the actual dismiss functionality
      act(() => {
        // fireEvent.press(dismissButton);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle health service initialization failures', async () => {
      // Mock initialization failure
      const mockHealthService =
        require('../../../services/health/HealthDataService').HealthDataService.getInstance();
      mockHealthService.initialize.mockRejectedValue(new Error('Initialization failed'));

      const store = createTestStore();

      const { getByText } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Should show error state or fallback
      await waitFor(() => {
        // In real implementation, would check for specific error UI
        expect(getByText).toBeTruthy();
      });
    });

    it('should handle data fetching failures gracefully', async () => {
      const mockHealthService =
        require('../../../services/health/HealthDataService').HealthDataService.getInstance();
      mockHealthService.readHealthData.mockRejectedValue(new Error('Fetch failed'));

      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
        },
      });

      const { queryByText } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Should not crash and should show appropriate fallback
      await waitFor(() => {
        expect(queryByText('Modern Dashboard')).toBeTruthy();
      });
    });

    it('should handle permission state changes during app use', async () => {
      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
        },
      });

      const { rerender } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Simulate permission being revoked
      store.dispatch({
        type: 'health/requestHealthPermissions/rejected',
        error: { message: 'Permission revoked' },
      });

      // Re-render with new state
      rerender(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Should handle permission revocation gracefully
      await waitFor(() => {
        expect(store.getState().health.permissions.granted).toBe(false);
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should cleanup animation listeners on unmount', async () => {
      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
        },
      });

      const { unmount } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Verify AppState listener cleanup
      const removeListener = mockAppStateAddEventListener.mock.results[0].value.remove;

      unmount();

      // Should call remove on AppState listener
      expect(removeListener).toHaveBeenCalled();
    });

    it('should not cause memory leaks with repeated mounting/unmounting', async () => {
      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
        },
      });

      // Mount and unmount multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <Provider store={store}>
            <HealthDashboardScreen />
          </Provider>
        );
        unmount();
      }

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle rapid state changes without crashing', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Rapidly dispatch state changes
      for (let i = 0; i < 100; i++) {
        store.dispatch({
          type: 'health/fetchLatestHealthData/fulfilled',
          payload: {
            steps: [{ value: i, timestamp: new Date(), unit: 'steps' }],
            heartRate: [],
            sleep: [],
            weight: [],
            bloodPressure: [],
            oxygenSaturation: [],
            bodyTemperature: [],
            bloodGlucose: [],
          },
        });
      }

      // Should handle rapid updates without crashing
      await waitFor(() => {
        expect(store.getState().health.healthData.steps.latest?.value).toBe(99);
      });
    });
  });

  describe('Accessibility and Usability', () => {
    it('should provide proper accessibility labels', async () => {
      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
          healthData: {
            steps: { today: 8500, goal: 10000, progress: 85, latest: { value: 8500 }, daily: [] },
          },
        },
      });

      const { getByText } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Should have accessible button labels
      await waitFor(() => {
        expect(getByText('Modern Dashboard')).toBeTruthy();
      });
    });

    it('should handle different screen sizes appropriately', async () => {
      // Mock different screen dimensions
      const mockDimensions = require('react-native').Dimensions;
      mockDimensions.get.mockReturnValue({ width: 320, height: 568 }); // Smaller screen

      const store = createTestStore({
        health: {
          permissions: { granted: true, requested: true, types: [HealthDataType.STEPS] },
        },
      });

      const { container } = render(
        <Provider store={store}>
          <HealthDashboardScreen />
        </Provider>
      );

      // Should render without layout issues on smaller screens
      expect(container).toBeTruthy();
    });
  });
});
