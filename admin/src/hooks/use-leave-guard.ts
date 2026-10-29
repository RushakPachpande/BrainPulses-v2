import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { useConfirm } from '@/components/use-confirm';

const LEAVE_MESSAGE = 'You have unsaved changes. Leave anyway?';

/**
 * Blocks in-app navigation and tab close while `when` is true.
 * Call the returned function immediately before a navigation that should
 * proceed, such as the redirect after a successful save.
 */
export function useLeaveGuard(when: boolean) {
  const whenRef = useRef(when);
  whenRef.current = when;
  const bypassRef = useRef(false);
  const confirm = useConfirm();
  const asked = useRef(false);

  const shouldBlock = useCallback(() => {
    if (bypassRef.current) return false;
    return whenRef.current;
  }, []);

  const blocker = useBlocker(shouldBlock);

  const allowLeave = useCallback(() => {
    bypassRef.current = true;
  }, []);

  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassRef.current) return;
      event.preventDefault();
      event.returnValue = LEAVE_MESSAGE;
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

  return allowLeave;
}
