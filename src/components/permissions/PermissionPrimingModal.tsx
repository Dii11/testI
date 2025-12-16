/**
 * 🎯 UX ENHANCEMENT: Permission Priming Modal
 *
 * Shows educational content BEFORE triggering system permission dialogs.
 * This prevents jarring permission popup surprises and builds user trust.
 *
 * Key UX Principles:
 * - Prime users with context before system dialogs
 * - Build trust through transparency
 * - Reduce permission denial rates
 * - Provide clear medical necessity explanations
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';

export interface PermissionPrimingConfig {
  // Core permission info
  permissionType:
    | 'camera'
    | 'microphone'
    | 'camera+microphone'
    | 'health'
    | 'location'
    | 'teleconsultation-video'
    | 'teleconsultation-audio';

  // Medical context
  consultationType?: 'routine' | 'urgent' | 'emergency' | 'follow-up';
  doctorName?: string;

  // Customization
  title: string;
  subtitle: string;
  medicalNecessity: string;
  benefits: string[];

  // UX options
  showVideo?: boolean; // Show demo video of feature
  allowDismiss?: boolean; // Can user dismiss without granting
  primaryAction: string; // "Enable Video Consultation"
  secondaryAction?: string; // "Use Audio Only"

  // Callbacks
  onGrant: () => Promise<void>;
  onDeny?: () => void;
  onFallback?: () => void;
}

interface PermissionPrimingModalProps {
  visible: boolean;
  config: PermissionPrimingConfig;
  onClose: () => void;
}

export const PermissionPrimingModal: React.FC<PermissionPrimingModalProps> = ({
  visible,
  config,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'priming' | 'granting' | 'success' | 'denied'>(
    'priming'
  );

  // Get platform-specific permission icons and messaging
  const getPermissionInfo = () => {
    const isIOS = Platform.OS === 'ios';

    switch (config.permissionType) {
      case 'teleconsultation-video':
      case 'camera+microphone':
        return {
          icon: 'videocam',
          systemName: isIOS ? 'Camera and Microphone' : 'Camera and Microphone access',
          platformNote: isIOS
            ? 'iOS will ask for camera and microphone access. Both are needed for video consultations.'
            : 'Android will request camera and microphone permissions. Tap "Allow" for both.',
          color: '#4CAF50',
        };

      case 'teleconsultation-audio':
      case 'microphone':
        return {
          icon: 'mic',
          systemName: isIOS ? 'Microphone' : 'Microphone access',
          platformNote: isIOS
            ? 'iOS will ask for microphone access for audio consultations.'
            : 'Android will request microphone permission. Tap "Allow" to enable audio consultations.',
          color: '#2196F3',
        };

      case 'health':
        return {
          icon: 'fitness',
          systemName: isIOS ? 'Health (HealthKit)' : 'Health Connect',
          platformNote: isIOS
            ? 'iOS will open HealthKit to select which health data to share with HopMed.'
            : 'Android will open Health Connect to configure health data permissions.',
          color: '#FF5722',
        };

      case 'location':
        return {
          icon: 'location',
          systemName: 'Location Services',
          platformNote: isIOS
            ? 'iOS will ask for location access. Select "While Using App" for emergency consultations.'
            : 'Android will request location permission. Allow for emergency consultation features.',
          color: '#9C27B0',
        };

      default:
        return {
          icon: 'shield-checkmark',
          systemName: 'App Permissions',
          platformNote: 'Your device will ask for the necessary permissions.',
          color: '#607D8B',
        };
    }
  };

  const permissionInfo = getPermissionInfo();

  const handleGrantPermission = async () => {
    try {
      setIsLoading(true);
      setCurrentStep('granting');

      await config.onGrant();

      // Show success state briefly before closing
      setCurrentStep('success');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Permission grant failed:', error);
      setCurrentStep('denied');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeny = () => {
    config.onDeny?.();
    onClose();
  };

  const handleFallback = () => {
    config.onFallback?.();
    onClose();
  };

  const renderPrimingContent = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header with Medical Context */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: permissionInfo.color }]}>
          <Ionicons name={permissionInfo.icon as any} size={32} color="white" />
        </View>

        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>

        {config.doctorName && (
          <View style={styles.doctorInfo}>
            <Ionicons name="medical" size={16} color="#666" />
            <Text style={styles.doctorText}>Consultation with {config.doctorName}</Text>
          </View>
        )}
      </View>

      {/* Medical Necessity Explanation */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="medical" size={20} color="#FF5722" />
          <Text style={styles.sectionTitle}>Medical Necessity</Text>
        </View>
        <Text style={styles.necessityText}>{config.medicalNecessity}</Text>
      </View>

      {/* Benefits List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          <Text style={styles.sectionTitle}>Benefits</Text>
        </View>
        {config.benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <Ionicons name="checkmark" size={16} color="#4CAF50" />
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      {/* Platform-Specific Instructions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle" size={20} color="#2196F3" />
          <Text style={styles.sectionTitle}>What Happens Next</Text>
        </View>
        <View style={styles.platformNote}>
          <Text style={styles.platformNoteText}>{permissionInfo.platformNote}</Text>
        </View>
      </View>

      {/* Privacy & Security Note */}
      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark" size={16} color="#666" />
        <Text style={styles.privacyText}>
          Your data is encrypted and follows strict medical privacy guidelines (HIPAA compliant).
        </Text>
      </View>
    </ScrollView>
  );

  const renderGrantingContent = () => (
    <View style={styles.loadingContainer}>
      <View style={[styles.iconContainer, { backgroundColor: permissionInfo.color }]}>
        <Ionicons name="hourglass" size={32} color="white" />
      </View>
      <Text style={styles.loadingTitle}>Requesting Permission...</Text>
      <Text style={styles.loadingSubtitle}>
        {Platform.OS === 'ios'
          ? 'Please allow access in the iOS dialog'
          : 'Please tap "Allow" in the Android dialog'}
      </Text>
    </View>
  );

  const renderSuccessContent = () => (
    <View style={styles.successContainer}>
      <View style={[styles.iconContainer, { backgroundColor: '#4CAF50' }]}>
        <Ionicons name="checkmark" size={32} color="white" />
      </View>
      <Text style={styles.successTitle}>Permission Granted!</Text>
      <Text style={styles.successSubtitle}>You're all set for your consultation</Text>
    </View>
  );

  const renderDeniedContent = () => (
    <View style={styles.deniedContainer}>
      <View style={[styles.iconContainer, { backgroundColor: '#FF5722' }]}>
        <Ionicons name="close" size={32} color="white" />
      </View>
      <Text style={styles.deniedTitle}>Permission Required</Text>
      <Text style={styles.deniedSubtitle}>
        {config.permissionType.includes('teleconsultation')
          ? 'Camera and microphone access are required for video consultations.'
          : 'This permission is needed for the requested feature.'}
      </Text>

      <View style={styles.deniedActions}>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            /* Open settings */
          }}
        >
          <Ionicons name="settings" size={16} color="white" />
          <Text style={styles.settingsButtonText}>Open Settings</Text>
        </TouchableOpacity>

        {config.onFallback && (
          <TouchableOpacity style={styles.fallbackButton} onPress={handleFallback}>
            <Text style={styles.fallbackButtonText}>Use Alternative</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderContent = () => {
    switch (currentStep) {
      case 'granting':
        return renderGrantingContent();
      case 'success':
        return renderSuccessContent();
      case 'denied':
        return renderDeniedContent();
      default:
        return renderPrimingContent();
    }
  };

  const renderActions = () => {
    if (currentStep !== 'priming') return null;

    return (
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: permissionInfo.color }]}
          onPress={handleGrantPermission}
          disabled={isLoading}
        >
          {isLoading ? (
            <Text style={styles.primaryButtonText}>Requesting...</Text>
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.primaryButtonText}>{config.primaryAction}</Text>
            </>
          )}
        </TouchableOpacity>

        {config.secondaryAction && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleFallback}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>{config.secondaryAction}</Text>
          </TouchableOpacity>
        )}

        {config.allowDismiss && (
          <TouchableOpacity style={styles.dismissButton} onPress={handleDeny} disabled={isLoading}>
            <Text style={styles.dismissButtonText}>Not Now</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(45, 27, 105, 0.95)', 'rgba(45, 27, 105, 0.98)']}
          style={styles.container}
        >
          <View style={styles.modal}>
            {renderContent()}
            {renderActions()}
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
  },
  content: {
    maxHeight: 400,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  doctorText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 8,
  },
  necessityText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    backgroundColor: '#fff8e1',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingLeft: 8,
  },
  benefitText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  platformNote: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  platformNoteText: {
    fontSize: 14,
    color: '#1565c0',
    lineHeight: 20,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  privacyText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  successContainer: {
    alignItems: 'center',
    padding: 32,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 16,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  deniedContainer: {
    alignItems: 'center',
    padding: 32,
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF5722',
    marginTop: 16,
    marginBottom: 8,
  },
  deniedSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deniedActions: {
    width: '100%',
    gap: 12,
  },
  settingsButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  fallbackButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  fallbackButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  actions: {
    padding: 24,
    paddingTop: 0,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  dismissButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '400',
  },
});

export default PermissionPrimingModal;
