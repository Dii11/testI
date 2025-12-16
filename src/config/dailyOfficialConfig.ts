/**
 * ✅ OFFICIAL DAILY.CO CONFIGURATION
 * Following best practices from official examples and documentation
 *
 * References:
 * - https://www.daily.co/blog/build-a-mobile-video-chat-app-with-dailys-react-native-javascript-library/
 * - https://www.daily.co/blog/build-your-own-audio-only-clubhouse-clone-app-with-dailys-react-native-library/
 * - react-native-daily-js-playground-main
 * - audio-only-react-native
 */

import { isExpoGo } from '../utils/nativeModuleChecker';

// Import Daily for helper functions - only in development builds
let Daily: any = null;

if (!isExpoGo()) {
  try {
    Daily = require('@daily-co/react-native-daily-js').default;
  } catch (error) {
    console.warn('Daily.co not available:', error);
  }
} else {
  console.log('📹 Daily.co config unavailable in Expo Go - using mock config');
}

export const OFFICIAL_DAILY_CONFIG = {
  // ✅ OFFICIAL: Default demo room for POC/demo apps
  DEFAULT_ROOM_URL: 'https://mbinina.daily.co/ZVpxSgQtPXff8Cq9l44z',

  // ✅ OFFICIAL: Call configuration following examples
  CALL_DEFAULTS: {
    // Join muted by default (better UX)
    JOIN_MUTED: true,

    // Audio-only mode for better performance on poor networks
    AUDIO_ONLY_MODE: false, // Set to true for audio-only apps

    // Video source configuration
    VIDEO_SOURCE_CONFIG: {
      // For video calls
      VIDEO_ENABLED: true,
      // For audio-only calls (like Clubhouse clone)
      AUDIO_ONLY: false,
    },

    // ✅ OFFICIAL: Participant limits (from Daily.co documentation)
    MAX_PARTICIPANTS: {
      FREE_TIER: 20,
      SCALE_PLAN: 100,
      ENTERPRISE: 1000,
    },

    // ✅ OFFICIAL: Room expiry (from audio example)
    DEFAULT_ROOM_EXPIRY: 10 * 60 * 1000, // 10 minutes
  },

  // ✅ OFFICIAL: Event configuration following examples
  EVENTS: {
    // Core meeting events (always needed)
    CORE_EVENTS: [
      'loading',
      'loaded',
      'load-attempt-failed',
      'joining-meeting',
      'joined-meeting',
      'left-meeting',
      'error',
    ],

    // Participant events (essential for UI updates)
    PARTICIPANT_EVENTS: ['participant-joined', 'participant-updated', 'participant-left'],

    // ✅ OFFICIAL: Track events (crucial for audio/video management)
    TRACK_EVENTS: ['track-started', 'track-stopped'],

    // ✅ OFFICIAL: Audio-specific events (from audio example)
    AUDIO_EVENTS: ['active-speaker-change'],

    // ✅ OFFICIAL: Advanced events
    ADVANCED_EVENTS: ['app-message', 'camera-error', 'recording-started', 'recording-stopped'],
  },

  // ✅ OFFICIAL: Audio call configuration (Clubhouse-style)
  AUDIO_CALL_CONFIG: {
    // User roles (from audio example)
    ROLES: {
      MODERATOR: 'MOD',
      SPEAKER: 'SPK',
      LISTENER: 'LST',
    },

    // Hand raising (from audio example)
    HAND_RAISE_EMOJI: '✋',

    // App messages (from audio example)
    APP_MESSAGES: {
      MAKE_MODERATOR: 'make-moderator',
      MAKE_SPEAKER: 'make-speaker',
      MAKE_LISTENER: 'make-listener',
      FORCE_EJECT: 'force-eject',
    },
  },

  // ✅ OFFICIAL: Video call configuration
  VIDEO_CALL_CONFIG: {
    // Tile types
    TILE_TYPES: {
      THUMBNAIL: 'thumbnail',
      HALF: 'half',
      FULL: 'full',
    },

    // Video quality settings
    VIDEO_QUALITY: {
      LOW: '240p',
      MEDIUM: '480p',
      HIGH: '720p',
      HD: '1080p',
    },

    // Layout configurations
    LAYOUTS: {
      GRID: 'grid',
      SPEAKER: 'speaker',
      PRESENTATION: 'presentation',
    },
  },

  // ✅ OFFICIAL: Error handling configuration
  ERROR_CONFIG: {
    // Retry attempts for failed operations
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second

    // Error types to handle specially
    CRITICAL_ERRORS: ['permissions-error', 'network-error', 'authentication-error'],

    // User-friendly error messages
    ERROR_MESSAGES: {
      PERMISSION_DENIED: 'Camera and microphone permissions are required.',
      NETWORK_ERROR: 'Please check your internet connection.',
      ROOM_FULL: 'This room is currently full. Please try again later.',
      ROOM_EXPIRED: 'This call has ended.',
      DEVICE_ERROR: 'There was a problem with your camera or microphone.',
    },
  },

  // ✅ OFFICIAL: Performance configuration
  PERFORMANCE_CONFIG: {
    // Memory management
    CLEANUP_DELAY: 1000, // 1 second delay before cleanup

    // Event listener management
    DEBOUNCE_DELAY: 100, // Debounce rapid events

    // UI update throttling
    UI_UPDATE_THROTTLE: 50, // 50ms throttle for UI updates

    // Connection quality thresholds
    CONNECTION_QUALITY: {
      EXCELLENT: { latency: 50, packetLoss: 0.1 },
      GOOD: { latency: 100, packetLoss: 1 },
      FAIR: { latency: 200, packetLoss: 3 },
      POOR: { latency: 500, packetLoss: 10 },
    },
  },

  // ✅ OFFICIAL: Development/Debug configuration
  DEBUG_CONFIG: {
    // Enable comprehensive logging in development
    ENABLE_LOGGING: __DEV__,

    // Log levels
    LOG_LEVELS: {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
    },

    // Performance monitoring
    TRACK_PERFORMANCE: __DEV__,

    // Debug globals (from video example)
    EXPOSE_DEBUG_GLOBALS: __DEV__,
  },
} as const;

