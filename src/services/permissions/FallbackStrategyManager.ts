/**
 * Fallback Strategy Manager - Phase 2
 *
 * Comprehensive fallback handling for denied permissions with healthcare-specific
 * alternatives, progressive degradation, and user-friendly workarounds.
 */

import { Alert, Linking, Platform } from 'react-native';

import { sentryTracker } from '../../utils/sentryErrorTracker';
import type { PermissionType, PermissionContext } from '../PermissionManagerMigrated';
import { PermissionResult } from '../PermissionManagerMigrated';

export type FallbackMode = 'alternative' | 'limited' | 'graceful' | 'progressive' | 'disabled';
export type AlternativeAction =
  | 'photo-picker'
  | 'audio-only'
  | 'text-based'
  | 'web-fallback'
  | 'offline-mode'
  | 'manual-entry';

export interface FallbackStrategy {
  mode: FallbackMode;
  description: string;
  limitations: string[];
  alternativeAction?: AlternativeAction;
  userEducation: {
    title: string;
    explanation: string;
    benefits: string[];
    instructions?: string[];
  };
  technicalImplementation: {
    componentFallback?: string;
    serviceFallback?: string;
    dataFallback?: any;
  };
  retryStrategy?: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    escalationSteps: string[];
  };
}

export interface FallbackResult {
  strategy: FallbackStrategy;
  canProceed: boolean;
  userAccepted: boolean;
  alternativeEnabled: boolean;
  message?: string;
  actionTaken?: string;
  metadata: {
    permissionType: PermissionType;
    originalContext: PermissionContext;
    fallbackMode: FallbackMode;
    timestamp: number;
    userChoices: string[];
  };
}

export class FallbackStrategyManager {
  private static instance: FallbackStrategyManager;

  // Predefined healthcare-specific fallback strategies
  private readonly strategies = new Map<string, FallbackStrategy>();

  static getInstance(): FallbackStrategyManager {
    if (!FallbackStrategyManager.instance) {
      FallbackStrategyManager.instance = new FallbackStrategyManager();
    }
    return FallbackStrategyManager.instance;
  }

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Get appropriate fallback strategy for a permission denial
   */
  async getFallbackStrategy(
    permissionType: PermissionType,
    context: PermissionContext,
    denialReason: 'denied' | 'blocked' | 'restricted'
  ): Promise<FallbackStrategy> {
    const strategyKey = this.buildStrategyKey(permissionType, context.feature, denialReason);

    // Try specific strategy first
    let strategy = this.strategies.get(strategyKey);

    // Fall back to general permission type strategy
    if (!strategy) {
      strategy = this.strategies.get(`${permissionType}-general`);
    }

    // Fall back to default strategy
    if (!strategy) {
      strategy = this.getDefaultStrategy(permissionType, context);
    }

    return this.customizeStrategy(strategy, context, denialReason);
  }

  /**
   * Execute a fallback strategy and handle user interaction
   */
  async executeFallbackStrategy(
    strategy: FallbackStrategy,
    permissionType: PermissionType,
    context: PermissionContext
  ): Promise<FallbackResult> {
    console.log(`🔄 Executing fallback strategy: ${strategy.mode} for ${permissionType}`);

    try {
      // Show user education about the fallback
      const userAccepted = await this.presentFallbackEducation(strategy, context);

      if (!userAccepted) {
        return this.createFallbackResult(strategy, permissionType, context, {
          canProceed: false,
          userAccepted: false,
          alternativeEnabled: false,
          message: 'User declined fallback option',
        });
      }

      // Execute the alternative action
      const alternativeResult = await this.executeAlternativeAction(strategy, context);

      // Track fallback usage
      this.trackFallbackUsage(strategy, permissionType, context, alternativeResult.success);

      return this.createFallbackResult(strategy, permissionType, context, {
        canProceed: alternativeResult.success,
        userAccepted: true,
        alternativeEnabled: alternativeResult.success,
        actionTaken: alternativeResult.actionTaken,
        message: alternativeResult.message,
      });
    } catch (error) {
      console.error('Fallback strategy execution failed:', error);

      sentryTracker.trackCriticalError(
        error instanceof Error ? error : 'Fallback execution failed',
        {
          service: 'FallbackStrategyManager',
          action: 'executeFallbackStrategy',
          additional: {
            permissionType,
            feature: context.feature,
            strategyMode: strategy.mode,
          },
        }
      );

      return this.createFallbackResult(strategy, permissionType, context, {
        canProceed: false,
        userAccepted: true,
        alternativeEnabled: false,
        message: 'Fallback execution failed',
      });
    }
  }

