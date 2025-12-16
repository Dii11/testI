import { useState, useCallback } from 'react';

import DailyService from '../services/dailyService';
import type { PermissionContext } from '../services/permissions/ConsolidatedPermissionManager';
import { ConsolidatedPermissionManager } from '../services/permissions/ConsolidatedPermissionManager';

// Simple types for demo
export type SimpleCallProvider = 'daily';
export type SimpleCallType = 'audio' | 'video';

interface SimpleVideoCallState {
  isCallActive: boolean;
  isConnecting: boolean;
  hasPermissions: boolean;
  error: string | null;
  currentProvider: SimpleCallProvider;
  channelName: string | null;
  isJoiningExisting: boolean;
}

// SIMPLIFIED: Global channel tracking for demo purposes
const activeChannels = new Map<
  string,
  {
    provider: SimpleCallProvider;
    timestamp: number;
    participants: string[];
    callType: SimpleCallType;
  }
>();

export const useSimpleVideoCall = () => {
  const [state, setState] = useState<SimpleVideoCallState>({
    isCallActive: false,
    isConnecting: false,
    hasPermissions: false,
    error: null,
    currentProvider: 'daily',
    channelName: null,
    isJoiningExisting: false,
  });

  // SIMPLIFIED: Single permission check function using ConsolidatedPermissionManager
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const permissionContext: PermissionContext = {
        feature: 'simple-video-call',
        priority: 'important',
        userInitiated: true,
        fallbackStrategy: {
          mode: 'alternative',
          description: 'Audio-only call available',
          limitations: ['No video'],
          alternativeApproach: 'audio-only',
        },
      };

      const result = await permissionManager.requestPermission(
        'camera+microphone',
        permissionContext
      );
      const granted = result.status === 'granted';
      setState(prev => ({ ...prev, hasPermissions: granted }));
      return granted;
    } catch (error) {
      console.error('🔐 [SIMPLE] Permission check failed:', error);
      setState(prev => ({ ...prev, hasPermissions: false, error: 'Permission check failed' }));
      return false;
    }
  }, []);

  // SIMPLIFIED: Consistent channel name generation
  const generateChannelName = useCallback((participantA: string, participantB: string): string => {
    // Sort IDs alphabetically to ensure consistent channel name regardless of call direction
    const sortedIds = [participantA, participantB].sort();
    return `consultation_${sortedIds[0]}_${sortedIds[1]}`;
  }, []);

  // SIMPLIFIED: Check if channel exists and get its details
  const checkIfChannelExists = useCallback(
    (
      channelName: string
    ): { exists: boolean; provider?: SimpleCallProvider; callType?: SimpleCallType } => {
      const channel = activeChannels.get(channelName);
      if (channel) {
        // Check if channel is still active (not older than 10 minutes)
        const isStillActive = Date.now() - channel.timestamp < 600000;
        if (!isStillActive) {
          activeChannels.delete(channelName);
          return { exists: false };
        }
        return {
          exists: true,
          provider: channel.provider,
          callType: channel.callType,
        };
      }
      return { exists: false };
    },
    []
  );

  // SIMPLIFIED: Mark channel as active
  const markChannelAsActive = useCallback(
    (
      channelName: string,
      provider: SimpleCallProvider,
      participants: string[],
      callType: SimpleCallType
    ) => {
      activeChannels.set(channelName, {
        provider,
        timestamp: Date.now(),
        participants,
        callType,
      });
      console.log(`📝 [SIMPLE] Marked channel as active: ${channelName} (${provider})`);
    },
    []
  );

  // REAL IMPLEMENTATION: Unified call start function with actual SDK integration
  const startCall = useCallback(
    async (
      participantA: string,
      participantB: string,
      callType: SimpleCallType = 'video',
      preferredProvider: SimpleCallProvider = 'daily'
    ): Promise<boolean> => {
      try {
        setState(prev => ({
          ...prev,
          isConnecting: true,
          error: null,
          isJoiningExisting: false,
        }));

        // Check permissions first
        const hasPerms = await checkPermissions();
        if (!hasPerms) {
          setState(prev => ({ ...prev, isConnecting: false }));
          return false;
        }

        const channelName = generateChannelName(participantA, participantB);
        const channelInfo = checkIfChannelExists(channelName);

        let provider = preferredProvider;
        let isJoining = false;

        if (channelInfo.exists) {
          // Join existing call with the same provider
          provider = channelInfo.provider!;
          isJoining = true;
          console.log(
            `🔗 [SIMPLE] Joining existing ${provider.toUpperCase()} ${channelInfo.callType} call on channel: ${channelName}`
          );
          setState(prev => ({ ...prev, isJoiningExisting: true }));
        } else {
          // Create new call
          console.log(
            `🆕 [SIMPLE] Creating new ${provider.toUpperCase()} ${callType} call on channel: ${channelName}`
          );
          markChannelAsActive(channelName, provider, [participantA, participantB], callType);
        }

        // REAL SDK INTEGRATION - Daily.co only
        let success = false;

        try {
          console.log(`🔵 [REAL] Initializing Daily.co for ${callType} call...`);

          // Initialize Daily.co engine
          const callObject = await DailyService.initializeEngine();
          if (!callObject) {
            throw new Error('Failed to initialize Daily.co engine');
          }

          // Create room for the consultation
          const roomInfo = await DailyService.createRoom(participantA);
          const roomUrl = roomInfo.roomUrl || roomInfo.channelName;
          console.log(`🏗️ [REAL] Created/Found Daily.co room: ${roomUrl}`);

          // Join the room
          await DailyService.joinRoom(roomUrl);

          // Set video off for audio-only calls
          if (callType === 'audio') {
            await DailyService.setLocalVideo(false);
          }

          success = true;
          console.log(`✅ [REAL] Daily.co ${callType} call started successfully`);
        } catch (dailyError) {
          console.error('❌ [REAL] Daily.co call failed:', dailyError);
          throw new Error(`Daily.co ${callType} call failed: ${dailyError}`);
        }

        if (success) {
          setState(prev => ({
            ...prev,
            isCallActive: true,
            isConnecting: false,
            channelName,
            currentProvider: provider,
            isJoiningExisting: false,
          }));
        }

        return success;
      } catch (error) {
        console.error('❌ [SIMPLE] Call failed:', error);
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: `Call failed: ${error}`,
          isJoiningExisting: false,
        }));
        return false;
      }
    },
    [checkPermissions, generateChannelName, checkIfChannelExists, markChannelAsActive]
  );

  // SIMPLIFIED: Daily.co call function (for backward compatibility)
  const startDailyCall = useCallback(
    async (
      participantA: string,
      participantB: string,
      callType: SimpleCallType = 'video'
    ): Promise<boolean> => {
      return startCall(participantA, participantB, callType, 'daily');
    },
    [startCall]
  );

  // SIMPLIFIED: Join existing call function
  const joinExistingCall = useCallback(
    async (
      participantA: string,
      participantB: string,
      provider: SimpleCallProvider = 'daily',
      callType: SimpleCallType = 'video'
    ): Promise<boolean> => {
      const channelName = generateChannelName(participantA, participantB);
      const channelInfo = checkIfChannelExists(channelName);

      if (!channelInfo.exists) {
        console.log(`⚠️ [SIMPLE] No existing call found on channel: ${channelName}`);
        // Note: Alert is handled by the calling component
        return false;
      }

      // Use the existing call's provider and type
      return startCall(participantA, participantB, channelInfo.callType!, channelInfo.provider!);
    },
    [generateChannelName, checkIfChannelExists, startCall]
  );

  // REAL IMPLEMENTATION: End call function with actual SDK cleanup
  const endCall = useCallback(async () => {
    try {
      console.log(`🔴 [SIMPLE] Ending Daily.co call on channel: ${state.channelName}`);

      // REAL SDK CLEANUP - Daily.co only
      try {
        await DailyService.leaveRoom();
        console.log('✅ [REAL] Daily.co call ended successfully');
      } catch (dailyError) {
        console.error('❌ [REAL] Daily.co cleanup failed:', dailyError);
      }

      // Remove channel from active channels
      if (state.channelName) {
        activeChannels.delete(state.channelName);
      }

      setState(prev => ({
        ...prev,
        isCallActive: false,
        isConnecting: false,
        channelName: null,
        error: null,
        isJoiningExisting: false,
      }));

      console.log(`✅ [SIMPLE] Call ended successfully`);
    } catch (error) {
      console.error('❌ [SIMPLE] Failed to end call:', error);
      setState(prev => ({ ...prev, error: 'Failed to end call' }));
    }
  }, [state.channelName]);

  // SIMPLIFIED: Clear errors
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // SIMPLIFIED: Get active channels for debugging
  const getActiveChannels = useCallback(() => {
    return Array.from(activeChannels.entries()).map(([name, info]) => ({
      channelName: name,
      provider: info.provider,
      callType: info.callType,
      participants: info.participants,
      age: Date.now() - info.timestamp,
    }));
  }, []);

  return {
    ...state,
    // Main call functions
    startCall,
    startDailyCall,
    joinExistingCall,
    endCall,
    checkPermissions,
    clearError,
    // Utility functions
    generateChannelName,
    getActiveChannels,
  };
};

export default useSimpleVideoCall;
