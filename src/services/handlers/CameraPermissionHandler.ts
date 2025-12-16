/**
 * Camera Permission Handler
 *
 * Specialized handler for camera permissions with complete user flow,
 * educational content, and graceful fallbacks
 */

import { Platform } from 'react-native';

// ✅ MIGRATED: Now using ConsolidatedPermissionManager via PermissionManager
import type { PermissionContext, PermissionResult } from '../PermissionManagerMigrated';
import PermissionManager, { PermissionType } from '../PermissionManagerMigrated';

// Educational content interface for backward compatibility
export interface EducationalContent {
  title: string;
  description: string;
  benefits: string[];
  privacyNote?: string;
}

export interface CameraRequestContext {
  feature: 'profile-photo' | 'document-scan' | 'video-call' | 'ar-feature' | 'qr-scanner';
  userJourney?: 'onboarding' | 'feature-access' | 'settings';
  allowFallback?: boolean;
}

export interface CameraPermissionResult extends PermissionResult {
  fallbackOption?: 'photo-picker' | 'document-upload' | 'manual-entry';
}

export class CameraPermissionHandler {
  private manager: typeof PermissionManager;

  constructor() {
    // ✅ MIGRATED: Now using ConsolidatedPermissionManager via PermissionManager
    this.manager = PermissionManager;
  }

  /**
   * Request camera access with context-aware education and fallbacks
   */
  async requestCameraAccess(context: CameraRequestContext): Promise<CameraPermissionResult> {
    // ✅ MIGRATED: Convert to new PermissionContext format for ConsolidatedPermissionManager
    const requestContext: PermissionContext = {
      feature: context.feature,
      priority: this.getFeaturePriority(context.feature),
      userJourney: context.userJourney || 'feature-access',
      userInitiated: true,
      fallbackStrategy: this.createFallbackStrategy(context),
      explanation: this.createEducationalContent(context.feature),
    };

    try {
      console.log(`📷 Requesting camera access for ${context.feature}`);

      // Check current status first
      const currentStatus = await this.manager.checkPermission('camera', requestContext);

      if (currentStatus.status === 'granted') {
        return this.createSuccessResult(context);
      }

      // Handle permanently denied state
      if (currentStatus.status === 'blocked') {
        return this.handleBlockedPermission(context, requestContext);
      }

      // Request permission with educational content
      const result = await this.manager.requestPermission('camera', requestContext);

      return this.processPermissionResult(result, context);
    } catch (error) {
      console.error('Camera permission request failed:', error);
      return this.createErrorResult(error, context);
    }
  }

  /**
   * Quick camera permission check without requesting
   */
  async checkCameraPermission(): Promise<CameraPermissionResult> {
    try {
      const result = await this.manager.checkPermission('camera');
      return this.processPermissionResult(result, { feature: 'profile-photo' });
    } catch (error) {
      console.error('Camera permission check failed:', error);
      throw error;
    }
  }

  /**
   * Handle camera permission for specific video call scenarios
   */
  async requestVideoCallCamera(
    callType: 'consultation' | 'group-call' | 'emergency'
  ): Promise<CameraPermissionResult> {
    const context: CameraRequestContext = {
      feature: 'video-call',
      userJourney: callType === 'emergency' ? 'feature-access' : 'feature-access',
      allowFallback: callType !== 'emergency',
    };

    const requestContext: PermissionContext = {
      feature: 'video-call',
      priority: callType === 'emergency' ? 'critical' : 'important',
      userInitiated: true,
      fallbackStrategy:
        callType === 'emergency'
          ? {
              mode: 'disabled',
              description: 'Camera required for emergency calls',
              limitations: [],
            }
          : this.createVideoCallFallbackStrategy(),
      educationalContent: this.createVideoCallEducation(callType),
      batchWith: ['microphone'], // Often requested together
    };

    const result = await this.manager.requestPermission('camera', requestContext);
    return this.processVideoCallResult(result, callType);
  }

  /**
   * Request camera for document scanning with OCR fallback
   */
  async requestDocumentScanCamera(): Promise<CameraPermissionResult> {
    const context: CameraRequestContext = {
      feature: 'document-scan',
      userJourney: 'feature-access',
      allowFallback: true,
    };

    const requestContext: PermissionContext = {
      feature: 'document-scan',
      priority: 'important',
      userInitiated: true,
      fallbackStrategy: {
        mode: 'alternative',
        description: 'Upload document photo from gallery',
        limitations: ['No real-time scanning', 'Manual photo selection required'],
        alternativeApproach: 'photo-upload',
      },
      educationalContent: {
        title: 'Camera Access for Document Scanning',
        description: 'To scan documents quickly and accurately, we need access to your camera.',
        benefits: [
          'Instant document digitization',
          'Automatic edge detection',
          'Better quality than manual photos',
        ],
        privacyNote: 'Documents are processed locally and only shared with your explicit consent.',
      },
    };

    const result = await this.manager.requestPermission('camera', requestContext);
    return this.processDocumentScanResult(result);
  }

