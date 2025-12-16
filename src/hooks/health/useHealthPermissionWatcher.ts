import { useEffect, useRef } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectHealthPermissionSummary,
  selectMissingGrantedHealthTypes,
} from '../../store/selectors/healthSelectors';
import { initializeHealthService, requestHealthPermissions } from '../../store/slices/healthSlice';

/**
 * Monitors app foreground transitions to:
 * 1. Re-validate health service (covers edge cases where the provider was killed)
 * 2. Detect revoked permissions (user changed settings externally)
 * 3. Optionally re-prompt if everything was previously granted but now partial
 */
export function useHealthPermissionWatcher(options?: { autoReRequest?: boolean }) {
  const dispatch = useDispatch();
  const summary = useSelector(selectHealthPermissionSummary);
  const missing = useSelector(selectMissingGrantedHealthTypes);
  const lastStatusRef = useRef(summary);

  useEffect(() => {
    lastStatusRef.current = summary;
  }, [summary]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Re-check initialization / permissions silently
        dispatch<any>(initializeHealthService());

        // If previously allGranted but now missing appears, and autoReRequest enabled
        const prev = lastStatusRef.current;
        if (
          prev.allGranted &&
          !summary.allGranted &&
          options?.autoReRequest &&
          missing.length > 0
        ) {
          dispatch<any>(requestHealthPermissions(missing));
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [dispatch, summary, missing, options?.autoReRequest]);
}

export default useHealthPermissionWatcher;
