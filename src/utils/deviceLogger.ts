/**
 * ✅ DEVICE-VISIBLE LOGGING UTILITIES
 *
 * Provides logging that works on real devices where console.log isn't visible
 * Includes alerts, visual indicators, and persistent logging
 */

import { Alert, Platform } from 'react-native';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

class DeviceLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 50;

  private addLog(level: LogEntry['level'], message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Also log to console for development
    if (__DEV__) {
      console.log(`[${entry.timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
    }
  }

  info(message: string, data?: any) {
    this.addLog('info', message, data);
  }

  warn(message: string, data?: any) {
    this.addLog('warn', message, data);
  }

  error(message: string, data?: any) {
    this.addLog('error', message, data);
  }

  debug(message: string, data?: any) {
    this.addLog('debug', message, data);
  }

  // Show critical errors as alerts
  alertError(title: string, message: string, data?: any) {
    this.error(message, data);

    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Alert.alert(`🚨 ${title}`, `${message}\n\nCheck debug panel for details.`, [
        { text: 'OK', style: 'default' },
        { text: 'Show Logs', onPress: () => this.showLogs() },
      ]);
    }
  }

  // Show logs in an alert (for quick debugging)
  showLogs() {
    const recentLogs = this.logs.slice(0, 10);
    const logText = recentLogs
      .map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
      .join('\n');

    Alert.alert('📝 Recent Logs', logText || 'No logs yet', [{ text: 'OK' }]);
  }

  // Get all logs for debug panel
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }

  // Video call specific logging
  logVideoCallEvent(event: string, data?: any) {
    this.info(`🎥 Video Call: ${event}`, data);
  }

  logParticipantState(participant: any, isLocal: boolean) {
    const videoState = participant.tracks?.video?.state || 'unknown';
    const audioState = participant.tracks?.audio?.state || 'unknown';
    const hasVideo = participant.tracks?.video?.state === 'playable';
    const hasAudio = participant.tracks?.audio?.state === 'playable';

    this.debug(
      `${isLocal ? 'LOCAL' : 'REMOTE'} Participant: ${participant.user_name || 'Unknown'}`,
      {
        videoState,
        audioState,
        hasVideo,
        hasAudio,
        videoBlocked: participant.tracks?.video?.blocked,
        videoOff: participant.tracks?.video?.off,
      }
    );
  }

  logTrackIssue(participant: any, trackType: 'video' | 'audio', issue: string) {
    this.warn(`Track Issue: ${trackType.toUpperCase()} for ${participant.user_name || 'Unknown'}`, {
      issue,
      trackState: participant.tracks?.[trackType],
    });
  }
}

// Export singleton instance
export const deviceLogger = new DeviceLogger();

// Convenience functions
export const logVideoCall = (event: string, data?: any) =>
  deviceLogger.logVideoCallEvent(event, data);
export const logParticipant = (participant: any, isLocal: boolean) =>
  deviceLogger.logParticipantState(participant, isLocal);
export const logTrackIssue = (participant: any, trackType: 'video' | 'audio', issue: string) =>
  deviceLogger.logTrackIssue(participant, trackType, issue);
export const showDeviceLogs = () => deviceLogger.showLogs();
export const alertError = (title: string, message: string, data?: any) =>
  deviceLogger.alertError(title, message, data);
