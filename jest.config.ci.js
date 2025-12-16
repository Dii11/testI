// Jest configuration for CI/CD pipeline
// Optimized for GitLab CI with proper reporting and coverage

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|@sentry/react-native|native-base|react-native-svg)'
  ],
  
  // Test environment configuration
  testEnvironment: 'jsdom',
  
  // Coverage configuration
  collectCoverage: true,
  // Narrow initial coverage scope for incremental rollout; expand gradually
  collectCoverageFrom: [
    'src/store/slices/healthSlice.ts',
    'src/store/slices/permissionSlice.ts'
  ],
  
  // Coverage thresholds for CI
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 30,
      statements: 30
    }
  },
  
  // Coverage reporters for CI
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'cobertura', // For GitLab CI coverage visualization
    'json-summary'
  ],
  
  // Coverage output directory
  coverageDirectory: 'coverage',
  
  // Test result processors
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'reports',
        outputName: 'jest-junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ]
  ],
  
  // Test timeout for CI (longer than development)
  testTimeout: 30000,
  
  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1'
  },
  
  // Mock configuration for CI
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Global test setup
  globals: {
    __DEV__: true,
    __TEST__: true
  },
  
  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/web-build/',
    '<rootDir>/dist/',
    '<rootDir>/.expo/',
    '.*\\.backup\\.tsx$'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output for CI debugging
  verbose: true,
  
  // Fail tests on console errors in CI
  errorOnDeprecated: true,
  
  // Performance monitoring
  detectOpenHandles: true,
  forceExit: true,
  
  // Cache configuration for CI
  cache: false // Disable cache in CI for consistent results
};