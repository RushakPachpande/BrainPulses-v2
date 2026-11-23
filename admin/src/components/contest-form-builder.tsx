import { useEffect, useState, type CSSProperties, type HTMLAttributes } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlignLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  GripVerticalIcon,
  HashIcon,
  ListChecksIcon,
  MailIcon,
  PhoneIcon,
  ShieldCheckIcon,
  Trash2Icon,
  TypeIcon,
  type LucideIcon,
} from 'lucide-react';
import { ContestFormFieldSettings } from '@/components/contest-form-field-settings';
import { ContestFormThankYouPanel } from '@/components/contest-form-thank-you-panel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FIELD_PALETTE,
  FIELD_TYPES,
  addPaletteField,
  duplicateField,
  moveCustomField,
  removeField,
  reorderCustomFields,
  type FieldType,
  type FormField,
  type ThankYouDraft,
} from '@/lib/contest-form';
import { cn } from '@/lib/utils';

const ICONS: Record<FieldType, LucideIcon> = {
  text: TypeIcon,
  textarea: AlignLeftIcon,
  number: HashIcon,
  email: MailIcon,
  phone: PhoneIcon,
  dropdown: ChevronDownIcon,
  multi_select: ListChecksIcon,
  consent: ShieldCheckIcon,
};

const THANK_YOU_ISSUE_FIELDS = [
  'thankYouHtml',
  'thankYouImageFileId',
  'thankYouButtonLabel',
  'thankYouButtonUrl',
];