  /**
   * Handle progressive permission requests with escalating fallbacks
   */
  async handleProgressiveFallback(
    permissionType: PermissionType,
    context: PermissionContext,
    previousAttempts: number = 0
  ): Promise<FallbackResult> {
    const progressiveStrategies = this.getProgressiveStrategies(permissionType, context);

    if (previousAttempts >= progressiveStrategies.length) {
      // All strategies exhausted, use final fallback
      const finalStrategy = this.getFinalFallbackStrategy(permissionType, context);
      return this.executeFallbackStrategy(finalStrategy, permissionType, context);
    }

    const currentStrategy = progressiveStrategies[previousAttempts];
    return this.executeFallbackStrategy(currentStrategy, permissionType, context);
  }

  /**
   * Check if permission can be retried based on fallback strategy
   */
  canRetryPermission(strategy: FallbackStrategy, previousAttempts: number): boolean {
    if (!strategy.retryStrategy?.enabled) return false;
    return previousAttempts < strategy.retryStrategy.maxRetries;
  }

  /**
   * Get retry delay for permission request
   */
  getRetryDelay(strategy: FallbackStrategy, attemptNumber: number): number {
    if (!strategy.retryStrategy) return 0;

    // Exponential backoff
    return strategy.retryStrategy.retryDelay * Math.pow(2, attemptNumber - 1);
  }

  // Private implementation methods

  private initializeStrategies(): void {
    // Camera permission strategies
    this.strategies.set('camera-doctor-consultation-denied', {
      mode: 'alternative',
      description: 'Use photo from gallery instead of taking new photo',
      limitations: ['Cannot take real-time photos', 'Limited to existing photos'],
      alternativeAction: 'photo-picker',
      userEducation: {
        title: 'Alternative: Photo Gallery',
        explanation:
          'You can still share photos with your doctor by selecting from your photo gallery.',
        benefits: [
          'Access to existing photos',
          'Full consultation capability maintained',
          'Privacy control over shared content',
        ],
        instructions: [
          'Select "Choose from Gallery" when prompted',
          'Pick the photo you want to share',
          'Confirm before sending to doctor',
        ],
      },
      technicalImplementation: {
        componentFallback: 'PhotoPickerComponent',
        serviceFallback: 'imagePickerService',
      },
      retryStrategy: {
        enabled: true,
        maxRetries: 2,
        retryDelay: 30000,
        escalationSteps: ['Show education', 'Offer settings guidance', 'Use alternative'],
      },
    });

    this.strategies.set('camera+microphone-video-call-denied', {
      mode: 'graceful',
      description: 'Switch to audio-only consultation',
      limitations: ['No video sharing', 'Voice-only communication'],
      alternativeAction: 'audio-only',
      userEducation: {
        title: 'Audio-Only Consultation',
        explanation:
          'Your consultation will continue with audio only. Your doctor can still provide excellent care through voice communication.',
        benefits: [
          'Full voice communication maintained',
          'Secure HIPAA-compliant consultation',
          'All medical discussion capabilities preserved',
        ],
        instructions: [
          'Consultation will start with audio only',
          'Speak clearly for best communication',
          'Ask questions normally - your doctor can hear you clearly',
        ],
      },
      technicalImplementation: {
        componentFallback: 'AudioOnlyCallComponent',
        serviceFallback: 'audioCallService',
      },
    });

    this.strategies.set('microphone-voice-notes-blocked', {
      mode: 'alternative',
      description: 'Use text-based notes and messaging',
      limitations: ['No voice recording', 'Text input only'],
      alternativeAction: 'text-based',
      userEducation: {
        title: 'Text-Based Communication',
        explanation:
          'Share your thoughts and questions using text messages. This ensures your communication is still captured and reviewed.',
        benefits: [
          'Written record of communication',
          'Time to thoughtfully compose messages',
          'Easy to reference later',
        ],
      },
      technicalImplementation: {
        componentFallback: 'TextMessageComponent',
        serviceFallback: 'textMessageService',
      },
    });

    this.strategies.set('location-emergency-services-denied', {
      mode: 'limited',
      description: 'Manual location entry for emergency services',
      limitations: ['No automatic location', 'Manual address required'],
      alternativeAction: 'manual-entry',
      userEducation: {
        title: 'Manual Location Entry',
        explanation:
          'For emergency services, please manually enter your current address. This ensures help can reach you.',
        benefits: [
          'Emergency services can still locate you',
          'Control over shared location information',
          'Backup method always available',
        ],
        instructions: [
          'Enter your complete street address',
          'Include apartment/unit numbers if applicable',
          'Verify address accuracy before submitting',
        ],
      },
      technicalImplementation: {
        componentFallback: 'ManualLocationComponent',
        serviceFallback: 'manualLocationService',
      },
    });

    this.strategies.set('notifications-medication-reminders-blocked', {
      mode: 'alternative',
      description: 'Use calendar events and email reminders',
      limitations: ['No push notifications', 'Requires active checking'],
      alternativeAction: 'web-fallback',
      userEducation: {
        title: 'Calendar & Email Reminders',
        explanation: 'Medication reminders will be sent to your email and added to your calendar.',
        benefits: [
          'Integrated with your existing calendar',
          'Email backup for important reminders',
          'Works across all your devices',
        ],
      },
      technicalImplementation: {
        componentFallback: 'CalendarReminderComponent',
        serviceFallback: 'emailReminderService',
      },
    });

    this.strategies.set('health-fitness-tracking-restricted', {
      mode: 'progressive',
      description: 'Manual health data entry with guided prompts',
      limitations: ['No automatic tracking', 'Manual data entry required'],
      alternativeAction: 'manual-entry',
      userEducation: {
        title: 'Manual Health Tracking',
        explanation:
          'Track your health data manually with our guided entry system. Regular logging helps your healthcare team monitor your progress.',
        benefits: [
          'Full control over your data',
          'Detailed tracking capability',
          'Healthcare team can still monitor progress',
        ],
      },
      technicalImplementation: {
        componentFallback: 'ManualHealthEntryComponent',
        serviceFallback: 'manualHealthService',
      },
    });

    // General fallback strategies
    this.strategies.set('camera-general', this.createGeneralCameraStrategy());
    this.strategies.set('microphone-general', this.createGeneralMicrophoneStrategy());
    this.strategies.set('location-general', this.createGeneralLocationStrategy());
    this.strategies.set('notifications-general', this.createGeneralNotificationStrategy());
  }

