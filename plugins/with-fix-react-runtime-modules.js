/**
 * Expo Config Plugin: Fix React Runtime Module Redefinition
 *
 * PROBLEM:
 * React Native 0.79.x with New Architecture + modular headers (required for Firebase)
 * creates duplicate module definitions. Both React-jsitooling and React-RuntimeCore
 * define 'react_runtime' module, causing "Redefinition of module 'react_runtime'" error.
 *
 * SOLUTION:
 * This plugin adds a post_install hook to the Podfile that renames the jsitooling
 * module to 'react_jsitooling' to avoid the conflict.
 *
 * USAGE:
 * Add to app.config.js plugins array:
 * plugins: [
 *   './plugins/with-fix-react-runtime-modules.js',
 *   // ... other plugins
 * ]
 */

const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withFixReactRuntimeModules = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.warn('⚠️  Podfile not found, skipping react_runtime module fix');
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if our fix is already applied
      if (podfileContent.includes('FIX: Resolve "Redefinition of module \'react_runtime\'" error')) {
        console.log('✅ React runtime module fix already applied');
        return config;
      }

      // Find the post_install hook
      const postInstallRegex = /(post_install do \|installer\|[\s\S]*?)(\n  end\nend)/;

      if (!postInstallRegex.test(podfileContent)) {
        console.warn('⚠️  Could not find post_install hook in Podfile');
        return config;
      }

      // Add our fix before the end of post_install
      const fixCode = `

    # FIX: Resolve "Redefinition of module" errors
    # React Native 0.79.x with New Architecture + modular headers creates duplicate module definitions
    # Solution: Replace conflicting modulemaps with non-conflicting stubs
    puts "🔧 [Config Plugin] Fixing duplicate module definitions..."

    # Fix 1: react_runtime conflict (React-jsitooling vs React-RuntimeCore)
    jsitooling_modulemap = File.join(__dir__, 'Pods/Headers/Public/react_runtime/React-jsitooling.modulemap')
    if File.exist?(jsitooling_modulemap)
      stub_content = <<~MODULEMAP
        module react_jsitooling {
          header "React-jsitooling-umbrella.h"
          export *
        }
      MODULEMAP
      File.write(jsitooling_modulemap, stub_content)
      puts "✅ Fixed react_jsitooling modulemap"
    end

    source_jsitooling = File.join(__dir__, 'Pods/Target Support Files/React-jsitooling/React-jsitooling.modulemap')
    if File.exist?(source_jsitooling)
      stub_content = <<~MODULEMAP
        module react_jsitooling {
          header "React-jsitooling-umbrella.h"
          export *
        }
      MODULEMAP
      File.write(source_jsitooling, stub_content)
      puts "✅ Fixed source react_jsitooling modulemap"
    end

    # Fix 2: ReactCommon conflict (React-RuntimeApple vs ReactCommon)
    runtime_apple_modulemap = File.join(__dir__, 'Pods/Headers/Public/ReactCommon/React-RuntimeApple.modulemap')
    if File.exist?(runtime_apple_modulemap)
      stub_content = <<~MODULEMAP
        module React_RuntimeApple {
          header "React-RuntimeApple-umbrella.h"
          export *
        }
      MODULEMAP
      File.write(runtime_apple_modulemap, stub_content)
      puts "✅ Fixed React-RuntimeApple modulemap"
    end

    source_runtime_apple = File.join(__dir__, 'Pods/Target Support Files/React-RuntimeApple/React-RuntimeApple.modulemap')
    if File.exist?(source_runtime_apple)
      stub_content = <<~MODULEMAP
        module React_RuntimeApple {
          header "React-RuntimeApple-umbrella.h"
          export *
        }
      MODULEMAP
      File.write(source_runtime_apple, stub_content)
      puts "✅ Fixed source React-RuntimeApple modulemap"
    end`;

      podfileContent = podfileContent.replace(
        postInstallRegex,
        (match, p1, p2) => p1 + fixCode + p2
      );

      fs.writeFileSync(podfilePath, podfileContent);
      console.log('✅ Added react_runtime module fix to Podfile');

      return config;
    },
  ]);
};

module.exports = withFixReactRuntimeModules;
