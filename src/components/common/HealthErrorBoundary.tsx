import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants';
import { sentryTracker } from '../../utils/sentryErrorTracker';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class HealthErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Health component error caught:', error, errorInfo);

    // Track error with Sentry
    sentryTracker.trackServiceError(error, {
      service: 'healthErrorBoundary',
      action: 'componentDidCatch',
      additional: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;

      if (Fallback && this.state.error) {
        return <Fallback error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <View style={styles.container}>
          <View style={styles.errorContent}>
            <Ionicons name="warning-outline" size={48} color={COLORS.ERROR} />
            <Text style={styles.errorTitle}>Health Data Unavailable</Text>
            <Text style={styles.errorMessage}>
              There was an issue loading your health data. Please try again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const DefaultHealthErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({
  error,
  retry,
}) => (
  <View style={styles.container}>
    <View style={styles.errorContent}>
      <Ionicons name="fitness-outline" size={48} color={COLORS.ERROR} />
      <Text style={styles.errorTitle}>Health Service Error</Text>
      <Text style={styles.errorMessage}>
        {error.message || 'Unable to load health data at this time.'}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={retry}>
        <Ionicons name="refresh" size={16} color={COLORS.WHITE} style={{ marginRight: 8 }} />
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export { DefaultHealthErrorFallback };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    padding: SPACING.LG,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.MD,
    marginBottom: SPACING.SM,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.XL,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    borderRadius: BORDER_RADIUS.MD,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});
