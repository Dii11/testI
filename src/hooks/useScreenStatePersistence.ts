/**
 * useScreenStatePersistence Hook
 *
 * Provides screen-level state persistence across app background/foreground transitions.
 * This hook helps preserve user input, scroll positions, and other transient state
 * that should survive brief app backgrounds.
 *
 * Use cases:
 * - Form inputs that users are actively filling out
 * - Scroll positions in long lists
 * - Search queries and filters
 * - Video call UI state (camera/mic toggles)
 * - Any temporary UI state that should survive backgrounding
 *
 * Usage:
 * ```tsx
 * const [formData, setFormData] = useScreenStatePersistence('MyScreen', {
 *   name: '',
 *   email: '',
 * });
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useRef, useCallback } from 'react';
import type { AppStateStatus } from 'react-native';

import AppStateManager from '../utils/AppStateManager';

interface PersistedState<T> {
  data: T;
  savedAt: number;
  screenKey: string;
}

interface ScreenStatePersistenceConfig {
  /** Maximum age of persisted state in milliseconds (default: 1 hour) */
  maxAge?: number;
  /** Whether to persist on every state change (default: false) */
  persistOnChange?: boolean;
  /** Whether to clear state when screen unmounts (default: false) */
  clearOnUnmount?: boolean;
  /** Custom storage key prefix (default: '@screen_state') */
  storageKeyPrefix?: string;
}

/**
 * Hook for persisting screen-specific state across app lifecycle
 */
export function useScreenStatePersistence<T>(
  screenKey: string,
  initialState: T,
  config: ScreenStatePersistenceConfig = {}
): [T, (newState: T | ((prev: T) => T)) => void, () => Promise<void>] {
  const {
    maxAge = 60 * 60 * 1000, // 1 hour default
    persistOnChange = false,
    clearOnUnmount = false,
    storageKeyPrefix = '@screen_state',
  } = config;

  const [state, setState] = useState<T>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const isUnmountedRef = useRef(false);
  const storageKey = `${storageKeyPrefix}_${screenKey}`;

  // Load persisted state on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed: PersistedState<T> = JSON.parse(stored);

          // Check if state is not too old
          const age = Date.now() - parsed.savedAt;
          if (age < maxAge) {
            setState(parsed.data);
            console.log(`🔄 [${screenKey}] State loaded (${Math.round(age / 1000)}s old)`);
          } else {
            console.log(`⏰ [${screenKey}] State expired, using initial state`);
            await AsyncStorage.removeItem(storageKey);
          }
        }
      } catch (error) {
        console.error(`❌ [${screenKey}] Failed to load state:`, error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadState();
  }, [screenKey, storageKey, maxAge]);

  // Save state to storage
  const saveState = useCallback(async () => {
    if (isUnmountedRef.current) return;

    try {
      const toStore: PersistedState<T> = {
        data: state,
        savedAt: Date.now(),
        screenKey,
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify(toStore));
      console.log(`💾 [${screenKey}] State persisted`);
    } catch (error) {
      console.error(`❌ [${screenKey}] Failed to save state:`, error);
    }
  }, [state, screenKey, storageKey]);

  // Persist on app background if enabled
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        console.log(`📱 [${screenKey}] App backgrounding, saving state...`);
        saveState();
      }
    };

    const unsubscribe = AppStateManager.getInstance().addListener(
      `ScreenState_${screenKey}`,
      handleAppStateChange,
      40 // Medium-low priority
    );

    return unsubscribe;
  }, [screenKey, saveState]);

  // Persist on state change if configured
  useEffect(() => {
    if (persistOnChange && isLoaded) {
      const timeoutId = setTimeout(() => {
        saveState();
      }, 500); // Debounce saves

      return () => clearTimeout(timeoutId);
    }
  }, [state, persistOnChange, isLoaded, saveState]);

  // Clear on unmount if configured
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;

      if (clearOnUnmount) {
        AsyncStorage.removeItem(storageKey)
          .then(() => console.log(`🗑️ [${screenKey}] State cleared on unmount`))
          .catch((error) => console.error(`❌ [${screenKey}] Failed to clear state:`, error));
      }
    };
  }, [clearOnUnmount, screenKey, storageKey]);

  return [state, setState, saveState];
}

/**
 * Simplified hook for basic screen state persistence
 * Persists on background only, with 1 hour max age
 */
export function useScreenState<T>(
  screenKey: string,
  initialState: T
): [T, (newState: T | ((prev: T) => T)) => void] {
  const [state, setState] = useScreenStatePersistence(screenKey, initialState);
  return [state, setState];
}

/**
 * Hook for form state persistence with auto-save
 * Persists on every change (debounced) and on background
 */
export function useFormStatePersistence<T extends Record<string, any>>(
  formKey: string,
  initialFormState: T
): [T, (newState: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState, saveState] = useScreenStatePersistence(formKey, initialFormState, {
    persistOnChange: true,
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  // Clear form state
  const clearForm = useCallback(() => {
    setState(initialFormState);
    AsyncStorage.removeItem(`@screen_state_${formKey}`);
  }, [formKey, initialFormState, setState]);

  return [state, setState, clearForm];
}
