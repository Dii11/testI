import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter, Platform, AppState } from 'react-native';

import { API } from '../constants';
import type { ApiResponse, AuthTokens } from '../types';

import StorageConsistencyManager from './StorageConsistencyManager';
import { getJwtExpirationMs, isJwtExpiringSoon } from '../utils/jwt';

// API Configuration - Uses centralized configuration from constants
const API_BASE_URL = API.BASE_URL;

class ApiService {
  private client: AxiosInstance;
  private tokens: AuthTokens | null = null;
  private refreshTimeoutId: NodeJS.Timeout | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;
  // ✅ CRITICAL FIX: Increase retry attempts to handle network glitches better
  private maxRetryAttempts = 10;  // Increased from 3 to 10
  private retryCount = 0;
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private storageManager: StorageConsistencyManager;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000, // ✅ CRITICAL FIX: Reduced from 30s to 15s for faster failure
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.storageManager = StorageConsistencyManager.getInstance();
    this.setupInterceptors();
    this.loadStoredTokens();
    
    // ✅ CRITICAL FIX: Add app state listener for proactive token refresh
    this.setupAppStateListener();
    
    // ✅ ENHANCEMENT: Add token heartbeat for continuous validation
    this.startTokenHeartbeat();
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async config => {
        if (this.tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${this.tokens.accessToken}`;
        }

        // Log requests in development
        if (__DEV__) {
          console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
          if (config.data) {
            console.log('📤 Request Data:', config.data);
          }
        }

        return config;
      },
      error => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling and token refresh
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        if (__DEV__) {
          console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (__DEV__) {
          console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`);
          console.error('Error details:', error.response?.data);
        }

        // Handle 401 errors (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          // ✅ FIX: If no refresh token, don't retry - just reject immediately to prevent infinite loop
          if (!this.tokens?.refreshToken) {
            if (__DEV__) {
              console.log('❌ 401 error but no refresh token available, not retrying');
            }
            this.retryCount = 0;
            // Don't clear tokens here - just reject the request
            return Promise.reject(error);
          }

          // Check retry limit
          if (this.retryCount >= this.maxRetryAttempts) {
            console.log('🚫 Max retry attempts reached, clearing tokens');
            this.clearTokens();
            this.retryCount = 0;
            return Promise.reject(error);
          }

          originalRequest._retry = true;
          this.retryCount++;

          // Don't retry if this is already a refresh token request to avoid infinite loops
          if (originalRequest.url?.includes('/auth/refresh')) {
            console.log('🚫 Refresh token request failed, not retrying');
            this.clearTokens();
            this.retryCount = 0;
            return Promise.reject(error);
          }

