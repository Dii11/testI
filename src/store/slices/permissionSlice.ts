import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform, AppState } from 'react-native';

import type { PermissionType } from '../../services/permissions/ConsolidatedPermissionManager';
import { ConsolidatedPermissionManager } from '../../services/permissions/ConsolidatedPermissionManager';
import type { HealthDataType } from '../../types/health';

export interface PermissionStatus {
  status: 'unknown' | 'granted' | 'denied' | 'undetermined' | 'restricted';
  lastChecked: number;
  isChecking: boolean;
  error?: string;
  canAskAgain?: boolean;
}

export interface PermissionState {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  health: PermissionStatus & {
    grantedTypes?: HealthDataType[];
    availableTypes?: HealthDataType[];
  };
  location: PermissionStatus;
  notifications: PermissionStatus;
  // Combined permissions for efficiency
  cameraAndMicrophone: PermissionStatus;

  // ✅ TELECONSULTATION: Enhanced permission states for medical scenarios
  teleconsultationVideo: PermissionStatus & {
    capabilities?: string[];
    degradationPath?: string;
  };
  teleconsultationAudio: PermissionStatus & {
    capabilities?: string[];
  };
  emergencyCall: PermissionStatus & {
    capabilities?: string[];
    emergencyFeatures?: string[];
  };
  healthMonitoring: PermissionStatus & {
    monitoringActive?: boolean;
    alertsEnabled?: boolean;
  };
  healthSharing: PermissionStatus & {
    sharingCapabilities?: string[];
  };

  // Meta state
  isInitialized: boolean;
  lastAppStateChange: number;
  consecutiveFailures: number;
  lastRequestIds: {
    camera?: string;
    microphone?: string;
    combined?: string;
    teleconsultation?: string;
    emergency?: string;
    health?: string;
  };
}

const initialPermissionStatus: PermissionStatus = {
  status: 'unknown',
  lastChecked: 0,
  isChecking: false,
  canAskAgain: true,
};

const initialState: PermissionState = {
  camera: { ...initialPermissionStatus },
  microphone: { ...initialPermissionStatus },
  health: { ...initialPermissionStatus, grantedTypes: [], availableTypes: [] },
  location: { ...initialPermissionStatus },
  notifications: { ...initialPermissionStatus },
  cameraAndMicrophone: { ...initialPermissionStatus },

  // ✅ TELECONSULTATION: Initialize enhanced permission states
  teleconsultationVideo: {
    ...initialPermissionStatus,
    capabilities: [],
    degradationPath: 'unknown',
  },
  teleconsultationAudio: { ...initialPermissionStatus, capabilities: [] },
  emergencyCall: { ...initialPermissionStatus, capabilities: [], emergencyFeatures: [] },
  healthMonitoring: { ...initialPermissionStatus, monitoringActive: false, alertsEnabled: false },
  healthSharing: { ...initialPermissionStatus, sharingCapabilities: [] },

  isInitialized: false,
  lastAppStateChange: Date.now(),
  consecutiveFailures: 0,
  lastRequestIds: {},
};

// Async thunks for permission checking with caching
export const checkCameraPermission = createAsyncThunk(
  'permissions/checkCamera',
  async (_, { rejectWithValue }) => {
    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const result = await permissionManager.checkPermission('camera');

      return {
        status: result.status as PermissionStatus['status'],
        canAskAgain: result.canAskAgain,
        fromCache: result.metadata.source === 'cache',
      };
    } catch (error) {
      return rejectWithValue(`Camera permission check failed: ${error}`);
    }
  }
);

export const checkMicrophonePermission = createAsyncThunk(
  'permissions/checkMicrophone',
  async (_, { rejectWithValue }) => {
    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const result = await permissionManager.checkPermission('microphone');

      return {
        status: result.status as PermissionStatus['status'],
        canAskAgain: result.canAskAgain,
        fromCache: result.metadata.source === 'cache',
      };
    } catch (error) {
      return rejectWithValue(`Microphone permission check failed: ${error}`);
    }
  }
);

