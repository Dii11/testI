/**
 * AuthFlowPersistence
 *
 * Selective persistence manager for incomplete authentication flows.
 *
 * PURPOSE:
 * Preserve form data during foreground/background transitions for better UX,
 * but clear incomplete flows when the app is fully terminated to prevent
 * users from being stuck on auth screens.
 *
 * BEHAVIOR:
 * - Background → Foreground (< 5 minutes): Restores form data ✅
 * - App termination: Clears all incomplete flows ✅
 * - After successful login/registration: Auto-clears ✅
 *
 * INSPIRED BY: Instagram, WhatsApp, Facebook auth flows
 *
 * @author HopMed Engineering Team
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_FLOW_STORAGE_KEY = '@hopmed_auth_flow_temp';
const AUTH_FLOW_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface AuthFlowData {
  step: 'register' | 'referral' | 'verification' | 'password';
  formData: any;
  phoneNumber?: string;
  timestamp: number;
}

class AuthFlowPersistence {
  private static instance: AuthFlowPersistence | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): AuthFlowPersistence {
    if (!AuthFlowPersistence.instance) {
      AuthFlowPersistence.instance = new AuthFlowPersistence();
    }
    return AuthFlowPersistence.instance;
  }

  /**
   * Save auth flow data temporarily
   * Used when user backgrounds the app during registration
   */
  async saveAuthFlow(data: Omit<AuthFlowData, 'timestamp'>): Promise<void> {
    try {
      const flowData: AuthFlowData = {
        ...data,
        timestamp: Date.now(),
      };

      await AsyncStorage.setItem(AUTH_FLOW_STORAGE_KEY, JSON.stringify(flowData));
      console.log(`💾 Auth flow saved: ${data.step}`);
    } catch (error) {
      console.error('❌ Failed to save auth flow:', error);
    }
  }

  /**
   * Restore auth flow data if it hasn't expired
   * Returns null if expired or not found
   */
  async restoreAuthFlow(): Promise<AuthFlowData | null> {
    try {
      const stored = await AsyncStorage.getItem(AUTH_FLOW_STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const flowData: AuthFlowData = JSON.parse(stored);
      const age = Date.now() - flowData.timestamp;

      // Check if data has expired
      if (age > AUTH_FLOW_EXPIRY_MS) {
        console.log(`⏰ Auth flow expired (${Math.round(age / 1000)}s old), clearing...`);
        await this.clearAuthFlow();
        return null;
      }

      console.log(`✅ Auth flow restored: ${flowData.step} (${Math.round(age / 1000)}s old)`);
      return flowData;
    } catch (error) {
      console.error('❌ Failed to restore auth flow:', error);
      return null;
    }
  }

  /**
   * Clear auth flow data
   * Called when:
   * 1. User completes registration
   * 2. User logs in
   * 3. App is terminated
   * 4. User navigates away from auth flow
   */
  async clearAuthFlow(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUTH_FLOW_STORAGE_KEY);
      console.log('🧹 Auth flow cleared');
    } catch (error) {
      console.error('❌ Failed to clear auth flow:', error);
    }
  }

  /**
   * Update only the form data without changing the step
   * Useful for debounced form field updates
   */
  async updateFormData(formData: any): Promise<void> {
    try {
      const current = await this.restoreAuthFlow();
      if (current) {
        await this.saveAuthFlow({
          step: current.step,
          formData,
          phoneNumber: current.phoneNumber,
        });
      }
    } catch (error) {
      console.error('❌ Failed to update form data:', error);
    }
  }

  /**
   * Check if there's a saved auth flow
   */
  async hasAuthFlow(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(AUTH_FLOW_STORAGE_KEY);
      return stored !== null;
    } catch (error) {
      return false;
    }
  }
}

export default AuthFlowPersistence;
