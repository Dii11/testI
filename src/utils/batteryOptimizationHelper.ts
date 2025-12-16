/**
 * Battery Optimization Helper
 *
 * Helps users disable battery optimization for HopMed to ensure
 * reliable incoming call notifications on budget Android devices
 * like Tecno, Infinix, Itel, etc.
 *
 * These devices aggressively kill apps in the background, which
 * prevents incoming call notifications from working properly.
 *
 * Usage:
 *   import { requestBatteryOptimizationExemption } from '@utils/batteryOptimizationHelper';
 *
 *   // Show prompt on first launch or in settings
 *   await requestBatteryOptimizationExemption();
 */

import { Alert, Platform, Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BATTERY_OPTIMIZATION_PROMPTED_KEY = '@hopmed_battery_optimization_prompted';

/**
 * Check if user has already been prompted about battery optimization
 */
export async function hasBatteryOptimizationBeenPrompted(): Promise<boolean> {
  try {
    const prompted = await AsyncStorage.getItem(BATTERY_OPTIMIZATION_PROMPTED_KEY);
    return prompted === 'true';
  } catch (error) {
    console.error('Failed to check battery optimization prompt status:', error);
    return false;
  }
}

/**
 * Mark that user has been prompted about battery optimization
 */
export async function markBatteryOptimizationPrompted(): Promise<void> {
  try {
    await AsyncStorage.setItem(BATTERY_OPTIMIZATION_PROMPTED_KEY, 'true');
  } catch (error) {
    console.error('Failed to mark battery optimization prompted:', error);
  }
}

/**
 * Reset battery optimization prompt (for testing)
 */
export async function resetBatteryOptimizationPrompt(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BATTERY_OPTIMIZATION_PROMPTED_KEY);
    console.log('✅ Battery optimization prompt reset');
  } catch (error) {
    console.error('Failed to reset battery optimization prompt:', error);
  }
}

/**
 * Open battery optimization settings for the app
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    console.warn('Battery optimization settings only available on Android');
    return;
  }

  try {
    console.log('📱 Opening battery optimization settings...');

    // Try to open battery optimization settings using Intent Launcher
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
    );

    console.log('✅ Battery optimization settings opened');
  } catch (error) {
    console.error('❌ Failed to open battery optimization settings:', error);

    // Fallback: Try to open general app settings
    try {
      await Linking.openSettings();
      console.log('✅ Opened general app settings as fallback');
    } catch (fallbackError) {
      console.error('❌ Failed to open app settings:', fallbackError);
    }
  }
}

/**
 * Request battery optimization exemption from user
 *
 * Shows an alert explaining why battery optimization should be disabled,
 * then opens the settings page.
 *
 * @param options Configuration options
 * @param options.skipIfPrompted Skip if user has already been prompted
 * @param options.force Show prompt even if already shown
 */
export async function requestBatteryOptimizationExemption(options?: {
  skipIfPrompted?: boolean;
  force?: boolean;
}): Promise<void> {
  const { skipIfPrompted = true, force = false } = options || {};

  // Only works on Android
  if (Platform.OS !== 'android') {
    return;
  }

  // Check if already prompted
  if (skipIfPrompted && !force) {
    const prompted = await hasBatteryOptimizationBeenPrompted();
    if (prompted) {
      console.log('ℹ️ User already prompted about battery optimization');
      return;
    }
  }

  Alert.alert(
    '📞 Enable Reliable Call Notifications',
    'To receive incoming calls when HopMed is closed, please disable battery optimization.\n\n' +
    'This prevents your device from killing the app and ensures you never miss important medical calls.\n\n' +
    '🔋 Don\'t worry - HopMed uses minimal battery in the background.',
    [
      {
        text: 'Not Now',
        style: 'cancel',
        onPress: async () => {
          await markBatteryOptimizationPrompted();
          console.log('ℹ️ User declined battery optimization exemption');
        },
      },
      {
        text: 'Open Settings',
        onPress: async () => {
          await markBatteryOptimizationPrompted();
          await openBatteryOptimizationSettings();
          console.log('✅ User opened battery optimization settings');
        },
      },
    ],
    { cancelable: false }
  );
}

/**
 * Show battery optimization reminder
 *
 * Use this in app settings or help section to allow users
 * to revisit battery optimization settings
 */
export async function showBatteryOptimizationReminder(): Promise<void> {
  if (Platform.OS !== 'android') {
    Alert.alert(
      'Android Only',
      'Battery optimization settings are only available on Android devices.'
    );
    return;
  }

  Alert.alert(
    '🔋 Battery Optimization',
    'For reliable incoming call notifications, make sure battery optimization is disabled for HopMed.\n\n' +
    'Steps:\n' +
    '1. Find HopMed in the list\n' +
    '2. Select "Don\'t optimize" or "Allow"\n' +
    '3. Go back to the app',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: async () => {
          await openBatteryOptimizationSettings();
        },
      },
    ]
  );
}

/**
 * Get device-specific battery optimization instructions
 *
 * Different Android manufacturers have different settings locations
 */
export function getDeviceSpecificInstructions(): string {
  // You can detect manufacturer using expo-device if needed
  // For now, return general instructions
  return (
    'General Instructions:\n\n' +
    '1. Open Settings\n' +
    '2. Search for "Battery Optimization" or "Power Saving"\n' +
    '3. Find HopMed in the list\n' +
    '4. Select "Don\'t optimize" or "No restrictions"\n\n' +
    'Device-Specific:\n' +
    '• Tecno/Infinix/Itel: Settings → Battery → Battery Optimization\n' +
    '• Samsung: Settings → Apps → HopMed → Battery → Optimize battery usage\n' +
    '• Xiaomi: Settings → Apps → Manage apps → HopMed → Battery saver\n' +
    '• Oppo/Realme: Settings → Battery → Battery optimization\n' +
    '• Huawei: Settings → Apps → HopMed → Battery → App launch'
  );
}

export default {
  requestBatteryOptimizationExemption,
  showBatteryOptimizationReminder,
  openBatteryOptimizationSettings,
  hasBatteryOptimizationBeenPrompted,
  markBatteryOptimizationPrompted,
  resetBatteryOptimizationPrompt,
  getDeviceSpecificInstructions,
};
