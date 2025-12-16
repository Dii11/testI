import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: any[];
  resetKeys?: string[];
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
}

export class AsyncErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: Date.now().toString(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error logging
    console.error('AsyncErrorBoundary caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      errorId: this.state.errorId,
    });

    this.setState({ errorInfo });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Auto-reset after 30 seconds for network errors
    if (this.isNetworkError(error)) {
      // Clear any existing timeout first
      if (this.resetTimeoutId) {
        clearTimeout(this.resetTimeoutId);
      }

      this.resetTimeoutId = setTimeout(() => {
        this.handleRetry();
      }, 30000);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when specified props change
    if (hasError && resetOnPropsChange && prevProps.resetOnPropsChange !== resetOnPropsChange) {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
      });
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private isNetworkError = (error: Error): boolean => {
    const networkErrorMessages = [
      'network request failed',
      'fetch failed',
      'network error',
      'connection failed',
      'timeout',
      'ERR_NETWORK',
      'ERR_INTERNET_DISCONNECTED',
    ];

    return networkErrorMessages.some(msg =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  };

  private isRetryableError = (error: Error): boolean => {
    // Don't retry for syntax errors, reference errors, etc.
    const nonRetryableErrors = ['SyntaxError', 'ReferenceError', 'TypeError'];

    return !nonRetryableErrors.some(errorType => error.constructor.name === errorType);
  };

  handleRetry = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error } = this.state;
      const isNetworkError = error ? this.isNetworkError(error) : false;
      const isRetryable = error ? this.isRetryableError(error) : true;

      return (
        <LinearGradient
          colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_END]}
          style={styles.container}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={isNetworkError ? 'cloud-offline-outline' : 'alert-circle-outline'}
                size={64}
                color={isNetworkError ? '#FF9500' : '#FF6B6B'}
              />
            </View>

            <Text style={styles.title}>
              {isNetworkError ? 'Connection Issue' : 'Something went wrong'}
            </Text>

            <Text style={styles.message}>
              {isNetworkError
                ? 'Please check your internet connection and try again.'
                : error?.message || 'An unexpected error occurred'}
            </Text>

            {__DEV__ && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugTitle}>Debug Info (Dev Only):</Text>
                <Text style={styles.debugText}>Error ID: {this.state.errorId}</Text>
                <Text style={styles.debugText}>
                  Stack: {error?.stack?.split('\n')[0] || 'No stack trace'}
                </Text>
              </View>
            )}

            {isRetryable && (
              <TouchableOpacity
                style={[styles.retryButton, isNetworkError && styles.retryButtonNetwork]}
                onPress={this.handleRetry}
                testID="error-boundary-retry"
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <LinearGradient
                  colors={
                    isNetworkError ? ['#FF9500', '#FF6B00'] : [COLORS.PRIMARY, COLORS.SECONDARY]
                  }
                  style={styles.retryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons
                    name="refresh"
                    size={18}
                    color={COLORS.TEXT_DARK}
                    style={styles.retryIcon}
                  />
                  <Text style={styles.retryText}>
                    {isNetworkError ? 'Retry Connection' : 'Try Again'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {isNetworkError && (
              <Text style={styles.autoRetryText}>Will automatically retry in a moment...</Text>
            )}
          </View>
        </LinearGradient>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.XL,
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: SPACING.LG,
    opacity: 0.9,
  },
  title: {
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.MD,
    textAlign: 'center',
  },
  message: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.XL,
    lineHeight: 24,
  },
  debugInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
    marginBottom: SPACING.LG,
    width: '100%',
  },
  debugTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XS,
  },
  debugText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'monospace',
    marginBottom: SPACING.XS,
  },
  retryButton: {
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    marginBottom: SPACING.MD,
  },
  retryButtonNetwork: {
    // Network-specific styling could go here
  },
  retryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
  },
  retryIcon: {
    marginRight: SPACING.XS,
  },
  retryText: {
    color: COLORS.TEXT_DARK,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
  },
  autoRetryText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
  },
});
