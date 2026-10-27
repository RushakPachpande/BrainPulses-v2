import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const sizeClass = {
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-xl',
  xl: 'sm:max-w-2xl',
} as const;

export function FormDialog({
  open = true,
  onOpenChange,
  title,
  description,
  icon: Icon,
  children,
  footer,
  contentClassName,
  size = 'md',
  busy = false,
}: {
  open?: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer: ReactNode;
  contentClassName?: string;
  size?: keyof typeof sizeClass;
  busy?: boolean;
}) {
  function guardDismiss(event: { preventDefault: () => void; target: EventTarget | null }) {
    if (busy) {
      event.preventDefault();
      return;
    }
    const target = event.target;
    // Nested portals (image library) sit outside this content tree — keep the parent open.
    if (target instanceof Element && target.closest('[data-slot="dialog-content"]')) {
      event.preventDefault();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          'flex max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0',
          sizeClass[size],
          contentClassName,
        )}
        onPointerDownOutside={guardDismiss}
        onInteractOutside={guardDismiss}
        onFocusOutside={guardDismiss}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border px-3.5 pt-3 pb-2.5 sm:px-4 sm:pt-3.5 sm:pb-3">
          <div className="flex items-start gap-2.5 pr-8">
            {Icon ? (
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="mt-0.5">{description}</DialogDescription>
              ) : null}
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-3 sm:px-4 sm:py-3.5">
          {children}
        </div>
        <DialogFooter className="shrink-0 border-t border-border bg-popover px-3.5 py-2.5 sm:px-4 sm:py-3">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
