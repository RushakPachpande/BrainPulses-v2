import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { PageHeaderContext, usePageHeader } from '@/contexts/use-page-header';

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null);
  const setActions = useCallback((next: ReactNode) => {
    setActionsState(next);
  }, []);
  const value = useMemo(() => ({ actions, setActions }), [actions, setActions]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function PageHeaderActions({ children }: { children: ReactNode }) {
  const { setActions } = usePageHeader();

  useLayoutEffect(() => {
    setActions(children);
    return () => setActions(null);
  }, [children, setActions]);

  return null;
}
