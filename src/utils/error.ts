import { ERROR_MESSAGES } from '../constants';

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  context?: string;
}

/**
 * Custom error classes
 */
export class NetworkError extends Error {
  code: string;
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
    this.code = 'NETWORK_ERROR';
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error {
  code: string;
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.field = field;
  }
}

export class AuthenticationError extends Error {
  code: string;

  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    this.code = 'AUTHENTICATION_ERROR';
  }
}

export class AuthorizationError extends Error {
  code: string;

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = 'AUTHORIZATION_ERROR';
  }
}

export class HealthServiceError extends Error {
  code: string;
  serviceType?: string;

  constructor(message: string, serviceType?: string) {
    super(message);
    this.name = 'HealthServiceError';
    this.code = 'HEALTH_SERVICE_ERROR';
    this.serviceType = serviceType;
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  private static errorLog: AppError[] = [];
  private static maxLogSize = 100;

  /**
   * Handle and log errors
   */
  static handle(error: Error | any, context?: string, userId?: string): AppError {
    const appError: AppError = {
      code: this.getErrorCode(error),
      message: this.getErrorMessage(error),
      details: this.getErrorDetails(error),
      timestamp: new Date(),
      userId,
      context,
    };

    // Log error
    this.logError(appError);

    // Report to crash analytics (if implemented)
    this.reportError(appError);

    return appError;
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: Error | any): string {
    if (error instanceof NetworkError) {
      switch (error.statusCode) {
        case 401:
          return ERROR_MESSAGES.UNAUTHORIZED;
        case 403:
          return ERROR_MESSAGES.FORBIDDEN;
        case 404:
          return ERROR_MESSAGES.NOT_FOUND;
        case 500:
        case 502:
        case 503:
          return ERROR_MESSAGES.SERVER_ERROR;
        default:
          return ERROR_MESSAGES.NETWORK_ERROR;
      }
    }

    if (error instanceof ValidationError) {
      return error.message || ERROR_MESSAGES.VALIDATION_ERROR;
    }

    if (error instanceof AuthenticationError) {
      return ERROR_MESSAGES.UNAUTHORIZED;
    }

    if (error instanceof AuthorizationError) {
      return ERROR_MESSAGES.FORBIDDEN;
    }

    if (error instanceof HealthServiceError) {
      return ERROR_MESSAGES.HEALTH_SERVICE_UNAVAILABLE;
    }

    // Check for specific error messages
    if (error?.message?.includes('Network')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }

    if (error?.message?.includes('watch') || error?.message?.includes('Watch')) {
      return ERROR_MESSAGES.WATCH_CONNECTION_FAILED;
    }

    // Default fallback
    return error?.message || 'An unexpected error occurred';
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error | any): boolean {
    if (error instanceof NetworkError) {
      return [408, 429, 500, 502, 503, 504].includes(error.statusCode || 0);
    }

    if (error?.code === 'NETWORK_REQUEST_FAILED' || error?.code === 'TIMEOUT') {
      return true;
    }

    return false;
  }

  /**
   * Get retry delay in milliseconds
   */
  static getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
    return Math.min(1000 * Math.pow(2, attempt), 16000);
  }

  /**
   * Log error to local storage
   */
  private static logError(error: AppError): void {
    try {
      this.errorLog.unshift(error);

      // Keep only the most recent errors
      if (this.errorLog.length > this.maxLogSize) {
        this.errorLog = this.errorLog.slice(0, this.maxLogSize);
      }

      // Store in async storage for persistence
      this.persistErrorLog();
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Report error to analytics service
   */
  private static reportError(error: AppError): void {
    try {
      // This would integrate with crash reporting services like:
      // - Sentry
      // - Crashlytics
      // - Bugsnag
      console.error('Error reported:', error);

      // Example Sentry integration:
      // if (typeof Sentry !== 'undefined') {
      //   Sentry.captureException(new Error(error.message), {
      //     extra: error.details,
      //     tags: {
      //       code: error.code,
      //       context: error.context,
      //     },
      //     user: error.userId ? { id: error.userId } : undefined,
      //   });
      // }
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }

  /**
   * Get error code
   */
  private static getErrorCode(error: any): string {
    if (error?.code) {
      return error.code;
    }

    if (error?.response?.status) {
      return `HTTP_${error.response.status}`;
    }

    if (error?.name) {
      return error.name.toUpperCase();
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Get error message
   */
  private static getErrorMessage(error: any): string {
    if (error?.message) {
      return error.message;
    }

    if (error?.response?.data?.message) {
      return error.response.data.message;
    }

    if (error?.response?.statusText) {
      return error.response.statusText;
    }

    return 'Unknown error occurred';
  }

  /**
   * Get error details
   */
  private static getErrorDetails(error: any): any {
    const details: any = {};

    if (error?.stack) {
      details.stack = error.stack;
    }

    if (error?.response) {
      details.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
      };
    }

    if (error?.request) {
      details.request = {
        url: error.request.url,
        method: error.request.method,
        headers: error.request.headers,
      };
    }

    return Object.keys(details).length > 0 ? details : undefined;
  }

  /**
   * Persist error log to storage
   */
  private static async persistErrorLog(): Promise<void> {
    try {
      const { AppStorage } = await import('./storage');
      await AppStorage.setObject('error_log', this.errorLog);
    } catch (error) {
      console.error('Failed to persist error log:', error);
    }
  }

  /**
   * Get error log
   */
  static async getErrorLog(): Promise<AppError[]> {
    try {
      const { AppStorage } = await import('./storage');
      const log = await AppStorage.getObject<AppError[]>('error_log');
      return log || [];
    } catch (error) {
      console.error('Failed to get error log:', error);
      return [];
    }
  }

  /**
   * Clear error log
   */
  static async clearErrorLog(): Promise<void> {
    try {
      this.errorLog = [];
      const { AppStorage } = await import('./storage');
      await AppStorage.removeItem('error_log');
    } catch (error) {
      console.error('Failed to clear error log:', error);
    }
  }

  /**
   * Export error log for debugging
   */
  static async exportErrorLog(): Promise<string> {
    try {
      const log = await this.getErrorLog();
      return JSON.stringify(log, null, 2);
    } catch (error) {
      console.error('Failed to export error log:', error);
      return '[]';
    }
  }
}

/**
 * Async wrapper for error handling
 */
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
) => {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      ErrorHandler.handle(error, context);
      return null;
    }
  };
};

/**
 * Retry wrapper with exponential backoff
 */
export const withRetry = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxAttempts: number = 3,
  context?: string
) => {
  return async (...args: T): Promise<R> => {
    let lastError: any;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;

        if (!ErrorHandler.isRetryable(error) || attempt === maxAttempts - 1) {
          throw error;
        }

        const delay = ErrorHandler.getRetryDelay(attempt);
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  };
};
