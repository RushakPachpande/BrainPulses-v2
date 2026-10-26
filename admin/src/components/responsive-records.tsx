import { useId } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
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
  | 'title'
  | 'identity'
  | 'status'
  | 'media'
  | 'lead'
  | 'pill'
  | 'wide'
  | 'half'
  | 'primary'
  | 'details';

export type RecordColumn<Row> = {
  key: string;
  label: string;
  placement: RecordPlacement;
  render: (row: Row) => ReactNode;
  /** Card-only value. The table keeps `render`. */
  card?: (row: Row) => ReactNode;
  /** Card-only label. The table header keeps `label`. */
  cardLabel?: string;
  /** Prepended on the identity line, for example `ID: `. */
  identityPrefix?: string;
  icon?: LucideIcon;
  tableClassName?: string;
  headClassName?: string;
  /** Included in the column sort control. Defaults to true when `sort` is set. */
  sortable?: boolean;
};

type RecordSelection<Row> = {
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string, checked: boolean) => void;
  onClear: () => void;
  selectedCount: number;
  allLabel: string;
  rowLabel: (row: Row) => string;
  actions?: ReactNode;
};

type RecordSort = {
  key: string | null;
  direction: 'asc' | 'desc';
  onSort: (key: string) => void;
};

function fieldsWith<Row>(columns: RecordColumn<Row>[], placement: RecordPlacement) {
  return columns.filter((column) => column.placement === placement);
}

function fieldSpan(placement: RecordPlacement): 'wide' | 'half' | null {
  if (placement === 'wide' || placement === 'primary') return 'wide';
  if (placement === 'half' || placement === 'details') return 'half';
  return null;
}

function cardValue<Row>(column: RecordColumn<Row>, row: Row) {
  return column.card ? column.card(row) : column.render(row);
}

function CardFields<Row>({ columns, row }: { columns: RecordColumn<Row>[]; row: Row }) {
  const fields = columns.filter((column) => fieldSpan(column.placement));
  if (fields.length === 0) return null;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
      {fields.map((field) => {
        const Icon = field.icon;
        const wide = fieldSpan(field.placement) === 'wide';
        return (
          <div key={field.key} className={cn('min-w-0', wide && 'col-span-2')}>
            <dt className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
              {field.cardLabel ?? field.label}
            </dt>
            <dd className="text-sm wrap-break-word">{cardValue(field, row)}</dd>
          </div>
        );
      })}
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
  const title = fieldsWith(columns, 'title');
  const identity = fieldsWith(columns, 'identity');
  const status = fieldsWith(columns, 'status');
  const pills = fieldsWith(columns, 'pill');
  const media = fieldsWith(columns, 'media');
  const lead = fieldsWith(columns, 'lead');
  const selected = selection?.selected.has(id) ?? false;

  return (
    <li data-slot="record-panel" data-state={selected ? 'selected' : undefined} className="p-3.5">
      <div className="flex items-start gap-2.5">
        {lead.map((column) => (
          <div
            key={column.key}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-medium tabular-nums"
          >
            {cardValue(column, row)}
          </div>
        ))}
        {media.map((column) => (
          <div
            key={column.key}
            className="size-10 shrink-0 overflow-hidden rounded-lg [&_img]:size-10 [&_img]:rounded-lg"
          >
            {cardValue(column, row)}
          </div>
        ))}
        <div className="min-w-0 flex-1">
          {title.map((column) => (
            <div key={column.key} className="text-sm leading-snug font-semibold wrap-break-word">
              {cardValue(column, row)}
            </div>
          ))}
          {identity.length > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {identity.map((column) => (
                <span key={column.key} className="mr-3 last:mr-0">
                  {column.identityPrefix}
                  {cardValue(column, row)}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        {selection ? (
          <div className="flex size-11 shrink-0 items-center justify-center">
            <Checkbox
              checked={selection.selected.has(id)}
              onCheckedChange={(checked) => selection.onToggleOne(id, checked === true)}
              aria-label={selection.rowLabel(row)}
            />
          </div>
        ) : null}
      </div>
      {status.length > 0 || pills.length > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {status.map((column) => (
              <div key={column.key}>{cardValue(column, row)}</div>
            ))}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {pills.map((column) => (
              <span
                key={column.key}
                className="rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary"
              >
                {cardValue(column, row)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <CardFields columns={columns} row={row} />
      {renderActions ? (
        <div data-slot="record-actions" className="mt-3.5 border-t border-border pt-3">
          {renderActions(row)}
        </div>
      ) : null}
    </li>
  );
}

function SelectionBar<Row>({
  selection,
  narrow,
}: {
  selection: RecordSelection<Row>;
  narrow: boolean;
}) {
  const selectAllId = useId();
  const checked = selection.allSelected ? true : selection.someSelected ? 'indeterminate' : false;
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-3 px-1">
      <Checkbox
        id={selectAllId}
        checked={checked}
        onCheckedChange={() => selection.onToggleAll()}
      />
      <label htmlFor={selectAllId} className="cursor-pointer text-sm">
        {selection.allLabel}
      </label>
      {selection.selectedCount > 0 ? (
        <div
          className={cn(
            'flex gap-2',
            narrow
              ? 'w-full [&_[data-slot=button]]:min-w-0 [&_[data-slot=button]]:flex-1'
              : 'ml-auto',
          )}
        >
          <Button type="button" variant="outline" onClick={selection.onClear}>
            Clear selection
          </Button>
          {selection.actions}
        </div>
      ) : null}
    </div>
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
        {selection ? <SelectionBar selection={selection} narrow={narrow} /> : null}
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

  const headerChecked = selection
    ? selection.allSelected
      ? true
      : selection.someSelected
        ? 'indeterminate'
        : false
    : false;

  return (
    <div className="flex flex-col gap-3">
      {selection ? <SelectionBar selection={selection} narrow={narrow} /> : null}
      <Table>
        <TableCaption className={captionClassName}>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {selection ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={headerChecked}
                  onCheckedChange={() => selection.onToggleAll()}
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
                <TableRow
                  key={id}
                  data-state={selection?.selected.has(id) ? 'selected' : undefined}
                >
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
    </div>
  );
}
