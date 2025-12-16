/**
 * VideoCallDebugger - Utility for debugging video call issues
 * Helps track call state and user information for troubleshooting
 */

interface CallSession {
  userId: string;
  userName: string;
  userRole: string;
  roomUrl: string;
  timestamp: Date;
  screen: string;
}

class VideoCallDebugger {
  private static instance: VideoCallDebugger;
  private currentSession: CallSession | null = null;
  private sessionHistory: CallSession[] = [];

  private constructor() {}

  static getInstance(): VideoCallDebugger {
    if (!VideoCallDebugger.instance) {
      VideoCallDebugger.instance = new VideoCallDebugger();
    }
    return VideoCallDebugger.instance;
  }

  /**
   * Log a new call session
   */
  logCallStart(session: {
    userId: string;
    userName: string;
    userRole: string;
    roomUrl: string;
    screen: string;
  }): void {
    const newSession: CallSession = {
      ...session,
      timestamp: new Date(),
    };

    console.log('📞 VideoCallDebugger: Starting call session', {
      userId: session.userId,
      userName: session.userName,
      userRole: session.userRole,
      roomUrl: session.roomUrl,
      screen: session.screen,
      timestamp: newSession.timestamp.toISOString(),
    });

    // Check for potential conflicts
    if (this.currentSession) {
      console.warn('⚠️ VideoCallDebugger: Previous session still active!', {
        previousUser: this.currentSession.userName,
        previousUserId: this.currentSession.userId,
        newUser: session.userName,
        newUserId: session.userId,
      });
    }

    this.currentSession = newSession;
    this.sessionHistory.push(newSession);

    // Keep only last 10 sessions for debugging
    if (this.sessionHistory.length > 10) {
      this.sessionHistory.shift();
    }
  }

  /**
   * Log call end
   */
  logCallEnd(): void {
    if (this.currentSession) {
      console.log('📴 VideoCallDebugger: Ending call session', {
        userId: this.currentSession.userId,
        userName: this.currentSession.userName,
        duration: Date.now() - this.currentSession.timestamp.getTime(),
      });
      this.currentSession = null;
    }
  }

  /**
   * Get current session info
   */
  getCurrentSession(): CallSession | null {
    return this.currentSession;
  }

  /**
   * Get session history
   */
  getSessionHistory(): CallSession[] {
    return [...this.sessionHistory];
  }

  /**
   * Clear all sessions (useful on logout)
   */
  clearSessions(): void {
    console.log('🧹 VideoCallDebugger: Clearing all sessions');
    this.currentSession = null;
    this.sessionHistory = [];
  }

  /**
   * Check for duplicate users
   */
  checkForDuplicateUser(userId: string): boolean {
    if (this.currentSession && this.currentSession.userId === userId) {
      console.error('❌ VideoCallDebugger: Duplicate user detected!', {
        userId,
        existingSession: this.currentSession,
      });
      return true;
    }
    return false;
  }
}

export default VideoCallDebugger.getInstance();
