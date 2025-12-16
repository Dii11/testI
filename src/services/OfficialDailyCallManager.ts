// ✅ OFFICIAL PATTERN: Direct imports following Daily.co official example
import type {
  DailyCall,
  DailyEvent,
  DailyEventObject,
  DailyParticipant,
} from '@daily-co/react-native-daily-js';
import Daily from '@daily-co/react-native-daily-js';

export interface CallConfig {
  roomUrl: string;
  userName?: string;
  callType: 'audio' | 'video';
  joinMuted?: boolean;
  token?: string; // optional: JWT for room access when using backend-created rooms
}

export interface CallManagerEvents {
  onCallStateChange?: (state: string) => void;
  onParticipantJoined?: (participant: any) => void;
  onParticipantUpdated?: (participant: any) => void;
  onParticipantLeft?: (participant: any) => void;
  onActiveSpeakerChange?: (activeSpeaker: any) => void;
  onTrackStarted?: (event: any) => void;
  onTrackStopped?: (event: any) => void;
  onError?: (error: any) => void;
  onCallEnd?: () => void;
  onRoomUpdated?: (room: any) => void;
  onAppMessage?: (message: any) => void;
  // Convenience callbacks used by screens
  onJoinedMeeting?: (event?: any) => void;
  onLeftMeeting?: () => void;
}

/**
 * Official Daily.co call manager following exact patterns from official examples
 * Based on: react-native-daily-js-playground and audio-only-react-native
 *
 * Key improvements:
 * - ✅ Audio-only mode with {videoSource: false}
 * - ✅ Track started/stopped events
 * - ✅ Active speaker detection
 * - ✅ Participant update triggers
 * - ✅ Room management and expiry
 * - ✅ Join muted by default
 * - ✅ App messaging support
 * - ✅ Comprehensive event cleanup
 */
export class OfficialDailyCallManager {
  private callObject: DailyCall | null = null;
  private events: CallManagerEvents = {};
  private isInitialized = false;
  private room: any = null;
  private roomExp: number | null = null;
  private activeSpeakerId: string | null = null;
  private updateParticipantsTrigger: string | null = null;

