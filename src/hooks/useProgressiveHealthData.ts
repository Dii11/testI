import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';

import { RootState } from '../store';
import { healthApi, useHealthDataWithPagination } from '../store/api/healthApi';
import { selectUser } from '../store/selectors/authSelectors';
import type { HealthDataType, HealthMetric } from '../types/health';

interface ProgressiveHealthDataOptions {
  userId?: string;
  dataType: HealthDataType;
  period: string;
  initialBatchSize?: number;
  batchSize?: number;
  maxItems?: number;
  enableAutoLoad?: boolean;
  autoLoadThreshold?: number; // Load more when this many items from end
}

interface ProgressiveHealthDataReturn {
  data: HealthMetric[];
  isLoading: boolean;
  isFetching: boolean;
  hasMore: boolean;
  error: any;
  loadMore: () => void;
  reset: () => void;
  refresh: () => void;
  totalLoaded: number;
  estimatedTotal?: number;
  progress: number; // 0-100
  canLoadMore: boolean;
}

export const useProgressiveHealthData = ({
  userId,
  dataType,
  period,
  initialBatchSize = 50,
  batchSize = 25,
  maxItems = 1000,
  enableAutoLoad = false,
  autoLoadThreshold = 10,
}: ProgressiveHealthDataOptions): ProgressiveHealthDataReturn => {
  const currentUser = useSelector(selectUser);
  const effectiveUserId = userId || currentUser?.id;

  const [batches, setBatches] = useState<HealthMetric[][]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Use the RTK Query hook for pagination
  const {
    data: paginatedData,
    isLoading,
    isFetching,
    error,
    loadMore: loadMoreFromQuery,
    reset: resetQuery,
    hasMore,
  } = useHealthDataWithPagination(effectiveUserId!, dataType, period);

  // Flatten all batches into a single array
  const data = useMemo(() => {
    return batches.flat().slice(0, maxItems);
  }, [batches, maxItems]);

  const totalLoaded = data.length;
  const canLoadMore = hasMore && totalLoaded < maxItems && !isLoading && !isFetching;

  // Estimate total based on current loading patterns
  const estimatedTotal = useMemo(() => {
    if (!hasMore) return totalLoaded;

    // Simple estimation: assume similar density throughout the period
    const loadedPages = batches.length;
    if (loadedPages < 2) return undefined;

    const avgItemsPerPage = totalLoaded / loadedPages;
    // Estimate 20% more pages might be available
    return Math.round(avgItemsPerPage * loadedPages * 1.2);
  }, [batches.length, totalLoaded, hasMore]);

  const progress = estimatedTotal ? Math.min((totalLoaded / estimatedTotal) * 100, 100) : 0;

  // Load more data
  const loadMore = useCallback(() => {
    if (canLoadMore) {
      loadMoreFromQuery();
    }
  }, [canLoadMore, loadMoreFromQuery]);

  // Reset all data
  const reset = useCallback(() => {
    setBatches([]);
    setIsInitialized(false);
    resetQuery();
  }, [resetQuery]);

  // Refresh data (reset and reload)
  const refresh = useCallback(() => {
    reset();
    // The initial load will be triggered by the effect
  }, [reset]);

  // Update batches when new paginated data arrives
  useEffect(() => {
    if (paginatedData && paginatedData.length > 0) {
      setBatches(prevBatches => {
        // Check if this is new data or a reset
        const isNewBatch =
          prevBatches.length === 0 ||
          !prevBatches.flat().some(item => item.timestamp === paginatedData[0]?.timestamp);

        if (isNewBatch) {
          return [...prevBatches, paginatedData];
        }

        return prevBatches;
      });

      if (!isInitialized) {
        setIsInitialized(true);
      }
    }
  }, [paginatedData, isInitialized]);

  // Auto-load functionality
  useEffect(() => {
    if (enableAutoLoad && canLoadMore && data.length > 0) {
      const shouldAutoLoad = data.length - totalLoaded <= autoLoadThreshold;
      if (shouldAutoLoad) {
        loadMore();
      }
    }
  }, [enableAutoLoad, canLoadMore, data.length, totalLoaded, autoLoadThreshold, loadMore]);

  return {
    data,
    isLoading: isLoading && !isInitialized,
    isFetching,
    hasMore,
    error,
    loadMore,
    reset,
    refresh,
    totalLoaded,
    estimatedTotal,
    progress,
    canLoadMore,
  };
};

