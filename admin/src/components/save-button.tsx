import type { ComponentProps } from 'react';
import { Loader2Icon, SaveIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SaveButton({
  pending,
  children,
  pendingLabel = 'Saving…',
  disabled,
  type = 'submit',
  ...props
}: ComponentProps<typeof Button> & {
  pending: boolean;
  pendingLabel?: string;
}) {
  return (
    <Button type={type} disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <Loader2Icon data-icon="inline-start" className="animate-spin" />
      ) : (
        <SaveIcon data-icon="inline-start" />
      )}
      {pending ? pendingLabel : children}
    </Button>
  );
}
