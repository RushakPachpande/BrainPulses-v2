import { useEffect } from 'react';
import { useBlocker } from 'react-router';

const LEAVE_MESSAGE = 'You have a save in progress. Leave anyway?';

/**
 * Blocks in-app navigation (useBlocker) and tab close/refresh (beforeunload)
 * while `when` is true.
 */
export function useLeaveGuard(when: boolean) {
  const blocker = useBlocker(when);

  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = LEAVE_MESSAGE;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const ok = window.confirm(LEAVE_MESSAGE);
    if (ok) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
}
