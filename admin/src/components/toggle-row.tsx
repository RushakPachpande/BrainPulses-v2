import { useId, useState } from 'react';
import { Switch } from '@/components/ui/switch';

/**
 * A label, an optional hint, and a switch.
 * Pass `checked` and `onCheckedChange` to control it; otherwise it keeps its own state.
 */
export function ToggleRow({
  label,
  hint,
  defaultOn = false,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  defaultOn?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const [own, setOwn] = useState(defaultOn);
  const hintId = useId();
  const on = checked ?? own;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {hint ? (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
      <Switch
        checked={on}
        disabled={disabled}
        onCheckedChange={(next) => {
          if (checked === undefined) setOwn(next);
          onCheckedChange?.(next);
        }}
        aria-label={label}
        aria-describedby={hint ? hintId : undefined}
      />
    </div>
  );
}
