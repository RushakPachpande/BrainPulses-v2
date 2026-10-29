import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PasswordInput } from '@/components/password-input';
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from '@/components/use-confirm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const [shown, setShown] = useState<ConfirmOptions | null>(null);
  const [password, setPassword] = useState('');
  const resolver = useRef<((value: boolean | string) => void) | null>(null);
  const passwordFieldId = useId();

  const settle = useCallback((value: boolean | string) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    setPassword('');
    resolve?.(value);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => {
      if (resolver.current) settle(false);
      return new Promise<boolean | string>((resolve) => {
        resolver.current = resolve;
        setPassword('');
        setShown(options);
        setRequest(options);
      });
    },
    [settle],
  );

  useEffect(() => {
    if (!request?.requirePassword) return;
    const t = window.setTimeout(() => {
      document.getElementById(passwordFieldId)?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [request, passwordFieldId]);

  function submitConfirm() {
    if (!shown) return;
    if (shown.requirePassword) {
      const trimmed = password.trim();
      if (!trimmed) return;
      settle(trimmed);
      return;
    }
    settle(true);
  }

  const passwordRequired = Boolean(shown?.requirePassword);
  const confirmDisabled = passwordRequired && !password.trim();

  return (
    <ConfirmContext.Provider value={confirm as ConfirmFn}>
      {children}
      <Dialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shown?.title}</DialogTitle>
            <DialogDescription>{shown?.description}</DialogDescription>
          </DialogHeader>
          {passwordRequired ? (
            <form
              className="flex flex-col gap-2"
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                submitConfirm();
              }}
            >
              <input
                type="text"
                tabIndex={-1}
                aria-hidden="true"
                autoComplete="off"
                name="prevent-username-autofill"
                defaultValue=""
                className="pointer-events-none absolute h-0 w-0 opacity-0"
              />
              <Label htmlFor={passwordFieldId}>{shown?.passwordLabel ?? 'Your password'}</Label>
              <PasswordInput
                id={passwordFieldId}
                name="admin-confirm-reauth"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disableAutofill
                placeholder={shown?.passwordPlaceholder ?? 'Enter your password to confirm'}
              />
            </form>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => settle(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={shown?.destructive ? 'destructive' : 'default'}
              disabled={confirmDisabled}
              onClick={submitConfirm}
            >
              {shown?.confirmLabel ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
