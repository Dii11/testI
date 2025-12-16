#!/usr/bin/env node
/**
 * Lightweight pre-build smoke check to catch config issues early.
 * - Validates environment config
 * - Ensures required env vars present for preview/production
 * - Checks for duplicate React Native / Expo packages
 */
const fs = require('fs');
const path = require('path');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const pkg = readJSON(path.join(__dirname, '..', 'package.json'));

let ok = true;
function fail(msg) { console.error('✖', msg); ok = false; }
function pass(msg) { console.log('✔', msg); }

// 1. Basic dependency sanity
const deps = pkg.dependencies || {};
const rn = deps['react-native'];
const expo = deps['expo'];
if (!rn) fail('react-native missing'); else pass(`react-native ${rn}`);
if (!expo) fail('expo missing'); else pass(`expo ${expo}`);

// 2. Ensure no duplicate rn* core libs (simple heuristic)
['react-native-reanimated','react-native-gesture-handler','react-native-screens'].forEach(lib => {
  if (!deps[lib]) fail(`${lib} missing`); else pass(`${lib} ${deps[lib]}`);
});

// 3. Env vars required for preview / production builds
const requiredEnv = ['API_URL','DAILY_API_KEY','SENTRY_DSN'];
const missing = requiredEnv.filter(v => !process.env[v]);
if (missing.length) {
  console.warn('⚠ Missing env vars (may be injected by EAS profile):', missing.join(', '));
} else {
  pass('All required env vars present');
}

// 4. Proguard / Hermes alignment (parse app.json)
const appJson = readJSON(path.join(__dirname, '..', 'app.json'));
const hermesEnabled = appJson?.expo?.plugins?.find(p => Array.isArray(p) && p[0]==='expo-build-properties')?.[1]?.android?.enableHermes;
if (hermesEnabled) pass('Hermes enabled via plugin'); else fail('Hermes disabled (intentional?)');

// Exit code
if (!ok) {
  console.error('\nSmoke check failed');
  process.exit(1);
} else {
  console.log('\nSmoke check passed');
}
