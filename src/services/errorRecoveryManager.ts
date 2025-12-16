import { CallProvider } from '../types/callTypes';

export enum ErrorClassification {
  NETWORK_TIMEOUT = 'network_timeout',
  CONNECTION_FAILED = 'connection_failed',
  PERMISSION_DENIED = 'permission_denied',
  DEVICE_ERROR = 'device_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  UNKNOWN = 'unknown',
}

export interface ErrorClassificationResult {
  classification: ErrorClassification;
  fallbackEligible: boolean;
}

export enum RecoveryStrategy {
  PROVIDER_SWITCH = 'provider_switch',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  EMERGENCY_FALLBACK = 'emergency_fallback',
}

export interface RecoveryAttempt {
  sessionId: string;
  strategy: RecoveryStrategy;
  success: boolean;
  duration: number;
  timestamp: number;
  details?: string;
}

class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private recoveryAttempts: RecoveryAttempt[] = [];
  private providerHealth = new Map<CallProvider, boolean>();

  static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  classifyError(
    error: any,
    context?: any
  ): { classification: ErrorClassification; fallbackEligible: boolean } {
    let classification: ErrorClassification;
    let fallbackEligible = true;

    if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
      classification = ErrorClassification.NETWORK_TIMEOUT;
    } else if (error?.message?.includes('permission')) {
      classification = ErrorClassification.PERMISSION_DENIED;
      fallbackEligible = false; // Permission errors usually don't benefit from provider switch
    } else if (error?.message?.includes('connection')) {
      classification = ErrorClassification.CONNECTION_FAILED;
    } else {
      classification = ErrorClassification.UNKNOWN;
    }

    return { classification, fallbackEligible };
  }

  determineRecoveryStrategy(
    session: any,
    classification: ErrorClassification,
    context?: any
  ): RecoveryStrategy {
    switch (classification) {
      case ErrorClassification.NETWORK_TIMEOUT:
        return RecoveryStrategy.EXPONENTIAL_BACKOFF;
      case ErrorClassification.CONNECTION_FAILED:
        return RecoveryStrategy.PROVIDER_SWITCH;
      default:
        return RecoveryStrategy.EXPONENTIAL_BACKOFF;
    }
  }

  getCircuitBreakerState(provider: CallProvider): { state: 'closed' | 'open' | 'half-open' } {
    return { state: 'closed' };
  }

  getProviderHealthReport(): Map<CallProvider, any> {
    return this.providerHealth;
  }

  getHealthiestProvider(excludeProviders: CallProvider[] = []): CallProvider {
    return CallProvider.DAILY; // Default fallback
  }

  shouldAttemptGracefulDegradation(session: any, classification?: ErrorClassification): boolean {
    return classification === ErrorClassification.NETWORK_TIMEOUT;
  }

  updateProviderHealth(provider: CallProvider, healthy: boolean, metrics?: any): void {
    this.providerHealth.set(provider, healthy);
  }

  recordRecoveryAttempt(attempt: RecoveryAttempt): void {
    this.recoveryAttempts.push(attempt);
  }

  calculateRetryDelay(
    strategy: RecoveryStrategy,
    attemptCount: number = 0,
    baseDelay: number = 1000,
    networkQuality?: any
  ): number {
    switch (strategy) {
      case RecoveryStrategy.EXPONENTIAL_BACKOFF:
        return Math.min(baseDelay * Math.pow(2, attemptCount), 30000);
      default:
        return baseDelay;
    }
  }

  getRecoveryRecommendations(provider: CallProvider): string[] {
    return ['Check network connection', 'Verify permissions'];
  }

  getRecoveryStatistics(): any {
    return {
      totalAttempts: this.recoveryAttempts.length,
      successRate:
        this.recoveryAttempts.filter(a => a.success).length /
        Math.max(1, this.recoveryAttempts.length),
      averageDuration:
        this.recoveryAttempts.reduce((sum, a) => sum + a.duration, 0) /
        Math.max(1, this.recoveryAttempts.length),
    };
  }
}

export default ErrorRecoveryManager.getInstance();
