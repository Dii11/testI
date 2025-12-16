import Constants from 'expo-constants';
import { Platform } from 'react-native';

import deviceCapabilityService from './deviceCapabilityService';

/** Lightweight, memoized platform capability snapshot for demo / UI gating */
export interface PlatformCapabilities {
  platform: 'ios' | 'android' | 'web';
  isExpoGo: boolean;
  isEmulator: boolean;
  tier: 'high' | 'medium' | 'low';
  apiLevel: number;
  supports: {
    animations: boolean;
    complexSvg: boolean;
    gradients: boolean;
    shadows: boolean;
    blur: boolean;
  };
  limits: {
    maxAnimations: number;
  };
}

let cached: PlatformCapabilities | null = null;

export function getPlatformCapabilities(forceRefresh = false): PlatformCapabilities {
  if (cached && !forceRefresh) return cached;

  // Attempt to pull richer capabilities (non-blocking if not initialized yet)
  const caps = deviceCapabilityService.getCapabilities();

  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const isExpoGo =
    Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
  const apiLevel = caps.apiLevel || (Platform.Version as number) || 26;

  const tier =
    caps.tier === 'high' || caps.tier === 'medium' || caps.tier === 'low' ? caps.tier : 'low';
  const isLow = tier === 'low';
  const isMedium = tier === 'medium';

  cached = {
    platform,
    isExpoGo,
    isEmulator: !!(Constants.deviceName && /simulator|emulator/i.test(Constants.deviceName)),
    tier,
    apiLevel,
    supports: {
      animations: !isLow,
      complexSvg: !isLow && apiLevel >= 28,
      gradients: !isLow,
      shadows: !isLow,
      blur: tier === 'high',
    },
    limits: {
      maxAnimations: tier === 'high' ? 8 : isMedium ? 4 : 2,
    },
  };

  return cached;
}

export function clearPlatformCapabilitiesCache() {
  cached = null;
}
