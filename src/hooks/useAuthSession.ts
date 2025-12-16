import { useEffect, useRef, useCallback } from 'react';
import type { AppStateStatus } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { authService } from '../services/authService';
import AuthStateMachine from '../services/AuthStateMachine';
import StorageConsistencyManager from '../services/StorageConsistencyManager';
import type { AppDispatch, RootState } from '../store';
import { loadStoredAuth, clearRegistrationFlow } from '../store/slices/authSlice';
import AppStateManager from '../utils/AppStateManager';
import PermissionDialogStateManager from '../utils/PermissionDialogStateManager';

export const useAuthSession = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, registrationFlow } = useSelector((state: RootState) => state.auth);
  const isUnmountedRef = useRef(false);
  const sessionRestorePromiseRef = useRef<Promise<any> | null>(null);
  const lastStateRef = useRef(AppStateManager.getInstance().getCurrentState());
  const authStateMachine = useRef(AuthStateMachine.getInstance());
  const storageManager = useRef(StorageConsistencyManager.getInstance());
  // ✅ CRITICAL FIX: Timer to clear stale registration flow after 5 minutes in background
  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Enhanced session restoration with state machine and storage consistency
   */
  const performEnhancedSessionRestoration = useCallback(
    async (
      backgroundDuration: number,
      hasMemoryPressure: boolean,
      appStateManager: AppStateManager
    ): Promise<void> => {
      try {
        console.log('🔄 Starting enhanced session restoration...');

        // Step 1: Check if we can attempt memory recovery if needed
        if (hasMemoryPressure && appStateManager.canAttemptMemoryRecovery()) {
          console.log('🧠 Attempting memory pressure recovery...');
          const recoverySuccessful = await appStateManager.attemptMemoryPressureRecovery();

          if (!recoverySuccessful) {
            console.log('🚫 Memory recovery failed, aborting session restoration');
            await authStateMachine.current.memoryPressure();
            return;
          }
          console.log('✅ Memory pressure recovery successful');
        }

        // Step 2: Use storage consistency manager to get reliable tokens
        const tokens = await storageManager.current.retrieveTokens();

        if (!tokens) {
          console.log('🔑 No tokens found in storage, logging out');
          await authStateMachine.current.logout();
          return;
        }

        // Step 3: Validate token expiration locally before making network calls
        const areTokensValid = authService.areTokensValid();

        if (!areTokensValid) {
          console.log('🔑 Tokens are expired, attempting refresh through state machine');
          await authStateMachine.current.refreshToken(tokens);
          return;
        }

        // Step 4: Add timeout based on background duration
        const timeout = backgroundDuration > 60000 ? 15000 : 10000;
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session restoration timeout')), timeout);
        });

        // Step 5: Attempt session restoration with network call
        const restorePromise = dispatch(loadStoredAuth());

        await Promise.race([restorePromise.unwrap(), timeoutPromise]);

        console.log('✅ Enhanced session restoration completed successfully');
      } catch (error: any) {
        if (!isUnmountedRef.current) {
          console.warn('Session restoration failed:', error.message);

          // Use state machine to handle different types of failures
          if (error.message?.includes('Network') || error.message?.includes('timeout')) {
            await authStateMachine.current.networkError(error.message);
          } else if (error.message?.includes('Token expired')) {
            await authStateMachine.current.tokenExpired(error.message);
          } else {
            await authStateMachine.current.storageError(error.message);
          }
        }
      } finally {
        sessionRestorePromiseRef.current = null;
      }
    },
    [dispatch, isUnmountedRef, authStateMachine, storageManager]
  );

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      // Skip if component is unmounted
      if (isUnmountedRef.current) {
        console.log('📱 Auth session state change ignored - component unmounted');
        return;
      }

      const previousState = lastStateRef.current;
      lastStateRef.current = nextAppState;

      // ✅ CRITICAL FIX: Check if permission dialog is active
      const permissionDialogManager = PermissionDialogStateManager.getInstance();
      if (permissionDialogManager.shouldIgnoreAppStateChange(nextAppState)) {
        console.log('📱 Auth session state change ignored - permission dialog active');
        return;
      }

      // ✅ CRITICAL FIX: Handle app going to background
      if (nextAppState.match(/inactive|background/)) {
        // Start timer to clear registration flow after 5 minutes in background
        if (registrationFlow.isActive && !backgroundTimerRef.current) {
          console.log(
            '⏱️ App went to background with active registration flow - starting 5min cleanup timer'
          );
          backgroundTimerRef.current = setTimeout(() => {
            if (registrationFlow.isActive && !isUnmountedRef.current) {
              console.log('🧹 Clearing stale registration flow after 5 minutes in background');
              dispatch(clearRegistrationFlow());
              backgroundTimerRef.current = null;
            }
          }, 5 * 60 * 1000); // 5 minutes
        }
      }

      // When app comes to foreground from background
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        // ✅ CRITICAL FIX: Clear background timer if app came back to foreground
        if (backgroundTimerRef.current) {
          console.log('✅ App returned to foreground - cancelling registration flow cleanup timer');
          clearTimeout(backgroundTimerRef.current);
          backgroundTimerRef.current = null;
        }
        const appStateManager = AppStateManager.getInstance();
        const hasStoredTokens = !!authService.getStoredTokens();

        // Additional validation: check if tokens are actually valid
        const tokensValid = hasStoredTokens ? authService.areTokensValid() : false;

        // Check for memory pressure indicators
        const hasMemoryPressure = appStateManager.hasMemoryPressureIndicators();
        const backgroundDuration = appStateManager.getBackgroundDuration();

        console.log(`🔍 Session restoration check:`, {
          isAuthenticated,
          hasStoredTokens,
          tokensValid,
          sessionInProgress: !!sessionRestorePromiseRef.current,
          backgroundDuration: Math.round(backgroundDuration / 1000) + 's',
          hasMemoryPressure,
          permissionDialogActive: permissionDialogManager.isPermissionDialogActive(),
        });

        // Only attempt session restoration if:
        // 1. User was authenticated AND has valid tokens, OR
        // 2. User has stored tokens that appear valid
        // 3. AND we don't have memory pressure indicators
        // 4. AND no permission dialogs are active
        const shouldRestoreSession =
          !isAuthenticated &&
          hasStoredTokens &&
          tokensValid &&
          !hasMemoryPressure &&
          !permissionDialogManager.isPermissionDialogActive();

        if (!shouldRestoreSession) {
          const reason = hasMemoryPressure
            ? 'memory pressure detected'
            : permissionDialogManager.isPermissionDialogActive()
              ? 'permission dialog active'
              : 'insufficient authentication state';
          console.log(`🚫 Skipping session restoration - ${reason}`);
          return;
        }

        console.log('🔄 App came to foreground, checking session...');

        // Use state machine to prevent race conditions
        if (authStateMachine.current.isOperationInProgress()) {
          console.log('📡 Auth operation already in progress, skipping...');
          return;
        }

        // Prevent multiple concurrent session restoration calls
        if (sessionRestorePromiseRef.current) {
          console.log('📡 Session restoration already in progress, skipping...');
          return;
        }

        // Enhanced session restoration with state machine
        sessionRestorePromiseRef.current = performEnhancedSessionRestoration(
          backgroundDuration,
          hasMemoryPressure,
          appStateManager
        );
      }
    },
    [dispatch, isAuthenticated, registrationFlow]
  );

  useEffect(() => {
    isUnmountedRef.current = false;

    const appStateManager = AppStateManager.getInstance();
    const unsubscribe = appStateManager.addListener('useAuthSession', handleAppStateChange, 1);

    // Set up state machine event listeners
    const handleStateChange = (stateChangeEvent: any) => {
      console.log(
        `🔄 Auth state changed: ${stateChangeEvent.from} -> ${stateChangeEvent.to} (${stateChangeEvent.event})`
      );

      // Handle memory recovery attempts
      if (stateChangeEvent.to === 'offline' && stateChangeEvent.event === 'MEMORY_PRESSURE') {
        console.log('🧠 Memory pressure detected by state machine');
      }
    };

    const handleMemoryRecoveryAttempt = (recoveryEvent: any) => {
      console.log(
        `🔄 Memory recovery attempt ${recoveryEvent.attempt}/${recoveryEvent.maxAttempts}`
      );
    };

    authStateMachine.current.on('stateChange', handleStateChange);
    authStateMachine.current.on('memoryRecoveryAttempt', handleMemoryRecoveryAttempt);

    return () => {
      isUnmountedRef.current = true;
      unsubscribe();

      // Remove state machine listeners
      authStateMachine.current.off('stateChange', handleStateChange);
      authStateMachine.current.off('memoryRecoveryAttempt', handleMemoryRecoveryAttempt);

      // Cancel any pending session restoration
      if (sessionRestorePromiseRef.current) {
        console.log('🧹 Cancelling pending session restoration due to unmount');
        sessionRestorePromiseRef.current = null;
      }

      // ✅ CRITICAL FIX: Clear background timer on unmount
      if (backgroundTimerRef.current) {
        console.log('🧹 Clearing registration flow background timer due to unmount');
        clearTimeout(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
    };
  }, [handleAppStateChange]);

  return null;
};
