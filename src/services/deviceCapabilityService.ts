import Constants from 'expo-constants';
import { Platform, Dimensions } from 'react-native';

import { applyDeviceOverrides, getDeviceOverride } from '../config/deviceDatabase';

import { PerformanceTier } from '../types/performance';
export { PerformanceTier } from '../types/performance';

export interface DeviceCapabilities {
  tier: PerformanceTier;
  apiLevel: number;
  totalMemoryMB: number;
  availableMemoryMB: number;
  cpuCores: number;
  screenDensity: number;
  screenWidth: number;
  screenHeight: number;
  isTablet: boolean;
  manufacturer: string;
  model: string;
  supportsComplexAnimations: boolean;
  supportsGradients: boolean;
  supportsShadows: boolean;
  supportsBlur: boolean;
  maxConcurrentAnimations: number;
  renderingOptimizations: RenderingOptimizations;
  // Video call specific capabilities
  hasSlowPermissionHandling: boolean;
  permissionTimeoutMs: number;
  videoCallQuality: 'high' | 'medium' | 'low';
  videoCallConfig: {
    low: {
      quality: 'low';
      resolution: { width: number; height: number };
      framerate: number;
      bitrate: number;
    };
    medium: {
      quality: 'medium';
      resolution: { width: number; height: number };
      framerate: number;
      bitrate: number;
    };
    high: {
      quality: 'high';
      resolution: { width: number; height: number };
      framerate: number;
      bitrate: number;
    };
    startVideoOff: boolean;
    enableChat: boolean;
    maxParticipants: number;
    adaptiveBitrate: boolean;
  };
  shouldSkipHealthPermissions: boolean;
  networkOptimizations: NetworkOptimizations;
}

export interface RenderingOptimizations {
  useNativeDriver: boolean;
  removeClippedSubviews: boolean;
  maxToRenderPerBatch: number;
  initialNumToRender: number;
  windowSize: number;
  updateCellsBatchingPeriod: number;
  getItemLayout: boolean;
  keyExtractor: boolean;
  disableVirtualization: boolean;
}

export interface NetworkOptimizations {
  connectionTimeout: number;
  retryAttempts: number;
  adaptiveBitrate: boolean;
  startVideoOff: boolean;
  maxParticipants: number;
}

export interface PerformanceSettings {
  animations: {
    enabled: boolean;
    reducedMotion: boolean;
    duration: number;
    stagger: number;
    useNativeDriver: boolean;
  };
  graphics: {
    gradients: boolean;
    shadows: boolean;
    blur: boolean;
    opacity: number;
    borderRadius: number;
  };
  rendering: {
    maxConcurrentItems: number;
    virtualizedLists: boolean;
    imageCaching: boolean;
    lazyLoading: boolean;
  };
}

class DeviceCapabilityService {
  private static instance: DeviceCapabilityService;
  private capabilities: DeviceCapabilities | null = null;
  private settings: PerformanceSettings | null = null;
  private benchmarkScore: number = 0;

  public static getInstance(): DeviceCapabilityService {
    if (!DeviceCapabilityService.instance) {
      DeviceCapabilityService.instance = new DeviceCapabilityService();
    }
    return DeviceCapabilityService.instance;
  }

  async initialize(): Promise<void> {
    if (this.capabilities) return;

    try {
      console.log('📱 Initializing device capability detection...');
      const startTime = Date.now();

      const capabilities = await this.detectCapabilities();
      this.capabilities = capabilities;
      this.settings = this.generatePerformanceSettings(capabilities);

      const initTime = Date.now() - startTime;
      console.log(`📱 Device capabilities detected in ${initTime}ms:`, {
        tier: capabilities.tier,
        apiLevel: capabilities.apiLevel,
        memory: `${capabilities.totalMemoryMB}MB`,
        cores: capabilities.cpuCores,
        manufacturer: capabilities.manufacturer,
        model: capabilities.model,
      });
    } catch (error) {
      console.error('Failed to detect device capabilities:', error);
      this.capabilities = this.getFallbackCapabilities();
      this.settings = this.generatePerformanceSettings(this.capabilities);
    }
  }

