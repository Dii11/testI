/**
 * Enhanced Sentry Error Tracking Utility
 * Provides comprehensive error tracking with context, user info, and structured logging
 */

import * as Sentry from '@sentry/react-native';

export interface ErrorContext {
  screen?: string;
  component?: string;
  service?: string;
  action?: string;
  provider?: 'daily' | 'agora' | 'channel' | 'api';
  callType?: 'audio' | 'video';
  sessionId?: string;
  userId?: string;
  doctorId?: string;
  customerId?: string;
  roomUrl?: string;
  networkState?: string;
  deviceInfo?: any;
  additional?: Record<string, any>;
}

export interface UserContext {
  id: string;
  email?: string;
  role?: 'doctor' | 'customer';
  isVerified?: boolean;
}

export class SentryErrorTracker {
  private static instance: SentryErrorTracker;

  private constructor() {}

  public static getInstance(): SentryErrorTracker {
    if (!SentryErrorTracker.instance) {
      SentryErrorTracker.instance = new SentryErrorTracker();
    }
    return SentryErrorTracker.instance;
  }

  /**
   * Track critical errors that affect core functionality
   */
  trackCriticalError(error: Error | string, context: ErrorContext): void {
    try {
      console.error('🚨 CRITICAL ERROR:', error, context);

      Sentry.withScope(scope => {
        scope.setLevel('error');
        scope.setTag('errorType', 'critical');
        scope.setTag('platform', 'react-native');

        this.setContextTags(scope, context);
        this.setUserContext(scope, context.userId);

        // Set error context
        scope.setContext('error_details', {
          timestamp: new Date().toISOString(),
          ...context,
        });

        if (typeof error === 'string') {
          Sentry.captureMessage(error, 'error');
        } else {
          Sentry.captureException(error);
        }
      });
    } catch (sentryError) {
      console.warn('Failed to track critical error to Sentry:', sentryError);
    }
  }

  /**
   * Track video call related errors
   */
  trackVideoCallError(error: Error | string, context: ErrorContext): void {
    try {
      console.error('📹 VIDEO CALL ERROR:', error, context);

      Sentry.withScope(scope => {
        scope.setLevel('error');
        scope.setTag('errorType', 'video_call');
        scope.setTag('provider', context.provider || 'unknown');
        scope.setTag('callType', context.callType || 'unknown');

        this.setContextTags(scope, context);
        this.setUserContext(scope, context.userId);

        // Video call specific context
        scope.setContext('video_call_details', {
          provider: context.provider,
          callType: context.callType,
          sessionId: context.sessionId,
          roomUrl: context.roomUrl,
          doctorId: context.doctorId,
          customerId: context.customerId,
          networkState: context.networkState,
          timestamp: new Date().toISOString(),
        });

        if (typeof error === 'string') {
          Sentry.captureMessage(`Video Call Error: ${error}`, 'error');
        } else {
          Sentry.captureException(error);
        }
      });
    } catch (sentryError) {
      console.warn('Failed to track video call error to Sentry:', sentryError);
    }
  }

  /**
   * Track API and service errors
   */
  trackServiceError(error: Error | string, context: ErrorContext): void {
    try {
      console.error('🔧 SERVICE ERROR:', error, context);

      Sentry.withScope(scope => {
        scope.setLevel('error');
        scope.setTag('errorType', 'service');
        scope.setTag('service', context.service || 'unknown');
        scope.setTag('action', context.action || 'unknown');

        this.setContextTags(scope, context);
        this.setUserContext(scope, context.userId);

        // Service specific context
        scope.setContext('service_details', {
          service: context.service,
          action: context.action,
          sessionId: context.sessionId,
          timestamp: new Date().toISOString(),
          additional: context.additional,
        });

        if (typeof error === 'string') {
          Sentry.captureMessage(`Service Error [${context.service}]: ${error}`, 'error');
        } else {
          Sentry.captureException(error);
        }
      });
    } catch (sentryError) {
      console.warn('Failed to track service error to Sentry:', sentryError);
    }
  }

