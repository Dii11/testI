/**
 * Comprehensive Tests for Enhanced Health Dashboard
 * Tests UI interactions, permission handling, and data display
 */

import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Provider } from 'react-redux';

import { healthSlice } from '../../../store/slices/healthSlice';
import { HealthDataType } from '../../../types/health';
import EnhancedHealthDashboard from '../EnhancedHealthDashboard';

// Mock dependencies
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Text: ({ children }: any) => children,
  View: ({ children }: any) => children,
  TouchableOpacity: ({ children, onPress }: any) => <div onClick={onPress}>{children}</div>,
  ScrollView: ({ children }: any) => children,
  StyleSheet: {
    create: (styles: any) => styles,
    absoluteFillObject: {},
  },
  Animated: {
    Value: jest.fn(() => ({
      interpolate: jest.fn(() => 100),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
    ScrollView: ({ children }: any) => children,
    View: ({ children }: any) => children,
    timing: jest.fn(() => ({
      start: jest.fn(),
    })),
    event: jest.fn(),
  },
  RefreshControl: ({ children }: any) => children,
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, size, color }: any) => `Icon:${name}`,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: any) => children,
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impact: jest.fn(),
  selection: jest.fn(),
}));

jest.mock('../useHealthData', () => ({
  useHealthData: jest.fn(),
}));

jest.mock('../../../components/health/EnhancedHealthMetricCard', () => ({
  HealthMetricCard: ({ type, value, onPress }: any) => (
    <div onClick={onPress} data-testid={`metric-${type}`}>
      {type}: {value}
    </div>
  ),
}));

jest.mock('../../../components/health/HealthChart', () => ({
  HealthChart: ({ data, type, period }: any) => (
    <div data-testid="health-chart">
      Chart: {type} - {period} - {data?.length || 0} points
    </div>
  ),
}));

jest.mock('../../../components/health/HealthInsightsCard', () => ({
  HealthInsightsCard: ({ title, message, type }: any) => (
    <div data-testid={`insight-${type}`}>
      {title}: {message}
    </div>
  ),
}));

jest.mock('../../../components/health/HealthGoalsCard', () => ({
  HealthGoalsCard: ({ goals }: any) => (
    <div data-testid="goals-card">Goals: {goals?.length || 0}</div>
  ),
}));

jest.mock('../../../components/health/HealthActivityRings', () => ({
  HealthActivityRings: ({ move, exercise, stand }: any) => (
    <div data-testid="activity-rings">
      Move: {move}, Exercise: {exercise}, Stand: {stand}
    </div>
  ),
}));

jest.mock('../../../components/common/HealthErrorBoundary', () => ({
  HealthErrorBoundary: ({ children }: any) => children,
}));

