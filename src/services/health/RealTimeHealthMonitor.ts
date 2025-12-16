/**
 * Real-Time Health Monitor Service
 *
 * Provides real-time monitoring of health data with intelligent thresholds,
 * anomaly detection, and automated alerts for telemedicine applications.
 */

import { EventEmitter } from 'events';

import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { HealthMetric, HealthDataType, HealthAlert } from '../../types/health';
import { sentryTracker } from '../../utils/sentryErrorTracker';

import { HealthDataService } from './HealthDataService';
import { wearableHealthManager } from './WearableHealthManager';

interface HealthThreshold {
  type: HealthDataType;
  min?: number;
  max?: number;
  critical_min?: number;
  critical_max?: number;
  enabled: boolean;
  patient_specific?: boolean;
}

interface MonitoringSession {
  id: string;
  patientId: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  thresholds: HealthThreshold[];
  alertCount: number;
  dataPoints: HealthMetric[];
}

interface HealthAnomaly {
  id: string;
  type: HealthDataType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  threshold: number;
  timestamp: Date;
  description: string;
  recommendation: string;
}

interface RealTimeConfig {
  monitoringInterval: number; // milliseconds
  backgroundSyncInterval: number;
  anomalyDetectionEnabled: boolean;
  autoAlertsEnabled: boolean;
  patientNotificationsEnabled: boolean;
  doctorNotificationsEnabled: boolean;
  dataRetentionDays: number;
}

export class RealTimeHealthMonitor extends EventEmitter {
  private static instance: RealTimeHealthMonitor;
  private healthService: HealthDataService;
  private isMonitoring = false;
  private currentSession: MonitoringSession | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private backgroundTask: string | null = null;

  private config: RealTimeConfig = {
    monitoringInterval: 30000, // 30 seconds
    backgroundSyncInterval: 300000, // 5 minutes
    anomalyDetectionEnabled: true,
    autoAlertsEnabled: true,
    patientNotificationsEnabled: true,
    doctorNotificationsEnabled: true,
    dataRetentionDays: 30,
  };

  // Default health thresholds based on medical standards
  private defaultThresholds: HealthThreshold[] = [
    {
      type: 'heart_rate' as HealthDataType,
      min: 60,
      max: 100,
      critical_min: 40,
      critical_max: 120,
      enabled: true,
    },
    {
      type: 'blood_pressure' as HealthDataType,
      min: 90, // systolic
      max: 140,
      critical_min: 80,
      critical_max: 180,
      enabled: true,
    },
    {
      type: 'oxygen_saturation' as HealthDataType,
      min: 95,
      max: 100,
      critical_min: 90,
      critical_max: 100,
      enabled: true,
    },
    {
      type: 'body_temperature' as HealthDataType,
      min: 36.1,
      max: 37.2,
      critical_min: 35.0,
      critical_max: 39.0,
      enabled: true,
    },
    {
      type: 'blood_glucose' as HealthDataType,
      min: 70,
      max: 180,
      critical_min: 50,
      critical_max: 300,
      enabled: true,
    },
  ];

  private constructor() {
    super();
    this.healthService = HealthDataService.getInstance();
    this.setupNotificationHandlers();
    this.loadConfiguration();
  }

  public static getInstance(): RealTimeHealthMonitor {
    if (!RealTimeHealthMonitor.instance) {
      RealTimeHealthMonitor.instance = new RealTimeHealthMonitor();
    }
    return RealTimeHealthMonitor.instance;
  }

