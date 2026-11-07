import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AdminPasswordDialog({
  open,
  title,
  description,
  confirmLabel,
  error,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  error: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPassword('');
          setShow(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(password);
          }}
        >
          <Label htmlFor="admin-password">Password</Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="admin-password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => setShow((value) => !value)}>
              {show ? 'Hide' : 'Show'}
            </Button>
          </div>
          {error ? (
            <p className="mt-2 text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Checking…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
