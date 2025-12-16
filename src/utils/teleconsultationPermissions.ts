/**
 * ✅ TELECONSULTATION: Utility functions for requesting permissions in teleconsultation scenarios
 *
 * This utility provides simplified, context-aware permission requests for common
 * teleconsultation scenarios, making it easy for developers to implement
 * medical-grade permission handling.
 */

import type { PermissionType } from '../services/permissions/ConsolidatedPermissionManager';
import { ConsolidatedPermissionManager } from '../services/permissions/ConsolidatedPermissionManager';

export interface TeleconsultationPermissionOptions {
  doctorName?: string;
  consultationType?: 'routine' | 'urgent' | 'emergency' | 'follow-up';
  includeHealthData?: boolean;
  includeLocation?: boolean;
  userInitiated?: boolean;
}

export interface TeleconsultationPermissionResult {
  granted: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  hasHealth?: boolean;
  hasLocation?: boolean;
  hasNotifications: boolean;
  fallbackAvailable: boolean;
  message: string;
  capabilities: string[];
}

/**
 * Request permissions for video teleconsultation
 * Handles camera, microphone, and notifications with medical context
 */
export async function requestVideoConsultationPermissions(
  options: TeleconsultationPermissionOptions = {}
): Promise<TeleconsultationPermissionResult> {
  const {
    doctorName,
    consultationType = 'routine',
    includeHealthData = false,
    includeLocation = false,
    userInitiated = true,
  } = options;

  const permissionManager = ConsolidatedPermissionManager.getInstance();

  try {
    let permissionType: PermissionType = 'teleconsultation-video';

    // For emergency consultations, request full access including location
    if (consultationType === 'emergency' || includeLocation) {
      permissionType = 'emergency-call';
    }

    const result = await permissionManager.requestPermission(permissionType, {
      feature: `video-consultation-${consultationType}`,
      priority: consultationType === 'emergency' ? 'critical' : 'important',
      userInitiated,
      medicalContext: {
        consultationType,
        doctorName,
        appointmentTime: new Date(),
        riskLevel: consultationType === 'emergency' ? 'high' : 'medium',
      },
      educationalContent: {
        title: `${consultationType === 'emergency' ? 'Emergency' : 'Video'} Consultation Permissions`,
        description: `Enable camera and microphone access for ${consultationType} video consultation${doctorName ? ` with ${doctorName}` : ''}.`,
        benefits: [
          consultationType === 'emergency'
            ? 'Immediate emergency communication'
            : 'High-quality video consultation',
          'Real-time visual assessment by healthcare provider',
          'Better diagnostic accuracy',
          'Professional medical communication',
        ],
        medicalNecessity:
          'Camera and microphone access are essential for comprehensive video consultations',
        dataUsage:
          'Audio and video data is processed in real-time and follows medical privacy guidelines',
        retentionPolicy: 'Consultation data follows medical data retention and privacy regulations',
      },
      fallbackStrategy: {
        mode: 'alternative',
        description: 'Audio-only consultation available as backup',
        limitations: ['No video feed', 'Limited visual assessment'],
        alternativeApproach: 'Switch to audio-only consultation',
      },
    });

    // Handle health data if requested
    let healthGranted = false;
    if (includeHealthData) {
      try {
        const healthResult = await permissionManager.requestPermission('health-sharing', {
          feature: 'health-data-sharing',
          priority: 'optional',
          userInitiated,
          fallbackStrategy: {
            mode: 'alternative',
            description: 'Manual health data entry available',
            limitations: ['No automatic health data sharing'],
            alternativeApproach: 'Manual data entry during consultation',
          },
        });
        healthGranted = healthResult.status === 'granted';
      } catch (error) {
        console.warn('Health data permission failed (optional):', error);
      }
    }

    const granted = result.status === 'granted';
    const capabilities = [
      granted ? 'Video consultation' : null,
      granted ? 'Audio communication' : null,
      result.message?.includes('notifications') ? 'Medical notifications' : null,
      includeLocation && result.message?.includes('location') ? 'Location sharing' : null,
      healthGranted ? 'Health data sharing' : null,
    ].filter(Boolean) as string[];

    return {
      granted,
      hasVideo: granted,
      hasAudio: granted, // Video includes audio
      hasHealth: healthGranted,
      hasLocation: includeLocation && result.message?.includes('location'),
      hasNotifications: result.message?.includes('notifications') || false,
      fallbackAvailable: result.fallbackAvailable,
      message:
        result.message ||
        (granted
          ? 'Video consultation permissions granted'
          : 'Video consultation permissions required'),
      capabilities,
    };
  } catch (error) {
    console.error('Video consultation permissions failed:', error);
    return {
      granted: false,
      hasVideo: false,
      hasAudio: false,
      hasHealth: false,
      hasLocation: false,
      hasNotifications: false,
      fallbackAvailable: true,
      message: 'Permission request failed. Please try again.',
      capabilities: [],
    };
  }
}

