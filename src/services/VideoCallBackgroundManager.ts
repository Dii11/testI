/**
 * VideoCallBackgroundManager
 *
 * Handles video call behavior during app state transitions (background/foreground)
 * Provides graceful video stream management, call recovery, and user experience optimization
 *
 * Features:
 * - Automatic video pause/resume on app state changes
 * - Call quality degradation during background transitions
 * - Memory pressure aware call management
 * - Call recovery mechanisms after network issues
 * - Background call state persistence
 */

import type { AppStateStatus } from 'react-native';
import { Platform } from 'react-native';

import AppStateManager from '../utils/AppStateManager';
import CallPerformanceMonitor from '../utils/CallPerformanceMonitor';
import { SentryErrorTracker } from '../utils/sentryErrorTracker';

// Daily.co types (lightweight shims)
interface DailyCall {
  localVideo(): boolean;
  localAudio(): boolean;
  setLocalVideo(enabled: boolean): void;
  setLocalAudio(enabled: boolean): void;
  participants(): { local?: any } | undefined;
  participantCounts(): { present: number };
  getNetworkStats(): Promise<any>;
  on(event: string, handler: (ev?: unknown) => void): DailyCall;
  off(event: string, handler?: (ev?: unknown) => void): DailyCall;
}

interface VideoCallState {
  isInCall: boolean;
  callType: 'audio' | 'video';
  wasVideoEnabledBeforeBackground: boolean;
  backgroundStartTime: number | null;
  callStartTime: number | null;
  participantCount: number;
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
  isRecovering: boolean;
  hasBackgroundTransitioned: boolean;
}

interface BackgroundTransitionConfig {
  enableVideoAutoPause: boolean;
  enableQualityDegradation: boolean;
  enableCallRecovery: boolean;
  maxBackgroundDuration: number; // ms before showing reconnection UI
  memoryPressureThreshold: number;
  autoResumeVideo: boolean;
}

interface VideoCallBackgroundListener {
  id: string;
  onAppStateChange: (appState: AppStateStatus, callState: VideoCallState) => void;
  onVideoStateChange: (enabled: boolean, reason: string) => void;
  onCallRecoveryStarted: () => void;
  onCallRecoveryCompleted: (success: boolean) => void;
  onQualityDegraded: (fromQuality: string, toQuality: string) => void;
}

class VideoCallBackgroundManager {
  private static instance: VideoCallBackgroundManager | null = null;

  private callObject: DailyCall | null = null;
  // ✅ FIX #4: Track user's explicit camera choice (not just system state)
  private userCameraPreference: boolean = true;
  private callState: VideoCallState = {
    isInCall: false,
    callType: 'video',
    wasVideoEnabledBeforeBackground: false,
    backgroundStartTime: null,
    callStartTime: null,
    participantCount: 0,
    networkQuality: 'good',
    isRecovering: false,
    hasBackgroundTransitioned: false,
  };

  private config: BackgroundTransitionConfig = {
    enableVideoAutoPause: true,
    enableQualityDegradation: true,
    enableCallRecovery: true,
    maxBackgroundDuration: 30000, // 30 seconds
    memoryPressureThreshold: 2, // Number of rapid transitions indicating pressure
    autoResumeVideo: true,
  };

  private listeners: VideoCallBackgroundListener[] = [];
  private appStateUnsubscribe: (() => void) | null = null;
  private recoveryTimeoutId: NodeJS.Timeout | null = null;
  private qualityMonitorIntervalId: NodeJS.Timeout | null = null;
  private memoryMonitorIntervalId: NodeJS.Timeout | null = null;

  private constructor() {
    this.initialize();
  }

  static getInstance(): VideoCallBackgroundManager {
    if (!VideoCallBackgroundManager.instance) {
      VideoCallBackgroundManager.instance = new VideoCallBackgroundManager();
    }
    return VideoCallBackgroundManager.instance;
  }

  private initialize(): void {
    console.log('🎥 VideoCallBackgroundManager initializing...');

    // Register for app state changes with high priority
    this.appStateUnsubscribe = AppStateManager.getInstance().addListener(
      'VideoCallBackgroundManager',
      this.handleAppStateChange.bind(this),
      100 // High priority
    );

    console.log('✅ VideoCallBackgroundManager initialized');
  }

