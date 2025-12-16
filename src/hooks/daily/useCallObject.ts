// Align this hook with the actual DailyCallProvider used by the app so
// controls operate on the real call object created by CallInterface.
import { useCallObject as useDailyCtxCallObject } from '../../contexts/DailyCallContext';
import { officialDailyCallManager } from '../../services/OfficialDailyCallManager';

/**
 * Unified hook to access the Daily.co call object.
 * First tries the app's DailyCallProvider context; falls back to the
 * OfficialDailyCallManager if present.
 */
export function useCallObject() {
  const callFromProvider = useDailyCtxCallObject();
  return callFromProvider ?? officialDailyCallManager.getCallObject();
}
