import { Link } from 'react-router';
import {
  BanIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  EyeIcon,
  FileXIcon,
  KeyRoundIcon,
  PencilIcon,
  TrashIcon,
  UserXIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type RowActionTarget = {
  to?: string;
  onClick?: () => void;
};

type ActionTone = 'default' | 'destructive' | 'destructiveOutline';

function ActionButton({
  label,
  icon: Icon,
  target,
  tone = 'default',
  iconsOnly,
}: {
  label: string;
  icon: typeof EyeIcon;
  target: RowActionTarget;
  tone?: ActionTone;
  iconsOnly?: boolean;
}) {
  const variant = tone === 'destructive' ? 'destructive' : 'outline';
  const toneClass =
    tone === 'destructiveOutline'
      ? 'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/50 dark:hover:bg-destructive/20'
      : undefined;
  const widthClass = iconsOnly ? undefined : 'w-full sm:w-auto';
  const button = target.to ? (
    <Button
      asChild
      variant={variant}
      size={iconsOnly ? 'icon' : 'default'}
      className={cn(widthClass, toneClass)}
      aria-label={label}
    >
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
      className={cn(widthClass, toneClass)}
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
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
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
  /** Narrow panels: icon + tooltip. Wide tables keep the text label. */
  iconsOnly?: boolean;
}) {
  const removeLabel = remove?.label ?? 'Delete';
  const removeIsAttempt = removeLabel === 'Delete attempt';

  return (
    <div
      data-icons-only={iconsOnly ? '' : undefined}
      className={cn(
        'flex items-center gap-2',
        iconsOnly
          ? 'w-full min-w-0 flex-wrap'
          : 'w-full min-w-0 flex-col sm:w-auto sm:flex-row sm:flex-wrap',
      )}
    >
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
          tone="destructive"
          iconsOnly={iconsOnly}
        />
      ) : null}
      {removeRegistration ? (
        <ActionButton
          label="Delete registration"
          icon={UserXIcon}
          target={removeRegistration}
          tone="destructive"
          iconsOnly={iconsOnly}
        />
      ) : null}
      {remove ? (
        <ActionButton
          label={removeLabel}
          icon={removeIsAttempt ? FileXIcon : TrashIcon}
          target={remove}
          tone={removeIsAttempt ? 'destructiveOutline' : 'destructive'}
          iconsOnly={iconsOnly}
        />
      ) : null}
    </div>
  );
}

export type { RowActionTarget };