/**
 * Request permissions for audio-only teleconsultation
 * Handles microphone and notifications with medical context
 */
export async function requestAudioConsultationPermissions(
  options: TeleconsultationPermissionOptions = {}
): Promise<TeleconsultationPermissionResult> {
  const {
    doctorName,
    consultationType = 'routine',
    includeHealthData = false,
    userInitiated = true,
  } = options;

  const permissionManager = ConsolidatedPermissionManager.getInstance();

  try {
    const result = await permissionManager.requestPermission('teleconsultation-audio', {
      feature: `audio-consultation-${consultationType}`,
      priority: 'critical',
      userInitiated,
      medicalContext: {
        consultationType,
        doctorName,
        appointmentTime: new Date(),
        riskLevel: consultationType === 'emergency' ? 'high' : 'low',
      },
      educationalContent: {
        title: 'Audio Consultation Permissions',
        description: `Enable microphone access for audio consultation${doctorName ? ` with ${doctorName}` : ''}.`,
        benefits: [
          'Clear audio communication with healthcare provider',
          'Professional consultation quality',
          'Real-time medical discussion',
          'Secure voice transmission',
        ],
        medicalNecessity: 'Microphone access is required for audio consultations',
        dataUsage: 'Audio data is processed in real-time for consultation purposes',
        retentionPolicy: 'Audio recordings follow medical data retention guidelines',
      },
      fallbackStrategy: {
        mode: 'disabled',
        description: 'Audio consultation unavailable without microphone access',
        limitations: ['No voice communication possible'],
      },
    });

    // Handle health data if requested
    let healthGranted = false;
    if (includeHealthData) {
      try {
        const healthResult = await permissionManager.requestPermission('health-sharing', {
          feature: 'health-data-sharing',
          priority: 'optional',
          userInitiated,
          fallbackStrategy: {
            mode: 'alternative',
            description: 'Manual health data entry available',
            limitations: ['No automatic health data sharing'],
            alternativeApproach: 'Manual data entry during consultation',
          },
        });
        healthGranted = healthResult.status === 'granted';
      } catch (error) {
        console.warn('Health data permission failed (optional):', error);
      }
    }

    const granted = result.status === 'granted';
    const capabilities = [
      granted ? 'Audio consultation' : null,
      result.message?.includes('notifications') ? 'Medical notifications' : null,
      healthGranted ? 'Health data sharing' : null,
    ].filter(Boolean) as string[];

    return {
      granted,
      hasVideo: false,
      hasAudio: granted,
      hasHealth: healthGranted,
      hasLocation: false,
      hasNotifications: result.message?.includes('notifications') || false,
      fallbackAvailable: result.fallbackAvailable,
      message:
        result.message ||
        (granted
          ? 'Audio consultation permissions granted'
          : 'Microphone access required for audio consultations'),
      capabilities,
    };
  } catch (error) {
    console.error('Audio consultation permissions failed:', error);
    return {
      granted: false,
      hasVideo: false,
      hasAudio: false,
      hasHealth: false,
      hasLocation: false,
      hasNotifications: false,
      fallbackAvailable: false,
      message: 'Permission request failed. Please try again.',
      capabilities: [],
    };
  }
}

/**
 * Request emergency call permissions
 * Handles all necessary permissions for emergency medical situations
 */
