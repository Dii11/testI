/**
 * Verification Script for Adaptive System Fixes
 *
 * Run this in your app to verify the fixes are working correctly
 * Add this to your App.tsx or a debug screen
 */

import deviceCapabilityService from './src/services/deviceCapabilityService';
import adaptiveTheme from './src/theme/adaptiveTheme';
import { getDeviceOverride } from './src/config/deviceDatabase';

export async function verifyAdaptiveFixes() {
  console.log('🔍 Starting Adaptive System Verification...\n');

  // Wait for initialization
  await deviceCapabilityService.initialize();
  await adaptiveTheme.initialize();

  // Get capabilities
  const caps = deviceCapabilityService.getCapabilities();
  const theme = adaptiveTheme.getTheme();

  console.log('📱 Device Information:');
  console.log('  Model:', caps.model);
  console.log('  Manufacturer:', caps.manufacturer);
  console.log('  API Level:', caps.apiLevel);
  console.log('  Total Memory:', caps.totalMemoryMB + 'MB');
  console.log('  CPU Cores:', caps.cpuCores);
  console.log('');

  console.log('🎯 Performance Classification:');
  console.log('  Tier:', caps.tier.toUpperCase());
  console.log('  Benchmark Score:', deviceCapabilityService.getBenchmarkScore().toFixed(2));
  console.log('  Is Low-End:', caps.isLowEndDevice ? 'YES' : 'NO');
  console.log('');

  console.log('🎨 Rendering Capabilities:');
  console.log('  Gradients:', caps.supportsGradients ? '✅ ENABLED' : '❌ DISABLED');
  console.log('  Shadows:', caps.supportsShadows ? '✅ ENABLED' : '❌ DISABLED');
  console.log('  Glass Effects:', theme.colors.glass.enabled ? '✅ ENABLED' : '❌ DISABLED');
  console.log('  Complex Animations:', caps.supportsComplexAnimations ? '✅ ENABLED' : '❌ DISABLED');
  console.log('  Blur Effects:', caps.supportsBlur ? '✅ ENABLED' : '❌ DISABLED');
  console.log('');

  console.log('⚙️ Animation Settings:');
  console.log('  Enabled:', theme.animations.enabled ? 'YES' : 'NO');
  console.log('  Reduced Motion:', theme.performance.animations.reducedMotion ? 'YES' : 'NO');
  console.log('  Duration (normal):', theme.animations.duration.normal + 'ms');
  console.log('  Use Native Driver:', theme.performance.animations.useNativeDriver ? 'YES' : 'NO');
  console.log('  Transforms:', theme.animations.transforms.enabled ? 'YES' : 'NO');
  console.log('');

  console.log('📊 FlatList Optimizations:');
  const flatListOpts = adaptiveTheme.getFlatListOptimizations();
  console.log('  Remove Clipped Subviews:', flatListOpts.removeClippedSubviews ? 'YES' : 'NO');
  console.log('  Max to Render per Batch:', flatListOpts.maxToRenderPerBatch);
  console.log('  Initial Num to Render:', flatListOpts.initialNumToRender);
  console.log('  Window Size:', flatListOpts.windowSize);
  console.log('  Update Cells Period:', flatListOpts.updateCellsBatchingPeriod + 'ms');
  console.log('');

  // Check for device override
  const override = getDeviceOverride(caps.model);
  if (override) {
    console.log('🔧 Device Database Override:');
    console.log('  Override Active: YES');
    console.log('  Forced Tier:', override.forceTier || 'Not forced');
    console.log('  Max Memory:', override.maxMemoryMB + 'MB' || 'Not specified');
    console.log('  Native Driver Disabled:', override.disableNativeDriver ? 'YES' : 'NO');
    console.log('  Gradients Disabled:', override.disableGradients ? 'YES' : 'NO');
    console.log('  Glass Disabled:', override.disableGlass ? 'YES' : 'NO');
    console.log('  Reason:', override.reason || 'Not specified');
    console.log('');
  } else {
    console.log('🔧 Device Database Override: NO (using score-based classification)');
    console.log('');
  }

  // Performance stats
  const perfStats = adaptiveTheme.getPerformanceStats();
  console.log('⚡ Performance Monitoring:');
  console.log('  Frame Drops:', perfStats.frameDrops);
  console.log('  Downgraded:', perfStats.shouldDowngrade ? 'YES' : 'NO');
  console.log('');

  // Test cases
  console.log('✅ Test Results:');

  // Test 1: Samsung A12 should be LOW tier
  if (caps.model.toLowerCase().includes('galaxy a12')) {
    const isCorrect = caps.tier === 'low' && !caps.supportsGradients && !theme.colors.glass.enabled;
    console.log('  Samsung A12:', isCorrect ? '✅ PASS' : '❌ FAIL');
    if (!isCorrect) {
      console.log('    Expected: LOW tier, gradients OFF, glass OFF');
      console.log('    Got:', caps.tier, 'tier, gradients', caps.supportsGradients ? 'ON' : 'OFF', ', glass', theme.colors.glass.enabled ? 'ON' : 'OFF');
    }
  }

  // Test 2: Tecno Spark should be LOW tier
  if (caps.model.toLowerCase().includes('spark')) {
    const isCorrect = caps.tier === 'low' && !caps.supportsGradients;
    console.log('  Tecno Spark:', isCorrect ? '✅ PASS' : '❌ FAIL');
    if (!isCorrect) {
      console.log('    Expected: LOW tier, gradients OFF');
      console.log('    Got:', caps.tier, 'tier, gradients', caps.supportsGradients ? 'ON' : 'OFF');
    }
  }

  // Test 3: Memory detection
  if (caps.model.toLowerCase().includes('galaxy a12')) {
    const isCorrect = caps.totalMemoryMB === 3072;
    console.log('  A12 Memory Detection:', isCorrect ? '✅ PASS (3GB)' : `❌ FAIL (${caps.totalMemoryMB}MB)`);
  }

  // Test 4: Samsung budget series
  const budgetModels = ['a10', 'a11', 'a12', 'a13', 'a20', 'a21', 'a22', 'a23', 'm11', 'm12'];
  const isSamsungBudget = budgetModels.some(model =>
    caps.model.toLowerCase().includes(model)
  );
  if (isSamsungBudget) {
    const isCorrect = caps.tier === 'low';
    console.log('  Samsung Budget Series:', isCorrect ? '✅ PASS (LOW tier)' : `❌ FAIL (${caps.tier.toUpperCase()} tier)`);
  }

  console.log('\n✨ Verification Complete!\n');

  // Return summary for programmatic use
  return {
    device: {
      model: caps.model,
      manufacturer: caps.manufacturer,
      memory: caps.totalMemoryMB,
      tier: caps.tier,
    },
    features: {
      gradients: caps.supportsGradients,
      shadows: caps.supportsShadows,
      glass: theme.colors.glass.enabled,
      animations: caps.supportsComplexAnimations,
    },
    override: override ? {
      active: true,
      reason: override.reason,
    } : {
      active: false,
    },
    performance: perfStats,
  };
}

// Auto-run in development
if (__DEV__) {
  setTimeout(() => {
    verifyAdaptiveFixes().catch(console.error);
  }, 2000); // Wait 2s after app loads
}

export default verifyAdaptiveFixes;