  /**
   * Initialize call manager following official patterns
   */
  async initialize(config: CallConfig, events: CallManagerEvents = {}): Promise<DailyCall> {
    if (this.callObject) {
      await this.destroy();
    }

    this.events = events;

    try {
      // ✅ OFFICIAL PATTERN: Create call object like official examples
      console.log(`🎥 Creating ${config.callType} call object...`);
      if (config.callType === 'audio') {
        // Audio-only pattern from audio-only example
        this.callObject = Daily.createCallObject({ videoSource: false });
      } else {
        // Video call pattern from video playground example
        this.callObject = Daily.createCallObject();
      }

      if (!this.callObject) {
        throw new Error('Failed to create Daily call object');
      }

      console.log('✅ Daily call object created successfully:', !!this.callObject);

      this.isInitialized = true;

      // ✅ OFFICIAL PATTERN: Set up all event listeners before joining
      this.setupEventListeners();

      // ✅ OFFICIAL PATTERN: Simple join options like official examples
      const joinOptions: any = {
        url: config.roomUrl,
        userName: config.userName,
        token: config.token,
      };

      await this.callObject.join(joinOptions);

      // ✅ OFFICIAL PATTERN: Join muted by default (from audio-only example)
      if (config.joinMuted !== false) {
        this.callObject.setLocalAudio(false);
      }

      console.log('✅ [OfficialDailyCallManager] Successfully joined call');
      return this.callObject;
    } catch (error) {
      console.error('❌ [OfficialDailyCallManager] Failed to initialize:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * ✅ OFFICIAL PATTERN: Complete event listener setup from examples
   */
  private setupEventListeners(): void {
    if (!this.callObject) return;

    // Meeting state events (from both examples)
    this.callObject.on('joined-meeting', this.handleJoinedMeeting);
    this.callObject.on('participant-joined', this.handleParticipantJoined);
    this.callObject.on('participant-updated', this.handleParticipantUpdated);
    this.callObject.on('participant-left', this.handleParticipantLeft);
    this.callObject.on('error', this.handleError);

    // ✅ OFFICIAL PATTERN: Track events (crucial for audio/video management)
    this.callObject.on('track-started', this.handleTrackStarted);
    this.callObject.on('track-stopped', this.handleTrackStopped);

    // ✅ OFFICIAL PATTERN: Active speaker detection (missing from current impl)
    this.callObject.on('active-speaker-change', this.handleActiveSpeakerChange);

    // ✅ OFFICIAL PATTERN: App messaging (for custom features)
    this.callObject.on('app-message', this.handleAppMessage);

    // Additional Daily.co events
    this.callObject.on('left-meeting', this.handleLeftMeeting);
    this.callObject.on('camera-error', this.handleCameraError);
    this.callObject.on('loading', this.handleLoading);
    this.callObject.on('loaded', this.handleLoaded);
    this.callObject.on('load-attempt-failed', this.handleLoadFailed);
  }

  /**
   * ✅ OFFICIAL PATTERN: Handle joined meeting and get room details
   */
  private handleJoinedMeeting = async (event?: any) => {
    console.log('✅ [OfficialDailyCallManager] Joined meeting');
    this.triggerParticipantUpdate(`joined-${event?.participant?.user_id}-${Date.now()}`);
    this.events.onCallStateChange?.('joined-meeting');
    this.events.onJoinedMeeting?.(event);

    // ✅ OFFICIAL PATTERN: Get room details and expiry (from audio example)
    try {
      const room: any = await this.callObject?.room();
      const exp = room?.config?.exp;
      this.room = room;
      if (exp) {
        this.roomExp = exp * 1000 || Date.now() + 10 * 60 * 1000; // 10 min default
      }
      this.events.onRoomUpdated?.(room);
      console.log('📋 [OfficialDailyCallManager] Room details loaded:', room?.name);
    } catch (error) {
      console.warn('⚠️ Failed to get room details:', error);
    }
  };

  /**
   * ✅ OFFICIAL PATTERN: Participant events with update triggers
   */
  private handleParticipantJoined = (event?: any) => {
    console.log('👋 [OfficialDailyCallManager] Participant joined:', event?.participant?.user_name);
    this.triggerParticipantUpdate(`joined-${event?.participant?.user_id}-${Date.now()}`);
    this.events.onParticipantJoined?.(event);
  };

  private handleParticipantUpdated = (event?: any) => {
    console.log(
      '🔄 [OfficialDailyCallManager] Participant updated:',
      event?.participant?.user_name
    );
    this.triggerParticipantUpdate(`updated-${event?.participant?.user_id}-${Date.now()}`);
    this.events.onParticipantUpdated?.(event);
  };

  private handleParticipantLeft = (event?: any) => {
    console.log('👋 [OfficialDailyCallManager] Participant left:', event?.participant?.user_name);
    this.triggerParticipantUpdate(`left-${event?.participant?.user_id}-${Date.now()}`);
    this.events.onParticipantLeft?.(event);
  };

  /**
   * ✅ OFFICIAL PATTERN: Track events for audio/video management
   */
  private handleTrackStarted = (event?: any) => {
    console.log('🎵 [OfficialDailyCallManager] Track started:', event?.participant?.session_id);
    this.triggerParticipantUpdate(`track-started-${event?.participant?.user_id}-${Date.now()}`);
    this.events.onTrackStarted?.(event);
  };

  private handleTrackStopped = (event?: any) => {
    console.log('🔇 [OfficialDailyCallManager] Track stopped:', event?.participant?.session_id);
    this.triggerParticipantUpdate(`track-stopped-${event?.participant?.user_id}-${Date.now()}`);
    this.events.onTrackStopped?.(event);
  };

  /**
   * ✅ OFFICIAL PATTERN: Active speaker detection (key for audio calls)
   */
  private handleActiveSpeakerChange = (event?: any) => {
    console.log(
      '🎤 [OfficialDailyCallManager] Active speaker changed:',
      event?.activeSpeaker?.peerId
    );
    this.activeSpeakerId = event?.activeSpeaker?.peerId || null;
    this.events.onActiveSpeakerChange?.(event);
  };

  /**
   * ✅ OFFICIAL PATTERN: App messaging for custom features
   */
  private handleAppMessage = (event?: any) => {
    console.log('📨 [OfficialDailyCallManager] App message:', event?.data);
    this.events.onAppMessage?.(event);
  };

  /**
   * Other event handlers
   */
  private handleLeftMeeting = () => {
    console.log('👋 [OfficialDailyCallManager] Left meeting');
    this.events.onCallStateChange?.('left-meeting');
    this.events.onCallEnd?.();
    this.events.onLeftMeeting?.();
  };

  private handleError = (event?: any) => {
    console.error('❌ [OfficialDailyCallManager] Error:', event);
    this.events.onError?.(event);
  };

  private handleCameraError = (event?: any) => {
    console.error('📷 [OfficialDailyCallManager] Camera error:', event);
    this.events.onError?.({ type: 'camera-error', ...event });
  };

  private handleLoading = () => {
    console.log('⏳ [OfficialDailyCallManager] Loading...');
    this.events.onCallStateChange?.('loading');
  };

  private handleLoaded = () => {
    console.log('✅ [OfficialDailyCallManager] Loaded');
    this.events.onCallStateChange?.('loaded');
  };

  private handleLoadFailed = (event?: any) => {
    console.error('❌ [OfficialDailyCallManager] Load failed:', event);
    this.events.onError?.(event);
  };

  /**
   * ✅ OFFICIAL PATTERN: Participant update trigger system
   */
  private triggerParticipantUpdate(trigger: string) {
    this.updateParticipantsTrigger = trigger;
    // This trigger can be used by hooks to update participant lists efficiently
  }

  /**
   * Get current active speaker ID
   */
  getActiveSpeakerId(): string | null {
    return this.activeSpeakerId;
  }

  /**
   * Get room details
   */
  getRoom(): any {
    return this.room;
  }

  /**
   * Get room expiry
   */
  getRoomExpiry(): number | null {
    return this.roomExp;
  }

  /**
   * Get participant update trigger
   */
  getParticipantUpdateTrigger(): string | null {
    return this.updateParticipantsTrigger;
  }

  /**
   * Send app message to participant(s)
   */
  sendAppMessage(message: any, participantId?: string): boolean {
    if (!this.callObject) return false;

    try {
      this.callObject.sendAppMessage(message, participantId);
      return true;
    } catch (error) {
      console.error('Failed to send app message:', error);
      return false;
    }
  }

  /**
   * ✅ OFFICIAL PATTERN: Audio control methods
   */
  async setLocalAudio(enabled: boolean): Promise<void> {
    if (!this.callObject) return;
    await this.callObject.setLocalAudio(enabled);
  }

  async setLocalVideo(enabled: boolean): Promise<void> {
    if (!this.callObject) return;
    await this.callObject.setLocalVideo(enabled);
  }

  /**
   * Get call object for direct access
   */
  getCallObject(): DailyCall | null {
    return this.callObject;
  }

  /**
   * Get meeting state
   */
  getMeetingState(): string | undefined {
    return this.callObject?.meetingState();
  }

  /**
   * Get participants
   */
  getParticipants() {
    return this.callObject?.participants() || {};
  }

  /**
   * Check if call is active
   */
  isCallActive(): boolean {
    const state = this.getMeetingState();
    return state === 'joined-meeting' || state === 'joining-meeting';
  }

  /**
   * Leave call
   */
  async leave(): Promise<void> {
    if (!this.callObject) return;

    try {
      console.log('📞 [OfficialDailyCallManager] Leaving call...');
      await this.callObject.leave();
    } catch (error) {
      console.error('Error leaving call:', error);
      await this.cleanup();
    }
  }

  /**
   * Destroy call object and cleanup
   */
  async destroy(): Promise<void> {
    if (!this.callObject) return;

    try {
      console.log('🗑️ [OfficialDailyCallManager] Destroying call object...');
      await this.callObject.destroy();
    } catch (error) {
      console.error('Error destroying call object:', error);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * ✅ OFFICIAL PATTERN: Comprehensive cleanup
   */
  public async cleanup(): Promise<void> {
    if (this.callObject && this.isInitialized) {
      try {
        // Remove all event listeners (prevent memory leaks)
        const allEvents: DailyEvent[] = [
          'joined-meeting',
          'participant-joined',
          'participant-updated',
          'participant-left',
          'error',
          'track-started',
          'track-stopped',
          'active-speaker-change',
          'app-message',
          'left-meeting',
          'camera-error',
          'loading',
          'loaded',
          'load-attempt-failed',
        ];

        allEvents.forEach(event => {
          try {
            this.callObject?.off(event, this.handleJoinedMeeting);
            this.callObject?.off(event, this.handleParticipantJoined);
            this.callObject?.off(event, this.handleParticipantUpdated);
            this.callObject?.off(event, this.handleParticipantLeft);
            this.callObject?.off(event, this.handleTrackStarted);
            this.callObject?.off(event, this.handleTrackStopped);
            this.callObject?.off(event, this.handleActiveSpeakerChange);
            this.callObject?.off(event, this.handleAppMessage);
            this.callObject?.off(event, this.handleLeftMeeting);
            this.callObject?.off(event, this.handleError);
            this.callObject?.off(event, this.handleCameraError);
            this.callObject?.off(event, this.handleLoading);
            this.callObject?.off(event, this.handleLoaded);
            this.callObject?.off(event, this.handleLoadFailed);
          } catch (error) {
            // Ignore cleanup errors
          }
        });
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }

    this.callObject = null;
    this.isInitialized = false;
    this.events = {};
    this.room = null;
    this.roomExp = null;
    this.activeSpeakerId = null;
    this.updateParticipantsTrigger = null;
  }
}

// Singleton for app-wide use
export const officialDailyCallManager = new OfficialDailyCallManager();
