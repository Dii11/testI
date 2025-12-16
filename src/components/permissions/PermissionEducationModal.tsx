/**
 * Enhanced Permission Education Modal - Phase 2
 *
 * A sophisticated education system with rich UI components for better user understanding
 * of permission requests with clear benefits, privacy information, and alternatives.
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Image,
} from 'react-native';

import type { PermissionType, PermissionContext } from '../../services/PermissionManagerMigrated';
import { Button } from '../common/Button';
import { Card, CardContent, CardHeader } from '../common/Card';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface EducationContent {
  title: string;
  subtitle?: string;
  description: string;
  benefits: {
    icon: string;
    title: string;
    description: string;
  }[];
  privacyInfo: {
    title: string;
    description: string;
    dataUsage: string[];
  };
  visualization?: {
    type: 'illustration' | 'animation';
    source: string | number;
  };
  alternatives?: {
    title: string;
    description: string;
    limitations: string[];
  };
  urgency?: 'low' | 'medium' | 'high';
  context?: 'healthcare' | 'communication' | 'safety' | 'convenience';
}

export interface PermissionEducationModalProps {
  visible: boolean;
  permission: PermissionType;
  context: PermissionContext;
  educationContent: EducationContent;
  onComplete: (proceed: boolean, rememberChoice?: boolean) => void;
  onDismiss?: () => void;
  showRememberChoice?: boolean;
  animationType?: 'slide' | 'fade' | 'scale';
}

export const PermissionEducationModal: React.FC<PermissionEducationModalProps> = ({
  visible,
  permission,
  context,
  educationContent,
  onComplete,
  onDismiss,
  showRememberChoice = false,
  animationType = 'slide',
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  const steps = [
    'introduction',
    'benefits',
    'privacy',
    ...(educationContent.alternatives ? ['alternatives'] : []),
    'decision',
  ];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getPermissionIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (permission) {
      case 'camera':
        return 'camera';
      case 'microphone':
        return 'mic';
      case 'camera+microphone':
        return 'videocam';
      case 'location':
        return 'location';
      case 'notifications':
        return 'notifications';
      case 'health':
        return 'fitness';
      case 'photos':
        return 'images';
      default:
        return 'shield-checkmark';
    }
  };

  const getContextColor = (): string => {
    switch (educationContent.context) {
      case 'healthcare':
        return '#28a745';
      case 'communication':
        return '#007bff';
      case 'safety':
        return '#dc3545';
      case 'convenience':
        return '#6f42c1';
      default:
        return '#0066cc';
    }
  };

  const getUrgencyColor = (): string => {
    switch (educationContent.urgency) {
      case 'high':
        return '#dc3545';
      case 'medium':
        return '#ffc107';
      case 'low':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = (proceed: boolean) => {
    onComplete(proceed, showRememberChoice ? rememberChoice : undefined);
  };

  const renderIntroduction = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.iconContainer, { backgroundColor: getContextColor() + '20' }]}>
        <Ionicons name={getPermissionIcon()} size={48} color={getContextColor()} />
      </View>

      <Text style={styles.stepTitle}>{educationContent.title}</Text>
      {educationContent.subtitle && (
        <Text style={styles.stepSubtitle}>{educationContent.subtitle}</Text>
      )}

      <Card variant="outlined" style={styles.contextCard}>
        <CardContent>
          <View style={styles.contextInfo}>
            <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() }]}>
              <Text style={styles.urgencyText}>
                {educationContent.urgency?.toUpperCase() || 'OPTIONAL'}
              </Text>
            </View>
            <Text style={styles.contextText}>
              {context.feature} • {educationContent.context || 'General'}
            </Text>
          </View>
          <Text style={styles.description}>{educationContent.description}</Text>
        </CardContent>
      </Card>

      {educationContent.visualization && (
        <View style={styles.visualizationContainer}>
          {educationContent.visualization.type === 'illustration' && (
            <Image
              source={
                typeof educationContent.visualization.source === 'string'
                  ? { uri: educationContent.visualization.source }
                  : educationContent.visualization.source
              }
              style={styles.illustration}
              resizeMode="contain"
            />
          )}
        </View>
      )}
    </View>
  );

  const renderBenefits = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Why We Need This Permission</Text>
      <Text style={styles.stepDescription}>
        Granting this permission enables the following benefits:
      </Text>

      <ScrollView style={styles.benefitsList} showsVerticalScrollIndicator={false}>
        {educationContent.benefits.map((benefit, index) => (
          <Card key={index} variant="outlined" style={styles.benefitCard}>
            <CardContent>
              <View style={styles.benefitHeader}>
                <View style={styles.benefitIconContainer}>
                  <Ionicons name={benefit.icon as any} size={24} color={getContextColor()} />
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
              </View>
              <Text style={styles.benefitDescription}>{benefit.description}</Text>
            </CardContent>
          </Card>
        ))}
      </ScrollView>
    </View>
  );

  const renderPrivacy = () => (
    <View style={styles.stepContainer}>
      <View style={styles.privacyHeader}>
        <Ionicons name="shield-checkmark" size={32} color="#28a745" />
        <Text style={styles.stepTitle}>{educationContent.privacyInfo.title}</Text>
      </View>

      <Text style={styles.stepDescription}>{educationContent.privacyInfo.description}</Text>

      <Card
        variant="elevated"
        style={StyleSheet.flatten([styles.privacyCard, { borderLeftColor: getContextColor() }])}
      >
        <CardHeader>
          <Text style={styles.privacyCardTitle}>How We Use Your Data</Text>
        </CardHeader>
        <CardContent>
          {educationContent.privacyInfo.dataUsage.map((usage, index) => (
            <View key={index} style={styles.dataUsageItem}>
              <Ionicons name="checkmark-circle" size={16} color="#28a745" />
              <Text style={styles.dataUsageText}>{usage}</Text>
            </View>
          ))}
        </CardContent>
      </Card>

      <View style={styles.complianceInfo}>
        <Ionicons name="medical" size={20} color="#0066cc" />
        <Text style={styles.complianceText}>
          HIPAA Compliant • End-to-End Encrypted • No Data Sharing
        </Text>
      </View>
    </View>
  );

  const renderAlternatives = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Alternative Options</Text>
      <Text style={styles.stepDescription}>
        If you prefer not to grant this permission, here's what you can still do:
      </Text>

      {educationContent.alternatives && (
        <Card variant="outlined" style={styles.alternativesCard}>
          <CardContent>
            <View style={styles.alternativeHeader}>
              <Ionicons name="options" size={24} color="#6c757d" />
              <Text style={styles.alternativeTitle}>{educationContent.alternatives.title}</Text>
            </View>

            <Text style={styles.alternativeDescription}>
              {educationContent.alternatives.description}
            </Text>

            <View style={styles.limitationsSection}>
              <Text style={styles.limitationsTitle}>Limitations:</Text>
              {educationContent.alternatives.limitations.map((limitation, index) => (
                <View key={index} style={styles.limitationItem}>
                  <Ionicons name="remove-circle" size={14} color="#dc3545" />
                  <Text style={styles.limitationText}>{limitation}</Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      )}
    </View>
  );

  const renderDecision = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Your Choice</Text>
      <Text style={styles.stepDescription}>
        Ready to proceed? You can change your mind later in device settings.
      </Text>

      <View style={styles.decisionSummary}>
        <Card variant="elevated" style={styles.summaryCard}>
          <CardContent>
            <Text style={styles.summaryTitle}>Permission Summary</Text>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Type:</Text>
              <Text style={styles.summaryValue}>{permission}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Feature:</Text>
              <Text style={styles.summaryValue}>{context.feature}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Priority:</Text>
              <Text style={[styles.summaryValue, { color: getUrgencyColor() }]}>
                {context.priority.toUpperCase() || 'OPTIONAL'}
              </Text>
            </View>
          </CardContent>
        </Card>
      </View>

      {showRememberChoice && (
        <TouchableOpacity
          style={styles.rememberChoiceContainer}
          onPress={() => setRememberChoice(!rememberChoice)}
        >
          <Ionicons
            name={rememberChoice ? 'checkbox' : 'square-outline'}
            size={24}
            color={getContextColor()}
          />
          <Text style={styles.rememberChoiceText}>Remember my choice for this feature</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStepContent = () => {
    switch (steps[currentStep]) {
      case 'introduction':
        return renderIntroduction();
      case 'benefits':
        return renderBenefits();
      case 'privacy':
        return renderPrivacy();
      case 'alternatives':
        return renderAlternatives();
      case 'decision':
        return renderDecision();
      default:
        return renderIntroduction();
    }
  };

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={() => onDismiss?.()}
    >
      <BlurView intensity={50} style={styles.modalBackdrop}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.progressContainer}>
              {steps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index <= currentStep && styles.progressDotActive,
                    { backgroundColor: index <= currentStep ? getContextColor() : '#e9ecef' },
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={() => onDismiss?.()}>
              <Ionicons name="close" size={24} color="#6c757d" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContentContainer}
          >
            {renderStepContent()}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <View style={styles.navigationButtons}>
              {!isFirstStep && (
                <Button
                  title="Previous"
                  variant="outline"
                  onPress={handlePrevious}
                  style={styles.navButton}
                />
              )}

              {!isLastStep ? (
                <Button
                  title="Next"
                  variant="primary"
                  onPress={handleNext}
                  style={styles.navButton}
                />
              ) : (
                <View style={styles.finalButtons}>
                  <Button
                    title="Deny"
                    variant="outline"
                    onPress={() => handleComplete(false)}
                    style={styles.denyButton}
                  />
                  <Button
                    title="Grant Permission"
                    variant="primary"
                    onPress={() => handleComplete(true)}
                    style={styles.grantButton}
                  />
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: screenWidth * 0.9,
    maxHeight: screenHeight * 0.85,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e9ecef',
  },
  progressDotActive: {
    backgroundColor: '#0066cc',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    padding: 20,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    minWidth: 100,
  },
  finalButtons: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  denyButton: {
    flex: 1,
  },
  grantButton: {
    flex: 2,
  },

  // Step styles
  stepContainer: {
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  contextCard: {
    width: '100%',
    marginBottom: 20,
  },
  contextInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  contextText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  visualizationContainer: {
    width: '100%',
    height: 120,
    marginTop: 20,
  },
  illustration: {
    width: '100%',
    height: '100%',
  },

  // Benefits styles
  benefitsList: {
    width: '100%',
    maxHeight: 300,
  },
  benefitCard: {
    marginBottom: 12,
  },
  benefitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },

  // Privacy styles
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  privacyCard: {
    width: '100%',
    borderLeftWidth: 4,
    marginBottom: 20,
  },
  privacyCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dataUsageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dataUsageText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  complianceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
  },
  complianceText: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '500',
  },

  // Alternatives styles
  alternativesCard: {
    width: '100%',
  },
  alternativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  alternativeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  alternativeDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
    marginBottom: 16,
  },
  limitationsSection: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
  },
  limitationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  limitationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  limitationText: {
    fontSize: 12,
    color: '#856404',
    flex: 1,
  },

  // Decision styles
  decisionSummary: {
    width: '100%',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  rememberChoiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  rememberChoiceText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
});

export default PermissionEducationModal;
