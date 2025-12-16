import type { Observable } from 'rxjs';

import type { HealthMetric } from '../../types/health';
import type {
  WatchDevice,
  WatchCapabilities,
  WatchMessage,
  WatchConnection,
  WatchError,
} from '../../types/watch';
import {
  WatchPlatform as WatchPlatformType,
  ConnectionStatus,
  WatchErrorType,
} from '../../types/watch';

export interface WatchPlatform {
  connect(): Promise<boolean>;
  disconnect(): void;
  sendData(data: any): Promise<void>;
  subscribeToHealth(): Observable<HealthMetric>;
  subscribeToMessages(): Observable<WatchMessage>;
  getCapabilities(): WatchCapabilities;
  isConnected(): boolean;
  getBatteryLevel(): Promise<number | null>;
  getDeviceInfo(): Promise<Partial<WatchDevice>>;
}

export interface WatchPlatformConfig {
  autoReconnect: boolean;
  syncInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

export class WatchPlatformManager {
  private platforms: Map<string, WatchPlatform> = new Map();
  private activeConnections: Map<string, WatchConnection> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private healthSubscriptions: Map<string, Observable<HealthMetric>> = new Map();
  private messageSubscriptions: Map<string, Observable<WatchMessage>> = new Map();
  private errors: WatchError[] = [];

  private config: WatchPlatformConfig = {
    autoReconnect: true,
    syncInterval: 30000, // 30 seconds
    maxReconnectAttempts: 5,
    heartbeatInterval: 60000, // 1 minute
  };

  registerPlatform(deviceId: string, platform: WatchPlatform): void {
    this.platforms.set(deviceId, platform);
    console.log(`Registered platform for device: ${deviceId}`);
  }

  unregisterPlatform(deviceId: string): void {
    this.platforms.delete(deviceId);
    this.activeConnections.delete(deviceId);
    this.reconnectAttempts.delete(deviceId);
    this.healthSubscriptions.delete(deviceId);
    this.messageSubscriptions.delete(deviceId);
    console.log(`Unregistered platform for device: ${deviceId}`);
  }

  async connectToDevice(deviceId: string): Promise<boolean> {
    const platform = this.platforms.get(deviceId);
    if (!platform) {
      this.addError(
        deviceId,
        WatchErrorType.CONNECTION_FAILED,
        `Platform not found for device ${deviceId}`
      );
      return false;
    }

    try {
      // Update connection status to connecting
      this.updateConnectionStatus(deviceId, ConnectionStatus.CONNECTING);

      const connected = await platform.connect();

      if (connected) {
        this.updateConnectionStatus(deviceId, ConnectionStatus.CONNECTED);
        this.reconnectAttempts.set(deviceId, 0);

        // Set up health data subscription
        this.setupHealthSubscription(deviceId, platform);

        // Set up message subscription
        this.setupMessageSubscription(deviceId, platform);

        // Start heartbeat monitoring
        this.startHeartbeat(deviceId, platform);

        console.log(`Successfully connected to device: ${deviceId}`);
        return true;
      } else {
        this.updateConnectionStatus(deviceId, ConnectionStatus.ERROR);
        this.addError(deviceId, WatchErrorType.CONNECTION_FAILED, 'Connection attempt failed');
        return false;
      }
    } catch (error) {
      console.error(`Failed to connect to device ${deviceId}:`, error);
      this.updateConnectionStatus(deviceId, ConnectionStatus.ERROR);
      this.addError(deviceId, WatchErrorType.CONNECTION_FAILED, `Connection error: ${error}`);

      // Attempt reconnection if enabled
      if (this.config.autoReconnect) {
        this.scheduleReconnection(deviceId);
      }

      return false;
    }
  }

