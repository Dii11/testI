import { getConfig } from '../config/env.config';
import { VideoCallProvider } from '../types/videoCallProvider';

/**
 * Channel Service - Unified channel naming and management for all video call providers
 * Ensures patients and doctors join the same channel using Daily.co
 */

export interface CallParticipants {
  doctorId: string;
  customerId: string;
}

export interface ChannelInfo {
  /** Stable channel identifier (no callType suffix for consultation rooms). */
  channelName: string;
  /** Full Daily room URL (may be injected/overridden by DailyService). */
  roomUrl?: string;
  /** Unique identifier for the call session. */
  callId: string;
  /** The video call provider for the session. */
  provider: VideoCallProvider;
  /** The token required for authentication, if any. */
  token?: string | null;
  participants: CallParticipants;
  /** Requested callType (used to set initial media state, not to derive room). */
  callType: 'audio' | 'video';
}

export class ChannelService {
  private static instance: ChannelService;

  private constructor() {}

  public static getInstance(): ChannelService {
    if (!ChannelService.instance) {
      ChannelService.instance = new ChannelService();
    }
    return ChannelService.instance;
  }

  /**
   * Generate consistent channel name for doctor-patient consultation
   *
   * ✅ DEMO/POC MODE: ALWAYS uses default room - NO EXCEPTIONS
   */
  generateConsultationChannel(
    doctorId: string,
    customerId: string,
    callType: 'audio' | 'video',
    provider: VideoCallProvider,
    token?: string
  ): ChannelInfo {
    // ✅ ALWAYS USE YOUR SPECIFIC ROOM - NO EXCEPTIONS
    const baseChannelName = 'ZVpxSgQtPXff8Cq9l44z';
    const config = getConfig();

    console.log('🎭 ALWAYS USING YOUR SPECIFIC ROOM:', baseChannelName);

    const callId = `${provider}_${baseChannelName}_${Date.now()}`;

    const roomUrl =
      provider === VideoCallProvider.DAILY
        ? `https://${config.HOPMED_VIDEO_DAILY_DOMAIN || 'mbinina.daily.co'}/${baseChannelName}`
        : baseChannelName;

    console.log(`📞 YOUR ROOM: ${baseChannelName} | URL: ${roomUrl}`);

    return {
      channelName: baseChannelName,
      participants: { doctorId, customerId },
      callType,
      provider,
      callId,
      token,
      roomUrl,
    };
  }

  /**
   * Parse channel name to extract participant information
   */
  parseChannelName(channelName: string): CallParticipants | null {
    // Support legacy pattern with callType suffix AND new unified pattern
    const legacy = channelName.match(/^consultation_(.+)_(.+)_(audio|video)$/);
    if (legacy) {
      const [, id1, id2] = legacy;
      return { doctorId: id1, customerId: id2 };
    }
    const current = channelName.match(/^consultation_(.+)_(.+)$/);
    if (current) {
      const [, id1, id2] = current;
      return { doctorId: id1, customerId: id2 };
    }
    return null;
  }

  /**
   * Generate emergency/test channel for fallback scenarios
   * ✅ ALWAYS USE YOUR SPECIFIC ROOM - NO EXCEPTIONS
   */
  generateTestChannel(
    callType: 'audio' | 'video' = 'video',
    provider: VideoCallProvider
  ): ChannelInfo {
    // ✅ ALWAYS USE YOUR SPECIFIC ROOM EVEN FOR TESTS
    const channelName = 'ZVpxSgQtPXff8Cq9l44z';
    const callId = `${provider}_${channelName}_${Date.now()}`;
    const config = getConfig();

    console.log('🧪 TEST CHANNEL ALSO USING YOUR SPECIFIC ROOM:', channelName);

    return {
      channelName,
      participants: { doctorId: 'test', customerId: 'test' },
      callType,
      provider,
      callId,
      token: undefined,
      roomUrl:
        provider === VideoCallProvider.DAILY
          ? `https://${config.HOPMED_VIDEO_DAILY_DOMAIN || 'mbinina.daily.co'}/${channelName}`
          : channelName,
    };
  }

  /**
   * Validate channel name format
   */
  isValidChannelName(channelName: string): boolean {
    return (
      /^consultation_(.+)_(.+)$/.test(channelName) ||
      /^consultation_(.+)_(.+)_(audio|video)$/.test(channelName) || // legacy
      /^test_\d+_(audio|video)$/.test(channelName)
    );
  }

  /**
   * Get user-friendly channel description
   */
  getChannelDescription(channelInfo: ChannelInfo): string {
    if (channelInfo.channelName.startsWith('test_')) {
      return `Test ${channelInfo.callType} call`;
    }

    return `${channelInfo.callType.charAt(0).toUpperCase() + channelInfo.callType.slice(1)} consultation on ${channelInfo.provider}`;
  }
}

export default ChannelService.getInstance();
