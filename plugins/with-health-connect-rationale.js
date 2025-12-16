/**
 * Expo Config Plugin: Health Connect Permissions Rationale Activity
 *
 * This plugin adds support for Health Connect permission rationale on Android 10-14+
 *
 * What it does:
 * 1. Creates PermissionsRationaleActivity.kt for showing privacy policy
 * 2. Adds activity declaration to AndroidManifest.xml
 * 3. Adds Android 14+ activity-alias for system Health Connect integration
 *
 * Reference: https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started
 */

const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Template for PermissionsRationaleActivity.kt
 */
const PERMISSIONS_RATIONALE_ACTIVITY_TEMPLATE = `package com.lns.hopmed

import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * PermissionsRationaleActivity
 *
 * Required by Health Connect for Android 13 and below
 * Shows permission rationale/privacy policy when users tap "Learn more" in permission dialogs
 *
 * Reference: https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started
 */
class PermissionsRationaleActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val webView = WebView(this)
    webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(
        view: WebView?,
        request: WebResourceRequest?
      ): Boolean {
        // Keep navigation within the WebView
        return false
      }
    }

    // Load Health Connect permission rationale documentation
    webView.loadUrl("https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started")

    setContentView(webView)
  }
}
`;

/**
 * Step 1: Create PermissionsRationaleActivity.kt file
 */
const withPermissionsRationaleActivity = (config) => {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const packageName = 'com.lns.hopmed';
      const packagePath = packageName.replace(/\./g, '/');

      // Target path for the activity file
      const activityDir = path.join(
        projectRoot,
        'app/src/main/java',
        packagePath
      );
      const activityPath = path.join(activityDir, 'PermissionsRationaleActivity.kt');

      // Ensure directory exists
      if (!fs.existsSync(activityDir)) {
        fs.mkdirSync(activityDir, { recursive: true });
      }

      // Write the activity file
      fs.writeFileSync(activityPath, PERMISSIONS_RATIONALE_ACTIVITY_TEMPLATE, 'utf-8');

      console.log('✅ Created PermissionsRationaleActivity.kt');

      return cfg;
    },
  ]);
};

/**
 * Step 2: Add activity declaration and Android 14 activity-alias to AndroidManifest.xml
 */
const withPermissionsRationaleManifest = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    if (!manifest.manifest.application || !manifest.manifest.application[0]) {
      console.warn('⚠️ Android manifest application structure not found');
      return cfg;
    }

    const application = manifest.manifest.application[0];

    // Ensure activity array exists
    if (!application.activity) {
      application.activity = [];
    }

    // Check if PermissionsRationaleActivity already exists
    const rationaleActivityExists = application.activity.some((activity) => {
      return activity.$?.['android:name'] === '.PermissionsRationaleActivity';
    });

    if (!rationaleActivityExists) {
      // Add PermissionsRationaleActivity for Android 13 and below
      application.activity.push({
        $: {
          'android:name': '.PermissionsRationaleActivity',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
                },
              },
            ],
          },
        ],
      });

      console.log('✅ Added PermissionsRationaleActivity to AndroidManifest.xml');
    } else {
      console.log('ℹ️ PermissionsRationaleActivity already exists in AndroidManifest.xml');
    }

    // Ensure activity-alias array exists
    if (!application['activity-alias']) {
      application['activity-alias'] = [];
    }

    // Check if Android 14+ activity-alias already exists
    const android14AliasExists = application['activity-alias'].some((alias) => {
      return alias.$?.['android:name'] === 'ViewPermissionUsageActivity';
    });

    if (!android14AliasExists) {
      // Add Android 14+ activity-alias for system Health Connect integration
      application['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE',
                },
              },
            ],
            category: [
              {
                $: {
                  'android:name': 'android.intent.category.HEALTH_PERMISSIONS',
                },
              },
            ],
          },
        ],
      });

      console.log('✅ Added Android 14+ ViewPermissionUsageActivity alias to AndroidManifest.xml');
    } else {
      console.log('ℹ️ Android 14+ ViewPermissionUsageActivity alias already exists');
    }

    return cfg;
  });
};

/**
 * Main plugin export - combines both modifications
 */
module.exports = function withHealthConnectRationale(config) {
  // Apply both modifications in sequence
  config = withPermissionsRationaleActivity(config);
  config = withPermissionsRationaleManifest(config);

  return config;
};
