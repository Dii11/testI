import { useEffect, useRef, useCallback } from 'react';
import { InteractionManager } from 'react-native';

interface PerformanceMetrics {
  renderTime: number;
  interactionTime: number;
  memoryUsage?: number;
  frameRate: number;
}

interface UsePerformanceMonitorOptions {
  screenName: string;
  enableLogging?: boolean;
  onPerformanceIssue?: (metrics: PerformanceMetrics) => void;
  threshold?: {
    renderTime: number;
    interactionTime: number;
    frameRate: number;
  };
}

export const usePerformanceMonitor = (options: UsePerformanceMonitorOptions) => {
  const {
    screenName,
    enableLogging = __DEV__,
    onPerformanceIssue,
    threshold = {
      renderTime: 1000,
      interactionTime: 500,
      frameRate: 30,
    },
  } = options;

  const startTime = useRef<number>(Date.now());
  const renderCompleteTime = useRef<number>(0);
  const interactionCompleteTime = useRef<number>(0);
  const frameCount = useRef<number>(0);
  const lastFrameTime = useRef<number>(Date.now());

  // Track render performance
  const trackRenderComplete = useCallback(() => {
    renderCompleteTime.current = Date.now() - startTime.current;

    if (enableLogging) {
      console.log(`📊 ${screenName} - Render completed in ${renderCompleteTime.current}ms`);
    }

    // Check for performance issues
    if (renderCompleteTime.current > threshold.renderTime) {
      onPerformanceIssue?.({
        renderTime: renderCompleteTime.current,
        interactionTime: interactionCompleteTime.current,
        frameRate: frameCount.current,
      });
    }
  }, [screenName, enableLogging, threshold.renderTime, onPerformanceIssue]);

  // Track interaction performance
  const trackInteractionComplete = useCallback(() => {
    interactionCompleteTime.current = Date.now() - startTime.current;

    if (enableLogging) {
      console.log(
        `📊 ${screenName} - Interaction completed in ${interactionCompleteTime.current}ms`
      );
    }

    // Check for performance issues
    if (interactionCompleteTime.current > threshold.interactionTime) {
      onPerformanceIssue?.({
        renderTime: renderCompleteTime.current,
        interactionTime: interactionCompleteTime.current,
        frameRate: frameCount.current,
      });
    }
  }, [screenName, enableLogging, threshold.interactionTime, onPerformanceIssue]);

  // Track frame rate
  const trackFrame = useCallback(() => {
    const now = Date.now();
    frameCount.current++;

    // Calculate frame rate every second
    if (now - lastFrameTime.current >= 1000) {
      const frameRate = Math.round((frameCount.current * 1000) / (now - lastFrameTime.current));

      if (enableLogging && frameRate < threshold.frameRate) {
        console.warn(`⚠️ ${screenName} - Low frame rate detected: ${frameRate}fps`);
      }

      frameCount.current = 0;
      lastFrameTime.current = now;
    }
  }, [screenName, enableLogging, threshold.frameRate]);

  useEffect(() => {
    startTime.current = Date.now();

    // Track render completion
    const renderTimeout = setTimeout(trackRenderComplete, 0);

    // Track interaction completion
    InteractionManager.runAfterInteractions(() => {
      trackInteractionComplete();
    });

    return () => {
      clearTimeout(renderTimeout);
    };
  }, [trackRenderComplete, trackInteractionComplete]);

  // Return performance tracking functions
  return {
    trackRenderComplete,
    trackInteractionComplete,
    trackFrame,
    getMetrics: (): PerformanceMetrics => ({
      renderTime: renderCompleteTime.current,
      interactionTime: interactionCompleteTime.current,
      frameRate: frameCount.current,
    }),
  };
};

// Performance optimization utilities
export const performanceUtils = {
  // Debounce function calls for performance
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function calls for performance
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // Optimize heavy computations
  memoize: <T extends (...args: any[]) => any>(
    func: T,
    getKey?: (...args: Parameters<T>) => string
  ): T => {
    const cache = new Map<string, ReturnType<T>>();

    return ((...args: Parameters<T>) => {
      const key = getKey ? getKey(...args) : JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  },

  // Batch updates for better performance
  batchUpdates: (updates: (() => void)[]) => {
    InteractionManager.runAfterInteractions(() => {
      updates.forEach(update => update());
    });
  },

  // Check if device is low-end
  isLowEndDevice: (): boolean => {
    try {
      // Try to require the service, but handle missing service gracefully
      const deviceService = require('../services/deviceCapabilityService').default;
      return deviceService?.getPerformanceTier() === 'low';
    } catch {
      // Assume low-end device for safety if service is missing
      console.warn('⚠️ deviceCapabilityService not available, assuming low-end device');
      return true;
    }
  },

  // Get optimal animation duration based on device
  getOptimalAnimationDuration: (baseDuration: number = 300): number => {
    try {
      const deviceService = require('../services/deviceCapabilityService').default;
      const tier = deviceService?.getPerformanceTier();

      switch (tier) {
        case 'low':
          return Math.max(150, baseDuration * 0.5);
        case 'medium':
          return Math.max(200, baseDuration * 0.75);
        case 'high':
          return baseDuration;
        default:
          return baseDuration;
      }
    } catch {
      // Assume low-end device for safety - use faster animations
      console.warn('⚠️ deviceCapabilityService not available, using low-end optimizations');
      return Math.max(150, baseDuration * 0.5);
    }
  },
};
