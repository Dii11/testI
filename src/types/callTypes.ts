/**
 * Call Types - Shared types to break circular dependencies
 *
 * This file contains shared types used across call-related services
 * to prevent circular dependency issues.
 */

import type { NetworkQuality } from '../services/networkMonitorService';

export enum CallProvider {
  DAILY = 'daily',
}

export enum CallState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
  ENDED = 'ended',
  SWITCHING_PROVIDER = 'switching_provider',
}

export interface ChannelInfo {
  channelName: string;
  participants: {
    doctorId: string;
    customerId: string;
  };
  callType: 'audio' | 'video';
  roomUrl?: string;
}

export interface CallQualityMetrics {
  connectionTime?: number;
  lastLatency?: number;
  packetLossRate?: number;
  bitrate?: number;
  resolution?: string;
  audioQuality?: 'excellent' | 'good' | 'poor';
  videoQuality?: 'excellent' | 'good' | 'poor';
  networkQuality: NetworkQuality;
  disconnectionCount: number;
  totalReconnectionTime: number;
}

export interface CallSession {
  sessionId: string;
  channelInfo: ChannelInfo;
  currentProvider: CallProvider;
  preferredProvider: CallProvider;
  state: CallState;
  participants: string[];
  startTime: number;
  lastSuccessfulConnection: number;
  reconnectionAttempts: number;
  providerSwitchAttempts: number;
  qualityMetrics: CallQualityMetrics;
  metadata: Record<string, any>;
  lastProviderSwitch: number;
  failedProviders: Set<CallProvider>;
  lastFailureReason: string | null;
  // Enhanced error tracking
  errorClassification: any | null; // ErrorClassification from errorRecoveryManager
  recoveryAttempts: number;
  lastRecoveryStrategy: any | null; // RecoveryStrategy from errorRecoveryManager
  gracefulDegradationActive: boolean;
}

export interface CallStateChangeListener {
  (session: CallSession): void;
}

export interface FallbackTrigger {
  errorType: 'initialization' | 'runtime' | 'quality';
  provider: CallProvider;
  error: string;
  canRetry: boolean;
}
