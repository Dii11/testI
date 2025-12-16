#!/usr/bin/env node

/**
 * 🌍 Environment Management Script for HopMed Mobile
 * 
 * This script helps manage environment configurations for different deployment targets.
 * It provides utilities to switch between environments, validate configurations,
 * and set up new development environments.
 * 
 * Usage:
 *   node scripts/manage-environments.js <command> [options]
 * 
 * Commands:
 *   switch <env>     Switch to a specific environment
 *   validate [env]   Validate environment configuration  
 *   list            List available environments
 *   setup <env>     Set up a new environment configuration
 *   status          Show current environment status
 *   help            Show this help message
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Available environments
const ENVIRONMENTS = {
  local: {
    name: 'Local Development',
    description: 'Local development with localhost API',
    file: 'environments/.env.local',
    safe: true,
  },
  development: {
    name: 'Development',
    description: 'Development builds with remote API',
    file: 'environments/.env.development', 
    safe: true,
  },
  staging: {
    name: 'Staging',
    description: 'Pre-production testing environment',
    file: 'environments/.env.staging',
    safe: false,
  },
  production: {
    name: 'Production',
    description: 'Live production environment',
    file: 'environments/.env.production',
    safe: false,
  },
};

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'white') {
  console.log(colorize(color, message));
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * Switch to a specific environment
 */
