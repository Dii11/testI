#!/usr/bin/env node

/**
 * Fastlane Setup Script for HopMed Mobile
 * 
 * Copies fastlane templates to ios/android directories after expo prebuild
 * Ensures environment variables are available for all deployment scenarios
 */

const fs = require('fs');
const path = require('path');

function copyFastlaneTemplates() {
  console.log('🚀 Setting up Fastlane configurations with environment loading...');
  
  const templates = [
    {
      src: 'fastlane-templates/ios/fastlane/Fastfile',
      dest: 'ios/fastlane/Fastfile',
      platform: 'iOS'
    },
    {
      src: 'fastlane-templates/android/fastlane/Fastfile', 
      dest: 'android/fastlane/Fastfile',
      platform: 'Android'
    }
  ];
  
  let copiedFiles = 0;
  
  for (const template of templates) {
    const srcPath = path.resolve(template.src);
    const destPath = path.resolve(template.dest);
    
    // Check if source template exists
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️  Template not found: ${template.src}`);
      continue;
    }
    
    // Create destination directory if it doesn't exist
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      console.log(`📁 Created directory: ${destDir}`);
    }
    
    try {
      // Copy template to destination
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ ${template.platform}: ${template.src} → ${template.dest}`);
      copiedFiles++;
      
    } catch (error) {
      console.error(`❌ Failed to copy ${template.platform} template:`, error.message);
    }
  }
  
  if (copiedFiles > 0) {
    console.log(`🎉 Successfully set up ${copiedFiles} Fastlane configuration(s) with environment loading`);
  } else {
    console.warn('⚠️  No Fastlane configurations were set up');
  }
  
  return copiedFiles > 0;
}

// Copy additional fastlane files if they exist
function copyAdditionalFastlaneFiles() {
  const additionalFiles = [
    {
      src: 'fastlane-templates/android/Gemfile',
      dest: 'android/Gemfile'
    },
    {
      src: 'fastlane-templates/android/fastlane/Appfile',
      dest: 'android/fastlane/Appfile'
    },
    {
      src: 'fastlane-templates/android/fastlane/Pluginfile',
      dest: 'android/fastlane/Pluginfile'
    }
  ];
  
  for (const file of additionalFiles) {
    const srcPath = path.resolve(file.src);
    const destPath = path.resolve(file.dest);
    
    if (fs.existsSync(srcPath)) {
      try {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        fs.copyFileSync(srcPath, destPath);
        console.log(`📄 Copied: ${file.src} → ${file.dest}`);
        
      } catch (error) {
        console.warn(`⚠️  Failed to copy ${file.src}:`, error.message);
      }
    }
  }
}

// Verify environment loader script exists
function verifyEnvironmentLoader() {
  const loaderPath = path.resolve('scripts/load-environment.js');
  
  if (!fs.existsSync(loaderPath)) {
    console.error('❌ Environment loader script not found: scripts/load-environment.js');
    console.error('💡 This script is required for Fastlane environment variable loading');
    return false;
  }
  
  console.log('✅ Environment loader script verified: scripts/load-environment.js');
  return true;
}

// Main execution
function main() {
  console.log('🔧 HopMed Fastlane Setup');
  console.log('=======================');
  
  // Verify dependencies
  if (!verifyEnvironmentLoader()) {
    process.exit(1);
  }
  
  // Copy templates
  const success = copyFastlaneTemplates();
  
  // Copy additional files
  copyAdditionalFastlaneFiles();
  
  if (success) {
    console.log('');
    console.log('🌍 Fastlane configurations now include:');
    console.log('  • Automatic environment variable loading');
    console.log('  • Support for all deployment scenarios');
    console.log('  • Validation of required secrets');
    console.log('');
    console.log('💡 Run fastlane commands from ios/ or android/ directories');
    console.log('💡 Environment variables will be loaded automatically');
  }
  
  return success;
}

// Run if called directly
if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = {
  copyFastlaneTemplates,
  verifyEnvironmentLoader
};