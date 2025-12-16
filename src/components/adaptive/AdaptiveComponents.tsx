import type { LinearGradientProps } from 'expo-linear-gradient';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useEffect, useState, useCallback, useRef } from 'react';
import type { ViewStyle, FlatListProps, TouchableOpacityProps } from 'react-native';
import { View, FlatList, TouchableOpacity, Animated, Platform } from 'react-native';

import type { AdaptiveTheme } from '../../theme/adaptiveTheme';
import adaptiveTheme from '../../theme/adaptiveTheme';

// Adaptive LinearGradient Component
interface AdaptiveLinearGradientProps extends Omit<LinearGradientProps, 'colors'> {
  children?: React.ReactNode;
  style?: ViewStyle;
  fallbackColor?: string;
}

export const AdaptiveLinearGradient: React.FC<AdaptiveLinearGradientProps> = memo(
  ({ children, style, fallbackColor, ...props }) => {
    const [theme, setTheme] = useState<AdaptiveTheme | null>(null);

    useEffect(() => {
      try {
        setTheme(adaptiveTheme.getTheme());
        const unsubscribe = adaptiveTheme.addListener(setTheme);
        return unsubscribe;
      } catch (error) {
        console.warn('Failed to initialize adaptive theme:', error);
        return () => {};
      }
    }, []);

    if (!theme || !theme.colors.gradient.enabled) {
      return (
        <View
          style={[
            style,
            {
              backgroundColor:
                fallbackColor ||
                theme?.colors.gradient.fallbackColor ||
                theme?.colors.primary ||
                '#377865',
            },
          ]}
        >
          {children}
        </View>
      );
    }

    const gradientProps = adaptiveTheme.getGradientProps();
    if (!gradientProps) {
      return (
        <View style={[style, { backgroundColor: theme.colors.primary || '#377865' }]}>
          {children}
        </View>
      );
    }

    return (
      <LinearGradient
        {...props}
        colors={gradientProps.colors as any}
        locations={gradientProps.locations as any}
        style={style}
      >
        {children}
      </LinearGradient>
    );
  }
);

// Adaptive FlatList Component
interface AdaptiveFlatListProps<T> extends FlatListProps<T> {
  performanceOptimized?: boolean;
}

export const AdaptiveFlatList = memo(
  <T,>({ performanceOptimized = true, ...props }: AdaptiveFlatListProps<T>) => {
    const [theme, setTheme] = useState<AdaptiveTheme>(adaptiveTheme.getTheme());

    useEffect(() => {
      const unsubscribe = adaptiveTheme.addListener(setTheme);
      return unsubscribe;
    }, []);

    const optimizations = performanceOptimized
      ? adaptiveTheme.getFlatListOptimizations()
      : ({} as any);

    const adaptiveProps = {
      ...props,
      ...optimizations,
      // Override with user props if provided
      removeClippedSubviews:
        props.removeClippedSubviews ?? (optimizations as any).removeClippedSubviews,
      maxToRenderPerBatch: props.maxToRenderPerBatch ?? (optimizations as any).maxToRenderPerBatch,
      initialNumToRender: props.initialNumToRender ?? (optimizations as any).initialNumToRender,
      windowSize: props.windowSize ?? (optimizations as any).windowSize,
      updateCellsBatchingPeriod:
        props.updateCellsBatchingPeriod ?? (optimizations as any).updateCellsBatchingPeriod,
      getItemLayout: props.getItemLayout ?? (optimizations as any).getItemLayout,
    };

    return <FlatList {...adaptiveProps} />;
  }
) as <T>(props: AdaptiveFlatListProps<T>) => React.ReactElement;

// Adaptive TouchableOpacity with performance optimizations
interface AdaptiveTouchableOpacityProps extends TouchableOpacityProps {
  enableHaptics?: boolean;
  adaptiveOpacity?: boolean;
}

export const AdaptiveTouchableOpacity: React.FC<AdaptiveTouchableOpacityProps> = memo(
  ({ enableHaptics = false, adaptiveOpacity = true, activeOpacity, onPress, ...props }) => {
    const [theme, setTheme] = useState<AdaptiveTheme>(adaptiveTheme.getTheme());

    useEffect(() => {
      const unsubscribe = adaptiveTheme.addListener(setTheme);
      return unsubscribe;
    }, []);

    const handlePress = useCallback(
      async (event: any) => {
        // Add haptic feedback on high-end devices
        if (enableHaptics && !theme.isLowEndDevice && Platform.OS === 'ios') {
          try {
            const Haptics = await import('expo-haptics');
            Haptics.selectionAsync().catch(() => {
              // Haptic failed, continue silently
            });
          } catch {
            // Haptics not available
          }
        }

        onPress?.(event);
      },
      [enableHaptics, theme.isLowEndDevice, onPress]
    );

    const adaptiveActiveOpacity = adaptiveOpacity
      ? theme.isLowEndDevice
        ? 0.8
        : (activeOpacity ?? 0.7)
      : activeOpacity;

    return (
      <TouchableOpacity {...props} activeOpacity={adaptiveActiveOpacity} onPress={handlePress} />
    );
  }
);