  /**
   * ✅ FIX #4: Set user's camera preference (tracks manual toggle)
   * This allows us to differentiate between user intent and system state
   */
  public setUserCameraPreference(enabled: boolean): void {
    this.userCameraPreference = enabled;
    console.log('🎥 User camera preference set to:', enabled);
  }

  /**
   * Register a video call session
   */
  public startCallSession(callObject: DailyCall, callType: 'audio' | 'video'): void {
    console.log(`🎥 Starting call session: ${callType}`);

    this.callObject = callObject;
    this.callState = {
      ...this.callState,
      isInCall: true,
      callType,
      callStartTime: Date.now(),
      hasBackgroundTransitioned: false,
      isRecovering: false,
    };

    // Start monitoring network quality and memory pressure if in video call
    if (callType === 'video') {
      this.startQualityMonitoring();
      this.startMemoryPressureMonitoring();
    }

    // Track call start
    CallPerformanceMonitor.trackRender('VideoCallSessionStart');

    this.notifyListeners('onAppStateChange', AppStateManager.getInstance().getCurrentState(), this.callState);
  }

  /**
   * End video call session
   */
  public endCallSession(): void {
    console.log('🎥 Ending call session');

    this.callObject = null;
    this.callState = {
      isInCall: false,
      callType: 'video',
      wasVideoEnabledBeforeBackground: false,
      backgroundStartTime: null,
      callStartTime: null,
      participantCount: 0,
      networkQuality: 'good',
      isRecovering: false,
      hasBackgroundTransitioned: false,
    };

    this.clearTimeouts();
    this.stopQualityMonitoring();
    this.stopMemoryPressureMonitoring();

    CallPerformanceMonitor.trackRender('VideoCallSessionEnd');
  }

