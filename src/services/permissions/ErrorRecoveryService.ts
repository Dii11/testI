/**
 * Comprehensive Error Recovery and Retry Logic Service - Phase 3
 * Advanced error handling and recovery strategies for permission requests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert, Linking } from 'react-native';

import type { PermissionContext, PermissionType } from '../PermissionManagerMigrated';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  exponentialBackoff: boolean;
  jitterMs: number;
  timeoutMs: number;
}

export interface ErrorPattern {
  errorType: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  suggestedAction: 'retry' | 'fallback' | 'escalate' | 'abort';
  retryConfig?: Partial<RetryConfig>;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  applicableErrors: string[];
  steps: RecoveryStep[];
  successRate: number;
  averageRecoveryTime: number;
}

export interface RecoveryStep {
  action: 'wait' | 'retry' | 'reset' | 'fallback' | 'escalate' | 'notify';
  parameters: Record<string, any>;
  timeout: number;
  fallbackOnFailure?: RecoveryStep;
}

export interface ErrorMetrics {
  errorType: string;
  permissionType: PermissionType;
  occurrenceCount: number;
  lastOccurrence: number;
  recoveryAttempts: number;
  successfulRecoveries: number;
  averageRecoveryTime: number;
  deviceInfo: {
    manufacturer: string;
    model: string;
    osVersion: string;
  };
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  attemptsUsed: number;
  totalTime: number;
  finalError?: Error;
  fallbackActivated: boolean;
  userInterventionRequired: boolean;
}

/**
 * Comprehensive error recovery service for permission requests
 * Handles various failure scenarios with intelligent retry and fallback strategies
 */
