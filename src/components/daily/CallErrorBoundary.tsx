/**
 * ✅ OFFICIAL DAILY.CO ERROR BOUNDARY PATTERN
 *
 * Based on official Daily.co error handling patterns:
 * - Comprehensive error state management
 * - User-friendly error recovery
 * - Proper cleanup on errors
 * - Diagnostic information for debugging
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import React, { Component } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
}

// ✅ OFFICIAL PATTERN: Error boundary following Daily.co examples
export class CallErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      retryCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('CallErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.handleRetry);
      }

      return (
        <CallErrorDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          retryCount={this.state.retryCount}
        />
      );
    }

    return this.props.children;
  }
}

// ✅ OFFICIAL PATTERN: Error display component following Daily.co examples
interface CallErrorDisplayProps {
  error: Error | null;
  errorInfo?: any;
  onRetry: () => void;
  retryCount?: number;
  title?: string;
}

export const CallErrorDisplay: React.FC<CallErrorDisplayProps> = ({
  error,
  errorInfo,
  onRetry,
  retryCount = 0,
  title = 'Call Error',
}) => {
  const isRepeatedError = retryCount > 2;
  const errorMessage = error?.message || 'An unexpected error occurred during the call.';

  // Categorize errors for better user experience
  const getErrorCategory = (error: Error | null) => {
    if (!error) return 'unknown';

    const message = error.message.toLowerCase();

    if (message.includes('permission') || message.includes('denied')) {
      return 'permission';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('sdk') || message.includes('daily')) {
      return 'sdk';
    }
    if (message.includes('room') || message.includes('join')) {
      return 'room';
    }

    return 'unknown';
  };

  const getErrorGuidance = (category: string) => {
    switch (category) {
      case 'permission':
        return {
          title: 'Permission Required',
          description:
            'Camera and microphone access are required for video calls. Please check your device settings and grant the necessary permissions.',
          icon: 'lock-closed',
          actions: [
            'Check device settings',
            'Grant camera/microphone permissions',
            'Restart the app',
          ],
        };
      case 'network':
        return {
          title: 'Connection Issue',
          description:
            'There seems to be a network connectivity issue. Please check your internet connection and try again.',
          icon: 'wifi-off',
          actions: [
            'Check internet connection',
            'Switch to a different network',
            'Move closer to WiFi router',
          ],
        };
      case 'sdk':
        return {
          title: 'Technical Issue',
          description:
            'The video calling system encountered a technical issue. This usually resolves itself after a retry.',
          icon: 'warning',
          actions: ['Retry the call', 'Restart the app', 'Update the app if available'],
        };
      case 'room':
        return {
          title: 'Room Access Issue',
          description:
            'Unable to join the call room. The room may be unavailable or you may lack access permissions.',
          icon: 'people',
          actions: [
            'Check room availability',
            'Verify call invitation',
            'Contact the other participant',
          ],
        };
      default:
        return {
          title: 'Unexpected Error',
          description:
            'An unexpected error occurred. Please try again or contact support if the issue persists.',
          icon: 'alert-circle',
          actions: ['Retry the call', 'Restart the app', 'Contact support if problem persists'],
        };
    }
  };

  const errorCategory = getErrorCategory(error);
  const guidance = getErrorGuidance(errorCategory);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Error Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name={guidance.icon as any} size={48} color="#FF3B30" />
        </View>

        {/* Error Title */}
        <Text style={styles.title}>{guidance.title}</Text>

        {/* Error Description */}
        <Text style={styles.description}>{guidance.description}</Text>

        {/* Retry Warning */}
        {isRepeatedError && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning" size={20} color="#FF9800" />
            <Text style={styles.warningText}>
              Multiple retry attempts detected. If the problem persists, please restart the app or
              check your device settings.
            </Text>
          </View>
        )}

        {/* Action Steps */}
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Try these steps:</Text>
          {guidance.actions.map((action, index) => (
            <View key={index} style={styles.actionItem}>
              <Text style={styles.actionNumber}>{index + 1}.</Text>
              <Text style={styles.actionText}>{action}</Text>
            </View>
          ))}
        </View>

        {/* Technical Details (Development Mode) */}
        {__DEV__ && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Technical Details (Dev Mode)</Text>
            <Text style={styles.debugText}>Error: {errorMessage}</Text>
            <Text style={styles.debugText}>Type: {error?.name || 'Unknown'}</Text>
            <Text style={styles.debugText}>Retry Count: {retryCount}</Text>
            {errorInfo && (
              <Text style={styles.debugText}>
                Stack: {errorInfo.componentStack || 'No stack trace'}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.retryButton]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry call"
        >
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.buttonText}>{isRepeatedError ? 'Try Again' : 'Retry Call'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ✅ OFFICIAL PATTERN: Connection error component for network issues
interface ConnectionErrorProps {
  onRetry: () => void;
  isReconnecting?: boolean;
}

export const ConnectionError: React.FC<ConnectionErrorProps> = ({
  onRetry,
  isReconnecting = false,
}) => {
  return (
    <View style={styles.connectionContainer}>
      <Ionicons name={isReconnecting ? 'reload' : 'wifi-off'} size={32} color="#FF9800" />
      <Text style={styles.connectionTitle}>
        {isReconnecting ? 'Reconnecting...' : 'Connection Lost'}
      </Text>
      <Text style={styles.connectionDescription}>
        {isReconnecting
          ? 'Attempting to reconnect to the call'
          : 'The call connection was lost. Please check your network and try again.'}
      </Text>
      {!isReconnecting && (
        <TouchableOpacity
          style={[styles.button, styles.reconnectButton]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Reconnect to call"
        >
          <Text style={styles.buttonText}>Reconnect</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderColor: 'rgba(255, 152, 0, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  actionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 8,
    minWidth: 20,
  },
  actionText: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
    lineHeight: 20,
  },
  debugContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 10,
    color: '#888',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  buttonContainer: {
    padding: 24,
    paddingTop: 0,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
  },
  reconnectButton: {
    backgroundColor: '#FF9800',
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Connection error specific styles
  connectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  connectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  connectionDescription: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});
