/**
 * ForegroundServiceManager - Android Foreground Service for Video Calls
 *
 * Ensures video calls can continue in background on Android by:
 * - Running foreground service with notification
 * - Requesting CAMERA and MICROPHONE permissions for foreground service
 * - Complying with Android 14+ requirements
 *
 * Requirements:
 * - Install: npm install react-native-foreground-service
 * - Add to AndroidManifest.xml:
 *   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
 *   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
 *   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
 *   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
 *
 *   <service
 *     android:name="com.asterinet.react.bgactions.RNBackgroundActionsTask"
 *     android:foregroundServiceType="camera|microphone"
 *     android:exported="false" />
 */

import { Platform } from 'react-native';
let ReactNativeForegroundService: any = null;
import { SentryErrorTracker } from '../utils/sentryErrorTracker';

interface ForegroundServiceOptions {
  id: number;
  title: string;
  message: string;
  icon?: string;
  button?: boolean;
  buttonText?: string;
  buttonOnPress?: string;
  setOnlyAlertOnce?: boolean;
  color?: string;
  progress?: {
    max: number;
    curr: number;
    indeterminate?: boolean;
  };
}

interface ActiveServiceInfo {
  serviceId: number;
  callType: 'audio' | 'video';
  contactName: string;
  startTime: number;
  roomUrl: string;
}