  private async detectCapabilities(): Promise<DeviceCapabilities> {
    const { width, height } = Dimensions.get('window');

    const [
      apiLevel,
      totalMemory,
      availableMemory,
      manufacturer,
      model,
      isTablet,
      screenDensity,
      cpuCores,
    ] = await Promise.all([
      this.getApiLevel(),
      this.getTotalMemory(),
      this.getAvailableMemory(),
      this.getManufacturer(),
      this.getModel(),
      this.getIsTablet(),
      this.getScreenDensity(),
      this.getCpuCores(),
    ]);

    const benchmarkScore = await this.runPerformanceBenchmark();

    const baseTier = this.classifyPerformanceTier({
      apiLevel,
      totalMemoryMB: totalMemory,
      cpuCores,
      manufacturer,
      model,
      benchmarkScore,
    });

    // Apply device-specific overrides
    const deviceOverrides = applyDeviceOverrides(model, manufacturer, baseTier, totalMemory);

    const tier = deviceOverrides.tier;
    const finalMemory = deviceOverrides.memoryMB;

    const hasSlowPermissionHandling = this.detectSlowPermissionHandling(manufacturer, model);
    const permissionTimeoutMs = this.calculatePermissionTimeout(
      tier,
      hasSlowPermissionHandling,
      apiLevel
    );
    const videoCallQuality = this.determineVideoQuality(tier, finalMemory);
    const shouldSkipHealthPermissions = hasSlowPermissionHandling || tier === PerformanceTier.LOW;
    const networkOptimizations = this.getNetworkOptimizations(tier, manufacturer);
    const videoCallConfig = this.getVideoCallConfig(tier);

    return {
      tier,
      apiLevel,
      totalMemoryMB: finalMemory,
      availableMemoryMB: availableMemory,
      cpuCores,
      screenDensity,
      screenWidth: width,
      screenHeight: height,
      isTablet,
      manufacturer,
      model,
      supportsComplexAnimations: deviceOverrides.supportsTransforms,
      supportsGradients: deviceOverrides.supportsGradients,
      supportsShadows: deviceOverrides.supportsShadows,
      supportsBlur: tier === PerformanceTier.HIGH && deviceOverrides.supportsGlass,
      maxConcurrentAnimations: this.getMaxAnimations(tier),
      renderingOptimizations: this.getRenderingOptimizations(tier),
      hasSlowPermissionHandling,
      permissionTimeoutMs,
      videoCallQuality,
      videoCallConfig,
      shouldSkipHealthPermissions,
      networkOptimizations,
    };
  }

  private async getApiLevel(): Promise<number> {
    try {
      if (Platform.OS === 'android') {
        // Use Platform.Version for Android API level
        return Platform.Version as number;
      }
      // For iOS, convert version to approximate API level equivalent
      const iOSVersion = parseFloat(Platform.Version as string);
      if (iOSVersion >= 15) return 31; // iOS 15 ≈ Android 12
      if (iOSVersion >= 14) return 30; // iOS 14 ≈ Android 11
      if (iOSVersion >= 13) return 29; // iOS 13 ≈ Android 10
      return 28; // Fallback
    } catch {
      return 26; // Minimum supported
    }
  }

