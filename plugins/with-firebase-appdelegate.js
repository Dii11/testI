/**
 * Expo Config Plugin: Ensure Firebase and Notification delegate in AppDelegate.swift
 */
const { withAppDelegate } = require('@expo/config-plugins');

module.exports = function withFirebaseAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    const mod = config.modResults;
    if (mod.language !== 'swift') return config;

    let contents = mod.contents;

    // Ensure import UserNotifications
    if (!contents.includes('import UserNotifications')) {
      const importInsertionPoint = contents.indexOf('\nimport ReactAppDependencyProvider');
      if (importInsertionPoint !== -1) {
        contents = contents.replace('\nimport ReactAppDependencyProvider', '\nimport ReactAppDependencyProvider\nimport UserNotifications');
      } else {
        contents = 'import UserNotifications\n' + contents;
      }
    }

    // Ensure class conforms to UNUserNotificationCenterDelegate
    if (contents.includes('public class AppDelegate: ExpoAppDelegate') && !contents.includes('UNUserNotificationCenterDelegate')) {
      contents = contents.replace(
        'public class AppDelegate: ExpoAppDelegate',
        'public class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate'
      );
    }

    // Insert FirebaseApp.configure() and notification delegate in didFinishLaunching
    if (contents.includes('didFinishLaunchingWithOptions')) {
      const hook = 'didFinishLaunchingWithOptions';
      const lines = contents.split('\n');
      const idx = lines.findIndex((l) => l.includes(hook));
      
      if (idx !== -1) {
        // Find the opening brace of the function
        let insertAt = -1;
        for (let i = idx; i < lines.length; i++) {
          if (lines[i].includes('{')) {
            insertAt = i + 1;
            break;
          }
        }

        if (insertAt !== -1) {
          // Only insert if not already present
          const alreadyHasFirebase = contents.includes('FirebaseApp.configure()') || contents.includes('FirebaseApp.app()');
          const alreadyHasDelegate = contents.includes('UNUserNotificationCenter.current().delegate = self');
          const toInsert = [];
          if (!alreadyHasFirebase) {
            toInsert.push('    if FirebaseApp.app() == nil {');
            toInsert.push('      FirebaseApp.configure()');
            toInsert.push('    }');
          }
          if (!alreadyHasDelegate) {
            toInsert.push('    UNUserNotificationCenter.current().delegate = self');
          }
          if (toInsert.length) {
            lines.splice(insertAt, 0, ...toInsert);
            contents = lines.join('\n');
          }
        }
      }
    }

    mod.contents = contents;
    config.modResults = mod;
    return config;
  });
};


