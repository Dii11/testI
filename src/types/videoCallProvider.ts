export enum VideoCallProvider {
  DAILY = 'daily',
}

export interface VideoCallCapabilities {
  maxParticipants: number;
  supportsScreenShare: boolean;
  supportsRecording: boolean;
  supportsChat: boolean;
  videoQualityLevels: string[];
}

export interface VideoCallMetrics {
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  latency?: number;
  bandwidth?: {
    upload: number;
    download: number;
  };
  packetsLost?: number;
}

export interface ChannelInfo {
  callId: string;
  channelName: string;
  roomUrl?: string;
  participants: {
    doctorId: string;
    customerId: string;
  };
  callType: 'audio' | 'video';
  provider: VideoCallProvider;
}

export interface BaseVideoCallService {
  // Core functionality
  initializeEngine(): Promise<any | null>;
  joinRoom(roomUrl: string, options?: any): Promise<void>;
  leaveRoom(): Promise<void>;

  // Media controls
  setLocalAudio(enabled: boolean): Promise<void>;
  setLocalVideo(enabled: boolean): Promise<void>;
  flipCamera(): Promise<void>;

  // Room management
  createRoom(roomName?: string): Promise<ChannelInfo>;
  startConsultation(
    doctorId: string,
    customerId: string,
    callType: 'audio' | 'video'
  ): Promise<any>;
  joinConsultation(doctorId: string, customerId: string, callType: 'audio' | 'video'): Promise<any>;
  endConsultation(): Promise<void>;

  // Provider info
  getProvider(): VideoCallProvider;
  getCapabilities(): VideoCallCapabilities;
  getConnectionMetrics(): VideoCallMetrics;

  // State management
  isCallActive(): boolean;
  destroy(): Promise<void>;
}

export interface VideoCallProviderConfig {
  provider: VideoCallProvider;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  requiresSetup?: boolean;
  apiKeyRequired?: boolean;
}
