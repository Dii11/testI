import { useState, useCallback } from 'react';

import DailyService from '../services/dailyService';
import { ConsolidatedPermissionManager } from '../services/permissions/ConsolidatedPermissionManager';
import { sentryTracker } from '../utils/sentryErrorTracker';

export interface UnifiedCallState {
  connecting: boolean;
  active: boolean;
  provider: 'daily' | null;
  kind: 'audio' | 'video' | null;
  channelOrRoom: string | null;
}

export interface UnifiedCallHook {
  startCall: (
    provider: 'daily',
    kind: 'audio' | 'video',
    doctorId: string,
    userId: string
  ) => Promise<boolean>;
  endCall: () => Promise<void>;
  connecting: boolean;
  active: boolean;
  provider: 'daily' | null;
  kind: 'audio' | 'video' | null;
  channelOrRoom: string | null;
}

export function useUnifiedCall(): UnifiedCallHook {
  const [state, setState] = useState<UnifiedCallState>({
    connecting: false,
    active: false,
    provider: null,
    kind: null,
    channelOrRoom: null,
  });

  const startCall = useCallback(
    async (
      provider: 'daily',
      kind: 'audio' | 'video',
      doctorId: string,
      userId: string
    ): Promise<boolean> => {
      if (state.connecting || state.active) {
        console.warn('Call already in progress');
        return false;
      }

      setState(prev => ({ ...prev, connecting: true, provider, kind }));

      try {
        console.log(`🚀 Starting ${provider} ${kind} call: doctor=${doctorId}, user=${userId}`);

        // Request permissions first using ConsolidatedPermissionManager
        const permissionManager = ConsolidatedPermissionManager.getInstance();
        const permissionType = kind === 'video' ? 'camera+microphone' : 'microphone';

        const permissionResult = await permissionManager.requestPermission(permissionType, {
          feature: kind === 'video' ? 'video_call' : 'audio_call',
          priority: 'critical',
          userInitiated: true,
          fallbackStrategy: {
            mode: 'alternative',
            description: 'Alternative call options available',
            limitations: ['Reduced functionality'],
          },
        });

        if (permissionResult.status !== 'granted') {
          throw new Error(permissionResult.message || 'Permissions not granted');
        }

        // Start consultation using DailyService
        const channelInfo = await DailyService.startConsultation(doctorId, userId, kind);

        setState(prev => ({
          ...prev,
          connecting: false,
          active: true,
          channelOrRoom:
            channelInfo.roomUrl || channelInfo.channelName || `consultation_${doctorId}_${userId}`,
        }));

        console.log('✅ Call started successfully:', channelInfo);
        return true;
      } catch (error) {
        console.error('Failed to start call:', error);

        sentryTracker.trackCriticalError(error instanceof Error ? error : 'Call start failed', {
          service: 'useUnifiedCall',
          action: 'startCall',
          provider,
          callType: kind,
          doctorId,
          userId,
          additional: {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        setState(prev => ({
          ...prev,
          connecting: false,
          active: false,
          provider: null,
          kind: null,
          channelOrRoom: null,
        }));

        return false;
      }
    },
    [state.connecting, state.active]
  );

  const endCall = useCallback(async (): Promise<void> => {
    if (!state.active) {
      console.warn('No active call to end');
      return;
    }

    try {
      console.log('🛑 Ending call');
      await DailyService.endConsultation();

      setState({
        connecting: false,
        active: false,
        provider: null,
        kind: null,
        channelOrRoom: null,
      });

      console.log('✅ Call ended successfully');
    } catch (error) {
      console.error('Failed to end call:', error);

      // Force reset state even if end call fails
      setState({
        connecting: false,
        active: false,
        provider: null,
        kind: null,
        channelOrRoom: null,
      });

      sentryTracker.trackWarning('Call end failed but state reset', {
        service: 'useUnifiedCall',
        action: 'endCall',
        provider: state.provider || undefined, // ✅ FIX: Convert null to undefined
        callType: state.kind || undefined, // ✅ FIX: Convert null to undefined
        additional: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }, [state.active, state.provider, state.kind]);

  return {
    startCall,
    endCall,
    connecting: state.connecting,
    active: state.active,
    provider: state.provider,
    kind: state.kind,
    channelOrRoom: state.channelOrRoom,
  };
}