export const checkCameraAndMicrophonePermissions = createAsyncThunk<
  {
    status: PermissionStatus['status'];
    cameraGranted: boolean;
    microphoneGranted: boolean;
    canAskAgain: boolean;
    fromCache: boolean;
  },
  void,
  { rejectValue: string }
>('permissions/checkCameraAndMicrophone', async (_, { rejectWithValue }) => {
  try {
    const permissionManager = ConsolidatedPermissionManager.getInstance();

    // Use the combined camera+microphone permission check from ConsolidatedPermissionManager
    const result = await permissionManager.checkPermission('camera+microphone');

    return {
      status: result.status as PermissionStatus['status'],
      cameraGranted: result.status === 'granted',
      microphoneGranted: result.status === 'granted', // Combined permission - both are required
      canAskAgain: result.canAskAgain,
      fromCache: result.metadata.source === 'cache',
    };
  } catch (error) {
    return rejectWithValue(`Camera and microphone permission check failed: ${error}`);
  }
});

export const requestCameraPermission = createAsyncThunk(
  'permissions/requestCamera',
  async (_, { rejectWithValue }) => {
    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const result = await permissionManager.requestPermission('camera', {
        feature: 'camera-access',
        priority: 'important',
        userInitiated: true,
        fallbackStrategy: {
          mode: 'alternative',
          description: 'Some features may be limited without camera access',
          limitations: ['No photo capture', 'No video calls'],
          alternativeApproach: 'audio-only',
        },
      });

      return {
        status: result.status as PermissionStatus['status'],
        canAskAgain: result.canAskAgain,
      };
    } catch (error) {
      return rejectWithValue(`Camera permission request failed: ${error}`);
    }
  }
);

export const requestMicrophonePermission = createAsyncThunk(
  'permissions/requestMicrophone',
  async (_, { rejectWithValue }) => {
    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const result = await permissionManager.requestPermission('microphone', {
        feature: 'microphone-access',
        priority: 'important',
        userInitiated: true,
        fallbackStrategy: {
          mode: 'alternative',
          description: 'Some features may be limited without microphone access',
          limitations: ['No audio recording', 'No voice calls'],
          alternativeApproach: 'text-only',
        },
      });

      return {
        status: result.status as PermissionStatus['status'],
        canAskAgain: result.canAskAgain,
      };
    } catch (error) {
      return rejectWithValue(`Microphone permission request failed: ${error}`);
    }
  }
);

export const requestCameraAndMicrophonePermissions = createAsyncThunk<
  {
    status: PermissionStatus['status'];
    cameraGranted: boolean;
    microphoneGranted: boolean;
    canAskAgain: boolean;
    fromCache?: boolean;
  },
  void,
  { rejectValue: string }
>('permissions/requestCameraAndMicrophone', async (_, { rejectWithValue, getState }) => {
  try {
    // Avoid unnecessary OS dialogs
    const state = getState() as { permissions: PermissionState };
    const { camera, microphone } = state.permissions;

    const needsCamera = camera.status !== 'granted';
    const needsMicrophone = microphone.status !== 'granted';

    if (!needsCamera && !needsMicrophone) {
      return {
        status: 'granted',
        cameraGranted: true,
        microphoneGranted: true,
        canAskAgain: true,
        fromCache: true,
      };
    }

    // Use ConsolidatedPermissionManager for unified permission requests
    const permissionManager = ConsolidatedPermissionManager.getInstance();
    const result = await permissionManager.requestPermission('camera+microphone', {
      feature: 'video-call',
      priority: 'critical',
      userInitiated: true,
      fallbackStrategy: {
        mode: 'alternative',
        description: 'Audio-only call available',
        limitations: ['No video'],
        alternativeApproach: 'audio-only',
      },
    });

    return {
      status: result.status as PermissionStatus['status'],
      cameraGranted: result.status === 'granted',
      microphoneGranted: result.status === 'granted', // Combined permission
      canAskAgain: result.canAskAgain,
      fromCache: result.metadata.source === 'cache',
    };
  } catch (error) {
    return rejectWithValue(`Camera/microphone permission request failed: ${error}`);
  }
});

