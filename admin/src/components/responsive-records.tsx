import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { SortHeader } from '@/components/sort-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from 'cn';

export type RecordPlacement =
  'title' | 'identity' | 'status' | 'media' | 'lead' | 'primary' | 'details';

export type RecordColumn<Row> = {
  key: string;
  label: string;
  placement: RecordPlacement;
  render: (row: Row) => ReactNode;
  tableClassName?: string;
  headClassName?: string;
  /** Included in the column sort control. Defaults to true when `sort` is set. */
  sortable?: boolean;
};

type RecordSelection<Row> = {
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
  allLabel: string;
  rowLabel: (row: Row) => string;
};

type RecordSort = {
  key: string | null;
  direction: 'asc' | 'desc';
  onSort: (key: string) => void;
};

function fieldsWith<Row>(columns: RecordColumn<Row>[], placement: RecordPlacement) {
  return columns.filter((column) => column.placement === placement);
}

function FieldList<Row>({ fields, row }: { fields: RecordColumn<Row>[]; row: Row }) {
  return (
    <dl className="grid grid-cols-1 gap-3 @min-[24rem]:grid-cols-2">
      {fields.map((field) => (
        <div key={field.key} className="min-w-0">
          <dt className="text-sm text-muted-foreground">{field.label}</dt>
          <dd className="mt-0.5 text-sm wrap-break-word">{field.render(row)}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecordPanel<Row>({
  row,
  id,
  columns,
  selection,
  renderActions,
}: {
  row: Row;
  id: string;
  columns: RecordColumn<Row>[];
  selection?: RecordSelection<Row>;
  renderActions?: (row: Row) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const title = fieldsWith(columns, 'title');
  const identity = fieldsWith(columns, 'identity');
  const status = fieldsWith(columns, 'status');
  const media = fieldsWith(columns, 'media');
  const lead = fieldsWith(columns, 'lead');
  const primary = fieldsWith(columns, 'primary');
  const details = fieldsWith(columns, 'details');
  const selected = selection?.selected.has(id) ?? false;

  return (
    <li
      data-slot="record-panel"
      data-state={selected ? 'selected' : undefined}
      className="@container p-4"
    >
      <div className="flex items-start gap-3">
        {selection ? (
          <div className="flex size-11 shrink-0 items-center justify-center">
            <Checkbox
              checked={selection.selected.has(id)}
              onCheckedChange={(checked) => selection.onToggleOne(id, checked === true)}
              aria-label={selection.rowLabel(row)}
            />
          </div>
        ) : null}
        {lead.map((column) => (
          <div
            key={column.key}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-medium tabular-nums"
          >
            {column.render(row)}
          </div>
        ))}
        {media.map((column) => (
          <div
            key={column.key}
            className="size-11 shrink-0 overflow-hidden rounded-lg [&_img]:size-11 [&_img]:rounded-lg"
          >
            {column.render(row)}
          </div>
        ))}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="min-w-0">
            {title.map((column) => (
              <div key={column.key} className="text-base leading-snug font-medium wrap-break-word">
                {column.render(row)}
              </div>
            ))}
            {identity.length > 0 ? (
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                {identity.map((column) => (
                  <span key={column.key}>{column.render(row)}</span>
                ))}
              </p>
            ) : null}
          </div>
          {status.length > 0 ? (
            <div className="flex shrink-0 flex-col items-end gap-1">
              {status.map((column) => (
                <div key={column.key}>{column.render(row)}</div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {primary.length > 0 ? (
        <div className="mt-4">
          <FieldList fields={primary} row={row} />
        </div>
      ) : null}
      {details.length > 0 ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 px-2"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDownIcon
              data-icon="inline-start"
              className={cn(
                'motion-safe:transition-transform motion-safe:duration-200',
                open && 'rotate-180',
              )}
            />
            {open ? 'Hide details' : 'Details'}
          </Button>
          {open ? (
            <div id={detailsId} className="mt-2 rounded-lg bg-muted/50 p-3">
              <FieldList fields={details} row={row} />
            </div>
          ) : null}
        </div>
      ) : null}
      {renderActions ? (
        <div data-slot="record-actions" className="mt-4 border-t border-border pt-3">
          {renderActions(row)}
        </div>
      ) : null}
    </li>
  );
}

export function ResponsiveRecords<Row>({
  caption,
  captionClassName = 'sr-only',
  rows,
  getRowId,
  columns,
  renderActions,
  actionsLabel = 'Actions',
  empty,
  emptyClassName = 'h-24 text-center text-muted-foreground',
  narrow,
  selection,
  sort,
}: {
  caption: string;
  captionClassName?: string;
  rows: Row[];
  getRowId: (row: Row) => string;
  columns: RecordColumn<Row>[];
  renderActions?: (row: Row) => ReactNode;
  actionsLabel?: string;
  empty: ReactNode;
  emptyClassName?: string;
  narrow: boolean;
  selection?: RecordSelection<Row>;
  sort?: RecordSort;
}) {
  const selectAllId = useId();
  const columnCount = columns.length + (selection ? 1 : 0) + (renderActions ? 1 : 0);
  const captionHidden = captionClassName.includes('sr-only');

  if (narrow) {
    return (
      <div data-slot="record-list" className="flex flex-col gap-3 p-3">
        {captionHidden ? (
          <p className="sr-only">{caption}</p>
        ) : (
          <p className={cn('px-1 text-sm text-muted-foreground', captionClassName)}>{caption}</p>
        )}
        {selection ? (
          <div className="flex min-h-11 items-center gap-3 px-1">
            <Checkbox
              checked={
                selection.allSelected ? true : selection.someSelected ? 'indeterminate' : false
              }
              onCheckedChange={(checked) => selection.onToggleAll(checked === true)}
              aria-labelledby={selectAllId}
            />
            <span id={selectAllId} className="text-sm">
              {selection.allLabel}
            </span>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <p className={emptyClassName}>{empty}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={caption}>
            {rows.map((row) => (
              <RecordPanel
                key={getRowId(row)}
                row={row}
                id={getRowId(row)}
                columns={columns}
                selection={selection}
                renderActions={renderActions}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <Table>
      <TableCaption className={captionClassName}>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {selection ? (
            <TableHead className="w-10">
              <Checkbox
                checked={
                  selection.allSelected ? true : selection.someSelected ? 'indeterminate' : false
                }
                onCheckedChange={(checked) => selection.onToggleAll(checked === true)}
                aria-label={selection.allLabel}
              />
            </TableHead>
          ) : null}
          {columns.map((column) => {
            const sortable = Boolean(sort) && column.sortable !== false;
            return (
              <TableHead
                key={column.key}
                scope="col"
                className={column.headClassName}
                aria-sort={
                  sortable
                    ? sort?.key === column.key
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                    : undefined
                }
              >
                {sortable && sort ? (
                  <SortHeader
                    label={column.label}
                    active={sort.key === column.key}
                    direction={sort.direction}
                    onSort={() => sort.onSort(column.key)}
                  />
                ) : (
                  column.label
                )}
              </TableHead>
            );
          })}
          {renderActions ? <TableHead scope="col">{actionsLabel}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columnCount} className={emptyClassName}>
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => {
            const id = getRowId(row);
            return (
              <TableRow key={id} data-state={selection?.selected.has(id) ? 'selected' : undefined}>
                {selection ? (
                  <TableCell>
                    <Checkbox
                      checked={selection.selected.has(id)}
                      onCheckedChange={(checked) => selection.onToggleOne(id, checked === true)}
                      aria-label={selection.rowLabel(row)}
                    />
                  </TableCell>
                ) : null}
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.tableClassName}>
                    {column.render(row)}
                  </TableCell>
                ))}
                {renderActions ? <TableCell>{renderActions(row)}</TableCell> : null}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
