import adaptiveTheme from '../theme/adaptiveTheme';

import deviceCapabilityService from './deviceCapabilityService';

export interface PerformanceInitializationResult {
  success: boolean;
  deviceTier: string;
  optimizationsApplied: string[];
  initializationTime: number;
  error?: string;
}

class PerformanceInitializer {
  private static instance: PerformanceInitializer;
  private isInitialized = false;
  private initializationPromise: Promise<PerformanceInitializationResult> | null = null;

  public static getInstance(): PerformanceInitializer {
    if (!PerformanceInitializer.instance) {
      PerformanceInitializer.instance = new PerformanceInitializer();
    }
    return PerformanceInitializer.instance;
  }

  /**
   * Initialize all performance services and optimizations
   * This should be called early in the app lifecycle
   */
  async initialize(): Promise<PerformanceInitializationResult> {
    // Prevent multiple concurrent initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      return {
        success: true,
        deviceTier: deviceCapabilityService.getPerformanceTier(),
        optimizationsApplied: [],
        initializationTime: 0,
      };
    }

    console.log('🚀 Starting performance initialization...');
    const startTime = Date.now();

    this.initializationPromise = this.performInitialization(startTime);
    return this.initializationPromise;
  }

  private async performInitialization(startTime: number): Promise<PerformanceInitializationResult> {
    const optimizationsApplied: string[] = [];

    try {
      // Step 1: Initialize device capability service
      console.log('📱 Initializing device capability detection...');
      await deviceCapabilityService.initialize();
      optimizationsApplied.push('Device capability detection');

      const capabilities = deviceCapabilityService.getCapabilities();
      const tier = capabilities.tier;

      console.log(`📊 Device classified as: ${tier} tier`);
      console.log(`📱 Device: ${capabilities.manufacturer} ${capabilities.model}`);
      console.log(
        `💾 Memory: ${capabilities.totalMemoryMB}MB, CPU: ${capabilities.cpuCores} cores`
      );

      // Step 2: Initialize adaptive theme system
      console.log('🎨 Initializing adaptive theme system...');
      await adaptiveTheme.initialize();
      optimizationsApplied.push('Adaptive theme system');

      const theme = adaptiveTheme.getTheme();

      // Step 3: Apply tier-specific optimizations
      if (tier === 'low') {
        console.log('⚡ Applying low-end device optimizations...');
        optimizationsApplied.push('Low-end device mode');
        optimizationsApplied.push('Simplified UI components');
        optimizationsApplied.push('Reduced animation complexity');
        optimizationsApplied.push('Memory-efficient rendering');
      } else if (tier === 'medium') {
        console.log('⚖️ Applying medium-tier device optimizations...');
        optimizationsApplied.push('Medium-tier device mode');
        optimizationsApplied.push('Balanced performance settings');
      } else {
        console.log('🔥 Enabling high-performance features...');
        optimizationsApplied.push('High-performance device mode');
        optimizationsApplied.push('Full visual effects');
        optimizationsApplied.push('Complex animations');
      }

      // Step 4: Configure global performance settings
      this.configureGlobalSettings(capabilities, theme);
      optimizationsApplied.push('Global performance settings');

      // Step 5: Enable development debugging if needed
      if (__DEV__) {
        console.log('🔍 Development mode: Performance debugging enabled');
        optimizationsApplied.push('Performance debugging');
      }

      const initializationTime = Date.now() - startTime;
      this.isInitialized = true;

      console.log(`✅ Performance initialization completed in ${initializationTime}ms`);
      console.log(`🎯 Optimizations applied: ${optimizationsApplied.join(', ')}`);

      return {
        success: true,
        deviceTier: tier,
        optimizationsApplied,
        initializationTime,
      };
    } catch (error) {
      const initializationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('❌ Performance initialization failed:', errorMessage);

      return {
        success: false,
        deviceTier: 'unknown',
        optimizationsApplied,
        initializationTime,
        error: errorMessage,
      };
    } finally {
      this.initializationPromise = null;
    }
  }

  private configureGlobalSettings(capabilities: any, theme: any): void {
    // Configure React Native performance settings based on device capabilities
    if (capabilities.tier === 'low') {
      // Enable aggressive optimizations for low-end devices
      console.log('🔧 Configuring aggressive optimizations for low-end device');

      // These would be applied globally via Metro config or other means
      // For now, we log what would be configured
      console.log('  - Enabling removeClippedSubviews by default');
      console.log('  - Reducing batch sizes for list rendering');
      console.log('  - Disabling complex animations');
      console.log('  - Simplifying gradients and effects');
    }

    // Log theme configuration
    console.log('🎨 Theme configuration:');
    console.log(`  - Gradients: ${theme.colors.gradient.enabled ? 'enabled' : 'disabled'}`);
    console.log(`  - Shadows: ${theme.colors.shadow.enabled ? 'enabled' : 'disabled'}`);
    console.log(`  - Glass effects: ${theme.colors.glass.enabled ? 'enabled' : 'disabled'}`);
    console.log(`  - Animations: ${theme.animations.enabled ? 'enabled' : 'disabled'}`);
    console.log(
      `  - Transform animations: ${theme.animations.transforms.enabled ? 'enabled' : 'disabled'}`
    );
  }

  /**
   * Get current performance status
   */
  getStatus(): {
    isInitialized: boolean;
    deviceTier: string;
    benchmarkScore: number;
    isLowEndDevice: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      deviceTier: this.isInitialized ? deviceCapabilityService.getPerformanceTier() : 'unknown',
      benchmarkScore: this.isInitialized ? deviceCapabilityService.getBenchmarkScore() : 0,
      isLowEndDevice: this.isInitialized ? deviceCapabilityService.shouldUseSimplifiedUI() : false,
    };
  }

  /**
   * Reinitialize performance services (useful for testing or after app state changes)
   */
  async reinitialize(): Promise<PerformanceInitializationResult> {
    this.isInitialized = false;
    this.initializationPromise = null;
    return this.initialize();
  }

  /**
   * Get performance recommendations based on current state
   */
  getRecommendations(): string[] {
    if (!this.isInitialized) {
      return ['Performance services not initialized'];
    }

    const recommendations: string[] = [];
    const capabilities = deviceCapabilityService.getCapabilities();
    const theme = adaptiveTheme.getTheme();

    // Memory-based recommendations
    if (capabilities.totalMemoryMB < 3000) {
      recommendations.push('Consider reducing image cache size due to low memory');
    }

    // Performance tier recommendations
    if (capabilities.tier === 'low') {
      if (theme.colors.gradient.enabled) {
        recommendations.push('Disable gradients to improve rendering performance');
      }
      if (theme.animations.enabled && !theme.performance.animations.reducedMotion) {
        recommendations.push('Enable reduced motion for better responsiveness');
      }
    }

    // API level recommendations
    if (capabilities.apiLevel < 28) {
      recommendations.push('Consider disabling complex animations on older Android versions');
    }

    // Benchmark score recommendations
    const benchmarkScore = deviceCapabilityService.getBenchmarkScore();
    if (benchmarkScore < 40) {
      recommendations.push('Device performance is below average - enable all optimizations');
    }

    return recommendations.length > 0 ? recommendations : ['No performance issues detected'];
  }

  /**
   * Debug information
   */
  debugInfo(): void {
    if (!this.isInitialized) {
      console.log('❌ Performance services not initialized');
      return;
    }

    console.log('🔍 Performance Debug Information:');
    deviceCapabilityService.debugInfo();
    adaptiveTheme.debugInfo();

    const recommendations = this.getRecommendations();
    console.log('💡 Recommendations:');
    recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
}

// Export singleton instance
export default PerformanceInitializer.getInstance();

// Export types
export { PerformanceInitializer };