  /**
   * Generic error tracking method (backward compatibility)
   * Auto-detects error type and routes to appropriate tracking method
   * Accepts any additional properties and automatically organizes them
   * 
   * @deprecated Use specific methods (trackServiceError, trackCriticalError, etc.) for better categorization
   */
  trackError(error: Error | string, context: ErrorContext & { context?: string; [key: string]: any }): void {
    try {
      // Separate known ErrorContext properties from additional properties
      const {
        screen,
        component,
        service,
        action,
        provider,
        callType,
        sessionId,
        userId,
        doctorId,
        customerId,
        roomUrl,
        networkState,
        deviceInfo,
        additional,
        context: legacyContext,
        ...extraProps
      } = context;

      // Build normalized context
      const normalizedContext: ErrorContext = {
        screen,
        component,
        service: service || legacyContext, // Handle legacy 'context' property
        action,
        provider,
        callType,
        sessionId,
        userId,
        doctorId,
        customerId,
        roomUrl,
        networkState,
        deviceInfo,
        // Merge any extra properties into 'additional'
        additional: {
          ...additional,
          ...extraProps,
        },
      };

      // Auto-route based on context
      if (normalizedContext.callType || normalizedContext.provider || normalizedContext.roomUrl) {
        this.trackVideoCallError(error, normalizedContext);
      } else if (normalizedContext.service) {
        this.trackServiceError(error, normalizedContext);
      } else if (normalizedContext.screen || normalizedContext.component) {
        this.trackScreenError(error, normalizedContext);
      } else {
        // Default to critical error
        this.trackCriticalError(error, normalizedContext);
      }
    } catch (sentryError) {
      console.warn('Failed to track error to Sentry:', sentryError);
    }
  }

  /**
   * Track screen-level errors
   */
  trackScreenError(error: Error | string, context: ErrorContext): void {
    try {
      console.error('📱 SCREEN ERROR:', error, context);

      Sentry.withScope(scope => {
        scope.setLevel('error');
        scope.setTag('errorType', 'screen');
        scope.setTag('screen', context.screen || 'unknown');
        scope.setTag('component', context.component || 'unknown');

        this.setContextTags(scope, context);
        this.setUserContext(scope, context.userId);

        // Screen specific context
        scope.setContext('screen_details', {
          screen: context.screen,
          component: context.component,
          action: context.action,
          timestamp: new Date().toISOString(),
          deviceInfo: context.deviceInfo,
        });

        if (typeof error === 'string') {
          Sentry.captureMessage(`Screen Error [${context.screen}]: ${error}`, 'error');
        } else {
          Sentry.captureException(error);
        }
      });
    } catch (sentryError) {
      console.warn('Failed to track screen error to Sentry:', sentryError);
    }
  }

  /**
   * Track warning-level issues that don't break functionality
   */
  trackWarning(message: string, context: ErrorContext): void {
    try {
      console.warn('⚠️ WARNING:', message, context);

      Sentry.withScope(scope => {
        scope.setLevel('warning');
        scope.setTag('errorType', 'warning');

        this.setContextTags(scope, context);
        this.setUserContext(scope, context.userId);

        scope.setContext('warning_details', {
          timestamp: new Date().toISOString(),
          ...context,
        });

        Sentry.captureMessage(`Warning: ${message}`, 'warning');
      });
    } catch (sentryError) {
      console.warn('Failed to track warning to Sentry:', sentryError);
    }
  }

  /**
   * Track performance issues or slow operations
   */
  trackPerformanceIssue(message: string, duration: number, context: ErrorContext): void {
    try {
      console.warn('🐌 PERFORMANCE ISSUE:', message, `${duration}ms`, context);

      Sentry.withScope(scope => {
        scope.setLevel('warning');
        scope.setTag('errorType', 'performance');
        scope.setTag('duration', duration.toString());

        this.setContextTags(scope, context);
        this.setUserContext(scope, context.userId);

        scope.setContext('performance_details', {
          duration,
          threshold: 'slow',
          timestamp: new Date().toISOString(),
          ...context,
        });

        Sentry.captureMessage(`Performance Issue: ${message} (${duration}ms)`, 'warning');
      });
    } catch (sentryError) {
      console.warn('Failed to track performance issue to Sentry:', sentryError);
    }
  }

