#!/usr/bin/env node

/**
 * Universal Environment Loader for HopMed Mobile
 * 
 * This script ensures environment variables are available for all build scenarios:
 * - Expo Go development
 * - Local builds (expo build)
 * - EAS builds
 * - Fastlane deployments
 * - GitLab CI/CD builds
 */

const fs = require('fs');
const path = require('path');

function loadEnvironmentForScenario() {
  const scenario = detectBuildScenario();
  console.log(`🔧 Loading environment for scenario: ${scenario}`);
  
  switch (scenario) {
    case 'expo-go':
      return loadExpoGoEnvironment();
    case 'local-build':
      return loadLocalBuildEnvironment();
    case 'eas-build':
      return loadEASBuildEnvironment();
    case 'fastlane':
      return loadFastlaneEnvironment();
    case 'gitlab-ci':
      return loadGitLabCIEnvironment();
    default:
      return loadDefaultEnvironment();
  }
}

function detectBuildScenario() {
  // GitLab CI detection
  if (process.env.GITLAB_CI) {
    return 'gitlab-ci';
  }
  
  // EAS build detection
  if (process.env.EAS_BUILD) {
    return 'eas-build';
  }
  
  // Fastlane detection
  if (process.env.FASTLANE_SKIP_UPDATE_CHECK || process.env.FL_OUTPUT_DIR) {
    return 'fastlane';
  }
  
  // Expo Go detection (when running expo start)
  if (process.env.EXPO_DEVTOOLS_LISTEN_ADDRESS || process.argv.includes('start')) {
    return 'expo-go';
  }
  
  // Local build detection
  if (process.argv.includes('build') || process.env.EXPO_BUILD_LOCAL) {
    return 'local-build';
  }
  
  return 'default';
}

function loadExpoGoEnvironment() {
  console.log('📱 Loading environment for Expo Go development');
  
  // Priority order for Expo Go:
  // 1. .env.local (personal dev settings)
  // 2. environments/.env.local
  // 3. environments/.env.development
  // 4. .env (fallback)
  
  const envFiles = [
    '.env.local',
    'environments/.env.local', 
    'environments/.env.development',
    '.env'
  ];
  
  return loadEnvironmentFiles(envFiles);
}

function loadLocalBuildEnvironment() {
  console.log('🏗️ Loading environment for local build');
  
  // For local builds, load from environment-specific files
  const nodeEnv = process.env.NODE_ENV || process.env.HOPMED_BUILD_ENVIRONMENT || 'development';
  
  const envFiles = [
    `.env.local`,
    `environments/.env.${nodeEnv}`,
    `environments/.env.development`,
    '.env'
  ];
  
  return loadEnvironmentFiles(envFiles);
}

function loadEASBuildEnvironment() {
  console.log('☁️ Loading environment for EAS build');
  
  // EAS builds get environment variables from:
  // 1. EAS build profile environment variables (highest priority)
  // 2. Environment-specific files as fallback
  
  const profile = process.env.EAS_BUILD_PROFILE || 'development';
  console.log(`📦 EAS build profile: ${profile}`);
  
  // EAS variables are already in process.env, but load templates for non-secrets
  const envFiles = [
    `environments/.env.${profile}`,
    'environments/.env.development'
  ];
  
  return loadEnvironmentFiles(envFiles, false); // Don't override EAS variables
}

function loadFastlaneEnvironment() {
  console.log('🚀 Loading environment for Fastlane deployment');
  
  // Fastlane builds should use GitLab CI variables or local environment
  const environment = process.env.HOPMED_BUILD_ENVIRONMENT || 
                     process.env.FASTLANE_ENV || 
                     'development';
  
  const envFiles = [
    `environments/.env.${environment}`,
    'environments/.env.development'
  ];
  
  return loadEnvironmentFiles(envFiles, false); // Don't override CI variables
}

function loadGitLabCIEnvironment() {
  console.log('🦊 Loading environment for GitLab CI/CD');
  
  // GitLab CI variables are already in process.env (highest priority)
  // Load templates only for structure validation
  const environment = process.env.HOPMED_BUILD_ENVIRONMENT || 'production';
  
  console.log(`🌍 GitLab CI environment: ${environment}`);
  
  // Don't override GitLab variables, just validate structure
  const envFiles = [
    `environments/.env.${environment}`,
    'environments/.env.development'
  ];
  
  return loadEnvironmentFiles(envFiles, false); // Don't override CI variables
}

function loadDefaultEnvironment() {
  console.log('⚙️ Loading default environment');
  
  const envFiles = [
    '.env.local',
    'environments/.env.local',
    'environments/.env.development',
    '.env'
  ];
  
  return loadEnvironmentFiles(envFiles);
}

function loadEnvironmentFiles(filePaths, override = true) {
  const loadedFiles = [];
  const loadedVars = {};
  
  for (const filePath of filePaths) {
    const fullPath = path.resolve(filePath);
    
    if (fs.existsSync(fullPath)) {
      try {
        // Parse the .env file manually to avoid overriding existing process.env
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
              
              // Only set if not already set (unless override is true)
              if (override || !process.env[key]) {
                process.env[key] = value;
                loadedVars[key] = value;
              }
            }
          }
        }
        
        loadedFiles.push(filePath);
        console.log(`✅ Loaded: ${filePath}`);
        
      } catch (error) {
        console.warn(`⚠️ Failed to load ${filePath}:`, error.message);
      }
    }
  }
  
  if (loadedFiles.length === 0) {
    console.warn('⚠️ No environment files found - using process.env and defaults');
  }
  
  return {
    loadedFiles,
    loadedVars,
    scenario: detectBuildScenario()
  };
}

// Validation function
function validateEnvironment() {
  const requiredVars = [
    'HOPMED_BUILD_ENVIRONMENT',
    'HOPMED_API_BASE_URL'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    return false;
  }
  
  console.log('✅ Environment validation passed');
  return true;
}

// Export for use as module
module.exports = {
  loadEnvironmentForScenario,
  validateEnvironment,
  detectBuildScenario
};

// Run if called directly
if (require.main === module) {
  const result = loadEnvironmentForScenario();
  console.log('🌍 Environment loading complete:', {
    scenario: result.scenario,
    filesLoaded: result.loadedFiles.length,
    varsLoaded: Object.keys(result.loadedVars).length
  });
  
  const isValid = validateEnvironment();
  process.exit(isValid ? 0 : 1);
}