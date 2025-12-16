/**
 * DailyCallManager - Singleton manager for Daily.co call instances
 *
 * Ensures proper cleanup of Daily.co instances across the app to prevent
 * duplicate instance errors when switching users or navigating between screens.
 */

import Daily from '@daily-co/react-native-daily-js';

import CallPerformanceMonitor from '../utils/CallPerformanceMonitor';

class DailyCallManager {
  private static instance: DailyCallManager;
  private activeCallObject: any = null;
  private activeRoomUrl: string | null = null;
  // ✅ FIX: Add async lock to prevent race conditions
  private operationLock: Promise<any> | null = null;

  private constructor() {}

  static getInstance(): DailyCallManager {
    if (!DailyCallManager.instance) {
      DailyCallManager.instance = new DailyCallManager();
    }
    return DailyCallManager.instance;
  }

  /**
   * Get or create a call object for the specified room
   * Ensures only one call object exists at a time
   * ✅ FIXED: Added async locking to prevent race conditions
   */
  async getCallObject(roomUrl: string): Promise<any> {
    // ✅ Wait for any pending operations to complete
    if (this.operationLock) {
      if (__DEV__) {
        console.log('🔒 DailyCallManager: Waiting for pending operation...');
      }
      await this.operationLock;
    }

    // ✅ Create new lock for this operation
    this.operationLock = this.performGetCallObject(roomUrl);

    try {
      const result = await this.operationLock;
      return result;
    } finally {
      // ✅ Clear lock after operation completes
      this.operationLock = null;
    }
  }

  /**
   * Internal method to perform the actual getCallObject operation
   */
  private async performGetCallObject(roomUrl: string): Promise<any> {
    if (__DEV__) {
      console.log('🎯 DailyCallManager: Getting call object for room:', roomUrl);
    }

    // If we have an active call object for a different room, clean it up
    if (this.activeCallObject && this.activeRoomUrl !== roomUrl) {
      if (__DEV__) {
        console.log('🧹 DailyCallManager: Cleaning up previous call object');
      }
      await this.cleanup();
    }

    // If we don't have an active call object, create one
    if (!this.activeCallObject) {
      if (__DEV__) {
        console.log('✨ DailyCallManager: Creating new call object');
      }
      this.activeCallObject = Daily.createCallObject();
      this.activeRoomUrl = roomUrl;
    }

    return this.activeCallObject;
  }

  /**
   * Clean up the active call object
   * Called when leaving a call or logging out
   */
  async cleanup(): Promise<void> {
    if (__DEV__) {
      console.log('🧹 DailyCallManager: Starting cleanup');
    }

    if (this.activeCallObject) {
      try {
        // Check if we're in a meeting
        const meetingState = this.activeCallObject.meetingState();
        if (__DEV__) {
          console.log('📊 DailyCallManager: Current meeting state:', meetingState);
        }

        if (meetingState === 'joined' || meetingState === 'joining') {
          if (__DEV__) {
            console.log('🚪 DailyCallManager: Leaving meeting');
          }
          await this.activeCallObject.leave();
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ DailyCallManager: Error during leave:', error);
        }
      }

      try {
        if (__DEV__) {
          console.log('💥 DailyCallManager: Destroying call object');
        }
        await this.activeCallObject.destroy();
      } catch (error) {
        if (__DEV__) {
          console.error('❌ DailyCallManager: Error during destroy:', error);
        }
      }

      try {
        CallPerformanceMonitor.endSession();
      } catch {}
      this.activeCallObject = null;
      this.activeRoomUrl = null;
      if (__DEV__) {
        console.log('✅ DailyCallManager: Cleanup complete');
      }
    }
  }

  /**
   * Force cleanup - used during logout to ensure all instances are destroyed
   */
  async forceCleanup(): Promise<void> {
    if (__DEV__) {
      console.log('🔨 DailyCallManager: Force cleanup initiated');
    }

    // Try to destroy any existing call object
    if (this.activeCallObject) {
      try {
        // Don't wait for leave, just destroy immediately
        await this.activeCallObject.destroy();
      } catch (error) {
        if (__DEV__) {
          console.error('❌ DailyCallManager: Force cleanup error (ignored):', error);
        }
      }
    }
    try {
      CallPerformanceMonitor.endSession();
    } catch {}
    this.activeCallObject = null;
    this.activeRoomUrl = null;
    if (__DEV__) {
      console.log('✅ DailyCallManager: Force cleanup complete');
    }
  }

  /**
   * Check if there's an active call
   */
  hasActiveCall(): boolean {
    if (!this.activeCallObject) return false;

    try {
      const state = this.activeCallObject.meetingState();
      return state === 'joined' || state === 'joining';
    } catch {
      return false;
    }
  }

  /**
   * Get the active call object (if any)
   */
  getActiveCallObject(): any {
    return this.activeCallObject;
  }
}

export default DailyCallManager.getInstance();