  /**
   * Start real-time monitoring for a patient
   */
  public async startMonitoring(
    patientId: string,
    customThresholds?: HealthThreshold[]
  ): Promise<boolean> {
    try {
      console.log(`🔄 Starting real-time health monitoring for patient: ${patientId}`);

      // Stop any existing monitoring session
      if (this.isMonitoring) {
        await this.stopMonitoring();
      }

      // Initialize health service if needed
      const isInitialized = await this.healthService.initialize();
      if (!isInitialized) {
        throw new Error('Failed to initialize health service');
      }

      // Create new monitoring session
      this.currentSession = {
        id: `session_${Date.now()}_${patientId}`,
        patientId,
        startTime: new Date(),
        isActive: true,
        thresholds: customThresholds || this.defaultThresholds,
        alertCount: 0,
        dataPoints: [],
      };

      // Request notification permissions
      await this.requestNotificationPermissions();

      // Start monitoring interval
      this.monitoringInterval = setInterval(() => {
        this.performHealthCheck();
      }, this.config.monitoringInterval);

      // Setup background task for continuous monitoring
      await this.setupBackgroundMonitoring();

      this.isMonitoring = true;

      // Save session to storage
      await this.saveSession();

      // Emit monitoring started event
      this.emit('monitoringStarted', {
        sessionId: this.currentSession.id,
        patientId,
        timestamp: new Date(),
      });

      console.log(`✅ Real-time monitoring started successfully`);
      return true;
    } catch (error) {
      console.error('❌ Failed to start real-time monitoring:', error);
      sentryTracker.trackServiceError(error as Error, {
        service: 'realTimeHealthMonitor',
        action: 'startMonitoring',
        additional: { patientId },
      });
      return false;
    }
  }

  /**
   * Stop real-time monitoring
   */
  public async stopMonitoring(): Promise<void> {
    try {
      console.log('🛑 Stopping real-time health monitoring');

      this.isMonitoring = false;

      // Clear monitoring interval
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      // Stop background task
      if (this.backgroundTask) {
        BackgroundTask.finish(this.backgroundTask);
        this.backgroundTask = null;
      }

      // End current session
      if (this.currentSession) {
        this.currentSession.endTime = new Date();
        this.currentSession.isActive = false;

        // Save final session state
        await this.saveSession();

        // Emit monitoring stopped event
        this.emit('monitoringStopped', {
          sessionId: this.currentSession.id,
          duration: this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime(),
          alertCount: this.currentSession.alertCount,
          dataPointsCollected: this.currentSession.dataPoints.length,
          timestamp: new Date(),
        });

        this.currentSession = null;
      }

      console.log('✅ Real-time monitoring stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping real-time monitoring:', error);
      sentryTracker.trackServiceError(error as Error, {
        service: 'realTimeHealthMonitor',
        action: 'stopMonitoring',
      });
    }
  }

  /**
   * Perform health check and analyze data
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.currentSession || !this.isMonitoring) return;

    try {
      // Get latest health data
      const latestData = await this.getLatestHealthMetrics();

      if (latestData.length === 0) {
        console.log('📊 No new health data available');
        return;
      }

      // Add to session data points
      this.currentSession.dataPoints.push(...latestData);

      // Analyze each metric for anomalies
      for (const metric of latestData) {
        await this.analyzeMetric(metric);
      }

      // Clean up old data points to prevent memory issues
      this.cleanupOldDataPoints();

      // Emit health data update
      this.emit('healthDataUpdate', {
        sessionId: this.currentSession.id,
        metrics: latestData,
        timestamp: new Date(),
      });

      console.log(`📈 Health check completed: ${latestData.length} metrics analyzed`);
    } catch (error) {
      console.error('❌ Error during health check:', error);
      sentryTracker.trackServiceError(error as Error, {
        service: 'realTimeHealthMonitor',
        action: 'performHealthCheck',
        additional: {
          sessionId: this.currentSession.id,
        },
      });
    }
  }

  /**
   * Analyze health metric for anomalies and alerts
   */
  private async analyzeMetric(metric: HealthMetric): Promise<void> {
    if (!this.currentSession) return;

    // Find applicable threshold
    const threshold = this.currentSession.thresholds.find(t => t.type === metric.type && t.enabled);

    if (!threshold) return;

    const anomalies = this.detectAnomalies(metric, threshold);

    for (const anomaly of anomalies) {
      await this.handleAnomaly(anomaly);
    }
  }

