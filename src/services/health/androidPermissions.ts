import type { Permission } from 'react-native';
import { PermissionsAndroid, Platform } from 'react-native';

import { sentryTracker } from '../../utils/sentryErrorTracker';
import deviceCapabilityService from '../deviceCapabilityService';

// Ensures ACTIVITY_RECOGNITION & BODY_SENSORS runtime permissions on Android 10+
// Now separated from video call flow with device-specific timeouts
export async function ensureAndroidHealthPermissions(options?: {
  skipOnSlowDevices?: boolean;
  customTimeout?: number;
  context?: 'health_dashboard' | 'video_call' | 'background_sync';
}): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const { skipOnSlowDevices = false, customTimeout, context = 'health_dashboard' } = options || {};

  try {
    // Get device capabilities for optimization
    const deviceCaps = deviceCapabilityService.getCapabilities();

    // Skip health permissions on problematic devices during video calls
    if (skipOnSlowDevices && deviceCaps.shouldSkipHealthPermissions) {
      console.warn('⚠️ Skipping health permissions on slow device to prevent timeout');
      sentryTracker.trackWarning('Health permissions skipped on slow device', {
        service: 'androidPermissions',
        action: 'ensureAndroidHealthPermissions',
        additional: {
          manufacturer: deviceCaps.manufacturer,
          model: deviceCaps.model,
          context,
          hasSlowPermissionHandling: deviceCaps.hasSlowPermissionHandling,
        },
      });
      return false; // Indicate permissions were skipped, but don't fail
    }

    const candidates: Permission[] = [];
    const map: Record<string, Permission | undefined> = {
      ACTIVITY_RECOGNITION: PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION as Permission,
      BODY_SENSORS: PermissionsAndroid.PERMISSIONS.BODY_SENSORS as Permission,
    };

    // Check which permissions are available and needed
    for (const key of Object.keys(map)) {
      const perm = map[key];
      if (perm) {
        try {
          const granted = await PermissionsAndroid.check(perm);
          if (!granted) candidates.push(perm);
        } catch (checkError) {
          console.warn(`Failed to check permission ${key}:`, checkError);
          // Continue with other permissions
        }
      }
    }

    if (candidates.length === 0) return true;

    // Request permissions with device-specific timeout
    const timeout = customTimeout || deviceCaps.permissionTimeoutMs;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const errorMsg = `Android permission request timeout after ${timeout}ms`;
        console.error(errorMsg, {
          manufacturer: deviceCaps.manufacturer,
          model: deviceCaps.model,
          timeout,
          context,
        });
        reject(new Error(errorMsg));
      }, timeout);
    });

    console.log(
      `🔐 Requesting Android health permissions with ${timeout}ms timeout for ${deviceCaps.manufacturer} ${deviceCaps.model}`
    );

    const results = await Promise.race([
      PermissionsAndroid.requestMultiple(candidates as Permission[]),
      timeoutPromise,
    ]);

    const allGranted = (candidates as Permission[]).every(
      p => results[p] === PermissionsAndroid.RESULTS.GRANTED
    );

    if (!allGranted) {
      const deniedPermissions = (candidates as Permission[]).filter(
        p => results[p] !== PermissionsAndroid.RESULTS.GRANTED
      );

      sentryTracker.trackWarning('Android health permissions not granted', {
        service: 'androidPermissions',
        action: 'ensureAndroidHealthPermissions',
        additional: {
          requestedPermissions: candidates.map(p => p.toString()),
          deniedPermissions: deniedPermissions.map(p => p.toString()),
          results,
          apiLevel: Platform.Version,
          manufacturer: deviceCaps.manufacturer,
          model: deviceCaps.model,
          context,
          timeout,
        },
      });
    }

    return allGranted;
  } catch (e) {
    const isTimeout = e instanceof Error && e.message.includes('timeout');
    const deviceCaps = deviceCapabilityService.getCapabilities();

    console.warn(`Android runtime permission request failed${isTimeout ? ' (timeout)' : ''}:`, e);

    // Different error tracking based on error type
    if (isTimeout && deviceCaps.hasSlowPermissionHandling) {
      // Expected timeout on slow devices - track as warning, not critical
      sentryTracker.trackWarning('Expected permission timeout on slow device', {
        service: 'androidPermissions',
        action: 'ensureAndroidHealthPermissions',
        additional: {
          manufacturer: deviceCaps.manufacturer,
          model: deviceCaps.model,
          timeout: deviceCaps.permissionTimeoutMs,
          context,
          apiLevel: Platform.Version,
          errorType: e instanceof Error ? e.constructor.name : 'Unknown',
          shouldSkipHealthPermissions: deviceCaps.shouldSkipHealthPermissions,
        },
      });
    } else {
      // Unexpected error - track as critical
      sentryTracker.trackCriticalError(
        e instanceof Error ? e : 'Android permission request failed',
        {
          service: 'androidPermissions',
          action: 'ensureAndroidHealthPermissions',
          additional: {
            apiLevel: Platform.Version,
            manufacturer: deviceCaps.manufacturer,
            model: deviceCaps.model,
            context,
            timeout: deviceCaps.permissionTimeoutMs,
            errorType: e instanceof Error ? e.constructor.name : 'Unknown',
            isTimeout,
          },
        }
      );
    }

    return false;
  }
}