class ForegroundServiceManager {
  private static instance: ForegroundServiceManager | null = null;
  private isServiceRunning = false;
  private activeServiceInfo: ActiveServiceInfo | null = null;
  private updateIntervalId: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): ForegroundServiceManager {
    if (!ForegroundServiceManager.instance) {
      ForegroundServiceManager.instance = new ForegroundServiceManager();
    }
    return ForegroundServiceManager.instance;
  }

  /**
   * Check if platform supports foreground service
   */
  private isSupported(): boolean {
    return Platform.OS === 'android';
  }

  private ensureModule(): any {
    if (Platform.OS !== 'android') return null;
    if (!ReactNativeForegroundService) {
      try {
        const mod = require('@supersami/rn-foreground-service');
        ReactNativeForegroundService = mod.default || mod;
      } catch (e) {
        return null;
      }
    }
    return ReactNativeForegroundService;
  }

  /**
   * Start foreground service for video call
   */
  public async startService(
    contactName: string,
    callType: 'audio' | 'video',
    roomUrl: string
  ): Promise<boolean> {
    if (!this.isSupported()) {
      console.log('📱 ForegroundService: Not Android, skipping');
      return false;
    }

    if (this.isServiceRunning) {
      console.log('📱 ForegroundService: Already running, updating...');
      return this.updateService(contactName, callType);
    }

    try {
      console.log(`📱 ForegroundService: Starting for ${callType} call with ${contactName}`);

      const mod = this.ensureModule();
      if (!mod) {
        console.warn('📱 ForegroundService: Native module unavailable, skipping');
        return false;
      }

      const serviceId = Date.now();
      const options: ForegroundServiceOptions = {
        id: serviceId,
        title: callType === 'video' ? '📹 Video Call In Progress' : '📞 Audio Call In Progress',
        message: `Connected with ${contactName}`,
        icon: 'ic_launcher',
        button: true,
        buttonText: 'Return to Call',
        buttonOnPress: 'HopMedCallReturn',
        setOnlyAlertOnce: true,
        color: '#007AFF',
        progress: {
          max: 100,
          curr: 0,
          indeterminate: true,
        },
        // ✅ CRITICAL FIX: ServiceType is REQUIRED for Android 10+ (API 29+)
        // Without this, Android throws: "ForegroundService: ServiceType is required"
        // For video calls: use "camera" (will be converted to FOREGROUND_SERVICE_TYPE_CAMERA + MICROPHONE)
        // For audio calls: use "microphone" (will be converted to FOREGROUND_SERVICE_TYPE_MICROPHONE)
        ServiceType: callType === 'video' ? 'camera' : 'microphone',
      } as any; // Type assertion needed as ServiceType is not in our interface definition

      // Start the foreground service
      await mod.start(options);

      // Store service info
      this.activeServiceInfo = {
        serviceId,
        callType,
        contactName,
        startTime: Date.now(),
        roomUrl,
      };

      this.isServiceRunning = true;

      // Start periodic updates
      this.startPeriodicUpdates();

      console.log('✅ ForegroundService: Started successfully');
      return true;

    } catch (error) {
      console.error('❌ ForegroundService: Failed to start:', error);
      SentryErrorTracker.getInstance().trackError(error as Error, {
        context: 'ForegroundServiceManager',
        action: 'startService',
        callType,
        contactName,
      });
      return false;
    }
  }

  /**
   * Update foreground service notification
   */
  public async updateService(contactName: string, callType: 'audio' | 'video'): Promise<boolean> {
    if (!this.isSupported() || !this.isServiceRunning || !this.activeServiceInfo) {
      return false;
    }

    try {
      const mod = this.ensureModule();
      if (!mod) {
        return false;
      }
      const duration = this.getCallDuration();
      const options: ForegroundServiceOptions = {
        id: this.activeServiceInfo.serviceId,
        title: callType === 'video' ? '📹 Video Call In Progress' : '📞 Audio Call In Progress',
        message: `${contactName} • ${duration}`,
        icon: 'ic_launcher',
        button: true,
        buttonText: 'Return to Call',
        buttonOnPress: 'HopMedCallReturn',
        setOnlyAlertOnce: true,
        color: '#007AFF',
        progress: {
          max: 100,
          curr: 0,
          indeterminate: true,
        },
      };

      await mod.update(options);

      // Update stored info
      this.activeServiceInfo.contactName = contactName;
      this.activeServiceInfo.callType = callType;

      return true;

    } catch (error) {
      console.warn('⚠️ ForegroundService: Failed to update:', error);
      return false;
    }
  }

  /**
   * Stop foreground service
   */
  public async stopService(): Promise<void> {
    if (!this.isSupported() || !this.isServiceRunning) {
      console.log('📱 ForegroundService: Not running, nothing to stop');
      return;
    }

    try {
      console.log('📱 ForegroundService: Stopping...');

      // Stop periodic updates
      this.stopPeriodicUpdates();

      // Stop the service
      const mod = this.ensureModule();
      if (mod) {
        await mod.stop();
      }

      // Clear state
      this.isServiceRunning = false;
      this.activeServiceInfo = null;

      console.log('✅ ForegroundService: Stopped');

    } catch (error) {
      console.error('❌ ForegroundService: Failed to stop:', error);
      // Force clear state even if stop failed
      this.isServiceRunning = false;
      this.activeServiceInfo = null;
      this.stopPeriodicUpdates();
    }
  }

  /**
   * Start periodic notification updates
   */
  private startPeriodicUpdates(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
    }

    // Update notification every 30 seconds with call duration
    this.updateIntervalId = setInterval(() => {
      if (this.activeServiceInfo) {
        this.updateService(
          this.activeServiceInfo.contactName,
          this.activeServiceInfo.callType
        );
      }
    }, 30000);
  }

  /**
   * Stop periodic updates
   */
  private stopPeriodicUpdates(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  /**
   * Get formatted call duration
   */
  private getCallDuration(): string {
    if (!this.activeServiceInfo) return '0:00';

    const durationMs = Date.now() - this.activeServiceInfo.startTime;
    const durationSec = Math.floor(durationMs / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Check if service is running
   */
  public isRunning(): boolean {
    return this.isServiceRunning;
  }

  /**
   * Get active service info
   */
  public getActiveServiceInfo(): ActiveServiceInfo | null {
    return this.activeServiceInfo;
  }

  /**
   * Wake lock management (Android 14+ requirement)
   */
  public async acquireWakeLock(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      // Note: Wake lock is automatically managed by foreground service
      // This method is here for future enhancements if needed
      console.log('📱 ForegroundService: Wake lock managed by service');
    } catch (error) {
      console.warn('⚠️ ForegroundService: Wake lock acquisition warning:', error);
    }
  }

  /**
   * Release wake lock
   */
  public async releaseWakeLock(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      // Wake lock automatically released when service stops
      console.log('📱 ForegroundService: Wake lock will be released with service');
    } catch (error) {
      console.warn('⚠️ ForegroundService: Wake lock release warning:', error);
    }
  }

  /**
   * Request foreground service permissions (Android 14+)
   */
  public async requestPermissions(): Promise<boolean> {
    if (!this.isSupported()) return true;

    try {
      // On Android 14+, FOREGROUND_SERVICE_CAMERA and FOREGROUND_SERVICE_MICROPHONE
      // permissions are requested automatically when service starts
      console.log('📱 ForegroundService: Permissions will be requested on service start');
      return true;
    } catch (error) {
      console.error('❌ ForegroundService: Permission request failed:', error);
      return false;
    }
  }

  /**
   * Cleanup
   */
  public async destroy(): Promise<void> {
    console.log('🧹 ForegroundService: Destroying...');

    await this.stopService();
    ForegroundServiceManager.instance = null;

    console.log('✅ ForegroundService: Destroyed');
  }
}

export default ForegroundServiceManager;
export type { ForegroundServiceOptions, ActiveServiceInfo };