  private async getManufacturer(): Promise<string> {
    try {
      if (Platform.OS === 'ios') return 'Apple';

      // For Android, try to extract from deviceName or use Constants
      const deviceName = Constants.deviceName?.toLowerCase() || '';
      if (deviceName.includes('samsung')) return 'Samsung';
      if (deviceName.includes('google') || deviceName.includes('pixel')) return 'Google';
      if (deviceName.includes('huawei')) return 'Huawei';
      if (deviceName.includes('xiaomi') || deviceName.includes('redmi')) return 'Xiaomi';
      if (deviceName.includes('oppo')) return 'OPPO';
      if (deviceName.includes('vivo')) return 'Vivo';
      if (deviceName.includes('oneplus')) return 'OnePlus';
      if (deviceName.includes('realme')) return 'Realme';
      if (deviceName.includes('tecno') || deviceName.includes('spark')) return 'TECNO';
      if (deviceName.includes('infinix')) return 'INFINIX';
      if (deviceName.includes('itel')) return 'ITEL';
      if (deviceName.includes('motorola')) return 'Motorola';
      if (deviceName.includes('nokia')) return 'Nokia';
      if (deviceName.includes('sony')) return 'Sony';
      if (deviceName.includes('lg')) return 'LG';

      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async getModel(): Promise<string> {
    try {
      return Constants.deviceName || Platform.OS;
    } catch {
      return Platform.OS;
    }
  }

  private async getIsTablet(): Promise<boolean> {
    try {
      const { width, height } = Dimensions.get('window');
      const aspectRatio = Math.max(width, height) / Math.min(width, height);
      const screenSize = Math.sqrt(width * width + height * height);

      // Heuristic: tablets typically have larger screens and different aspect ratios
      return screenSize > 1000 && aspectRatio < 2;
    } catch {
      return false;
    }
  }

  private async getTotalMemory(): Promise<number> {
    try {
      // Estimate memory based on device characteristics and year
      const { width, height } = Dimensions.get('window');
      const screenSize = Math.sqrt(width * width + height * height);
      const deviceName = Constants.deviceName?.toLowerCase() || '';
      const apiLevel = await this.getApiLevel();

      // Check device database first for accurate memory specs
      const override = getDeviceOverride(deviceName);
      if (override?.maxMemoryMB) {
        console.log(`📱 Using device database memory for ${deviceName}: ${override.maxMemoryMB}MB`);
        return override.maxMemoryMB;
      }

      // Samsung-specific detection (more accurate than generic detection)
      if (deviceName.includes('samsung') || deviceName.includes('galaxy')) {
        // A-series budget (2019-2023)
        if (deviceName.match(/a0[1-3](?!\d)/)) return 2048; // A01, A02, A03
        if (deviceName.match(/a1[0-3](?!\d)/)) {
          // A10, A11, A12, A13
          if (deviceName.includes('a10')) return 2048;
          if (deviceName.includes('a11')) return 3072;
          if (deviceName.includes('a12')) return 3072; // FIXED: was 2048
          if (deviceName.includes('a13')) return 3072; // FIXED: was 2048
        }
        if (deviceName.match(/a2[0-3](?!\d)/)) return 3072; // A20-A23
        if (deviceName.match(/a3[0-3](?!\d)/)) return 4096; // A30-A33
        if (deviceName.match(/a5[0-3](?!\d)/)) return 4096; // A50-A53
        if (deviceName.match(/a7[0-3](?!\d)/)) return 6144; // A70-A73

        // M-series (similar to A-series)
        if (deviceName.match(/m0[1-2](?!\d)/)) return 2048; // M01, M02
        if (deviceName.match(/m1[1-2](?!\d)/)) return 3072; // M11, M12
        if (deviceName.match(/m[23]\d/)) return 4096; // M20+, M30+

        // S-series flagship
        if (deviceName.includes('s20') || deviceName.includes('s21')) return 8192;
        if (deviceName.includes('s10') || deviceName.includes('s9')) return 6144;
        if (deviceName.includes('s8') || deviceName.includes('s7')) return 4096;

        // Note series
        if (deviceName.includes('note 20')) return 8192;
        if (deviceName.includes('note 10')) return 8192;
        if (deviceName.includes('note 9')) return 6144;
        if (deviceName.includes('note 8')) return 6144;

        // Z-series foldable
        if (deviceName.includes('fold') || deviceName.includes('flip')) return 8192;
      }

      // Tecno-specific detection
      if (deviceName.includes('tecno') || deviceName.includes('spark') || deviceName.includes('camon')) {
        if (deviceName.includes('spark 5')) return 2048;
        if (deviceName.includes('spark 6')) return 2048;
        if (deviceName.includes('spark 7')) return 2048;
        if (deviceName.includes('spark 8')) return 3072;
        if (deviceName.includes('camon 15')) return 3072;
        if (deviceName.includes('camon 16')) return 4096;
        if (deviceName.includes('camon 17')) return 4096;
        if (deviceName.includes('pova')) return 4096;
      }

      // Infinix-specific detection
      if (deviceName.includes('infinix')) {
        if (deviceName.includes('hot 9')) return 2048;
        if (deviceName.includes('hot 10')) return 3072;
        if (deviceName.includes('note 7')) return 2048;
        if (deviceName.includes('note 8')) return 4096;
      }

      // Xiaomi Redmi-specific detection
      if (deviceName.includes('redmi')) {
        if (deviceName.includes('redmi 9a') || deviceName.includes('redmi 9c')) return 2048;
        if (deviceName.includes('redmi 7') || deviceName.includes('redmi 8a')) return 2048;
        if (deviceName.includes('redmi 8') || deviceName.includes('redmi 9')) return 3072;
        if (deviceName.includes('redmi note 9')) return 4096;
        if (deviceName.includes('redmi note 10')) return 4096;
        if (deviceName.includes('redmi note 11')) return 4096;
      }

      // High-end device indicators (generic)
      if (
        deviceName.includes('pro') ||
        deviceName.includes('ultra') ||
        deviceName.includes('flagship') ||
        deviceName.includes('pixel')
      ) {
        if (apiLevel >= 30) return 8192; // 8GB for newer flagship
        return 6144; // 6GB for older flagship
      }

      // Mid-range indicators (generic)
      if (deviceName.includes('note') && !deviceName.includes('redmi')) {
        return 4096; // 4GB
      }

      // Budget device indicators (generic)
      if (
        deviceName.includes('lite') ||
        deviceName.includes('go') ||
        deviceName.includes('mini') ||
        screenSize < 800
      ) {
        return 2048; // 2GB
      }

      // Default based on API level
      if (apiLevel >= 30) return 4096;
      if (apiLevel >= 28) return 3072;
      return 2048;
    } catch (error) {
      console.warn('Memory detection failed:', error);
      return 2048; // Conservative fallback
    }
  }

  private async getAvailableMemory(): Promise<number> {
    try {
      const totalMemory = await this.getTotalMemory();
      // Assume 60-70% of total memory is available for app use
      return Math.round(totalMemory * 0.65);
    } catch {
      return 1024; // Conservative fallback
    }
  }

  private async getCpuCores(): Promise<number> {
    try {
      const manufacturer = await this.getManufacturer();
      const model = await this.getModel();
      const apiLevel = await this.getApiLevel();
      const modelLower = model.toLowerCase();

      // High-end device estimation
      if (
        modelLower.includes('flagship') ||
        modelLower.includes('pro') ||
        modelLower.includes('ultra') ||
        modelLower.includes('pixel') ||
        (manufacturer === 'Apple' && apiLevel >= 30) ||
        (manufacturer === 'Samsung' && modelLower.includes('s'))
      ) {
        return 8;
      }

      // Budget device estimation (like Tecno Spark 5)
      if (
        modelLower.includes('spark') ||
        modelLower.includes('lite') ||
        modelLower.includes('mini') ||
        modelLower.includes('go') ||
        apiLevel < 28
      ) {
        return 4;
      }

      // Mid-range default
      return 6;
    } catch {
      return 4; // Conservative fallback
    }
  }

  private async getScreenDensity(): Promise<number> {
    try {
      const { width, height } = Dimensions.get('window');
      const screenSize = Math.sqrt(width * width + height * height);

      if (Platform.OS === 'ios') {
        // iOS density estimation based on screen size
        if (screenSize > 1100) return 3; // iPhone Pro Max, iPad Pro
        if (screenSize > 900) return 2.5; // iPhone Plus/Pro
        return 2; // Standard iPhone/iPad
      }

      // Android density estimation
      if (screenSize > 1200) return 4; // xxxhdpi
      if (screenSize > 1000) return 3; // xxhdpi
      if (screenSize > 800) return 2.5; // xhdpi
      if (screenSize > 600) return 2; // hdpi
      return 1.5; // mdpi
    } catch {
      return 2; // Fallback
    }
  }

  private async runPerformanceBenchmark(): Promise<number> {
    try {
      // Run both CPU and GPU/rendering benchmarks
      const cpuScore = await this.runCPUBenchmark();
      const renderScore = await this.runRenderBenchmark();

      // Weighted average: 40% CPU, 60% rendering (UI rendering matters more)
      const finalScore = cpuScore * 0.4 + renderScore * 0.6;
      this.benchmarkScore = finalScore;

      console.log(
        `📊 Performance benchmark completed:`,
        `CPU=${cpuScore.toFixed(1)}, Render=${renderScore.toFixed(1)}, Final=${finalScore.toFixed(1)}`
      );

      return finalScore;
    } catch (error) {
      console.warn('Performance benchmark failed:', error);
      return 50; // Default middle score
    }
  }

  private async runCPUBenchmark(): Promise<number> {
    try {
      const iterations = 5000;

      const cpuStart = Date.now();

      // CPU-intensive operations
      let sum = 0;
      for (let i = 0; i < iterations; i++) {
        sum += Math.sqrt(i) + Math.sin(i) + Math.cos(i);
      }

      const cpuTime = Date.now() - cpuStart;

      // Memory operations
      const memStart = Date.now();
      const testObj: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        testObj[`key${i}`] = Math.random();
      }
      const memTime = Date.now() - memStart;

      // Calculate CPU score (higher is better)
      const totalTime = cpuTime + memTime * 0.5;
      const score = Math.max(1, Math.min(100, 5000 / totalTime));

      console.log(`  ⚙️ CPU benchmark: ${score.toFixed(1)} (time: ${totalTime.toFixed(1)}ms)`);
      return score;
    } catch (error) {
      console.warn('CPU benchmark failed:', error);
      return 50;
    }
  }

  private async runRenderBenchmark(): Promise<number> {
    try {
      const startTime = Date.now();

      // Simulate rendering operations that are expensive on budget GPUs
      let renderOps = 0;

      // Test 1: Gradient color calculations (most expensive for budget GPUs)
      const gradientIterations = 100;
      const gradients: number[][] = [];

      for (let i = 0; i < gradientIterations; i++) {
        const gradient: number[] = [];
        for (let j = 0; j < 10; j++) {
          // Simulate gradient color interpolation
          const color1 = Math.floor(Math.random() * 0xffffff);
          const color2 = Math.floor(Math.random() * 0xffffff);
          const interpolated = (color1 + color2) / 2;
          gradient.push(interpolated);
          renderOps++;
        }
        gradients.push(gradient);
      }

      // Test 2: Shadow/blur calculations (compositing operations)
      const shadowIterations = 50;
      let shadowSum = 0;
      for (let i = 0; i < shadowIterations; i++) {
        // Simulate shadow blur calculations
        const shadowRadius = Math.random() * 20;
        const shadowOffset = { x: Math.random() * 10, y: Math.random() * 10 };
        const shadowOpacity = Math.random();

        // Calculate shadow bounds (simulates GPU work)
        const shadowArea = Math.PI * shadowRadius * shadowRadius;
        const blurFactor = shadowArea * shadowOpacity;
        shadowSum += blurFactor + shadowOffset.x + shadowOffset.y;
        renderOps++;
      }

      // Test 3: Transform matrix calculations
      const transformIterations = 50;
      let transformSum = 0;
      for (let i = 0; i < transformIterations; i++) {
        // Simulate transform matrix multiplications
        const scale = Math.random() * 2;
        const rotate = Math.random() * 360;
        const translateX = Math.random() * 100;
        const translateY = Math.random() * 100;

        // Matrix calculations
        const matrix = [
          Math.cos(rotate) * scale,
          Math.sin(rotate) * scale,
          -Math.sin(rotate) * scale,
          Math.cos(rotate) * scale,
          translateX,
          translateY,
        ];
        transformSum += matrix.reduce((a, b) => a + b, 0);
        renderOps++;
      }

      const renderTime = Date.now() - startTime;

      // Calculate render score (higher is better)
      // Budget devices: 30-50ms, Mid-range: 15-30ms, High-end: <15ms
      let score: number;
      if (renderTime < 15) {
        score = 100; // High-end GPU
      } else if (renderTime < 30) {
        score = 70; // Mid-range GPU
      } else if (renderTime < 50) {
        score = 40; // Budget GPU
      } else {
        score = Math.max(1, 20); // Very slow GPU
      }

      console.log(
        `  🎨 Render benchmark: ${score.toFixed(1)} (time: ${renderTime}ms, ops: ${renderOps})`
      );
      return score;
    } catch (error) {
      console.warn('Render benchmark failed:', error);
      return 30; // Conservative fallback
    }
  }

  private classifyPerformanceTier(specs: {
    apiLevel: number;
    totalMemoryMB: number;
    cpuCores: number;
    manufacturer: string;
    model: string;
    benchmarkScore: number;
  }): PerformanceTier {
    const { apiLevel, totalMemoryMB, cpuCores, manufacturer, model, benchmarkScore } = specs;

    // Check device database first for forced tier
    const override = getDeviceOverride(model);
    if (override?.forceTier) {
      console.log(
        `🔧 Device database forcing tier ${override.forceTier} for ${model}: ${override.reason}`
      );
      return override.forceTier;
    }

    // Samsung budget A-series specific override (Mali-G52 GPU issues)
    if (manufacturer === 'Samsung' || model.toLowerCase().includes('galaxy')) {
      const modelLower = model.toLowerCase();

      // Match A01-A03, A10-A13, A20-A23, A30-A33
      if (modelLower.match(/galaxy\s*a(0[1-3]|1[0-3]|2[0-3]|3[0-3])(?!\d)/)) {
        console.log('🔧 Samsung budget A-series detected, forcing LOW tier for optimal performance');
        return PerformanceTier.LOW;
      }

      // Match M01-M02, M11-M12
      if (modelLower.match(/galaxy\s*m(0[1-2]|1[1-2])(?!\d)/)) {
        console.log('🔧 Samsung budget M-series detected, forcing LOW tier');
        return PerformanceTier.LOW;
      }
    }

    // Tecno/Infinix/ITEL budget manufacturers with limited RAM
    if (['TECNO', 'INFINIX', 'ITEL'].includes(manufacturer)) {
      if (totalMemoryMB <= 3072) {
        console.log(`🔧 ${manufacturer} budget device with <=3GB RAM, forcing LOW tier`);
        return PerformanceTier.LOW;
      }
    }

    // Score-based classification for other devices
    let score = 0;

    // API Level scoring
    if (apiLevel >= 30)
      score += 30; // Android 11+
    else if (apiLevel >= 28)
      score += 20; // Android 9+
    else if (apiLevel >= 26) score += 10; // Android 8+

    // Memory scoring
    if (totalMemoryMB >= 6000)
      score += 30; // 6GB+
    else if (totalMemoryMB >= 4000)
      score += 20; // 4GB+
    else if (totalMemoryMB >= 3000)
      score += 15; // 3GB+
    else if (totalMemoryMB >= 2000) score += 10; // 2GB+

    // CPU scoring
    if (cpuCores >= 8) score += 20;
    else if (cpuCores >= 6) score += 15;
    else if (cpuCores >= 4) score += 10;

    // Benchmark scoring
    if (benchmarkScore >= 80) score += 20;
    else if (benchmarkScore >= 60) score += 15;
    else if (benchmarkScore >= 40) score += 10;

    // Manufacturer/model adjustments - UPDATED with specific models
    const lowEndModels = [
      // Generic indicators
      'spark',
      'go',
      'lite',
      'mini',

      // Specific Samsung models (fallback if not caught above)
      'galaxy a01',
      'galaxy a02',
      'galaxy a03',
      'galaxy a10',
      'galaxy a11',
      'galaxy a12',
      'galaxy a13',
      'galaxy a20',
      'galaxy a21',
      'galaxy a22',
      'galaxy a23',
      'galaxy m01',
      'galaxy m02',
      'galaxy m11',
      'galaxy m12',

      // Xiaomi budget
      'redmi 7',
      'redmi 8',
      'redmi 8a',
      'redmi 9a',
      'redmi 9c',

      // Other budget brands
      'y1',
      'y3',
      'hot 9',
      'hot 10',
      'realme c1',
      'realme c2',
    ];

    const highEndModels = [
      'pro max',
      'ultra',
      'flagship',
      'galaxy s',
      'galaxy note',
      'galaxy z',
      'pixel',
      'iphone',
      'oneplus 7',
      'oneplus 8',
      'oneplus 9',
      'mi 10',
      'mi 11',
      'mi 12',
      'find x',
    ];

    const modelLower = model.toLowerCase();

    // Apply model-based adjustments
    if (lowEndModels.some(term => modelLower.includes(term))) {
      score -= 20; // Stronger penalty for known low-end models
    } else if (highEndModels.some(term => modelLower.includes(term))) {
      score += 15;
    }

    // Final classification with adjusted thresholds
    if (score >= 75) return PerformanceTier.HIGH;
    if (score >= 45) return PerformanceTier.MEDIUM;
    return PerformanceTier.LOW;
  }

  private determineVideoQuality(
    tier: PerformanceTier,
    totalMemoryMB: number
  ): 'high' | 'medium' | 'low' {
    if (tier === PerformanceTier.HIGH && totalMemoryMB >= 6000) return 'high';
    if (tier === PerformanceTier.MEDIUM && totalMemoryMB >= 4000) return 'medium';
    return 'low';
  }

  getVideoCallConfig(tier: PerformanceTier) {
    const baseConfig = {
      startVideoOff: tier === PerformanceTier.LOW,
      enableChat: true,
      maxParticipants: 10,
      adaptiveBitrate: true,
    };

    switch (tier) {
      case PerformanceTier.HIGH:
        return {
          ...baseConfig,
          low: {
            quality: 'low' as const,
            resolution: { width: 320, height: 240 },
            framerate: 15,
            bitrate: 300000,
          },
          medium: {
            quality: 'medium' as const,
            resolution: { width: 640, height: 480 },
            framerate: 24,
            bitrate: 800000,
          },
          high: {
            quality: 'high' as const,
            resolution: { width: 1280, height: 720 },
            framerate: 30,
            bitrate: 1200000,
          },
        };
      case PerformanceTier.MEDIUM:
        return {
          ...baseConfig,
          low: {
            quality: 'low' as const,
            resolution: { width: 320, height: 240 },
            framerate: 15,
            bitrate: 300000,
          },
          medium: {
            quality: 'medium' as const,
            resolution: { width: 640, height: 480 },
            framerate: 24,
            bitrate: 600000,
          },
          high: {
            quality: 'high' as const,
            resolution: { width: 960, height: 540 },
            framerate: 24,
            bitrate: 900000,
          },
        };
      default: // LOW
        return {
          ...baseConfig,
          low: {
            quality: 'low' as const,
            resolution: { width: 320, height: 240 },
            framerate: 15,
            bitrate: 250000,
          },
          medium: {
            quality: 'medium' as const,
            resolution: { width: 480, height: 360 },
            framerate: 15,
            bitrate: 400000,
          },
          high: {
            quality: 'high' as const,
            resolution: { width: 640, height: 480 },
            framerate: 20,
            bitrate: 500000,
          },
        };
    }
  }

  private getMaxAnimations(tier: PerformanceTier): number {
    switch (tier) {
      case PerformanceTier.HIGH:
        return 8;
      case PerformanceTier.MEDIUM:
        return 4;
      case PerformanceTier.LOW:
        return 2;
      default:
        return 2;
    }
  }

  private getRenderingOptimizations(tier: PerformanceTier): RenderingOptimizations {
    switch (tier) {
      case PerformanceTier.HIGH:
        return {
          useNativeDriver: true,
          removeClippedSubviews: false,
          maxToRenderPerBatch: 10,
          initialNumToRender: 8,
          windowSize: 15,
          updateCellsBatchingPeriod: 50,
          getItemLayout: false,
          keyExtractor: true,
          disableVirtualization: false,
        };

      case PerformanceTier.MEDIUM:
        return {
          useNativeDriver: true,
          removeClippedSubviews: true,
          maxToRenderPerBatch: 6,
          initialNumToRender: 6,
          windowSize: 10,
          updateCellsBatchingPeriod: 100,
          getItemLayout: true,
          keyExtractor: true,
          disableVirtualization: false,
        };

      case PerformanceTier.LOW:
        return {
          useNativeDriver: false,
          removeClippedSubviews: true,
          maxToRenderPerBatch: 3,
          initialNumToRender: 4,
          windowSize: 5,
          updateCellsBatchingPeriod: 200,
          getItemLayout: true,
          keyExtractor: true,
          disableVirtualization: true,
        };

      default:
        return {
          useNativeDriver: false,
          removeClippedSubviews: true,
          maxToRenderPerBatch: 3,
          initialNumToRender: 4,
          windowSize: 5,
          updateCellsBatchingPeriod: 200,
          getItemLayout: true,
          keyExtractor: true,
          disableVirtualization: true,
        };
    }
  }

  private detectSlowPermissionHandling(manufacturer: string, model: string): boolean {
    const lowerManufacturer = manufacturer.toLowerCase();
    const lowerModel = model.toLowerCase();

    // Known slow manufacturers
    const slowManufacturers = ['tecno', 'infinix', 'itel', 'symphony', 'lava'];
    if (slowManufacturers.includes(lowerManufacturer)) {
      return true;
    }

    // Known slow models
    const slowModels = ['spark', 'camon', 'hot', 'note 7', 'pova'];
    if (slowModels.some(m => lowerModel.includes(m))) {
      return true;
    }

    return false;
  }

  private calculatePermissionTimeout(
    tier: PerformanceTier,
    isSlowDevice: boolean,
    apiLevel: number
  ): number {
    if (isSlowDevice) {
      return apiLevel < 29 ? 15000 : 10000; // Longer timeout for older Android on slow devices
    }

    switch (tier) {
      case PerformanceTier.HIGH:
        return 5000;
      case PerformanceTier.MEDIUM:
        return 8000;
      case PerformanceTier.LOW:
        return 12000;
      default:
        return 10000;
    }
  }

  private getNetworkOptimizations(
    tier: PerformanceTier,
    manufacturer: string
  ): NetworkOptimizations {
    const aggressiveManufacturers = ['samsung', 'google', 'oneplus', 'apple'];
    const useAggressiveTimeouts = aggressiveManufacturers.includes(manufacturer.toLowerCase());

    switch (tier) {
      case PerformanceTier.HIGH:
        return {
          connectionTimeout: useAggressiveTimeouts ? 8000 : 10000,
          retryAttempts: 3,
          adaptiveBitrate: true,
          startVideoOff: false,
          maxParticipants: 25,
        };
      case PerformanceTier.MEDIUM:
        return {
          connectionTimeout: 12000,
          retryAttempts: 4,
          adaptiveBitrate: true,
          startVideoOff: false,
          maxParticipants: 15,
        };
      case PerformanceTier.LOW:
        return {
          connectionTimeout: 15000,
          retryAttempts: 5,
          adaptiveBitrate: false,
          startVideoOff: true,
          maxParticipants: 8,
        };
      default:
        return {
          connectionTimeout: 15000,
          retryAttempts: 5,
          adaptiveBitrate: false,
          startVideoOff: true,
          maxParticipants: 8,
        };
    }
  }

  getCapabilities(): DeviceCapabilities {
    if (!this.capabilities) {
      console.warn('Device capabilities accessed before initialization. Returning fallback.');
      return this.getFallbackCapabilities();
    }
    return this.capabilities;
  }

  getPerformanceSettings(): PerformanceSettings {
    if (!this.settings) {
      console.warn('Performance settings accessed before initialization. Returning fallback.');
      const fallbackCaps = this.getFallbackCapabilities();
      return this.generatePerformanceSettings(fallbackCaps);
    }
    return this.settings;
  }

  getBenchmarkScore(): number {
    return this.benchmarkScore;
  }

  private generatePerformanceSettings(capabilities: DeviceCapabilities): PerformanceSettings {
    const {
      tier,
      supportsComplexAnimations,
      supportsGradients,
      supportsShadows,
      supportsBlur,
      maxConcurrentAnimations,
    } = capabilities;

    const isLow = tier === PerformanceTier.LOW;

    return {
      animations: {
        enabled: supportsComplexAnimations,
        reducedMotion: isLow,
        duration: isLow ? 400 : 250,
        stagger: isLow ? 100 : 50,
        useNativeDriver: !isLow,
      },
      graphics: {
        gradients: supportsGradients,
        shadows: supportsShadows,
        blur: supportsBlur,
        opacity: isLow ? 0.9 : 1.0,
        borderRadius: isLow ? 8 : 16,
      },
      rendering: {
        maxConcurrentItems: maxConcurrentAnimations,
        virtualizedLists: !isLow,
        imageCaching: true,
        lazyLoading: true,
      },
    };
  }

  private getFallbackCapabilities(): DeviceCapabilities {
    const { width, height } = Dimensions.get('window');
    const tier = PerformanceTier.MEDIUM;

    return {
      tier,
      apiLevel: 28,
      totalMemoryMB: 3072,
      availableMemoryMB: 2048,
      cpuCores: 4,
      screenDensity: 2,
      screenWidth: width,
      screenHeight: height,
      isTablet: false,
      manufacturer: 'Unknown',
      model: 'Unknown',
      supportsComplexAnimations: true,
      supportsGradients: true,
      supportsShadows: true,
      supportsBlur: false,
      maxConcurrentAnimations: 4,
      renderingOptimizations: this.getRenderingOptimizations(tier),
      hasSlowPermissionHandling: false,
      permissionTimeoutMs: 10000,
      videoCallQuality: 'medium',
      videoCallConfig: this.getVideoCallConfig(tier),
      shouldSkipHealthPermissions: false,
      networkOptimizations: this.getNetworkOptimizations(tier, 'Unknown'),
    };
  }
}

export default DeviceCapabilityService.getInstance();
