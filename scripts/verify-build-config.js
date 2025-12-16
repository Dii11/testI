#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying build configuration...\n');

// Check package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('📦 Package.json checks:');
console.log(`   ✅ expo-crypto: ${packageJson.dependencies['expo-crypto'] || '❌ Missing'}`);
console.log(`   ✅ expo-random: ${packageJson.dependencies['expo-random'] ? '❌ Still present' : '✅ Removed'}`);
console.log(`   ✅ Daily.co WebRTC: ${packageJson.dependencies['@daily-co/react-native-webrtc'] || '❌ Missing'}`);

// Check gradle.properties
const gradleProps = fs.readFileSync('android/gradle.properties', 'utf8');
console.log('\n🔧 Gradle properties checks:');
console.log(`   ✅ compileSdkVersion: ${gradleProps.includes('android.compileSdkVersion=35') ? '✅ Set' : '❌ Missing'}`);
console.log(`   ✅ targetSdkVersion: ${gradleProps.includes('android.targetSdkVersion=34') ? '✅ Set' : '❌ Missing'}`);
console.log(`   ✅ minSdkVersion: ${gradleProps.includes('android.minSdkVersion=26') ? '✅ Set' : '❌ Missing'}`);
console.log(`   ✅ buildToolsVersion: ${gradleProps.includes('android.buildToolsVersion=35.0.0') ? '✅ Set' : '❌ Missing'}`);
console.log(`   ✅ kotlinVersion: ${gradleProps.includes('android.kotlinVersion=2.0.21') ? '✅ Set' : '❌ Missing'}`);
console.log(`   ✅ enableJetifier: ${gradleProps.includes('android.enableJetifier=true') ? '✅ Set' : '❌ Missing'}`);
console.log(`   ✅ parallel builds: ${gradleProps.includes('org.gradle.parallel=true') ? '✅ Set' : '❌ Missing'}`);

// Check settings.gradle
const settingsGradle = fs.readFileSync('android/settings.gradle', 'utf8');
console.log('\n⚙️  Settings.gradle checks:');
console.log(`   ✅ expoAutolinking.useExpoModules(): ${settingsGradle.includes('expoAutolinking.useExpoModules()') ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ beforeProject configuration: ${settingsGradle.includes('gradle.beforeProject') ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ Daily.co dependency resolution: ${settingsGradle.includes('com.github.jiangdongguo:AndroidUSBCamera') ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ Material design dependency: ${settingsGradle.includes('com.google.android.material:material:1.12.0') ? '✅ Present' : '❌ Missing'}`);

// Check app.json
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
console.log('\n📱 App.json checks:');
console.log(`   ✅ with-fix-expo-random plugin: ${appJson.expo.plugins.some(p => typeof p === 'string' && p.includes('with-fix-expo-random')) ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ with-fix-daily-webrtc plugin: ${appJson.expo.plugins.some(p => typeof p === 'string' && p.includes('with-fix-daily-webrtc')) ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ with-fix-dependency-conflicts plugin: ${appJson.expo.plugins.some(p => typeof p === 'string' && p.includes('with-fix-dependency-conflicts')) ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ Daily.co plugin configuration: ${appJson.expo.plugins.some(p => Array.isArray(p) && p[0] === '@daily-co/config-plugin-rn-daily-js') ? '✅ Present' : '❌ Missing'}`);

// Check metro.config.js
const metroConfig = fs.readFileSync('metro.config.js', 'utf8');
console.log('\n🚇 Metro config checks:');
console.log(`   ✅ expo-random alias: ${metroConfig.includes("'expo-random': 'expo-crypto'") ? '✅ Present' : '❌ Missing'}`);

// Check eas.json
const easJson = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
console.log('\n☁️  EAS config checks:');
console.log(`   ✅ EXPO_USE_COMMUNITY_AUTOLINKING: ${easJson.build.preview.android.env?.EXPO_USE_COMMUNITY_AUTOLINKING === '0' ? '✅ Set' : '❌ Missing'}`);

// Check android/build.gradle
const buildGradle = fs.readFileSync('android/build.gradle', 'utf8');
console.log('\n🔨 Build.gradle checks:');
console.log(`   ✅ JitPack repositories: ${buildGradle.includes('jitpack.io') ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ Dependency resolution strategy: ${buildGradle.includes('resolutionStrategy') ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ Material design forced version: ${buildGradle.includes('com.google.android.material:material:1.12.0') ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ Core KTX forced version: ${buildGradle.includes('androidx.core:core-ktx:1.13.1') ? '✅ Present' : '❌ Missing'}`);

// Check android/app/build.gradle
const appBuildGradle = fs.readFileSync('android/app/build.gradle', 'utf8');
console.log('\n📱 App build.gradle checks:');
console.log(`   ✅ Dependency constraints: ${appBuildGradle.includes('constraints') ? '✅ Present' : '❌ Missing'}`);
console.log(`   ✅ Material design constraint: ${appBuildGradle.includes('com.google.android.material:material:1.12.0') ? '✅ Present' : '❌ Missing'}`);

console.log('\n🎉 Build configuration verification complete!');
console.log('\n📋 Next steps:');
console.log('   1. Run: ./scripts/clean-and-build.sh');
console.log('   2. Run: eas build --clear-cache --profile preview --platform android');
console.log('\n💡 If any checks failed, review the BUILD_FIXES_SUMMARY.md file for details.');
