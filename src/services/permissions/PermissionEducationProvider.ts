/**
 * Permission Education Content Provider - Phase 2
 *
 * Provides rich, contextual education content for permission requests
 * with healthcare-specific messaging and fallback explanations.
 */

import type { EducationContent } from '../../components/permissions/PermissionEducationModal';
import type { PermissionType, PermissionContext } from '../PermissionManagerMigrated';

export class PermissionEducationProvider {
  private static instance: PermissionEducationProvider;

  static getInstance(): PermissionEducationProvider {
    if (!PermissionEducationProvider.instance) {
      PermissionEducationProvider.instance = new PermissionEducationProvider();
    }
    return PermissionEducationProvider.instance;
  }

  /**
   * Get education content for a specific permission and context
   */
  getEducationContent(
    permissionType: PermissionType,
    context: PermissionContext
  ): EducationContent {
    const baseContent = this.getBaseEducationContent(permissionType);
    const contextualContent = this.getContextualContent(permissionType, context);

    return this.mergeContent(baseContent, contextualContent, context);
  }

  /**
   * Get fallback education content when permission is denied
   */
  getFallbackEducationContent(
    permissionType: PermissionType,
    context: PermissionContext,
    denialReason: 'denied' | 'blocked' | 'restricted'
  ): EducationContent {
    const baseContent = this.getEducationContent(permissionType, context);

    return {
      ...baseContent,
      title: `Alternative: ${baseContent.title}`,
      description: this.getFallbackDescription(permissionType, denialReason),
      alternatives: this.getFallbackAlternatives(permissionType, context),
      urgency: denialReason === 'blocked' ? 'high' : 'medium',
    };
  }

  // Private implementation methods