  /**
   * Detect anomalies based on thresholds and patterns
   */
  private detectAnomalies(metric: HealthMetric, threshold: HealthThreshold): HealthAnomaly[] {
    const anomalies: HealthAnomaly[] = [];

    // Critical threshold violations
    if (threshold.critical_min && metric.value < threshold.critical_min) {
      anomalies.push({
        id: `anomaly_${Date.now()}_critical_low`,
        type: metric.type,
        severity: 'critical',
        value: metric.value,
        threshold: threshold.critical_min,
        timestamp: metric.timestamp,
        description: `Critical low ${metric.type}: ${metric.value} ${metric.unit}`,
        recommendation: this.getRecommendation(metric.type, 'critical_low', metric.value),
      });
    }

    if (threshold.critical_max && metric.value > threshold.critical_max) {
      anomalies.push({
        id: `anomaly_${Date.now()}_critical_high`,
        type: metric.type,
        severity: 'critical',
        value: metric.value,
        threshold: threshold.critical_max,
        timestamp: metric.timestamp,
        description: `Critical high ${metric.type}: ${metric.value} ${metric.unit}`,
        recommendation: this.getRecommendation(metric.type, 'critical_high', metric.value),
      });
    }

    // Normal threshold violations
    if (
      threshold.min &&
      metric.value < threshold.min &&
      !anomalies.some(a => a.severity === 'critical')
    ) {
      anomalies.push({
        id: `anomaly_${Date.now()}_low`,
        type: metric.type,
        severity: 'medium',
        value: metric.value,
        threshold: threshold.min,
        timestamp: metric.timestamp,
        description: `Low ${metric.type}: ${metric.value} ${metric.unit}`,
        recommendation: this.getRecommendation(metric.type, 'low', metric.value),
      });
    }

    if (
      threshold.max &&
      metric.value > threshold.max &&
      !anomalies.some(a => a.severity === 'critical')
    ) {
      anomalies.push({
        id: `anomaly_${Date.now()}_high`,
        type: metric.type,
        severity: 'medium',
        value: metric.value,
        threshold: threshold.max,
        timestamp: metric.timestamp,
        description: `High ${metric.type}: ${metric.value} ${metric.unit}`,
        recommendation: this.getRecommendation(metric.type, 'high', metric.value),
      });
    }

    // Trend-based anomaly detection
    if (this.config.anomalyDetectionEnabled) {
      const trendAnomaly = this.detectTrendAnomalies(metric);
      if (trendAnomaly) {
        anomalies.push(trendAnomaly);
      }
    }

    return anomalies;
  }

  /**
   * Detect trend-based anomalies using historical data
   */
  private detectTrendAnomalies(metric: HealthMetric): HealthAnomaly | null {
    if (!this.currentSession) return null;

    // Get recent data points for the same metric type
    const recentPoints = this.currentSession.dataPoints
      .filter(p => p.type === metric.type)
      .slice(-10) // Last 10 points
      .map(p => p.value);

    if (recentPoints.length < 5) return null; // Need at least 5 points for trend analysis

    // Calculate statistical measures
    const mean = recentPoints.reduce((sum, val) => sum + val, 0) / recentPoints.length;
    const variance =
      recentPoints.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentPoints.length;
    const stdDev = Math.sqrt(variance);

    // Check if current value is significantly different (2 standard deviations)
    const deviation = Math.abs(metric.value - mean);
    const significantDeviation = 2 * stdDev;

    if (deviation > significantDeviation && stdDev > 0) {
      return {
        id: `anomaly_${Date.now()}_trend`,
        type: metric.type,
        severity: deviation > 3 * stdDev ? 'high' : 'medium',
        value: metric.value,
        threshold: mean,
        timestamp: metric.timestamp,
        description: `Unusual ${metric.type} pattern detected: ${metric.value} ${metric.unit} (${deviation.toFixed(1)} deviation from recent average)`,
        recommendation:
          'Monitor closely for additional readings and consult healthcare provider if pattern continues.',
      };
    }

    return null;
  }

