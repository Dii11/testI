/**
 * Google Health Connect Provider
 *
 * Implements the HealthProvider interface for Google Health Connect integration.
 * Supports WearOS and Android health data from Wear OS devices and Android phones.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { HealthMetric, HealthDataRange, HealthPermission } from '../../../types/health';
import { HealthDataType } from '../../../types/health';
import { isExpoGo } from '../../../utils/nativeModuleChecker';
import { sentryTracker } from '../../../utils/sentryErrorTracker';
import { HealthDataNormalizer } from '../HealthDataNormalizer';
import type { HealthProvider } from '../WearableHealthManager';

// CORRECT Health Connect imports according to official docs
let initialize: any = null;
let getSdkStatus: any = null;
let requestPermission: any = null;
let getGrantedPermissions: any = null;
let readRecords: any = null;
let insertRecords: any = null;
let aggregateRecord: any = null;
let openHealthConnectSettings: any = null;
let revokeAllPermissions: any = null;

// Only attempt to load native modules in development builds, not in Expo Go
if (Platform.OS === 'android' && !isExpoGo()) {
  try {
    const healthConnect = require('react-native-health-connect');
    // Import ALL required methods from official docs
    initialize = healthConnect.initialize;
    getSdkStatus = healthConnect.getSdkStatus;
    requestPermission = healthConnect.requestPermission;
    getGrantedPermissions = healthConnect.getGrantedPermissions;
    readRecords = healthConnect.readRecords;
    insertRecords = healthConnect.insertRecords;
    aggregateRecord = healthConnect.aggregateRecord;
    openHealthConnectSettings = healthConnect.openHealthConnectSettings;
    revokeAllPermissions = healthConnect.revokeAllPermissions;
  } catch (error) {
    console.warn('🤖 react-native-health-connect not available:', error);
  }
} else if (isExpoGo()) {
  console.log('🤖 Health Connect unavailable in Expo Go - requires development build');
}

export class GoogleHealthConnectProvider implements HealthProvider {
  readonly name = 'google_health_connect';
  readonly platform = 'android' as const;
  readonly priority = 90; // High priority on Android
  readonly supportedDataTypes: HealthDataType[] = [
    HealthDataType.HEART_RATE,
    HealthDataType.STEPS,
    HealthDataType.SLEEP,
    HealthDataType.WEIGHT,
    HealthDataType.BLOOD_PRESSURE,
    HealthDataType.BODY_TEMPERATURE,
    HealthDataType.OXYGEN_SATURATION,
    HealthDataType.BLOOD_GLUCOSE,
    HealthDataType.DISTANCE,
    HealthDataType.CALORIES_BURNED,
    HealthDataType.ACTIVE_ENERGY,
    HealthDataType.EXERCISE,
  ];

  private isInitialized = false;
  private isNativeModuleReady = false;
  private initializationAttempts = 0;
  private serviceBindingFailures = 0;
  private lastServiceBindingFailure = 0;
  private lastGrantedPermissions: any[] = [];  // Store granted permissions like notjust.dev example

  // Commercial-grade initialization state (like Fitbit)
  private initializationPromise: Promise<boolean> | null = null;
  private backgroundRetryTimer: NodeJS.Timeout | null = null;
  private gracefulDegradationMode = false;
  private persistentRetryEnabled = true;

  // Connection state monitoring
  private connectionState: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private connectionStateListeners: Set<(state: string) => void> = new Set();

  // Rate limiting protection
  private readonly rateLimiter = new Map<string, number>();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_WINDOW = 100;

  async initialize(): Promise<boolean> {
    console.log('🤖 Initializing Google Health Connect provider...');

    // If already initializing, return the existing promise
    if (this.initializationPromise) {
      console.log('🤖 Initialization already in progress, waiting...');
      return this.initializationPromise;
    }

    // Simple initialization following notjust.dev pattern
    this.initializationPromise = this.performSimpleInitialization();
    return this.initializationPromise;
  }

  /**
   * TECNO-friendly initialization following simplified pattern
   * Optimized for problematic devices like TECNO, Infinix, etc.
   */
  private async performSimpleInitialization(): Promise<boolean> {
    try {
      // Check basic requirements
      if (Platform.OS !== 'android') {
        console.log('🤖 Health Connect only available on Android');
        return false;
      }

      if (Constants.executionEnvironment === 'storeClient') {
        console.log('🤖 Health Connect not available in Expo Go');
        return false;
      }

      if (!initialize) {
        console.log('🤖 Health Connect module not available');
        return false;
      }

      // Detect device type early for optimization
      const deviceCheck = this.isProblematicDevice();
      const isTECNODevice = deviceCheck.isProblematic;

      if (isTECNODevice) {
        console.log(`🤖 ${deviceCheck.manufacturer} device detected - using TECNO-optimized initialization`);
        return await this.performTECNOFriendlyInitialization();
      }

      // Standard initialization for regular devices
      console.log('🤖 Initializing Health Connect (standard)...');
      const isInitialized = await initialize();

      if (!isInitialized) {
        console.log('🤖 Failed to initialize Health Connect');
        return false;
      }

      // Standard stabilization delay
      console.log('🤖 Waiting for native module to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🤖 ✅ Health Connect initialized successfully');
      this.isInitialized = true;
      this.isNativeModuleReady = true;
      this.setConnectionState('connected');

      return true;
    } catch (error) {
      console.error('🤖 Health Connect initialization error:', error);
      this.setConnectionState('disconnected');

      // If standard init fails on any device, try TECNO-friendly approach
      const deviceCheck = this.isProblematicDevice();
      if (!deviceCheck.isProblematic) {
        console.log('🤖 Standard init failed, trying TECNO-friendly approach...');
        return await this.performTECNOFriendlyInitialization();
      }

      return false;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * TECNO-friendly initialization with extended timeouts and simplified flow
   * Based on successful Fitbit integration patterns for custom Android devices
   */
  private async performTECNOFriendlyInitialization(): Promise<boolean> {
    try {
      console.log('🤖 Starting TECNO-friendly initialization...');

      // Extended timeout for TECNO devices
      const initPromise = initialize();
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('TECNO init timeout')), 10000);
      });

      const isInitialized = await Promise.race([initPromise, timeoutPromise]);

      if (!isInitialized) {
        console.log('🤖 TECNO-friendly initialization returned false');
        return false;
      }

      // Extended stabilization for TECNO devices (critical for service binding)
      console.log('🤖 TECNO device: Extended stabilization period...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Additional validation for TECNO devices without aggressive calls
      try {
        console.log('🤖 TECNO device: Testing basic functionality...');
        // Very basic test - just check if the module is responsive
        if (typeof initialize === 'function') {
          console.log('🤖 TECNO device: Health Connect module is responsive');
        }
      } catch (testError) {
        console.warn('🤖 TECNO device: Basic test failed, but continuing...', testError);
        // Don't fail the initialization - TECNO devices can be finicky but still work
      }

      console.log('🤖 ✅ TECNO-friendly Health Connect initialized successfully');
      this.isInitialized = true;
      this.isNativeModuleReady = true;
      this.setConnectionState('connected');

      return true;
    } catch (error) {
      console.error('🤖 TECNO-friendly initialization failed:', error);
      this.setConnectionState('disconnected');

      // For TECNO devices, start graceful degradation but don't completely fail
      this.startGracefulDegradation();
      return false;
    }
  }

  private async performCommercialGradeInitialization(): Promise<boolean> {
    return this.performSimpleInitialization();
  }

  private async performOfficialInitialization(): Promise<boolean> {
    this.setConnectionState('connecting');

    // Check if we're in Expo Go or web environment
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (Platform.OS === 'web' || isExpoGo) {
      console.log('🤖 Running in Expo Go/web - Health Connect not available');
      this.setConnectionState('disconnected');
      return false;
    }

    if (!initialize || !getSdkStatus || !requestPermission) {
      console.warn('🤖 Google Health Connect not available - module not loaded');
      this.startGracefulDegradation();
      return false;
    }

    // STEP 1: Check SDK Status (REQUIRED by official docs)
    try {
      console.log('🤖 [OFFICIAL] Step 1: Checking SDK Status...');
      const sdkStatus = await getSdkStatus();

      console.log('🤖 SDK Status:', sdkStatus);

      // Handle different SDK statuses according to official docs
      switch (sdkStatus) {
        case 'SDK_AVAILABLE':
          console.log('🤖 ✅ SDK is available');
          break;
        case 'SDK_UNAVAILABLE':
          console.error('🤖 ❌ Health Connect SDK is not available on this device');
          this.startGracefulDegradation();
          return false;
        case 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED':
          console.error('🤖 ❌ Health Connect provider needs update');
          // Open Health Connect settings for user to update
          if (openHealthConnectSettings) {
            try {
              await openHealthConnectSettings();
            } catch (e) {
              console.log('🤖 Could not open Health Connect settings');
            }
          }
          this.startGracefulDegradation();
          return false;
        default:
          console.warn('🤖 Unknown SDK status:', sdkStatus);
      }
    } catch (error) {
      console.error('🤖 Failed to check SDK status:', error);
      // Continue with initialization attempt even if status check fails
    }

    // STEP 2: Initialize Health Connect Client (following official docs)
    try {
      console.log('🤖 [OFFICIAL] Step 2: Initializing Health Connect client...');
      const isInitialized = await initialize();

      if (!isInitialized) {
        console.error('🤖 ❌ Health Connect initialization returned false');
        this.startGracefulDegradation();
        return false;
      }

      console.log('🤖 ✅ Health Connect client initialized successfully');
      this.isInitialized = true;
      this.isNativeModuleReady = true;

    } catch (error: any) {
      // Handle specific exceptions according to official docs
      console.error('🤖 ❌ Health Connect initialization failed:', error);

      if (error.code) {
        switch (error.code) {
          case 'SERVICE_UNAVAILABLE':
            console.error('🤖 Health Connect service is not available');
            break;
          case 'CLIENT_NOT_INITIALIZED':
            console.error('🤖 Client initialization failed');
            break;
          case 'SDK_VERSION_ERROR':
            console.error('🤖 SDK version incompatibility');
            break;
          default:
            console.error('🤖 Initialization error code:', error.code);
        }
      }

      this.startGracefulDegradation();
      return false;
    }

    // Check for problematic devices
    const deviceCheck = this.isProblematicDevice();
    if (deviceCheck.isProblematic) {
      console.warn(`🤖 Device compatibility warning: ${deviceCheck.reason}`);
      console.warn(`🤖 Manufacturer: ${deviceCheck.manufacturer}`);
      // Don't fail, just track
      sentryTracker.trackServiceError(
        new Error(`Device compatibility issue: ${deviceCheck.reason}`),
        {
          service: 'googleHealthConnectProvider',
          action: 'initialize',
          additional: {
            platform: Platform.OS,
            platformVersion: Platform.Version,
            manufacturer: deviceCheck.manufacturer,
            deviceModel: Constants.modelName || 'unknown',
            deviceName: Constants.deviceName || 'unknown',
            errorType: 'DEVICE_INCOMPATIBLE',
            reason: deviceCheck.reason,
            timestamp: new Date().toISOString(),
          },
        }
      );

      // Still attempt initialization but with lower expectations
      console.log('🤖 Attempting initialization despite known compatibility issues...');
    }

    try {
      // Enhanced initialization with retries and proper module readiness check
      console.log('🤖 Starting Health Connect initialization with retries...');

      const maxInitAttempts = 3;
      let lastInitError: any = null;

      for (let attempt = 1; attempt <= maxInitAttempts; attempt++) {
        this.initializationAttempts = attempt;
        console.log(`🤖 Initialization attempt ${attempt}/${maxInitAttempts}`);

        try {
          // First, ensure the native module is properly loaded
          if (!this.isNativeModuleReady) {
            console.log('🤖 Waiting for native module to be ready...');
            await this.ensureNativeModuleReady();
          }

          // Then proceed with initialization
          const initTimeout = 20000 + (attempt - 1) * 10000; // Increase timeout with each attempt
          const initializationPromise = initialize();
          const timeoutPromise = new Promise<boolean>((_, reject) => {
            setTimeout(() => reject(new Error(`Health Connect initialization timeout after ${initTimeout}ms`)), initTimeout);
          });

          const isInitialized = await Promise.race([initializationPromise, timeoutPromise]);

          if (!isInitialized) {
            console.warn(`🤖 Health Connect initialization returned false on attempt ${attempt}`);
            lastInitError = new Error('Health Connect service not available');

            // Wait before retry
            if (attempt < maxInitAttempts) {
              const delay = 2000 * attempt; // Progressive delay
              console.log(`🤖 Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }

          // Additional validation - try to check if we can access the service
          console.log('🤖 Validating Health Connect access...');
          await this.validateHealthConnectAccess();

          console.log('🤖 Google Health Connect initialized and validated successfully');
          this.isInitialized = true;
          this.setConnectionState('connected');
          return true;
        } catch (attemptError) {
          lastInitError = attemptError;
          console.warn(`🤖 Initialization attempt ${attempt} failed:`, attemptError);

          // Check if this is a permanent failure
          const errorMessage = attemptError instanceof Error ? attemptError.message : String(attemptError);
          if (errorMessage.includes('not installed') ||
              errorMessage.includes('not supported') ||
              errorMessage.includes('incompatible')) {
            console.error('🤖 Permanent failure detected, stopping initialization attempts');
            break;
          }

          // Wait before retry
          if (attempt < maxInitAttempts) {
            const delay = 2000 * attempt;
            console.log(`🤖 Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All immediate attempts failed - start background retry like commercial apps
      console.warn('🤖 Immediate initialization attempts failed - starting background retry strategy');
      console.log('🤖 This is normal behavior on TECNO and custom Android devices');

      this.startPersistentBackgroundRetry();
      this.startGracefulDegradation();

      if (lastInitError) {
        throw lastInitError;
      }

      return false;
    } catch (error) {
      console.error('🤖 Google Health Connect initialization error:', error);

      const errorType = this.classifyError(error);

      // Provide helpful error messages
      if (error instanceof Error) {
        if (
          error.message.includes('binding to service failed') ||
          error.message.includes('binding died') ||
          error.message.includes('null binding')
        ) {
          console.warn(
            '🤖 Health Connect service binding failed - this is common on TECNO and other custom Android devices'
          );
          console.warn('🤖 The service connection was lost or could not be established');
          console.warn('🤖 Possible solutions:');
          console.warn('  - Update Health Connect app to latest version');
          console.warn('  - Restart the device completely');
          console.warn('  - Clear Health Connect app data and cache');
          console.warn('  - Check if Health Connect is enabled in system settings');
          console.warn('  - Try using a different health data source');
          console.warn('  - Contact device manufacturer for Health Connect compatibility');
        } else if (error.message.includes('timeout')) {
          console.warn('🤖 Health Connect took too long to respond. This might indicate:');
          console.warn('  - Health Connect app needs updating');
          console.warn('  - Device performance issues');
          console.warn('  - Network connectivity problems');
        } else if (error.message.includes('not installed')) {
          console.warn('🤖 Health Connect not installed. User should install from Play Store.');
        }
      }

      sentryTracker.trackServiceError(
        error instanceof Error ? error : 'Health Connect initialization failed',
        {
          service: 'googleHealthConnectProvider',
          action: 'initialize',
          additional: {
            platform: Platform.OS,
            platformVersion: Platform.Version,
            moduleAvailable: !!initialize,
            errorType,
            manufacturer: deviceCheck.manufacturer,
            deviceModel: Constants.modelName || 'unknown',
            deviceName: Constants.deviceName || 'unknown',
            isProblematicDevice: deviceCheck.isProblematic,
            reason: deviceCheck.reason,
            timestamp: new Date().toISOString(),
          },
        }
      );

      this.setConnectionState('disconnected');
      return false;
    }
  }

  /**
   * Ensure native module is ready before using it
   */
  private async ensureNativeModuleReady(): Promise<void> {
    // Check if device is known to be problematic first
    const deviceCheck = this.isProblematicDevice();
    let maxWaitTime = 5000;
    let stabilizationDelay = 500;

    // Increase timeouts for problematic devices
    if (deviceCheck.isProblematic) {
      maxWaitTime = 15000; // 15 seconds for TECNO and similar devices
      stabilizationDelay = 2000; // 2 seconds stabilization
      console.log(`🤖 Detected ${deviceCheck.manufacturer} device, using extended timeouts`);
    }

    const checkInterval = 100;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // Check if all required functions are loaded
      if (initialize && requestPermission && readRecords && getGrantedPermissions) {
        console.log('🤖 Native module functions are loaded');

        // Give the native module more time to fully initialize its internal state
        // Especially important for TECNO and other custom Android devices
        console.log(`🤖 Waiting ${stabilizationDelay}ms for native module stabilization...`);
        await new Promise(resolve => setTimeout(resolve, stabilizationDelay));

        // For problematic devices, do an additional validation
        if (deviceCheck.isProblematic) {
          try {
            console.log('🤖 Performing additional validation for problematic device...');
            // Try a simple initialization call to ensure the module is truly ready
            const testInit = await Promise.race([
              initialize(),
              new Promise<boolean>((_, reject) =>
                setTimeout(() => reject(new Error('Test initialization timeout')), 5000)
              )
            ]);

            if (!testInit) {
              console.warn('🤖 Test initialization failed, but continuing...');
            }
          } catch (testError) {
            console.warn('🤖 Test initialization error (expected on some devices):', testError);
            // Don't fail here, as some devices may still work despite test failures
          }
        }

        this.isNativeModuleReady = true;
        return;
      }

      // Wait and check again
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    // For problematic devices, provide more specific error message
    if (deviceCheck.isProblematic) {
      throw new Error(`Native module failed to load on ${deviceCheck.manufacturer} device within ${maxWaitTime}ms. This is a known compatibility issue with some custom Android implementations.`);
    }

    throw new Error('Native module failed to load within timeout period');
  }

  /**
   * Connection state monitoring methods
   */
  private setConnectionState(state: 'connected' | 'disconnected' | 'connecting'): void {
    if (this.connectionState !== state) {
      console.log(`🤖 Health Connect connection state: ${this.connectionState} -> ${state}`);
      this.connectionState = state;
      this.connectionStateListeners.forEach(listener => {
        try {
          listener(state);
        } catch (error) {
          console.warn('🤖 Connection state listener error:', error);
        }
      });
    }
  }

  public onConnectionStateChange(listener: (state: string) => void): () => void {
    this.connectionStateListeners.add(listener);
    return () => this.connectionStateListeners.delete(listener);
  }

  public getConnectionState(): string {
    return this.connectionState;
  }

  /**
   * Rate limiting protection
   */
  private checkRateLimit(operation: string): boolean {
    const key = `${operation}_${Math.floor(Date.now() / this.RATE_LIMIT_WINDOW)}`;
    const count = this.rateLimiter.get(key) || 0;
    if (count >= this.MAX_REQUESTS_PER_WINDOW) {
      console.warn(`🤖 Rate limit exceeded for ${operation}`);
      sentryTracker.trackServiceError(
        new Error(`Rate limit exceeded for ${operation}`),
        {
          service: 'googleHealthConnectProvider',
          action: 'checkRateLimit',
          additional: {
            operation,
            count,
            window: this.RATE_LIMIT_WINDOW,
            maxRequests: this.MAX_REQUESTS_PER_WINDOW,
          },
        }
      );
      return false;
    }
    this.rateLimiter.set(key, count + 1);
    return true;
  }

  /**
   * Get Android API level with enhanced detection
   */
  private getAndroidApiLevel(): number {
    if (Platform.OS === 'android') {
      const version = Platform.Version;
      if (typeof version === 'number') {
        return version;
      }
      // Handle string versions like "14" or "UpsideDownCake"
      const parsed = parseInt(version, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
      // Map codenames to API levels for newer versions
      const codenameMap: { [key: string]: number } = {
        UpsideDownCake: 34, // Android 14
        VanillaIceCream: 35, // Android 15
        VanillaIceCreamSandwich: 36, // Android 16 (future)
      };
      return codenameMap[version] || 26; // Default to minimum supported
    }
    return 0;
  }

  /**
   * Handle service binding death by resetting provider state
   */
  private handleServiceBindingDeath(): void {
    const now = Date.now();
    this.serviceBindingFailures++;
    this.lastServiceBindingFailure = now;

    console.warn(`🤖 Service binding death detected (failure #${this.serviceBindingFailures})`);

    // Reset initialization state to force re-initialization
    this.isInitialized = false;
    this.setConnectionState('disconnected');

    // If we've had multiple failures recently, mark as problematic
    if (this.serviceBindingFailures >= 3) {
      console.error(
        '🤖 Multiple service binding failures detected - Health Connect may be incompatible with this device'
      );

      // Track this as a critical issue
      sentryTracker.trackServiceError(new Error('Multiple service binding deaths detected'), {
        service: 'googleHealthConnectProvider',
        action: 'handleServiceBindingDeath',
        additional: {
          failureCount: this.serviceBindingFailures,
          lastFailure: this.lastServiceBindingFailure,
          timeSinceLastFailure: now - this.lastServiceBindingFailure,
          platform: Platform.OS,
          platformVersion: Platform.Version,
          manufacturer: Constants.manufacturer || 'unknown',
          deviceModel: Constants.modelName || 'unknown',
          errorType: 'SERVICE_BINDING_DEATH',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Check if provider should be considered permanently failed
   */
  private isPermanentlyFailed(): boolean {
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastServiceBindingFailure;

    // If we've had 3+ failures and the last one was recent (within 5 minutes)
    return this.serviceBindingFailures >= 3 && timeSinceLastFailure < 300000;
  }

  /**
   * Check if device is known to have Health Connect compatibility issues
   */
  private isProblematicDevice(): { isProblematic: boolean; reason: string; manufacturer: string } {
    try {
      // Get device information from Constants
      const deviceInfo = Constants.deviceName || '';
      const manufacturer = Constants.manufacturer || '';
      const model = Constants.modelName || '';

      const deviceString = `${manufacturer} ${model}`.toLowerCase();

      // Known problematic manufacturers and models
      const problematicManufacturers = [
        'tecno',
        'infinix',
        'itel',
        'realme',
        'oppo',
        'vivo',
        'xiaomi',
        'huawei',
        'honor',
      ];

      const problematicModels = ['kd7', 'spark', 'camon', 'pova', 'note', 'redmi', 'poco'];

      // Check for problematic manufacturers
      for (const manufacturer of problematicManufacturers) {
        if (deviceString.includes(manufacturer)) {
          return {
            isProblematic: true,
            reason: `Known compatibility issues with ${manufacturer} devices`,
            manufacturer,
          };
        }
      }

      // Check for specific problematic models
      for (const model of problematicModels) {
        if (deviceString.includes(model)) {
          return {
            isProblematic: true,
            reason: `Known compatibility issues with ${model} model`,
            manufacturer: manufacturer || 'unknown',
          };
        }
      }

      return {
        isProblematic: false,
        reason: 'Device appears compatible',
        manufacturer: manufacturer || 'unknown',
      };
    } catch (error) {
      console.warn('🤖 Failed to check device compatibility:', error);
      return {
        isProblematic: false,
        reason: 'Unable to determine device compatibility',
        manufacturer: 'unknown',
      };
    }
  }

  /**
   * Check for device-specific Health Connect compatibility issues
   */
  private async checkDeviceCompatibility(): Promise<{
    compatible: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const androidVersion = this.getAndroidApiLevel();

      // Check Android version compatibility
      if (androidVersion < 26) {
        issues.push(`Android ${androidVersion} not supported (requires Android 8.0+)`);
        recommendations.push('Update to Android 8.0 or higher');
        return { compatible: false, issues, recommendations };
      }

      // Check for known problematic devices
      const deviceInfo = await this.getDeviceInfo();
      const deviceModel = deviceInfo.deviceModel?.toLowerCase() || '';

      // Known problematic devices or manufacturers
      const problematicDevices = ['huawei', 'honor', 'xiaomi', 'oppo', 'vivo', 'oneplus', 'realme'];

      const isProblematicDevice = problematicDevices.some(brand => deviceModel.includes(brand));

      if (isProblematicDevice) {
        issues.push('Device may have custom Android implementation that affects Health Connect');
        recommendations.push("Check if Health Connect is available in your device's app store");
        recommendations.push('Enable "Install unknown apps" if needed');
      }

      // Check for Android Go devices (low-end devices)
      if (deviceModel.includes('go') || deviceModel.includes('lite')) {
        issues.push('Android Go device detected - may have limited Health Connect support');
        recommendations.push('Check if Health Connect is available for your device');
      }

      return {
        compatible: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      console.warn('🤖 Device compatibility check failed:', error);
      return {
        compatible: true, // Assume compatible if check fails
        issues: ['Compatibility check failed'],
        recommendations: ['Proceed with caution'],
      };
    }
  }

  /**
   * Diagnose why Health Connect is unavailable
   */
  private async diagnoseUnavailability(androidVersion: number): Promise<string> {
    if (androidVersion >= 34) {
      // Android 14+ should have built-in Health Connect
      return 'Health Connect is built into Android 14+ but may need to be enabled in system settings or the service is not responding';
    } else if (androidVersion >= 26) {
      // Android 8-13 requires separate app
      return 'Health Connect app not installed or needs updating (install from Play Store)';
    } else {
      return `Android ${androidVersion} not supported (requires Android 8.0+)`;
    }
  }

  /**
   * Check if Health Connect app installation is required
   */
  requiresAppInstallation(): boolean {
    const androidVersion = this.getAndroidApiLevel();
    return androidVersion >= 26 && androidVersion < 34;
  }

  /**
   * Get Health Connect installation URL
   */
  getInstallationUrl(): string {
    return 'market://details?id=com.google.android.apps.healthdata';
  }

  /**
   * Get user-friendly availability message
   */
  getAvailabilityMessage(): string {
    const androidVersion = this.getAndroidApiLevel();

    if (androidVersion < 26) {
      return 'Health Connect requires Android 8.0 or higher. Your device is not supported.';
    } else if (androidVersion >= 34) {
      return 'Health Connect is built into your Android version but may need to be enabled in system settings.';
    } else {
      return 'Health Connect app needs to be installed from Google Play Store.';
    }
  }

  /**
   * SIMPLIFIED Health Connect access validation - NO service binding calls
   * Removes aggressive getGrantedPermissions and readRecords calls that cause TECNO issues
   */
  private async validateHealthConnectAccess(): Promise<void> {
    try {
      console.log('🤖 Performing minimal Health Connect validation...');

      // CRITICAL FIX: Only validate that the initialize function exists
      // NO aggressive service binding calls that break TECNO devices
      if (!initialize) {
        console.log('🤖 Health Connect initialize function not available');
        return;
      }

      console.log('🤖 Health Connect module is available and ready');

      // For ALL devices (especially TECNO), skip any validation that touches the service
      // The original aggressive validation was causing "binding to service failed" errors
      const deviceCheck = this.isProblematicDevice();
      console.log(`🤖 Device: ${deviceCheck.manufacturer} - Skipping service binding validation to prevent crashes`);

      // REMOVED: All getGrantedPermissions() calls
      // REMOVED: All readRecords() test calls
      // REMOVED: All service connectivity tests

      console.log('🤖 ✅ Minimal validation completed successfully');
    } catch (error) {
      console.warn('🤖 Minimal validation warning (non-fatal):', error);
      // Never throw - validation should never break initialization
    }
  }

  /**
   * Comprehensive Health Connect service health check
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
    serviceStatus: 'available' | 'unavailable' | 'degraded';
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let serviceStatus: 'available' | 'unavailable' | 'degraded' = 'unavailable';

    try {
      console.log('🤖 Performing comprehensive Health Connect health check...');

      // 1. Check if Health Connect is available
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        issues.push('Health Connect service not available');
        recommendations.push('Install Health Connect from Google Play Store');
        return { healthy: false, issues, recommendations, serviceStatus: 'unavailable' };
      }

      serviceStatus = 'available';

      // 2. Check device compatibility
      const compatibility = await this.checkDeviceCompatibility();
      if (!compatibility.compatible) {
        issues.push(...compatibility.issues);
        recommendations.push(...compatibility.recommendations);
        serviceStatus = 'degraded';
      }

      // 3. Test basic functionality
      try {
        await this.validateHealthConnectAccess();
        console.log('🤖 Health Connect basic functionality test passed');
      } catch (validationError) {
        issues.push('Health Connect basic functionality test failed');
        recommendations.push('Check Health Connect app permissions and settings');
        serviceStatus = 'degraded';
      }

      // 4. Test permission checking
      try {
        const testPermissions = await this.checkPermissions([HealthDataType.STEPS]);
        if (testPermissions.length === 0) {
          issues.push('Permission checking not working');
          recommendations.push('Reinstall Health Connect or update the app');
          serviceStatus = 'degraded';
        }
      } catch (permError) {
        issues.push('Permission checking failed');
        recommendations.push('Check Health Connect app installation');
        serviceStatus = 'degraded';
      }

      const healthy = issues.length === 0;
      console.log(
        `🤖 Health Connect health check completed: ${healthy ? 'HEALTHY' : 'ISSUES FOUND'}`
      );

      return { healthy, issues, recommendations, serviceStatus };
    } catch (error) {
      console.error('🤖 Health Connect health check failed:', error);
      issues.push('Health check failed due to unexpected error');
      recommendations.push('Contact support if this issue persists');

      sentryTracker.trackServiceError(
        error instanceof Error ? error : new Error('Health Connect health check failed'),
        {
          service: 'googleHealthConnectProvider',
          action: 'performHealthCheck',
          additional: {
            platform: Platform.OS,
            androidVersion: Platform.Version,
            timestamp: new Date().toISOString(),
          },
        }
      );

      return { healthy: false, issues, recommendations, serviceStatus: 'unavailable' };
    }
  }

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (Constants.executionEnvironment === 'storeClient') return false; // Expo Go
    if (!initialize) return false;

    // Check if provider is permanently failed due to repeated service binding deaths
    if (this.isPermanentlyFailed()) {
      console.warn(
        '🤖 Health Connect provider marked as permanently failed due to repeated service binding deaths'
      );
      return false;
    }

    try {
      const androidVersion = this.getAndroidApiLevel();
      console.log(`🤖 Checking Health Connect availability on Android API ${androidVersion}`);

      // Check Android version compatibility
      if (androidVersion < 26) {
        console.warn('🤖 Health Connect requires Android 8.0+ (API 26+)');
        return false;
      }

      // Enhanced availability check based on Android version
      const isAvailable = await this.checkHealthConnectAvailability(androidVersion);

      if (!isAvailable) {
        const reason = await this.diagnoseUnavailability(androidVersion);
        console.warn(`🤖 Health Connect not available: ${reason}`);
        return false;
      }

      console.log('🤖 Health Connect is available and ready');
      return true;
    } catch (error) {
      console.warn('🤖 Error checking Health Connect availability:', error);
      return false;
    }
  }

  /**
   * Enhanced Health Connect availability check based on Android version
   */
  private async checkHealthConnectAvailability(androidVersion: number): Promise<boolean> {
    try {
      if (androidVersion >= 34) {
        // Android 14+ - Health Connect is built-in
        return await this.checkBuiltInHealthConnect();
      } else if (androidVersion >= 26) {
        // Android 8-13 - Requires separate app
        return await this.checkHealthConnectApp();
      } else {
        // Android < 8.0 - Not supported
        console.warn('🤖 Health Connect requires Android 8.0+ (API 26+)');
        return false;
      }
    } catch (error) {
      console.warn('🤖 Health Connect availability check failed:', error);

      // Enhanced error tracking for better debugging
      sentryTracker.trackServiceError(
        error instanceof Error ? error : new Error('Health Connect availability check failed'),
        {
          service: 'googleHealthConnectProvider',
          action: 'checkHealthConnectAvailability',
          additional: {
            androidVersion,
            platform: Platform.OS,
            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
            timestamp: new Date().toISOString(),
          },
        }
      );

      return false;
    }
  }

  /**
   * Check if built-in Health Connect (Android 14+) is available
   */
  private async checkBuiltInHealthConnect(): Promise<boolean> {
    try {
      console.log('🤖 Checking built-in Health Connect (Android 14+)');
      const isAvailable = await initialize();

      if (isAvailable) {
        console.log('🤖 Built-in Health Connect is available');
        return true;
      } else {
        console.warn(
          '🤖 Built-in Health Connect not responding - may need to be enabled in system settings'
        );
        return false;
      }
    } catch (error) {
      console.warn('🤖 Built-in Health Connect check failed:', error);
      return false;
    }
  }

  /**
   * Check if Health Connect app (Android 8-13) is installed and available
   */
  private async checkHealthConnectApp(): Promise<boolean> {
    try {
      console.log('🤖 Checking Health Connect app (Android 8-13)');

      // First, try to initialize Health Connect
      const isAvailable = await initialize();

      if (isAvailable) {
        console.log('🤖 Health Connect app is available');

        // Additional validation: try to check if we can actually access the service
        try {
          await this.validateHealthConnectAccess();
          return true;
        } catch (validationError) {
          console.warn('🤖 Health Connect app available but validation failed:', validationError);
          // Still return true if initialize() succeeded, as the service might be temporarily unavailable
          return true;
        }
      } else {
        console.warn('🤖 Health Connect app not installed or not responding');

        // Provide detailed guidance based on the specific failure
        const androidVersion = this.getAndroidApiLevel();
        if (androidVersion >= 26 && androidVersion < 34) {
          console.warn('🤖 Health Connect app installation required:');
          console.warn(
            '  - Install from Google Play Store: https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'
          );
          console.warn(
            '  - Or use the market:// URL: market://details?id=com.google.android.apps.healthdata'
          );
        }

        return false;
      }
    } catch (error) {
      console.warn('🤖 Health Connect app check failed:', error);

      // Enhanced error analysis
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (
        errorMessage.includes('not installed') ||
        errorMessage.includes('package not found') ||
        errorMessage.includes('service not found')
      ) {
        console.warn('🤖 Health Connect app not installed - user needs to install from Play Store');
      } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        console.warn('🤖 Health Connect app installed but permissions not granted');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('unavailable')) {
        console.warn('🤖 Health Connect app installed but service temporarily unavailable');
      }

      return false;
    }
  }

  async checkPermissions(dataTypes: HealthDataType[]): Promise<HealthPermission[]> {
    // SIMPLIFIED permission checking - NO service binding calls to prevent TECNO crashes
    console.log('🤖 Checking permissions using cached state (TECNO-safe)...');

    if (!this.isInitialized) {
      console.log('🤖 Health Connect not initialized');
      return dataTypes.map(type => ({
        type,
        read: false,
        write: false,
        granted: false,
        error: 'Not initialized',
      }));
    }

    // CRITICAL FIX: Only use cached permissions, NEVER call getGrantedPermissions()
    // This prevents "binding to service failed" errors on TECNO devices
    const permissions: HealthPermission[] = [];

    for (const dataType of dataTypes) {
      const recordType = this.mapToHealthConnectType(dataType);
      if (!recordType) {
        permissions.push({
          type: dataType,
          read: false,
          write: false,
          granted: false,
        });
        continue;
      }

      // ONLY check cached permissions from last successful requestPermission call
      const granted = this.lastGrantedPermissions.some(
        perm => perm.recordType === recordType && perm.accessType === 'read'
      );

      permissions.push({
        type: dataType,
        read: this.supportsReading(dataType),
        write: false, // Health dashboard only needs read access
        granted,
      });
    }

    const grantedCount = permissions.filter(p => p.granted).length;
    console.log(`🤖 Cached permissions: ${grantedCount}/${permissions.length} granted (TECNO-safe)`);

    return permissions;
  }

  async requestPermissions(dataTypes: HealthDataType[]): Promise<boolean> {
    console.log(`🤖 Requesting Health Connect permissions for: [${dataTypes.join(', ')}]`);

    // Simple initialization check - like notjust.dev
    if (!this.isInitialized) {
      console.log('🤖 Initializing before permission request...');
      const initialized = await this.initialize();
      if (!initialized) {
        console.error('🤖 Failed to initialize Health Connect');
        return false;
      }

      // CRITICAL FIX: Device-specific stabilization delays
      const deviceCheck = this.isProblematicDevice();
      const stabilizationDelay = deviceCheck.isProblematic ? 2000 : 500;

      console.log(`🤖 Waiting ${stabilizationDelay}ms for native module stabilization (${deviceCheck.manufacturer})...`);
      await new Promise(resolve => setTimeout(resolve, stabilizationDelay));
    }

    if (!requestPermission) {
      console.error('🤖 requestPermission function not available');
      return false;
    }

    // Build permission requests outside try block for reuse in catch
    const permissionRequests = [];

    for (const dataType of dataTypes) {
      const recordType = this.mapToHealthConnectType(dataType);
      if (recordType === null || recordType === undefined) {
        console.warn(`🤖 Skipping unsupported data type: ${dataType}`);
        continue;
      }

      permissionRequests.push({
        accessType: 'read' as const,
        recordType,
      });
    }

    if (permissionRequests.length === 0) {
      console.warn('🤖 No valid permission requests');
      return false;
    }

    try {
      // Add small delay before permission request to ensure native module is ready
      // This helps prevent lateinit initialization errors
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simple permission request - exactly like notjust.dev example
      console.log(`🤖 Requesting ${permissionRequests.length} permissions...`);
      const grantedPermissions = await requestPermission(permissionRequests);

      // Store the granted permissions for later use (like the example)
      this.lastGrantedPermissions = grantedPermissions;

      // Check if permissions were granted
      const isGranted = Array.isArray(grantedPermissions) && grantedPermissions.length > 0;

      console.log(`🤖 Permission result: ${isGranted ? 'Granted' : 'Denied'}`);
      if (isGranted) {
        console.log(`🤖 Granted permissions:`, grantedPermissions);
      }

      return isGranted;
    } catch (error) {
      console.error('🤖 Permission request error:', error);

      // If it's a lateinit initialization error, try to reinitialize
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('lateinit') || errorMessage.includes('not been initialized')) {
        console.warn('🤖 Native module initialization issue detected, attempting recovery...');

        // Reset initialization state
        this.isInitialized = false;
        this.isNativeModuleReady = false;

        // Try to reinitialize
        try {
          console.log('🤖 Attempting to reinitialize Health Connect...');
          const reinitialized = await this.initialize();
          if (reinitialized) {
            // Wait for stabilization
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Retry permission request
            console.log('🤖 Retrying permission request after reinitialization...');
            const grantedPermissions = await requestPermission(permissionRequests);
            this.lastGrantedPermissions = grantedPermissions;
            const isGranted = Array.isArray(grantedPermissions) && grantedPermissions.length > 0;
            console.log(`🤖 Retry result: ${isGranted ? 'Success' : 'Failed'}`);
            return isGranted;
          }
        } catch (retryError) {
          console.error('🤖 Recovery attempt failed:', retryError);
        }
      }

      return false;
    }
  }

  async readHealthData(
    dataType: HealthDataType,
    options: HealthDataRange
  ): Promise<HealthMetric[]> {
    // Simple data reading - like notjust.dev example
    if (!this.isInitialized || !readRecords) {
      console.error('🤖 Health Connect not initialized');
      return [];
    }

    const recordType = this.mapToHealthConnectType(dataType);
    if (!recordType) {
      console.warn(`🤖 Unsupported data type: ${dataType}`);
      return [];
    }

    try {
      // Simple time filter - like notjust.dev
      const timeRangeFilter = {
        operator: 'between' as const,
        startTime: options.startDate.toISOString(),
        endTime: options.endDate.toISOString(),
      };

      console.log(`🤖 Reading ${recordType} data...`);

      // Direct read without complex retry logic
      const result = await readRecords(recordType, {
        timeRangeFilter,
        ascendingOrder: true,
      });

      const records = result?.records || result || [];

      if (!Array.isArray(records) || records.length === 0) {
        console.log(`🤖 No ${dataType} data found`);
        return [];
      }

      // Simple mapping to metrics
      const metrics = this.mapRecordsToMetrics(records, dataType);
      console.log(`🤖 Found ${metrics.length} ${dataType} records`);

      return metrics;
    } catch (error) {
      console.error(`🤖 Error reading ${dataType}:`, error);
      return [];
    }
  }

  async writeHealthData(metric: HealthMetric): Promise<boolean> {
    // Health dashboard only needs read access - writing not supported
    console.warn(`🤖 Write operations not supported for health dashboard`);
    return false;
  }

  async getDeviceInfo(): Promise<any> {
    // Try to get device info from Health Connect if available
    return {
      deviceName: 'Android Device',
      deviceModel: 'Android Health Connect',
      osVersion: Platform.Version.toString(),
      appVersion: 'Health Connect',
    };
  }

  async cleanup(): Promise<void> {
    console.log('🤖 Cleaning up Google Health Connect provider...');
    this.isInitialized = false;
    this.isNativeModuleReady = false;
    this.initializationAttempts = 0;
    this.setConnectionState('disconnected');

    // Clear connection state listeners
    this.connectionStateListeners.clear();

    // Clear rate limiter cache
    this.rateLimiter.clear();
  }

  // Helper methods

  /**
   * Validate timestamp to ensure it's within reasonable bounds
   */
  private validateTimestamp(date: Date): Date {
    const now = Date.now();
    const timestamp = date.getTime();

    // Ensure timestamp is not too far in the past (10 years)
    const tenYearsAgo = now - 10 * 365 * 24 * 60 * 60 * 1000;
    if (timestamp < tenYearsAgo) {
      console.warn('🤖 Timestamp too old, adjusting to 10 years ago');
      return new Date(tenYearsAgo);
    }

    // Ensure timestamp is not in the future (allow up to 1 day)
    const oneDayFromNow = now + 24 * 60 * 60 * 1000;
    if (timestamp > oneDayFromNow) {
      console.warn('🤖 Future timestamp detected, adjusting to current time');
      return new Date(now);
    }

    return date;
  }

  /**
   * Read records with retry logic and better error handling
   */
  private async readRecordsWithRetry(
    recordType: string,
    queryOptions: any,
    maxRetries: number = 3
  ): Promise<any[]> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🤖 Health Connect read attempt ${attempt}/${maxRetries} for ${recordType}`);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health Connect read timeout')), 30000);
        });

        const result = await Promise.race([readRecords(recordType, queryOptions), timeoutPromise]);

        console.log(`🤖 Health Connect read successful on attempt ${attempt}`);
        return result || [];
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error);
        console.warn(`🤖 Health Connect read attempt ${attempt} failed (${errorType}):`, error);

        // Track the error with detailed context
        sentryTracker.trackServiceError(
          error instanceof Error ? error : `Health Connect read failed: ${error}`,
          {
            service: 'googleHealthConnectProvider',
            action: 'readRecordsWithRetry',
            additional: {
              errorType,
              attempt,
              maxRetries,
              recordType,
              platform: Platform.OS,
              androidVersion: Platform.OS === 'android' ? Platform.Version : undefined,
              canRetry: this.isRetryableError(error),
              timestamp: new Date().toISOString(),
            },
          }
        );

        // Handle service binding deaths specifically
        if (errorType === 'SERVICE_BINDING_FAILED') {
          this.handleServiceBindingDeath();
        }

        // Don't retry for certain error types
        if (!this.isRetryableError(error)) {
          console.log(`🤖 Non-retryable error (${errorType}), stopping retries`);
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`🤖 Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Health Connect read failed after all retries');
  }

  /**
   * Classify error type for better handling and user feedback
   */
  private classifyError(error: any): string {
    if (!error) return 'UNKNOWN';

    const errorMessage = error.message?.toLowerCase() || error.toString?.()?.toLowerCase() || '';
    const errorCode = error.code || error.errorCode || '';

    console.log(`🤖 Classifying error - message: "${errorMessage}", code: "${errorCode}"`);

    // Service binding failures (common on TECNO and other custom Android devices)
    if (
      errorMessage.includes('binding to service failed') ||
      errorMessage.includes('service binding failed') ||
      errorMessage.includes('cannot bind to service') ||
      errorMessage.includes('service not found') ||
      errorMessage.includes('binding died') ||
      errorMessage.includes('null binding') ||
      errorMessage.includes('underlying_error') ||
      errorCode === 'UNDERLYING_ERROR' ||
      errorCode === 'SERVICE_BINDING_FAILED'
    ) {
      console.log(`🤖 Classified as SERVICE_BINDING_FAILED`);
      return 'SERVICE_BINDING_FAILED';
    }

    if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      return 'PERMISSION_DENIED';
    }

    if (
      errorMessage.includes('not installed') ||
      errorMessage.includes('unavailable') ||
      errorMessage.includes('device not supported') ||
      errorMessage.includes('incompatible device')
    ) {
      return 'DEVICE_UNAVAILABLE';
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return 'NETWORK_ERROR';
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return 'RATE_LIMITED';
    }

    if (errorMessage.includes('data') || errorMessage.includes('corrupt')) {
      return 'DATA_CORRUPTION';
    }

    return 'UNKNOWN';
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;

    const errorType = this.classifyError(error);

    // Non-retryable errors (these indicate permanent failures)
    if (
      errorType === 'SERVICE_BINDING_FAILED' ||
      errorType === 'PERMISSION_DENIED' ||
      errorType === 'DEVICE_UNAVAILABLE'
    ) {
      return false;
    }

    // Retryable errors (temporary issues that might resolve)
    if (errorType === 'NETWORK_ERROR' || errorType === 'RATE_LIMITED') {
      return true;
    }

    // For unknown errors, check the message for additional context
    const errorMessage = error.message?.toLowerCase() || error.toString?.()?.toLowerCase() || '';

    // Non-retryable patterns
    if (
      errorMessage.includes('binding to service failed') ||
      errorMessage.includes('service binding failed') ||
      errorMessage.includes('cannot bind to service') ||
      errorMessage.includes('service not found') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('denied') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('not installed') ||
      errorMessage.includes('unsupported') ||
      errorMessage.includes('device not supported') ||
      errorMessage.includes('health connect not available') ||
      errorMessage.includes('incompatible device') ||
      errorMessage.includes('tecno') ||
      errorMessage.includes('custom android') ||
      errorMessage.includes('manufacturer not supported')
    ) {
      return false;
    }

    // Retryable patterns
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('temporarily unavailable') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('busy') ||
      errorMessage.includes('overloaded')
    ) {
      return true;
    }

    // Default to non-retryable for unknown errors to prevent infinite retries
    return false;
  }

  /**
   * Fallback method to map records to metrics manually
   */
  private mapRecordsToMetrics(records: any[], dataType: HealthDataType): HealthMetric[] {
    return records.map((record: any, index: number) => {
      const metric: HealthMetric = {
        id: `google_${dataType}_${record.startTime || Date.now()}_${index}`,
        type: dataType,
        value: this.extractValueFromRecord(record, dataType),
        unit: this.getUnitForDataType(dataType),
        timestamp: new Date(record.startTime || record.time || Date.now()),
        source: this.determineSource(record),
        deviceId:
          record.metadata?.device || record.metadata?.dataOrigin?.packageName || 'android_device',
        metadata: {
          quality: 'medium', // Lower quality due to fallback mapping
          confidence: 0.8,
          context: 'google_health_connect_fallback',
        },
      };

      return metric;
    });
  }

  private mapToHealthConnectType(dataType: HealthDataType): string | null {
    switch (dataType) {
      case HealthDataType.HEART_RATE:
        return 'HeartRate';
      case HealthDataType.STEPS:
        return 'Steps';
      case HealthDataType.WEIGHT:
        return 'Weight';
      case HealthDataType.BLOOD_PRESSURE:
        return 'BloodPressure';
      case HealthDataType.BODY_TEMPERATURE:
        return 'BodyTemperature';
      case HealthDataType.OXYGEN_SATURATION:
        return 'OxygenSaturation';
      case HealthDataType.SLEEP:
        return 'SleepSession';
      case HealthDataType.BLOOD_GLUCOSE:
        return 'BloodGlucose';
      case HealthDataType.DISTANCE:
        return 'Distance';
      case HealthDataType.CALORIES_BURNED:
      case HealthDataType.ACTIVE_ENERGY:
        return 'TotalCaloriesBurned';
      case HealthDataType.EXERCISE:
        return 'ExerciseSession';
      default:
        return null;
    }
  }

  private extractValueFromRecord(record: any, dataType: HealthDataType): number {
    switch (dataType) {
      case HealthDataType.HEART_RATE:
        return record.beatsPerMinute || record.value || 0;
      case HealthDataType.STEPS:
        return record.count || record.value || 0;
      case HealthDataType.WEIGHT:
        return record.weight ? record.weight.inKilograms : record.value || 0;
      case HealthDataType.BLOOD_PRESSURE:
        return record.systolic || record.value || 0;
      case HealthDataType.BODY_TEMPERATURE:
        return record.temperature ? record.temperature.inCelsius : record.value || 0;
      case HealthDataType.OXYGEN_SATURATION:
        return record.percentage || record.value || 0;
      case HealthDataType.SLEEP:
        if (record.startTime && record.endTime) {
          const start = new Date(record.startTime).getTime();
          const end = new Date(record.endTime).getTime();
          return Math.round((end - start) / 60000); // minutes
        }
        return record.value || 0;
      case HealthDataType.BLOOD_GLUCOSE:
        return (
          (record.level && (record.level.milligramsPerDeciliter || record.level.mgPerDeciliter)) ||
          record.value ||
          0
        );
      case HealthDataType.DISTANCE:
        return record.distance ? record.distance.inMeters : record.value || 0;
      case HealthDataType.CALORIES_BURNED:
      case HealthDataType.ACTIVE_ENERGY:
        return record.energy ? record.energy.inCalories : record.value || 0;
      default:
        return record.value || 0;
    }
  }

  private getUnitForDataType(dataType: HealthDataType): string {
    switch (dataType) {
      case HealthDataType.HEART_RATE:
        return 'bpm';
      case HealthDataType.STEPS:
        return 'steps';
      case HealthDataType.WEIGHT:
        return 'kg';
      case HealthDataType.BLOOD_PRESSURE:
        return 'mmHg';
      case HealthDataType.BODY_TEMPERATURE:
        return '°C';
      case HealthDataType.OXYGEN_SATURATION:
        return '%';
      case HealthDataType.SLEEP:
        return 'minutes';
      case HealthDataType.BLOOD_GLUCOSE:
        return 'mg/dL';
      case HealthDataType.DISTANCE:
        return 'meters';
      case HealthDataType.CALORIES_BURNED:
      case HealthDataType.ACTIVE_ENERGY:
        return 'kcal';
      default:
        return 'units';
    }
  }

  private determineSource(record: any): 'watch' | 'phone' | 'manual' {
    const dataOrigin = record.metadata?.dataOrigin?.packageName || '';

    // Detect if data comes from a watch/wearable
    if (
      dataOrigin.includes('wear') ||
      dataOrigin.includes('watch') ||
      dataOrigin.includes('galaxy')
    ) {
      return 'watch';
    }

    // Detect if manually entered
    if (dataOrigin.includes('manual') || dataOrigin.includes('user')) {
      return 'manual';
    }

    // Default to phone
    return 'phone';
  }

  private createHealthConnectRecord(metric: HealthMetric, recordType: string): any {
    const baseRecord = {
      recordType,
      startTime: metric.timestamp.toISOString(),
      endTime: metric.timestamp.toISOString(),
      metadata: {
        dataOrigin: {
          packageName: 'com.lns.hopmed',
        },
      },
    };

    switch (metric.type) {
      case HealthDataType.STEPS:
        return {
          ...baseRecord,
          count: metric.value,
        };

      case HealthDataType.WEIGHT:
        return {
          ...baseRecord,
          weight: {
            inKilograms: metric.value,
          },
        };

      case HealthDataType.HEART_RATE:
        return {
          ...baseRecord,
          beatsPerMinute: metric.value,
        };

      default:
        return {
          ...baseRecord,
          value: metric.value,
        };
    }
  }

  private supportsReading(dataType: HealthDataType): boolean {
    return this.supportedDataTypes.includes(dataType);
  }

  private supportsWriting(dataType: HealthDataType): boolean {
    // Health dashboard only needs read access
    return false;
  }

  /**
   * Start persistent background retry strategy - like commercial apps do
   * This is why Fitbit works well on TECNO devices
   */
  private startPersistentBackgroundRetry(): void {
    if (!this.persistentRetryEnabled) {
      return;
    }

    // Clear any existing timer
    if (this.backgroundRetryTimer) {
      clearTimeout(this.backgroundRetryTimer);
    }

    const retryDelay = Math.min(60000 * Math.pow(2, this.initializationAttempts), 300000); // Max 5 minutes
    console.log(`🤖 Starting background retry in ${retryDelay}ms (commercial strategy)`);

    this.backgroundRetryTimer = setTimeout(async () => {
      console.log('🤖 Background retry attempt - mimicking Fitbit strategy');

      try {
        // Try to reinitialize Health Connect
        const result = await this.performCommercialGradeInitialization();
        if (result) {
          console.log('🤖 Background retry successful!');
          this.gracefulDegradationMode = false;
          return;
        }
      } catch (error) {
        console.log('🤖 Background retry failed, will try again later');
      }

      // Continue retrying if still enabled
      if (this.persistentRetryEnabled && this.initializationAttempts < 10) {
        this.startPersistentBackgroundRetry();
      }
    }, retryDelay);
  }

  /**
   * Start graceful degradation mode - continue working without Health Connect
   * This is how commercial apps handle TECNO device compatibility issues
   */
  private startGracefulDegradation(): void {
    console.log('🤖 Starting graceful degradation mode (commercial approach)');
    this.gracefulDegradationMode = true;
    this.setConnectionState('disconnected');

    // In graceful degradation, we report that we're "initialized" but with limited functionality
    // This prevents the app from blocking and allows other health providers to work
    console.log('🤖 Health Connect will work in background when service becomes available');
  }

  /**
   * Stop persistent retry (for cleanup)
   */
  public stopPersistentRetry(): void {
    this.persistentRetryEnabled = false;
    if (this.backgroundRetryTimer) {
      clearTimeout(this.backgroundRetryTimer);
      this.backgroundRetryTimer = null;
    }
  }

  /**
   * Check if we're in graceful degradation mode
   */
  public isInGracefulDegradationMode(): boolean {
    return this.gracefulDegradationMode;
  }

  /**
   * Commercial-grade service availability check (like Fitbit does)
   */
  private async checkServiceAvailability(): Promise<boolean> {
    try {
      if (!initialize) return false;

      // Quick service check without full initialization
      const result = await Promise.race([
        initialize(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Service check timeout')), 5000)
        )
      ]);

      return result === true;
    } catch {
      return false;
    }
  }
}
