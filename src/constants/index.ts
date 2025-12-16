import { Dimensions, Platform } from 'react-native';

// API Configuration - Uses robust environment system with graceful fallbacks
import { getConfig } from '../config/env.config';

// Screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const DIMENSIONS = {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  IS_SMALL_DEVICE: SCREEN_WIDTH < 375,
  IS_LARGE_DEVICE: SCREEN_WIDTH > 414,
} as const;

// Colors - Design system (✅ MATCHED TO OLD APP - PERFECT COLORS)
export const COLORS = {
  // ✅ PERFECT: Brand gradient colors from old app (3-color gradient with blue middle)
  GRADIENT_START: '#2b216ce6', // Deep purple - OLD APP EXACT
  GRADIENT_MIDDLE: '#2c4775f0', // Medium blue - OLD APP EXACT
  GRADIENT_END: '#299B6D', // Vibrant teal/green - OLD APP EXACT
  GRADIENT_END_ALPHA: '#299B6D', // Same as gradient end

  // ✅ PERFECT: Primary colors from old app
  PRIMARY: '#33DDA0', // Bright mint/teal green - OLD APP EXACT
  PRIMARY_DARK: '#049964', // Darker green variant - OLD APP EXACT
  PRIMARY_LIGHT: '#33DDA0', // Bright mint green

  // ✅ PERFECT: Secondary colors from old app
  SECONDARY: '#299B6D', // Teal from gradient end - OLD APP EXACT
  SECONDARY_DARK: '#2c4775f0', // Blue from gradient middle - OLD APP EXACT
  SECONDARY_LIGHT: '#33DDA0', // Bright mint green

  // ✅ PERFECT: Button colors from old app
  BUTTON_PRIMARY: '#33DDA0', // Primary button green - OLD APP EXACT
  BUTTON_SUCCESS: '#33DDA0', // Success green - OLD APP EXACT
  BUTTON_SUCCESS_DARK: '#049964', // Darker success green - OLD APP EXACT
  BUTTON_SEMI_TRANSPARENT: '#3d887e9c', // Semi-transparent teal overlay - OLD APP EXACT
  BUTTON_SECONDARY: '#D9D9D91A', // Semi-transparent white overlay - OLD APP EXACT

  // ✅ PERFECT: Form input backgrounds from old app
  INPUT_BG_PRIMARY: '#3D527F', // Primary input blue - OLD APP EXACT
  INPUT_BG_SECONDARY: '#3d6f80', // Secondary input teal - OLD APP EXACT
  INPUT_BG_OVERLAY: '#3d887e9c', // Semi-transparent teal - OLD APP EXACT

  // Semantic colors
  SUCCESS: '#33DDA0', // Mint green - OLD APP EXACT
  WARNING: '#FFD147', // Gold (keep existing)
  ERROR: '#f25c5c', // Red - OLD APP EXACT
  INFO: '#299B6D', // Teal

  // Neutral colors - Updated to match designs
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  LIGHT_GRAY: '#F5F5F5',

  // ✅ PERFECT: Glass morphism and backgrounds from old app
  GLASS_BG: 'rgba(217,217,217,0.10)', // OLD APP EXACT
  GLASS_BG_DARKER: '#3d887e9c', // Semi-transparent teal - OLD APP EXACT
  GLASS_BORDER: 'rgba(255,255,255,0.2)', // OLD APP EXACT
  GLASS_BORDER_LIGHT: 'rgba(255,255,255,0.3)', // OLD APP EXACT
  GLASS_BORDER_SUBTLE: 'rgba(0,0,0,0.1)', // OLD APP shadow/border

  // ✅ PERFECT: Text colors from old app
  TEXT_PRIMARY: '#ffffff', // White text - OLD APP EXACT
  TEXT_SECONDARY: '#DFDFDFC9', // Light gray text - OLD APP EXACT
  TEXT_TERTIARY: '#BFC2E9', // Tertiary text
  TEXT_MUTED: '#BFC2E9', // Muted text
  TEXT_PLACEHOLDER: '#87898a', // Placeholder text - OLD APP EXACT
  TEXT_DARK: '#0D3D3A', // Dark text for bright buttons
  TEXT_ON_LIGHT: '#0D3D3A', // Dark text on light backgrounds

  // ✅ PERFECT: Background colors from old app
  BACKGROUND_PRIMARY: '#2b216ce6', // Base purple background - OLD APP EXACT
  SURFACE: 'rgba(217,217,217,0.10)', // OLD APP EXACT
  CARD: 'rgba(255, 255, 255, 0.15)', // OLD APP cards
  CARD_DARKER: 'rgba(255, 255, 255, 0.9)',
  OVERLAY_DARK: '#00000056', // Dark overlay - OLD APP EXACT
  OVERLAY_SEMI: '#0000004f', // Semi-dark overlay - OLD APP EXACT
  SEPARATOR_LINE: '#3e5b80', // Line separators - OLD APP EXACT

  // Health-specific colors - From designs
  HEALTH_RED: '#FF6B6B', // Heart rate
  HEALTH_BLUE: '#2196F3', // Blood oxygen
  HEALTH_GREEN: '#4AE890', // Steps/activity
  HEALTH_PURPLE: '#9C27B0', // Sleep/weight
  HEALTH_ORANGE: '#FF9800', // Blood pressure
  HEALTH_PINK: '#E91E63', // Temperature
  HEALTH_GOLD: '#FFD147', // Calories

  // ✅ PERFECT: Gradient arrays from old app (3-color gradient!)
  BRAND_GRADIENT: ['#2b216ce6', '#2c4775f0', '#299B6D'], // OLD APP EXACT (3 colors!)
  BRAND_GRADIENT_LOCATIONS: [0.2, 0.4, 0.8], // OLD APP EXACT locations
  BRAND_GRADIENT_START: { x: 0.2, y: 0.4 }, // OLD APP EXACT start position

  // Additional design colors
  ACCENT_GREEN: '#33DDA0', // Main accent - OLD APP EXACT
  MESSAGE_GREEN: '#15B37A', // Chat messages
  LIGHT_GREEN: '#D2F6E7', // Light green backgrounds
  SHADOW_GREEN: 'rgba(44,111,101,0.12)', // Green shadows
} as const;

