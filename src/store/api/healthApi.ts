import React from 'react';

import type { HealthDataType, HealthMetric } from '../../types/health';

import { baseApi } from './baseApi';

// Health-specific API endpoints
export const healthApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    // Get health data with caching and background sync
    getHealthData: builder.query<
      {
        heartRate: HealthMetric[];
        steps: HealthMetric[];
        sleep: HealthMetric[];
        weight: HealthMetric[];
        bloodPressure: HealthMetric[];
        oxygenSaturation: HealthMetric[];
        bodyTemperature: HealthMetric[];
        bloodGlucose: HealthMetric[];
        caloriesBurned: HealthMetric[];
      },
      { userId: string; period: string; dataTypes?: HealthDataType[] }
    >({
      query: ({ userId, period, dataTypes }) => ({
        url: `health/data/${userId}`,
        params: {
          period,
          ...(dataTypes && { types: dataTypes.join(',') }),
          limit: period === 'Today' ? 100 : period === 'This week' ? 500 : 1000,
        },
      }),
      providesTags: (result, error, arg) => [
        { type: 'HealthMetrics', id: `${arg.userId}-${arg.period}` },
        { type: 'HealthMetrics', id: 'LIST' },
      ],
      // Keep data fresh for 5 minutes
      keepUnusedDataFor: 60 * 5,
    }),

    // Get specific metric data with pagination
    getMetricData: builder.query<
      {
        data: HealthMetric[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          hasMore: boolean;
        };
      },
      {
        userId: string;
        dataType: HealthDataType;
        period: string;
        page?: number;
        limit?: number;
      }
    >({
      query: ({ userId, dataType, period, page = 1, limit = 50 }) => ({
        url: `health/metrics/${userId}/${dataType}`,
        params: { period, page, limit },
      }),
      providesTags: (result, error, arg) => [
        { type: 'HealthMetrics', id: `${arg.userId}-${arg.dataType}-${arg.period}` },
      ],
      // Merge pages for pagination
      serializeQueryArgs: ({ queryArgs }) => {
        const { userId, dataType, period } = queryArgs;
        return `${userId}-${dataType}-${period}`;
      },
      merge: (currentCache, newItems, { arg }) => {
        if (arg.page === 1) {
          // First page, replace cache
          return newItems;
        } else {
          // Subsequent pages, merge
          return {
            ...newItems,
            data: [...currentCache.data, ...newItems.data],
          };
        }
      },
      forceRefetch({ currentArg, previousArg }) {
        return currentArg?.page !== previousArg?.page;
      },
    }),

    // Sync health data from wearable devices
    syncHealthData: builder.mutation<
      { success: boolean; recordsSync?: number },
      { userId: string; providers?: string[]; forceSync?: boolean }
    >({
      query: ({ userId, providers, forceSync }) => ({
        url: `health/sync/${userId}`,
        method: 'POST',
        body: { providers, forceSync },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'HealthMetrics', id: 'LIST' },
        { type: 'HealthSync', id: arg.userId },
      ],
      // Optimistic update for UI feedback
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        // Show sync in progress
        const patchResult = dispatch(
          healthApi.util.updateQueryData(
            'getSyncStatus' as any,
            { userId: arg.userId },
            (draft: any) => {
              if (draft) {
                draft.isOnline = false;
                draft.lastSync = null;
                draft.pendingUploads = (draft.pendingUploads || 0) + 1;
              }
            }
          )
        );

        try {
          const result = await queryFulfilled;
          // Update sync status on success
          dispatch(
            healthApi.util.updateQueryData(
              'getSyncStatus' as any,
              { userId: arg.userId },
              (draft: any) => {
                if (draft) {
                  draft.isOnline = true;
                  draft.lastSync = new Date().toISOString();
                  draft.pendingUploads = Math.max((draft.pendingUploads || 1) - 1, 0);
                  draft.syncHistory = [
                    {
                      timestamp: new Date().toISOString(),
                      status: 'success',
                      recordsSync: result.data.recordsSync || 0,
                    },
                    ...(draft.syncHistory || []).slice(0, 9), // Keep last 10 entries
                  ];
                }
              }
            )
          );
        } catch (error) {
          // Revert optimistic update
          patchResult.undo();
        }
      },
    }),

    // Get sync status
    getSyncStatus: builder.query<
      {
        isOnline: boolean;
        lastSync: string | null;
        pendingUploads: number;
        syncHistory: {
          timestamp: string;
          status: 'success' | 'failed' | 'partial';
          recordsSync?: number;
          error?: string;
        }[];
        connectedProviders: string[];
      },
      { userId: string }
    >({
      query: ({ userId }) => `health/sync/status/${userId}`,
      providesTags: (result, error, arg) => [{ type: 'HealthSync', id: arg.userId }],
      // Poll every 30 seconds when sync is active
      onCacheEntryAdded: async (
        arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved, dispatch }
      ) => {
        try {
          await cacheDataLoaded;

          const poll = setInterval(() => {
            dispatch(healthApi.endpoints.getSyncStatus.initiate(arg, { forceRefetch: true }));
          }, 30000);

          await cacheEntryRemoved;
          clearInterval(poll);
        } catch {
          // Handle cleanup on error
        }
      },
    }),

    // Upload manual health data entry
    uploadHealthData: builder.mutation<
      { success: boolean; recordId: string },
      {
        userId: string;
        dataType: HealthDataType;
        value: number;
        timestamp: string;
        metadata?: Record<string, any>;
      }
    >({
      query: ({ userId, ...data }) => ({
        url: `health/data/${userId}`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'HealthMetrics', id: `${arg.userId}-Today` },
        { type: 'HealthMetrics', id: `${arg.userId}-This week` },
        { type: 'HealthMetrics', id: 'LIST' },
      ],
    }),

    // Batch upload health data
    batchUploadHealthData: builder.mutation<
      { success: boolean; recordsCreated: number; errors: any[] },
      {
        userId: string;
        data: {
          dataType: HealthDataType;
          value: number;
          timestamp: string;
          metadata?: Record<string, any>;
        }[];
      }
    >({
      query: ({ userId, data }) => ({
        url: `health/data/${userId}/batch`,
        method: 'POST',
        body: { data },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'HealthMetrics', id: 'LIST' },
        { type: 'HealthSync', id: arg.userId },
      ],
    }),

    // Get health insights and recommendations
    getHealthInsights: builder.query<
      {
        insights: {
          id: string;
          type: 'recommendation' | 'alert' | 'achievement';
          title: string;
          description: string;
          priority: 'low' | 'medium' | 'high';
          createdAt: string;
          dataPoints: HealthDataType[];
        }[];
        goals: {
          id: string;
          type: HealthDataType;
          target: number;
          current: number;
          period: string;
          progress: number;
        }[];
      },
      { userId: string }
    >({
      query: ({ userId }) => `health/insights/${userId}`,
      providesTags: (result, error, arg) => [
        { type: 'HealthMetrics', id: `insights-${arg.userId}` },
      ],
      keepUnusedDataFor: 60 * 10, // Keep insights for 10 minutes
    }),

    // Update health goals
    updateHealthGoals: builder.mutation<
      { success: boolean },
      {
        userId: string;
        goals: {
          type: HealthDataType;
          target: number;
          period: string;
        }[];
      }
    >({
      query: ({ userId, goals }) => ({
        url: `health/goals/${userId}`,
        method: 'PUT',
        body: { goals },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'HealthMetrics', id: `insights-${arg.userId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

// Export hooks
export const {
  useGetHealthDataQuery,
  useGetMetricDataQuery,
  useSyncHealthDataMutation,
  useGetSyncStatusQuery,
  useUploadHealthDataMutation,
  useBatchUploadHealthDataMutation,
  useGetHealthInsightsQuery,
  useUpdateHealthGoalsMutation,

  // Lazy query hooks for manual triggering
  useLazyGetHealthDataQuery,
  useLazyGetMetricDataQuery,
  useLazyGetHealthInsightsQuery,

  // Prefetch hooks for performance
  usePrefetch,
} = healthApi;

// Advanced hooks for complex scenarios
export const useHealthDataWithPagination = (
  userId: string,
  dataType: HealthDataType,
  period: string
) => {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isFetching, error } = healthApi.endpoints.getMetricData.useQuery({
    userId,
    dataType,
    period,
    page,
  });

  const loadMore = React.useCallback(() => {
    if (data?.pagination.hasMore && !isFetching) {
      setPage(prev => prev + 1);
    }
  }, [data?.pagination.hasMore, isFetching]);

  const reset = React.useCallback(() => {
    setPage(1);
  }, []);

  return {
    data: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    isFetching,
    error,
    loadMore,
    reset,
    hasMore: data?.pagination.hasMore || false,
  };
};

export default healthApi;