// Initialize permissions on app start
export const initializePermissions = createAsyncThunk(
  'permissions/initialize',
  async (_, { dispatch }) => {
    try {
      console.log('🔐 Initializing permission system...');

      // Initialize ConsolidatedPermissionManager
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      await permissionManager.initialize();

      // Check essential permissions in parallel for performance
      await Promise.allSettled([
        dispatch(checkCameraAndMicrophonePermissions()),
        // Add health permission check when implemented
      ]);

      console.log('🔐 Permission system initialized');
      return true;
    } catch (error) {
      console.error('Permission system initialization failed:', error);
      throw error;
    }
  }
);

// Handle app state changes for permission revalidation
export const handleAppStateChange = createAsyncThunk(
  'permissions/handleAppStateChange',
  async (appState: string, { dispatch, getState }) => {
    // Import permission dialog manager to check if permission dialog is active
    const { default: PermissionDialogStateManager } = await import(
      '../../utils/PermissionDialogStateManager'
    );
    const permissionDialogManager = PermissionDialogStateManager.getInstance();

    // ✅ CRITICAL FIX: Skip permission revalidation if permission dialog is active
    if (permissionDialogManager.shouldIgnoreAppStateChange(appState as any)) {
      console.log('🔐 Skipping permission revalidation - permission dialog active');
      return { appState, timestamp: Date.now(), skipped: true };
    }

    if (appState === 'active') {
      const state = getState() as { permissions: PermissionState };
      const shouldRevalidate = Date.now() - state.permissions.lastAppStateChange > 30000; // 30 seconds

      if (shouldRevalidate) {
        console.log('🔐 App became active, revalidating permissions...');

        // Additional safety check before revalidation
        if (!permissionDialogManager.isPermissionDialogActive()) {
          // Revalidate permissions after app becomes active
          await dispatch(checkCameraAndMicrophonePermissions());
        } else {
          console.log('🔐 Skipping permission revalidation - dialog still active');
        }
      }
    }

    return { appState, timestamp: Date.now(), skipped: false };
  }
);

// ✅ TELECONSULTATION: Enhanced async thunks for medical permission scenarios

export const requestTeleconsultationVideoPermission = createAsyncThunk(
  'permissions/requestTeleconsultationVideo',
  async (context: { doctorName?: string; consultationType?: string } = {}, { rejectWithValue }) => {
    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const result = await permissionManager.requestPermission('teleconsultation-video', {
        feature: 'teleconsultation-video',
        priority: 'critical',
        userInitiated: true,
        medicalContext: {
          consultationType: (context.consultationType as any) || 'routine',
          doctorName: context.doctorName,
          appointmentTime: new Date(),
          riskLevel: 'medium',
        },
        educationalContent: {
          title: 'Video Consultation Permissions',
          description: `Enable camera and microphone access for video consultations${context.doctorName ? ` with ${context.doctorName}` : ''}.`,
          benefits: [
            'High-quality video consultations',
            'Better diagnostic accuracy',
            'Real-time visual assessment',
            'Enhanced doctor-patient communication',
          ],
          medicalNecessity:
            'Camera and microphone access are essential for comprehensive video consultations',
          dataUsage: 'Audio and video data is processed in real-time and not permanently stored',
          retentionPolicy: 'Call recordings (if enabled) follow medical data retention guidelines',
        },
        fallbackStrategy: {
          mode: 'alternative',
          description: 'Audio-only consultation available',
          limitations: ['No video feed', 'Limited visual assessment'],
          alternativeApproach: 'Switch to audio-only consultation',
        },
      });

      return {
        status: result.status as PermissionStatus['status'],
        canAskAgain: result.canAskAgain,
        capabilities: result.message ? [result.message] : [],
        degradationPath: result.degradationPath?.description || 'unknown',
      };
    } catch (error) {
      return rejectWithValue(`Teleconsultation video permission failed: ${error}`);
    }
  }
);

