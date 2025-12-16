import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { authService } from '../../services/authService';
import type { User, AuthTokens, LoginRequest, RegisterRequest } from '../../types';
import type { RootState } from '../index';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitializing: boolean;
  pendingActions: string[];
  registrationFlow: {
    isActive: boolean;
    currentStep: 'register' | 'referral' | 'verification' | 'password' | null;
    formData: any;
    phoneNumber?: string;
  };
}

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitializing: false,
  pendingActions: [],
  registrationFlow: {
    isActive: false,
    currentStep: null,
    formData: null,
    phoneNumber: undefined,
  },
};

// Async thunks for API calls
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData: RegisterRequest, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData);
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.message || 'Registration failed');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Registration failed');
    }
  }
);

export const loadStoredAuth = createAsyncThunk(
  'auth/loadStored',
  async (_, { rejectWithValue }) => {
    try {
      const tokens = authService.getStoredTokens();
      if (!tokens) {
        return rejectWithValue('No stored authentication tokens');
      }

      try {
        // Try to get user profile with stored tokens
        const response = await authService.getProfile();
        if (response.success && response.data) {
          return { user: response.data, tokens };
        } else if (response.data && typeof response.data === 'object' && 'id' in response.data) {
          // Handle direct response format - ensure it's a User object
          return { user: response.data as User, tokens };
        }

        throw new Error('Invalid profile response format');
      } catch (profileError: any) {
        console.warn('Profile fetch failed, attempting token refresh:', profileError.message);

        // Only attempt refresh for 401 Unauthorized errors (expired tokens)
        if (profileError.response?.status === 401 || profileError.message?.includes('401')) {
          try {
            console.log('🔄 Attempting token refresh...');
            const refreshResponse = await authService.refreshToken();

            if (refreshResponse.success && refreshResponse.data) {
              const refreshedTokens = refreshResponse.data;

              // Try to get profile with new tokens
              const profileResponse = await authService.getProfile();
              const userData =
                profileResponse.success && profileResponse.data
                  ? profileResponse.data
                  : profileResponse.data &&
                      typeof profileResponse.data === 'object' &&
                      'id' in profileResponse.data
                    ? (profileResponse.data as User)
                    : null;

              if (userData) {
                console.log('✅ Token refresh successful');
                return { user: userData, tokens: refreshedTokens };
              }
              throw new Error('Invalid user data after token refresh');
            }
            throw new Error('Token refresh response invalid');
          } catch (refreshError: any) {
            console.error('🚫 Token refresh failed:', refreshError.message);
            // Clear stored tokens only on refresh failure
            authService.clearSession();
            return rejectWithValue('Token expired and refresh failed');
          }
        }

        // For non-401 errors (network issues, etc.), don't clear session
        // Let the user stay logged in and retry later
        console.warn('Network error during auth validation, keeping user logged in');
        return rejectWithValue(`Network error: ${profileError.message}`);
      }
    } catch (error: any) {
      console.error('Unexpected error during auth loading:', error.message);
      // Only clear session for token-related errors, not network issues
      if (error.message?.includes('Token') || error.message?.includes('401')) {
        authService.clearSession();
      }
      return rejectWithValue(error.message || 'Failed to load stored auth');
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (userData: Partial<User>, { rejectWithValue }) => {
    try {
      const response = await authService.updateProfile(userData);
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.message || 'Profile update failed');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Profile update failed');
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await authService.logout();
  } catch (error: any) {
    // Still logout locally even if API call fails
    console.warn('Logout API call failed:', error.message);
  }
});

// Add session restoration on app startup
export const restoreSession = createAsyncThunk(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getCurrentUser();
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue('No valid session found');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Session restoration failed');
    }
  }
);

