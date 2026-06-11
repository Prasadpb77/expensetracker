import { useRef, useCallback } from 'react';
import { useAppStore } from '@/contexts/store';
import type { ToastMessage } from '@/types';

/**
 * Returns a toast function with a STABLE reference that never causes
 * useCallback/useEffect to re-run when addToast re-renders.
 */
export function useStableToast() {
  const addToast = useAppStore(s => s.addToast);
  const ref = useRef(addToast);
  ref.current = addToast;
  return useCallback((toast: Omit<ToastMessage, 'id'>) => {
    ref.current(toast);
  }, []); // empty deps = stable forever
}