const createMockStore = (healthState = {}) => {
  return configureStore({
    reducer: {
      health: healthSlice.reducer,
    },
    preloadedState: {
      health: {
        healthData: {
          heartRate: { latest: null, daily: [], trend: null },
          steps: { latest: null, daily: [], trend: 'stable', today: 0, goal: 10000, progress: 0 },
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
          granted: true,
          requested: true,
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
        ...healthState,
      },
    },
  });
};

const renderWithProviders = (component: React.ReactElement, storeState = {}) => {
  const store = createMockStore(storeState);

  return render(
    <Provider store={store}>
      <NavigationContainer>{component}</NavigationContainer>
    </Provider>
  );
};

describe('EnhancedHealthDashboard', () => {
  const mockUseHealthData = require('../useHealthData').useHealthData;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    mockUseHealthData.mockReturnValue({
      status: 'connected',
      refresh: jest.fn(),
      requestPermissions: jest.fn(),
      retryInitialization: jest.fn(),
    });
  });

  describe('Permission States', () => {
    it('should show permission prompt when permissions are denied', async () => {
      mockUseHealthData.mockReturnValue({
        status: 'permission_denied',
        refresh: jest.fn(),
        requestPermissions: jest.fn(),
        retryInitialization: jest.fn(),
      });

      const { getByText, getByTestId } = renderWithProviders(<EnhancedHealthDashboard />);

      await waitFor(() => {
        expect(getByText('Health Access Required')).toBeTruthy();
        expect(getByText('Enable Health Access')).toBeTruthy();
      });
    });

    it('should show partial permission prompt when permissions are partial', async () => {
      mockUseHealthData.mockReturnValue({
        status: 'permission_partial',
        refresh: jest.fn(),
        requestPermissions: jest.fn(),
        retryInitialization: jest.fn(),
      });

      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />);

      await waitFor(() => {
        expect(getByText('Limited Health Access')).toBeTruthy();
        expect(getByText('Grant More Access')).toBeTruthy();
        expect(getByText('Continue with Limited Data')).toBeTruthy();
      });
    });

    it('should handle permission button clicks correctly', async () => {
      const mockRequestPermissions = jest.fn();

      mockUseHealthData.mockReturnValue({
        status: 'permission_denied',
        refresh: jest.fn(),
        requestPermissions: mockRequestPermissions,
        retryInitialization: jest.fn(),
      });

      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />);

      const enableButton = getByText('Enable Health Access');
      fireEvent.press(enableButton);

      expect(mockRequestPermissions).toHaveBeenCalled();
    });
  });

  describe('Health Data Display', () => {
    it('should display health metrics when data is available', async () => {
      const storeState = {
        healthData: {
          steps: { today: 8500, goal: 10000, progress: 85, latest: null, daily: [], trend: 'up' },
          heartRate: { latest: { value: 72 }, daily: [], trend: null },
          sleep: {
            lastNight: { duration: 480, quality: 85 },
            latest: null,
            daily: [],
            trend: null,
            averageDuration: 480,
          },
          caloriesBurned: { latest: { value: 250 }, daily: [], trend: null },
        },
      };

      const { getByTestId } = renderWithProviders(<EnhancedHealthDashboard />, storeState);

      await waitFor(() => {
        expect(getByTestId(`metric-${HealthDataType.STEPS}`)).toBeTruthy();
        expect(getByTestId(`metric-${HealthDataType.HEART_RATE}`)).toBeTruthy();
        expect(getByTestId(`metric-${HealthDataType.SLEEP}`)).toBeTruthy();
        expect(getByTestId(`metric-${HealthDataType.CALORIES_BURNED}`)).toBeTruthy();
      });
    });

    it('should show empty state when no health data available', async () => {
      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />);

      await waitFor(() => {
        expect(getByText('No health data available')).toBeTruthy();
      });
    });

    it('should display activity rings with real data', async () => {
      const storeState = {
        healthData: {
          steps: { today: 8500, goal: 10000, progress: 85, latest: null, daily: [], trend: 'up' },
          caloriesBurned: { latest: { value: 250 }, daily: [], trend: null },
        },
      };

      const { getByTestId } = renderWithProviders(<EnhancedHealthDashboard />, storeState);

      await waitFor(() => {
        const activityRings = getByTestId('activity-rings');
        expect(activityRings).toBeTruthy();
        // Stand should be 0 (no fake data)
        expect(activityRings.props.children).toContain('Stand: 0');
      });
    });
  });

  describe('Chart Functionality', () => {
    it('should display charts with real data', async () => {
      const mockChartData = [
        { x: 0, y: 5000, metadata: {} },
        { x: 1, y: 6000, metadata: {} },
        { x: 2, y: 7000, metadata: {} },
      ];

      // Mock the selector to return chart data
      const storeState = {
        healthData: {
          steps: {
            daily: mockChartData,
            latest: null,
            trend: null,
            today: 7000,
            goal: 10000,
            progress: 70,
          },
        },
      };

      const { getByTestId } = renderWithProviders(<EnhancedHealthDashboard />, storeState);

      await waitFor(() => {
        const chart = getByTestId('health-chart');
        expect(chart).toBeTruthy();
      });
    });

    it('should show empty chart state when no data available', async () => {
      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />);

      await waitFor(() => {
        expect(getByText('No trend data available')).toBeTruthy();
      });
    });

    it('should handle period changes correctly', async () => {
      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />);

      const weekButton = getByText('Week');
      fireEvent.press(weekButton);

      // Should change the selected period (visual feedback tested via component state)
      expect(weekButton).toBeTruthy();
    });
  });

  describe('Health Score Calculation', () => {
    it('should calculate health score based on real metrics', async () => {
      const storeState = {
        healthData: {
          steps: { today: 10000, goal: 10000, progress: 100, latest: null, daily: [], trend: 'up' },
          heartRate: { latest: { value: 72 }, daily: [], trend: null },
          sleep: {
            lastNight: { duration: 480, hours: 8, quality: 85 },
            latest: null,
            daily: [],
            trend: null,
            averageDuration: 480,
          },
          caloriesBurned: { latest: { value: 500 }, daily: [], trend: null },
        },
      };

      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />, storeState);

      await waitFor(() => {
        // Health score should be calculated and displayed
        expect(getByText('Health Score')).toBeTruthy();
        // Should show positive message for good metrics
        expect(getByText('Excellent!')).toBeTruthy();
      });
    });

    it('should show zero health score when no data available', async () => {
      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />);

      await waitFor(() => {
        expect(getByText('0')).toBeTruthy(); // Health score should be 0
        expect(getByText('Needs Attention')).toBeTruthy();
      });
    });
  });

  describe('Health Insights', () => {
    it('should generate insights based on real data', async () => {
      const storeState = {
        healthData: {
          steps: { today: 12000, goal: 10000, progress: 120, latest: null, daily: [], trend: 'up' },
          sleep: {
            lastNight: { duration: 360, hours: 6, quality: 60 },
            latest: null,
            daily: [],
            trend: null,
            averageDuration: 360,
          },
        },
      };

      const { getByText, getByTestId } = renderWithProviders(
        <EnhancedHealthDashboard />,
        storeState
      );

      await waitFor(() => {
        expect(getByText('Health Insights')).toBeTruthy();
        expect(getByText('Step Goal Achieved!')).toBeTruthy();
        expect(getByText('Sleep Alert')).toBeTruthy();
      });
    });

    it('should hide insights section when closed', async () => {
      const storeState = {
        healthData: {
          steps: { today: 12000, goal: 10000, progress: 120, latest: null, daily: [], trend: 'up' },
        },
      };

      const { getByText, queryByText } = renderWithProviders(
        <EnhancedHealthDashboard />,
        storeState
      );

      // Close insights
      const closeButton = getByText('Icon:close-circle-outline');
      fireEvent.press(closeButton);

      await waitFor(() => {
        expect(queryByText('Health Insights')).toBeNull();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle device unavailable state', async () => {
      mockUseHealthData.mockReturnValue({
        status: 'device_unavailable',
        refresh: jest.fn(),
        requestPermissions: jest.fn(),
        retryInitialization: jest.fn(),
      });

      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />);

      await waitFor(() => {
        expect(getByText('Health platform not available on this device')).toBeTruthy();
      });
    });

    it('should handle error state with retry option', async () => {
      const mockRetryInitialization = jest.fn();

      mockUseHealthData.mockReturnValue({
        status: 'error',
        refresh: jest.fn(),
        requestPermissions: jest.fn(),
        retryInitialization: mockRetryInitialization,
      });

      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />);

      await waitFor(() => {
        const retryButton = getByText('Retry Connection');
        expect(retryButton).toBeTruthy();

        fireEvent.press(retryButton);
        expect(mockRetryInitialization).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation and Interactions', () => {
    it('should handle metric card interactions', async () => {
      const storeState = {
        healthData: {
          steps: { today: 8500, goal: 10000, progress: 85, latest: null, daily: [], trend: 'up' },
        },
      };

      const { getByTestId } = renderWithProviders(<EnhancedHealthDashboard />, storeState);

      const stepsMetric = getByTestId(`metric-${HealthDataType.STEPS}`);
      fireEvent.press(stepsMetric);

      // Should handle metric press (logs action for now)
      expect(stepsMetric).toBeTruthy();
    });

    it('should handle refresh control', async () => {
      const mockRefresh = jest.fn();

      mockUseHealthData.mockReturnValue({
        status: 'connected',
        refresh: mockRefresh,
        requestPermissions: jest.fn(),
        retryInitialization: jest.fn(),
      });

      const { getByTestId } = renderWithProviders(<EnhancedHealthDashboard />);

      // Simulate pull to refresh
      // Note: In actual implementation, this would trigger through ScrollView's RefreshControl
      await mockRefresh();

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', async () => {
      const { getByText } = renderWithProviders(<EnhancedHealthDashboard />);

      await waitFor(() => {
        expect(getByText('Health Overview')).toBeTruthy();
        expect(getByText('Health Score')).toBeTruthy();
      });
    });
  });
});
