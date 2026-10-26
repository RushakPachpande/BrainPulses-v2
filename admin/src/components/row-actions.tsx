import { Link } from 'react-router';
import { BanIcon, EyeIcon, PencilIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type RowActionTarget = {
  to?: string;
  onClick?: () => void;
};

function ActionButton({
  label,
  icon: Icon,
  target,
  destructive,
}: {
  label: string;
  icon: typeof EyeIcon;
  target: RowActionTarget;
  destructive?: boolean;
}) {
  const variant = destructive ? 'destructive' : 'outline';
  if (target.to) {
    return (
      <Button asChild variant={variant}>
        <Link to={target.to} onClick={target.onClick}>
          <Icon data-icon="inline-start" />
          {label}
        </Link>
      </Button>
    );
  }
  return (
    <Button type="button" variant={variant} onClick={target.onClick}>
      <Icon data-icon="inline-start" />
      {label}
    </Button>
  );
}

export function RowActions({
  view,
  edit,
  deactivate,
}: {
  view?: RowActionTarget;
  edit?: RowActionTarget;
  deactivate?: { onClick: () => void };
}) {
  return (
    <div className="flex w-max shrink-0 flex-nowrap items-center gap-2">
      {view ? <ActionButton label="View" icon={EyeIcon} target={view} /> : null}
      {edit ? <ActionButton label="Edit" icon={PencilIcon} target={edit} /> : null}
      {deactivate ? (
        <ActionButton label="Deactivate" icon={BanIcon} target={deactivate} destructive />
      ) : null}
    </div>
  );
}

export type { RowActionTarget };
