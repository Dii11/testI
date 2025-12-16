import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react';

import { api } from '../../config/env.utils.enhanced';
import type { RootState } from '../index';

// Get API configuration from the robust environment system
const apiConfig = {
  baseUrl: api.getBaseUrl(),
  timeout: api.getTimeout(),
  retryConfig: api.getRetryConfig(),
};

// Create a base query with common configuration
const baseQueryWithAuth = fetchBaseQuery({
  baseUrl: apiConfig.baseUrl,
  timeout: apiConfig.timeout,
  prepareHeaders: (headers, { getState }) => {
    // Get token from auth state
    const token = (getState() as RootState).auth.tokens?.accessToken;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    headers.set('content-type', 'application/json');
    return headers;
  },
});

// Add retry logic for failed requests (using environment configuration)
const baseQueryWithRetry = retry(baseQueryWithAuth, {
  maxRetries: apiConfig.retryConfig.attempts,
  retryCondition: (error: any) => {
    // Retry on network errors or 5xx status codes
    return (
      !error.status ||
      (typeof error.status === 'number' && error.status >= 500) ||
      error.status === 'FETCH_ERROR' ||
      error.status === 'TIMEOUT_ERROR'
    );
  },
});

// Enhanced base query with token refresh logic
const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
  let result = await baseQueryWithRetry(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Try to get a new token
    const refreshToken = (api.getState() as RootState).auth.tokens?.refreshToken;

    if (refreshToken) {
      console.log('🔄 Access token expired, attempting refresh...');

      const refreshResult = await baseQueryWithRetry(
        {
          url: 'auth/refresh',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        // Store the new token
        api.dispatch({
          type: 'auth/tokenRefreshed',
          payload: refreshResult.data,
        });

        // Retry the original query with new token
        result = await baseQueryWithRetry(args, api, extraOptions);
      } else {
        // Refresh failed, logout user
        api.dispatch({ type: 'auth/logout' });
      }
    } else {
      // No refresh token available, logout user
      api.dispatch({ type: 'auth/logout' });
    }
  }

  return result;
};

// Create the main API slice
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'User',
    'Doctor',
    'Customer',
    'Appointment',
    'HealthMetrics',
    'HealthSync',
    'Permission',
    'Notification',
  ],
  keepUnusedDataFor: 60 * 5, // Keep unused data for 5 minutes
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: () => ({}), // Endpoints will be injected by individual API slices
});

// Export hooks
export const {
  // Base hooks
  util: { getRunningQueriesThunk, getRunningMutationsThunk },
} = baseApi;

// Enhanced error handling helper
export const isApiError = (error: unknown): error is { status: number; data: any } => {
  return typeof error === 'object' && error !== null && 'status' in error;
};

export const getApiErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    if (error.data?.message) {
      return error.data.message;
    }
    if (error.data?.error) {
      return error.data.error;
    }
    if (typeof error.data === 'string') {
      return error.data;
    }

    // Default messages for common status codes
    switch (error.status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Authentication required. Please log in.';
      case 403:
        return 'You do not have permission to access this resource.';
      case 404:
        return 'The requested resource was not found.';
      case 408:
        return 'Request timeout. Please try again.';
      case 429:
        return 'Too many requests. Please wait and try again.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
        return 'Service temporarily unavailable. Please try again later.';
      case 503:
        return 'Service maintenance in progress. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred.';
};

// Cache invalidation helpers
export const invalidateTags = (tags: string[]) => (dispatch: any) => {
  tags.forEach(tag => {
    dispatch(baseApi.util.invalidateTags([{ type: tag }]));
  });
};

// Optimistic update helpers
export const optimisticUpdate = <T>(
  endpoint: string,
  data: T,
  onSuccess?: (data: T) => void,
  onError?: (error: any) => void
) => ({
  onQueryStarted: async (arg: any, { dispatch, queryFulfilled }) => {
    // Optimistically update the UI
    const patchResult = dispatch(
      baseApi.util.updateQueryData(endpoint as any, arg, (draft: any) => {
        Object.assign(draft, data);
      })
    );

    try {
      const result = await queryFulfilled;
      onSuccess?.(result.data);
    } catch (error) {
      // Undo the optimistic update on error
      patchResult.undo();
      onError?.(error);
    }
  },
});

// Log API configuration in development
if (__DEV__) {
  console.log('🌐 Enhanced API Configuration:', {
    baseUrl: apiConfig.baseUrl,
    timeout: apiConfig.timeout,
    maxRetries: apiConfig.retryConfig.attempts,
    isLocalhost: api.isLocalhost(),
  });
}

export default baseApi;
