import { createContext, useContext } from 'react';

export type ConfirmOptions = {
  title: string;
  description: string;
  /** Concrete records the action will remove or detach. Shown as a list under the description. */
  details?: string[];
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

/** Warning first, then the password, then the caller performs the delete. */
export async function confirmSensitiveDelete(
  confirm: ConfirmFn,
  options: {
    title: string;
    description: string;
    details?: string[];
    confirmLabel: string;
  },
): Promise<string | false> {
  const accepted = await confirm({
    title: options.title,
    description: options.description,
    details: options.details,
    confirmLabel: 'Continue',
    destructive: true,
  });
  if (accepted !== true) return false;
  const password = await confirm({
    title: 'Enter your password',
    description: 'This delete is permanent. Enter your password to continue.',
    confirmLabel: options.confirmLabel,
    destructive: true,
    requirePassword: true,
  });
  return typeof password === 'string' ? password : false;
}
