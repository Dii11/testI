/**
 * Performance Tracking Hook
 *
 * Integrates performance monitoring into React components
 * Automatically tracks dimension changes, renders, and cleanup
 */

import { useEffect, useRef, useState } from 'react';
import type { ScaledSize } from 'react-native';
import { Dimensions } from 'react-native';

import PerformanceMonitor from '../utils/PerformanceMonitor';

interface PerformanceTrackingOptions {
  componentName: string;
  trackDimensions?: boolean;
  trackMemory?: boolean;
  trackRenders?: boolean;
}

export const usePerformanceTracking = (options: PerformanceTrackingOptions) => {
  const {
    componentName,
    trackDimensions = true,
    trackMemory = true,
    trackRenders = true,
  } = options;

  const mountTimeRef = useRef<string | null>(null);
  const activeTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const activeSubscriptionsRef = useRef<Set<{ remove: () => void }>>(new Set());
  const previousDimensionsRef = useRef<ScaledSize | null>(null);
  const renderCountRef = useRef(0);

  // Track component mount/unmount
  useEffect(() => {
    if (trackMemory) {
      mountTimeRef.current = PerformanceMonitor.startTiming(`${componentName}_lifecycle`, {
        phase: 'mount',
      });

      PerformanceMonitor.trackMemoryUsage(
        componentName,
        'mount',
        activeTimersRef.current.size,
        activeSubscriptionsRef.current.size
      );
    }

    return () => {
      if (trackMemory && mountTimeRef.current) {
        PerformanceMonitor.endTiming(mountTimeRef.current, `${componentName}_lifecycle`, {
          phase: 'unmount',
        });

        PerformanceMonitor.trackMemoryUsage(
          componentName,
          'unmount',
          activeTimersRef.current.size,
          activeSubscriptionsRef.current.size
        );

        // Clean up tracked resources
        activeTimersRef.current.forEach(timer => clearTimeout(timer));
        activeSubscriptionsRef.current.forEach(sub => sub.remove());
      }
    };
  }, [componentName, trackMemory]);

  // Track dimension changes
  useEffect(() => {
    if (!trackDimensions) return;

    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const previous = previousDimensionsRef.current;
      if (previous) {
        PerformanceMonitor.trackDimensionChange(componentName, previous, window);
      }
      previousDimensionsRef.current = window;
    });

    // Set initial dimensions
    previousDimensionsRef.current = Dimensions.get('window');

    // Track subscription for cleanup monitoring
    activeSubscriptionsRef.current.add(subscription);

    return () => {
      activeSubscriptionsRef.current.delete(subscription);
      subscription.remove();
    };
  }, [componentName, trackDimensions]);

  // Track renders
  if (trackRenders) {
    renderCountRef.current += 1;

    // Log excessive renders in development
    if (__DEV__ && renderCountRef.current > 10 && renderCountRef.current % 10 === 0) {
      console.log(`🔄 [${componentName}] Render count: ${renderCountRef.current}`);
    }
  }

  // Utility functions for component use
  const trackTimer = (timer: NodeJS.Timeout) => {
    activeTimersRef.current.add(timer);
    return timer;
  };

  const clearTrackedTimer = (timer: NodeJS.Timeout) => {
    clearTimeout(timer);
    activeTimersRef.current.delete(timer);
  };

  const trackSubscription = (subscription: { remove: () => void }) => {
    activeSubscriptionsRef.current.add(subscription);
    return subscription;
  };

  const removeTrackedSubscription = (subscription: { remove: () => void }) => {
    subscription.remove();
    activeSubscriptionsRef.current.delete(subscription);
  };

  const startTiming = (name: string, metadata?: Record<string, any>) => {
    return PerformanceMonitor.startTiming(`${componentName}_${name}`, metadata);
  };

  const endTiming = (timingId: string, name: string, metadata?: Record<string, any>) => {
    PerformanceMonitor.endTiming(timingId, `${componentName}_${name}`, metadata);
  };

  return {
    // Resource tracking utilities
    trackTimer,
    clearTrackedTimer,
    trackSubscription,
    removeTrackedSubscription,

    // Performance timing utilities
    startTiming,
    endTiming,

    // Stats
    renderCount: renderCountRef.current,
    activeTimers: activeTimersRef.current.size,
    activeSubscriptions: activeSubscriptionsRef.current.size,
  };
};

/**
 * Hook specifically for dimension-sensitive components
 */
export const useDimensionTracking = (componentName: string) => {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));
  const previousDimensionsRef = useRef(dimensions);
  const changeCountRef = useRef(0);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const previous = previousDimensionsRef.current;

      // Track the change
      PerformanceMonitor.trackDimensionChange(componentName, previous, window);

      changeCountRef.current += 1;
      previousDimensionsRef.current = window;
      setDimensions(window);
    });

    return () => subscription.remove();
  }, [componentName]);

  return {
    dimensions,
    changeCount: changeCountRef.current,
    hasChanged: changeCountRef.current > 0,
  };
};