// Typography - Updated to match design fonts
export const TYPOGRAPHY = {
  // Font families - From design files
  FONT_FAMILY_PRIMARY: Platform.select({
    ios: 'DM Sans',
    android: 'DM Sans',
    web: 'DM Sans, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  }),
  FONT_FAMILY_HEADING: Platform.select({
    ios: 'Raleway',
    android: 'Raleway',
    web: 'Raleway, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  }),
  FONT_FAMILY_MONO: Platform.select({
    ios: 'IBM Plex Sans',
    android: 'IBM Plex Sans',
    web: 'IBM Plex Sans, monospace',
  }),
  // Fallbacks for system fonts
  FONT_FAMILY_REGULAR: Platform.select({
    ios: 'System',
    android: 'Roboto',
    web: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  }),
  FONT_FAMILY_MEDIUM: Platform.select({
    ios: 'System',
    android: 'Roboto_medium',
    web: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  }),
  FONT_FAMILY_BOLD: Platform.select({
    ios: 'System',
    android: 'Roboto_bold',
    web: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  }),

  // Font sizes
  FONT_SIZE_XS: 12,
  FONT_SIZE_SM: 14,
  FONT_SIZE_BASE: 16,
  FONT_SIZE_LG: 18,
  FONT_SIZE_XL: 20,
  FONT_SIZE_2XL: 24,
  FONT_SIZE_3XL: 28,
  FONT_SIZE_4XL: 32,

  // Line heights
  LINE_HEIGHT_TIGHT: 1.2,
  LINE_HEIGHT_NORMAL: 1.4,
  LINE_HEIGHT_RELAXED: 1.6,

  // Font weights
  FONT_WEIGHT_NORMAL: '400' as const,
  FONT_WEIGHT_MEDIUM: '500' as const,
  FONT_WEIGHT_SEMIBOLD: '600' as const,
  FONT_WEIGHT_BOLD: '700' as const,
} as const;

// Spacing
export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
  XXXL: 64,
} as const;

// Border radius
export const BORDER_RADIUS = {
  SM: 4,
  MD: 8,
  LG: 12,
  XL: 16,
  XXL: 24,
  ROUND: 50,
  PILL: 100,
} as const;

// Shadows - Updated to match design shadows
export const SHADOWS = {
  // Design-specific shadows
  CARD_GLASS: {
    shadowColor: 'rgba(59, 24, 200, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 7,
    elevation: 3,
  },
  CARD_ELEVATED: {
    shadowColor: 'rgba(59, 24, 200, 0.06)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 8,
  },
  HEALTH_CARD: {
    shadowColor: 'rgba(44, 119, 95, 0.07)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 9,
    elevation: 6,
  },
  SMALL_GREEN: {
    shadowColor: 'rgba(14, 134, 93, 0.09)',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  // Standard shadows (keeping for compatibility)
  SMALL: {
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  MEDIUM: {
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  LARGE: {
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// Animation durations
export const ANIMATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

const getApiConfig = () => {
  try {
    const config = getConfig();
    return {
      BASE_URL: config.HOPMED_API_BASE_URL,
      TIMEOUT: config.HOPMED_API_TIMEOUT,
      RETRY_ATTEMPTS: config.HOPMED_API_RETRY_ATTEMPTS,
      RETRY_DELAY: config.HOPMED_API_RETRY_DELAY,
    };
  } catch (error) {
    console.warn('Failed to load API config, using fallbacks:', error);
    return {
      BASE_URL: 'http://141.94.71.13:3001/api/v1',
      TIMEOUT: 30000,
      RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 1000,
    };
  }
};

export const API = getApiConfig();

// Health data constants
export const HEALTH = {
  // Heart rate ranges (bpm)
  HEART_RATE: {
    MIN_NORMAL: 60,
    MAX_NORMAL: 100,
    MIN_CRITICAL: 40,
    MAX_CRITICAL: 150,
  },

  // Blood pressure ranges (mmHg)
  BLOOD_PRESSURE: {
    SYSTOLIC_NORMAL: 120,
    DIASTOLIC_NORMAL: 80,
    SYSTOLIC_HIGH: 140,
    DIASTOLIC_HIGH: 90,
  },

  // Steps goal
  STEPS: {
    DAILY_GOAL: 10000,
    MIN_ACTIVE: 5000,
  },

  // Sleep hours
  SLEEP: {
    RECOMMENDED_MIN: 7,
    RECOMMENDED_MAX: 9,
  },

  // SpO2 levels (%)
  OXYGEN_SATURATION: {
    NORMAL_MIN: 95,
    CRITICAL_MIN: 90,
  },
} as const;

// Validation constants
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
} as const;

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKENS: 'hopmed_auth_tokens',
  USER_PREFERENCES: 'hopmed_user_preferences',
  HEALTH_DATA: 'hopmed_health_data',
  ONBOARDING_COMPLETED: 'hopmed_onboarding_completed',
  LAST_SYNC: 'hopmed_last_sync',
  DEVICE_ID: 'hopmed_device_id',
  HEALTHKIT_PERMISSION_REQUESTED: 'hopmed_healthkit_permission_requested',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection error. Please check your internet connection.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Internal server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  HEALTH_SERVICE_UNAVAILABLE: 'Health services are not available on this device.',
  WATCH_CONNECTION_FAILED: 'Failed to connect to your smartwatch.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back to HopMed!',
  REGISTRATION_SUCCESS: 'Account created successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  APPOINTMENT_BOOKED: 'Appointment booked successfully!',
  HEALTH_DATA_SYNCED: 'Health data synced successfully!',
  WATCH_CONNECTED: 'Smartwatch connected successfully!',
} as const;
