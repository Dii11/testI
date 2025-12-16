/**
 * Error Event Service
 *
 * Simple event-based service to handle runtime errors without creating circular dependencies
 */

export interface RuntimeError {
  provider: string;
  error: string;
  errorType: 'initialization' | 'runtime' | 'quality';
  canRetry: boolean;
  sessionId?: string;
}

type ErrorHandler = (error: RuntimeError) => void;

class ErrorEventService {
  private static instance: ErrorEventService;
  private errorHandlers: ErrorHandler[] = [];

  private constructor() {}

  public static getInstance(): ErrorEventService {
    if (!ErrorEventService.instance) {
      ErrorEventService.instance = new ErrorEventService();
    }
    return ErrorEventService.instance;
  }

  public addErrorHandler(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  public removeErrorHandler(handler: ErrorHandler): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  public handleRuntimeError(error: RuntimeError): void {
    console.log(`📞 Runtime error from ${error.provider}:`, error.error);

    // Notify all registered handlers
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (e) {
        console.error('Error in error handler:', e);
      }
    });
  }
}

export default ErrorEventService.getInstance();