// Enhanced session initialization that handles network errors gracefully
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { dispatch, getState, rejectWithValue }) => {
    try {
      const tokens = authService.getStoredTokens();
      if (!tokens) {
        return rejectWithValue('No stored tokens');
      }

      // Check if we're already authenticated
      const state = getState() as RootState;
      if (state.auth.isAuthenticated && state.auth.user) {
        console.log('✅ Already authenticated, skipping initialization');
        return { user: state.auth.user, tokens: state.auth.tokens };
      }

      // First check if tokens are valid locally
      if (!authService.areTokensValid()) {
        console.log('🔑 Tokens are invalid locally, attempting refresh...');
        try {
          const refreshResponse = await authService.refreshToken();
          if (refreshResponse.success && refreshResponse.data) {
            const refreshedTokens = refreshResponse.data;

            // Get profile with new tokens
            const profileResponse = await authService.getProfile();
            if (profileResponse.success && profileResponse.data) {
              console.log('✅ Token refreshed successfully');
              return { user: profileResponse.data, tokens: refreshedTokens };
            }
          }

          // Refresh failed, clear session
          console.log('🚫 Token refresh failed, clearing session');
          authService.clearSession();
          return rejectWithValue('Token expired and refresh failed');
        } catch (refreshError: any) {
          console.log('🚫 Token refresh failed:', refreshError.message);
          authService.clearSession();
          return rejectWithValue('Token expired and refresh failed');
        }
      }

      try {
        // Try to get user profile
        const profileResponse = await authService.getProfile();
        if (profileResponse.success && profileResponse.data) {
          console.log('✅ Session restored successfully');
          return { user: profileResponse.data, tokens };
        }

        throw new Error('Invalid profile response');
      } catch (profileError: any) {
        // Only attempt refresh for 401 errors (expired tokens)
        if (profileError.response?.status === 401 || profileError.message?.includes('401')) {
          console.log('🔄 Token expired, attempting refresh...');

          try {
            const refreshResponse = await authService.refreshToken();
            if (refreshResponse.success && refreshResponse.data) {
              const refreshedTokens = refreshResponse.data;

              // Get profile with new tokens
              const newProfileResponse = await authService.getProfile();
              if (newProfileResponse.success && newProfileResponse.data) {
                console.log('✅ Token refreshed successfully');
                return { user: newProfileResponse.data, tokens: refreshedTokens };
              }
            }

            // Refresh failed, clear session
            console.log('🚫 Token refresh failed, clearing session');
            authService.clearSession();
            return rejectWithValue('Token expired and refresh failed');
          } catch (refreshError: any) {
            console.log('🚫 Token refresh failed:', refreshError.message);
            authService.clearSession();
            return rejectWithValue('Token expired and refresh failed');
          }
        }

        // For network errors, keep user logged in but don't set authenticated state
        console.log('📡 Network error during auth check, keeping stored tokens');
        return rejectWithValue('Network error - keeping stored session');
      }
    } catch (error: any) {
      console.error('Auth initialization error:', error.message);
      return rejectWithValue(error.message || 'Auth initialization failed');
    }
  }
);