  async disconnectFromDevice(deviceId: string): Promise<void> {
    const platform = this.platforms.get(deviceId);
    if (!platform) {
      return;
    }

    try {
      platform.disconnect();
      this.updateConnectionStatus(deviceId, ConnectionStatus.DISCONNECTED);

      // Clean up subscriptions
      this.healthSubscriptions.delete(deviceId);
      this.messageSubscriptions.delete(deviceId);

      console.log(`Disconnected from device: ${deviceId}`);
    } catch (error) {
      console.error(`Error disconnecting from device ${deviceId}:`, error);
      this.addError(deviceId, WatchErrorType.CONNECTION_FAILED, `Disconnection error: ${error}`);
    }
  }

  async sendDataToDevice(deviceId: string, data: any): Promise<boolean> {
    const platform = this.platforms.get(deviceId);
    if (!platform || !platform.isConnected()) {
      this.addError(deviceId, WatchErrorType.CONNECTION_FAILED, 'Device not connected');
      return false;
    }

    try {
      await platform.sendData(data);
      return true;
    } catch (error) {
      console.error(`Failed to send data to device ${deviceId}:`, error);
      this.addError(deviceId, WatchErrorType.SYNC_FAILED, `Send data error: ${error}`);
      return false;
    }
  }

  getDeviceCapabilities(deviceId: string): WatchCapabilities | null {
    const platform = this.platforms.get(deviceId);
    return platform ? platform.getCapabilities() : null;
  }

  isDeviceConnected(deviceId: string): boolean {
    const connection = this.activeConnections.get(deviceId);
    return connection?.status === ConnectionStatus.CONNECTED;
  }

  async getDeviceBatteryLevel(deviceId: string): Promise<number | null> {
    const platform = this.platforms.get(deviceId);
    if (!platform || !platform.isConnected()) {
      return null;
    }

    try {
      return await platform.getBatteryLevel();
    } catch (error) {
      console.error(`Failed to get battery level for device ${deviceId}:`, error);
      return null;
    }
  }

  async getDeviceInfo(deviceId: string): Promise<Partial<WatchDevice> | null> {
    const platform = this.platforms.get(deviceId);
    if (!platform) {
      return null;
    }

    try {
      const info = await platform.getDeviceInfo();
      const batteryLevel = await this.getDeviceBatteryLevel(deviceId);
      const capabilities = this.getDeviceCapabilities(deviceId);
      const connection = this.activeConnections.get(deviceId);

      return {
        ...info,
        id: deviceId,
        batteryLevel: batteryLevel ?? undefined,
        capabilities: capabilities ?? undefined,
        isConnected: this.isDeviceConnected(deviceId),
        lastSync: connection?.lastConnected || null,
      };
    } catch (error) {
      console.error(`Failed to get device info for ${deviceId}:`, error);
      return null;
    }
  }

  getAllConnectedDevices(): string[] {
    return Array.from(this.activeConnections.keys()).filter(deviceId =>
      this.isDeviceConnected(deviceId)
    );
  }

  getHealthDataStream(deviceId: string): Observable<HealthMetric> | null {
    return this.healthSubscriptions.get(deviceId) || null;
  }

  getMessageStream(deviceId: string): Observable<WatchMessage> | null {
    return this.messageSubscriptions.get(deviceId) || null;
  }

  getErrors(): WatchError[] {
    return [...this.errors];
  }

  clearErrors(deviceId?: string): void {
    if (deviceId) {
      this.errors = this.errors.filter(error => error.deviceId !== deviceId);
    } else {
      this.errors = [];
    }
  }

