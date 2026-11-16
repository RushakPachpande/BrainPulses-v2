import { Link } from 'react-router';
import {
  BanIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  EyeIcon,
  KeyRoundIcon,
  PencilIcon,
  TrashIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type RowActionTarget = {
  to?: string;
  onClick?: () => void;
};

function ActionButton({
  label,
  icon: Icon,
  target,
  destructive,
  iconsOnly,
}: {
  label: string;
  icon: typeof EyeIcon;
  target: RowActionTarget;
  destructive?: boolean;
  iconsOnly?: boolean;
}) {
  const variant = destructive ? 'destructive' : 'outline';
  const button = target.to ? (
    <Button asChild variant={variant} size={iconsOnly ? 'icon' : 'default'} aria-label={label}>
      <Link to={target.to} onClick={target.onClick}>
        <Icon data-icon={iconsOnly ? undefined : 'inline-start'} aria-hidden="true" />
        {iconsOnly ? null : label}
      </Link>
    </Button>
  ) : (
    <Button
      type="button"
      variant={variant}
      size={iconsOnly ? 'icon' : 'default'}
      aria-label={iconsOnly ? label : undefined}
      onClick={target.onClick}
    >
      <Icon data-icon={iconsOnly ? undefined : 'inline-start'} aria-hidden="true" />
      {iconsOnly ? null : label}
    </Button>
  );
  if (!iconsOnly) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function RowActions({
  view,
  edit,
  report,
  resetPassword,
  activate,
  deactivate,
  removeRegistration,
  remove,
  iconsOnly = false,
}: {
  view?: RowActionTarget;
  edit?: RowActionTarget;
  report?: { to: string };
  resetPassword?: { onClick: () => void };
  activate?: { onClick: () => void };
  deactivate?: { onClick: () => void };
  removeRegistration?: { onClick: () => void };
  remove?: { label?: string; onClick: () => void };
  /** Desktop tables: icon and tooltip. Mobile cards keep the text label. */
  iconsOnly?: boolean;
}) {
  return (
    <div className="flex w-max shrink-0 flex-nowrap items-center gap-2">
      {view ? (
        <ActionButton label="View" icon={EyeIcon} target={view} iconsOnly={iconsOnly} />
      ) : null}
      {edit ? (
        <ActionButton label="Edit" icon={PencilIcon} target={edit} iconsOnly={iconsOnly} />
      ) : null}
      {report ? (
        <ActionButton
          label="View report"
          icon={BarChart3Icon}
          target={report}
          iconsOnly={iconsOnly}
        />
      ) : null}
      {resetPassword ? (
        <ActionButton
          label="Reset password"
          icon={KeyRoundIcon}
          target={{ onClick: resetPassword.onClick }}
          iconsOnly={iconsOnly}
        />
      ) : null}
      {activate ? (
        <ActionButton
          label="Activate"
          icon={CheckCircle2Icon}
          target={activate}
          iconsOnly={iconsOnly}
        />
      ) : null}
      {deactivate ? (
        <ActionButton
          label="Deactivate"
          icon={BanIcon}
          target={deactivate}
          destructive
          iconsOnly={iconsOnly}
        />
      ) : null}
      {removeRegistration ? (
        <ActionButton
          label="Delete registration"
          icon={TrashIcon}
          target={removeRegistration}
          destructive
          iconsOnly={iconsOnly}
        />
      ) : null}
      {remove ? (
        <ActionButton
          label={remove.label ?? 'Delete'}
          icon={TrashIcon}
          target={remove}
          destructive
          iconsOnly={iconsOnly}
        />
      ) : null}
    </div>
  );
}

export type { RowActionTarget };
