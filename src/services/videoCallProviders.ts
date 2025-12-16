import type { VideoCallProviderConfig } from '../types/videoCallProvider';
import { VideoCallProvider } from '../types/videoCallProvider';

/**
 * Video Call Provider Configurations
 * Using Daily.co as the primary and only supported provider
 */
export const VIDEO_CALL_PROVIDERS: Record<VideoCallProvider, VideoCallProviderConfig> = {
  [VideoCallProvider.DAILY]: {
    provider: VideoCallProvider.DAILY,
    displayName: 'Daily.co',
    description: 'Web-based video calling with excellent browser support',
    icon: 'videocam',
    color: '#9C27B0',
    features: [
      'Web-based - works everywhere',
      'No SDK size impact',
      'Built-in UI components',
      'Automatic fallbacks',
      'Recording support',
    ],
    requiresSetup: true,
    apiKeyRequired: true,
  },
};

// Default provider preference order
export const DEFAULT_PROVIDER_PRIORITY = [VideoCallProvider.DAILY];

export const getProviderConfig = (provider: VideoCallProvider): VideoCallProviderConfig => {
  const cfg = VIDEO_CALL_PROVIDERS[provider];
  if (!cfg) throw new Error(`Provider ${provider} is disabled or unavailable.`);
  return cfg;
};

export const getAllProviders = (): VideoCallProviderConfig[] => {
  return Object.values(VIDEO_CALL_PROVIDERS).filter(Boolean) as VideoCallProviderConfig[];
};

export const getAvailableProviders = (): VideoCallProviderConfig[] => {
  return getAllProviders();
};
