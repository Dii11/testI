import { useCallback, useMemo, useRef } from 'react';

/**
 * Custom hook for performance optimization utilities
 */
export const usePerformance = () => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());

  // Track component re-renders (development only)
  if (__DEV__) {
    renderCountRef.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;

    if (renderCountRef.current > 1) {
      console.log(
        `🔄 Component re-render #${renderCountRef.current} (${timeSinceLastRender}ms since last)`
      );
    }

    lastRenderTimeRef.current = now;
  }

  /**
   * Debounce function to limit expensive operations
   */
  const debounce = useCallback(
    <T extends (...args: any[]) => any>(
      func: T,
      delay: number
    ): ((...args: Parameters<T>) => void) => {
      const timeoutRef = useRef<NodeJS.Timeout | null>(null);

      return (...args: Parameters<T>) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          func(...args);
        }, delay);
      };
    },
    []
  );

  /**
   * Throttle function to limit expensive operations
   */
  const throttle = useCallback(
    <T extends (...args: any[]) => any>(
      func: T,
      delay: number
    ): ((...args: Parameters<T>) => void) => {
      const lastExecutionRef = useRef(0);

      return (...args: Parameters<T>) => {
        const now = Date.now();

        if (now - lastExecutionRef.current >= delay) {
          func(...args);
          lastExecutionRef.current = now;
        }
      };
    },
    []
  );

  /**
   * Memoize expensive calculations
   */
  const memoize = useCallback(
    <T extends (...args: any[]) => any>(
      func: T,
      getDependencies?: (...args: Parameters<T>) => any[]
    ) => {
      const cacheRef = useRef(new Map());

      return (...args: Parameters<T>): ReturnType<T> => {
        const cache = cacheRef.current;
        const key = getDependencies
          ? JSON.stringify(getDependencies(...args))
          : JSON.stringify(args);

        if (cache.has(key)) {
          return cache.get(key);
        }

        const result = func(...args);
        cache.set(key, result);

        // Limit cache size to prevent memory leaks
        if (cache.size > 100) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }

        return result;
      };
    },
    []
  );

  /**
   * Performance measurement utility
   */
  const measurePerformance = useCallback(<T>(operation: () => T, operationName: string): T => {
    if (!__DEV__) {
      return operation();
    }

    const startTime = performance.now();
    const result = operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (duration > 16) {
      // More than one frame at 60fps
      console.warn(`⚠️ Slow operation "${operationName}": ${duration.toFixed(2)}ms`);
    }

    return result;
  }, []);

  return {
    debounce,
    throttle,
    memoize,
    measurePerformance,
    renderCount: renderCountRef.current,
  };
};

/**
 * Hook for optimizing list rendering performance
 */
export const useListOptimization = <T>(
  data: T[],
  getItemKey: (item: T, index: number) => string,
  windowSize: number = 10
) => {
  const scrollPositionRef = useRef(0);
  const itemHeightRef = useRef(50); // Default item height

  const visibleItems = useMemo(() => {
    const startIndex = Math.max(
      0,
      Math.floor(scrollPositionRef.current / itemHeightRef.current) - windowSize
    );
    const endIndex = Math.min(data.length, startIndex + windowSize * 2);

    return data.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
      key: getItemKey(item, startIndex + index),
    }));
  }, [data, getItemKey, windowSize]);

  const updateScrollPosition = useCallback((position: number) => {
    scrollPositionRef.current = position;
  }, []);

  const updateItemHeight = useCallback((height: number) => {
    itemHeightRef.current = height;
  }, []);

  return {
    visibleItems,
    updateScrollPosition,
    updateItemHeight,
  };
};

/**
 * Hook for image optimization
 */
export const useImageOptimization = () => {
  const imageCache = useRef(new Map<string, boolean>());

  const getOptimizedImageUri = useCallback(
    (uri: string, width?: number, height?: number, quality: number = 0.8): string => {
      if (!uri) return '';

      // For local images, return as-is
      if (uri.startsWith('file://') || uri.startsWith('data:')) {
        return uri;
      }

      // For remote images, add optimization parameters
      const url = new URL(uri);

      if (width) url.searchParams.set('w', width.toString());
      if (height) url.searchParams.set('h', height.toString());
      url.searchParams.set('q', Math.round(quality * 100).toString());
      url.searchParams.set('f', 'webp');

      return url.toString();
    },
    []
  );

  const preloadImage = useCallback((uri: string): Promise<boolean> => {
    return new Promise(resolve => {
      if (imageCache.current.has(uri)) {
        resolve(true);
        return;
      }

      const img = new Image();
      img.onload = () => {
        imageCache.current.set(uri, true);
        resolve(true);
      };
      img.onerror = () => {
        resolve(false);
      };
      img.src = uri;
    });
  }, []);

  const clearImageCache = useCallback(() => {
    imageCache.current.clear();
  }, []);

  return {
    getOptimizedImageUri,
    preloadImage,
    clearImageCache,
    cacheSize: imageCache.current.size,
  };
};

/**
 * Hook for memory management
 */
export const useMemoryManagement = () => {
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  const addCleanupFunction = useCallback((cleanupFn: () => void) => {
    cleanupFunctionsRef.current.push(cleanupFn);
  }, []);

  const cleanup = useCallback(() => {
    cleanupFunctionsRef.current.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.error('Cleanup function failed:', error);
      }
    });
    cleanupFunctionsRef.current = [];
  }, []);

  const getMemoryUsage = useCallback(() => {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      };
    }
    return null;
  }, []);

  return {
    addCleanupFunction,
    cleanup,
    getMemoryUsage,
  };
};
