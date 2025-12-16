import { useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';

interface TransitionConfig {
  duration?: number;
  useNativeDriver?: boolean;
  staggerDelay?: number;
}

export const useScreenTransition = (config: TransitionConfig = {}) => {
  const { duration = 400, useNativeDriver = true, staggerDelay = 100 } = config;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const animateIn = useCallback(() => {
    // Stop any ongoing animations first
    fadeAnim.stopAnimation();
    slideAnim.stopAnimation();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        useNativeDriver,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        useNativeDriver,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, duration, useNativeDriver]);

  const animateOut = useCallback(
    (onComplete?: () => void) => {
      // Stop any ongoing animations first
      fadeAnim.stopAnimation();
      slideAnim.stopAnimation();

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: duration * 0.7,
          useNativeDriver,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: duration * 0.7,
          useNativeDriver,
        }),
      ]).start(onComplete);
    },
    [fadeAnim, slideAnim, duration, useNativeDriver]
  );

  const createStaggeredAnimation = useCallback(
    (items: Animated.Value[], direction: 'in' | 'out' = 'in') => {
      const animations = items.map((anim, index) =>
        Animated.timing(anim, {
          toValue: direction === 'in' ? 1 : 0,
          duration,
          delay: index * staggerDelay,
          useNativeDriver,
        })
      );

      return Animated.stagger(staggerDelay, animations);
    },
    [duration, staggerDelay, useNativeDriver]
  );

  useEffect(() => {
    // Initialize animations properly to prevent render errors
    try {
      animateIn();
    } catch (error) {
      console.warn('Screen transition animation failed:', error);
      // Fallback: set values directly without animation
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, [animateIn]);

  // Create a safe container style that handles potential animation errors
  const safeContainerStyle = {
    opacity: fadeAnim,
    transform: [
      {
        translateY: slideAnim.interpolate({
          inputRange: [-20, 0, 30],
          outputRange: [-20, 0, 30],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  return {
    fadeAnim,
    slideAnim,
    animateIn,
    animateOut,
    createStaggeredAnimation,
    containerStyle: safeContainerStyle,
  };
};

export const useFadeTransition = (duration = 300) => {
  const opacity = useRef(new Animated.Value(0)).current;

  const fadeIn = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  }, [opacity, duration]);

  const fadeOut = useCallback(
    (onComplete?: () => void) => {
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }).start(onComplete);
    },
    [opacity, duration]
  );

  useEffect(() => {
    fadeIn();
  }, [fadeIn]);

  return {
    opacity,
    fadeIn,
    fadeOut,
    style: { opacity },
  };
};

export const useScaleTransition = (duration = 300) => {
  const scale = useRef(new Animated.Value(0.9)).current;

  const scaleIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const scaleOut = useCallback(
    (onComplete?: () => void) => {
      Animated.timing(scale, {
        toValue: 0.9,
        duration,
        useNativeDriver: true,
      }).start(onComplete);
    },
    [scale, duration]
  );

  useEffect(() => {
    scaleIn();
  }, [scaleIn]);

  return {
    scale,
    scaleIn,
    scaleOut,
    style: { transform: [{ scale }] },
  };
};
