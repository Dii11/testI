import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useEffect, useRef, useCallback } from 'react';

import PermissionDialogStateManager from '../utils/PermissionDialogStateManager';

interface UsePermissionAwareNavigationOptions {
  screenName?: string;
  preserveDuringPermissions?: boolean;
  autoRestoreOnPermissionEnd?: boolean;
}

/**
 * Hook to manage navigation state during permission dialogs
 *
 * Prevents navigation issues when permission dialogs cause app state changes
 * that trigger unwanted navigation resets or screen changes.
 */
export const usePermissionAwareNavigation = (options: UsePermissionAwareNavigationOptions = {}) => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const permissionDialogManager = PermissionDialogStateManager.getInstance();

  const {
    screenName = 'UnknownScreen',
    preserveDuringPermissions = true,
    autoRestoreOnPermissionEnd = true,
  } = options;

  // Store navigation state before permission dialogs
  const navigationStateBeforePermission = useRef<any>(null);
  const isNavigationPreserved = useRef(false);
  const unsubscribePermissionListener = useRef<(() => void) | null>(null);

  const handlePermissionDialogStateChange = useCallback(
    (isDialogActive: boolean, dialogType: string | null) => {
      if (isDialogActive && preserveDuringPermissions) {
        // Store current navigation state
        navigationStateBeforePermission.current = navigation.getState();
        isNavigationPreserved.current = true;

        console.log(
          `🔒 Preserving navigation state for ${screenName} during ${dialogType} permission`
        );
      } else if (!isDialogActive && isNavigationPreserved.current && autoRestoreOnPermissionEnd) {
        // Permission dialog ended - optionally restore navigation state
        const currentState = navigation.getState();
        const previousState = navigationStateBeforePermission.current;

        // Check if navigation was disrupted during permission
        if (
          previousState &&
          currentState &&
          JSON.stringify(currentState) !== JSON.stringify(previousState)
        ) {
          console.log(`🔒 Navigation state changed during permission dialog for ${screenName}`);
          console.log('Previous:', previousState.routeNames?.[previousState.index]);
          console.log('Current:', currentState.routeNames[currentState.index]);

          // Could implement restoration logic here if needed
          // For now, just log the disruption
        }

        isNavigationPreserved.current = false;
        navigationStateBeforePermission.current = null;
      }
    },
    [navigation, screenName, preserveDuringPermissions, autoRestoreOnPermissionEnd]
  );

  useEffect(() => {
    if (preserveDuringPermissions) {
      unsubscribePermissionListener.current = permissionDialogManager.addListener(
        `navigation-${screenName}`,
        handlePermissionDialogStateChange
      );
    }

    return () => {
      if (unsubscribePermissionListener.current) {
        unsubscribePermissionListener.current();
      }
    };
  }, [screenName, preserveDuringPermissions, handlePermissionDialogStateChange]);

  // Enhanced navigation methods that respect permission dialog state
  const navigate = useCallback(
    (routeName: string, params?: any) => {
      if (permissionDialogManager.shouldPreserveNavigation()) {
        console.log(`🔒 Navigation blocked during permission dialog: ${routeName}`);
        return false;
      }

      navigation.navigate(routeName as never, params);
      return true;
    },
    [navigation]
  );

  const goBack = useCallback(() => {
    if (permissionDialogManager.shouldPreserveNavigation()) {
      console.log(`🔒 Back navigation blocked during permission dialog`);
      return false;
    }

    navigation.goBack();
    return true;
  }, [navigation]);

  const reset = useCallback(
    (state: any) => {
      if (permissionDialogManager.shouldPreserveNavigation()) {
        console.log(`🔒 Navigation reset blocked during permission dialog`);
        return false;
      }

      navigation.reset(state);
      return true;
    },
    [navigation]
  );

  const push = useCallback(
    (routeName: string, params?: any) => {
      if (permissionDialogManager.shouldPreserveNavigation()) {
        console.log(`🔒 Push navigation blocked during permission dialog: ${routeName}`);
        return false;
      }

      (navigation as any).push(routeName, params);
      return true;
    },
    [navigation]
  );

  const pop = useCallback(
    (count?: number) => {
      if (permissionDialogManager.shouldPreserveNavigation()) {
        console.log(`🔒 Pop navigation blocked during permission dialog`);
        return false;
      }

      (navigation as any).pop(count);
      return true;
    },
    [navigation]
  );

  // Utility methods
  const isPermissionDialogActive = useCallback(() => {
    return permissionDialogManager.isPermissionDialogActive();
  }, []);

  const shouldPreserveNavigation = useCallback(() => {
    return permissionDialogManager.shouldPreserveNavigation();
  }, []);

  const getCurrentDialogType = useCallback(() => {
    return permissionDialogManager.getCurrentDialogType();
  }, []);

  // Permission-aware navigation wrapper
  const withPermissionAwareness = useCallback((navigationFn: () => void) => {
    if (permissionDialogManager.shouldPreserveNavigation()) {
      console.log(`🔒 Navigation action blocked during permission dialog`);
      return false;
    }

    navigationFn();
    return true;
  }, []);

  return {
    // Enhanced navigation methods
    navigate,
    goBack,
    reset,
    push,
    pop,

    // Original navigation object for direct access when needed
    navigation,

    // State checking utilities
    isPermissionDialogActive,
    shouldPreserveNavigation,
    getCurrentDialogType,
    isNavigationPreserved: isNavigationPreserved.current,

    // Wrapper utility
    withPermissionAwareness,

    // Debug info
    getNavigationStateBeforePermission: () => navigationStateBeforePermission.current,
  };
};

export default usePermissionAwareNavigation;
