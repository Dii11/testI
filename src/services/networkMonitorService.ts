import type { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export enum NetworkQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  POOR = 'poor',
  DISCONNECTED = 'disconnected',
  UNKNOWN = 'unknown',
}

export enum ConnectionType {
  WIFI = 'wifi',
  CELLULAR = 'cellular',
  ETHERNET = 'ethernet',
  NONE = 'none',
  UNKNOWN = 'unknown',
}

export interface NetworkState {
  isConnected: boolean;
  connectionType: ConnectionType;
  quality: NetworkQuality;
  isReachable: boolean;
  strength?: number; // 0-100 for cellular
  latency?: number; // milliseconds
  downlink?: number; // Mbps
  timestamp: number;
}

export interface NetworkChangeListener {
  (state: NetworkState): void;
}

let NetInfoModule: any = null;
const isExpoGo = (Constants as any).appOwnership === 'expo';

class NetworkMonitorService {
  private static instance: NetworkMonitorService;
  private listeners: Set<NetworkChangeListener> = new Set();
  private currentState: NetworkState;
  private unsubscribe?: () => void;
  private qualityCheckInterval?: NodeJS.Timeout;
  private lastConnectedTime: number = 0;
  private disconnectionStartTime: number = 0;

  private constructor() {
    this.currentState = {
      isConnected: false,
      connectionType: ConnectionType.UNKNOWN,
      quality: NetworkQuality.UNKNOWN,
      isReachable: false,
      timestamp: Date.now(),
    };
    this.initialize();
  }

  public static getInstance(): NetworkMonitorService {
    if (!NetworkMonitorService.instance) {
      NetworkMonitorService.instance = new NetworkMonitorService();
    }
    return NetworkMonitorService.instance;
  }

  public static destroyInstance(): void {
    if (NetworkMonitorService.instance) {
      NetworkMonitorService.instance.destroy();
      NetworkMonitorService.instance = null as any;
    }
  }

  private ensureNetInfo(): any {
    if (Platform.OS === 'web') return null;
    if (isExpoGo) return null; // Avoid requiring native module in Expo Go
    if (!NetInfoModule) {
      try {
        const mod = require('@react-native-community/netinfo');
        NetInfoModule = mod.default || mod;
      } catch (e) {
        NetInfoModule = null;
      }
    }
    return NetInfoModule;
  }

  private async initialize(): Promise<void> {
    try {
      const NetInfo = this.ensureNetInfo();
      if (NetInfo) {
        // Get initial network state
        const initialState = await NetInfo.fetch();
        this.updateNetworkState(initialState);

        // Start monitoring network changes
        this.unsubscribe = NetInfo.addEventListener(this.handleNetworkChange.bind(this));

        // Start quality monitoring for active connections
        this.startQualityMonitoring();

        console.log('📡 Network monitoring initialized');
      } else {
        // Degrade gracefully: periodically run quality checks using fetch only
        this.startQualityMonitoring();
        console.log('📡 NetInfo native module unavailable; running degraded network checks');
      }
    } catch (error) {
      console.error('Failed to initialize network monitoring:', error);
    }
  }

  private handleNetworkChange(state: NetInfoState): void {
    this.updateNetworkState(state);
  }