// Adaptive Card Component
interface AdaptiveCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  disabled?: boolean;
}

export const AdaptiveCard: React.FC<AdaptiveCardProps> = memo(
  ({ children, style, onPress, disabled = false }) => {
    const [theme, setTheme] = useState<AdaptiveTheme>(adaptiveTheme.getTheme());

    useEffect(() => {
      const unsubscribe = adaptiveTheme.addListener(setTheme);
      return unsubscribe;
    }, []);

    const cardStyle = adaptiveTheme.getCardStyle();
    const mergedStyle = [cardStyle, style];

    if (onPress && !disabled) {
      return (
        <AdaptiveTouchableOpacity
          style={mergedStyle}
          onPress={onPress}
          activeOpacity={theme.isLowEndDevice ? 0.8 : 0.95}
        >
          {children}
        </AdaptiveTouchableOpacity>
      );
    }

    return <View style={mergedStyle}>{children}</View>;
  }
);

// Adaptive Animated View with performance considerations
interface AdaptiveAnimatedViewProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  animationType?: 'fadeIn' | 'slideUp' | 'scale' | 'none';
  duration?: number;
  delay?: number;
  useNativeDriver?: boolean;
}

export const AdaptiveAnimatedView: React.FC<AdaptiveAnimatedViewProps> = memo(
  ({ children, style, animationType = 'fadeIn', duration, delay = 0, useNativeDriver }) => {
    const { theme, shouldReduceAnimations } = useAdaptiveTheme();
    const [animatedValue] = useState(new Animated.Value(0));
    const [forceVisible, setForceVisible] = useState(false);

    useEffect(() => {
      if (!theme.animations.enabled || animationType === 'none') {
        animatedValue.setValue(1);
        return;
      }

      const animationDuration = duration ?? theme.animations.duration.normal ?? 300;
      const shouldUseNativeDriver =
        useNativeDriver ?? theme.animations.easing.useNativeDriver ?? true;

      // Safety timeout: force visibility after max delay to prevent invisible items
      const maxDelay = Math.min(delay, 1000); // Cap at 1 second
      const safetyTimeout = setTimeout(() => {
        setForceVisible(true);
        animatedValue.setValue(1);
      }, maxDelay + animationDuration + 100);

      const timer = setTimeout(() => {
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: shouldUseNativeDriver,
        }).start();
      }, maxDelay);

      return () => {
        clearTimeout(timer);
        clearTimeout(safetyTimeout);
      };
    }, [animatedValue, animationType, duration, delay, useNativeDriver, theme]);

    // Skip animations on low-end devices or when disabled, or if forced visible
    if (
      !theme.animations.enabled ||
      shouldReduceAnimations() ||
      animationType === 'none' ||
      forceVisible
    ) {
      return <View style={style}>{children}</View>;
    }

    const getAnimatedStyle = () => {
      // Add null check for theme
      if (!theme.animations) {
        return { opacity: animatedValue };
      }

      switch (animationType) {
        case 'fadeIn':
          return {
            opacity: animatedValue,
          };

        case 'slideUp':
          if (!theme.animations.transforms.enabled) {
            return { opacity: animatedValue };
          }
          return {
            opacity: animatedValue,
            transform: [
              {
                translateY: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          };

        case 'scale':
          if (!theme.animations.transforms.enabled) {
            return { opacity: animatedValue };
          }
          return {
            opacity: animatedValue,
            transform: [
              {
                scale: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                }),
              },
            ],
          };

        default:
          return { opacity: animatedValue };
      }
    };

    return <Animated.View style={[style, getAnimatedStyle()]}>{children}</Animated.View>;
  }
);

