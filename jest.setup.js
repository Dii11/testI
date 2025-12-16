// Jest setup for CI/CD pipeline
// Global test configuration and mocks

import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock Expo modules
jest.mock('expo-constants', () => ({
  default: {
    executionEnvironment: 'development',
    manifest: {
      extra: {
        apiUrl: 'http://141.94.71.13:3001/api/v1', // Note: Update src/constants/index.ts to change API URL
        note: 'Primary API config is in src/constants/index.ts',
      },
    },
  },
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1, 2])),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));

// Mock Expo permission modules
jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({
      status: 'granted',
      canAskAgain: false
    })),
    getCameraPermissionsAsync: jest.fn(() => Promise.resolve({
      status: 'granted',
      canAskAgain: false
    })),
  }
}));

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(() => Promise.resolve({
      status: 'granted',
      canAskAgain: false
    })),
    getPermissionsAsync: jest.fn(() => Promise.resolve({
      status: 'granted',
      canAskAgain: false
    })),
  }
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({
    status: 'granted',
    canAskAgain: false
  })),
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({
    status: 'granted',
    canAskAgain: false
  })),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({
    status: 'granted',
    canAskAgain: false
  })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({
    status: 'granted',
    canAskAgain: false
  })),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  deviceType: 1,
  manufacturer: 'Apple',
  modelName: 'iPhone 13',
  osVersion: '15.0'
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    isFocused: jest.fn(() => true),
  }),
  useRoute: () => ({
    params: {},
    key: 'test',
    name: 'test',
  }),
  useIsFocused: () => true,
  NavigationContainer: ({ children }) => children,
}));

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: jest.fn(),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: jest.fn(),
}));

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');

  // Mock Platform
  RN.Platform.OS = 'ios';
  RN.Platform.select = jest.fn(options => options.ios || options.default);

  // Mock Dimensions
  RN.Dimensions.get = jest.fn(() => ({
    width: 375,
    height: 812,
  }));

  // Mock StatusBar
  RN.StatusBar.currentHeight = 20;

  return RN;
});

// Mock health-related libraries
jest.mock('react-native-health', () => ({
  HealthPermissions: {
    HeartRate: 'HeartRate',
    Steps: 'Steps',
    Weight: 'Weight',
    BloodPressure: 'BloodPressure',
  },
  initHealthKit: jest.fn(),
  getPermissions: jest.fn(() => Promise.resolve([])),
  requestPermissions: jest.fn(() => Promise.resolve(true)),
  getSamples: jest.fn(() => Promise.resolve([])),
  saveBloodPressureSample: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(() => Promise.resolve(true)),
  requestPermission: jest.fn(() => Promise.resolve(true)),
  readRecords: jest.fn(() => Promise.resolve({ records: [] })),
  insertRecords: jest.fn(() => Promise.resolve(true)),
}));

// Mock watch connectivity
jest.mock('react-native-watch-connectivity', () => ({
  WatchConnectivity: {
    getIsWatchAppInstalled: jest.fn(() => Promise.resolve(true)),
    getIsPaired: jest.fn(() => Promise.resolve(true)),
    getIsReachable: jest.fn(() => Promise.resolve(true)),
    sendMessage: jest.fn(() => Promise.resolve({})),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}), { virtual: true });

// Mock linear gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialIcons: 'MaterialIcons',
  FontAwesome: 'FontAwesome',
}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
}));

// Mock gesture handler
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  TouchableOpacity: 'TouchableOpacity',
  PanGestureHandler: 'PanGestureHandler',
  State: {
    BEGAN: 'BEGAN',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    END: 'END',
  },
}));

// Mock Redux Persist
jest.mock('redux-persist', () => ({
  ...jest.requireActual('redux-persist'),
  persistReducer: jest.fn((config, reducer) => reducer),
  persistStore: jest.fn(() => ({
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    getState: jest.fn(),
    replaceReducer: jest.fn(),
  })),
}));

jest.mock('redux-persist/integration/react', () => ({
  PersistGate: ({ children }) => children,
}));

// Mock form libraries
jest.mock('react-hook-form', () => ({
  ...jest.requireActual('react-hook-form'),
  Controller: ({ render, name, control, defaultValue }) => {
    return render({
      field: {
        onChange: jest.fn(),
        onBlur: jest.fn(),
        value: defaultValue,
        name,
      },
      fieldState: { error: null },
      formState: { errors: {} },
    });
  },
}));

// Mock validation libraries
jest.mock('@hookform/resolvers/yup', () => ({
  yupResolver: jest.fn(),
}));

jest.mock('yup', () => ({
  string: jest.fn(() => ({
    email: jest.fn(() => ({ required: jest.fn() })),
    min: jest.fn(() => ({ required: jest.fn() })),
    required: jest.fn(),
  })),
  object: jest.fn(() => ({
    shape: jest.fn(),
  })),
}));

// Global test utilities
global.fetch = jest.fn();

// Mock console methods in tests to avoid noise
global.console = {
  ...console,
  // Uncomment to suppress console outputs in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers for consistent testing
jest.useFakeTimers();

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.useFakeTimers();
});

// Increase timeout for CI environment
jest.setTimeout(30000);

// Mock performance APIs
global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
};

// Mock Image for React Native
global.Image = class {
  constructor() {
    setTimeout(() => {
      this.onload();
    }, 100);
  }

  onload = jest.fn();
  onerror = jest.fn();
};

// Health data mocks for testing
export const mockHealthData = {
  heartRate: {
    value: 72,
    unit: 'bpm',
    timestamp: new Date(),
    type: 'HEART_RATE',
  },
  steps: {
    value: 8500,
    unit: 'count',
    timestamp: new Date(),
    type: 'STEPS',
  },
  weight: {
    value: 70.5,
    unit: 'kg',
    timestamp: new Date(),
    type: 'WEIGHT',
  },
};

// API response mocks
export const mockApiResponse = {
  success: true,
  data: {},
  message: 'Success',
};

// User mock data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@hopmed.com',
  name: 'Test User',
  role: 'patient',
};

// Auth tokens mock
export const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
};