  private createGeneralCameraStrategy(): FallbackStrategy {
    return {
      mode: 'alternative',
      description: 'Use photo gallery or web-based camera',
      limitations: ['No real-time camera access'],
      alternativeAction: 'photo-picker',
      userEducation: {
        title: 'Camera Alternative',
        explanation: 'Access your photo gallery to share existing images.',
        benefits: ['Access to existing photos', 'Privacy control'],
      },
      technicalImplementation: {
        componentFallback: 'PhotoPickerComponent',
      },
    };
  }

  private createGeneralMicrophoneStrategy(): FallbackStrategy {
    return {
      mode: 'alternative',
      description: 'Use text-based communication',
      limitations: ['No voice recording'],
      alternativeAction: 'text-based',
      userEducation: {
        title: 'Text Communication',
        explanation: 'Use text messages for communication.',
        benefits: ['Written record', 'Time to compose thoughts'],
      },
      technicalImplementation: {
        componentFallback: 'TextInputComponent',
      },
    };
  }

  private createGeneralLocationStrategy(): FallbackStrategy {
    return {
      mode: 'limited',
      description: 'Manual location entry',
      limitations: ['No automatic location'],
      alternativeAction: 'manual-entry',
      userEducation: {
        title: 'Manual Location',
        explanation: 'Enter your location manually when needed.',
        benefits: ['Privacy control', 'Accuracy control'],
      },
      technicalImplementation: {
        componentFallback: 'LocationInputComponent',
      },
    };
  }

  private createGeneralNotificationStrategy(): FallbackStrategy {
    return {
      mode: 'alternative',
      description: 'Email and in-app notifications',
      limitations: ['No push notifications'],
      alternativeAction: 'web-fallback',
      userEducation: {
        title: 'Alternative Notifications',
        explanation: 'Receive notifications via email and in-app messages.',
        benefits: ['Cross-device access', 'Email backup'],
      },
      technicalImplementation: {
        serviceFallback: 'emailNotificationService',
      },
    };
  }

  private buildStrategyKey(
    permissionType: PermissionType,
    feature: string,
    denialReason: string
  ): string {
    return `${permissionType}-${feature}-${denialReason}`;
  }

  private getDefaultStrategy(
    permissionType: PermissionType,
    context: PermissionContext
  ): FallbackStrategy {
    return {
      mode: 'graceful',
      description: 'Limited functionality without permission',
      limitations: ['Reduced functionality'],
      userEducation: {
        title: 'Limited Mode',
        explanation: `${context.feature} will work with limited functionality.`,
        benefits: ['Basic functionality maintained'],
      },
      technicalImplementation: {},
    };
  }

  private customizeStrategy(
    strategy: FallbackStrategy,
    context: PermissionContext,
    denialReason: string
  ): FallbackStrategy {
    // Customize strategy based on context and denial reason
    const customized = { ...strategy };

    // Add context-specific information
    if (context.priority === 'critical' && denialReason === 'blocked') {
      customized.userEducation.explanation += ' This is important for your healthcare experience.';
      customized.retryStrategy = {
        enabled: true,
        maxRetries: 3,
        retryDelay: 15000,
        escalationSteps: ['Education', 'Settings guidance', 'Alternative', 'Support contact'],
      };
    }

    return customized;
  }