export const requestTeleconsultationAudioPermission = createAsyncThunk(
  'permissions/requestTeleconsultationAudio',
  async (context: { doctorName?: string; consultationType?: string } = {}, { rejectWithValue }) => {
    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const result = await permissionManager.requestPermission('teleconsultation-audio', {
        feature: 'teleconsultation-audio',
        priority: 'critical',
        userInitiated: true,
        medicalContext: {
          consultationType: (context.consultationType as any) || 'routine',
          doctorName: context.doctorName,
          appointmentTime: new Date(),
          riskLevel: 'low',
        },
        educationalContent: {
          title: 'Audio Consultation Permissions',
          description: `Enable microphone access for audio consultations${context.doctorName ? ` with ${context.doctorName}` : ''}.`,
          benefits: [
            'Clear audio communication',
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

      return {
        status: result.status as PermissionStatus['status'],
        canAskAgain: result.canAskAgain,
        capabilities: result.message ? [result.message] : [],
      };
    } catch (error) {
      return rejectWithValue(`Teleconsultation audio permission failed: ${error}`);
    }
  }
);

export const requestEmergencyCallPermission = createAsyncThunk(
  'permissions/requestEmergencyCall',
  async (context: { emergencyType?: string } = {}, { rejectWithValue }) => {
    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const result = await permissionManager.requestPermission('emergency-call', {
        feature: 'emergency-call',
        priority: 'critical',
        userInitiated: true,
        medicalContext: {
          consultationType: 'emergency',
          riskLevel: 'high',
        },
        educationalContent: {
          title: 'Emergency Call Permissions',
          description:
            'Enable camera, microphone, and location access for emergency medical consultations.',
          benefits: [
            'Immediate video/audio communication',
            'Location sharing for emergency services',
            'Real-time emergency assessment',
            'Faster response times',
          ],
          medicalNecessity: 'Full device access is critical for emergency medical situations',
          dataUsage: 'Emergency data is shared with medical professionals for immediate care',
          retentionPolicy: 'Emergency call data follows medical emergency protocols',
        },
        fallbackStrategy: {
          mode: 'limited',
          description: 'Limited emergency call features',
          limitations: ['Reduced emergency capabilities'],
          alternativeApproach: 'Contact emergency services directly',
        },
      });

      return {
        status: result.status as PermissionStatus['status'],
        canAskAgain: result.canAskAgain,
        capabilities: result.degradationPath?.limitations || [],
        emergencyFeatures: result.message ? [result.message] : [],
      };
    } catch (error) {
      return rejectWithValue(`Emergency call permission failed: ${error}`);
    }
  }
);

export const requestHealthMonitoringPermission = createAsyncThunk(
  'permissions/requestHealthMonitoring',
  async (_, { rejectWithValue }) => {
    try {
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      const result = await permissionManager.requestPermission('health-monitoring', {
        feature: 'health-monitoring',
        priority: 'important',
        userInitiated: true,
        medicalContext: {
          consultationType: 'routine',
          riskLevel: 'low',
        },
        educationalContent: {
          title: 'Health Monitoring Permissions',
          description:
            'Enable health data and notification access for continuous health monitoring.',
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

      return {
        status: result.status as PermissionStatus['status'],
        canAskAgain: result.canAskAgain,
        monitoringActive: result.status === 'granted',
        alertsEnabled: result.message?.includes('notifications') || false,
      };
    } catch (error) {
      return rejectWithValue(`Health monitoring permission failed: ${error}`);
    }
  }
);

const permissionSlice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {
    resetPermissionFailures: state => {
      state.consecutiveFailures = 0;
    },
    invalidatePermissionCache: (state, action: PayloadAction<PermissionType>) => {
      const permissionType = action.payload;

      // Reset the specific permission state
      switch (permissionType) {
        case 'camera':
          state.camera = { ...initialPermissionStatus };
          break;
        case 'microphone':
          state.microphone = { ...initialPermissionStatus };
          break;
        case 'camera+microphone':
          state.cameraAndMicrophone = { ...initialPermissionStatus };
          break;
        case 'health':
          state.health = { ...initialPermissionStatus, grantedTypes: [], availableTypes: [] };
          break;
      }

      // Invalidate cache using ConsolidatedPermissionManager
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      try {
        if (
          permissionType === 'camera' ||
          permissionType === 'microphone' ||
          permissionType === 'camera+microphone'
        ) {
          permissionManager.invalidatePermission(permissionType as PermissionType);
        }
      } catch (error) {
        console.warn('Failed to invalidate cache:', error);
      }
    },
    clearAllPermissions: state => {
      Object.assign(state, initialState);
      const permissionManager = ConsolidatedPermissionManager.getInstance();
      try {
        // Invalidate core permission types
        const corePermissions: PermissionType[] = ['camera', 'microphone', 'camera+microphone'];
        corePermissions.forEach(permType => {
          permissionManager.invalidatePermission(permType);
        });
      } catch (error) {
        console.warn('Failed to clear permissions cache:', error);
      }
    },
  },
  extraReducers: builder => {
    // Camera permission
    builder
      .addCase(checkCameraPermission.pending, (state, action) => {
        state.camera.isChecking = true;
        state.camera.error = undefined;
        state.lastRequestIds.camera = action.meta.requestId;
      })
      .addCase(checkCameraPermission.fulfilled, (state, action) => {
        if (state.lastRequestIds.camera && action.meta.requestId !== state.lastRequestIds.camera)
          return; // stale result
        state.camera.isChecking = false;
        state.camera.status = action.payload.status as PermissionStatus['status'];
        state.camera.lastChecked = Date.now();
        state.camera.canAskAgain = action.payload.canAskAgain;
        state.consecutiveFailures = 0;
        // Derive combined status whenever either individual updates
        if (state.microphone.status !== 'unknown') {
          state.cameraAndMicrophone.status =
            state.camera.status === 'granted' && state.microphone.status === 'granted'
              ? 'granted'
              : 'denied';
          state.cameraAndMicrophone.lastChecked = Date.now();
        }
      })
      .addCase(checkCameraPermission.rejected, (state, action) => {
        state.camera.isChecking = false;
        state.camera.error = action.payload as string;
        state.consecutiveFailures += 1;
      });

    // Microphone permission
    builder
      .addCase(checkMicrophonePermission.pending, (state, action) => {
        state.microphone.isChecking = true;
        state.microphone.error = undefined;
        state.lastRequestIds.microphone = action.meta.requestId;
      })
      .addCase(checkMicrophonePermission.fulfilled, (state, action) => {
        if (
          state.lastRequestIds.microphone &&
          action.meta.requestId !== state.lastRequestIds.microphone
        )
          return;
        state.microphone.isChecking = false;
        state.microphone.status = action.payload.status as PermissionStatus['status'];
        state.microphone.lastChecked = Date.now();
        state.microphone.canAskAgain = action.payload.canAskAgain;
        state.consecutiveFailures = 0;
        if (state.camera.status !== 'unknown') {
          state.cameraAndMicrophone.status =
            state.camera.status === 'granted' && state.microphone.status === 'granted'
              ? 'granted'
              : 'denied';
          state.cameraAndMicrophone.lastChecked = Date.now();
        }
      })
      .addCase(checkMicrophonePermission.rejected, (state, action) => {
        state.microphone.isChecking = false;
        state.microphone.error = action.payload as string;
        state.consecutiveFailures += 1;
      });

    // Combined camera and microphone
    builder
      .addCase(checkCameraAndMicrophonePermissions.pending, (state, action) => {
        state.cameraAndMicrophone.isChecking = true;
        state.cameraAndMicrophone.error = undefined;
        state.lastRequestIds.combined = action.meta.requestId;
      })
      .addCase(checkCameraAndMicrophonePermissions.fulfilled, (state, action) => {
        if (
          state.lastRequestIds.combined &&
          action.meta.requestId !== state.lastRequestIds.combined
        )
          return;
        const timestamp = Date.now();

        state.cameraAndMicrophone.isChecking = false;
        state.cameraAndMicrophone.status = action.payload.status as PermissionStatus['status'];
        state.cameraAndMicrophone.lastChecked = timestamp;
        state.cameraAndMicrophone.canAskAgain = action.payload.canAskAgain;

        // Update individual permissions too if not from cache
        if (!action.payload.fromCache) {
          state.camera.status = action.payload.cameraGranted ? 'granted' : 'denied';
          state.camera.lastChecked = timestamp;
          state.microphone.status = action.payload.microphoneGranted ? 'granted' : 'denied';
          state.microphone.lastChecked = timestamp;
        }

        state.consecutiveFailures = 0;
      })
      .addCase(checkCameraAndMicrophonePermissions.rejected, (state, action) => {
        state.cameraAndMicrophone.isChecking = false;
        state.cameraAndMicrophone.error = action.payload as string;
        state.consecutiveFailures += 1;
      });

    // Permission requests
    builder
      .addCase(requestCameraPermission.fulfilled, (state, action) => {
        state.camera.status = action.payload.status;
        state.camera.lastChecked = Date.now();
        state.camera.canAskAgain = action.payload.canAskAgain;
        state.camera.isChecking = false;
        if (state.microphone.status !== 'unknown') {
          state.cameraAndMicrophone.status =
            state.camera.status === 'granted' && state.microphone.status === 'granted'
              ? 'granted'
              : 'denied';
          state.cameraAndMicrophone.lastChecked = Date.now();
        }
      })
      .addCase(requestMicrophonePermission.fulfilled, (state, action) => {
        state.microphone.status = action.payload.status;
        state.microphone.lastChecked = Date.now();
        state.microphone.canAskAgain = action.payload.canAskAgain;
        state.microphone.isChecking = false;
        if (state.camera.status !== 'unknown') {
          state.cameraAndMicrophone.status =
            state.camera.status === 'granted' && state.microphone.status === 'granted'
              ? 'granted'
              : 'denied';
          state.cameraAndMicrophone.lastChecked = Date.now();
        }
      })
      .addCase(requestCameraAndMicrophonePermissions.fulfilled, (state, action) => {
        const timestamp = Date.now();

        state.cameraAndMicrophone.status = action.payload.status as PermissionStatus['status'];
        state.cameraAndMicrophone.lastChecked = timestamp;
        state.cameraAndMicrophone.canAskAgain = action.payload.canAskAgain;
        state.cameraAndMicrophone.isChecking = false;

        state.camera.status = action.payload.cameraGranted ? 'granted' : 'denied';
        state.camera.lastChecked = timestamp;
        state.microphone.status = action.payload.microphoneGranted ? 'granted' : 'denied';
        state.microphone.lastChecked = timestamp;
      });

    // System initialization
    builder
      .addCase(initializePermissions.fulfilled, state => {
        state.isInitialized = true;
      })
      .addCase(handleAppStateChange.fulfilled, (state, action) => {
        state.lastAppStateChange = action.payload.timestamp;
      });
  },
});

export const { resetPermissionFailures, invalidatePermissionCache, clearAllPermissions } =
  permissionSlice.actions;

export default permissionSlice.reducer;

// Selectors for efficient component access
export const selectPermissions = (state: { permissions: PermissionState }) => state.permissions;
export const selectCameraPermission = (state: { permissions: PermissionState }) =>
  state.permissions.camera;
export const selectMicrophonePermission = (state: { permissions: PermissionState }) =>
  state.permissions.microphone;
export const selectCameraAndMicrophonePermission = (state: { permissions: PermissionState }) =>
  state.permissions.cameraAndMicrophone;
export const selectIsPermissionSystemReady = (state: { permissions: PermissionState }) =>
  state.permissions.isInitialized && state.permissions.consecutiveFailures < 3;

// Helper selectors for permission rationale and blocking
export const isPermissionBlocked = (p: PermissionStatus) =>
  p.status === 'denied' && p.canAskAgain === false;
export const selectIsCameraBlocked = (state: { permissions: PermissionState }) =>
  isPermissionBlocked(state.permissions.camera);
export const selectIsMicrophoneBlocked = (state: { permissions: PermissionState }) =>
  isPermissionBlocked(state.permissions.microphone);
export const needsRationale = (p: PermissionStatus) =>
  p.status === 'denied' && p.canAskAgain === true;
export const selectCameraNeedsRationale = (state: { permissions: PermissionState }) =>
  needsRationale(state.permissions.camera);
export const selectMicrophoneNeedsRationale = (state: { permissions: PermissionState }) =>
  needsRationale(state.permissions.microphone);