/**
 * ✅ OFFICIAL: Helper functions following example patterns
 */
export const OfficialDailyHelpers = {
  /**
   * Create call object with proper configuration
   */
  createCallObject: (callType: 'audio' | 'video') => {
    return Daily.createCallObject({
      videoSource: callType === 'video' ? true : false,
    });
  },

  /**
   * Get user-friendly display name (from audio example)
   */
  getDisplayName: (username?: string) => {
    if (!username) return '';
    // Remove account type suffix (from audio example pattern)
    return username.slice(0, username.length - 4);
  },

  /**
   * Get account type from username (from audio example)
   */
  getAccountType: (username?: string) => {
    if (!username) return null;
    return username.slice(-3);
  },

  /**
   * Check if user has raised hand (from audio example)
   */
  hasRaisedHand: (username?: string) => {
    return username?.includes(OFFICIAL_DAILY_CONFIG.AUDIO_CALL_CONFIG.HAND_RAISE_EMOJI) || false;
  },

  /**
   * Get connection quality indicator
   */
  getConnectionQuality: (stats: { latency?: number; packetLoss?: number }) => {
    const { CONNECTION_QUALITY } = OFFICIAL_DAILY_CONFIG.PERFORMANCE_CONFIG;
    const { latency = 0, packetLoss = 0 } = stats;

    if (
      latency <= CONNECTION_QUALITY.EXCELLENT.latency &&
      packetLoss <= CONNECTION_QUALITY.EXCELLENT.packetLoss
    ) {
      return 'excellent';
    } else if (
      latency <= CONNECTION_QUALITY.GOOD.latency &&
      packetLoss <= CONNECTION_QUALITY.GOOD.packetLoss
    ) {
      return 'good';
    } else if (
      latency <= CONNECTION_QUALITY.FAIR.latency &&
      packetLoss <= CONNECTION_QUALITY.FAIR.packetLoss
    ) {
      return 'fair';
    }
    return 'poor';
  },

  /**
   * Format room expiry time
   */
  formatRoomExpiry: (expiry: number) => {
    const now = Date.now();
    const timeLeft = expiry - now;

    if (timeLeft <= 0) return 'Expired';

    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },
};

export default OFFICIAL_DAILY_CONFIG;
