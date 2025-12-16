import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

import type {
  BaseVideoCallService,
  VideoCallCapabilities,
  VideoCallMetrics,
} from '../types/videoCallProvider';
import { VideoCallProvider } from '../types/videoCallProvider';

import type { ChannelInfo } from './channelService';

// Import services
import DailyServiceInstance, { DailyService as DailyServiceClass } from './dailyService';

/**
 * Unified Video Call Service
 * Provides a consistent interface across different video call providers
 * Handles provider selection, fallbacks, and user preferences
 */
class UnifiedVideoCallService {
  private static instance: UnifiedVideoCallService;
  // Using Daily as the only supported provider
  private currentProvider: VideoCallProvider = VideoCallProvider.DAILY;
  private preferredProvider: VideoCallProvider = VideoCallProvider.DAILY;
  private currentService: BaseVideoCallService | null = null;
  private isInitialized = false;
  private fallbackEnabled = true;
  // Global guard to prevent multiple simultaneous calls across providers
  private static activeSessionId: string | null = null;
  private static sessionCleanupTimer: NodeJS.Timeout | null = null;
  private static appStateListener: any = null;

  // Storage keys
  private static readonly PREFERRED_PROVIDER_KEY = 'video_call_preferred_provider';
  private static readonly PROVIDER_SUCCESS_HISTORY_KEY = 'video_call_provider_success_history';

  public static getInstance(): UnifiedVideoCallService {
    if (!UnifiedVideoCallService.instance) {
      UnifiedVideoCallService.instance = new UnifiedVideoCallService();
    }
    return UnifiedVideoCallService.instance;
  }

  private constructor() {
    this.loadUserPreferences();
    this.setupAppStateListener();
  }

  /**
   * ✅ NEW: Get the raw call object from the current provider.
   * This is useful for passing the provider-specific object to UI components.
   */
  public getCallObject(): any | null {
    if (!this.currentService) {
      return null;
    }

    if (this.currentProvider === VideoCallProvider.DAILY) {
      return DailyServiceInstance.getCallObject();
    }

    return null;
  }

