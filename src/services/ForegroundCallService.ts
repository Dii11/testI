import { NativeModules, Platform } from 'react-native';

interface ForegroundCallServiceNative {
  startService(callerName: string, callType: string): Promise<boolean>;
  stopService(): Promise<boolean>;
  isServiceRunning(): Promise<boolean>;
}

const { ForegroundCallService: NativeService } = NativeModules as {
  ForegroundCallService: ForegroundCallServiceNative;
};

/**
 * Foreground Call Service Manager
 * 
 * Manages Android foreground service for active calls.
 * This is CRITICAL for Android 12+ to prevent the system from killing
 * the app during calls.
 * 
 * The service shows a persistent notification that can't be dismissed
 * while a call is active.
 * 
 * Reference: VideoSDK official example implementation
 */
class ForegroundCallService {
  private static instance: ForegroundCallService;
  private isRunning: boolean = false;
  private currentCallerName: string | null = null;
  private currentCallType: 'audio' | 'video' | null = null;

  private constructor() {}

  static getInstance(): ForegroundCallService {
    if (!ForegroundCallService.instance) {
      ForegroundCallService.instance = new ForegroundCallService();
    }
    return ForegroundCallService.instance;
  }

  /**
   * Start the foreground service
   * Call this when a call starts/is answered
   */
  async startService(callerName: string, callType: 'audio' | 'video'): Promise<void> {
    // Only needed on Android
    if (Platform.OS !== 'android') {
      console.log('📱 Foreground service only needed on Android');
      return;
    }

    // Check if module is available
    if (!NativeService) {
      console.warn('⚠️ ForegroundCallService native module not available');
      console.warn('💡 Follow FOREGROUND_SERVICE_IMPLEMENTATION.md to set up native module');
      return;
    }

    // Check if already running with same params
    if (this.isRunning && this.currentCallerName === callerName && this.currentCallType === callType) {
      console.log('⚠️ Foreground service already running with same parameters');
      return;
    }

    try {
      console.log(`🚀 Starting foreground service: ${callerName} (${callType})`);
      
      await NativeService.startService(callerName, callType);
      
      this.isRunning = true;
      this.currentCallerName = callerName;
      this.currentCallType = callType;
      
      console.log('✅ Foreground call service started successfully');
    } catch (error: any) {
      console.error('❌ Failed to start foreground service:', error);
      
      // Provide helpful error messages
      if (error.code === 'PERMISSION_ERROR') {
        console.error('💡 Missing FOREGROUND_SERVICE permission in AndroidManifest.xml');
      } else if (error.code === 'SERVICE_ERROR') {
        console.error('💡 Check if ForegroundCallService is declared in AndroidManifest.xml');
      }
      
      // Don't throw - allow call to continue even if foreground service fails
      console.warn('⚠️ Call will continue without foreground service (may be killed on Android 12+)');
    }
  }

  /**
   * Stop the foreground service
   * Call this when a call ends
   */
  async stopService(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    if (!NativeService) {
      console.warn('⚠️ ForegroundCallService native module not available');
      return;
    }

    if (!this.isRunning) {
      console.log('⚠️ Foreground service not running, nothing to stop');
      return;
    }

    try {
      console.log('🛑 Stopping foreground service');
      
      await NativeService.stopService();
      
      this.isRunning = false;
      this.currentCallerName = null;
      this.currentCallType = null;
      
      console.log('✅ Foreground call service stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop foreground service:', error);
      
      // Reset state even if stop failed
      this.isRunning = false;
      this.currentCallerName = null;
      this.currentCallType = null;
    }
  }

  /**
   * Check if service is currently running
   */
  async checkServiceStatus(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    if (!NativeService) {
      return false;
    }

    try {
      const isRunning = await NativeService.isServiceRunning();
      
      // Sync internal state with actual service state
      if (isRunning !== this.isRunning) {
        console.log(`⚠️ Service state mismatch. Internal: ${this.isRunning}, Actual: ${isRunning}`);
        this.isRunning = isRunning;
      }
      
      return isRunning;
    } catch (error) {
      console.error('❌ Failed to check service status:', error);
      return false;
    }
  }

  /**
   * Get current service state (local, without native call)
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current caller info
   */
  getCurrentCallInfo(): { callerName: string; callType: 'audio' | 'video' } | null {
    if (!this.isRunning || !this.currentCallerName || !this.currentCallType) {
      return null;
    }
    
    return {
      callerName: this.currentCallerName,
      callType: this.currentCallType,
    };
  }

  /**
   * Force reset state (use with caution)
   * Useful if app crashes and state gets out of sync
   */
  async forceReset(): Promise<void> {
    console.log('🔄 Force resetting foreground service state');
    
    try {
      await this.stopService();
    } catch (error) {
      console.error('Error during force reset:', error);
    }
    
    this.isRunning = false;
    this.currentCallerName = null;
    this.currentCallType = null;
  }
}

export default ForegroundCallService;