export function ContestFormBuilder({
  fields,
  contestName,
  registeredCount,
  issues,
  thankYou,
  onFields,
  onThankYou,
}: {
  fields: FormField[];
  contestName: string;
  registeredCount: number;
  issues: Record<string, string>;
  thankYou: ThankYouDraft;
  onFields: (fields: FormField[]) => void;
  onThankYou: (patch: Partial<ThankYouDraft>) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState('settings');
  const [note, setNote] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visible = fields.filter((field) => !field.deleted);
  const locked = visible.filter((field) => field.locked);
  const custom = visible.filter((field) => !field.locked);
  const deletedLocked = fields.filter((field) => field.locked && field.deleted);
  const selected = visible.find((field) => field.id === selectedId) ?? null;

  useEffect(() => {
    if (THANK_YOU_ISSUE_FIELDS.some((field) => issues[field])) setPanel('thanks');
  }, [issues]);

  function add(type: FieldType) {
    const result = addPaletteField(fields, type);
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    setNote('');
    onFields(result.fields);
    setSelectedId(result.id);
    setPanel('settings');
  }

  function onDragEnd(event: DragEndEvent) {
    const data = event.active.data.current;
    if (data?.source === 'palette' && FIELD_TYPES.includes(data.fieldType as FieldType)) {
      if (!event.over) return;
      add(data.fieldType as FieldType);
      return;
    }
    if (!event.over || event.active.id === event.over.id) return;
    onFields(reorderCustomFields(fields, String(event.active.id), String(event.over.id)));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-4">
        <section className="rounded-lg border border-border bg-card p-3" aria-label="Add fields">
          <h3 className="text-sm font-medium">Add fields</h3>
          <p className="mt-1 text-sm text-muted-foreground">{custom.length} of 20 extra fields</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {FIELD_PALETTE.map((group) => (
              <div key={group.id}>
                <h4 className="text-xs font-medium text-muted-foreground">{group.label}</h4>
                <div className="mt-2 flex flex-col gap-2">
                  {group.items.map((item) => (
                    <PaletteItem key={item.type} item={item} onAdd={() => add(item.type)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {note ? (
            <p className="mt-3 text-sm text-destructive" role="status">
              {note}
            </p>
          ) : null}
        </section>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,24rem)]">
        <section className="min-w-0 rounded-lg bg-muted/40 p-3 sm:p-5" aria-label="Form canvas">
          <p className="text-sm text-muted-foreground">
            Drag a field onto the form, or add it from the list. Select a field to edit it.
          </p>
          {registeredCount > 0 ? (
            <p className="mt-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
              {registeredCount === 1
                ? '1 person has already registered. Changes apply to new registrations only.'
                : `${registeredCount} people have already registered. Changes apply to new registrations only.`}
            </p>
          ) : null}
          {deletedLocked.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {deletedLocked.map((field) => (
                <Button
                  key={field.id}
                  type="button"
                  variant="outline"
                  onClick={() =>
                    onFields(
                      fields.map((item) =>
                        item.id === field.id ? { ...item, deleted: false } : item,
                      ),
                    )
                  }
                >
                  Restore {field.label || field.key}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="mx-auto mt-4 w-full max-w-lg rounded-lg border border-border bg-card p-4 sm:p-5">
            <h3 className="text-base font-semibold">{contestName || 'Registration form'}</h3>
            <div className="mt-4 flex flex-col gap-3">
              {locked.map((field) => (
                <CanvasField
                  key={field.id}
                  field={field}
                  selected={field.id === selected?.id}
                  issue={issues[field.id]}
                  onSelect={() => {
                    setSelectedId(field.id);
                    setPanel('settings');
                  }}
                  onDelete={() => {
                    onFields(removeField(fields, field.id));
                    if (selectedId === field.id) setSelectedId(null);
                  }}
                />
              ))}
              <SortableContext
                items={custom.map((field) => field.id)}
                strategy={verticalListSortingStrategy}
              >
                {custom.map((field, index) => (
                  <SortableCanvasField
                    key={field.id}
                    field={field}
                    selected={field.id === selected?.id}
                    issue={issues[field.id]}
                    onSelect={() => {
                      setSelectedId(field.id);
                      setPanel('settings');
                    }}
                    onDelete={() => {
                      onFields(removeField(fields, field.id));
                      if (selectedId === field.id) setSelectedId(null);
                    }}
                    onDuplicate={() => {
                      const result = duplicateField(fields, field.id);
                      if (!result.ok) {
                        setNote(result.message);
                        return;
                      }
                      setNote('');
                      onFields(result.fields);
                      setSelectedId(result.id);
                    }}
                    onMove={(direction) => onFields(moveCustomField(fields, field.id, direction))}
                    moveUpDisabled={index === 0}
                    moveDownDisabled={index === custom.length - 1}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
        </section>

        <Tabs
          value={panel}
          onValueChange={setPanel}
          className="min-w-0 rounded-lg border border-border bg-card p-3 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto"
        >
          <TabsList className="grid h-auto w-full grid-cols-1 group-data-horizontal/tabs:h-auto sm:grid-cols-2">
            <TabsTrigger
              value="settings"
              className="min-h-11 whitespace-normal px-3 text-center leading-snug"
            >
              Field settings
            </TabsTrigger>
            <TabsTrigger
              value="thanks"
              className="min-h-11 whitespace-normal px-3 text-center leading-snug"
            >
              Thank you message
            </TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="mt-3">
            <ContestFormFieldSettings
              field={selected}
              issue={selected ? issues[selected.id] : undefined}
              onChange={(next) =>
                onFields(fields.map((item) => (item.id === next.id ? next : item)))
              }
            />
          </TabsContent>
          <TabsContent value="thanks" className="mt-3">
            <ContestFormThankYouPanel value={thankYou} issues={issues} onChange={onThankYou} />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </DndContext>
  );
}

function PaletteItem({
  item,
  onAdd,
}: {
  item: { type: FieldType; label: string; description: string };
  onAdd: () => void;
}) {
  const Icon = ICONS[item.type];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { source: 'palette', fieldType: item.type },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-stretch gap-1 rounded-lg border border-border bg-card',
        isDragging && 'opacity-60',
      )}
    >
      <button
        type="button"
        className="inline-flex w-11 shrink-0 items-center justify-center rounded-l-lg text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Drag ${item.label} onto the form`}
        {...listeners}
        {...attributes}
      >
        <GripVerticalIcon aria-hidden />
      </button>
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-11 flex-1 justify-start gap-2 px-2"
        aria-label={`Add ${item.label} field`}
        onClick={onAdd}
      >
        <Icon aria-hidden />
        <span className="min-w-0 text-left">
          <span className="block text-sm font-medium">{item.label}</span>
          <span className="block text-xs font-normal text-muted-foreground">
            {item.description}
          </span>
        </span>
      </Button>
    </div>
  );
}

function SortableCanvasField(props: Omit<CanvasFieldProps, 'drag'> & { field: FormField }) {
  const sortableState = useSortable({
    id: props.field.id,
    data: { source: 'canvas' },
  });
  return (
    <CanvasField
      {...props}
      drag={{
        setNodeRef: sortableState.setNodeRef,
        style: {
          transform: CSS.Transform.toString(sortableState.transform),
          transition: prefersReducedMotion() ? undefined : sortableState.transition,
        },
        handleProps: { ...sortableState.attributes, ...sortableState.listeners },
      }}
    />
  );
}

type CanvasFieldProps = {
  field: FormField;
  selected: boolean;
  issue?: string;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onMove?: (direction: -1 | 1) => void;
  drag?: {
    setNodeRef: (element: HTMLElement | null) => void;
    style?: CSSProperties;
    handleProps: HTMLAttributes<HTMLButtonElement>;
  };
};

function CanvasField({
  field,
  selected,
  issue,
  moveUpDisabled,
  moveDownDisabled,
  onSelect,
  onDelete,
  onDuplicate,
  onMove,
  drag,
}: CanvasFieldProps) {
  const emailLocked = field.locked && field.key === 'email';

  return (
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      data-field={field.id}
      className={cn(
        'group/field rounded-lg border bg-background p-3',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
      )}
    >
      <div className="flex items-start gap-1">
        {drag ? (
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Drag to reorder ${field.label}`}
            {...drag.handleProps}
          >
            <GripVerticalIcon aria-hidden />
          </button>
        ) : (
          <span className="inline-flex size-11 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          className="min-w-0 flex-1 py-2 text-left"
          aria-pressed={selected}
          onClick={onSelect}
        >
          <span className="block text-sm font-medium">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </span>
          <span className="mt-2 block rounded-md border border-input bg-card px-3 py-2 text-sm text-muted-foreground">
            {field.placeholder || field.help || FIELD_TYPE_PREVIEW[field.type]}
          </span>
        </button>
      </div>
      <div
        className={cn(
          'mt-2 flex flex-wrap justify-end gap-1',
          selected ? 'flex' : 'hidden group-focus-within/field:flex',
        )}
      >
        {onMove ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move ${field.label} up`}
              disabled={moveUpDisabled}
              onClick={() => onMove(-1)}
            >
              <ChevronUpIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move ${field.label} down`}
              disabled={moveDownDisabled}
              onClick={() => onMove(1)}
            >
              <ChevronDownIcon />
            </Button>
          </>
        ) : null}
        {onDuplicate ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Duplicate ${field.label}`}
            onClick={onDuplicate}
          >
            <CopyIcon />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          aria-label={`Delete ${field.label}`}
          disabled={emailLocked}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </div>
      {issue ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {issue}
        </p>
      ) : null}
    </div>
  );
}

const FIELD_TYPE_PREVIEW: Record<FieldType, string> = {
  text: 'Short answer',
  textarea: 'Long answer',
  number: 'Number',
  email: 'name@example.com',
  phone: 'Enter phone number',
  dropdown: 'Select an option',
  multi_select: 'Select one or more',
  consent: 'I agree',
};

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
