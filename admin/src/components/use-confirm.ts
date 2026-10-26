import { createContext, useContext } from 'react';

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used within ConfirmProvider.');
  }
  return confirm;
}
