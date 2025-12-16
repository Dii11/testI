#!/usr/bin/env node

/**
 * Quick Timeout Configuration Test
 * Tests if environment variables are loading correctly
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 Testing timeout configuration...\n');

// Test 1: Check if .env.local has timeout values
console.log('1. Checking .env.local file:');
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const timeoutVars = [
    'HOPMED_INIT_TIMEOUT',
    'HOPMED_SPLASH_TIMEOUT', 
    'HOPMED_REDUX_PERSIST_TIMEOUT',
    'HOPMED_PERMISSION_TIMEOUT'
  ];
  
  timeoutVars.forEach(varName => {
    const match = envContent.match(new RegExp(`${varName}=(\\d+)`));
    if (match) {
      console.log(`   ✅ ${varName}: ${match[1]}ms`);
    } else {
      console.log(`   ❌ ${varName}: Not found`);
    }
  });
} catch (error) {
  console.log('   ❌ Could not read .env.local:', error.message);
}

console.log('');

// Test 2: Simulate environment loading
console.log('2. Simulating environment variable loading:');

// Load environment like the app does
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const expectedTimeouts = {
  HOPMED_INIT_TIMEOUT: process.env.HOPMED_INIT_TIMEOUT || '15000',
  HOPMED_SPLASH_TIMEOUT: process.env.HOPMED_SPLASH_TIMEOUT || '10000', 
  HOPMED_REDUX_PERSIST_TIMEOUT: process.env.HOPMED_REDUX_PERSIST_TIMEOUT || '12000',
  HOPMED_PERMISSION_TIMEOUT: process.env.HOPMED_PERMISSION_TIMEOUT || '8000'
};

Object.entries(expectedTimeouts).forEach(([key, value]) => {
  const isFromEnv = process.env[key] !== undefined;
  const status = isFromEnv ? '✅ (from env)' : '⚠️ (default)';
  console.log(`   ${status} ${key}: ${value}ms`);
});

console.log('');

// Test 3: Check if timeout values will prevent infinite loading
console.log('3. Timeout validation:');
const timeouts = Object.values(expectedTimeouts).map(v => parseInt(v));
const allValid = timeouts.every(t => t > 0 && t < 60000);
console.log(`   ${allValid ? '✅' : '❌'} All timeouts are valid (${timeouts.join(', ')}ms)`);

if (allValid) {
  console.log('   ✅ App should not freeze on launch');
} else {
  console.log('   ❌ Invalid timeouts may cause app to freeze');
}

console.log('\n🎉 Timeout test complete!');