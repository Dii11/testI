import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'app' | 'screen' | 'component';
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error logging with context
    const errorContext = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level: this.props.level,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
    };

    console.error(`ErrorBoundary (${this.props.level || 'unknown'}) caught error:`, errorContext);

    this.setState({ errorInfo });

    // Report to Sentry with additional context
    try {
      Sentry.withScope(scope => {
        scope.setTag('errorBoundary', this.props.level || 'unknown');
        scope.setLevel('error');
        scope.setContext('errorBoundary', {
          level: this.props.level,
          retryCount: this.state.retryCount,
          componentStack: errorInfo.componentStack,
        });

        // Set user context if available
        scope.setUser({
          id: 'unknown',
          username: 'ErrorBoundary User',
        });

        Sentry.captureException(error);
      });

      console.log('✅ Error reported to Sentry successfully');
    } catch (sentryError) {
      console.warn('❌ Failed to report error to Sentry:', sentryError);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = 'component' } = this.props;
      const isAppLevel = level === 'app';

      return (
        <LinearGradient
          colors={
            isAppLevel
              ? [COLORS.GRADIENT_START, COLORS.GRADIENT_END]
              : ['transparent', 'transparent']
          }
          style={[styles.container, !isAppLevel && styles.componentContainer]}
          testID="error-boundary"
        >
          <View style={styles.content}>
            <Ionicons
              name="warning-outline"
              size={isAppLevel ? 64 : 48}
              color="#FF6B6B"
              style={styles.icon}
            />
            <Text
              style={[styles.title, !isAppLevel && styles.componentTitle]}
              accessibilityRole="header"
            >
              {isAppLevel ? 'Oops! Something went wrong' : 'Component Error'}
            </Text>
            <Text style={[styles.message, !isAppLevel && styles.componentMessage]}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>

            {__DEV__ && this.state.retryCount > 0 && (
              <Text style={styles.retryCount}>Retry attempts: {this.state.retryCount}</Text>
            )}

            <TouchableOpacity
              style={[styles.retryButton, !isAppLevel && styles.componentRetryButton]}
              onPress={this.handleRetry}
              testID="retry-button"
              accessibilityRole="button"
              accessibilityLabel="Retry"
            >
              <LinearGradient
                colors={[COLORS.PRIMARY, COLORS.SECONDARY]}
                style={styles.retryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={COLORS.TEXT_DARK}
                  style={styles.retryIcon}
                />
                <Text style={styles.retryText}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>
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
  componentContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: BORDER_RADIUS.LG,
    margin: SPACING.MD,
    padding: SPACING.LG,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    maxWidth: 400,
  },
  icon: {
    marginBottom: SPACING.MD,
    opacity: 0.9,
  },
  title: {
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
    textAlign: 'center',
  },
  componentTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    color: '#333',
  },
  message: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.LG,
    lineHeight: 24,
  },
  componentMessage: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: '#666',
  },
  retryCount: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.SM,
    fontStyle: 'italic',
  },
  retryButton: {
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
  },
  componentRetryButton: {
    borderRadius: BORDER_RADIUS.MD,
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
});
