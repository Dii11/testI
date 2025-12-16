import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants';
import { sentryTracker } from '../../utils/sentryErrorTracker';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class HealthDashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Health Dashboard Error Boundary caught an error:', error, errorInfo);

    // Track error with Sentry
    sentryTracker.trackCriticalError(error, {
      component: 'HealthDashboardErrorBoundary',
      screen: 'SimpleStepsDashboard',
      service: 'healthDashboard',
      action: 'componentDidCatch',
      additional: {
        errorInfo,
        componentStack: errorInfo.componentStack,
        errorBoundary: 'HealthDashboardErrorBoundary',
      },
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={64} color={COLORS.ERROR} />

            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorSubtext}>
              The health dashboard encountered an unexpected error. Please try again.
            </Text>

            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Ionicons name="refresh" size={20} color={COLORS.WHITE} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>

            {__DEV__ && this.state.error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Information:</Text>
                <Text style={styles.debugText}>
                  {this.state.error.name}: {this.state.error.message}
                </Text>
                {this.state.error.stack && (
                  <Text style={styles.debugStack}>
                    {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_PRIMARY,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XL,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.LG,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.SM,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: SPACING.LG,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.XL,
    borderRadius: BORDER_RADIUS.MD,
    marginTop: SPACING.XL,
    gap: SPACING.SM,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  debugContainer: {
    marginTop: SPACING.XL,
    padding: SPACING.MD,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: BORDER_RADIUS.SM,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.3)',
    maxWidth: '100%',
  },
  debugTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontWeight: '600',
    color: COLORS.ERROR,
    marginBottom: SPACING.SM,
  },
  debugText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.XS,
  },
  debugStack: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'monospace',
  },
});

export default HealthDashboardErrorBoundary;