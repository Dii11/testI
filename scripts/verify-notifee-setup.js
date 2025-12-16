#!/usr/bin/env node

/**
 * Notifee Setup Verification Script
 * 
 * Checks if Notifee is properly configured before running the app
 * Run: npm run verify:notifee
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

console.log('🔍 Verifying Notifee setup...\n');

let errors = [];
let warnings = [];
let passed = [];

// Check 1: Dependencies installed
console.log('📦 Checking dependencies...');
try {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
  );

  const requiredDeps = [
    '@notifee/react-native',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
  ];

  const optionalDeps = [
    'react-native-voip-push-notification',
  ];

  requiredDeps.forEach((dep) => {
    if (packageJson.dependencies[dep]) {
      passed.push(`✅ ${dep} installed (${packageJson.dependencies[dep]})`);
    } else {
      errors.push(`❌ ${dep} not installed`);
    }
  });

  optionalDeps.forEach((dep) => {
    if (packageJson.dependencies[dep]) {
      passed.push(`✅ ${dep} installed (${packageJson.dependencies[dep]})`);
    } else {
      warnings.push(`⚠️  ${dep} not installed (optional for iOS VoIP push)`);
    }
  });
} catch (error) {
  errors.push(`❌ Failed to read package.json: ${error.message}`);
}

// Check 2: Android google-services.json
console.log('\n🤖 Checking Android configuration...');
const googleServicesPath = path.join(projectRoot, 'google-services.json');
if (fs.existsSync(googleServicesPath)) {
  try {
    const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
    if (googleServices.project_info && googleServices.project_info.project_id) {
      passed.push(`✅ google-services.json found (project: ${googleServices.project_info.project_id})`);
    } else {
      warnings.push('⚠️  google-services.json exists but structure is unexpected');
    }
  } catch (error) {
    errors.push(`❌ Failed to parse google-services.json: ${error.message}`);
  }
} else {
  errors.push('❌ google-services.json not found (required for Android FCM)');
}

// Check 3: iOS GoogleService-Info.plist
console.log('\n🍎 Checking iOS configuration...');
const googleServiceInfoPath = path.join(projectRoot, 'ios', 'GoogleService-Info.plist');
if (fs.existsSync(googleServiceInfoPath)) {
  passed.push('✅ GoogleService-Info.plist found');
} else {
  warnings.push('⚠️  GoogleService-Info.plist not found (required for iOS push)');
}

// Check 4: NotifeeNotificationService exists
console.log('\n📱 Checking NotifeeNotificationService...');
const notifeeServicePath = path.join(projectRoot, 'src', 'services', 'NotifeeNotificationService.ts');
if (fs.existsSync(notifeeServicePath)) {
  passed.push('✅ NotifeeNotificationService.ts exists');
} else {
  errors.push('❌ NotifeeNotificationService.ts not found');
}

// Check 5: app.config.js plugin configuration
console.log('\n⚙️  Checking app.config.js...');
const appConfigPath = path.join(projectRoot, 'app.config.js');
if (fs.existsSync(appConfigPath)) {
  try {
    const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
    
    if (appConfigContent.includes('@notifee/react-native')) {
      passed.push('✅ Notifee plugin configured in app.config.js');
    } else {
      warnings.push('⚠️  Notifee plugin not found in app.config.js (may need to add)');
    }

    if (appConfigContent.includes('@react-native-firebase/app')) {
      passed.push('✅ Firebase plugin configured in app.config.js');
    } else {
      warnings.push('⚠️  Firebase plugin not found in app.config.js (may need to add)');
    }
  } catch (error) {
    errors.push(`❌ Failed to read app.config.js: ${error.message}`);
  }
} else {
  errors.push('❌ app.config.js not found');
}

// Print results
console.log('\n' + '='.repeat(60));
console.log('📊 Verification Results\n');

if (passed.length > 0) {
  console.log('✅ Passed:');
  passed.forEach((msg) => console.log(`   ${msg}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  warnings.forEach((msg) => console.log(`   ${msg}`));
}

if (errors.length > 0) {
  console.log('\n❌ Errors:');
  errors.forEach((msg) => console.log(`   ${msg}`));
}

console.log('\n' + '='.repeat(60));

// Exit code
if (errors.length > 0) {
  console.log('\n❌ Verification failed. Please fix the errors above.\n');
  console.log('💡 To install dependencies, run: npm run install-notifee');
  console.log('📖 See NOTIFEE_MIGRATION_GUIDE.md for setup instructions\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('\n⚠️  Verification passed with warnings.\n');
  console.log('💡 Optional: Install VoIP push for iOS CallKit support');
  console.log('📖 See NOTIFEE_MIGRATION_GUIDE.md for details\n');
  process.exit(0);
} else {
  console.log('\n✅ All checks passed! Notifee is properly configured.\n');
  console.log('🚀 You can now build and run the app\n');
  process.exit(0);
}