  private updateNetworkState(netInfoState: NetInfoState): void {
    const wasConnected = this.currentState.isConnected;
    const now = Date.now();

    const newState: NetworkState = {
      isConnected: netInfoState.isConnected ?? false,
      connectionType: this.mapConnectionType(netInfoState.type),
      quality: this.assessNetworkQuality(netInfoState),
      isReachable: netInfoState.isInternetReachable ?? false,
      strength: this.getSignalStrength(netInfoState),
      timestamp: now,
    };

    // Track connection/disconnection times
    if (!wasConnected && newState.isConnected) {
      this.lastConnectedTime = now;
      if (this.disconnectionStartTime > 0) {
        const disconnectionDuration = now - this.disconnectionStartTime;
        console.log(`📡 Network reconnected after ${disconnectionDuration}ms`);
        this.disconnectionStartTime = 0;
      }
    } else if (wasConnected && !newState.isConnected) {
      this.disconnectionStartTime = now;
      console.log('📡 Network disconnected');
    }

    const stateChanged = this.hasStateChanged(this.currentState, newState);
    this.currentState = newState;

    if (stateChanged) {
      console.log('📡 Network state changed:', {
        connected: newState.isConnected,
        type: newState.connectionType,
        quality: newState.quality,
        reachable: newState.isReachable,
      });

      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(newState);
        } catch (error) {
          console.error('Error in network listener:', error);
        }
      });
    }
  }

  private mapConnectionType(type: string): ConnectionType {
    switch (type) {
      case 'wifi':
        return ConnectionType.WIFI;
      case 'cellular':
        return ConnectionType.CELLULAR;
      case 'ethernet':
        return ConnectionType.ETHERNET;
      case 'none':
        return ConnectionType.NONE;
      default:
        return ConnectionType.UNKNOWN;
    }
  }

  private assessNetworkQuality(state: NetInfoState): NetworkQuality {
    if (!state.isConnected) {
      return NetworkQuality.DISCONNECTED;
    }

    if (!state.isInternetReachable) {
      return NetworkQuality.POOR;
    }

    // For WiFi connections
    if (state.type === 'wifi' && state.details) {
      const wifiDetails = state.details as any;
      const strength = wifiDetails.strength;

      if (strength !== undefined) {
        if (strength >= -50) return NetworkQuality.EXCELLENT;
        if (strength >= -60) return NetworkQuality.GOOD;
        return NetworkQuality.POOR;
      }
    }

    // For cellular connections
    if (state.type === 'cellular' && state.details) {
      const cellularDetails = state.details as any;
      const generation = cellularDetails.cellularGeneration;

      if (generation === '5g') return NetworkQuality.EXCELLENT;
      if (generation === '4g') return NetworkQuality.GOOD;
      if (generation === '3g') return NetworkQuality.POOR;
      return NetworkQuality.POOR;
    }

    // Default assessment based on connection type
    if (state.type === 'wifi') return NetworkQuality.GOOD;
    // Handle other connection types that might be considered good
    if (state.type === 'other') return NetworkQuality.GOOD;

    return NetworkQuality.UNKNOWN;
  }

  private getSignalStrength(state: NetInfoState): number | undefined {
    if (state.type === 'wifi' && state.details) {
      const wifiDetails = state.details as any;
      if (wifiDetails.strength !== undefined) {
        // Convert dBm to percentage (rough approximation)
        const dbm = wifiDetails.strength;
        return Math.max(0, Math.min(100, (dbm + 100) * 2));
      }
    }

    if (state.type === 'cellular' && state.details) {
      const cellularDetails = state.details as any;
      // This would need platform-specific implementation
      return cellularDetails.strength;
    }

    return undefined;
  }

  private hasStateChanged(oldState: NetworkState, newState: NetworkState): boolean {
    return (
      oldState.isConnected !== newState.isConnected ||
      oldState.connectionType !== newState.connectionType ||
      oldState.quality !== newState.quality ||
      oldState.isReachable !== newState.isReachable
    );
  }

  private startQualityMonitoring(): void {
    // Check network quality every 5 seconds when connected
    this.qualityCheckInterval = setInterval(() => {
      if (this.currentState.isConnected) {
        this.performQualityCheck();
      }
    }, 5000);
  }

  private async performQualityCheck(): Promise<void> {
    try {
      const startTime = Date.now();

      // Simple ping test to measure latency
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const latency = Date.now() - startTime;
        this.currentState.latency = latency;

        // Update quality based on latency
        let quality = this.currentState.quality;
        if (latency < 100) {
          quality = NetworkQuality.EXCELLENT;
        } else if (latency < 300) {
          quality = NetworkQuality.GOOD;
        } else {
          quality = NetworkQuality.POOR;
        }

        if (quality !== this.currentState.quality) {
          this.currentState.quality = quality;
          this.currentState.timestamp = Date.now();

          this.listeners.forEach(listener => {
            try {
              listener(this.currentState);
            } catch (error) {
              console.error('Error in network listener during quality update:', error);
            }
          });
        }
      }
    } catch (error) {
      // Network quality check failed - likely poor connection
      if (this.currentState.quality !== NetworkQuality.POOR) {
        this.currentState.quality = NetworkQuality.POOR;
        this.currentState.timestamp = Date.now();

        this.listeners.forEach(listener => {
          try {
            listener(this.currentState);
          } catch (error) {
            console.error('Error in network listener during quality failure:', error);
          }
        });
      }
    }
  }

  // Public API
  getCurrentState(): NetworkState {
    return { ...this.currentState };
  }

  isConnected(): boolean {
    return this.currentState.isConnected && this.currentState.isReachable;
  }

  getConnectionType(): ConnectionType {
    return this.currentState.connectionType;
  }

  getNetworkQuality(): NetworkQuality {
    return this.currentState.quality;
  }

  getDisconnectionDuration(): number {
    if (this.disconnectionStartTime === 0) return 0;
    return Date.now() - this.disconnectionStartTime;
  }

  getTimeSinceLastConnection(): number {
    if (this.lastConnectedTime === 0) return 0;
    return Date.now() - this.lastConnectedTime;
  }

  isVideoCallViable(): boolean {
    const state = this.currentState;
    return (
      state.isConnected &&
      state.isReachable &&
      (state.quality === NetworkQuality.EXCELLENT || state.quality === NetworkQuality.GOOD)
    );
  }

  isAudioCallViable(): boolean {
    const state = this.currentState;
    return state.isConnected && state.isReachable && state.quality !== NetworkQuality.DISCONNECTED;
  }

  addListener(listener: NetworkChangeListener): () => void {
    this.listeners.add(listener);

    // Immediately call with current state
    listener(this.currentState);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  removeListener(listener: NetworkChangeListener): void {
    this.listeners.delete(listener);
  }

  destroy(): void {
    // Clear quality monitoring interval
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = undefined;
    }

    // Unsubscribe from network state changes
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    // Clear all listeners
    this.listeners.clear();

    // Reset state
    this.disconnectionStartTime = 0;
    this.lastConnectedTime = 0;

    console.log('📡 Network monitoring destroyed');
  }
}

export default NetworkMonitorService.getInstance();