export async function requestEmergencyPermissions(): Promise<TeleconsultationPermissionResult> {
  const permissionManager = ConsolidatedPermissionManager.getInstance();

  try {
    const result = await permissionManager.requestPermission('emergency-call', {
      feature: 'emergency-medical-call',
      priority: 'critical',
      userInitiated: true,
      medicalContext: {
        consultationType: 'emergency',
        riskLevel: 'high',
      },
      educationalContent: {
        title: 'Emergency Medical Call Permissions',
        description: 'Enable full device access for emergency medical consultation.',
        benefits: [
          'Immediate emergency communication',
          'Location sharing for emergency services',
          'Real-time emergency assessment',
          'Fastest possible response times',
        ],
        medicalNecessity: 'Full device access is critical for emergency medical situations',
        dataUsage: 'Emergency data is shared with medical professionals for immediate care',
        retentionPolicy: 'Emergency call data follows medical emergency protocols',
      },
      fallbackStrategy: {
        mode: 'limited',
        description: 'Limited emergency features available',
        limitations: ['Reduced emergency capabilities'],
        alternativeApproach: 'Contact emergency services directly at 911',
      },
    });

    const granted = result.status === 'granted';
    const emergencyFeatures = result.message?.split(', ') || [];

    return {
      granted,
      hasVideo: granted && emergencyFeatures.some(f => f.includes('Video')),
      hasAudio: granted && emergencyFeatures.some(f => f.includes('Audio')),
      hasLocation: granted && emergencyFeatures.some(f => f.includes('Location')),
      hasNotifications: granted && emergencyFeatures.some(f => f.includes('notification')),
      fallbackAvailable: result.fallbackAvailable,
      message:
        result.message ||
        (granted ? 'Emergency call permissions granted' : 'Emergency permissions required'),
      capabilities: emergencyFeatures,
    };
  } catch (error) {
    console.error('Emergency permissions failed:', error);
    return {
      granted: false,
      hasVideo: false,
      hasAudio: false,
      hasLocation: false,
      hasNotifications: false,
      fallbackAvailable: true,
      message: 'Emergency permission request failed. Contact emergency services directly.',
      capabilities: [],
    };
  }
}

/**
 * Request health monitoring permissions
 * Handles health data and notifications for continuous health monitoring
 */
export async function requestHealthMonitoringPermissions(): Promise<TeleconsultationPermissionResult> {
  const permissionManager = ConsolidatedPermissionManager.getInstance();

  try {
    const result = await permissionManager.requestPermission('health-monitoring', {
      feature: 'continuous-health-monitoring',
      priority: 'important',
      userInitiated: true,
      medicalContext: {
        consultationType: 'routine',
        riskLevel: 'low',
      },
      educationalContent: {
        title: 'Health Monitoring Permissions',
        description: 'Enable health data and notification access for continuous health monitoring.',
        benefits: [
          'Automatic health data collection',
          'Personalized health insights',
          'Proactive health alerts',
          'Comprehensive health tracking',
        ],
        medicalNecessity: 'Health data access enables comprehensive medical monitoring',
        dataUsage: 'Health data is processed to provide personalized medical insights',
        retentionPolicy: 'Health data follows strict medical privacy guidelines',
      },
      fallbackStrategy: {
        mode: 'alternative',
        description: 'Manual health data entry available',
        limitations: ['No automatic health tracking', 'Manual data entry required'],
        alternativeApproach: 'Manual health data recording during consultations',
      },
    });

    const granted = result.status === 'granted';

    return {
      granted,
      hasVideo: false,
      hasAudio: false,
      hasHealth: granted,
      hasNotifications: granted && result.message?.includes('notifications'),
      fallbackAvailable: result.fallbackAvailable,
      message:
        result.message ||
        (granted ? 'Health monitoring active' : 'Health data access required for monitoring'),
      capabilities: granted ? ['Health monitoring', 'Health alerts'] : [],
    };
  } catch (error) {
    console.error('Health monitoring permissions failed:', error);
    return {
      granted: false,
      hasVideo: false,
      hasAudio: false,
      hasHealth: false,
      hasNotifications: false,
      fallbackAvailable: true,
      message: 'Health monitoring setup failed. Try manual data entry.',
      capabilities: [],
    };
  }
}
