/**
 * 🎯 UX ENHANCED: Permission Gate Component
 *
 * Advanced permission gate with progressive disclosure, contextual priming,
 * and graceful degradation. Prevents jarring permission dialogs and builds
 * user trust through educational content.
 *
 * UX Enhancements:
 * - Progressive permission priming before system dialogs
 * - Contextual medical necessity explanations
 * - Graceful fallback UX with clear alternatives
 * - Platform-specific permission handling
 * - Smart retry mechanisms with recovery flows
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';

import type { UsePermissionOptions } from '../../hooks/usePermission';
import { usePermission } from '../../hooks/usePermission';
import type { PermissionType, PermissionContext } from '../../services/PermissionManagerMigrated';
import {
  requestTeleconsultationVideoPermissions,
  requestTeleconsultationAudioPermissions,
} from '../../utils/teleconsultationPermissions';

import { PermissionPrimingModal, PermissionPrimingConfig } from './PermissionPrimingModal';

export interface PermissionGateProps {
  // Required permission type
  permission: PermissionType;

  // Content to show when permission is granted
  children: ReactNode;

  // Fallback content when permission is denied but fallback available
  fallbackContent?: ReactNode;

  // Permission context for better UX
  context?: Partial<PermissionContext>;

  // Permission hook options
  permissionOptions?: UsePermissionOptions;

  // UI customization
  showEducationalContent?: boolean;
  showFallbackOption?: boolean;
  showRetryButton?: boolean;

  // Custom styling
  style?: any;

  // Events
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  onFallbackUsed?: () => void;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  children,
  fallbackContent,
  context,
  permissionOptions,
  showEducationalContent = true,
  showFallbackOption = true,
  showRetryButton = true,
  style,
  onPermissionGranted,
  onPermissionDenied,
  onFallbackUsed,
}) => {
  const {
    result,
    isChecking,
    isRequesting,
    error,
    isGranted,
    isDenied,
    isBlocked,
    canRequest,
    hasFallback,
    check,
    requestWithEducation,
    reset,
  } = usePermission(permission, permissionOptions);

  const [showEducation, setShowEducation] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  // Effect for permission state changes
  useEffect(() => {
    if (isGranted) {
      onPermissionGranted?.();
    } else if (isDenied) {
      onPermissionDenied?.();
    }
  }, [isGranted, isDenied, onPermissionGranted, onPermissionDenied]);

  // Effect for fallback usage
  useEffect(() => {
    if (useFallback) {
      onFallbackUsed?.();
    }
  }, [useFallback, onFallbackUsed]);

  const handleRequestPermission = async () => {
    try {
      const requestContext: PermissionContext = {
        feature: `${permission}-access`,
        priority: 'important',
        userInitiated: true,
        fallbackStrategy: {
          mode: 'alternative',
          description: 'Limited functionality available without permission',
          limitations: ['Reduced features'],
          alternativeApproach: 'manual-entry',
        },
        ...context,
      };

      await requestWithEducation(requestContext, showEducationalContent);
    } catch (err) {
      console.error('Failed to request permission:', err);
    }
  };

  const handleEducationComplete = async (proceed: boolean) => {
    setShowEducation(false);

    if (proceed) {
      try {
        const requestContext: PermissionContext = {
          feature: `${permission}-access`,
          priority: 'important',
          userInitiated: true,
          fallbackStrategy: {
            mode: 'alternative',
            description: 'Limited functionality available without permission',
            limitations: ['Reduced features'],
            alternativeApproach: 'manual-entry',
          },
          ...context,
        };
        await requestWithEducation(requestContext, false);
      } catch (err) {
        console.error('Failed to request permission after education:', err);
      }
    }
  };

  const handleUseFallback = () => {
    setUseFallback(true);
  };

  const handleRetry = async () => {
    reset();
    await check();
  };

  // Show loading state
  if (isChecking && !result) {
    return (
      <View style={[styles.container, styles.centerContent, style]}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.statusText}>Checking permissions...</Text>
      </View>
    );
  }

  // Show error state
  if (error && !result) {
    return (
      <View style={[styles.container, styles.centerContent, style]}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color="#ff6b35" />
          <Text style={styles.errorTitle}>Permission Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          {showRetryButton && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Show permission granted content
  if (isGranted || useFallback) {
    return (
      <View style={[styles.container, style]}>
        {useFallback && fallbackContent ? fallbackContent : children}
      </View>
    );
  }

  // Show permission request UI
  return (
    <View style={[styles.container, style]}>
      {/* Permission Request Content */}
      <View style={styles.permissionContent}>
        <PermissionRequestCard
          permission={permission}
          result={result}
          context={{
            feature: `${permission}-access`,
            priority: 'important',
            fallbackStrategy: {
              mode: 'limited',
              description: 'Partial functionality available',
              limitations: ['Reduced features'],
            },
            userInitiated: true,
            ...context,
          }}
          isRequesting={isRequesting}
          canRequest={canRequest}
          isBlocked={isBlocked}
          hasFallback={hasFallback}
          showFallbackOption={showFallbackOption}
          onRequestPermission={handleRequestPermission}
          onUseFallback={handleUseFallback}
          onRetry={handleRetry}
        />
      </View>

      {/* Educational Modal - Temporarily disabled for Phase 4 - will be re-enabled with proper content generation */}
      {/* 
      {showEducation && (
        <EducationalModal
          visible={showEducation}
          permission={permission}
          context={{
            feature: `${permission}-access`,
            priority: 'important',
            fallbackStrategy: {
              mode: 'limited',
              description: 'Partial functionality available',
              limitations: ['Reduced features']
            },
            userInitiated: true,
            ...context,
          }}
          onComplete={handleEducationComplete}
        />
      )}
      */}
    </View>
  );
};