  private getBaseEducationContent(permissionType: PermissionType): Partial<EducationContent> {
    switch (permissionType) {
      case 'camera':
        return {
          title: 'Camera Access',
          description:
            'This app needs camera access to take photos and enable video consultations with healthcare providers.',
          benefits: [
            {
              icon: 'camera',
              title: 'Capture Medical Images',
              description:
                'Take clear photos of symptoms, injuries, or medical documents to share with your healthcare team.',
            },
            {
              icon: 'videocam',
              title: 'Video Consultations',
              description:
                'Participate in face-to-face consultations with doctors through secure video calls.',
            },
            {
              icon: 'document-text',
              title: 'Medical Documentation',
              description:
                'Capture insurance cards, prescription labels, and medical documents for your records.',
            },
          ],
          privacyInfo: {
            title: 'Your Camera Privacy',
            description:
              'Camera access is only used when you actively take photos or join video calls. No images are captured without your knowledge.',
            dataUsage: [
              'Photos are only taken when you tap the camera button',
              'Video calls are only active when you join a consultation',
              'All media is encrypted and HIPAA-compliant',
              'No photos or videos are stored without your permission',
            ],
          },
          context: 'healthcare',
          urgency: 'medium',
        };

      case 'microphone':
        return {
          title: 'Microphone Access',
          description:
            'Enable microphone access for voice consultations, audio notes, and clear communication with healthcare providers.',
          benefits: [
            {
              icon: 'mic',
              title: 'Voice Consultations',
              description:
                'Speak directly with healthcare providers during audio and video consultations.',
            },
            {
              icon: 'musical-notes',
              title: 'Audio Notes',
              description:
                'Record voice notes about symptoms, medication reminders, or health observations.',
            },
            {
              icon: 'headset',
              title: 'Clear Communication',
              description:
                'Ensure your healthcare team can hear you clearly during all interactions.',
            },
          ],
          privacyInfo: {
            title: 'Your Audio Privacy',
            description:
              'Microphone access is only active during calls and when recording voice notes. Audio is never recorded without your explicit action.',
            dataUsage: [
              'Audio is only captured when you speak during active calls',
              'Voice notes are only recorded when you press record',
              'All audio data is encrypted end-to-end',
              'Audio is processed securely and never shared without consent',
            ],
          },
          context: 'communication',
          urgency: 'medium',
        };

      case 'camera+microphone':
        return {
          title: 'Camera & Microphone Access',
          description:
            'Enable both camera and microphone for complete video consultation capabilities with your healthcare providers.',
          benefits: [
            {
              icon: 'videocam',
              title: 'Full Video Consultations',
              description:
                'Experience comprehensive telemedicine with both video and audio communication.',
            },
            {
              icon: 'people',
              title: 'Interactive Healthcare',
              description:
                'Healthcare providers can see and hear you for more accurate assessments and diagnoses.',
            },
            {
              icon: 'medical',
              title: 'Visual Examinations',
              description:
                'Allow doctors to visually examine symptoms, injuries, or areas of concern during consultations.',
            },
          ],
          privacyInfo: {
            title: 'Your Media Privacy',
            description:
              'Camera and microphone are only active during scheduled video consultations. You have full control over when they are used.',
            dataUsage: [
              'Video and audio only active during live consultations',
              'All communications are encrypted and HIPAA-compliant',
              'No recording occurs without explicit consent',
              'Media permissions can be revoked at any time',
            ],
          },
          context: 'healthcare',
          urgency: 'high',
        };

      case 'location':
      case 'location-precise':
      case 'location-coarse':
        return {
          title: 'Location Access',
          description:
            'Location access helps find nearby healthcare providers, emergency services, and ensures accurate service delivery.',
          benefits: [
            {
              icon: 'location',
              title: 'Find Nearby Providers',
              description:
                'Locate healthcare facilities, pharmacies, and specialists in your area.',
            },
            {
              icon: 'medical',
              title: 'Emergency Services',
              description:
                'Enable rapid response for emergency medical situations by sharing your location.',
            },
            {
              icon: 'car',
              title: 'Home Healthcare',
              description:
                'Allow healthcare providers to find your location for home visits and mobile services.',
            },
          ],
          privacyInfo: {
            title: 'Your Location Privacy',
            description:
              'Location is only used to provide location-based healthcare services. Your location is never tracked or stored unnecessarily.',
            dataUsage: [
              'Location only accessed when finding nearby services',
              'Emergency location sharing only when activated',
              'No continuous location tracking',
              'Location data is encrypted and protected',
            ],
          },
          context: 'safety',
          urgency: permissionType === 'location-precise' ? 'high' : 'medium',
        };

      case 'notifications':
        return {
          title: 'Notification Access',
          description:
            'Receive important health reminders, appointment notifications, and critical medical alerts.',
          benefits: [
            {
              icon: 'notifications',
              title: 'Medication Reminders',
              description: 'Never miss important medication doses with timely notifications.',
            },
            {
              icon: 'calendar',
              title: 'Appointment Alerts',
              description: 'Get reminders for upcoming healthcare appointments and consultations.',
            },
            {
              icon: 'warning',
              title: 'Health Alerts',
              description:
                'Receive critical health alerts and important updates from your healthcare team.',
            },
          ],
          privacyInfo: {
            title: 'Your Notification Privacy',
            description:
              'Notifications contain only essential health information and are designed to protect your medical privacy.',
            dataUsage: [
              'Only health-related notifications are sent',
              'Sensitive information is not displayed in notification previews',
              'Notifications are sent securely and encrypted',
              'You can customize which notifications you receive',
            ],
          },
          context: 'healthcare',
          urgency: 'medium',
        };

      case 'health':
        return {
          title: 'Health Data Access',
          description:
            'Access your health data to provide comprehensive health tracking and share relevant information with your healthcare providers.',
          benefits: [
            {
              icon: 'fitness',
              title: 'Comprehensive Health Tracking',
              description: 'Monitor vital signs, activity levels, and health metrics in one place.',
            },
            {
              icon: 'trending-up',
              title: 'Health Trends',
              description:
                'Track health improvements and identify patterns in your wellness journey.',
            },
            {
              icon: 'share',
              title: 'Provider Integration',
              description:
                'Share relevant health data with your healthcare team for better care coordination.',
            },
          ],
          privacyInfo: {
            title: 'Your Health Data Privacy',
            description:
              'Health data access follows strict HIPAA guidelines and is only used for your direct healthcare benefit.',
            dataUsage: [
              'Only aggregated health metrics are accessed',
              'Data is used solely for health insights and care coordination',
              'All health data is encrypted and HIPAA-compliant',
              'You control which data is shared with healthcare providers',
            ],
          },
          context: 'healthcare',
          urgency: 'medium',
        };

      case 'photos':
        return {
          title: 'Photo Library Access',
          description:
            'Access your photo library to share medical images, upload documents, and maintain your health records.',
          benefits: [
            {
              icon: 'images',
              title: 'Medical Image Sharing',
              description:
                'Share existing photos of symptoms, test results, or medical documents with healthcare providers.',
            },
            {
              icon: 'document',
              title: 'Document Upload',
              description:
                'Upload insurance cards, prescription images, and medical records from your photo library.',
            },
            {
              icon: 'folder',
              title: 'Health Record Management',
              description:
                'Organize and maintain a comprehensive digital health record with your existing photos.',
            },
          ],
          privacyInfo: {
            title: 'Your Photo Privacy',
            description:
              'Photo access is limited to health-related images you choose to share. No photos are accessed without your selection.',
            dataUsage: [
              'Only photos you specifically select are accessed',
              'No automatic scanning or access of personal photos',
              'Shared photos are encrypted and HIPAA-compliant',
              'Photos are only used for your healthcare needs',
            ],
          },
          context: 'healthcare',
          urgency: 'low',
        };

      case 'storage':
        return {
          title: 'Storage Access',
          description:
            'Access device storage to save health documents, backup important medical information, and manage health records.',
          benefits: [
            {
              icon: 'folder',
              title: 'Health Document Storage',
              description:
                'Save important health documents and medical records securely on your device.',
            },
            {
              icon: 'cloud-download',
              title: 'Offline Access',
              description:
                'Access your health information even when not connected to the internet.',
            },
            {
              icon: 'save',
              title: 'Backup & Sync',
              description:
                'Backup critical health information and sync across your devices securely.',
            },
          ],
          privacyInfo: {
            title: 'Your Storage Privacy',
            description:
              'Storage access is used only for health-related files in a secure, encrypted section of your device.',
            dataUsage: [
              'Only health app data is stored in designated secure folders',
              'All stored data is encrypted and protected',
              'No access to personal files outside the health app',
              'Storage usage is transparent and manageable',
            ],
          },
          context: 'convenience',
          urgency: 'low',
        };

      default:
        return {
          title: 'Permission Required',
          description: 'This permission is needed for the app to function properly.',
          benefits: [
            {
              icon: 'checkmark-circle',
              title: 'App Functionality',
              description: 'Enables core features of the application.',
            },
          ],
          privacyInfo: {
            title: 'Your Privacy',
            description: 'This permission is used responsibly and only for intended features.',
            dataUsage: ['Used only for app functionality', 'No unnecessary data collection'],
          },
          context: 'convenience',
          urgency: 'medium',
        };
    }
  }

