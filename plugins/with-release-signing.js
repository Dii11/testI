const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin: Release Signing Configuration
 * 
 * This plugin configures release builds to use the proper release keystore
 * instead of the debug keystore. This is critical for Play Store uploads.
 * 
 * The keystore credentials are read from environment variables set by the
 * build script or can use fallback values for local builds.
 * 
 * Expected environment variables (set by build-play-store-manual.sh):
 * - HOPMED_RELEASE_STORE_FILE: Path to keystore file
 * - HOPMED_RELEASE_STORE_PASSWORD: Keystore password
 * - HOPMED_RELEASE_KEY_ALIAS: Key alias
 * - HOPMED_RELEASE_KEY_PASSWORD: Key password
 */

/**
 * Adds release signing configuration to app/build.gradle
 */
const withReleaseSigningConfig = (config) => {
  return withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;

    // Check if release signing config already exists
    if (buildGradle.includes('signingConfigs.release')) {
      console.log('✅ Release signing config already exists in build.gradle');
      return config;
    }

    // Find the signingConfigs block
    const signingConfigsRegex = /signingConfigs\s*\{/;
    if (!signingConfigsRegex.test(buildGradle)) {
      console.warn('⚠️  No signingConfigs block found, cannot add release signing');
      return config;
    }

    // Add release signing config after debug config
    // All credentials must be provided via environment variables - no hardcoded fallbacks
    const releaseSigningConfig = `
        release {
            // Read from environment variables - CI/CD must provide these
            def keystoreFilePath = System.getenv("ANDROID_KEYSTORE_PATH") ?: System.getenv("HOPMED_RELEASE_STORE_FILE") ?: "../release.keystore"
            def keystorePass = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: System.getenv("HOPMED_RELEASE_STORE_PASSWORD")
            def aliasName = System.getenv("ANDROID_KEY_ALIAS") ?: System.getenv("HOPMED_RELEASE_KEY_ALIAS") ?: "release"
            def aliasPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: System.getenv("HOPMED_RELEASE_KEY_PASSWORD")

            if (!keystorePass) {
                throw new GradleException("ANDROID_KEYSTORE_PASSWORD environment variable is required for release builds")
            }
            if (!aliasPassword) {
                throw new GradleException("ANDROID_KEY_PASSWORD environment variable is required for release builds")
            }

            storeFile file(keystoreFilePath)
            storePassword keystorePass
            keyAlias aliasName
            keyPassword aliasPassword
        }`;

    // Find the debug config and add release config after it
    const debugConfigEndRegex = /(\s*debug\s*\{[^}]*\})/;
    buildGradle = buildGradle.replace(
      debugConfigEndRegex,
      `$1${releaseSigningConfig}`
    );

    // Update release buildType to use signingConfigs.release instead of signingConfigs.debug
    buildGradle = buildGradle.replace(
      /(release\s*\{[^}]*signingConfig\s+)signingConfigs\.debug/,
      '$1signingConfigs.release'
    );

    // If release buildType doesn't have signingConfig at all, add it
    if (!buildGradle.match(/release\s*\{[^}]*signingConfig/)) {
      buildGradle = buildGradle.replace(
        /(release\s*\{)/,
        `$1
            signingConfig signingConfigs.release`
      );
    }

    config.modResults.contents = buildGradle;
    console.log('✅ Added release signing configuration to build.gradle');
    return config;
  });
};

module.exports = (config) => {
  console.log('🔐 Applying release signing config plugin...');
  config = withReleaseSigningConfig(config);
  return config;
};