  // Private helper methods

  private getFeaturePriority(feature: string): 'critical' | 'important' | 'optional' {
    const priorityMap = {
      'video-call': 'critical',
      'document-scan': 'important',
      'profile-photo': 'optional',
      'ar-feature': 'important',
      'qr-scanner': 'important',
    };
    return priorityMap[feature] || 'optional';
  }

  private createFallbackStrategy(context: CameraRequestContext) {
    if (!context.allowFallback) {
      return { mode: 'disabled', description: 'Camera required', limitations: [] };
    }

    const fallbackMap = {
      'profile-photo': {
        mode: 'alternative',
        description: 'Choose photo from gallery',
        limitations: ['No real-time capture', 'Existing photos only'],
        alternativeApproach: 'photo-picker',
      },
      'document-scan': {
        mode: 'alternative',
        description: 'Upload document photo',
        limitations: ['No real-time scanning', 'Manual photo selection'],
        alternativeApproach: 'photo-upload',
      },
      'video-call': {
        mode: 'limited',
        description: 'Audio-only call available',
        limitations: ['No video sharing', 'Voice communication only'],
        alternativeApproach: 'audio-only',
      },
      'qr-scanner': {
        mode: 'alternative',
        description: 'Manual code entry',
        limitations: ['No automatic scanning', 'Manual input required'],
        alternativeApproach: 'manual-entry',
      },
      'ar-feature': {
        mode: 'disabled',
        description: 'AR features unavailable',
        limitations: ['No augmented reality', 'Static content only'],
      },
    };

    return (
      fallbackMap[context.feature] || {
        mode: 'disabled',
        description: 'Feature unavailable',
        limitations: [],
      }
    );
  }

  private createEducationalContent(feature: string): PermissionContext['explanation'] {
    const contentMap = {
      'profile-photo': {
        title: 'Camera Access for Profile Photo',
        reason:
          'Take a clear profile photo to help others recognize you and personalize your experience.',
        benefits: [
          'Personalize your profile',
          'Help healthcare providers recognize you',
          'Enhanced user experience',
        ],
        privacyNote: 'Your photo is stored securely and only shared with your consent.',
      },
      'document-scan': {
        title: 'Camera Access for Document Scanning',
        reason:
          'Scan documents quickly and accurately with automatic edge detection and quality enhancement.',
        benefits: [
          'Instant document digitization',
          'Automatic edge detection',
          'Higher quality than manual photos',
        ],
        privacyNote: 'Documents are processed locally and encrypted during storage.',
      },
      'video-call': {
        title: 'Camera Access for Video Consultations',
        reason:
          'Enable video consultations with healthcare providers for better diagnosis and care.',
        benefits: [
          'Face-to-face consultations',
          'Visual health assessments',
          'Enhanced communication with providers',
        ],
        privacyNote: 'Video calls are encrypted and not recorded without your permission.',
      },
      'qr-scanner': {
        title: 'Camera Access for QR Code Scanning',
        reason:
          'Quickly scan QR codes to access information, join calls, or authenticate securely.',
        benefits: ['Quick information access', 'Secure authentication', 'Instant call joining'],
        privacyNote: 'QR code data is processed locally and not stored.',
      },
      'ar-feature': {
        title: 'Camera Access for AR Features',
        reason:
          'Experience augmented reality features for interactive health education and guidance.',
        benefits: [
          'Interactive health education',
          'Visual guidance for procedures',
          'Enhanced learning experience',
        ],
        privacyNote: 'AR processing happens locally on your device.',
      },
    };

    return (
      contentMap[feature] || {
        title: 'Camera Access',
        reason: 'Camera access is needed for this feature to work properly.',
        benefits: ['Enhanced app functionality'],
        privacyNote: 'Camera access is used only for the intended feature.',
      }
    );
  }

  private createVideoCallEducation(callType: string): PermissionContext['explanation'] {
    const educationMap = {
      consultation: {
        title: 'Camera Access for Medical Consultation',
        reason:
          'Enable video during your consultation so your healthcare provider can see you clearly.',
        benefits: [
          'Better diagnosis through visual assessment',
          'More effective communication',
          'Reduced need for in-person visits',
        ],
        privacyNote: 'All consultations are HIPAA-compliant and encrypted.',
      },
      'group-call': {
        title: 'Camera Access for Group Consultation',
        reason: 'Join group consultations with video to participate fully in discussions.',
        benefits: [
          'Active participation in group sessions',
          'Better interaction with multiple providers',
          'Enhanced collaborative care',
        ],
        privacyNote: 'Group calls are secure and participants control their own video.',
      },
      emergency: {
        title: 'Camera Access for Emergency Consultation',
        reason: 'Enable video immediately for emergency medical assessment and guidance.',
        benefits: [
          'Immediate visual assessment',
          'Critical medical guidance',
          'Faster emergency response',
        ],
        privacyNote: 'Emergency calls prioritize medical care while maintaining privacy.',
      },
    };

    return educationMap[callType] || this.createEducationalContent('video-call');
  }

