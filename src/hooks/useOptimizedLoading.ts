import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

interface OptimizedLoadingConfig {
  minLoadingTime?: number;
  delayMs?: number;
  enableInteractionDelay?: boolean;
}

export const useOptimizedLoading = (config: OptimizedLoadingConfig = {}) => {
  const { minLoadingTime = 800, delayMs = 200, enableInteractionDelay = true } = config;

  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const loadingStartTime = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  const startLoading = useCallback(() => {
    loadingStartTime.current = Date.now();
    setIsLoading(true);
    setShowContent(false);
  }, []);

  const finishLoading = useCallback(async () => {
    const elapsedTime = Date.now() - loadingStartTime.current;
    const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

    // Ensure minimum loading time for better UX
    if (remainingTime > 0) {
      await new Promise(resolve => {
        const timeout = setTimeout(() => {
          timeoutsRef.current.delete(timeout);
          resolve(void 0);
        }, remainingTime);
        timeoutsRef.current.add(timeout);
      });
    }

    // Wait for interactions to complete if enabled
    if (enableInteractionDelay) {
      await new Promise(resolve => {
        InteractionManager.runAfterInteractions(() => {
          resolve(void 0);
        });
      });
    }

    // Add a small delay to prevent jarring transitions
    if (delayMs > 0) {
      await new Promise(resolve => {
        const timeout = setTimeout(() => {
          timeoutsRef.current.delete(timeout);
          resolve(void 0);
        }, delayMs);
        timeoutsRef.current.add(timeout);
      });
    }

    setIsLoading(false);

    // Show content with a slight delay for smoother transition
    const timeout = setTimeout(() => {
      timeoutsRef.current.delete(timeout);
      setShowContent(true);
    }, 100);
    timeoutsRef.current.add(timeout);
  }, [minLoadingTime, delayMs, enableInteractionDelay]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(true);
    setShowContent(false);
    loadingStartTime.current = Date.now();
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Clear all tracked timeouts
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();
    };
  }, []);

  return {
    isLoading,
    showContent,
    startLoading,
    finishLoading,
    reset,
  };
};

export const useSkeletonTransition = (itemCount = 3, staggerDelay = 150) => {
  const [visibleItems, setVisibleItems] = useState(0);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  const startStaggeredReveal = useCallback(() => {
    setVisibleItems(0);

    const revealNext = (index: number) => {
      if (index < itemCount) {
        const timeout = setTimeout(() => {
          timeoutsRef.current.delete(timeout);
          setVisibleItems(index + 1);
          revealNext(index + 1);
        }, staggerDelay);
        timeoutsRef.current.add(timeout);
      }
    };

    revealNext(0);
  }, [itemCount, staggerDelay]);

  const reset = useCallback(() => {
    // Clear existing timeouts
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
    setVisibleItems(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();
    };
  }, []);

  return {
    visibleItems,
    startStaggeredReveal,
    reset,
    isItemVisible: (index: number) => index < visibleItems,
  };
};

export const usePrefetchData = <T>(
  fetchFunction: () => Promise<T>,
  dependencies: any[] = [],
  delay = 0
) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Abort any ongoing fetch when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const prefetch = useCallback(async () => {
    if (isLoading || !mountedRef.current) return;

    // Cancel previous request if still ongoing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    setIsLoading(true);
    setError(null);

    try {
      // Add delay to prevent too frequent requests
      if (delay > 0) {
        await new Promise(resolve => {
          const timeout = setTimeout(() => {
            resolve(void 0);
          }, delay);
          // Note: This timeout is short-lived and doesn't need tracking
        });
      }

      // Check if component is still mounted and request not aborted
      if (!mountedRef.current || currentController.signal.aborted) {
        return;
      }

      const result = await fetchFunction();

      // Final check before updating state
      if (mountedRef.current && !currentController.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      // Only set error if it's not an abort error and component is still mounted
      if (mountedRef.current && !currentController.signal.aborted && err !== 'AbortError') {
        setError(err as Error);
      }
    } finally {
      if (mountedRef.current && !currentController.signal.aborted) {
        setIsLoading(false);
      }
      // Clean up controller reference
      if (abortControllerRef.current === currentController) {
        abortControllerRef.current = null;
      }
    }
  }, [fetchFunction, delay, isLoading]);

  useEffect(() => {
    if (mountedRef.current) {
      prefetch();
    }
  }, dependencies);

  return {
    data,
    isLoading,
    error,
    refetch: prefetch,
  };
};
