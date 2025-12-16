const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// SVG transformer configuration
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// Path alias for src directory
config.resolver.alias = {
  ...config.resolver.alias,
  '@': require('path').resolve(__dirname, 'src'),
  'expo-random': 'expo-crypto',
};

// Exclude environment files from bundling
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /\.env\.fastlane.*$/,
  /\.env\.local$/,
  /\.env\.example$/,
  /\.env\.template$/,
];

module.exports = config;