  private createVideoCallFallbackStrategy() {
    return {
      mode: 'limited',
      description: 'Continue with audio-only call',
      limitations: ['No video sharing', 'Voice communication only', 'Text chat available'],
      alternativeApproach: 'audio-only',
    };
  }

  private processPermissionResult(
    result: PermissionResult,
    context: CameraRequestContext
  ): CameraPermissionResult {
    const cameraResult: CameraPermissionResult = {
      ...result,
      fallbackOption: this.getFallbackOption(context.feature, result.status),
    };

    // Add feature-specific messaging
    if (result.status === 'granted') {
      cameraResult.message = this.getSuccessMessage(context.feature);
    } else if (result.status === 'denied' && result.fallbackAvailable) {
      cameraResult.message = this.getFallbackMessage(context.feature);
    }

    return cameraResult;
  }

  private processVideoCallResult(
    result: PermissionResult,
    callType: string
  ): CameraPermissionResult {
    const cameraResult: CameraPermissionResult = {
      ...result,
      fallbackOption: result.status !== 'granted' ? 'audio-only' : undefined,
    };

    if (result.status === 'denied' && callType === 'emergency') {
      cameraResult.message = 'Proceeding with audio-only emergency call';
    }

    return cameraResult;
  }

  private processDocumentScanResult(result: PermissionResult): CameraPermissionResult {
    return {
      ...result,
      fallbackOption: result.status !== 'granted' ? 'photo-picker' : undefined,
      message:
        result.status === 'denied'
          ? 'You can still upload photos from your gallery'
          : result.message,
    };
  }

  private async handleBlockedPermission(
    context: CameraRequestContext,
    requestContext: PermissionContext
  ): Promise<CameraPermissionResult> {
    const hasAlternative = requestContext.fallbackStrategy.alternativeApproach;

    // For critical features, guide to settings
    if (requestContext.priority === 'critical') {
      return {
        status: 'blocked',
        canAskAgain: false,
        message: 'Camera access required. Please enable in device settings.',
        fallbackAvailable: false,
        metadata: this.createMetadata('fresh'),
      };
    }

    // For optional features, offer alternative
    return {
      status: 'blocked',
      canAskAgain: false,
      message: hasAlternative
        ? `Camera blocked. ${requestContext.fallbackStrategy.description}`
        : 'Camera access is blocked',
      fallbackAvailable: hasAlternative !== undefined,
      fallbackOption: this.getFallbackOption(context.feature, 'blocked'),
      degradationPath: requestContext.fallbackStrategy,
      metadata: this.createMetadata('fresh'),
    };
  }

  private createSuccessResult(context: CameraRequestContext): CameraPermissionResult {
    return {
      status: 'granted',
      canAskAgain: false,
      message: this.getSuccessMessage(context.feature),
      fallbackAvailable: false,
      metadata: this.createMetadata('fresh'),
    };
  }

  private createErrorResult(error: any, context: CameraRequestContext): CameraPermissionResult {
    return {
      status: 'unknown',
      canAskAgain: false,
      message: error?.message || 'Camera permission error',
      fallbackAvailable: context.allowFallback !== false,
      fallbackOption: this.getFallbackOption(context.feature, 'unknown'),
      metadata: this.createMetadata('fresh'),
    };
  }

  private getFallbackOption(
    feature: string,
    status: string
  ): 'photo-picker' | 'document-upload' | 'manual-entry' | undefined {
    if (status === 'granted') return undefined;

    const fallbackMap = {
      'profile-photo': 'photo-picker',
      'document-scan': 'document-upload',
      'qr-scanner': 'manual-entry',
    };

    return fallbackMap[feature] as any;
  }

  private getSuccessMessage(feature: string): string {
    const messageMap = {
      'profile-photo': 'Camera ready for profile photo',
      'document-scan': 'Camera ready for document scanning',
      'video-call': 'Camera ready for video call',
      'qr-scanner': 'Camera ready for QR scanning',
      'ar-feature': 'Camera ready for AR features',
    };

    return messageMap[feature] || 'Camera access granted';
  }

  private getFallbackMessage(feature: string): string {
    const messageMap = {
      'profile-photo': 'You can choose a photo from your gallery instead',
      'document-scan': 'You can upload a document photo from your gallery',
      'video-call': 'You can continue with an audio-only call',
      'qr-scanner': 'You can enter the code manually',
      'ar-feature': 'AR features will not be available',
    };

    return messageMap[feature] || 'Alternative options are available';
  }

  private createMetadata(source: 'cache' | 'fresh' | 'fallback') {
    return {
      source,
      timestamp: Date.now(),
      retryCount: 0,
      osVersion: Platform.Version.toString(),
      deviceModel: 'Unknown',
      deviceTier: 'unknown',
    };
  }
}

export default CameraPermissionHandler;