// Automatic session restoration for app resume/page reload
export const restoreSessionFromStorage = createAsyncThunk(
  'auth/restoreFromStorage',
  async (_, { rejectWithValue, getState }) => {
    const state = getState() as RootState;

    // Prevent multiple concurrent session restoration
    if ((state.auth.pendingActions || []).includes('restoreSession')) {
      console.log('📡 Session restoration already in progress, skipping...');
      return rejectWithValue('Session restoration already in progress');
    }

    try {
      const session = await authService.restoreSession();
      if (session) {
        return session;
      }
      return rejectWithValue('No valid session found');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Session restoration failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
    clearAuth: state => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      state.isInitializing = false;
      state.pendingActions = [];
      state.registrationFlow = {
        isActive: false,
        currentStep: null,
        formData: null,
        phoneNumber: undefined,
      };
    },
    addPendingAction: (state, action: PayloadAction<string>) => {
      if (!state.pendingActions) {
        state.pendingActions = [];
      }
      if (!state.pendingActions.includes(action.payload)) {
        state.pendingActions.push(action.payload);
      }
    },
    removePendingAction: (state, action: PayloadAction<string>) => {
      state.pendingActions = (state.pendingActions || []).filter(
        action_name => action_name !== action.payload
      );
    },
    // Registration flow management
    startRegistrationFlow: (
      state,
      action: PayloadAction<{
        step: 'register' | 'referral' | 'verification' | 'password';
        formData?: any;
        phoneNumber?: string;
      }>
    ) => {
      state.registrationFlow = {
        isActive: true,
        currentStep: action.payload.step,
        formData: action.payload.formData || state.registrationFlow.formData,
        phoneNumber: action.payload.phoneNumber || state.registrationFlow.phoneNumber,
      };
    },
    updateRegistrationFlow: (
      state,
      action: PayloadAction<{
        step?: 'register' | 'referral' | 'verification' | 'password';
        formData?: any;
        phoneNumber?: string;
      }>
    ) => {
      if (action.payload.step) {
        state.registrationFlow.currentStep = action.payload.step;
      }
      if (action.payload.formData) {
        state.registrationFlow.formData = action.payload.formData;
      }
      if (action.payload.phoneNumber) {
        state.registrationFlow.phoneNumber = action.payload.phoneNumber;
      }
    },
    clearRegistrationFlow: state => {
      state.registrationFlow = {
        isActive: false,
        currentStep: null,
        formData: null,
        phoneNumber: undefined,
      };
    },
  },
  extraReducers: builder => {
    // Login
    builder
      .addCase(loginUser.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.isAuthenticated = true;
        state.error = null;
        // Clear registration flow on successful authentication
        state.registrationFlow = {
          isActive: false,
          currentStep: null,
          formData: null,
          phoneNumber: undefined,
        };
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Register
    builder
      .addCase(registerUser.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.isAuthenticated = true;
        state.error = null;
        // Clear registration flow on successful registration completion
        state.registrationFlow = {
          isActive: false,
          currentStep: null,
          formData: null,
          phoneNumber: undefined,
        };
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Load stored auth
    builder
      .addCase(loadStoredAuth.pending, state => {
        state.isLoading = true;
      })
      .addCase(loadStoredAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loadStoredAuth.rejected, state => {
        state.isLoading = false;
        state.isAuthenticated = false;
      });

    // Update profile
    builder
      .addCase(updateUserProfile.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.user = action.payload;
        }
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Logout
    builder
      .addCase(logoutUser.pending, state => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, state => {
        state.user = null;
        state.tokens = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, state => {
        // Still logout locally even if API call fails
        state.user = null;
        state.tokens = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
      })
      // Session restoration
      .addCase(restoreSession.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        restoreSession.fulfilled,
        (state, action: PayloadAction<{ user: User; tokens: AuthTokens }>) => {
          state.user = action.payload.user;
          state.tokens = action.payload.tokens;
          state.isAuthenticated = true;
          state.isLoading = false;
          state.error = null;
        }
      )
      .addCase(restoreSession.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = null;
        state.error = action.payload as string;
      })
      // Initialize auth
      .addCase(initializeAuth.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isLoading = false;
        // Only clear auth if it's a token expiration error
        const errorMessage = action.payload as string;
        if (errorMessage.includes('Token expired') || errorMessage.includes('No stored tokens')) {
          state.isAuthenticated = false;
          state.user = null;
          state.tokens = null;
        }
        // For network errors, keep the stored state but don't set authenticated
        state.error = errorMessage;
      })
      // Restore session from storage
      .addCase(restoreSessionFromStorage.pending, state => {
        state.isLoading = true;
        state.error = null;
        if (!state.pendingActions) {
          state.pendingActions = [];
        }
        if (!state.pendingActions.includes('restoreSession')) {
          state.pendingActions.push('restoreSession');
        }
      })
      .addCase(restoreSessionFromStorage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.isAuthenticated = true;
        state.error = null;
        state.pendingActions = (state.pendingActions || []).filter(
          action_name => action_name !== 'restoreSession'
        );
      })
      .addCase(restoreSessionFromStorage.rejected, (state, action) => {
        state.isLoading = false;
        state.pendingActions = (state.pendingActions || []).filter(
          action_name => action_name !== 'restoreSession'
        );
        // Only clear auth if it's a definitive authentication failure
        const errorMessage = action.payload as string;
        if (errorMessage.includes('Token expired') || errorMessage.includes('No valid session')) {
          state.isAuthenticated = false;
          state.user = null;
          state.tokens = null;
        }
        // Don't set error for "already in progress" rejections
        if (!errorMessage.includes('already in progress')) {
          state.error = errorMessage;
        }
      });
  },
});

export const {
  clearError,
  clearAuth,
  addPendingAction,
  removePendingAction,
  startRegistrationFlow,
  updateRegistrationFlow,
  clearRegistrationFlow,
} = authSlice.actions;
export default authSlice.reducer;