  private async presentFallbackEducation(
    strategy: FallbackStrategy,
    context: PermissionContext
  ): Promise<boolean> {
    return new Promise(resolve => {
      Alert.alert(
        strategy.userEducation.title,
        `${strategy.userEducation.explanation}\n\nBenefits:\n${strategy.userEducation.benefits.map(b => `• ${b}`).join('\n')}${
          strategy.userEducation.instructions
            ? `\n\nInstructions:\n${strategy.userEducation.instructions.map(i => `• ${i}`).join('\n')}`
            : ''
        }`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Continue',
            onPress: () => resolve(true),
          },
        ]
      );
    });
  }

  private async executeAlternativeAction(
    strategy: FallbackStrategy,
    context: PermissionContext
  ): Promise<{ success: boolean; actionTaken?: string; message?: string }> {
    if (!strategy.alternativeAction) {
      return { success: true, message: 'No alternative action required' };
    }

    try {
      switch (strategy.alternativeAction) {
        case 'photo-picker':
          return {
            success: true,
            actionTaken: 'photo-picker-enabled',
            message: 'Photo gallery access enabled',
          };

        case 'audio-only':
          return {
            success: true,
            actionTaken: 'audio-call-mode',
            message: 'Audio-only mode activated',
          };

        case 'text-based':
          return {
            success: true,
            actionTaken: 'text-input-enabled',
            message: 'Text communication enabled',
          };

        case 'manual-entry':
          return {
            success: true,
            actionTaken: 'manual-input-enabled',
            message: 'Manual entry mode enabled',
          };

        case 'web-fallback':
          return {
            success: true,
            actionTaken: 'web-service-enabled',
            message: 'Web-based alternative enabled',
          };

        case 'offline-mode':
          return {
            success: true,
            actionTaken: 'offline-mode-enabled',
            message: 'Offline functionality enabled',
          };

        default:
          return { success: false, message: 'Unknown alternative action' };
      }
    } catch (error) {
      console.error('Alternative action execution failed:', error);
      return { success: false, message: 'Alternative action failed' };
    }
  }

  private getProgressiveStrategies(
    permissionType: PermissionType,
    context: PermissionContext
  ): FallbackStrategy[] {
    // Return strategies in order of preference (most capable to least)
    const strategies: FallbackStrategy[] = [];

    // Try general strategy first
    const generalStrategy = this.strategies.get(`${permissionType}-general`);
    if (generalStrategy) {
      strategies.push(generalStrategy);
    }

    // Add more restrictive fallbacks
    strategies.push(this.getDefaultStrategy(permissionType, context));

    return strategies;
  }

  private getFinalFallbackStrategy(
    permissionType: PermissionType,
    context: PermissionContext
  ): FallbackStrategy {
    return {
      mode: 'disabled',
      description: 'Feature disabled due to permission requirements',
      limitations: ['Feature unavailable'],
      userEducation: {
        title: 'Feature Unavailable',
        explanation: `${context.feature} requires ${permissionType} permission to function. Please enable the permission in device settings to use this feature.`,
        benefits: ['Privacy maintained', 'Alternative features available'],
      },
      technicalImplementation: {
        componentFallback: 'DisabledFeatureComponent',
      },
    };
  }

  private createFallbackResult(
    strategy: FallbackStrategy,
    permissionType: PermissionType,
    context: PermissionContext,
    result: Partial<FallbackResult>
  ): FallbackResult {
    return {
      strategy,
      canProceed: result.canProceed || false,
      userAccepted: result.userAccepted || false,
      alternativeEnabled: result.alternativeEnabled || false,
      message: result.message,
      actionTaken: result.actionTaken,
      metadata: {
        permissionType,
        originalContext: context,
        fallbackMode: strategy.mode,
        timestamp: Date.now(),
        userChoices: [], // Could be populated with user interaction history
      },
    };
  }

  private trackFallbackUsage(
    strategy: FallbackStrategy,
    permissionType: PermissionType,
    context: PermissionContext,
    success: boolean
  ): void {
    sentryTracker.addBreadcrumb({
      category: 'permissions.fallback',
      message: `Fallback strategy executed: ${strategy.mode}`,
      data: {
        permissionType,
        feature: context.feature,
        strategyMode: strategy.mode,
        success,
        alternativeAction: strategy.alternativeAction,
      },
      level: success ? 'info' : 'warning',
    });
  }
}

export default FallbackStrategyManager.getInstance();
