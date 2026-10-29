import { createContext, useContext } from 'react';

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** When true, the dialog collects the admin password and resolves to that string. */
  requirePassword?: boolean;
  passwordLabel?: string;
  passwordPlaceholder?: string;
};

type ConfirmFnOverload = {
  (options: ConfirmOptions & { requirePassword: true }): Promise<string | false>;
  (options: ConfirmOptions & { requirePassword?: false }): Promise<boolean>;
  (options: ConfirmOptions): Promise<boolean | string>;
};

export type ConfirmFn = ConfirmFnOverload;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used within ConfirmProvider.');
  }
  return confirm;
}
