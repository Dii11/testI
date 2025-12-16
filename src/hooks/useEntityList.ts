import type { AsyncThunk } from '@reduxjs/toolkit';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { AppDispatch, RootState } from '../store';

interface EntityListOptions<T> {
  fetchAction: AsyncThunk<any, void, {}>;
  setSearchQueryAction: (query: string) => { type: string; payload: any };
  dataSelector: (state: RootState) => T[];
  loadingSelector: (state: RootState) => boolean;
  errorSelector: (state: RootState) => string | null;
  filteredCountSelector: (state: RootState) => number;
  enablePerformanceLogging?: boolean;
  screenName?: string;
}

interface LoadingStates {
  isLoading: boolean;
  hasError: boolean;
  hasData: boolean;
  isInitialLoad: boolean;
}

export const useEntityList = <T>({
  fetchAction,
  setSearchQueryAction,
  dataSelector,
  loadingSelector,
  errorSelector,
  filteredCountSelector,
  enablePerformanceLogging = __DEV__,
  screenName = 'EntityList',
}: EntityListOptions<T>) => {
  const dispatch = useDispatch<AppDispatch>();
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadStartTimeRef = useRef<number>(0);

  const entities = useSelector(dataSelector);
  const isLoading = useSelector(loadingSelector);
  const error = useSelector(errorSelector);
  const filteredCount = useSelector(filteredCountSelector);

  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Memoized loading states for better performance
  const loadingStates: LoadingStates = useMemo(
    () => ({
      isLoading,
      hasError: !!error,
      hasData: entities.length > 0,
      isInitialLoad: isLoading && !hasInitiallyLoaded && entities.length === 0,
    }),
    [isLoading, error, entities.length, hasInitiallyLoaded]
  );

  // Enhanced load entities with error handling and performance tracking
  const loadEntities = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (hasLoadedRef.current && !refreshing) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    try {
      if (enablePerformanceLogging) {
        loadStartTimeRef.current = Date.now();
        console.log(`📊 ${screenName} - Starting data load (attempt ${retryCount + 1})`);
      }

      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
      }

      await dispatch(fetchAction()).unwrap();

      if (enablePerformanceLogging) {
        const loadTime = Date.now() - loadStartTimeRef.current;
        console.log(`✅ ${screenName} - Data loaded successfully in ${loadTime}ms`);
      }

      // Reset retry count and mark as loaded on successful load
      if (isMountedRef.current) {
        setRetryCount(0);
        if (!hasInitiallyLoaded) {
          setHasInitiallyLoaded(true);
        }
      }
    } catch (error: any) {
      if (currentController.signal.aborted) {
        if (enablePerformanceLogging) {
          console.log(`⚠️ ${screenName} - Load request was aborted`);
        }
        return;
      }

      console.error(`❌ ${screenName} - Load failed:`, error);

      // Reset load flag on error so user can retry
      if (isMountedRef.current) {
        hasLoadedRef.current = false;
        setRetryCount(prev => prev + 1);
      }

      // Re-throw error to allow component-level error handling
      throw error;
    } finally {
      // Clean up controller reference
      if (abortControllerRef.current === currentController) {
        abortControllerRef.current = null;
      }
    }
  }, [dispatch, fetchAction, refreshing, retryCount, enablePerformanceLogging, screenName]);

  // Enhanced refresh with performance tracking
  const onRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setRefreshing(true);
      hasLoadedRef.current = false;

      if (enablePerformanceLogging) {
        loadStartTimeRef.current = Date.now();
        console.log(`🔄 ${screenName} - Starting refresh`);
      }

      await dispatch(fetchAction()).unwrap();

      if (enablePerformanceLogging) {
        const refreshTime = Date.now() - loadStartTimeRef.current;
        console.log(`✅ ${screenName} - Refresh completed in ${refreshTime}ms`);
      }

      if (isMountedRef.current) {
        setRetryCount(0);
        if (!hasInitiallyLoaded) {
          setHasInitiallyLoaded(true);
        }
      }
    } catch (error: any) {
      console.error(`❌ ${screenName} - Refresh failed:`, error);
      if (isMountedRef.current) {
        setRetryCount(prev => prev + 1);
      }
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [dispatch, fetchAction, enablePerformanceLogging, screenName]);

  // Enhanced search with debouncing built-in
  const handleSearchChange = useCallback(
    (query: string) => {
      if (!isMountedRef.current) return;
      dispatch(setSearchQueryAction(query));
    },
    [dispatch, setSearchQueryAction]
  );

  // Retry function for error states
  const retry = useCallback(async () => {
    if (!isMountedRef.current) return;
    hasLoadedRef.current = false;
    await loadEntities();
  }, [loadEntities]);

  // Initial load function that's safe to use in useEffect
  const initialLoad = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (hasLoadedRef.current) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    try {
      if (enablePerformanceLogging) {
        loadStartTimeRef.current = Date.now();
        console.log(`📊 ${screenName} - Starting initial data load`);
      }

      hasLoadedRef.current = true;
      await dispatch(fetchAction()).unwrap();

      if (enablePerformanceLogging) {
        const loadTime = Date.now() - loadStartTimeRef.current;
        console.log(`✅ ${screenName} - Initial data loaded in ${loadTime}ms`);
      }

      if (isMountedRef.current) {
        setRetryCount(0);
        if (!hasInitiallyLoaded) {
          setHasInitiallyLoaded(true);
        }
      }
    } catch (error: any) {
      if (currentController.signal.aborted) {
        if (enablePerformanceLogging) {
          console.log(`⚠️ ${screenName} - Initial load was aborted`);
        }
        return;
      }

      console.error(`❌ ${screenName} - Initial load failed:`, error);

      if (isMountedRef.current) {
        hasLoadedRef.current = false;
        setRetryCount(prev => prev + 1);
      }
    } finally {
      if (abortControllerRef.current === currentController) {
        abortControllerRef.current = null;
      }
    }
  }, [dispatch, fetchAction, enablePerformanceLogging, screenName]);

  // Initialize and cleanup - SAFE: Only run once on mount
  useEffect(() => {
    isMountedRef.current = true;

    // Initialize performance services if available
    const initializeServices = async () => {
      try {
        const [adaptiveTheme, deviceCapabilityService] = await Promise.all([
          import('../theme/adaptiveTheme').then(m => m.default),
          import('../services/deviceCapabilityService').then(m => m.default),
        ]);

        await Promise.all([adaptiveTheme.initialize(), deviceCapabilityService.initialize()]);

        if (enablePerformanceLogging) {
          console.log(`📱 ${screenName} - Performance services initialized`);
        }
      } catch (error) {
        console.warn(`${screenName} - Performance services initialization failed:`, error);
      }
    };

    initializeServices();
    initialLoad(); // Call once on mount

    return () => {
      isMountedRef.current = false;
      // Abort any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  return {
    entities,
    isLoading,
    error,
    filteredCount,
    refreshing,
    onRefresh,
    handleSearchChange,
    retry,
    retryCount,
    loadingStates,
    // Performance metrics
    hasLoaded: hasLoadedRef.current,
    hasInitiallyLoaded,
    isMounted: isMountedRef.current,
  };
};
