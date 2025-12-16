import { Platform } from 'react-native';

import { COLORS } from '../constants';
import type { PerformanceSettings } from '../services/deviceCapabilityService';
import deviceCapabilityService, { PerformanceTier } from '../services/deviceCapabilityService';

export interface AdaptiveColors {
  // Base colors (always available)
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    dark: string;
  };

  // Performance-dependent colors
  gradient: {
    enabled: boolean;
    colors: string[];
    locations?: number[];
    fallbackColor: string;
  };

  glass: {
    enabled: boolean;
    background: string;
    border: string;
    fallbackBackground: string;
  };

  shadow: {
    enabled: boolean;
    color: string;
    opacity: number;
    fallbackBorder: string;
  };
}

export interface AdaptiveAnimations {
  enabled: boolean;
  duration: {
    fast: number;
    normal: number;
    slow: number;
  };
  easing: {
    useNativeDriver: boolean;
    tension: number;
    friction: number;
  };
  stagger: {
    enabled: boolean;
    delay: number;
  };
  transforms: {
    enabled: boolean;
    scale: boolean;
    translate: boolean;
    rotate: boolean;
  };
}

export interface AdaptiveLayout {
  borderRadius: {
    small: number;
    medium: number;
    large: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  elevation: {
    enabled: boolean;
    low: number;
    medium: number;
    high: number;
    fallbackBorder: number;
  };
}

export interface AdaptiveTheme {
  tier: PerformanceTier;
  colors: AdaptiveColors;
  animations: AdaptiveAnimations;
  layout: AdaptiveLayout;
  performance: PerformanceSettings;
  isLowEndDevice: boolean;
}

class AdaptiveThemeService {
  private static instance: AdaptiveThemeService;
  private currentTheme: AdaptiveTheme | null = null;
  private listeners: Set<(theme: AdaptiveTheme) => void> = new Set();

  // Runtime performance monitoring
  private performanceMonitor = {
    frameDrops: 0,
    lastFrameTime: Date.now(),
    shouldDowngrade: false,
    lastCheck: Date.now(),
  };

  public static getInstance(): AdaptiveThemeService {
    if (!AdaptiveThemeService.instance) {
      AdaptiveThemeService.instance = new AdaptiveThemeService();
    }
    return AdaptiveThemeService.instance;
  }