function switchEnvironment(envName) {
  if (!ENVIRONMENTS[envName]) {
    error(`Unknown environment: ${envName}`);
    log('Available environments:');
    Object.keys(ENVIRONMENTS).forEach(env => {
      log(`  - ${env}: ${ENVIRONMENTS[env].description}`);
    });
    process.exit(1);
  }

  const env = ENVIRONMENTS[envName];
  const sourcePath = path.join(process.cwd(), env.file);
  const targetPath = path.join(process.cwd(), '.env');

  // Check if source file exists
  if (!fs.existsSync(sourcePath)) {
    error(`Environment file not found: ${env.file}`);
    info(`Run 'node scripts/manage-environments.js setup ${envName}' to create it.`);
    process.exit(1);
  }

  // Warn for non-safe environments
  if (!env.safe) {
    warning(`Switching to ${env.name} environment!`);
    warning('This environment may contain production secrets.');
    log('Make sure you understand the implications before proceeding.');
    log('');
  }

  try {
    // Copy environment file
    fs.copyFileSync(sourcePath, targetPath);
    
    success(`Switched to ${env.name} environment`);
    info(`Active configuration: ${env.file} -> .env`);
    
    // Show environment status
    showEnvironmentStatus();
    
  } catch (err) {
    error(`Failed to switch environment: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Validate environment configuration
 */
function validateEnvironment(envName) {
  let configFile;
  
  if (envName) {
    if (!ENVIRONMENTS[envName]) {
      error(`Unknown environment: ${envName}`);
      process.exit(1);
    }
    configFile = path.join(process.cwd(), ENVIRONMENTS[envName].file);
  } else {
    configFile = path.join(process.cwd(), '.env');
  }

  if (!fs.existsSync(configFile)) {
    error(`Configuration file not found: ${configFile}`);
    process.exit(1);
  }

  log(`🔍 Validating configuration: ${configFile}`);
  log('');

  try {
    // Load environment file
    const envContent = fs.readFileSync(configFile, 'utf8');
    const envVars = parseEnvFile(envContent);
    
    // Basic validations
    let issues = 0;
    let warnings = 0;

    // Check required variables
    const requiredVars = [
      'HOPMED_BUILD_ENVIRONMENT',
      'HOPMED_API_BASE_URL',
      'HOPMED_VIDEO_DAILY_API_KEY',
    ];

    requiredVars.forEach(varName => {
      if (!envVars[varName] || envVars[varName].trim() === '') {
        error(`Missing required variable: ${varName}`);
        issues++;
      } else if (envVars[varName].includes('REPLACE_WITH_') || envVars[varName].includes('your_')) {
        warning(`${varName} appears to be a placeholder value`);
        warnings++;
      }
    });

    // Validate API URL
    if (envVars.HOPMED_API_BASE_URL) {
      try {
        const url = new URL(envVars.HOPMED_API_BASE_URL);
        
        if (envVars.HOPMED_BUILD_ENVIRONMENT === 'production' && url.protocol !== 'https:') {
          error('Production environment must use HTTPS API URL');
          issues++;
        }
        
        success(`API URL: ${envVars.HOPMED_API_BASE_URL}`);
      } catch {
        error(`Invalid API URL format: ${envVars.HOPMED_API_BASE_URL}`);
        issues++;
      }
    }

    // Check environment consistency
    const declaredEnv = envVars.HOPMED_BUILD_ENVIRONMENT;
    if (envName && declaredEnv !== envName) {
      warning(`Environment mismatch: file declares '${declaredEnv}' but validating '${envName}'`);
      warnings++;
    }

    // Summary
    log('');
    log('📊 Validation Summary:');
    log(`   Environment: ${declaredEnv || 'not set'}`);
    log(`   Issues: ${issues}`);
    log(`   Warnings: ${warnings}`);
    
    if (issues === 0) {
      success('Configuration is valid!');
    } else {
      error(`Configuration has ${issues} issue(s) that need attention.`);
      process.exit(1);
    }
    
    if (warnings > 0) {
      warning(`${warnings} warning(s) found - please review.`);
    }

  } catch (err) {
    error(`Validation failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * List available environments
 */
function listEnvironments() {
  log('🌍 Available Environments:');
  log('');
  
  Object.entries(ENVIRONMENTS).forEach(([key, env]) => {
    const exists = fs.existsSync(path.join(process.cwd(), env.file));
    const status = exists ? colorize('green', '✓') : colorize('red', '✗');
    const safety = env.safe ? colorize('green', 'safe') : colorize('yellow', 'sensitive');
    
    log(`  ${status} ${key.padEnd(12)} ${env.name.padEnd(20)} [${safety}]`);
    log(`    ${colorize('cyan', env.description)}`);
    log(`    ${colorize('purple', `File: ${env.file}`)}`);
    log('');
  });
}

/**
 * Set up a new environment configuration  
 */
function setupEnvironment(envName) {
  if (!ENVIRONMENTS[envName]) {
    error(`Unknown environment: ${envName}`);
    process.exit(1);
  }

  const env = ENVIRONMENTS[envName];
  const configPath = path.join(process.cwd(), env.file);
  const examplePath = path.join(process.cwd(), 'environments/.env.example');

  // Check if it already exists
  if (fs.existsSync(configPath)) {
    warning(`Environment already exists: ${env.file}`);
    log('Use the validate command to check its configuration.');
    return;
  }

  // Check if example exists
  if (!fs.existsSync(examplePath)) {
    error('Environment example file not found: environments/.env.example');
    info('This file should contain the template for all environment variables.');
    process.exit(1);
  }

  try {
    // Copy example file
    fs.copyFileSync(examplePath, configPath);
    
    // Update environment-specific values
    let content = fs.readFileSync(configPath, 'utf8');
    
    // Set the environment name
    content = content.replace(
      /HOPMED_BUILD_ENVIRONMENT=.*/,
      `HOPMED_BUILD_ENVIRONMENT=${envName}`
    );
    
    // Set environment-specific API URL based on environment
    const apiUrls = {
      local: 'http://localhost:3001/api/v1',
      development: 'http://141.94.71.13:3001/api/v1',
      staging: 'https://staging-api.hopmed.com/api/v1',
      production: 'https://api.hopmed.com/api/v1',
    };
    
    if (apiUrls[envName]) {
      content = content.replace(
        /HOPMED_API_BASE_URL=.*/,
        `HOPMED_API_BASE_URL=${apiUrls[envName]}`
      );
    }

    fs.writeFileSync(configPath, content);
    
    success(`Created ${env.name} environment: ${env.file}`);
    info('Please edit the file to add your specific configuration values.');
    
    if (!env.safe) {
      warning('This is a sensitive environment!');
      warning('Make sure to use EAS secrets for production/staging deployments.');
    }

  } catch (err) {
    error(`Failed to setup environment: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Show current environment status
 */
function showEnvironmentStatus() {
  const envPath = path.join(process.cwd(), '.env');
  
  log('📋 Current Environment Status:');
  log('');
  
  if (!fs.existsSync(envPath)) {
    warning('No active environment configuration (.env file not found)');
    info('Run "switch" command to activate an environment.');
    return;
  }

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const envVars = parseEnvFile(content);
    
    const environment = envVars.HOPMED_BUILD_ENVIRONMENT || 'unknown';
    const apiUrl = envVars.HOPMED_API_BASE_URL || 'not set';
    const debugMode = envVars.HOPMED_DEBUG_MODE || 'not set';
    
    log(`  Environment: ${colorize('cyan', environment)}`);
    log(`  API URL: ${colorize('purple', apiUrl)}`);
    log(`  Debug Mode: ${colorize(debugMode === 'true' ? 'yellow' : 'green', debugMode)}`);
    
    // Check for secrets
    const secrets = [
      'HOPMED_VIDEO_DAILY_API_KEY',
      'HOPMED_SENTRY_DSN',
      'HOPMED_AUTH_JWT_SECRET',
    ];
    
    log('');
    log('🔐 Secrets Status:');
    secrets.forEach(secret => {
      const hasSecret = envVars[secret] && !envVars[secret].includes('REPLACE_WITH_');
      const status = hasSecret ? colorize('green', '✓') : colorize('red', '✗');
      log(`  ${status} ${secret}`);
    });

  } catch (err) {
    error(`Failed to read environment status: ${err.message}`);
  }
}

/**
 * Parse environment file content
 */
function parseEnvFile(content) {
  const envVars = {};
  const lines = content.split('\n');
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return envVars;
}

/**
 * Show help message
 */
function showHelp() {
  log('🌍 HopMed Environment Management');
  log('');
  log('Usage: node scripts/manage-environments.js <command> [options]');
  log('');
  log('Commands:');
  log('  switch <env>     Switch to a specific environment (.env.local, .env.development, etc.)');
  log('  validate [env]   Validate environment configuration (current .env or specific environment)'); 
  log('  list            List all available environments with their status');
  log('  setup <env>     Create a new environment configuration from template');
  log('  status          Show current active environment status');
  log('  help            Show this help message');
  log('');
  log('Examples:');
  log('  node scripts/manage-environments.js switch local');
  log('  node scripts/manage-environments.js validate production');
  log('  node scripts/manage-environments.js setup staging');
  log('  node scripts/manage-environments.js status');
  log('');
}

// Main script logic
function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'switch':
      if (!arg) {
        error('Please specify an environment to switch to.');
        info('Available: ' + Object.keys(ENVIRONMENTS).join(', '));
        process.exit(1);
      }
      switchEnvironment(arg);
      break;

    case 'validate':
      validateEnvironment(arg);
      break;

    case 'list':
      listEnvironments();
      break;

    case 'setup':
      if (!arg) {
        error('Please specify an environment to setup.');
        info('Available: ' + Object.keys(ENVIRONMENTS).join(', '));
        process.exit(1);
      }
      setupEnvironment(arg);
      break;

    case 'status':
      showEnvironmentStatus();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      if (!command) {
        showHelp();
      } else {
        error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
      }
  }
}

// Run main function
main();