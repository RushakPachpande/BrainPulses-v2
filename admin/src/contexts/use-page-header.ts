import { createContext, useContext, type ReactNode } from 'react';

type PageHeaderContextValue = {
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
};

export const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error('usePageHeader outside provider');
  return ctx;
}