interface PermissionRequestCardProps {
  permission: PermissionType;
  result: any;
  context?: PermissionContext;
  isRequesting: boolean;
  canRequest: boolean;
  isBlocked: boolean;
  hasFallback: boolean;
  showFallbackOption: boolean;
  onRequestPermission: () => void;
  onUseFallback: () => void;
  onRetry: () => void;
}

const PermissionRequestCard: React.FC<PermissionRequestCardProps> = ({
  permission,
  result,
  context,
  isRequesting,
  canRequest,
  isBlocked,
  hasFallback,
  showFallbackOption,
  onRequestPermission,
  onUseFallback,
  onRetry,
}) => {
  const getPermissionIcon = (type: PermissionType): string => {
    switch (type) {
      case 'camera':
        return 'camera-outline';
      case 'microphone':
        return 'mic-outline';
      case 'camera+microphone':
        return 'videocam-outline';
      case 'teleconsultation-video':
        return 'videocam-outline';
      case 'teleconsultation-audio':
        return 'call-outline';
      case 'emergency-call':
        return 'medical-outline';
      case 'health-monitoring':
        return 'fitness-outline';
      case 'health-sharing':
        return 'document-text-outline';
      case 'location':
        return 'location-outline';
      case 'notifications':
        return 'notifications-outline';
      case 'health':
        return 'fitness-outline';
      default:
        return 'shield-checkmark-outline';
    }
  };

  const getPermissionTitle = (type: PermissionType): string => {
    switch (type) {
      case 'camera':
        return 'Camera Access';
      case 'microphone':
        return 'Microphone Access';
      case 'camera+microphone':
        return 'Camera & Microphone Access';
      case 'teleconsultation-video':
        return 'Video Consultation Access';
      case 'teleconsultation-audio':
        return 'Audio Consultation Access';
      case 'emergency-call':
        return 'Emergency Call Access';
      case 'health-monitoring':
        return 'Health Monitoring Access';
      case 'health-sharing':
        return 'Health Data Sharing Access';
      case 'location':
        return 'Location Access';
      case 'notifications':
        return 'Notification Access';
      case 'health':
        return 'Health Data Access';
      default:
        return 'Permission Required';
    }
  };

  const getPermissionDescription = (type: PermissionType): string => {
    if (context?.educationalContent?.description) {
      return context.educationalContent.description;
    }

    switch (type) {
      case 'camera':
        return 'Camera access is needed for video calls and taking photos.';
      case 'microphone':
        return 'Microphone access is needed for voice calls and audio messages.';
      case 'camera+microphone':
        return 'Camera and microphone access are needed for video calls.';
      case 'teleconsultation-video':
        return 'Video consultation requires camera and microphone access to connect with your healthcare provider for high-quality medical care.';
      case 'teleconsultation-audio':
        return 'Audio consultation requires microphone access to communicate with your healthcare provider during voice calls.';
      case 'emergency-call':
        return 'Emergency calls need camera, microphone, and location access to provide immediate medical assistance and share critical information.';
      case 'health-monitoring':
        return 'Health monitoring access allows the app to track your health data and provide personalized medical insights.';
      case 'health-sharing':
        return 'Health data sharing enables secure sharing of your medical information with healthcare providers for better treatment.';
      case 'location':
        return 'Location access helps us provide location-based services.';
      case 'notifications':
        return 'Notifications keep you updated with important information.';
      case 'health':
        return 'Health data access enables personalized health insights.';
      default:
        return 'This permission is required for the feature to work properly.';
    }
  };

  return (
    <View style={styles.permissionCard}>
      {/* Header */}
      <View style={styles.permissionHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={getPermissionIcon(permission) as any} size={32} color="#0066cc" />
        </View>
        <Text style={styles.permissionTitle}>{getPermissionTitle(permission)}</Text>
      </View>

      {/* Description */}
      <Text style={styles.permissionDescription}>{getPermissionDescription(permission)}</Text>

      {/* Benefits */}
      {context?.educationalContent?.benefits && (
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Benefits:</Text>
          {context.educationalContent.benefits.map((benefit: string, index: number) => (
            <View key={index} style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#28a745" />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Status Message */}
      {result && (
        <View style={styles.statusContainer}>
          <Ionicons
            name={isBlocked ? 'close-circle' : 'information-circle'}
            size={16}
            color={isBlocked ? '#dc3545' : '#ffc107'}
          />
          <Text style={[styles.statusMessage, isBlocked && styles.blockedMessage]}>
            {result.message || 'Permission status unknown'}
          </Text>
        </View>
      )}

      {/* Degraded Mode Info */}
      {result?.degradedMode && (
        <View style={styles.degradedModeContainer}>
          <Ionicons name="information-circle" size={16} color="#ffc107" />
          <View style={styles.degradedModeInfo}>
            <Text style={styles.degradedModeTitle}>{result.degradedMode.description}</Text>
            <Text style={styles.degradedModeLimitations}>
              Limitations: {result.degradedMode.limitations.join(', ')}
            </Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {canRequest && !isBlocked && (
          <TouchableOpacity
            style={[styles.primaryButton, isRequesting && styles.disabledButton]}
            onPress={onRequestPermission}
            disabled={isRequesting}
          >
            <LinearGradient colors={['#0066cc', '#004499']} style={styles.buttonGradient}>
              {isRequesting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="checkmark" size={20} color="#fff" />
              )}
              <Text style={styles.primaryButtonText}>
                {isRequesting ? 'Requesting...' : 'Grant Permission'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {isBlocked && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              Alert.alert(
                'Settings Required',
                'Please open device settings to enable this permission.',
                [{ text: 'OK' }]
              )
            }
          >
            <Ionicons name="settings-outline" size={20} color="#0066cc" />
            <Text style={styles.secondaryButtonText}>Open Settings</Text>
          </TouchableOpacity>
        )}

        {hasFallback && showFallbackOption && (
          <TouchableOpacity style={styles.tertiaryButton} onPress={onUseFallback}>
            <Ionicons name="play-outline" size={20} color="#6c757d" />
            <Text style={styles.tertiaryButtonText}>Continue with Limited Features</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

interface EducationalModalProps {
  visible: boolean;
  permission: PermissionType;
  content: {
    title: string;
    description: string;
    benefits: string[];
  };
  onComplete: (proceed: boolean) => void;
}

const EducationalModal: React.FC<EducationalModalProps> = ({
  visible,
  permission,
  content,
  onComplete,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => onComplete(false)}
    >
      <View style={styles.modalContainer}>
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{content.title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => onComplete(false)}>
              <Ionicons name="close" size={24} color="#6c757d" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <Text style={styles.modalDescription}>{content.description}</Text>

          {/* Benefits */}
          <View style={styles.modalBenefits}>
            <Text style={styles.modalBenefitsTitle}>Why we need this permission:</Text>
            {content.benefits.map((benefit, index) => (
              <View key={index} style={styles.modalBenefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                <Text style={styles.modalBenefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          {/* Privacy Notice */}
          <View style={styles.privacyNotice}>
            <Ionicons name="shield-checkmark" size={20} color="#0066cc" />
            <Text style={styles.privacyText}>
              Your privacy is protected. This permission is only used for the features described
              above.
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => onComplete(false)}>
            <Text style={styles.modalSecondaryButtonText}>Not Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalPrimaryButton} onPress={() => onComplete(true)}>
            <LinearGradient colors={['#0066cc', '#004499']} style={styles.buttonGradient}>
              <Text style={styles.modalPrimaryButtonText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },

  // Error State
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ff6b35',
    marginTop: 12,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Permission Content
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  permissionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },

  // Benefits
  benefitsSection: {
    marginBottom: 20,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 8,
    flex: 1,
  },

  // Status
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusMessage: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  blockedMessage: {
    color: '#721c24',
  },

  // Degraded Mode
  degradedModeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  degradedModeInfo: {
    marginLeft: 8,
    flex: 1,
  },
  degradedModeTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    marginBottom: 4,
  },
  degradedModeLimitations: {
    fontSize: 12,
    color: '#6c757d',
  },

  // Action Buttons
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0066cc',
    backgroundColor: '#fff',
  },
  tertiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#0066cc',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tertiaryButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6c757d',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalBenefits: {
    marginBottom: 24,
  },
  modalBenefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  modalBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalBenefitText: {
    fontSize: 16,
    color: '#6c757d',
    marginLeft: 12,
    flex: 1,
    lineHeight: 22,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  privacyText: {
    fontSize: 14,
    color: '#495057',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  modalSecondaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6c757d',
    alignItems: 'center',
  },
  modalPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalSecondaryButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PermissionGate;