  /**
   * Load user's preferred provider from storage
   */
  private async loadUserPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(UnifiedVideoCallService.PREFERRED_PROVIDER_KEY);
      if (stored && Object.values(VideoCallProvider).includes(stored as VideoCallProvider)) {
        this.preferredProvider = stored as VideoCallProvider;
        this.currentProvider = this.preferredProvider;
        console.log(`🎯 Loaded preferred video provider: ${this.preferredProvider}`);
      }
    } catch (error) {
      console.warn('Failed to load video call provider preference:', error);
    }
  }

  /**
   * Save user's provider preference
   */
  private async saveUserPreference(provider: VideoCallProvider): Promise<void> {
    try {
      await AsyncStorage.setItem(UnifiedVideoCallService.PREFERRED_PROVIDER_KEY, provider);
      console.log(`✅ Saved video call provider preference: ${provider}`);
    } catch (error) {
      console.warn('Failed to save video call provider preference:', error);
    }
  }

  /**
   * Track provider success/failure for smart fallback decisions
   */
  private async trackProviderResult(provider: VideoCallProvider, success: boolean): Promise<void> {
    try {
      const key = UnifiedVideoCallService.PROVIDER_SUCCESS_HISTORY_KEY;
      const stored = await AsyncStorage.getItem(key);
      const history = stored ? JSON.parse(stored) : {};

      if (!history[provider]) {
        history[provider] = { successes: 0, failures: 0, lastUsed: 0 };
      }

      if (success) {
        history[provider].successes++;
      } else {
        history[provider].failures++;
      }

      history[provider].lastUsed = Date.now();

      await AsyncStorage.setItem(key, JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to track provider result:', error);
    }
  }

  /**
   * Get the service instance for the specified provider
   */
  private getProviderService(provider: VideoCallProvider): BaseVideoCallService | null {
    switch (provider) {
      case VideoCallProvider.DAILY:
        // Wrap DailyService to match interface
        return this.wrapDailyService();
      default:
        console.error('Unknown video call provider:', provider);
        return null;
    }
  }

  /**
   * Wrap DailyService to match BaseVideoCallService interface
   */
  private wrapDailyService(): BaseVideoCallService {
    return {
      initializeEngine: () => DailyServiceInstance.initializeEngine(),
      joinRoom: (roomUrl: string, options?: any) => DailyServiceInstance.joinRoom(roomUrl), // ✅ FIX: Remove options parameter
      leaveRoom: () => DailyServiceInstance.leaveRoom(),
      setLocalAudio: (enabled: boolean) => DailyServiceInstance.setLocalAudio(enabled),
      setLocalVideo: (enabled: boolean) => DailyServiceInstance.setLocalVideo(enabled),
      flipCamera: () => DailyServiceInstance.flipCamera(),
      createRoom: (roomName?: string) => DailyServiceInstance.createRoom(roomName),
      startConsultation: (doctorId: string, customerId: string, callType: 'audio' | 'video') =>
        DailyServiceInstance.startConsultation(doctorId, customerId, callType),
      joinConsultation: (doctorId: string, customerId: string, callType: 'audio' | 'video') =>
        DailyServiceInstance.joinConsultation(doctorId, customerId, callType),
      endConsultation: () => DailyServiceInstance.endConsultation(),
      getProvider: () => VideoCallProvider.DAILY,
      getCapabilities: (): VideoCallCapabilities => ({
        maxParticipants: 10,
        supportsScreenShare: true,
        supportsRecording: true,
        supportsChat: true,
        videoQualityLevels: ['low', 'medium', 'high'],
      }),
      getConnectionMetrics: (): VideoCallMetrics => ({
        connectionQuality: DailyServiceInstance.getConnectionQuality(),
        latency: undefined,
        bandwidth: undefined,
        packetsLost: undefined,
      }),
      isCallActive: () => DailyServiceInstance.isCallActive(),
      destroy: () => DailyServiceInstance.destroy(),
    };
  }

  /**
   * Initialize the service with preferred provider
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      await this.loadUserPreferences();

      const service = this.getProviderService(this.currentProvider);
      if (!service) {
        // With only Daily active, immediately force Daily
        this.currentProvider = VideoCallProvider.DAILY;
        const dailyService = this.getProviderService(VideoCallProvider.DAILY);
        if (!dailyService) {
          throw new Error('Daily provider unavailable (unexpected)');
        }
        this.currentService = dailyService;
      } else {
        this.currentService = service;
      }

      console.log(
        `🎬 Initialized unified video call service with provider: ${this.currentProvider}`
      );
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize unified video call service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Get current provider
   */
  getCurrentProvider(): VideoCallProvider {
    return this.currentProvider;
  }

  /**
   * Get preferred provider (user choice)
   */
  getPreferredProvider(): VideoCallProvider {
    return this.preferredProvider;
  }

  /**
   * Set preferred provider and switch if not currently in a call
   */
  async setPreferredProvider(
    provider: VideoCallProvider,
    forceSwitchNow: boolean = false
  ): Promise<boolean> {
    if (!Object.values(VideoCallProvider).includes(provider)) {
      console.error('Invalid provider:', provider);
      return false;
    }

    this.preferredProvider = provider;
    await this.saveUserPreference(provider);

    // Switch immediately if requested and not in an active call
    if (forceSwitchNow && (!this.currentService || !this.currentService.isCallActive())) {
      return await this.switchProvider(provider);
    }

    return true;
  }

  /**
   * Switch to a different provider
   */
  async switchProvider(newProvider: VideoCallProvider): Promise<boolean> {
    if (this.currentProvider === newProvider) {
      return true;
    }

    console.log(`🔄 Switching video call provider from ${this.currentProvider} to ${newProvider}`);

    try {
      // End current session if active
      if (this.currentService && this.currentService.isCallActive()) {
        console.warn('Cannot switch providers during active call');
        return false;
      }

      // Cleanup current service
      if (this.currentService) {
        await this.currentService
          .destroy()
          .catch(err => console.warn('Error cleaning up current service:', err));
      }

      // Switch to new provider
      this.currentProvider = newProvider;
      this.currentService = this.getProviderService(newProvider);

      if (!this.currentService) {
        console.error(`Failed to get service for provider: ${newProvider}`);
        // Fallback to previous provider or Daily as last resort
        this.currentProvider =
          this.preferredProvider !== newProvider ? this.preferredProvider : VideoCallProvider.DAILY;
        this.currentService = this.getProviderService(this.currentProvider);
        return false;
      }

      console.log(`✅ Successfully switched to provider: ${newProvider}`);
      return true;
    } catch (error) {
      console.error('Error switching video call provider:', error);
      await this.trackProviderResult(newProvider, false);
      return false;
    }
  }

  /**
   * Start a consultation with automatic fallback
   */
  async startConsultation(
    doctorId: string,
    customerId: string,
    callType: 'audio' | 'video' = 'video'
  ): Promise<ChannelInfo | null> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize video call service');
      }
    }

    if (!this.currentService) {
      throw new Error('No video call service available');
    }

    // Global guard check
    if (UnifiedVideoCallService.activeSessionId) {
      throw new Error('Another call is already active. Please end the current call first.');
    }

    try {
      console.log(`🏥 Starting ${callType} consultation with ${this.currentProvider}`);
      const result = await this.currentService.startConsultation(doctorId, customerId, callType);
      if (result) {
        UnifiedVideoCallService.activeSessionId =
          result.channelName || result.roomUrl || 'active_session';
      }
      await this.trackProviderResult(this.currentProvider, true);
      return result;
    } catch (error) {
      console.error('Error starting consultation:', error);
      await this.trackProviderResult(this.currentProvider, false);

      // Try fallback to preferred provider if different from current
      if (this.currentProvider !== this.preferredProvider) {
        console.log(`🔄 Attempting fallback to preferred provider: ${this.preferredProvider}`);
        const fallbackResult = await this.switchProvider(this.preferredProvider);
        if (fallbackResult) {
          return await this.startConsultation(doctorId, customerId, callType);
        }
      }

      return null;
    }
  }

  /**
   * Mirror of provider joinConsultation (for joining an existing session)
   */
  async joinConsultation(
    doctorId: string,
    customerId: string,
    callType: 'audio' | 'video' = 'video'
  ): Promise<ChannelInfo | null> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) throw new Error('Failed to initialize video call service');
    }
    if (!this.currentService) throw new Error('No video call service available');
    if (UnifiedVideoCallService.activeSessionId) {
      // Allow joinConsultation if same session? Simplify: block to stay consistent with original logic.
      throw new Error('Another call is already active. Please end the current call first.');
    }
    try {
      const result = await this.currentService.joinConsultation(doctorId, customerId, callType);
      if (result) {
        UnifiedVideoCallService.activeSessionId =
          result.channelName || result.roomUrl || 'active_session';
      }
      return result;
    } catch (e) {
      throw e instanceof Error ? e : new Error('Failed to join consultation');
    }
  }

  isCallActive(): boolean {
    if (this.currentService && this.currentService.isCallActive()) return true;
    return !!UnifiedVideoCallService.activeSessionId;
  }

  async endConsultation(): Promise<void> {
    if (!this.currentService) return;
    try {
      await this.currentService.endConsultation();
    } finally {
      this.clearActiveSession();
    }
  }

  /**
   * Setup app state listener for cleanup
   */
  private setupAppStateListener(): void {
    if (UnifiedVideoCallService.appStateListener) {
      return; // Already set up
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('📱 App state changed:', nextAppState);

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Start cleanup timer when app goes to background
        this.scheduleSessionCleanup();
      } else if (nextAppState === 'active') {
        // Cancel cleanup timer when app becomes active
        this.cancelSessionCleanup();
      }
    };

    UnifiedVideoCallService.appStateListener = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
  }

  /**
   * Schedule session cleanup after app backgrounding
   */
  private scheduleSessionCleanup(): void {
    // Clean up active session after 5 minutes in background
    const CLEANUP_DELAY = 5 * 60 * 1000; // 5 minutes

    if (UnifiedVideoCallService.sessionCleanupTimer) {
      clearTimeout(UnifiedVideoCallService.sessionCleanupTimer);
    }

    if (UnifiedVideoCallService.activeSessionId) {
      console.log('⏰ Scheduling session cleanup in', CLEANUP_DELAY / 1000, 'seconds');

      UnifiedVideoCallService.sessionCleanupTimer = setTimeout(() => {
        console.log('🧹 Background cleanup: ending session due to inactivity');
        this.forceEndSession();
      }, CLEANUP_DELAY);
    }
  }

  /**
   * Cancel scheduled session cleanup
   */
  private cancelSessionCleanup(): void {
    if (UnifiedVideoCallService.sessionCleanupTimer) {
      console.log('❌ Canceling scheduled session cleanup');
      clearTimeout(UnifiedVideoCallService.sessionCleanupTimer);
      UnifiedVideoCallService.sessionCleanupTimer = null;
    }
  }

  /**
   * Clear active session and cleanup timers
   */
  private clearActiveSession(): void {
    UnifiedVideoCallService.activeSessionId = null;
    this.cancelSessionCleanup();
  }

  /**
   * Force end session for cleanup scenarios
   */
  private async forceEndSession(): Promise<void> {
    try {
      if (this.currentService) {
        await this.currentService.endConsultation();
      }
    } catch (error) {
      console.warn('🧹 Force session cleanup failed:', error);
    } finally {
      this.clearActiveSession();
    }
  }

  /**
   * Cleanup method for service destruction
   */
  public async destroy(): Promise<void> {
    try {
      // End any active session
      if (UnifiedVideoCallService.activeSessionId) {
        await this.forceEndSession();
      }

      // Cleanup current service
      if (this.currentService) {
        await this.currentService.destroy();
        this.currentService = null;
      }

      // Remove app state listener
      if (UnifiedVideoCallService.appStateListener) {
        UnifiedVideoCallService.appStateListener.remove();
        UnifiedVideoCallService.appStateListener = null;
      }

      // Cancel any pending timers
      this.cancelSessionCleanup();

      this.isInitialized = false;
      console.log('🧹 UnifiedVideoCallService destroyed');
    } catch (error) {
      console.error('🧹 Error during UnifiedVideoCallService cleanup:', error);
    }
  }
}

// Export a singleton PLUS the class for future reinstatement of multi-provider logic.
const UnifiedVideoCallServiceInstance = UnifiedVideoCallService.getInstance();
export default UnifiedVideoCallServiceInstance;
export { UnifiedVideoCallService };