  async initialize(): Promise<void> {
    if (this.currentTheme) return;

    try {
      console.log('🎨 Initializing adaptive theme...');

      // Ensure device capabilities are detected first
      await deviceCapabilityService.initialize();

      const capabilities = deviceCapabilityService.getCapabilities();
      const settings = deviceCapabilityService.getPerformanceSettings();

      this.currentTheme = this.generateAdaptiveTheme(capabilities.tier, settings);

      console.log(`🎨 Adaptive theme generated for ${capabilities.tier} tier device`);

      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(this.currentTheme!);
        } catch (error) {
          console.error('Error in theme listener:', error);
        }
      });
    } catch (error) {
      console.error('Failed to initialize adaptive theme:', error);
      this.currentTheme = this.getFallbackTheme();
    }
  }

  private generateAdaptiveTheme(
    tier: PerformanceTier,
    settings: PerformanceSettings
  ): AdaptiveTheme {
    const isLowEnd = tier === PerformanceTier.LOW;

    return {
      tier,
      isLowEndDevice: isLowEnd,
      performance: settings,
      colors: this.generateAdaptiveColors(tier, settings),
      animations: this.generateAdaptiveAnimations(tier, settings),
      layout: this.generateAdaptiveLayout(tier, settings),
    };
  }

  private generateAdaptiveColors(
    tier: PerformanceTier,
    settings: PerformanceSettings
  ): AdaptiveColors {
    const baseColors = {
      primary: COLORS.PRIMARY,
      secondary: COLORS.SECONDARY,
      background: '#FFFFFF',
      surface: COLORS.SURFACE,
      text: {
        primary: COLORS.TEXT_PRIMARY,
        secondary: COLORS.TEXT_SECONDARY,
        dark: COLORS.TEXT_DARK,
      },
    };

    // Get device info for manufacturer-specific tweaks
    const capabilities = deviceCapabilityService.getCapabilities();
    const manufacturer = capabilities.manufacturer;
    const totalMemoryMB = capabilities.totalMemoryMB;
    const supportsGradients = capabilities.supportsGradients;
    const supportsShadows = capabilities.supportsShadows;

    // Check if runtime performance degradation detected
    const shouldDowngrade = this.performanceMonitor.shouldDowngrade;

    switch (tier) {
      case PerformanceTier.HIGH:
        return {
          ...baseColors,
          gradient: {
            enabled: !shouldDowngrade && supportsGradients,
            colors: COLORS.BRAND_GRADIENT
              ? [...COLORS.BRAND_GRADIENT]
              : [COLORS.GRADIENT_START, COLORS.GRADIENT_MIDDLE, COLORS.GRADIENT_END],
            locations: COLORS.BRAND_GRADIENT_LOCATIONS
              ? [...COLORS.BRAND_GRADIENT_LOCATIONS]
              : [0.2, 0.4, 0.8],
            fallbackColor: COLORS.GRADIENT_START,
          },
          glass: {
            enabled: !shouldDowngrade && capabilities.supportsBlur,
            background: COLORS.GLASS_BG || 'rgba(217, 217, 217, 0.10)',
            border: COLORS.GLASS_BORDER_LIGHT || 'rgba(255, 255, 255, 0.3)',
            fallbackBackground: COLORS.SURFACE,
          },
          shadow: {
            enabled: !shouldDowngrade && supportsShadows,
            color: 'rgba(55, 120, 92, 0.11)',
            opacity: 1,
            fallbackBorder: 'rgba(0, 0, 0, 0.1)',
          },
        };

      case PerformanceTier.MEDIUM:
        // Samsung budget devices struggle with complex rendering even in MEDIUM tier
        const isSamsungBudget =
          manufacturer === 'Samsung' &&
          (totalMemoryMB <= 4096 ||
            capabilities.model.toLowerCase().match(/galaxy\s*a(1[0-3]|2[0-3])/));

        // Also check for other budget manufacturers that might be classified as MEDIUM
        const isBudgetDevice =
          isSamsungBudget ||
          (['TECNO', 'INFINIX', 'ITEL'].includes(manufacturer) && totalMemoryMB <= 3072);

        return {
          ...baseColors,
          gradient: {
            enabled: !shouldDowngrade && supportsGradients,
            colors: COLORS.BRAND_GRADIENT
              ? [...COLORS.BRAND_GRADIENT]
              : [COLORS.GRADIENT_START, COLORS.GRADIENT_MIDDLE, COLORS.GRADIENT_END],
            locations: COLORS.BRAND_GRADIENT_LOCATIONS
              ? [...COLORS.BRAND_GRADIENT_LOCATIONS]
              : [0.2, 0.4, 0.8],
            fallbackColor: COLORS.GRADIENT_START,
          },
          glass: {
            enabled: !shouldDowngrade,
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'rgba(255, 255, 255, 0.15)',
            fallbackBackground: COLORS.SURFACE,
          },
          shadow: {
            enabled: !shouldDowngrade && supportsShadows,
            // Lighter shadows for Samsung budget devices
            color: isSamsungBudget ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.08)',
            opacity: isSamsungBudget ? 0.6 : 0.8,
            fallbackBorder: 'rgba(0, 0, 0, 0.1)',
          },
        };

      case PerformanceTier.LOW:
      default:
        return {
          ...baseColors,
          gradient: {
            enabled: !shouldDowngrade && supportsGradients,
            colors: COLORS.BRAND_GRADIENT
              ? [...COLORS.BRAND_GRADIENT]
              : [COLORS.GRADIENT_START, COLORS.GRADIENT_MIDDLE, COLORS.GRADIENT_END],
            locations: COLORS.BRAND_GRADIENT_LOCATIONS
              ? [...COLORS.BRAND_GRADIENT_LOCATIONS]
              : [0.2, 0.4, 0.8],
            fallbackColor: COLORS.GRADIENT_START,
          },
          glass: {
            enabled: !shouldDowngrade,
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'rgba(255, 255, 255, 0.15)',
            fallbackBackground: COLORS.SURFACE,
          },
          shadow: {
            enabled: false,
            color: 'transparent',
            opacity: 0,
            fallbackBorder: 'rgba(0, 0, 0, 0.15)',
          },
        };
    }
  }

  private generateAdaptiveAnimations(
    tier: PerformanceTier,
    settings: PerformanceSettings
  ): AdaptiveAnimations {
    const baseAnimations = {
      enabled: settings.animations.enabled,
      duration: {
        fast: Math.max(150, settings.animations.duration - 100),
        normal: settings.animations.duration,
        slow: settings.animations.duration + 100,
      },
      easing: {
        useNativeDriver: settings.animations.useNativeDriver,
        tension: tier === PerformanceTier.LOW ? 120 : 100,
        friction: tier === PerformanceTier.LOW ? 10 : 8,
      },
      stagger: {
        enabled: !settings.animations.reducedMotion,
        delay: settings.animations.stagger,
      },
    };

    switch (tier) {
      case PerformanceTier.HIGH:
        return {
          ...baseAnimations,
          transforms: {
            enabled: true,
            scale: true,
            translate: true,
            rotate: true,
          },
        };

      case PerformanceTier.MEDIUM:
        return {
          ...baseAnimations,
          transforms: {
            enabled: true,
            scale: true,
            translate: true,
            rotate: false,
          },
        };

      case PerformanceTier.LOW:
      default:
        return {
          ...baseAnimations,
          duration: {
            fast: 100,
            normal: 200,
            slow: 250,
          },
          transforms: {
            enabled: false,
            scale: false,
            translate: false,
            rotate: false,
          },
        };
    }
  }

  private generateAdaptiveLayout(
    tier: PerformanceTier,
    settings: PerformanceSettings
  ): AdaptiveLayout {
    const borderRadius = settings.graphics.borderRadius;

    return {
      borderRadius: {
        small: Math.max(4, borderRadius - 4),
        medium: borderRadius,
        large: Math.min(20, borderRadius + 4),
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
      },
      elevation: {
        enabled: settings.graphics.shadows,
        low: tier === PerformanceTier.LOW ? 0 : 2,
        medium: tier === PerformanceTier.LOW ? 0 : 4,
        high: tier === PerformanceTier.LOW ? 0 : 8,
        fallbackBorder: 1,
      },
    };
  }

  private getFallbackTheme(): AdaptiveTheme {
    const fallbackSettings: PerformanceSettings = {
      animations: {
        enabled: true,
        reducedMotion: true,
        duration: 200,
        stagger: 200,
        useNativeDriver: false,
      },
      graphics: {
        gradients: false,
        shadows: false,
        blur: false,
        opacity: 0.9,
        borderRadius: 8,
      },
      rendering: {
        maxConcurrentItems: 10,
        virtualizedLists: true,
        imageCaching: false,
        lazyLoading: true,
      },
    };

    return {
      tier: PerformanceTier.LOW,
      isLowEndDevice: true,
      performance: fallbackSettings,
      colors: this.generateAdaptiveColors(PerformanceTier.LOW, fallbackSettings),
      animations: this.generateAdaptiveAnimations(PerformanceTier.LOW, fallbackSettings),
      layout: this.generateAdaptiveLayout(PerformanceTier.LOW, fallbackSettings),
    };
  }

  // Public API
  getTheme(): AdaptiveTheme {
    return this.currentTheme || this.getFallbackTheme();
  }

  isLowEndDevice(): boolean {
    return this.getTheme().isLowEndDevice;
  }

  shouldUseGradients(): boolean {
    return this.getTheme().colors.gradient.enabled;
  }

  shouldUseShadows(): boolean {
    return this.getTheme().colors.shadow.enabled;
  }

  shouldUseGlassEffect(): boolean {
    return this.getTheme().colors.glass.enabled;
  }

  shouldReduceAnimations(): boolean {
    return this.getTheme().performance.animations.reducedMotion;
  }

  getAnimationDuration(type: 'fast' | 'normal' | 'slow' = 'normal'): number {
    return this.getTheme().animations.duration[type];
  }

  getOptimalBorderRadius(size: 'small' | 'medium' | 'large' = 'medium'): number {
    return this.getTheme().layout.borderRadius[size];
  }

  // Component-specific helpers
  getCardStyle() {
    const theme = this.getTheme();
    const baseStyle = {
      borderRadius: theme.layout.borderRadius.medium,
      padding: theme.layout.spacing.md,
      marginBottom: theme.layout.spacing.sm,
    };

    if (theme.colors.glass.enabled) {
      return {
        ...baseStyle,
        backgroundColor: theme.colors.glass.background,
        borderWidth: 1,
        borderColor: theme.colors.glass.border,
        ...(theme.colors.shadow.enabled && {
          shadowColor: theme.colors.shadow.color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.colors.shadow.opacity,
          shadowRadius: 24,
          elevation: theme.layout.elevation.high,
        }),
      };
    }

    return {
      ...baseStyle,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.elevation.fallbackBorder,
      borderColor: theme.colors.shadow.fallbackBorder,
    };
  }

  getGradientProps() {
    const theme = this.getTheme();
    if (theme.colors.gradient.enabled) {
      return {
        colors: theme.colors.gradient.colors,
        locations: theme.colors.gradient.locations,
      };
    }
    return null;
  }

  getFlatListOptimizations() {
    const theme = this.getTheme();
    return {
      removeClippedSubviews: theme.isLowEndDevice,
      maxToRenderPerBatch: theme.performance.rendering.maxConcurrentItems / 2,
      initialNumToRender: Math.min(6, theme.performance.rendering.maxConcurrentItems),
      windowSize: theme.isLowEndDevice ? 5 : 10,
      updateCellsBatchingPeriod: theme.isLowEndDevice ? 200 : 100,
      getItemLayout: theme.isLowEndDevice ? undefined : null, // Let system optimize
    };
  }

  // Event system
  addListener(listener: (theme: AdaptiveTheme) => void): () => void {
    this.listeners.add(listener);

    // Immediately call with current theme
    if (this.currentTheme) {
      listener(this.currentTheme);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  removeListener(listener: (theme: AdaptiveTheme) => void): void {
    this.listeners.delete(listener);
  }

  // Runtime performance monitoring
  checkFramePerformance(): void {
    const now = Date.now();
    const frameDelta = now - this.performanceMonitor.lastFrameTime;

    // If frame took > 32ms (< 30fps), count as drop
    if (frameDelta > 32 && frameDelta < 1000) {
      // Ignore very large deltas (app in background)
      this.performanceMonitor.frameDrops++;

      // If we see 10+ frame drops in short time, downgrade features
      if (this.performanceMonitor.frameDrops > 10) {
        const timeSinceLastCheck = now - this.performanceMonitor.lastCheck;

        // Only downgrade if drops happened within last 5 seconds
        if (timeSinceLastCheck < 5000) {
          console.warn(
            '⚠️ Performance degradation detected, disabling heavy rendering features'
          );
          this.performanceMonitor.shouldDowngrade = true;

          // Disable expensive features in current theme
          if (this.currentTheme) {
            this.currentTheme.colors.shadow.enabled = false;
            this.currentTheme.animations.transforms.enabled = false;

            // Notify listeners of theme change
            this.listeners.forEach(listener => {
              try {
                listener(this.currentTheme!);
              } catch (error) {
                console.error('Error in theme listener:', error);
              }
            });
          }
        }

        // Reset counters
        this.performanceMonitor.frameDrops = 0;
        this.performanceMonitor.lastCheck = now;
      }
    }

    this.performanceMonitor.lastFrameTime = now;
  }

  resetPerformanceMonitor(): void {
    this.performanceMonitor = {
      frameDrops: 0,
      lastFrameTime: Date.now(),
      shouldDowngrade: false,
      lastCheck: Date.now(),
    };
    console.log('🔄 Performance monitor reset');
  }

  getPerformanceStats(): {
    frameDrops: number;
    shouldDowngrade: boolean;
  } {
    return {
      frameDrops: this.performanceMonitor.frameDrops,
      shouldDowngrade: this.performanceMonitor.shouldDowngrade,
    };
  }

  // Debug helpers
  debugInfo(): void {
    const theme = this.getTheme();
    const perfStats = this.getPerformanceStats();

    console.log('🎨 Adaptive Theme Debug Info:', {
      tier: theme.tier,
      isLowEndDevice: theme.isLowEndDevice,
      gradients: theme.colors.gradient.enabled,
      shadows: theme.colors.shadow.enabled,
      glass: theme.colors.glass.enabled,
      animations: theme.animations.enabled,
      transforms: theme.animations.transforms.enabled,
      performance: perfStats,
    });
  }
}

export default AdaptiveThemeService.getInstance();