// Hook for managing multiple health data types with progressive loading
export const useProgressiveMultiHealthData = (
  dataTypes: HealthDataType[],
  period: TimePeriod,
  userId?: string
) => {
  const results = dataTypes.map(dataType =>
    useProgressiveHealthData({
      userId,
      dataType,
      period,
      initialBatchSize: 30, // Smaller initial batch for multiple types
      batchSize: 15,
      enableAutoLoad: false, // Disable auto-load for multiple types
    })
  );

  const isLoading = results.some(result => result.isLoading);
  const isFetching = results.some(result => result.isFetching);
  const hasError = results.some(result => result.error);
  const errors = results.filter(result => result.error).map(result => result.error);

  const loadMoreAll = useCallback(() => {
    results.forEach(result => {
      if (result.canLoadMore) {
        result.loadMore();
      }
    });
  }, [results]);

  const resetAll = useCallback(() => {
    results.forEach(result => result.reset());
  }, [results]);

  const refreshAll = useCallback(() => {
    results.forEach(result => result.refresh());
  }, [results]);

  const dataByType = useMemo(() => {
    const result: Record<HealthDataType, HealthMetric[]> = {} as any;
    dataTypes.forEach((dataType, index) => {
      result[dataType] = results[index].data;
    });
    return result;
  }, [dataTypes, results]);

  const totalProgress = useMemo(() => {
    const validProgresses = results.map(result => result.progress).filter(progress => progress > 0);

    return validProgresses.length > 0
      ? validProgresses.reduce((sum, progress) => sum + progress, 0) / validProgresses.length
      : 0;
  }, [results]);

  return {
    dataByType,
    isLoading,
    isFetching,
    hasError,
    errors,
    loadMoreAll,
    resetAll,
    refreshAll,
    results,
    totalProgress,
    canLoadMoreAny: results.some(result => result.canLoadMore),
  };
};

// Hook for adaptive loading based on device performance
export const useAdaptiveHealthDataLoading = (
  dataType: HealthDataType,
  period: TimePeriod,
  userId?: string
) => {
  const [deviceCapability, setDeviceCapability] = useState<'low' | 'mid' | 'high'>('mid');

  // Detect device capability (simplified)
  useEffect(() => {
    const detectCapability = () => {
      // This is a simplified detection - in a real app, you'd use more sophisticated methods
      const userAgent = navigator.userAgent || '';
      const isLowEnd = /Android [1-5]/.test(userAgent) || /iPhone [1-7]/.test(userAgent);
      const isHighEnd =
        /iPhone (1[2-9]|[2-9][0-9])/.test(userAgent) ||
        /Android (1[0-9]|[2-9][0-9])/.test(userAgent);

      if (isLowEnd) {
        setDeviceCapability('low');
      } else if (isHighEnd) {
        setDeviceCapability('high');
      } else {
        setDeviceCapability('mid');
      }
    };

    detectCapability();
  }, []);

  // Adaptive parameters based on device capability
  const adaptiveParams = useMemo(() => {
    switch (deviceCapability) {
      case 'low':
        return {
          initialBatchSize: 20,
          batchSize: 10,
          maxItems: 200,
          enableAutoLoad: false,
        };
      case 'high':
        return {
          initialBatchSize: 100,
          batchSize: 50,
          maxItems: 2000,
          enableAutoLoad: true,
          autoLoadThreshold: 20,
        };
      default: // mid
        return {
          initialBatchSize: 50,
          batchSize: 25,
          maxItems: 1000,
          enableAutoLoad: false,
        };
    }
  }, [deviceCapability]);

  const progressiveData = useProgressiveHealthData({
    userId,
    dataType,
    period,
    ...adaptiveParams,
  });

  return {
    ...progressiveData,
    deviceCapability,
    adaptiveParams,
  };
};

export default useProgressiveHealthData;
