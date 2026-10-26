import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { useConfirm } from '@/components/use-confirm';

const LEAVE_MESSAGE = 'You have a save in progress. Leave anyway?';

/**
 * Blocks in-app navigation (useBlocker) and tab close/refresh (beforeunload)
 * while `when` is true.
 */
export function useLeaveGuard(when: boolean) {
  const blocker = useBlocker(when);
  const confirm = useConfirm();
  const asked = useRef(false);

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
    if (blocker.state !== 'blocked') {
      asked.current = false;
      return;
    }
    if (asked.current) return;
    asked.current = true;
    void confirm({
      title: 'Leave this page?',
      description: LEAVE_MESSAGE,
      confirmLabel: 'Leave',
      destructive: true,
    }).then((ok) => {
      if (ok) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, confirm]);
}