  /**
   * Track successful recovery from errors
   */
  trackRecovery(action: string, context: ErrorContext): void {
    try {
      console.log('✅ RECOVERY SUCCESS:', action, context);

      Sentry.withScope(scope => {
        scope.setLevel('info');
        scope.setTag('errorType', 'recovery');
        scope.setTag('action', action);

        this.setContextTags(scope, context);
        this.setUserContext(scope, context.userId);

        scope.setContext('recovery_details', {
          action,
          timestamp: new Date().toISOString(),
          ...context,
        });

        Sentry.captureMessage(`Recovery Success: ${action}`, 'info');
      });
    } catch (sentryError) {
      console.warn('Failed to track recovery to Sentry:', sentryError);
    }
  }

  /**
   * Set context tags on Sentry scope
   */
  private setContextTags(scope: Sentry.Scope, context: ErrorContext): void {
    if (context.screen) scope.setTag('screen', context.screen);
    if (context.component) scope.setTag('component', context.component);
    if (context.service) scope.setTag('service', context.service);
    if (context.action) scope.setTag('action', context.action);
    if (context.provider) scope.setTag('provider', context.provider);
    if (context.callType) scope.setTag('callType', context.callType);
    if (context.sessionId) scope.setTag('sessionId', context.sessionId);
    if (context.networkState) scope.setTag('networkState', context.networkState);
  }

  /**
   * Set user context on Sentry scope
   */
  private setUserContext(scope: Sentry.Scope, userId?: string): void {
    if (userId) {
      scope.setUser({
        id: userId,
      });
    }
  }

  /**
   * Create an error context builder for common patterns
   */
  static createContext(): ErrorContextBuilder {
    return new ErrorContextBuilder();
  }

  addBreadcrumb(opts: {
    category: string;
    message: string;
    data?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  }) {
    try {
      Sentry.addBreadcrumb({
        category: opts.category,
        message: opts.message,
        data: opts.data,
        level: opts.level || 'info',
        timestamp: Date.now() / 1000,
      });
    } catch {}
  }
}

/**
 * Builder class for creating error contexts
 */
class ErrorContextBuilder {
  private context: ErrorContext = {};

  screen(screen: string): ErrorContextBuilder {
    this.context.screen = screen;
    return this;
  }

  component(component: string): ErrorContextBuilder {
    this.context.component = component;
    return this;
  }

  service(service: string): ErrorContextBuilder {
    this.context.service = service;
    return this;
  }

  action(action: string): ErrorContextBuilder {
    this.context.action = action;
    return this;
  }

  provider(provider: 'daily' | 'agora' | 'channel' | 'api'): ErrorContextBuilder {
    this.context.provider = provider;
    return this;
  }

  callType(callType: 'audio' | 'video'): ErrorContextBuilder {
    this.context.callType = callType;
    return this;
  }

  session(sessionId: string): ErrorContextBuilder {
    this.context.sessionId = sessionId;
    return this;
  }

  user(userId: string): ErrorContextBuilder {
    this.context.userId = userId;
    return this;
  }

  participants(doctorId: string, customerId: string): ErrorContextBuilder {
    this.context.doctorId = doctorId;
    this.context.customerId = customerId;
    return this;
  }

  room(roomUrl: string): ErrorContextBuilder {
    this.context.roomUrl = roomUrl;
    return this;
  }

  network(networkState: string): ErrorContextBuilder {
    this.context.networkState = networkState;
    return this;
  }

  additional(data: Record<string, any>): ErrorContextBuilder {
    this.context.additional = { ...this.context.additional, ...data };
    return this;
  }

  build(): ErrorContext {
    return { ...this.context };
  }
}

// Export singleton instance
export const sentryTracker = SentryErrorTracker.getInstance();

// Export utility functions for common usage patterns
export const trackCriticalError = (error: Error | string, context: ErrorContext) =>
  sentryTracker.trackCriticalError(error, context);

export const trackVideoCallError = (error: Error | string, context: ErrorContext) =>
  sentryTracker.trackVideoCallError(error, context);

export const trackServiceError = (error: Error | string, context: ErrorContext) =>
  sentryTracker.trackServiceError(error, context);

export const trackScreenError = (error: Error | string, context: ErrorContext) =>
  sentryTracker.trackScreenError(error, context);

export const trackWarning = (message: string, context: ErrorContext) =>
  sentryTracker.trackWarning(message, context);

export const trackPerformanceIssue = (message: string, duration: number, context: ErrorContext) =>
  sentryTracker.trackPerformanceIssue(message, duration, context);

export const trackRecovery = (action: string, context: ErrorContext) =>
  sentryTracker.trackRecovery(action, context);
