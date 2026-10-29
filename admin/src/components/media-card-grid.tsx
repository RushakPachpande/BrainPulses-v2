import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRightIcon,
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
  TrophyIcon,
} from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function MediaCardGrid<Item>({
  label,
  items,
  getKey,
  renderItem,
  empty,
}: {
  label: string;
  items: Item[];
  getKey: (item: Item) => string;
  renderItem: (item: Item) => ReactNode;
  empty: ReactNode;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul role="list" aria-label={label} className="media-catalog-grid">
      {items.map((item) => (
        <li key={getKey(item)} className="flex min-w-0">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

export function MediaCard({
  to,
  onView,
  title,
  imageFileId,
  kind,
  badge,
  organizer,
  description,
  meta,
  footerLabel,
  editTo,
  onEdit,
  onDelete,
}: {
  to?: string;
  onView?: () => void;
  title: string;
  imageFileId: string;
  kind: 'sponsor' | 'contest';
  badge?: ReactNode;
  organizer?: { name: string; imageFileId?: string | null };
  description?: string | null;
  meta?: { icon: ReactNode; label: string }[];
  footerLabel?: ReactNode;
  editTo?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const KindIcon = kind === 'sponsor' ? Building2Icon : TrophyIcon;
  const kindLabel = kind === 'sponsor' ? 'Sponsor' : 'Contest';
  const titleNode = onView ? (
    <button type="button" className="media-catalog-card-link" onClick={onView}>
      {title}
    </button>
  ) : to ? (
    <Link to={to} className="media-catalog-card-link">
      {title}
    </Link>
  ) : (
    <span className="media-catalog-card-link">{title}</span>
  );

  return (
    <article className="media-catalog-card">
      <div className="media-catalog-card-media">
        <AuthImage
          fileId={imageFileId}
          alt={title}
          className="media-catalog-card-photo size-full!"
        />
        <div className="media-catalog-card-overlay">
          <span className="media-catalog-card-kind">
            <KindIcon aria-hidden />
            {kindLabel}
          </span>
          {badge ? <span className="media-catalog-card-badge">{badge}</span> : null}
        </div>
      </div>

      <div className="media-catalog-card-body">
        {organizer ? (
          <p className="media-catalog-organizer">
            {organizer.imageFileId ? (
              <AuthImage
                fileId={organizer.imageFileId}
                alt=""
                className="media-catalog-organizer-badge size-[21px]! rounded-[5px]"
              />
            ) : (
              <span className="media-catalog-organizer-badge" aria-hidden>
                {organizer.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="media-catalog-organizer-text">
              <strong>{organizer.name}</strong>
            </span>
          </p>
        ) : null}
        <h3>{titleNode}</h3>
        <p className="media-catalog-card-summary">
          {description?.trim() ||
            (kind === 'sponsor' ? 'Partner for quizzes and contests.' : 'Contest catalog entry.')}
        </p>
        {meta && meta.length > 0 ? (
          <div className="media-catalog-card-meta">
            {meta.map((item) => (
              <span key={item.label}>
                {item.icon}
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="media-catalog-card-bottom">
        <div className="media-catalog-card-foot">{footerLabel}</div>
        <div className="media-catalog-card-actions">
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              aria-label={`Delete ${title}`}
              onClick={onDelete}
            >
              <TrashIcon data-icon="inline-start" />
              Delete
            </Button>
          ) : null}
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="media-catalog-card-edit"
              aria-label={`Edit ${title}`}
              onClick={onEdit}
            >
              <PencilIcon data-icon="inline-start" />
              Edit
            </Button>
          ) : editTo ? (
            <Button asChild variant="outline" size="sm" className="media-catalog-card-edit">
              <Link to={editTo} aria-label={`Edit ${title}`}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </Link>
            </Button>
          ) : null}
          {onView ? (
            <Button type="button" size="sm" className="media-catalog-card-action" onClick={onView}>
              View
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : to ? (
            <Button asChild size="sm" className="media-catalog-card-action">
              <Link to={to}>
                View
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ListPager({
  noun,
  total,
  start,
  end,
  page,
  pageCount,
  pageSize,
  pageSizeOptions,
  pageSizeLabel,
  onPageChange,
  onPageSizeChange,
}: {
  noun: string;
  total: number;
  start: number;
  end: number;
  page: number;
  pageCount: number;
  pageSize: string;
  pageSizeOptions: string[];
  pageSizeLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {total === 0 ? 0 : start + 1} to {end} of {total} {noun}
      </p>
      <div className="list-pager flex flex-nowrap items-center justify-between gap-2 sm:justify-end">
        <div className="flex min-w-0 items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
            {pageSizeLabel}
          </span>
          <Select value={pageSize} onValueChange={onPageSizeChange}>
            <SelectTrigger aria-label={pageSizeLabel} className="w-16 shrink-0 sm:w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {pageSizeOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button type="button" variant="default" size="icon" aria-current="page">
            {page}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
