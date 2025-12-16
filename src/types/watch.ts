import type { HealthMetric, HealthDataType } from './health';

export interface WatchDevice {
  id: string;
  name: string;
  platform: WatchPlatform;
  model: string;
  batteryLevel?: number;
  isConnected: boolean;
  lastSync: Date | null;
  capabilities: WatchCapabilities;
  firmwareVersion?: string;
}

export enum WatchPlatform {
  WEAR_OS = 'wearos',
  WATCH_OS = 'watchos',
  OTHER = 'other',
}

export interface WatchCapabilities {
  heartRateMonitoring: boolean;
  stepCounting: boolean;
  sleepTracking: boolean;
  gpsTracking: boolean;
  bloodOxygenMonitoring: boolean;
  ecgMonitoring: boolean;
  bodyTemperature: boolean;
  stressMonitoring: boolean;
  batteryLevel: boolean;
  notifications: boolean;
  appInstallation: boolean;
  voiceAssistant: boolean;
}

export interface WatchConnection {
  deviceId: string;
  status: ConnectionStatus;
  lastConnected: Date | null;
  signalStrength?: number;
  connectionType: 'bluetooth' | 'wifi' | 'cellular';
  autoReconnect: boolean;
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
  PAIRING = 'pairing',
  ERROR = 'error',
}

export interface WatchMessage {
  id: string;
  type: WatchMessageType;
  payload: any;
  timestamp: Date;
  deviceId: string;
  priority: 'high' | 'medium' | 'low';
}

export enum WatchMessageType {
  HEALTH_DATA = 'health_data',
  HEART_RATE = 'heart_rate',
  STEPS = 'steps',
  EXERCISE_START = 'exercise_start',
  EXERCISE_END = 'exercise_end',
  EMERGENCY_ALERT = 'emergency_alert',
  BATTERY_LOW = 'battery_low',
  SYNC_REQUEST = 'sync_request',
  STATUS_UPDATE = 'status_update',
  NOTIFICATION = 'notification',
}

export interface WatchHealthData {
  deviceId: string;
  metrics: HealthMetric[];
  collectionTime: Date;
  batchId: string;
}

export interface WatchSyncConfig {
  deviceId: string;
  syncInterval: number; // in milliseconds
  dataTypes: HealthDataType[];
  realTimeSync: boolean;
  backgroundSync: boolean;
  wifiOnly: boolean;
  batteryOptimization: boolean;
}

export interface WatchNotification {
  id: string;
  title: string;
  body: string;
  type: 'health_alert' | 'reminder' | 'achievement' | 'system';
  actions?: WatchNotificationAction[];
  vibrationPattern?: number[];
  soundEnabled: boolean;
  timestamp: Date;
}

export interface WatchNotificationAction {
  id: string;
  title: string;
  icon?: string;
  type: 'reply' | 'quick_action' | 'open_app';
}

export interface WatchApp {
  id: string;
  name: string;
  version: string;
  isInstalled: boolean;
  isEnabled: boolean;
  permissions: string[];
  lastUpdated: Date;
}

export interface WatchPairingRequest {
  deviceId: string;
  deviceName: string;
  platform: WatchPlatform;
  pairingCode?: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

export interface WatchError {
  id: string;
  deviceId: string;
  type: WatchErrorType;
  message: string;
  code?: string;
  timestamp: Date;
  isResolved: boolean;
  resolution?: string;
}

export enum WatchErrorType {
  CONNECTION_FAILED = 'connection_failed',
  SYNC_FAILED = 'sync_failed',
  PERMISSION_DENIED = 'permission_denied',
  BATTERY_LOW = 'battery_low',
  SENSOR_ERROR = 'sensor_error',
  APP_CRASH = 'app_crash',
  FIRMWARE_UPDATE_REQUIRED = 'firmware_update_required',
  AUTHENTICATION_FAILED = 'authentication_failed',
}

export interface WatchSettings {
  deviceId: string;
  displaySettings: {
    brightness: number;
    alwaysOn: boolean;
    wakeOnRaise: boolean;
    screenTimeout: number;
  };
  healthSettings: {
    heartRateMonitoring: boolean;
    stepGoal: number;
    sleepTracking: boolean;
    stressMonitoring: boolean;
    fallDetection: boolean;
  };
  notificationSettings: {
    enabled: boolean;
    vibrationStrength: number;
    soundEnabled: boolean;
    filteredApps: string[];
  };
  privacySettings: {
    dataSharing: boolean;
    locationTracking: boolean;
    analyticsEnabled: boolean;
  };
}
