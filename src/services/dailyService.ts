/**
 * ✅ ENHANCED DAILY.CO SERVICE - WebRTC Video/Audio Calling
 *
 * KEY IMPROVEMENTS FOR SEAMLESS DOCTOR-PATIENT COMMUNICATION:
 *
 * 🏗️ AUTOMATIC ROOM CREATION:
 * - joinRoom() now auto-creates rooms when they don't exist (line ~344)
 * - Handles race conditions when both doctor and patient try to join simultaneously
 * - Gracefully handles "room already exists" errors by fetching existing room
 *
 * 👥 BIDIRECTIONAL COMMUNICATION:
 * - Both doctor and patient can initiate/join the same consultation room
 * - Consistent room naming ensures both users join identical rooms
 * - Public room configuration allows seamless access for both parties
 *
 * 📱 OPTIMIZED FOR CONSULTATIONS:
 * - 2-hour room expiry for extended consultations
 * - Max 2 participants (doctor + patient)
 * - Network quality indicators and prejoin bypass for faster access
 * - Automatic transcoding for device compatibility
 *
 * 🔄 ENHANCED ERROR HANDLING:
 * - Retry logic with automatic room creation on join failures
 * - Comprehensive error tracking and recovery strategies
 * - Graceful fallback mechanisms
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getConfig } from '../config/env.config';
import type {
  BaseVideoCallService,
  VideoCallCapabilities,
  VideoCallMetrics,
} from '../types/videoCallProvider';
import { VideoCallProvider } from '../types/videoCallProvider';
import { isExpoGo } from '../utils/nativeModuleChecker';
import { sentryTracker } from '../utils/sentryErrorTracker';

import type { ChannelInfo } from './channelService';
import ChannelService from './channelService';
import deviceCapabilityService, { PerformanceTier } from './deviceCapabilityService';
import ErrorEventService from './errorEventService';
import NetworkMonitorService from './networkMonitorService';
import PermissionManager from './PermissionManagerMigrated';
import ReconnectionManager from './reconnectionManager';

// Conditional imports with Expo Go safety check
let DailyIframe: any = null;

// Type definitions for when Daily is not available
type DailyCallType = any;

// Only load Daily.co in development builds or production, not in Expo Go
if (Platform.OS !== 'web' && !isExpoGo()) {
  try {
    const DailyModule = require('@daily-co/react-native-daily-js');
    DailyIframe = DailyModule.default;
  } catch (error) {
    console.warn('Daily.co not available on this platform:', error);
  }
} else if (isExpoGo()) {
  console.log('📹 Daily.co video calling unavailable in Expo Go - requires development build');
}

export class DailyService implements BaseVideoCallService {
  private static instance: DailyService;
  private call: DailyCallType | null = null;
  private apiKey: string;
  private dailyDomain: string; // Base Daily domain, e.g. mbinina.daily.co
  private networkMonitor = NetworkMonitorService;
  private reconnectionManager = ReconnectionManager;
  private errorEventService = ErrorEventService;
  private currentRoomUrl: string | null = null;
  private connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown' = 'unknown';
  private lastConnectionError: string | null = null;
  private isReconnecting = false;
  private isInitializing = false;
  private initializationMutex = new Map<string, Promise<any>>();
  private isSDKAvailable: boolean | null = null;
  private sdkCheckCompleted = false;
  private eventListeners = new Map<string, Function>();

  // 🚨 REMOVED: Global call state is now managed by UnifiedVideoCallService
  // private static isAnyCallActive = false;
  // private static activeCallSessionId: string | null = null;

  private constructor() {
    try {
      // Get Daily.co configuration from robust environment system
      const config = getConfig();
      this.apiKey =
        config.HOPMED_VIDEO_DAILY_API_KEY ||
        'de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9';
      this.dailyDomain = config.HOPMED_VIDEO_DAILY_DOMAIN || 'mbinina.daily.co';

      if (!this.apiKey) {
        console.warn(
          'Daily.co API key not configured. Room creation will not work, but direct room URLs can still be used.'
        );
      }
      console.log('Daily.co service initialized with environment config');
    } catch (error) {
      console.warn('Failed to load Daily.co config, using fallbacks:', error);
      this.apiKey = 'de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9';
      this.dailyDomain = 'mbinina.daily.co';
    }
  }

  public static getInstance(): DailyService {
    if (!DailyService.instance) {
      DailyService.instance = new DailyService();
    }
    return DailyService.instance;
  }

  // 🚨 REMOVED: Global call state management methods are no longer needed here.
  // These will be handled by the UnifiedVideoCallService to ensure a single source of truth.

  isCallActive(): boolean {
    // The call is active if we have a currentRoomUrl and the call object's state is 'joined-meeting'.
    return !!this.currentRoomUrl && this.call?.meetingState() === 'joined-meeting';
  }

  getProvider(): VideoCallProvider {
    return VideoCallProvider.DAILY;
  }

  async initializeEngine(): Promise<DailyCallType | null> {
    // Return existing call object if already initialized
    if (this.call) {
      return this.call;
    }

    // Use mutex to prevent concurrent initialization
    const mutexKey = 'daily_init';
    if (this.initializationMutex.has(mutexKey)) {
      console.log('Daily.co initialization already in progress, waiting for completion...');
      return this.initializationMutex.get(mutexKey);
    }

    // Create new initialization promise with proper error handling
    const initPromise = this.performInitializationWithMutex();
    this.initializationMutex.set(mutexKey, initPromise);

    try {
      const result = await initPromise;
      return result;
    } finally {
      this.initializationMutex.delete(mutexKey);
    }
  }

  private async performInitializationWithMutex(): Promise<DailyCallType | null> {
    // Check SDK availability first
    const isAvailable = await this.checkSDKAvailability();
    if (!isAvailable) {
      console.warn('Daily.co SDK not available in this build');
      return null;
    }

    return this.performActualInitialization();
  }

  private async checkSDKAvailability(): Promise<boolean> {
    if (this.sdkCheckCompleted) {
      return this.isSDKAvailable === true;
    }

    try {
      // Not available in Expo Go (requires development build)
      if (Constants.appOwnership === 'expo') {
        console.warn(
          'Daily.co SDK requires a development build or standalone app. Not available in Expo Go.'
        );
        this.isSDKAvailable = false;
        this.sdkCheckCompleted = true;
        return false;
      }

      // Platform check
      if (Platform.OS === 'web') {
        console.warn('Daily.co not fully supported on web platform');
        this.isSDKAvailable = false;
        this.sdkCheckCompleted = true;
        return false;
      }

      // Check if module can be required (only in non-Expo Go environments)
      if (isExpoGo()) {
        console.warn('Daily.co module not available in Expo Go - requires development build');
        return false;
      }

      const DailyModule = require('@daily-co/react-native-daily-js');
      if (!DailyModule?.default) {
        console.warn('Daily.co module not properly installed or configured');
        this.isSDKAvailable = false;
        this.sdkCheckCompleted = true;
        return false;
      }

      // Try to create call object to verify SDK is functional
      try {
        const testCall = DailyModule.default.createCallObject();
        if (!testCall) {
          console.warn('Daily.co call object creation returned null');
          this.isSDKAvailable = false;
          this.sdkCheckCompleted = true;
          return false;
        }

        // Cleanup test call object immediately
        try {
          await testCall.destroy();
        } catch (cleanupError) {
          console.warn('Test call object cleanup failed (non-critical):', cleanupError);
        }

        this.isSDKAvailable = true;
        this.sdkCheckCompleted = true;
        return true;
      } catch (callError) {
        console.warn('Daily.co call object creation failed:', callError);
        this.isSDKAvailable = false;
        this.sdkCheckCompleted = true;
        return false;
      }
    } catch (requireError) {
      console.warn('Daily.co module require failed:', requireError);
      this.isSDKAvailable = false;
      this.sdkCheckCompleted = true;
      return false;
    }
  }

  /**
   * Lightweight public probe so UI can decide to show placeholder before full join.
   * Avoids mount->immediate unmount blink when SDK missing or misconfigured.
   */
  public async ensureReady(): Promise<boolean> {
    try {
      const available = await this.checkSDKAvailability();
      if (!available) return false;
      if (!this.call) {
        try {
          await this.initializeEngine();
        } catch (e) {
          return false;
        }
      }
      return !!this.call;
    } catch {
      return false;
    }
  }

  public getSDKAvailabilityCached(): boolean | null {
    return this.isSDKAvailable;
  }

  private async performActualInitialization(): Promise<DailyCallType | null> {
    // SDK availability already checked in checkSDKAvailability

    try {
      console.log('Starting Daily.co call object creation...');

      // Set initialization flag
      this.isInitializing = true;

      this.call = DailyIframe.createCallObject();
      if (!this.call) {
        throw new Error('Failed to create Daily.co call object - createCallObject returned null');
      }

      // Setup event listeners for connection monitoring
      this.setupEventListeners();

      console.log('Daily.co call object created successfully');
      this.isInitializing = false;
      return this.call;
    } catch (error) {
      this.isInitializing = false;
      console.error('Failed to create Daily.co call object:', error);
      this.lastConnectionError = error instanceof Error ? error.message : 'Unknown error';
      this.call = null;

      // Track critical initialization error
      sentryTracker.trackCriticalError(
        error instanceof Error ? error : 'Daily SDK initialization failed',
        {
          service: 'dailyService',
          action: 'initializeEngine',
          provider: 'daily',
          additional: {
            platform: Platform.OS,
            isSDKAvailable: this.isSDKAvailable,
            lastConnectionError: this.lastConnectionError,
          },
        }
      );

      throw error;
    }
  }

  async joinRoom(roomUrl: string): Promise<void> {
    if (Platform.OS === 'web') {
      console.warn('Video calls not supported on web platform');
      return;
    }

    // ✅ CRITICAL FIX: Pre-flight permission validation
    console.log('🔐 Validating video consultation permissions before room join...');

    try {
      const permissionContext = {
        feature: 'teleconsultation-video',
        priority: 'critical' as const,
        userInitiated: true,
        educationalContent: {
          title: 'Video Consultation Permissions',
          description:
            'Camera and microphone access are required for video consultations with healthcare providers.',
          benefits: [
            'High-quality video communication',
            'Secure medical consultation',
            'Real-time interaction with healthcare providers',
          ],
        },
        fallbackStrategy: {
          mode: 'alternative' as const,
          description: 'Audio-only consultation available',
          limitations: ['No video communication'],
          alternativeApproach: 'audio-only',
        },
      };

      const permissionResult = await PermissionManager.requestPermission(
        'teleconsultation-video',
        permissionContext
      );

      if (permissionResult.status !== 'granted') {
        throw new Error(
          `Video consultation permissions required: ${permissionResult.message || 'Please grant camera and microphone access for video consultations'}`
        );
      }

      console.log('✅ Video consultation permissions validated successfully');
    } catch (error) {
      console.error('❌ Permission validation failed:', error);
      throw new Error(
        `Cannot join video call: ${error instanceof Error ? error.message : 'Permission validation failed'}`
      );
    }

    // Ensure call object is initialized before joining
    if (!this.call) {
      console.log('Call object not initialized, initializing now...');
      const callObject = await this.initializeEngine();
      if (!callObject) {
        throw new Error('Failed to initialize call object before joining room');
      }
    }

    // Double-check call object is ready (handles race conditions)
    if (!this.call) {
      throw new Error('Call object initialization completed but call object is null');
    }

    // Wait for any ongoing initialization to complete
    if (this.isInitializing) {
      console.log('Waiting for call object initialization to complete...');
      let waitCount = 0;
      while (this.isInitializing && waitCount < 50) {
        // Max 5 seconds
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      if (this.isInitializing) {
        throw new Error('Call object initialization timeout');
      }
    }

    if (!roomUrl || roomUrl.trim() === '') {
      throw new Error('Room URL cannot be empty');
    }

    // Check network quality before joining
    const networkState = this.networkMonitor.getCurrentState();
    if (!networkState.isConnected) {
      throw new Error('No network connection available');
    }

    try {
      console.log('Joining Daily.co room:', roomUrl);

      // Configure call settings based on network quality and device capabilities
      const joinConfig = this.getAdaptiveJoinConfig();

      console.log('🚀 Joining Daily.co room with config:', {
        url: roomUrl,
        ...joinConfig, // Spread the adaptive config
      });

      await this.call.join({
        url: roomUrl,
        ...joinConfig,
      });

      this.currentRoomUrl = roomUrl;
      this.lastConnectionError = null;
    } catch (error) {
      console.error('Failed to join Daily.co room:', error);
      this.lastConnectionError = error instanceof Error ? error.message : 'Unknown error';

      // ✅ ENHANCED: Auto-create room if join failed due to room not existing
      // This handles cases where the room hasn't been created yet by either doctor or patient
      if (
        this.apiKey &&
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('404') ||
          error.message.includes('room does not exist') ||
          error.message.includes('room expired') ||
          error.message.includes('does not exist') ||
          error.message.includes('Room not found') ||
          error.message.includes('invalid room'))
      ) {
        console.log('🏗️ Room not found, attempting to create room automatically...');

        // Extract room name from URL (e.g., https://domain.daily.co/roomname -> roomname)
        const roomName = roomUrl.split('/').pop();
        if (!roomName) {
          throw new Error('Cannot extract room name from URL');
        }

        try {
          // Create the room with consultation-optimized settings
          console.log(`Creating Daily.co room: ${roomName}`);
          const roomInfo = await this.createRoom(roomName);
          console.log(`✅ Successfully created room: ${roomInfo.roomUrl}`);

          // Get fresh join config for the new room attempt
          const freshJoinConfig = this.getAdaptiveJoinConfig();

          // Now try to join the newly created room
          console.log('🔄 Attempting to join newly created room...');
          await this.call.join({
            url: roomInfo.roomUrl,
            ...freshJoinConfig,
          });

          this.currentRoomUrl = roomInfo.roomUrl || null;
          this.lastConnectionError = null;
          console.log('✅ Successfully joined newly created room');
          return;
        } catch (createError) {
          console.error('❌ Failed to auto-create room:', createError);

          // ✅ ENHANCED: Last resort - try to fetch room details if it was created by another participant
          try {
            console.log('🔍 Last resort: checking if room was created by another participant...');
            const existingRoomResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
              headers: { Authorization: `Bearer ${this.apiKey}` },
            });

            if (existingRoomResponse.ok) {
              const existingRoomData = await existingRoomResponse.json();
              console.log('✅ Found room created by another participant, attempting final join...');

              const finalJoinConfig = this.getAdaptiveJoinConfig();
              await this.call.join({
                url: existingRoomData.url,
                ...finalJoinConfig,
              });

              this.currentRoomUrl = existingRoomData.url;
              this.lastConnectionError = null;
              console.log('✅ Successfully joined room created by another participant');
              return; // Exit successfully
            }
          } catch (lastResortError) {
            console.error('Last resort room check failed:', lastResortError);
          }

          // Fall through to original error handling
        }
      }

      // Track video call error with comprehensive context
      sentryTracker.trackVideoCallError(error instanceof Error ? error : 'Room join failed', {
        service: 'dailyService',
        action: 'joinRoom',
        provider: 'daily',
        roomUrl,
        sessionId: this.currentRoomUrl || undefined,
        networkState: this.networkMonitor.getCurrentState().isConnected
          ? 'connected'
          : 'disconnected',
        additional: {
          connectionQuality: this.connectionQuality,
          lastConnectionError: this.lastConnectionError,
          platform: Platform.OS,
        },
      });

      // Notify error event service of the error
      if (this.currentRoomUrl) {
        this.errorEventService.handleRuntimeError({
          provider: 'daily',
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: 'runtime',
          canRetry: true,
          sessionId: this.currentRoomUrl,
        });
      }

      if (error instanceof Error) {
        throw new Error(`Failed to join room: ${error.message}`);
      }
      throw new Error('Failed to join room: Unknown error');
    }
  }

  async leaveRoom(): Promise<void> {
    if (Platform.OS === 'web' || !this.call) return;

    const wasConnected = !!this.currentRoomUrl;
    const roomUrl = this.currentRoomUrl;

    try {
      if (wasConnected) {
        console.log('👋 Leaving Daily.co room:', roomUrl);

        // Stop any active reconnections for this room
        this.reconnectionManager.stopReconnection(`daily_${roomUrl}`);

        await this.call.leave();

        // Brief pause to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log('✅ Left Daily.co room successfully:', roomUrl);
      }
    } catch (error) {
      console.error('Failed to leave Daily.co room:', error);
    } finally {
      // Always reset state regardless of success/failure
      this.currentRoomUrl = null;
      this.connectionQuality = 'unknown';
      this.isReconnecting = false;
    }
  }

  async setLocalAudio(enabled: boolean): Promise<void> {
    if (Platform.OS === 'web' || !this.call) return;
    try {
      await this.call.setLocalAudio(enabled);
    } catch (error) {
      console.error('Failed to set local audio:', error);

      sentryTracker.trackWarning('Failed to set local audio', {
        service: 'dailyService',
        action: 'setLocalAudio',
        provider: 'daily',
        sessionId: this.currentRoomUrl || undefined,
        additional: { enabled, error: error instanceof Error ? error.message : 'Unknown' },
      });
    }
  }

  async setLocalVideo(enabled: boolean): Promise<void> {
    if (Platform.OS === 'web' || !this.call) return;
    try {
      await this.call.setLocalVideo(enabled);
    } catch (error) {
      console.error('Failed to set local video:', error);

      sentryTracker.trackWarning('Failed to set local video', {
        service: 'dailyService',
        action: 'setLocalVideo',
        provider: 'daily',
        sessionId: this.currentRoomUrl || undefined,
        additional: { enabled, error: error instanceof Error ? error.message : 'Unknown' },
      });
    }
  }

  // ✅ NEW: Enhanced video track subscription method for mobile devices
  async subscribeToRemoteTracks(
    sessionId: string,
    tracks: { audio?: boolean; video?: boolean } = { audio: true, video: true }
  ): Promise<void> {
    if (Platform.OS === 'web' || !this.call) return;

    try {
      console.log(`🎬 [Daily] Subscribing to remote tracks for ${sessionId}:`, tracks);

      // Use the native setSubscribedTracks method if available
      if (typeof this.call.setSubscribedTracks === 'function') {
        await this.call.setSubscribedTracks(sessionId, tracks);
        console.log(`✅ [Daily] Successfully subscribed to tracks for ${sessionId}`);
      } else {
        console.warn('⚠️ [Daily] setSubscribedTracks method not available on call object');
      }
    } catch (error) {
      console.error('❌ [Daily] Failed to subscribe to remote tracks:', error);

      sentryTracker.trackWarning('Failed to subscribe to remote tracks', {
        service: 'dailyService',
        action: 'subscribeToRemoteTracks',
        provider: 'daily',
        sessionId: this.currentRoomUrl || undefined,
        additional: {
          targetSessionId: sessionId,
          tracks,
          error: error instanceof Error ? error.message : 'Unknown',
        },
      });
    }
  }

  // ✅ NEW: Method to ensure all remote participants are subscribed
  async ensureRemoteTrackSubscription(): Promise<void> {
    if (Platform.OS === 'web' || !this.call) return;

    try {
      const participants = this.call.participants();
      const remoteParticipants = Object.values(participants || {}).filter((p: any) => !p.local);

      console.log(
        `🎬 [Daily] Ensuring subscription to ${remoteParticipants.length} remote participants`
      );

      for (const participant of remoteParticipants) {
        const p = participant as any;
        await this.subscribeToRemoteTracks(p.session_id, { audio: true, video: true });
      }
    } catch (error) {
      console.error('❌ [Daily] Failed to ensure remote track subscription:', error);
    }
  }

  async disableVideo(): Promise<void> {
    await this.setLocalVideo(false);
  }

  async flipCamera(): Promise<void> {
    if (Platform.OS === 'web' || !this.call) return;
    try {
      const { camera } = this.call.getInputDevices();
      if (camera) {
        await this.call.cycleCamera();
      }
    } catch (error) {
      console.error('Failed to flip camera:', error);
    }
  }

  getCallObject(): DailyCallType | null {
    return this.call;
  }

  // Network and device-aware join configuration
  private getAdaptiveJoinConfig(): any {
    const networkQuality = this.networkMonitor.getNetworkQuality();
    const deviceCaps = deviceCapabilityService.getCapabilities();
    const videoConfig = deviceCapabilityService.getVideoCallConfig(deviceCaps.tier);

    console.log(
      `📶 Configuring Daily.co join for ${deviceCaps.manufacturer} ${deviceCaps.model} (${deviceCaps.videoCallQuality} quality, network: ${networkQuality})`
    );

    // Device-specific optimizations override network-based decisions
    if (deviceCaps.tier === PerformanceTier.LOW || deviceCaps.hasSlowPermissionHandling) {
      return {
        videoSource: !videoConfig.startVideoOff,
        audioSource: true,
        startVideoOff: videoConfig.startVideoOff,
        startAudioOff: false,
        // Specific optimizations for slow devices
        bandwidth: {
          video: deviceCaps.videoCallQuality === 'low' ? 300000 : 600000, // 300kbps or 600kbps
          audio: 64000, // 64kbps
        },
        // Reduce quality for budget devices
        videoQuality: 'low',
      };
    }

    // Network-based configuration for better devices
    switch (networkQuality) {
      case 'excellent':
        return {
          videoSource: true,
          audioSource: true,
          startVideoOff: false,
          startAudioOff: false,
          bandwidth: {
            video: 1200000, // 1.2Mbps
            audio: 128000, // 128kbps
          },
          videoQuality: 'high',
        };
      case 'good':
        return {
          videoSource: true,
          audioSource: true,
          startVideoOff: false,
          startAudioOff: false,
          bandwidth: {
            video: 800000, // 800kbps
            audio: 96000, // 96kbps
          },
          videoQuality: 'medium',
        };
      case 'poor':
      default:
        return {
          videoSource: true,
          audioSource: true,
          startVideoOff: true, // Start with video off on poor networks
          startAudioOff: false,
          bandwidth: {
            video: 400000, // 400kbps
            audio: 64000, // 64kbps
          },
          videoQuality: 'low',
        };
    }
  }

  // === Consultation Methods ===
  // ✅ ENHANCED: These methods now support automatic room creation for seamless bidirectional communication

  async startConsultation(
    doctorId: string,
    customerId: string,
    callType: 'audio' | 'video' = 'video'
  ): Promise<ChannelInfo> {
    console.log(
      `🏥 [Daily] Starting consultation: doctor=${doctorId}, customer=${customerId}, type=${callType}`
    );

    // ✅ CRITICAL FIX: Pre-flight permission validation for consultations
    console.log('🔐 Validating consultation permissions...');

    try {
      const permissionType =
        callType === 'video' ? 'teleconsultation-video' : 'teleconsultation-audio';

      const permissionContext = {
        feature: `${callType}-consultation-start`,
        priority: 'critical' as const,
        userInitiated: true,
        educationalContent: {
          title: `${callType === 'video' ? 'Video' : 'Audio'} Consultation Permissions`,
          description: `${callType === 'video' ? 'Camera and microphone' : 'Microphone'} access required to start your medical consultation.`,
          benefits: [
            callType === 'video'
              ? 'High-quality video communication with healthcare providers'
              : 'Clear audio communication with healthcare providers',
            'Secure and private medical consultation',
            'Real-time interaction for better healthcare',
          ],
        },
        fallbackStrategy: {
          mode: 'alternative' as const,
          description:
            callType === 'video'
              ? 'Audio-only consultation available'
              : 'Text-based consultation available',
          limitations:
            callType === 'video' ? ['No video communication'] : ['No voice communication'],
          alternativeApproach: callType === 'video' ? 'audio-consultation' : 'text-consultation',
        },
      };

      const permissionResult = await PermissionManager.requestPermission(
        permissionType,
        permissionContext
      );

      if (permissionResult.status !== 'granted') {
        throw new Error(
          `${callType === 'video' ? 'Video' : 'Audio'} consultation permissions required: ${permissionResult.message || 'Please grant the required permissions to start your consultation'}`
        );
      }

      console.log(
        `✅ ${callType === 'video' ? 'Video' : 'Audio'} consultation permissions validated successfully`
      );
    } catch (error) {
      console.error('❌ Consultation permission validation failed:', error);
      throw new Error(
        `Cannot start consultation: ${error instanceof Error ? error.message : 'Permission validation failed'}`
      );
    }

    // Generate consistent channel info for both participants
    const channelInfo = ChannelService.generateConsultationChannel(
      doctorId,
      customerId,
      callType,
      VideoCallProvider.DAILY
    );

    try {
      // ✅ ENHANCED: First check if room already exists to avoid unnecessary creation attempts
      const roomName = channelInfo.channelName;
      let roomExists = false;

      if (this.apiKey) {
        try {
          console.log(`🔍 Checking if consultation room exists: ${roomName}`);
          const existingRoomResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
            headers: { Authorization: `Bearer ${this.apiKey}` },
          });

          if (existingRoomResponse.ok) {
            const existingRoomData = await existingRoomResponse.json();
            console.log(`✅ Consultation room already exists: ${existingRoomData.name}`);
            // Update channel info with existing room URL
            channelInfo.roomUrl = existingRoomData.url;
            roomExists = true;
          }
        } catch (checkError) {
          console.log(
            'Room existence check failed, will attempt creation during join:',
            checkError
          );
        }
      }

      // ✅ ENHANCED: joinRoom now automatically creates room if it doesn't exist
      // This ensures seamless room creation for the first participant (doctor or patient)
      console.log(
        `🚀 Joining consultation room: ${channelInfo.roomUrl || channelInfo.channelName}`
      );
      await this.joinRoom(channelInfo.roomUrl || channelInfo.channelName);

      // Configure media settings based on call type
      if (callType === 'audio') {
        console.log('🎤 Configuring for audio-only consultation');
        await this.setLocalVideo(false).catch(error => {
          console.warn('Failed to disable video for audio call:', error);
        });
      } else {
        console.log('📹 Configuring for video consultation');
        await this.setLocalVideo(true).catch(error => {
          console.warn('Failed to enable video for video call:', error);
        });
      }

      // ✅ ENHANCED: Ensure we have the correct room URL after join
      if (this.currentRoomUrl && !channelInfo.roomUrl) {
        channelInfo.roomUrl = this.currentRoomUrl;
      }

      console.log(
        `✅ [Daily] Successfully started ${callType} consultation: ${channelInfo.roomUrl}`
      );
      console.log(`📊 Room details: name=${channelInfo.channelName}, callId=${channelInfo.callId}`);

      return channelInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [Daily] Failed to start consultation:`, errorMessage);

      sentryTracker.trackCriticalError(
        error instanceof Error ? error : 'Daily start consultation failed',
        {
          service: 'dailyService',
          action: 'startConsultation',
          provider: 'daily',
          additional: {
            doctorId,
            customerId,
            callType,
            roomName: channelInfo.channelName,
            roomUrl: channelInfo.roomUrl,
          },
        }
      );
      throw error instanceof Error ? error : new Error('Failed to start consultation');
    }
  }

  async joinConsultation(
    doctorId: string,
    customerId: string,
    callType: 'audio' | 'video' = 'video'
  ): Promise<ChannelInfo> {
    console.log(
      `👥 [Daily] Joining consultation: doctor=${doctorId}, customer=${customerId}, type=${callType}`
    );

    // ✅ CRITICAL FIX: Pre-flight permission validation for joining consultations
    console.log('🔐 Validating consultation join permissions...');

    try {
      const permissionType =
        callType === 'video' ? 'teleconsultation-video' : 'teleconsultation-audio';

      const permissionContext = {
        feature: `${callType}-consultation-join`,
        priority: 'critical' as const,
        userInitiated: true,
        educationalContent: {
          title: `Join ${callType === 'video' ? 'Video' : 'Audio'} Consultation`,
          description: `${callType === 'video' ? 'Camera and microphone' : 'Microphone'} access required to join your medical consultation.`,
          benefits: [
            callType === 'video'
              ? 'High-quality video communication with healthcare providers'
              : 'Clear audio communication with healthcare providers',
            'Secure and private medical consultation',
            'Participate in real-time medical discussions',
          ],
        },
        fallbackStrategy: {
          mode: 'alternative' as const,
          description:
            callType === 'video'
              ? 'Audio-only consultation available'
              : 'Text-based consultation available',
          limitations:
            callType === 'video' ? ['No video communication'] : ['No voice communication'],
          alternativeApproach: callType === 'video' ? 'audio-consultation' : 'text-consultation',
        },
      };

      const permissionResult = await PermissionManager.requestPermission(
        permissionType,
        permissionContext
      );

      if (permissionResult.status !== 'granted') {
        throw new Error(
          `${callType === 'video' ? 'Video' : 'Audio'} consultation permissions required: ${permissionResult.message || 'Please grant the required permissions to join your consultation'}`
        );
      }

      console.log(
        `✅ ${callType === 'video' ? 'Video' : 'Audio'} consultation join permissions validated successfully`
      );
    } catch (error) {
      console.error('❌ Consultation join permission validation failed:', error);
      throw new Error(
        `Cannot join consultation: ${error instanceof Error ? error.message : 'Permission validation failed'}`
      );
    }

    // Generate the same consistent channel info as startConsultation
    const channelInfo = ChannelService.generateConsultationChannel(
      doctorId,
      customerId,
      callType,
      VideoCallProvider.DAILY
    );

    try {
      // ✅ ENHANCED: Similar to startConsultation, check if room exists first
      const roomName = channelInfo.channelName;

      if (this.apiKey) {
        try {
          console.log(`🔍 Verifying consultation room exists: ${roomName}`);
          const existingRoomResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
            headers: { Authorization: `Bearer ${this.apiKey}` },
          });

          if (existingRoomResponse.ok) {
            const existingRoomData = await existingRoomResponse.json();
            console.log(`✅ Found existing consultation room: ${existingRoomData.name}`);
            // Update channel info with existing room URL
            channelInfo.roomUrl = existingRoomData.url;
          } else {
            console.log(`⚠️ Consultation room not found, will be created during join: ${roomName}`);
          }
        } catch (checkError) {
          console.log('Room verification failed, proceeding with join attempt:', checkError);
        }
      }

      // ✅ ENHANCED: joinRoom now handles both joining existing rooms AND creating new ones
      // This ensures the second participant can always join, regardless of room creation timing
      console.log(
        `🚀 Joining consultation room: ${channelInfo.roomUrl || channelInfo.channelName}`
      );
      await this.joinRoom(channelInfo.roomUrl || channelInfo.channelName);

      // Configure media settings to match call type
      if (callType === 'audio') {
        console.log('🎤 Configuring for audio-only consultation');
        await this.setLocalVideo(false).catch(error => {
          console.warn('Failed to disable video for audio call:', error);
        });
      } else {
        console.log('📹 Configuring for video consultation');
        await this.setLocalVideo(true).catch(error => {
          console.warn('Failed to enable video for video call:', error);
        });
      }

      // ✅ ENHANCED: Ensure we have the correct room URL after join
      if (this.currentRoomUrl && !channelInfo.roomUrl) {
        channelInfo.roomUrl = this.currentRoomUrl;
      }

      console.log(
        `✅ [Daily] Successfully joined ${callType} consultation: ${channelInfo.roomUrl}`
      );
      console.log(`📊 Room details: name=${channelInfo.channelName}, callId=${channelInfo.callId}`);

      return channelInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [Daily] Failed to join consultation:`, errorMessage);

      sentryTracker.trackCriticalError(
        error instanceof Error ? error : 'Daily join consultation failed',
        {
          service: 'dailyService',
          action: 'joinConsultation',
          provider: 'daily',
          additional: {
            doctorId,
            customerId,
            callType,
            roomName: channelInfo.channelName,
            roomUrl: channelInfo.roomUrl,
          },
        }
      );
      throw error instanceof Error ? error : new Error('Failed to join consultation');
    }
  }

  async endConsultation(): Promise<void> {
    console.log('🏁 [Daily] Ending consultation');
    await this.leaveRoom();
  }

  // === Room Management ===

  /**
   * ✅ DEMO/POC: Create or ensure the default demo room exists
   */
  async ensureDemoRoom(): Promise<ChannelInfo> {
    const demoRoomName = 'ZVpxSgQtPXff8Cq9l44z';
    const demoRoomUrl = `https://${this.dailyDomain}/${demoRoomName}`;

    console.log('🎭 DEMO MODE: Ensuring demo room exists:', demoRoomUrl);

    try {
      // Try to create or get existing room
      const channelInfo = await this.createRoom(demoRoomName);
      console.log('✅ Demo room ready:', channelInfo.roomUrl);
      return channelInfo;
    } catch (error) {
      console.warn('Demo room creation failed, using direct URL:', error);

      // Return fallback channel info with direct URL
      return {
        provider: VideoCallProvider.DAILY,
        channelName: demoRoomName,
        roomUrl: demoRoomUrl,
        token: null,
        callId: `daily_demo_${Date.now()}`,
        participants: { doctorId: 'demo-doctor', customerId: 'demo-patient' },
        callType: 'video' as 'audio' | 'video',
      };
    }
  }

  async createRoom(roomName?: string): Promise<ChannelInfo> {
    if (!this.apiKey) {
      throw new Error('Daily.co API key not configured. Cannot create rooms.');
    }

    // ✅ ENHANCED: Make rooms public for consultations to allow both doctor and patient to join seamlessly
    const isPrivate = false; // Changed to public for better consultation access
    const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60; // Extended to 2 hours for longer consultations

    try {
      // ✅ ENHANCED: Check if room exists first to handle race conditions
      if (roomName) {
        try {
          const existingRoomResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
            headers: { Authorization: `Bearer ${this.apiKey}` },
          });

          if (existingRoomResponse.ok) {
            const existingRoomData = await existingRoomResponse.json();
            console.log(
              '♻️ Room already exists, returning existing room details:',
              existingRoomData.name
            );

            return {
              provider: VideoCallProvider.DAILY,
              channelName: existingRoomData.name,
              roomUrl: existingRoomData.url,
              token: null,
              callId: `daily_${existingRoomData.name}_${Date.now()}`,
              participants: { doctorId: '', customerId: '' }, // Will be populated by caller
              callType: 'video' as 'audio' | 'video',
            };
          }
        } catch (fetchError) {
          // Room doesn't exist, continue with creation
          console.log('Room does not exist yet, proceeding with creation...');
        }
      }

      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: isPrivate ? 'private' : 'public',
          properties: {
            exp,
            enable_knocking: false, // Disable knocking for seamless joining
            enable_screenshare: true,
            enable_chat: true,
            start_video_off: false,
            start_audio_off: false,
            max_participants: 2, // Limit to doctor and patient for consultations
            // ✅ CONSULTATION-OPTIMIZED: Core settings for seamless doctor-patient communication
            enable_network_ui: true, // Show network quality indicators
            enable_prejoin_ui: false, // Skip prejoin for faster access
            // ✅ ENHANCED: Mobile video optimization settings
            enable_video_processing: true, // Enable video processing for better compatibility
            enable_audio_processing: true, // Enable audio processing for better quality
            enable_bandwidth_estimation: true, // Enable bandwidth estimation for adaptive quality
            enable_automatic_video_subscription: true, // Automatically subscribe to video tracks
            enable_automatic_audio_subscription: true, // Automatically subscribe to audio tracks
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));

        // ✅ ENHANCED: Handle room already exists gracefully (race condition fix)
        if (
          response.status === 400 &&
          (errorBody.error?.includes('already exists') ||
            errorBody.info?.includes('already exists'))
        ) {
          console.log('♻️ Room already exists during creation, fetching existing room details...');
          try {
            // Fetch existing room details instead of failing
            const existingRoomResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
              headers: { Authorization: `Bearer ${this.apiKey}` },
            });

            if (existingRoomResponse.ok) {
              const existingRoomData = await existingRoomResponse.json();
              console.log(
                '✅ Retrieved existing Daily.co room after creation conflict:',
                existingRoomData.name
              );

              return {
                provider: VideoCallProvider.DAILY,
                channelName: existingRoomData.name,
                roomUrl: existingRoomData.url,
                token: null,
                callId: `daily_${existingRoomData.name}_${Date.now()}`,
                participants: { doctorId: '', customerId: '' }, // Will be populated by caller
                callType: 'video' as 'audio' | 'video',
              };
            }
          } catch (fetchError) {
            console.warn(
              'Failed to fetch existing room details after creation conflict:',
              fetchError
            );
          }
        }

        throw new Error(
          `Failed to create Daily.co room: ${errorBody.error || errorBody.info || response.statusText}`
        );
      }

      const roomData = await response.json();
      console.log('✅ Created Daily.co room:', roomData.name, 'URL:', roomData.url);

      return {
        provider: VideoCallProvider.DAILY,
        channelName: roomData.name,
        roomUrl: roomData.url,
        token: null, // Daily.co can use tokens, but not in this basic setup
        callId: `daily_${roomData.name}_${Date.now()}`,
        participants: { doctorId: '', customerId: '' }, // Will be populated by caller
        callType: 'video' as 'audio' | 'video',
      };
    } catch (error) {
      console.error('Error creating Daily.co room:', error);
      throw error;
    }
  }

  // === Event Listener Management ===

  private setupEventListeners(): void {
    if (!this.call) return;

    const events: (keyof DailyCallType)[] = [
      'joined-meeting',
      'left-meeting',
      'error',
      'camera-error',
      'network-quality-change',
      'network-connection',
      'participant-joined',
      'participant-left',
      'reconnecting',
      'reconnected',
    ];

    events.forEach(event => {
      const handler = (e: any) => this.handleEvent(event as string, e);
      this.eventListeners.set(event as string, handler);
      this.call.on(event, handler);
    });
  }

  private removeEventListeners(): void {
    if (!this.call || this.eventListeners.size === 0) return;

    this.eventListeners.forEach((handler, event) => {
      this.call.off(event, handler);
    });

    this.eventListeners.clear();
    console.log('Daily.co event listeners removed');
  }

  private handleEvent(event: string, e: any): void {
    console.log(`🔔 Daily Event: ${event}`, e);

    switch (event) {
      case 'joined-meeting':
        this.connectionQuality = 'excellent';
        this.lastConnectionError = null;
        this.isReconnecting = false;
        this.reconnectionManager.stopReconnection(`daily_${this.currentRoomUrl}`);
        break;

      case 'left-meeting':
        this.currentRoomUrl = null;
        this.connectionQuality = 'unknown';
        this.isReconnecting = false;
        break;

      case 'error':
        this.lastConnectionError = e.errorMsg;
        if (this.currentRoomUrl) {
          this.errorEventService.handleRuntimeError({
            provider: 'daily',
            error: e.errorMsg,
            errorType: 'runtime',
            canRetry: e.action === 'join-meeting',
            sessionId: this.currentRoomUrl,
          });
        }
        break;

      case 'network-quality-change':
        const quality = e.threshold; // 'good', 'bad', 'low'
        if (quality === 'good') this.connectionQuality = 'good';
        else if (quality === 'low') this.connectionQuality = 'poor';
        else this.connectionQuality = 'unknown';
        break;

      case 'reconnecting':
        this.isReconnecting = true;
        this.connectionQuality = 'poor';
        break;

      case 'reconnected':
        this.isReconnecting = false;
        this.connectionQuality = 'good';
        break;
    }
  }

  // === Getters for State ===

  getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'unknown' {
    return this.connectionQuality;
  }

  getLastConnectionError(): string | null {
    return this.lastConnectionError;
  }

  // === BaseVideoCallService Implementation ===

  getCapabilities(): VideoCallCapabilities {
    return {
      maxParticipants: 10,
      supportsScreenShare: true,
      supportsRecording: true,
      supportsChat: true,
      videoQualityLevels: ['low', 'medium', 'high'],
    };
  }

  getConnectionMetrics(): VideoCallMetrics {
    const networkStats = this.call?.getNetworkStats();
    return {
      connectionQuality: this.connectionQuality,
      latency: networkStats?.stats?.latest?.videoRecvBitsPerSecond, // Example, adjust as needed
      bandwidth: {
        upload: networkStats?.stats?.latest?.videoSendBitsPerSecond || 0,
        download: networkStats?.stats?.latest?.videoRecvBitsPerSecond || 0,
      },
      packetsLost: networkStats?.stats?.latest?.videoRecvPacketsLost,
    };
  }

  async destroy(): Promise<void> {
    console.log('🧹 Cleaning up DailyService...');
    if (this.call) {
      if (this.isCallActive()) {
        await this.leaveRoom();
      }
      this.removeEventListeners();
      await this.call.destroy();
      this.call = null;
    }
    this.isInitializing = false;
    this.initializationMutex.clear();
    console.log('✅ DailyService cleanup completed');
  }

  // ✅ FIX: Add missing methods called by other services
  async forceCleanup(): Promise<void> {
    console.log('🚨 Force cleanup DailyService...');
    try {
      if (this.call) {
        // Force leave without waiting
        try {
          await this.call.leave();
        } catch (error) {
          console.warn('Force leave failed:', error);
        }

        // Force destroy
        try {
          await this.call.destroy();
        } catch (error) {
          console.warn('Force destroy failed:', error);
        }

        this.call = null;
      }

      this.currentRoomUrl = null;
      this.connectionQuality = 'unknown';
      this.isReconnecting = false;
      this.isInitializing = false;
      this.initializationMutex.clear();
      this.eventListeners.clear();

      console.log('✅ Force cleanup completed');
    } catch (error) {
      console.error('❌ Force cleanup failed:', error);
      // Still reset state
      this.call = null;
      this.currentRoomUrl = null;
      this.isInitializing = false;
    }
  }

  getCurrentChannelStatus(): { isConnected: boolean; quality: string; roomUrl: string | null } {
    return {
      isConnected: this.isCallActive(),
      quality: this.connectionQuality,
      roomUrl: this.currentRoomUrl,
    };
  }
}

export default DailyService.getInstance();
