import { useState } from 'react';
import { Switch } from '@/components/ui/switch';

export function ToggleRow({
  label,
  hint,
  defaultOn,
}: {
  label: string;
  hint?: string;
  defaultOn: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={on} onCheckedChange={setOn} aria-label={label} />
    </div>
  );
}