  /**
   * Handle detected anomaly with appropriate actions
   */
  private async handleAnomaly(anomaly: HealthAnomaly): Promise<void> {
    if (!this.currentSession) return;

    console.log(`🚨 Health anomaly detected:`, anomaly);

    try {
      // Increment alert count
      this.currentSession.alertCount++;

      // Create health alert
      const alert: HealthAlert = {
        id: anomaly.id,
        type: anomaly.type,
        severity: anomaly.severity,
        title: `${anomaly.severity.toUpperCase()}: ${this.getMetricDisplayName(anomaly.type)}`,
        message: anomaly.description,
        recommendation: anomaly.recommendation,
        timestamp: anomaly.timestamp,
        patientId: this.currentSession.patientId,
        sessionId: this.currentSession.id,
        acknowledged: false,
        value: anomaly.value,
        unit: this.getMetricUnit(anomaly.type),
      };

      // Send notifications based on severity
      if (this.config.autoAlertsEnabled) {
        await this.sendAlertNotifications(alert);
      }

      // Emit anomaly detected event
      this.emit('anomalyDetected', {
        anomaly,
        alert,
        sessionId: this.currentSession.id,
        patientId: this.currentSession.patientId,
      });

      // Store alert for persistence
      await this.storeAlert(alert);

      // For critical anomalies, consider additional actions
      if (anomaly.severity === 'critical') {
        await this.handleCriticalAnomaly(anomaly, alert);
      }
    } catch (error) {
      console.error('❌ Error handling anomaly:', error);
      sentryTracker.trackServiceError(error as Error, {
        service: 'realTimeHealthMonitor',
        action: 'handleAnomaly',
        additional: {
          anomalyId: anomaly.id,
          severity: anomaly.severity,
          type: anomaly.type,
        },
      });
    }
  }