// Higher-Order Component for automatic performance adaptation
export function withAdaptivePerformance<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    skipOnLowEnd?: boolean;
    fallbackComponent?: React.ComponentType<P>;
    optimizations?: {
      memo?: boolean;
      removeProps?: string[];
    };
  } = {}
) {
  const AdaptiveComponent: React.FC<P> = props => {
    const [theme, setTheme] = useState<AdaptiveTheme>(adaptiveTheme.getTheme());

    useEffect(() => {
      const unsubscribe = adaptiveTheme.addListener(setTheme);
      return unsubscribe;
    }, []);

    // Use fallback component on low-end devices if specified
    if (options.skipOnLowEnd && theme.isLowEndDevice && options.fallbackComponent) {
      const FallbackComponent = options.fallbackComponent;
      return <FallbackComponent {...props} />;
    }

    // Remove specified props for performance on low-end devices
    if (theme.isLowEndDevice && options.optimizations?.removeProps) {
      const optimizedProps = { ...props };
      options.optimizations.removeProps.forEach(propName => {
        delete (optimizedProps as any)[propName];
      });
      return <Component {...optimizedProps} />;
    }

    return <Component {...props} />;
  };

  // Apply memo if specified
  if (options.optimizations?.memo !== false) {
    return memo(AdaptiveComponent);
  }

  return AdaptiveComponent;
}

// Hook for accessing adaptive theme
export function useAdaptiveTheme() {
  const [theme, setTheme] = useState<AdaptiveTheme | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    try {
      setTheme(adaptiveTheme.getTheme());
      const unsubscribe = adaptiveTheme.addListener(setTheme);
      unsubscribeRef.current = unsubscribe;

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    } catch (error) {
      console.warn('Failed to initialize adaptive theme in useAdaptiveTheme:', error);
      return () => {};
    }
  }, []);

  const safeTheme = theme || {
    tier: 0,
    isLowEndDevice: true,
    colors: {
      primary: '#377865',
      gradient: { enabled: false },
      glass: { enabled: false },
      shadow: { enabled: false },
    },
    animations: {
      enabled: false,
      duration: { fast: 150, normal: 300, slow: 400 },
      easing: { useNativeDriver: true, tension: 120, friction: 10 },
      stagger: { enabled: false, delay: 0 },
      transforms: { enabled: false, scale: false, translate: false, rotate: false },
    },
    layout: {
      borderRadius: { medium: 8 },
      spacing: { md: 16, sm: 8 },
      elevation: { high: 0 },
    },
  };

  return {
    theme: safeTheme,
    isLowEndDevice: safeTheme.isLowEndDevice,
    shouldUseGradients: () => {
      try {
        return adaptiveTheme.shouldUseGradients();
      } catch {
        return false;
      }
    },
    shouldUseShadows: () => {
      try {
        return adaptiveTheme.shouldUseShadows();
      } catch {
        return false;
      }
    },
    shouldUseGlassEffect: () => {
      try {
        return adaptiveTheme.shouldUseGlassEffect();
      } catch {
        return false;
      }
    },
    shouldReduceAnimations: () => {
      try {
        return adaptiveTheme.shouldReduceAnimations();
      } catch {
        return true;
      }
    },
    getAnimationDuration: (type?: 'fast' | 'normal' | 'slow') => {
      try {
        return adaptiveTheme.getAnimationDuration(type);
      } catch {
        return 200;
      }
    },
    getOptimalBorderRadius: () => {
      try {
        return adaptiveTheme.getOptimalBorderRadius();
      } catch {
        return 8;
      }
    },
    getCardStyle: () => {
      try {
        return adaptiveTheme.getCardStyle();
      } catch {
        return {
          borderRadius: 8,
          padding: 16,
          marginBottom: 8,
          backgroundColor: '#ffffff',
        };
      }
    },
    getGradientProps: () => {
      try {
        return adaptiveTheme.getGradientProps();
      } catch {
        return null;
      }
    },
    getFlatListOptimizations: () => {
      try {
        return adaptiveTheme.getFlatListOptimizations();
      } catch {
        return {
          removeClippedSubviews: true,
          maxToRenderPerBatch: 10,
          windowSize: 10,
        };
      }
    },
  };
}

// Performance Monitor Component (for debugging)
export const PerformanceMonitor: React.FC<{ children: React.ReactNode }> = memo(({ children }) => {
  const renderCountRef = useRef(0);
  const lastRenderRef = useRef(Date.now());

  // Track renders without causing state updates
  renderCountRef.current += 1;
  const now = Date.now();
  const timeSinceLastRender = now - lastRenderRef.current;

  if (__DEV__ && renderCountRef.current > 1 && timeSinceLastRender < 16) {
    console.warn(
      `⚡ Potential over-rendering detected. Render #${renderCountRef.current} in ${timeSinceLastRender}ms`
    );
  }

  lastRenderRef.current = now;

  return <>{children}</>;
});

export default {
  AdaptiveLinearGradient,
  AdaptiveFlatList,
  AdaptiveTouchableOpacity,
  AdaptiveCard,
  AdaptiveAnimatedView,
  withAdaptivePerformance,
  useAdaptiveTheme,
  PerformanceMonitor,
};
