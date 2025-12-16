import type { User, AuthTokens, LoginRequest, RegisterRequest, ApiResponse } from '../types';
import VideoCallDebugger from '../utils/VideoCallDebugger';

import { apiService } from './api';
import DailyCallManager from './DailyCallManager';

class AuthService {
  // Authentication
  async login(credentials: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await apiService.post<{ user: User; tokens: AuthTokens }>(
      '/auth/login',
      credentials
    );

    // Store tokens
    apiService.setTokens(response.data!.tokens);

    return response.data!;
  }

  async register(
    userData: RegisterRequest
  ): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await apiService.post<{ user: User; tokens: AuthTokens }>(
      '/auth/register',
      userData
    );

    if (response.success && response.data) {
      // Store tokens
      apiService.setTokens(response.data.tokens);
    }

    return response;
  }

  // Multi-step registration methods
  async registerStepOne(userData: {
    email: string;
    firstName: string;
    lastName: string;
    accountType: 'customer' | 'health_specialist';
    phoneNumber: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other';
    address?: string;
    countryCode?: string;
    currency?: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return await apiService.post<{ success: boolean; message: string }>(
      '/auth/register/step-one',
      userData
    );
  }

  async registerStepTwo(data: {
    phoneNumber: string;
    referralCode?: string;
  }): Promise<ApiResponse<{ success: boolean; message: string; referralValid?: boolean }>> {
    return await apiService.post<{ success: boolean; message: string; referralValid?: boolean }>(
      '/auth/register/step-two',
      data
    );
  }

  async verifyPhone(data: {
    phoneNumber: string;
    code: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return await apiService.post<{ success: boolean; message: string }>('/auth/verify-phone', data);
  }

  async resendVerificationCode(
    phoneNumber: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return await apiService.post<{ success: boolean; message: string }>(
      '/auth/resend-verification',
      { phoneNumber }
    );
  }

  async completeRegistration(data: {
    phoneNumber: string;
    password: string;
  }): Promise<ApiResponse<{ user: User; profile: any }>> {
    return await apiService.post<{ user: User; profile: any }>('/auth/register/complete', data);
  }

  async logout(): Promise<ApiResponse<void>> {
    try {
      // Clean up any active Daily.co calls before logging out
      await DailyCallManager.forceCleanup();
      console.log('🧹 AuthService: Cleaned up Daily.co instances before logout');

      // Clear video call debugger sessions
      VideoCallDebugger.clearSessions();
      console.log('🧹 AuthService: Cleared video call debugger sessions');

      const response = await apiService.post<void>('/auth/logout');
      return response;
    } finally {
      // Always clear tokens, even if API call fails
      apiService.clearTokens();
    }
  }

  async refreshToken(): Promise<ApiResponse<AuthTokens>> {
    const currentTokens = apiService.getTokens();
    if (!currentTokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      // Use shared refresh to avoid parallel refresh calls across app
      const refreshed = await apiService.refreshTokenShared();

      // Handle both wrapped and direct response formats
      const tokens: AuthTokens = refreshed as AuthTokens;

      // Store new tokens
      if (tokens.accessToken && tokens.refreshToken) {
        apiService.setTokens(tokens);
        return {
          success: true,
          data: tokens,
        };
      }

      throw new Error('Invalid token response format');
    } catch (error: any) {
      // Clear tokens on refresh failure
      apiService.clearTokens();
      throw error;
    }
  }

  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    return await apiService.post<void>('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    return await apiService.post<void>('/auth/reset-password', {
      token,
      new_password: newPassword,
    });
  }

  // Profile Management
  async getProfile(): Promise<ApiResponse<User>> {
    return await apiService.get<User>('/users/me/profile');
  }

  // Session restoration - get current user with tokens
  async getCurrentUser(): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const tokens = apiService.getTokens();
    if (!tokens) {
      throw new Error('No tokens found');
    }

    const profileResponse = await this.getProfile();
    if (!profileResponse.success || !profileResponse.data) {
      throw new Error('Failed to get user profile');
    }

    return {
      success: true,
      data: {
        user: profileResponse.data,
        tokens,
      },
    };
  }

  // Automatic session restoration for app resume/page reload
  async restoreSession(): Promise<{ user: User; tokens: AuthTokens } | null> {
    try {
      const tokens = this.getStoredTokens();
      if (!tokens) {
        console.log('🔑 No stored tokens found');
        return null;
      }

      // Check if tokens are valid locally first
      if (!this.areTokensValid()) {
        console.log('🔑 Tokens are invalid, attempting refresh...');
        try {
          const refreshResponse = await this.refreshToken();
          if (refreshResponse.success && refreshResponse.data) {
            const refreshedTokens = refreshResponse.data;

            // Get profile with new tokens
            const profileResponse = await this.getProfile();
            if (profileResponse.success && profileResponse.data) {
              console.log('✅ Session restored with refreshed tokens');
              return { user: profileResponse.data, tokens: refreshedTokens };
            }
          }

          // Refresh failed
          console.log('🚫 Token refresh failed');
          this.clearSession();
          return null;
        } catch (refreshError: any) {
          console.log('🚫 Token refresh failed:', refreshError.message);
          this.clearSession();
          return null;
        }
      }

      // Tokens are valid, get user profile
      const profileResponse = await this.getProfile();
      if (profileResponse.success && profileResponse.data) {
        console.log('✅ Session restored successfully');
        return { user: profileResponse.data, tokens };
      }

      console.log('📡 Failed to get user profile');
      return null;
    } catch (error: any) {
      console.error('Session restoration error:', error.message);
      return null;
    }
  }

  // Debug method to check authentication status
  debugAuthStatus(): void {
    const tokens = this.getStoredTokens();
    const isValid = this.areTokensValid();
    const hasValidTokens = this.hasValidTokens();

    console.log('🔍 Auth Debug Info:');
    console.log('  - Has stored tokens:', !!tokens);
    console.log('  - Tokens are valid:', isValid);
    console.log('  - Has valid tokens for auth:', hasValidTokens);

    if (tokens) {
      console.log('  - Access token exists:', !!tokens.accessToken);
      console.log('  - Refresh token exists:', !!tokens.refreshToken);
    }
  }

  async updateProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    return await apiService.put<User>('/users/me/profile', userData);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return await apiService.put<void>('/users/me/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  async changeEmail(newEmail: string, password: string): Promise<ApiResponse<void>> {
    return await apiService.put<void>('/users/me/change-email', {
      new_email: newEmail,
      password,
    });
  }

  async uploadProfilePicture(
    imageUri: string
  ): Promise<ApiResponse<{ profile_picture_url: string }>> {
    const formData = new FormData();
    formData.append('profile_picture', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'profile_picture.jpg',
    } as any);

    return await apiService.upload<{ profile_picture_url: string }>(
      '/users/me/profile-picture',
      formData
    );
  }

  async deleteAccount(password: string): Promise<ApiResponse<void>> {
    return await apiService.delete<void>(
      `/users/me/account?password=${encodeURIComponent(password)}`
    );
  }

  // Token utilities
  isAuthenticated(): boolean {
    const tokens = apiService.getTokens();
    return !!tokens?.accessToken;
  }

  // Check if stored tokens are valid without making network requests
  areTokensValid(): boolean {
    return apiService.areTokensValid();
  }

  // Check if we have valid tokens for authentication
  hasValidTokens(): boolean {
    return apiService.hasValidTokens();
  }

  getStoredTokens(): AuthTokens | null {
    return apiService.getTokens();
  }

  clearSession(): void {
    apiService.clearTokens();
  }

  // Email verification
  async resendVerificationEmail(): Promise<ApiResponse<void>> {
    return await apiService.post<void>('/auth/resend-verification');
  }

  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    return await apiService.post<void>('/auth/verify-email', { token });
  }
}

export const authService = new AuthService();
export default authService;