  updateConfig(newConfig: Partial<WatchPlatformConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  private updateConnectionStatus(deviceId: string, status: ConnectionStatus): void {
    const connection = this.activeConnections.get(deviceId) || {
      deviceId,
      status: ConnectionStatus.DISCONNECTED,
      lastConnected: null,
      signalStrength: undefined,
      connectionType: 'bluetooth' as const,
      autoReconnect: this.config.autoReconnect,
    };

    connection.status = status;
    if (status === ConnectionStatus.CONNECTED) {
      connection.lastConnected = new Date();
    }

    this.activeConnections.set(deviceId, connection);
  }

  private setupHealthSubscription(deviceId: string, platform: WatchPlatform): void {
    try {
      const healthStream = platform.subscribeToHealth();
      this.healthSubscriptions.set(deviceId, healthStream);

      // Subscribe to handle errors
      healthStream.subscribe({
        next: healthData => {
          console.log(`Received health data from ${deviceId}:`, healthData);
        },
        error: error => {
          console.error(`Health data stream error for ${deviceId}:`, error);
          this.addError(deviceId, WatchErrorType.SENSOR_ERROR, `Health data error: ${error}`);
        },
      });
    } catch (error) {
      console.error(`Failed to setup health subscription for ${deviceId}:`, error);
      this.addError(deviceId, WatchErrorType.SENSOR_ERROR, `Health subscription error: ${error}`);
    }
  }

  private setupMessageSubscription(deviceId: string, platform: WatchPlatform): void {
    try {
      const messageStream = platform.subscribeToMessages();
      this.messageSubscriptions.set(deviceId, messageStream);

      // Subscribe to handle errors
      messageStream.subscribe({
        next: message => {
          console.log(`Received message from ${deviceId}:`, message);
        },
        error: error => {
          console.error(`Message stream error for ${deviceId}:`, error);
          this.addError(deviceId, WatchErrorType.SYNC_FAILED, `Message error: ${error}`);
        },
      });
    } catch (error) {
      console.error(`Failed to setup message subscription for ${deviceId}:`, error);
      this.addError(deviceId, WatchErrorType.SYNC_FAILED, `Message subscription error: ${error}`);
    }
  }

  private startHeartbeat(deviceId: string, platform: WatchPlatform): void {
    const heartbeatInterval = setInterval(async () => {
      if (!platform.isConnected()) {
        clearInterval(heartbeatInterval);
        this.updateConnectionStatus(deviceId, ConnectionStatus.DISCONNECTED);

        if (this.config.autoReconnect) {
          this.scheduleReconnection(deviceId);
        }
        return;
      }

      try {
        // Send heartbeat ping
        await platform.sendData({
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Heartbeat failed for ${deviceId}:`, error);
        clearInterval(heartbeatInterval);
        this.updateConnectionStatus(deviceId, ConnectionStatus.ERROR);

        if (this.config.autoReconnect) {
          this.scheduleReconnection(deviceId);
        }
      }
    }, this.config.heartbeatInterval);
  }

  private scheduleReconnection(deviceId: string): void {
    const attempts = this.reconnectAttempts.get(deviceId) || 0;

    if (attempts >= this.config.maxReconnectAttempts) {
      console.log(`Max reconnection attempts reached for device ${deviceId}`);
      this.addError(
        deviceId,
        WatchErrorType.CONNECTION_FAILED,
        'Max reconnection attempts exceeded'
      );
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // Exponential backoff, max 30s

    setTimeout(async () => {
      console.log(`Attempting reconnection ${attempts + 1} for device ${deviceId}`);
      this.reconnectAttempts.set(deviceId, attempts + 1);

      const success = await this.connectToDevice(deviceId);
      if (!success && this.config.autoReconnect) {
        this.scheduleReconnection(deviceId);
      }
    }, delay);
  }

  private addError(deviceId: string, type: WatchErrorType, message: string): void {
    const error: WatchError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deviceId,
      type,
      message,
      timestamp: new Date(),
      isResolved: false,
    };

    this.errors.push(error);

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }

    console.error(`Watch error for ${deviceId}:`, error);
  }

  // Cleanup method
  destroy(): void {
    // Disconnect all devices
    for (const deviceId of this.platforms.keys()) {
      this.disconnectFromDevice(deviceId);
    }

    // Clear all data
    this.platforms.clear();
    this.activeConnections.clear();
    this.reconnectAttempts.clear();
    this.healthSubscriptions.clear();
    this.messageSubscriptions.clear();
    this.errors = [];
  }
}
