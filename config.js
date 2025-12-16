/**
 * 🔧 API Configuration Script
 *
 * This script allows you to easily switch between different API environments.
 * Run this script to update the API URL across your entire app.
 *
 * Usage:
 *   node config.js local      # Switch to local development
 *   node config.js staging    # Switch to staging
 *   node config.js production # Switch to production
 *   node config.js custom     # Use custom URL (prompts for input)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Available environments
const ENVIRONMENTS = {
  local: 'http://141.94.71.13:3001/api/v1',
  staging: 'http://141.94.71.13:3001/api/v1',
  production: 'http://141.94.71.13:3001/api/v1',
  current: 'http://141.94.71.13:3001/api/v1', // Current server - LOCAL DEV
};

// Files to update
const FILES_TO_UPDATE = [
  {
    path: 'src/constants/index.ts',
    updateFunction: updateConstantsFile,
  },
  {
    path: 'app.json',
    updateFunction: updateAppJson,
  },
  {
    path: 'jest.setup.js',
    updateFunction: updateJestSetup,
  },
];

function updateConstantsFile(filePath, newUrl) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Update the BASE_URL line
  content = content.replace(/BASE_URL: '[^']*'/, `BASE_URL: '${newUrl}'`);

  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${filePath}`);
}

function updateAppJson(filePath, newUrl) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  content.expo.extra.apiUrl = newUrl;

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  console.log(`✅ Updated ${filePath}`);
}

function updateJestSetup(filePath, newUrl) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Update the apiUrl in jest mock
  content = content.replace(/apiUrl: '[^']*'/, `apiUrl: '${newUrl}'`);

  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${filePath}`);
}

async function promptForCustomUrl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question('Enter custom API URL (e.g., https://your-api.com/api/v1): ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const environment = process.argv[2];

  if (!environment) {
    console.log('🔧 HopMed API Configuration');
    console.log('');
    console.log('Available environments:');
    Object.entries(ENVIRONMENTS).forEach(([env, url]) => {
      console.log(`  ${env.padEnd(12)} ${url}`);
    });
    console.log('');
    console.log('Usage: node config.js <environment>');
    console.log('Example: node config.js local');
    return;
  }

  let newUrl;

  if (environment === 'custom') {
    newUrl = await promptForCustomUrl();
    if (!newUrl) {
      console.log('❌ No URL provided');
      return;
    }
  } else if (ENVIRONMENTS[environment]) {
    newUrl = ENVIRONMENTS[environment];
  } else {
    console.log(`❌ Unknown environment: ${environment}`);
    console.log('Available environments:', Object.keys(ENVIRONMENTS).join(', '));
    return;
  }

  console.log(`🔄 Switching API to: ${newUrl}`);
  console.log('');

  // Update all files
  for (const file of FILES_TO_UPDATE) {
    const fullPath = path.join(__dirname, file.path);
    if (fs.existsSync(fullPath)) {
      file.updateFunction(fullPath, newUrl);
    } else {
      console.log(`⚠️  File not found: ${file.path}`);
    }
  }

  console.log('');
  console.log('✅ API configuration updated successfully!');
  console.log('💡 Restart your development server to apply changes.');
}

main().catch(console.error);