          try {
            if (__DEV__) {
              console.log(
                `🔄 Attempting token refresh... (attempt ${this.retryCount}/${this.maxRetryAttempts})`
              );
            }

            // Use shared refresh promise to prevent multiple concurrent refresh requests
            if (!this.refreshPromise) {
              this.refreshPromise = this.refreshToken().finally(() => {
                this.refreshPromise = null;
              });
            }

            const newTokens = await this.refreshPromise;
            this.setTokens(newTokens);
            this.retryCount = 0; // Reset on success

            if (__DEV__) {
              console.log('✅ Token refreshed successfully');
            }

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            if (__DEV__) {
              console.error('❌ Token refresh failed:', refreshError);
            }

            // Enhanced error differentiation for better handling
            const errorAnalysis = this.analyzeRefreshError(refreshError);

            if (errorAnalysis.shouldLogout) {
              console.log(`🚫 ${errorAnalysis.reason}, logging out user`);
              this.clearTokens();
              this.retryCount = 0;

              // Emit a custom event for app-wide logout handling
              if (Platform.OS === 'web' && typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(
                  new CustomEvent('tokenExpired', {
                    detail: { reason: errorAnalysis.reason, type: errorAnalysis.type },
                  })
                );
              } else {
                // React Native platform
                DeviceEventEmitter.emit('tokenExpired', {
                  reason: errorAnalysis.reason,
                  type: errorAnalysis.type,
                });
              }
            } else {
              console.log(`📡 ${errorAnalysis.reason}, keeping user logged in`);

              // Schedule retry for recoverable errors
              if (errorAnalysis.shouldRetry) {
                this.scheduleTokenRefreshRetry(errorAnalysis.retryAfter);
              }
            }

            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async loadStoredTokens(): Promise<void> {
    try {
      // Use storage consistency manager for reliable token loading
      const tokens = await this.storageManager.retrieveTokens();

      if (tokens) {
        // Validate tokens before using them
        if (this.validateStoredTokens(tokens)) {
          this.tokens = tokens;

          // ✅ ENHANCEMENT: If access token is already expired/expiring soon, trigger immediate refresh
          // instead of just scheduling it for later
          if (this.isAccessTokenExpiringSoon(tokens.accessToken)) {
            if (__DEV__) {
              console.log('🔄 Access token is expired on load, triggering immediate refresh...');
            }

            // Trigger immediate refresh in background (don't await to avoid blocking startup)
            this.refreshToken()
              .then(newTokens => {
                this.setTokens(newTokens);
                if (__DEV__) {
                  console.log('✅ Immediate token refresh on load successful');
                }
              })
              .catch(error => {
                console.warn('⚠️ Immediate token refresh on load failed:', error);
                // Will retry on first API call via interceptor
              });
          } else {
            // Schedule automatic refresh for valid tokens
            this.scheduleTokenRefresh();
          }

          if (__DEV__) {
            console.log('🔑 Loaded and validated stored tokens via storage manager');
          }
        } else {
          if (__DEV__) {
            console.log('🔑 Stored tokens are invalid, clearing them');
          }
          // Clear invalid tokens
          this.clearTokens();
        }
      }
    } catch (error) {
      console.error('Failed to load stored tokens:', error);

      // Fallback to direct storage loading
      try {
        let storedTokens: string | null = null;

        if (Platform.OS === 'web') {
          storedTokens = localStorage.getItem('hopmed_auth_tokens');
        } else {
          try {
            storedTokens = await SecureStore.getItemAsync('hopmed_auth_tokens');
          } catch (secureStoreError) {
            console.warn('SecureStore failed, falling back to AsyncStorage:', secureStoreError);
            storedTokens = await AsyncStorage.getItem('hopmed_auth_tokens');
          }
        }

        if (storedTokens) {
          const parsedTokens = JSON.parse(storedTokens);
          if (this.validateStoredTokens(parsedTokens)) {
            this.tokens = parsedTokens;

            // Same immediate refresh logic for fallback path
            if (this.isAccessTokenExpiringSoon(parsedTokens.accessToken)) {
              this.refreshToken()
                .then(newTokens => {
                  this.setTokens(newTokens);
                })
                .catch(error => {
                  console.warn('⚠️ Immediate token refresh failed:', error);
                });
            } else {
              this.scheduleTokenRefresh();
            }

            if (__DEV__) {
              console.log('🔑 Loaded tokens via fallback storage');
            }
          } else {
            this.clearTokens();
          }
        }
      } catch (fallbackError) {
        console.error('Fallback token loading also failed:', fallbackError);
        this.clearTokens();
      }
    }
  }

  public setTokens(tokens: AuthTokens): void {
    this.tokens = tokens;

    // Use storage consistency manager for reliable token storage
    this.storageManager.storeTokens(tokens).catch(error => {
      console.error('Failed to store tokens via storage manager:', error);

      // Fallback to direct storage
      const tokenString = JSON.stringify(tokens);
      if (Platform.OS === 'web') {
        localStorage.setItem('hopmed_auth_tokens', tokenString);
      } else {
        SecureStore.setItemAsync('hopmed_auth_tokens', tokenString).catch(secureStoreError => {
          console.warn('SecureStore failed, falling back to AsyncStorage:', secureStoreError);
          AsyncStorage.setItem('hopmed_auth_tokens', tokenString);
        });
      }
    });

    // Schedule automatic token refresh (refresh 5 minutes before expiry)
    this.scheduleTokenRefresh();

    if (__DEV__) {
      console.log('🔑 Stored tokens via storage consistency manager');
    }
  }

  public clearTokens(): void {
    this.tokens = null;

    // Use storage consistency manager for reliable token clearing
    this.storageManager.clearTokens().catch(error => {
      console.error('Failed to clear tokens via storage manager:', error);

      // Fallback to direct storage clearing
      if (Platform.OS === 'web') {
        localStorage.removeItem('hopmed_auth_tokens');
      } else {
        SecureStore.deleteItemAsync('hopmed_auth_tokens').catch(secureStoreError => {
          console.warn('SecureStore delete failed:', secureStoreError);
        });
        AsyncStorage.removeItem('hopmed_auth_tokens');
      }
    });

    // Clear any scheduled refresh
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }

    // Clear refresh promise and reset retry count
    this.refreshPromise = null;
    this.retryCount = 0;

    // Clear any pending retry timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    if (__DEV__) {
      console.log('🗑️ Cleared tokens from secure storage');
    }
  }

  public getTokens(): AuthTokens | null {
    return this.tokens;
  }

  // ✅ CRITICAL FIX: Increased buffer for better proactive refresh
  // Validate token format and expiration using safe decoder
  private isAccessTokenExpiringSoon(token: string): boolean {
    const bufferMs = 20 * 60 * 1000; // ✅ Increased from 3min to 20min for 1-hour tokens
    return isJwtExpiringSoon(token, bufferMs);
  }

  // Public method to check if stored tokens are valid
  public areTokensValid(): boolean {
    if (!this.tokens?.accessToken) {
      return false;
    }
    const expMs = getJwtExpirationMs(this.tokens.accessToken);
    if (!expMs) return false;
    const bufferMs = 2 * 60 * 1000; // 2 minutes buffer
    return Date.now() + bufferMs < expMs;
  }

  // Enhanced token validation
  private validateStoredTokens(tokens: AuthTokens): boolean {
    if (!tokens.accessToken || !tokens.refreshToken) {
      return false;
    }

    // ✅ CRITICAL FIX: Don't reject tokens just because access token is expired!
    // As long as we have a refresh token, we can get a new access token
    // Only validate the access token FORMAT, not expiration
    try {
      // Check if access token is well-formed JWT
      const parts = tokens.accessToken.split('.');
      if (parts.length !== 3) {
        if (__DEV__) {
          console.log('🔑 Access token has invalid format (not a JWT)');
        }
        return false;
      }

      // Try to parse the payload using safe decoder
      const exp = getJwtExpirationMs(tokens.accessToken);
      if (!exp) {
        if (__DEV__) {
          console.log('🔑 Access token payload could not be decoded');
        }
        return false;
      }

      // Token is well-formed - even if expired, we can refresh it
      if (__DEV__) {
        const expiringSoon = this.isAccessTokenExpiringSoon(tokens.accessToken);
        if (expiringSoon) {
          console.log('🔑 Access token is expired/expiring soon but refresh token available - will refresh');
        } else {
          console.log('🔑 Access token is valid');
        }
      }

      return true;
    } catch (error) {
      if (__DEV__) {
        console.warn('🔑 Invalid access token format:', error);
      }
      return false;
    }
  }

  /**
   * ✅ ENHANCED: Schedule token refresh with optimal timing for 1-hour tokens
   */
  private scheduleTokenRefresh(): void {
    if (!this.tokens?.accessToken) return;

    try {
      // Clear any existing scheduled refresh first
      if (this.refreshTimeoutId) {
        clearTimeout(this.refreshTimeoutId);
        this.refreshTimeoutId = null;
      }

      // Decode JWT token to get expiration time
      const expirationTime = getJwtExpirationMs(this.tokens.accessToken);
      if (!expirationTime) return;
      
      const currentTime = Date.now();
      const timeUntilExpiry = expirationTime - currentTime;
      
      // ✅ CRITICAL FIX: Dynamic refresh timing based on actual token expiration
      // Calculate token lifetime from actual issued time and expiration
      const issuedAtTime = expirationTime - (60 * 60 * 1000); // Estimate issued time (1h before expiry)
      const actualTokenLifetime = expirationTime - issuedAtTime;
      
      // Refresh at 40% of token lifetime (24 minutes for 1-hour token)
      // This gives 36-minute safety buffer before expiry
      const optimalRefreshTime = actualTokenLifetime * 0.4;
      
      // Also calculate absolute time: 20 minutes before expiry as failsafe
      const twentyMinutesBeforeExpiry = timeUntilExpiry - (20 * 60 * 1000);
      
      // Use whichever comes first: 40% of lifetime or 20 minutes before expiry
      // But ensure at least 1 minute from now
      const refreshTime = Math.max(
        Math.min(optimalRefreshTime, twentyMinutesBeforeExpiry),
        1 * 60 * 1000  // Minimum 1 minute
      );

      if (refreshTime > 0 && timeUntilExpiry > refreshTime) {
        if (__DEV__) {
          const refreshInMinutes = Math.round(refreshTime / 1000 / 60);
          const expiresInMinutes = Math.round(timeUntilExpiry / 1000 / 60);
          const bufferMinutes = Math.round((timeUntilExpiry - refreshTime) / 1000 / 60);
          console.log(
            `🕒 Token refresh scheduled in ${refreshInMinutes}m (expires in ${expiresInMinutes}m, buffer: ${bufferMinutes}m)`
          );
        }

        this.refreshTimeoutId = setTimeout(async () => {
          this.refreshTimeoutId = null; // Clear reference immediately
          try {
            if (__DEV__) {
              console.log('🔄 Scheduled token refresh triggered');
            }
            const newTokens = await this.refreshToken();
            this.setTokens(newTokens);
            if (__DEV__) {
              console.log('✅ Scheduled token refresh successful');
            }
          } catch (error) {
            if (__DEV__) {
              console.error('❌ Scheduled token refresh failed:', error);
            }
            // Don't schedule retry here - let the interceptor handle it
          }
        }, refreshTime);
      } else if (__DEV__) {
        console.log('⚠️ Token expires too soon, not scheduling refresh');
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Could not schedule token refresh:', error);
      }
    }
  }

  /**
   * Analyze refresh token errors to determine appropriate response
   */
  private analyzeRefreshError(error: any): {
    type: 'definitive_auth_failure' | 'network_error' | 'server_error' | 'rate_limit' | 'unknown';
    reason: string;
    shouldLogout: boolean;
    shouldRetry: boolean;
    retryAfter: number; // milliseconds
  } {
    const status = error.response?.status;
    const errorCode = error.code;
    const errorMessage = error.message?.toLowerCase() || '';
    const responseData = error.response?.data;

    // ✅ CRITICAL FIX: Check backend-provided error codes for definitive auth failures
    // Definitive authentication failures - should logout
    if (status === 401) {
      // Backend now returns specific error codes
      const definitiveAuthFailureCodes = [
        'REFRESH_TOKEN_EXPIRED',    // ✅ Refresh token has expired - user must re-login
        'INVALID_REFRESH_TOKEN',    // ✅ Malformed or invalid refresh token
        'USER_NOT_FOUND',           // ✅ User was deleted
        'TOKEN_REVOKED',            // Token was explicitly revoked
        'ACCOUNT_DISABLED',         // User account was disabled
      ];
      
      // Check for error code from backend
      if (responseData?.code && definitiveAuthFailureCodes.includes(responseData.code)) {
        return {
          type: 'definitive_auth_failure',
          reason: `Authentication failed: ${responseData.code}`,
          shouldLogout: true,
          shouldRetry: false,
          retryAfter: 0,
        };
      }
      
      // ✅ NEW: If 401 without specific code, might be temporary - retry once
      return {
        type: 'network_error',
        reason: '401 without specific error code - may be temporary server issue',
        shouldLogout: false,
        shouldRetry: true,
        retryAfter: 10000, // Retry in 10 seconds
      };
    }

    // Max retry attempts reached - should logout to prevent infinite loops
    if (this.retryCount >= this.maxRetryAttempts) {
      return {
        type: 'definitive_auth_failure',
        reason: 'Max retry attempts reached',
        shouldLogout: true,
        shouldRetry: false,
        retryAfter: 0,
      };
    }

    // Network errors - should retry with backoff
    if (
      !error.response ||
      errorCode === 'NETWORK_ERROR' ||
      errorMessage.includes('network error')
    ) {
      return {
        type: 'network_error',
        reason: 'Network connectivity issue',
        shouldLogout: false,
        shouldRetry: true,
        retryAfter: this.calculateRetryDelay(),
      };
    }

    // Rate limiting - should retry with longer delay
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'];
      const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 1 minute

      return {
        type: 'rate_limit',
        reason: 'Rate limited by server',
        shouldLogout: false,
        shouldRetry: true,
        retryAfter: Math.min(retryDelay, 300000), // Max 5 minutes
      };
    }

    // Server errors (5xx) - should retry with backoff
    if (status >= 500) {
      return {
        type: 'server_error',
        reason: `Server error (${status})`,
        shouldLogout: false,
        shouldRetry: true,
        retryAfter: this.calculateRetryDelay(),
      };
    }

    // Client errors other than 401 - generally should not retry
    if (status >= 400 && status < 500) {
      return {
        type: 'definitive_auth_failure',
        reason: `Client error (${status})`,
        shouldLogout: true,
        shouldRetry: false,
        retryAfter: 0,
      };
    }

    // Unknown errors - conservative approach, don't logout but don't retry
    return {
      type: 'unknown',
      reason: 'Unknown error type',
      shouldLogout: false,
      shouldRetry: false,
      retryAfter: 0,
    };
  }

  /**
   * Calculate retry delay using exponential backoff with jitter
   */
  /**
   * ✅ ENHANCED: Calculate exponential backoff delay for retries
   * More sophisticated backoff with better jitter and network-aware delays
   */
  private calculateRetryDelay(): number {
    const baseDelay = 5000; // ✅ Increased from 1s to 5s for mobile networks
    const maxDelay = 300000; // ✅ Increased from 30s to 5m for persistent issues
    
    // ✅ Enhanced exponential backoff: slower growth for mobile networks
    const exponentialDelay = Math.min(baseDelay * Math.pow(1.5, this.retryCount), maxDelay);
    
    // ✅ Enhanced jitter: 20-50% variation to prevent thundering herd
    const jitterRange = 0.3; // 30% variation
    const jitter = (Math.random() - 0.5) * 2 * jitterRange * exponentialDelay;
    
    const finalDelay = Math.max(exponentialDelay + jitter, 1000); // Min 1 second
    
    if (__DEV__) {
      console.log(`🔄 Retry ${this.retryCount + 1}/${this.maxRetryAttempts} in ${Math.round(finalDelay / 1000)}s`);
    }
    
    return finalDelay;
  }

  /**
   * Schedule a retry for token refresh
   */
  private scheduleTokenRefreshRetry(delay: number): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    console.log(`⏰ Scheduling token refresh retry in ${Math.round(delay / 1000)}s`);

    this.retryTimeoutId = setTimeout(async () => {
      this.retryTimeoutId = null;

      try {
        console.log('🔄 Executing scheduled token refresh retry');
        await this.refreshToken();
        console.log('✅ Scheduled token refresh retry successful');
        this.retryCount = 0; // Reset on success
      } catch (error) {
        console.warn('❌ Scheduled token refresh retry failed:', error);
        // The error will be handled by the refresh token method
      }
    }, delay);
  }

  // Shared refresh method to be reused across app to avoid duplicate refresh calls
  public async refreshTokenShared(): Promise<AuthTokens> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.refreshToken().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async refreshToken(): Promise<AuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken: this.tokens.refreshToken,
      });

      // Handle direct response from backend (not wrapped in ApiResponse format)
      let tokenData = response.data;
      if (
        response.data &&
        typeof response.data === 'object' &&
        !response.data.hasOwnProperty('success')
      ) {
        tokenData = response.data;
      } else if (response.data?.data) {
        tokenData = response.data.data;
      }

      return tokenData;
    } catch (error: any) {
      if (__DEV__) {
        console.error('Token refresh failed:', error.response?.data || error.message);
      }

      // Create a more specific error with additional context
      const enhancedError = new Error(error.message || 'Token refresh failed');
      (enhancedError as any).response = error.response;
      (enhancedError as any).status = error.response?.status;
      (enhancedError as any).isNetworkError = !error.response;
      (enhancedError as any).isTokenError = error.response?.status === 401;

      throw enhancedError;
    }
  }

  // Generic API methods
  public async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.client.get(url, { params });

    // Handle direct backend responses that aren't wrapped in ApiResponse format
    if (
      response.data &&
      typeof response.data === 'object' &&
      !response.data.hasOwnProperty('success')
    ) {
      return {
        success: true,
        data: response.data,
      } as ApiResponse<T>;
    }

    return response.data;
  }

  public async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, data);

    // Handle direct backend responses that aren't wrapped in ApiResponse format
    if (
      response.data &&
      typeof response.data === 'object' &&
      !response.data.hasOwnProperty('success')
    ) {
      return {
        success: true,
        data: response.data,
      } as ApiResponse<T>;
    }

    return response.data;
  }

  public async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put(url, data);
    return response.data;
  }

  public async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete(url);
    return response.data;
  }

  public async upload<T>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // WebSocket URL for chat
  public getWebSocketUrl(): string {
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = API_BASE_URL.replace(/^https?:\/\//, '').replace('/api', '');
    return `${wsProtocol}://${baseUrl}/chat`;
  }

  // Method to check if we have valid tokens
  public hasValidTokens(): boolean {
    return this.areTokensValid() && !!this.tokens?.refreshToken;
  }

  // Method to get current tokens
  public getCurrentTokens(): AuthTokens | null {
    return this.tokens;
  }

  // ✅ CRITICAL FIX: App state listener for proactive token refresh
  private setupAppStateListener(): void {
    if (Platform.OS === 'web') return;

    AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App resumed - checking token validity');
        
        // Check if we have tokens
        if (!this.tokens?.accessToken) return;
        
        // ✅ ENHANCED: More aggressive check on app resume (< 20 minutes)
        // This ensures token is refreshed before user starts using the app
        if (this.isAccessTokenExpiringSoon(this.tokens.accessToken)) {
          console.log('🔄 Token expiring soon (< 20min), refreshing proactively on app resume');
          
          try {
            const newTokens = await this.refreshToken();
            this.setTokens(newTokens);
            console.log('✅ Token refreshed successfully on app resume');
          } catch (error) {
            console.warn('⚠️ Token refresh on app resume failed:', error);
            // Will retry on next API call via interceptor
          }
        } else {
          console.log('🔑 Token still valid on app resume');
        }
      }
    });
  }

  // ✅ ENHANCEMENT: Token heartbeat for continuous validation
  private startTokenHeartbeat(): void {
    // ✅ CRITICAL FIX: More frequent checks (every 3 minutes) with better threshold
    setInterval(async () => {
      if (!this.tokens?.accessToken) return;
      
      // ✅ Use same threshold as app resume (20 minutes) for consistency
      const bufferMs = 20 * 60 * 1000; // 20 minutes buffer
      const isExpiringSoon = isJwtExpiringSoon(this.tokens.accessToken, bufferMs);
      
      if (isExpiringSoon) {
        console.log('💓 Heartbeat detected expiring token (< 20min), refreshing proactively');
        
        try {
          const newTokens = await this.refreshToken();
          this.setTokens(newTokens);
          console.log('✅ Heartbeat token refresh successful');
        } catch (error) {
          console.warn('⚠️ Heartbeat token refresh failed:', error);
          // Will retry on next API call via interceptor
        }
      }
    }, 3 * 60 * 1000);  // ✅ Every 3 minutes (increased from 5)
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