export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private readonly storageKey = '@HopMed:ErrorRecovery';
  private errorMetrics = new Map<string, ErrorMetrics>();
  private activeRecoveries = new Map<string, Promise<RecoveryResult>>();

  private readonly errorPatterns: ErrorPattern[] = [
    {
      errorType: 'NATIVE_MODULE_NOT_AVAILABLE',
      pattern: /native module.*not.*available|expo.*not.*linked/i,
      severity: 'critical',
      recoverable: false,
      suggestedAction: 'fallback',
    },
    {
      errorType: 'PERMISSION_REQUEST_TIMEOUT',
      pattern: /timeout|request.*timed.*out/i,
      severity: 'medium',
      recoverable: true,
      suggestedAction: 'retry',
      retryConfig: { maxAttempts: 3, baseDelayMs: 2000 },
    },
    {
      errorType: 'SYSTEM_RESOURCES_EXHAUSTED',
      pattern: /resources.*exhausted|memory.*pressure|system.*overloaded/i,
      severity: 'high',
      recoverable: true,
      suggestedAction: 'retry',
      retryConfig: { maxAttempts: 2, baseDelayMs: 5000, exponentialBackoff: true },
    },
    {
      errorType: 'PERMISSION_DENIED_BY_SYSTEM',
      pattern: /permission.*denied.*system|blocked.*system|restricted.*policy/i,
      severity: 'high',
      recoverable: false,
      suggestedAction: 'escalate',
    },
    {
      errorType: 'MANUFACTURER_UI_INTERFERENCE',
      pattern: /miui.*restriction|one.*ui.*conflict|emui.*manager/i,
      severity: 'medium',
      recoverable: true,
      suggestedAction: 'retry',
      retryConfig: { maxAttempts: 2, baseDelayMs: 3000 },
    },
    {
      errorType: 'NETWORK_DEPENDENT_PERMISSION_FAILURE',
      pattern: /network.*required|internet.*connection|server.*unreachable/i,
      severity: 'medium',
      recoverable: true,
      suggestedAction: 'retry',
      retryConfig: { maxAttempts: 3, baseDelayMs: 1000 },
    },
    {
      errorType: 'CONCURRENT_REQUEST_CONFLICT',
      pattern: /concurrent.*request|already.*processing|request.*in.*progress/i,
      severity: 'low',
      recoverable: true,
      suggestedAction: 'retry',
      retryConfig: { maxAttempts: 3, baseDelayMs: 500 },
    },
    {
      errorType: 'DEVICE_STORAGE_FULL',
      pattern: /storage.*full|disk.*space|no.*space.*left/i,
      severity: 'medium',
      recoverable: false,
      suggestedAction: 'fallback',
    },
  ];

  private readonly recoveryStrategies: RecoveryStrategy[] = [
    {
      name: 'exponential-backoff',
      description: 'Retry with exponentially increasing delays',
      applicableErrors: ['PERMISSION_REQUEST_TIMEOUT', 'SYSTEM_RESOURCES_EXHAUSTED'],
      steps: [
        {
          action: 'wait',
          parameters: { baseDelay: 1000, multiplier: 2 },
          timeout: 30000,
        },
        {
          action: 'retry',
          parameters: { resetState: true },
          timeout: 15000,
        },
      ],
      successRate: 0.75,
      averageRecoveryTime: 8000,
    },
    {
      name: 'sequential-retry',
      description: 'Retry requests sequentially to avoid conflicts',
      applicableErrors: ['CONCURRENT_REQUEST_CONFLICT', 'MANUFACTURER_UI_INTERFERENCE'],
      steps: [
        {
          action: 'wait',
          parameters: { delay: 2000 },
          timeout: 5000,
        },
        {
          action: 'retry',
          parameters: { sequential: true },
          timeout: 20000,
        },
      ],
      successRate: 0.85,
      averageRecoveryTime: 5000,
    },
    {
      name: 'system-reset',
      description: 'Reset permission system state and retry',
      applicableErrors: ['SYSTEM_RESOURCES_EXHAUSTED', 'MANUFACTURER_UI_INTERFERENCE'],
      steps: [
        {
          action: 'reset',
          parameters: { clearCache: true, resetQueue: true },
          timeout: 2000,
        },
        {
          action: 'wait',
          parameters: { delay: 3000 },
          timeout: 5000,
        },
        {
          action: 'retry',
          parameters: { freshState: true },
          timeout: 15000,
        },
      ],
      successRate: 0.65,
      averageRecoveryTime: 12000,
    },
    {
      name: 'user-guided-recovery',
      description: 'Guide user through manual recovery steps',
      applicableErrors: ['PERMISSION_DENIED_BY_SYSTEM', 'NATIVE_MODULE_NOT_AVAILABLE'],
      steps: [
        {
          action: 'notify',
          parameters: {
            type: 'user-guidance',
            message: 'Manual intervention required',
          },
          timeout: 60000,
        },
        {
          action: 'escalate',
          parameters: {
            escalationType: 'settings-redirect',
            fallbackAvailable: true,
          },
          timeout: 30000,
        },
      ],
      successRate: 0.4,
      averageRecoveryTime: 45000,
    },
  ];

  private constructor() {}

  public static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  /**
   * Initialize the error recovery service
   */
  public async initialize(): Promise<void> {
    await this.loadErrorMetrics();
  }

  /**
   * Attempt to recover from a permission error
   */
  public async recoverFromError(
    error: Error,
    permissionType: PermissionType,
    context: PermissionContext,
    deviceInfo: { manufacturer: string; model: string; osVersion: string }
  ): Promise<RecoveryResult> {
    const errorKey = `${permissionType}-${error.message}`;

    // Prevent duplicate recovery attempts
    if (this.activeRecoveries.has(errorKey)) {
      return await this.activeRecoveries.get(errorKey)!;
    }

    const recoveryPromise = this.performRecovery(error, permissionType, context, deviceInfo);
    this.activeRecoveries.set(errorKey, recoveryPromise);

    try {
      const result = await recoveryPromise;
      return result;
    } finally {
      this.activeRecoveries.delete(errorKey);
    }
  }

  /**
   * Check if an error is recoverable
   */
  public isRecoverable(error: Error): boolean {
    const pattern = this.identifyErrorPattern(error);
    return pattern ? pattern.recoverable : false;
  }

  /**
   * Get suggested retry configuration for an error
   */
  public getRetryConfig(error: Error): RetryConfig {
    const pattern = this.identifyErrorPattern(error);

    const defaultConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      exponentialBackoff: false,
      jitterMs: 200,
      timeoutMs: 15000,
    };

    if (pattern?.retryConfig) {
      return { ...defaultConfig, ...pattern.retryConfig };
    }

    return defaultConfig;
  }

  /**
   * Get error recovery statistics
   */
  public getRecoveryStatistics(): {
    totalErrors: number;
    recoverableErrors: number;
    recoverySuccessRate: number;
    commonErrors: {
      type: string;
      count: number;
      successRate: number;
    }[];
    deviceSpecificIssues: {
      manufacturer: string;
      model: string;
      errorCount: number;
      topErrors: string[];
    }[];
  } {
    const metrics = Array.from(this.errorMetrics.values());
    const totalErrors = metrics.reduce((sum, m) => sum + m.occurrenceCount, 0);
    const totalRecoveries = metrics.reduce((sum, m) => sum + m.recoveryAttempts, 0);
    const successfulRecoveries = metrics.reduce((sum, m) => sum + m.successfulRecoveries, 0);

    const commonErrors = metrics
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 5)
      .map(m => ({
        type: m.errorType,
        count: m.occurrenceCount,
        successRate: m.recoveryAttempts > 0 ? m.successfulRecoveries / m.recoveryAttempts : 0,
      }));

    // Group by device for device-specific analysis
    const deviceErrorMap = new Map<string, { count: number; errors: Map<string, number> }>();
    metrics.forEach(m => {
      const deviceKey = `${m.deviceInfo.manufacturer}-${m.deviceInfo.model}`;
      if (!deviceErrorMap.has(deviceKey)) {
        deviceErrorMap.set(deviceKey, { count: 0, errors: new Map() });
      }
      const deviceData = deviceErrorMap.get(deviceKey)!;
      deviceData.count += m.occurrenceCount;
      deviceData.errors.set(
        m.errorType,
        (deviceData.errors.get(m.errorType) || 0) + m.occurrenceCount
      );
    });

    const deviceSpecificIssues = Array.from(deviceErrorMap.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([deviceKey, data]) => {
        const [manufacturer, model] = deviceKey.split('-');
        const topErrors = Array.from(data.errors.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([errorType]) => errorType);

        return {
          manufacturer,
          model,
          errorCount: data.count,
          topErrors,
        };
      });

    return {
      totalErrors,
      recoverableErrors: metrics.filter(m => this.isErrorTypeRecoverable(m.errorType)).length,
      recoverySuccessRate: totalRecoveries > 0 ? successfulRecoveries / totalRecoveries : 0,
      commonErrors,
      deviceSpecificIssues,
    };
  }

  /**
   * Perform automated recovery with user guidance
   */
  public async performGuidedRecovery(
    permissionType: PermissionType,
    context: PermissionContext
  ): Promise<{
    success: boolean;
    userAction: string;
    followUpRequired: boolean;
  }> {
    const healthcareContext = this.isHealthcareContext(context);

    // Healthcare-specific recovery guidance
    if (healthcareContext) {
      return await this.performHealthcareGuidedRecovery(permissionType, context);
    }

    // Standard guided recovery
    return await this.performStandardGuidedRecovery(permissionType, context);
  }

  // Private methods

  private async performRecovery(
    error: Error,
    permissionType: PermissionType,
    context: PermissionContext,
    deviceInfo: { manufacturer: string; model: string; osVersion: string }
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    const pattern = this.identifyErrorPattern(error);

    // Record error occurrence
    await this.recordError(error, permissionType, deviceInfo);

    if (!pattern || !pattern.recoverable) {
      return {
        success: false,
        strategy: 'no-recovery',
        attemptsUsed: 0,
        totalTime: Date.now() - startTime,
        finalError: error,
        fallbackActivated: true,
        userInterventionRequired: pattern?.suggestedAction === 'escalate',
      };
    }

    // Find appropriate recovery strategy
    const strategy = this.findRecoveryStrategy(pattern.errorType);
    if (!strategy) {
      return {
        success: false,
        strategy: 'no-strategy-found',
        attemptsUsed: 0,
        totalTime: Date.now() - startTime,
        finalError: error,
        fallbackActivated: true,
        userInterventionRequired: true,
      };
    }

    // Execute recovery strategy
    try {
      const recovered = await this.executeRecoveryStrategy(
        strategy,
        error,
        permissionType,
        context
      );

      if (recovered) {
        await this.recordSuccessfulRecovery(error, permissionType, deviceInfo);
      }

      return {
        success: recovered,
        strategy: strategy.name,
        attemptsUsed: strategy.steps.length,
        totalTime: Date.now() - startTime,
        fallbackActivated: !recovered,
        userInterventionRequired: strategy.name === 'user-guided-recovery',
      };
    } catch (recoveryError) {
      return {
        success: false,
        strategy: strategy.name,
        attemptsUsed: strategy.steps.length,
        totalTime: Date.now() - startTime,
        finalError: recoveryError instanceof Error ? recoveryError : error,
        fallbackActivated: true,
        userInterventionRequired: true,
      };
    }
  }

  private identifyErrorPattern(error: Error): ErrorPattern | null {
    const errorMessage = error.message.toLowerCase();

    return this.errorPatterns.find(pattern => pattern.pattern.test(errorMessage)) || null;
  }

  private findRecoveryStrategy(errorType: string): RecoveryStrategy | null {
    return (
      this.recoveryStrategies.find(strategy => strategy.applicableErrors.includes(errorType)) ||
      null
    );
  }

  private async executeRecoveryStrategy(
    strategy: RecoveryStrategy,
    error: Error,
    permissionType: PermissionType,
    context: PermissionContext
  ): Promise<boolean> {
    for (const step of strategy.steps) {
      const stepResult = await this.executeRecoveryStep(step, error, permissionType, context);

      if (!stepResult && step.fallbackOnFailure) {
        await this.executeRecoveryStep(step.fallbackOnFailure, error, permissionType, context);
      } else if (!stepResult) {
        return false;
      }
    }

    return true;
  }

  private async executeRecoveryStep(
    step: RecoveryStep,
    error: Error,
    permissionType: PermissionType,
    context: PermissionContext
  ): Promise<boolean> {
    try {
      switch (step.action) {
        case 'wait':
          await this.performWait(step.parameters);
          return true;

        case 'retry':
          return await this.performRetry(step.parameters, error, permissionType, context);

        case 'reset':
          await this.performReset(step.parameters);
          return true;

        case 'fallback':
          return await this.performFallback(step.parameters, context);

        case 'escalate':
          return await this.performEscalation(step.parameters, permissionType, context);

        case 'notify':
          await this.performNotification(step.parameters, error, context);
          return true;

        default:
          return false;
      }
    } catch (stepError) {
      console.warn(`Recovery step ${step.action} failed:`, stepError);
      return false;
    }
  }

  private async performWait(parameters: any): Promise<void> {
    const delay = parameters.delay || parameters.baseDelay || 1000;
    const multiplier = parameters.multiplier || 1;
    const jitter = parameters.jitter || 0;

    const actualDelay = delay * multiplier + Math.random() * jitter;

    await new Promise(resolve => setTimeout(resolve, actualDelay));
  }

  private async performRetry(
    parameters: any,
    error: Error,
    permissionType: PermissionType,
    context: PermissionContext
  ): Promise<boolean> {
    // This would typically call back to the PermissionManager
    // For now, we'll simulate a retry attempt
    return Math.random() > 0.3; // 70% success rate simulation
  }

  private async performReset(parameters: any): Promise<void> {
    if (parameters.clearCache) {
      // Clear permission cache
    }

    if (parameters.resetQueue) {
      // Reset request queue
    }

    if (parameters.resetState) {
      // Reset manager state
    }
  }

  private async performFallback(parameters: any, context: PermissionContext): Promise<boolean> {
    return context.fallbackStrategy.mode !== 'disabled';
  }

  private async performEscalation(
    parameters: any,
    permissionType: PermissionType,
    context: PermissionContext
  ): Promise<boolean> {
    if (parameters.escalationType === 'settings-redirect') {
      const title = 'Permission Required';
      const message = `${context.explanation?.title || 'This feature'} requires ${permissionType} permission. Please enable it in Settings.`;

      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
        },
      ]);

      return parameters.fallbackAvailable === true;
    }

    return false;
  }

  private async performNotification(
    parameters: any,
    error: Error,
    context: PermissionContext
  ): Promise<void> {
    if (parameters.type === 'user-guidance') {
      const message = parameters.message || `An error occurred: ${error.message}`;

      Alert.alert('Assistance Required', message, [{ text: 'OK' }]);
    }
  }

  private isHealthcareContext(context: PermissionContext): boolean {
    const healthcareFeatures = [
      'health-data-sync',
      'telemedicine',
      'emergency-services',
      'medical-consultation',
      'health-monitoring',
    ];

    return healthcareFeatures.some(feature => context.feature.includes(feature));
  }

  private async performHealthcareGuidedRecovery(
    permissionType: PermissionType,
    context: PermissionContext
  ): Promise<{ success: boolean; userAction: string; followUpRequired: boolean }> {
    const permissionLabels = {
      camera: 'Camera',
      microphone: 'Microphone',
      location: 'Location',
      health: 'Health Data',
      notifications: 'Notifications',
    };

    const label = permissionLabels[permissionType] || permissionType;

    return new Promise(resolve => {
      Alert.alert(
        'Healthcare Permission Required',
        `${label} access is needed for your medical care. This enables:\n\n• ${context.explanation?.benefits?.join('\n• ') || 'Essential healthcare features'}\n\nYour privacy is protected under HIPAA regulations.`,
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () =>
              resolve({
                success: false,
                userAction: 'declined',
                followUpRequired: true,
              }),
          },
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openSettings();
              resolve({
                success: true,
                userAction: 'settings-opened',
                followUpRequired: true,
              });
            },
          },
        ]
      );
    });
  }

  private async performStandardGuidedRecovery(
    permissionType: PermissionType,
    context: PermissionContext
  ): Promise<{ success: boolean; userAction: string; followUpRequired: boolean }> {
    return new Promise(resolve => {
      Alert.alert(
        'Permission Required',
        context.explanation?.reason || `${permissionType} permission is required for this feature.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () =>
              resolve({
                success: false,
                userAction: 'cancelled',
                followUpRequired: false,
              }),
          },
          {
            text: 'Settings',
            onPress: () => {
              Linking.openSettings();
              resolve({
                success: true,
                userAction: 'settings-opened',
                followUpRequired: true,
              });
            },
          },
        ]
      );
    });
  }

  private async recordError(
    error: Error,
    permissionType: PermissionType,
    deviceInfo: { manufacturer: string; model: string; osVersion: string }
  ): Promise<void> {
    const pattern = this.identifyErrorPattern(error);
    const errorType = pattern?.errorType || 'UNKNOWN_ERROR';
    const key = `${errorType}-${permissionType}`;

    const existing = this.errorMetrics.get(key);
    if (existing) {
      existing.occurrenceCount++;
      existing.lastOccurrence = Date.now();
      existing.recoveryAttempts++;
    } else {
      this.errorMetrics.set(key, {
        errorType,
        permissionType,
        occurrenceCount: 1,
        lastOccurrence: Date.now(),
        recoveryAttempts: 1,
        successfulRecoveries: 0,
        averageRecoveryTime: 0,
        deviceInfo,
      });
    }

    await this.saveErrorMetrics();
  }

  private async recordSuccessfulRecovery(
    error: Error,
    permissionType: PermissionType,
    deviceInfo: { manufacturer: string; model: string; osVersion: string }
  ): Promise<void> {
    const pattern = this.identifyErrorPattern(error);
    const errorType = pattern?.errorType || 'UNKNOWN_ERROR';
    const key = `${errorType}-${permissionType}`;

    const existing = this.errorMetrics.get(key);
    if (existing) {
      existing.successfulRecoveries++;
    }

    await this.saveErrorMetrics();
  }

  private isErrorTypeRecoverable(errorType: string): boolean {
    const pattern = this.errorPatterns.find(p => p.errorType === errorType);
    return pattern ? pattern.recoverable : false;
  }

  private async loadErrorMetrics(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.errorMetrics = new Map(data.errorMetrics || []);
      }
    } catch (error) {
      console.warn('Failed to load error metrics:', error);
    }
  }

  private async saveErrorMetrics(): Promise<void> {
    try {
      const data = {
        errorMetrics: Array.from(this.errorMetrics.entries()),
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save error metrics:', error);
    }
  }
}