  /**
   * Handle app state changes during video calls
   */
  private async handleAppStateChange(appState: AppStateStatus): Promise<void> {
    if (!this.callState.isInCall || !this.callObject) {
      return;
    }

    console.log(`🎥 App state changed to: ${appState} during video call`);

    try {
      switch (appState) {
        case 'background':
        case 'inactive':
          await this.handleBackgroundTransition();
          break;
        case 'active':
          await this.handleForegroundTransition();
          break;
      }

      // Check for memory pressure during transitions
      await this.handleMemoryPressureCheck();

      // Notify listeners
      this.notifyListeners('onAppStateChange', appState, this.callState);
    } catch (error) {
      console.error('🎥 Error handling app state change:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'VideoCallBackgroundManager',
        appState,
        callState: this.callState,
      });
    }
  }

  /**
   * Handle transition to background
   */
  private async handleBackgroundTransition(): Promise<void> {
    console.log('🎥 Handling background transition');

    const currentTime = Date.now();
    this.callState.backgroundStartTime = currentTime;
    this.callState.hasBackgroundTransitioned = true;

    if (this.config.enableVideoAutoPause && this.callState.callType === 'video') {
      // ✅ FIX #5A: Use actual Daily.co state, not just cached preference
      const actualVideoState = this.callObject?.localVideo() || false;

      // Store BOTH user preference AND actual state
      // Only resume if BOTH were true (user wanted it on AND it was actually on)
      this.callState.wasVideoEnabledBeforeBackground = actualVideoState && this.userCameraPreference;

      console.log(`🎥 Background transition - User pref: ${this.userCameraPreference}, Actual state: ${actualVideoState}`);

      if (actualVideoState) {
        console.log('🎥 Pausing video due to background transition');
        this.callObject?.setLocalVideo(false);
        this.notifyListeners('onVideoStateChange', false, 'background_transition');
      }
    }

    // Start recovery timeout
    if (this.config.enableCallRecovery) {
      this.startRecoveryTimeout();
    }

    // Track background transition
    CallPerformanceMonitor.trackRender('VideoCallBackgroundTransition');
  }

  /**
   * Handle transition to foreground
   */
  private async handleForegroundTransition(): Promise<void> {
    console.log('🎥 Handling foreground transition');

    const backgroundDuration = this.callState.backgroundStartTime
      ? Date.now() - this.callState.backgroundStartTime
      : 0;

    console.log(`🎥 Was in background for ${Math.round(backgroundDuration / 1000)}s`);

    // Clear recovery timeout
    this.clearRecoveryTimeout();

    // Check if call recovery is needed
    const needsRecovery = backgroundDuration > this.config.maxBackgroundDuration;

    if (needsRecovery && this.config.enableCallRecovery) {
      await this.attemptCallRecovery();
    } else {
      // Resume video if it was enabled before background
      await this.resumeVideoIfNeeded();
    }

    // Reset background state
    this.callState.backgroundStartTime = null;

    // Track foreground transition
    CallPerformanceMonitor.trackRender('VideoCallForegroundTransition');
  }

  /**
   * Resume video if it was enabled before background transition
   */
  private async resumeVideoIfNeeded(): Promise<void> {
    // ✅ FIX #5B: Only resume if BOTH conditions are true
    const shouldResumeVideo =
      this.config.autoResumeVideo &&
      this.callState.wasVideoEnabledBeforeBackground &&
      this.userCameraPreference &&  // Check user intent - CRITICAL
      this.callState.callType === 'video' &&
      this.callObject;

    if (shouldResumeVideo) {
      console.log('🎥 Resuming video after foreground transition (user wanted camera on)');

      try {
        this.callObject.setLocalVideo(true);
        this.notifyListeners('onVideoStateChange', true, 'foreground_resume');

        // ✅ FIX #5B: Longer stabilization time + verify tracks
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify video actually resumed
        const videoResumed = this.callObject.localVideo();
        if (!videoResumed) {
          console.warn('⚠️ Video failed to resume, retrying...');
          await new Promise(resolve => setTimeout(resolve, 500));
          this.callObject.setLocalVideo(true);
        }

      } catch (error) {
        console.error('🎥 Failed to resume video:', error);
        SentryErrorTracker.getInstance().trackWarning('Failed to resume video after background', {
          context: 'VideoCallBackgroundManager',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      console.log('🎥 Not resuming video - user had camera off before background');
    }
  }

  /**
   * Attempt call recovery after extended background period
   */
  private async attemptCallRecovery(): Promise<void> {
    if (this.callState.isRecovering || !this.callObject) {
      return;
    }

    console.log('🎥 Attempting call recovery...');
    this.callState.isRecovering = true;

    this.notifyListeners('onCallRecoveryStarted');

    try {
      // Check network connectivity and call state
      const networkStats = await this.callObject.getNetworkStats();
      const participantCount = this.callObject.participantCounts().present;

      console.log(`🎥 Recovery check - participants: ${participantCount}, network available: ${!!networkStats}`);

      // Update participant count
      this.callState.participantCount = participantCount;

      // Check if we're still connected to the call
      const isStillConnected = participantCount > 0;

      if (isStillConnected) {
        console.log('✅ Call recovery successful - still connected');
        await this.resumeVideoIfNeeded();
        this.notifyListeners('onCallRecoveryCompleted', true);
      } else {
        console.warn('⚠️ Call recovery failed - no longer connected');
        this.notifyListeners('onCallRecoveryCompleted', false);
      }

    } catch (error) {
      console.error('❌ Call recovery failed:', error);
      this.notifyListeners('onCallRecoveryCompleted', false);

      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'VideoCallBackgroundManager',
        action: 'call_recovery',
        callState: this.callState,
      });
    } finally {
      this.callState.isRecovering = false;
    }
  }

  /**
   * Handle memory pressure during video calls
   */
  private async handleMemoryPressureCheck(): Promise<void> {
    const appStateManager = AppStateManager.getInstance();

    if (!appStateManager.hasMemoryPressureIndicators()) {
      return;
    }

    console.log('🧠 Memory pressure detected during video call');

    // Get memory recovery status for better decision making
    const memoryStatus = appStateManager.getMemoryRecoveryStatus();
    console.log('🧠 Memory recovery status:', memoryStatus);

    // Progressive degradation based on memory pressure severity
    if (this.config.enableQualityDegradation && this.callState.callType === 'video') {
      if (memoryStatus.recoveryAttempts === 0) {
        // First attempt: reduce video quality
        await this.degradeCallQuality('low_quality');
      } else if (memoryStatus.recoveryAttempts === 1) {
        // Second attempt: disable video completely
        await this.degradeCallQuality('audio_only');
      } else {
        // Final attempt: consider ending call gracefully
        console.warn('🧠 Severe memory pressure - considering call termination');
        this.notifyListeners('onQualityDegraded', 'video', 'critical_memory_pressure');
      }
    }

    // Attempt memory recovery with video call awareness
    if (appStateManager.canAttemptMemoryRecovery()) {
      const recoverySuccess = await this.attemptVideoCallMemoryRecovery();

      if (recoverySuccess && this.callState.callType === 'video') {
        // Gradually restore video quality after successful recovery
        await this.restoreCallQuality();
      }
    }
  }

  /**
   * Enhanced memory recovery specifically for video calls
   * ✅ FIXED: Respects user intent - won't disable camera if user explicitly wants it ON
   */
  private async attemptVideoCallMemoryRecovery(): Promise<boolean> {
    const appStateManager = AppStateManager.getInstance();

    console.log('🧠 Attempting video call memory recovery...');

    try {
      // Store current video state before recovery attempt
      const currentVideoEnabled = this.callObject?.localVideo() || false;
      const currentAudioEnabled = this.callObject?.localAudio() || false;

      // ✅ FIX: Only disable video if user doesn't have explicit preference for it being ON
      if (currentVideoEnabled && this.callObject) {
        if (!this.userCameraPreference) {
          // User had camera off or doesn't care - safe to disable for memory recovery
          console.log('🧠 Temporarily disabling video for memory recovery');
          this.callObject.setLocalVideo(false);
          this.notifyListeners('onVideoStateChange', false, 'memory_recovery_preparation');
        } else {
          // User explicitly wants camera ON - keep it on and try recovery without disabling
          console.warn('⚠️ Memory recovery needed but user wants camera ON - attempting recovery without disabling video');
        }
      }

      // Give memory a moment to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Attempt system memory recovery
      const systemRecoverySuccess = await appStateManager.attemptMemoryPressureRecovery();

      if (systemRecoverySuccess) {
        console.log('✅ System memory recovery successful');

        // Wait for memory to fully stabilize before restoring video
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Restore video if it was previously enabled and recovery was successful
        if (currentVideoEnabled && this.callObject && !appStateManager.hasMemoryPressureIndicators()) {
          console.log('🧠 Restoring video after successful memory recovery');
          this.callObject.setLocalVideo(true);
          this.notifyListeners('onVideoStateChange', true, 'memory_recovery_success');
        }

        return true;
      } else {
        console.warn('⚠️ System memory recovery failed');

        // Keep video disabled if recovery failed
        if (currentVideoEnabled) {
          console.log('🧠 Keeping video disabled due to failed memory recovery');
          this.notifyListeners('onVideoStateChange', false, 'memory_recovery_failed');
        }

        return false;
      }
    } catch (error) {
      console.error('❌ Video call memory recovery failed:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'VideoCallBackgroundManager',
        action: 'video_call_memory_recovery',
        callState: this.callState,
      });
      return false;
    }
  }

  /**
   * Degrade call quality due to memory pressure
   * ✅ FIXED: Respects user intent - won't auto-disable camera if user explicitly wants it ON
   */
  private async degradeCallQuality(degradationLevel: 'low_quality' | 'audio_only' = 'audio_only'): Promise<void> {
    if (!this.callObject || this.callState.callType !== 'video') {
      return;
    }

    console.log(`🎥 Degrading call quality to ${degradationLevel} due to memory pressure`);

    const wasVideoEnabled = this.callObject.localVideo();
    const currentQuality = this.callState.networkQuality;

    if (wasVideoEnabled) {
      if (degradationLevel === 'low_quality') {
        // First level: just notify about quality reduction (actual quality reduction would be handled by Daily.co)
        console.log('🎥 Reducing video quality due to memory pressure');
        this.notifyListeners('onQualityDegraded', currentQuality, 'low_quality');

        // Store that we've attempted quality degradation
        this.callState.networkQuality = 'poor';
      } else if (degradationLevel === 'audio_only') {
        // ✅ FIX: Check if user explicitly wants camera ON before auto-disabling
        if (!this.userCameraPreference) {
          // User already has camera off, safe to notify
          console.log('🎥 Disabling video due to severe memory pressure (user had camera off)');
          this.callObject.setLocalVideo(false);
          this.notifyListeners('onVideoStateChange', false, 'memory_pressure');
          this.notifyListeners('onQualityDegraded', currentQuality, 'audio_only');
        } else {
          // ⚠️ User wants camera ON - just warn, don't force disable
          console.warn('⚠️ Memory pressure detected but user wants camera ON - showing warning instead');
          // Just notify about quality degradation, DON'T turn off camera
          this.notifyListeners('onQualityDegraded', currentQuality, 'memory_pressure_warning');
        }
      }
    }
  }

  /**
   * Restore call quality after memory recovery
   */
  private async restoreCallQuality(): Promise<void> {
    if (!this.callObject || this.callState.callType !== 'video') {
      return;
    }

    console.log('🎥 Restoring call quality after memory recovery');

    try {
      // Re-enable video if it was previously on
      if (this.callState.wasVideoEnabledBeforeBackground) {
        this.callObject.setLocalVideo(true);
        this.notifyListeners('onVideoStateChange', true, 'memory_recovery');

        console.log('🎥 Video restored after memory recovery');
      }
    } catch (error) {
      console.error('🎥 Failed to restore call quality:', error);
    }
  }

  /**
   * Start monitoring network quality
   */
  private startQualityMonitoring(): void {
    if (this.qualityMonitorIntervalId || !this.callObject) {
      return;
    }

    this.qualityMonitorIntervalId = setInterval(async () => {
      try {
        const stats = await this.callObject?.getNetworkStats();
        if (stats?.stats) {
          const latency = stats.stats.video?.recvLatency ?? stats.stats.audio?.recvLatency ?? 0;
          const packetLoss = stats.stats.video?.recvPacketLoss ?? 0;

          let quality: typeof this.callState.networkQuality = 'poor';
          if (latency < 100 && packetLoss < 0.01) quality = 'excellent';
          else if (latency < 200 && packetLoss < 0.03) quality = 'good';
          else if (latency < 400 && packetLoss < 0.05) quality = 'fair';

          if (quality !== this.callState.networkQuality) {
            const previousQuality = this.callState.networkQuality;
            this.callState.networkQuality = quality;
            this.notifyListeners('onQualityDegraded', previousQuality, quality);
          }
        }
      } catch (error) {
        console.warn('🎥 Quality monitoring error:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop monitoring network quality
   */
  private stopQualityMonitoring(): void {
    if (this.qualityMonitorIntervalId) {
      clearInterval(this.qualityMonitorIntervalId);
      this.qualityMonitorIntervalId = null;
    }
  }

  /**
   * Start monitoring memory pressure during video calls
   */
  private startMemoryPressureMonitoring(): void {
    if (this.memoryMonitorIntervalId) {
      return; // Already monitoring
    }

    console.log('🧠 Starting memory pressure monitoring');

    this.memoryMonitorIntervalId = setInterval(async () => {
      try {
        const appStateManager = AppStateManager.getInstance();

        // Check for memory pressure indicators
        if (appStateManager.hasMemoryPressureIndicators()) {
          console.log('🧠 Memory pressure detected during monitoring');
          await this.handleMemoryPressureCheck();
        }

        // Also check if we're in a prolonged background state which might indicate memory pressure
        const backgroundDuration = this.callState.backgroundStartTime
          ? Date.now() - this.callState.backgroundStartTime
          : 0;

        if (backgroundDuration > 60000) { // More than 1 minute in background
          console.log('🧠 Prolonged background state detected, checking memory status');

          const memoryStatus = appStateManager.getMemoryRecoveryStatus();
          if (memoryStatus.canAttemptRecovery && this.callState.callType === 'video') {
            console.log('🧠 Attempting preemptive memory management for prolonged background');
            await this.degradeCallQuality('low_quality');
          }
        }

      } catch (error) {
        console.warn('🧠 Memory pressure monitoring error:', error);
      }
    }, 30000); // ✅ FIX: Check every 30 seconds (was 15s - too aggressive)
  }

  /**
   * Stop monitoring memory pressure
   */
  private stopMemoryPressureMonitoring(): void {
    if (this.memoryMonitorIntervalId) {
      clearInterval(this.memoryMonitorIntervalId);
      this.memoryMonitorIntervalId = null;
      console.log('🧠 Stopped memory pressure monitoring');
    }
  }

  /**
   * Start recovery timeout
   */
  private startRecoveryTimeout(): void {
    this.clearRecoveryTimeout();

    this.recoveryTimeoutId = setTimeout(() => {
      console.log('🎥 Recovery timeout triggered');
      // Will trigger recovery check on next foreground transition
    }, this.config.maxBackgroundDuration);
  }

  /**
   * Clear recovery timeout
   */
  private clearRecoveryTimeout(): void {
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
      this.recoveryTimeoutId = null;
    }
  }

  /**
   * Clear all timeouts
   */
  private clearTimeouts(): void {
    this.clearRecoveryTimeout();
    this.stopQualityMonitoring();
    this.stopMemoryPressureMonitoring();
  }

  /**
   * Listener management
   */
  public addListener(listener: VideoCallBackgroundListener): () => void {
    this.listeners.push(listener);
    console.log(`🎥 Added video call background listener: ${listener.id}`);

    return () => this.removeListener(listener.id);
  }

  public removeListener(id: string): void {
    const index = this.listeners.findIndex(l => l.id === id);
    if (index !== -1) {
      this.listeners.splice(index, 1);
      console.log(`🎥 Removed video call background listener: ${id}`);
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(
    method: keyof VideoCallBackgroundListener,
    ...args: any[]
  ): void {
    this.listeners.forEach(listener => {
      try {
        if (typeof listener[method] === 'function') {
          (listener[method] as any)(...args);
        }
      } catch (error) {
        console.error(`🎥 Error in listener ${listener.id}.${method}:`, error);
      }
    });
  }

  /**
   * Configuration management
   */
  public updateConfig(newConfig: Partial<BackgroundTransitionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🎥 Video call background config updated:', this.config);
  }

  public getConfig(): BackgroundTransitionConfig {
    return { ...this.config };
  }

  /**
   * State getters
   */
  public getCallState(): VideoCallState {
    return { ...this.callState };
  }

  public isInCall(): boolean {
    return this.callState.isInCall;
  }

  public isRecovering(): boolean {
    return this.callState.isRecovering;
  }

  public hasBackgroundTransitioned(): boolean {
    return this.callState.hasBackgroundTransitioned;
  }

  /**
   * Manual controls
   */
  public async forceVideoResume(): Promise<void> {
    if (this.callObject && this.callState.callType === 'video') {
      console.log('🎥 Manually resuming video');
      this.callObject.setLocalVideo(true);
      this.notifyListeners('onVideoStateChange', true, 'manual_resume');
    }
  }

  public async forceVideoPause(): Promise<void> {
    if (this.callObject && this.callState.callType === 'video') {
      console.log('🎥 Manually pausing video');
      this.callObject.setLocalVideo(false);
      this.notifyListeners('onVideoStateChange', false, 'manual_pause');
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    console.log('🧹 VideoCallBackgroundManager destroying...');

    this.clearTimeouts();

    if (this.appStateUnsubscribe) {
      this.appStateUnsubscribe();
      this.appStateUnsubscribe = null;
    }

    this.listeners = [];
    this.callObject = null;

    VideoCallBackgroundManager.instance = null;
    console.log('✅ VideoCallBackgroundManager destroyed');
  }
}

export default VideoCallBackgroundManager;
export type { VideoCallBackgroundListener, VideoCallState, BackgroundTransitionConfig };