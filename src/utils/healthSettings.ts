import Constants from 'expo-constants';
import { Platform, Linking } from 'react-native';

let IntentLauncher: any;
try {
  // Optional dependency (Expo prebuild or bare). Wrapped to avoid runtime crash in Expo Go if absent.

  IntentLauncher = require('expo-intent-launcher');
} catch {}

export async function openHealthSettings(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      if (IntentLauncher?.startActivityAsync) {
        const actions = [
          'androidx.health.ACTION_HEALTH_CONNECT_SETTINGS',
          'android.settings.HEALTH_CONNECT_SETTINGS',
        ];
        for (const a of actions) {
          try {
            await IntentLauncher.startActivityAsync(a);
            return true;
          } catch {}
        }
      }
      // Try direct package deep link for Health Connect
      try {
        const pkg = 'com.google.android.apps.healthdata';
        const deep = `android-app://${pkg}`;
        if (await Linking.canOpenURL(deep)) {
          await Linking.openURL(deep);
          return true;
        }
      } catch {}
      // App specific settings
      try {
        const appPkg = Constants.expoConfig?.android?.package;
        if (appPkg) {
          const appUrl = `package:${appPkg}`;
          if (await Linking.canOpenURL(appUrl)) {
            await Linking.openURL(appUrl);
            return true;
          }
        }
      } catch {}
      if (typeof Linking.openSettings === 'function') {
        await Linking.openSettings();
        return true;
      }
      return false;
    }
    if (Platform.OS === 'ios') {
      try {
        await Linking.openURL('app-settings:');
        return true;
      } catch {}
      if (typeof Linking.openSettings === 'function') {
        await Linking.openSettings();
        return true;
      }
      return false;
    }
    return false;
  } catch {
    return false;
  }
}