  /**
   * Handle critical anomalies with urgent notifications
   */
  private async handleCriticalAnomaly(anomaly: HealthAnomaly, alert: HealthAlert): Promise<void> {
    console.log(`🆘 CRITICAL ANOMALY - Initiating emergency protocols`);

    try {
      // Send urgent notification to healthcare providers
      await this.sendUrgentNotification(alert);

      // Log critical event
      sentryTracker.trackServiceError(
        new Error(`Critical health anomaly detected: ${anomaly.description}`),
        {
          service: 'realTimeHealthMonitor',
          action: 'criticalAnomaly',
          additional: {
            patientId: this.currentSession?.patientId,
            anomalyType: anomaly.type,
            value: anomaly.value,
            threshold: anomaly.threshold,
            severity: anomaly.severity,
          },
          level: 'error',
        }
      );

      // Emit critical anomaly event
      this.emit('criticalAnomaly', {
        anomaly,
        alert,
        patientId: this.currentSession?.patientId,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('❌ Error handling critical anomaly:', error);
    }
  }

  /**
   * Get latest health metrics from providers
   */
  private async getLatestHealthMetrics(): Promise<HealthMetric[]> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 5 * 60 * 1000); // Last 5 minutes

      const dataTypes =
        this.currentSession?.thresholds.filter(t => t.enabled).map(t => t.type) || [];

      const allMetrics: HealthMetric[] = [];

      for (const dataType of dataTypes) {
        try {
          const metrics = await wearableHealthManager.readHealthData(dataType, {
            startDate,
            endDate,
            limit: 10,
          });

          // Filter for truly recent data (last 2 minutes)
          const recentMetrics = metrics.filter(
            m => m.timestamp.getTime() > Date.now() - 2 * 60 * 1000
          );

          allMetrics.push(...recentMetrics);
        } catch (error) {
          console.warn(`⚠️ Could not read ${dataType} data:`, error);
        }
      }

      return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('❌ Error getting latest health metrics:', error);
      return [];
    }
  }

  /**
   * Setup background monitoring for continuous data collection
   */
  private async setupBackgroundMonitoring(): Promise<void> {
    if (Platform.OS === 'ios') {
      // iOS background processing
      this.backgroundTask = await BackgroundTask.start({
        name: 'HealthMonitoring',
      });

      // Background sync interval
      setInterval(async () => {
        if (this.isMonitoring && this.currentSession) {
          await this.performHealthCheck();
        }
      }, this.config.backgroundSyncInterval);
    }
  }

  /**
   * Setup notification handlers
   */
  private setupNotificationHandlers(): void {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  /**
   * Request notification permissions
   */
  private async requestNotificationPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Send alert notifications based on severity
   */
  private async sendAlertNotifications(alert: HealthAlert): Promise<void> {
    try {
      const title = alert.title;
      const body = `${alert.message}\n\nRecommendation: ${alert.recommendation}`;

      // Patient notification
      if (this.config.patientNotificationsEnabled) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Health Alert: ${title}`,
            body,
            priority: alert.severity === 'critical' ? 'high' : 'normal',
            sound: alert.severity === 'critical' ? 'default' : undefined,
          },
          trigger: null, // Send immediately
        });
      }

      console.log(`📱 Alert notification sent: ${alert.severity} - ${title}`);
    } catch (error) {
      console.error('❌ Error sending alert notifications:', error);
    }
  }

  /**
   * Send urgent notification for critical anomalies
   */
  private async sendUrgentNotification(alert: HealthAlert): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🆘 URGENT: ${alert.title}`,
          body: `Critical health alert requires immediate attention:\n\n${alert.message}\n\nRecommendation: ${alert.recommendation}`,
          priority: 'max',
          sound: 'default',
          badge: 1,
        },
        trigger: null,
      });

      console.log(`🆘 Urgent notification sent for critical anomaly`);
    } catch (error) {
      console.error('❌ Error sending urgent notification:', error);
    }
  }

  /**
   * Store alert for persistence and history
   */
  private async storeAlert(alert: HealthAlert): Promise<void> {
    try {
      const alertsKey = `health_alerts_${this.currentSession?.patientId}`;
      const existingAlerts = await AsyncStorage.getItem(alertsKey);
      const alerts: HealthAlert[] = existingAlerts ? JSON.parse(existingAlerts) : [];

      alerts.unshift(alert); // Add to beginning

      // Keep only recent alerts (limit to 100)
      const recentAlerts = alerts.slice(0, 100);

      await AsyncStorage.setItem(alertsKey, JSON.stringify(recentAlerts));
    } catch (error) {
      console.error('❌ Error storing alert:', error);
    }
  }

  /**
   * Save current session to storage
   */
  private async saveSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const sessionKey = `health_session_${this.currentSession.patientId}`;
      await AsyncStorage.setItem(sessionKey, JSON.stringify(this.currentSession));
    } catch (error) {
      console.error('❌ Error saving session:', error);
    }
  }

  /**
   * Load configuration from storage
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const configKey = 'health_monitor_config';
      const savedConfig = await AsyncStorage.getItem(configKey);

      if (savedConfig) {
        this.config = { ...this.config, ...JSON.parse(savedConfig) };
      }
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
    }
  }

  /**
   * Update monitoring configuration
   */
  public async updateConfiguration(newConfig: Partial<RealTimeConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...newConfig };

      const configKey = 'health_monitor_config';
      await AsyncStorage.setItem(configKey, JSON.stringify(this.config));

      console.log('✅ Monitoring configuration updated');
    } catch (error) {
      console.error('❌ Error updating configuration:', error);
    }
  }

  /**
   * Clean up old data points to prevent memory issues
   */
  private cleanupOldDataPoints(): void {
    if (!this.currentSession) return;

    const maxDataPoints = 1000;
    if (this.currentSession.dataPoints.length > maxDataPoints) {
      // Keep only the most recent data points
      this.currentSession.dataPoints = this.currentSession.dataPoints
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, maxDataPoints);
    }
  }

  /**
   * Get recommendation based on metric type and condition
   */
  private getRecommendation(type: HealthDataType, condition: string, value: number): string {
    const recommendations: Record<string, Record<string, string>> = {
      heart_rate: {
        critical_low: 'Seek immediate medical attention. This may indicate bradycardia.',
        critical_high: 'Seek immediate medical attention. This may indicate tachycardia.',
        low: 'Consider light physical activity and consult your healthcare provider.',
        high: 'Try relaxation techniques and avoid stimulants. Contact your doctor if persistent.',
      },
      blood_pressure: {
        critical_low: 'Seek immediate medical attention for hypotension.',
        critical_high: 'Seek immediate medical attention for hypertensive crisis.',
        low: 'Stay hydrated and consider increasing salt intake under medical guidance.',
        high: 'Limit sodium intake, exercise regularly, and monitor closely.',
      },
      oxygen_saturation: {
        critical_low: 'Seek immediate medical attention for severe hypoxemia.',
        low: 'Monitor closely and contact healthcare provider. Consider oxygen therapy.',
        high: 'Normal range - continue monitoring.',
      },
      body_temperature: {
        critical_low: 'Seek immediate medical attention for severe hypothermia.',
        critical_high: 'Seek immediate medical attention for high fever.',
        low: 'Stay warm and monitor. Contact healthcare provider if persistent.',
        high: 'Stay hydrated, rest, and monitor. Take fever reducers as advised.',
      },
      blood_glucose: {
        critical_low: 'Seek immediate medical attention for severe hypoglycemia.',
        critical_high: 'Seek immediate medical attention for diabetic emergency.',
        low: 'Consume fast-acting carbohydrates and monitor closely.',
        high: 'Monitor blood glucose, stay hydrated, and follow diabetes management plan.',
      },
    };

    const typeRecommendations = recommendations[type as keyof typeof recommendations];
    return (
      typeRecommendations[condition] || 'Monitor closely and consult your healthcare provider.'
    );
  }

  /**
   * Get display name for metric type
   */
  private getMetricDisplayName(type: HealthDataType): string {
    const displayNames: Record<string, string> = {
      heart_rate: 'Heart Rate',
      blood_pressure: 'Blood Pressure',
      oxygen_saturation: 'Oxygen Saturation',
      body_temperature: 'Body Temperature',
      blood_glucose: 'Blood Glucose',
    };
    return (
      displayNames[type as string] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    );
  }

  /**
   * Get unit for metric type
   */
  private getMetricUnit(type: HealthDataType): string {
    const units: Record<string, string> = {
      heart_rate: 'bpm',
      blood_pressure: 'mmHg',
      oxygen_saturation: '%',
      body_temperature: '°C',
      blood_glucose: 'mg/dL',
    };
    return units[type as string] || '';
  }

  // Public API methods

  /**
   * Check if monitoring is currently active
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoring && this.currentSession?.isActive === true;
  }

  /**
   * Get current monitoring session
   */
  public getCurrentSession(): MonitoringSession | null {
    return this.currentSession;
  }

  /**
   * Get monitoring configuration
   */
  public getConfiguration(): RealTimeConfig {
    return { ...this.config };
  }

  /**
   * Update patient thresholds
   */
  public async updateThresholds(thresholds: HealthThreshold[]): Promise<void> {
    if (this.currentSession) {
      this.currentSession.thresholds = thresholds;
      await this.saveSession();
      console.log('✅ Patient thresholds updated');
    }
  }

  /**
   * Get stored alerts for a patient
   */
  public async getStoredAlerts(patientId: string): Promise<HealthAlert[]> {
    try {
      const alertsKey = `health_alerts_${patientId}`;
      const storedAlerts = await AsyncStorage.getItem(alertsKey);
      return storedAlerts ? JSON.parse(storedAlerts) : [];
    } catch (error) {
      console.error('❌ Error getting stored alerts:', error);
      return [];
    }
  }

  /**
   * Cleanup resources and stop monitoring
   */
  public async cleanup(): Promise<void> {
    await this.stopMonitoring();
    this.removeAllListeners();
    console.log('🧹 Real-time health monitor cleaned up');
  }
}

export default RealTimeHealthMonitor;