  private getContextualContent(
    permissionType: PermissionType,
    context: PermissionContext
  ): Partial<EducationContent> {
    const feature = context.feature.toLowerCase();

    // Healthcare consultation context
    if (feature.includes('consultation') || feature.includes('doctor')) {
      return {
        subtitle: 'For Your Healthcare Consultation',
        context: 'healthcare',
        urgency: context.priority === 'critical' ? 'high' : 'medium',
      };
    }

    // Emergency context
    if (feature.includes('emergency') || feature.includes('urgent')) {
      return {
        subtitle: 'For Emergency Healthcare Access',
        context: 'safety',
        urgency: 'high',
      };
    }

    // Medication context
    if (feature.includes('medication') || feature.includes('reminder')) {
      return {
        subtitle: 'For Medication Management',
        context: 'healthcare',
        urgency: 'medium',
      };
    }

    // Profile setup context
    if (feature.includes('profile') || feature.includes('setup')) {
      return {
        subtitle: 'For Your Health Profile',
        context: 'convenience',
        urgency: 'low',
      };
    }

    return {};
  }

  private mergeContent(
    baseContent: Partial<EducationContent>,
    contextualContent: Partial<EducationContent>,
    context: PermissionContext
  ): EducationContent {
    return {
      title: contextualContent.title || baseContent.title || 'Permission Required',
      subtitle: contextualContent.subtitle,
      description:
        baseContent.description || 'This permission is needed for the app to function properly.',
      benefits: baseContent.benefits || [],
      privacyInfo: baseContent.privacyInfo || {
        title: 'Your Privacy',
        description: 'This permission is used responsibly.',
        dataUsage: ['Used only for app functionality'],
      },
      context: contextualContent.context || baseContent.context || 'convenience',
      urgency: contextualContent.urgency || baseContent.urgency || 'medium',
    };
  }

  private getFallbackDescription(
    permissionType: PermissionType,
    denialReason: 'denied' | 'blocked' | 'restricted'
  ): string {
    const action =
      denialReason === 'blocked'
        ? 'was permanently denied'
        : denialReason === 'restricted'
          ? 'is restricted on this device'
          : 'was denied';

    switch (permissionType) {
      case 'camera':
        return `Camera access ${action}. You can still use photo gallery to share images with healthcare providers.`;
      case 'microphone':
        return `Microphone access ${action}. You can still use text-based communication with healthcare providers.`;
      case 'camera+microphone':
        return `Camera and microphone access ${action}. Audio-only consultations are still available.`;
      case 'location':
        return `Location access ${action}. You can manually enter your location when needed.`;
      case 'notifications':
        return `Notification access ${action}. You can still check the app for important updates and reminders.`;
      default:
        return `${permissionType} access ${action}. Alternative options are available.`;
    }
  }

  private getFallbackAlternatives(
    permissionType: PermissionType,
    context: PermissionContext
  ): EducationContent['alternatives'] {
    switch (permissionType) {
      case 'camera':
        return {
          title: 'Photo Gallery Access',
          description:
            'Select existing photos from your gallery to share with healthcare providers.',
          limitations: [
            'Cannot take new photos in real-time',
            'Limited to existing images in your gallery',
          ],
        };

      case 'microphone':
        return {
          title: 'Text-Based Communication',
          description:
            'Use text messages and written notes to communicate with healthcare providers.',
          limitations: [
            'No voice recording capability',
            'May take longer to express complex symptoms',
          ],
        };

      case 'camera+microphone':
        return {
          title: 'Audio-Only Consultation',
          description: 'Continue with voice-only consultation with your healthcare provider.',
          limitations: ['No video sharing capability', 'Provider cannot visually examine symptoms'],
        };

      case 'location':
        return {
          title: 'Manual Location Entry',
          description: 'Manually enter your address when location information is needed.',
          limitations: [
            'No automatic location detection',
            'May be less accurate for emergency services',
          ],
        };

      case 'notifications':
        return {
          title: 'In-App Notifications',
          description: 'Check the app regularly for important health updates and reminders.',
          limitations: ['No automatic alerts', 'Requires manually checking the app'],
        };

      default:
        return {
          title: 'Limited Functionality',
          description: 'Basic features will still be available.',
          limitations: ['Reduced functionality'],
        };
    }
  }
}

export default PermissionEducationProvider.getInstance();
