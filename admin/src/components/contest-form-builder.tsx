import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
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
  CalendarIcon,
  CheckIcon,
  CircleDotIcon,
  ClipboardListIcon,
  ClockIcon,
  CopyIcon,
  FileCheckIcon,
  GripVerticalIcon,
  HashIcon,
  HeadingIcon,
  ImageIcon,
  ListChecksIcon,
  LockIcon,
  MailIcon,
  MinusIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  SquareCheckIcon,
  SquareChevronDownIcon,
  TextIcon,
  Trash2Icon,
  TypeIcon,
  UnlockIcon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { ContestFormFieldSettings } from '@/components/contest-form-field-settings';
import { ContestFormThankYouPanel } from '@/components/contest-form-thank-you-panel';
import { useConfirm } from '@/components/use-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CORE_FIELDS,
  FIELD_PALETTE,
  FIELD_TYPE_LABEL,
  FIELD_TYPES,
  MAX_EXTRA_FIELDS,
  addPaletteField,
  duplicateField,
  extraFieldCount,
  fieldIssue,
  isChoiceType,
  isContentType,
  moveCustomField,
  removeField,
  reorderCustomFields,
  rulesUsing,
  type AssignmentRule,
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
  dropdown: SquareChevronDownIcon,
  radio: CircleDotIcon,
  checkboxes: SquareCheckIcon,
  multi_select: ListChecksIcon,
  date: CalendarIcon,
  time: ClockIcon,
  consent: FileCheckIcon,
  heading: HeadingIcon,
  description: TextIcon,
  image: ImageIcon,
  divider: MinusIcon,
};

const THANK_YOU_ISSUE_FIELDS = [
  'thankYouHtml',
  'thankYouImageFileId',
  'thankYouButtonLabel',
  'thankYouButtonUrl',
];
const FORM_ISSUE_FIELDS = ['opensAt', 'closesAt', 'seats'];

type Panel = 'palette' | 'canvas' | 'settings';
type SettingsTab = 'field' | 'form' | 'thanks';

export function ContestFormBuilder({
  fields,
  contestName,
  sponsorName,
  welcomeMessage,
  showSponsorName,
  registeredCount,
  issues,
  thankYou,
  rules,
  coreUnlocked,
  formSettings,
  onFields,
  onThankYou,
  onUnlockCore,
}: {
  fields: FormField[];
  contestName: string;
  sponsorName?: string;
  welcomeMessage?: string | null;
  showSponsorName?: boolean;
  registeredCount: number;
  issues: Record<string, string>;
  thankYou: ThankYouDraft;
  rules: AssignmentRule[];
  coreUnlocked: boolean;
  /** The Form Settings tab content (dates, seats, welcome message). */
  formSettings?: React.ReactNode;
  onFields: (fields: FormField[]) => void;
  onThankYou: (patch: Partial<ThankYouDraft>) => void;
  onUnlockCore: () => void;
}) {
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backup, setBackup] = useState<FormField | null>(null);
  const [localIssue, setLocalIssue] = useState('');
  const [tab, setTab] = useState<SettingsTab>('field');
  const [panel, setPanel] = useState<Panel>('canvas');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [note, setNote] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visible = fields.filter((field) => !field.deleted);
  const core = visible.filter((field) => field.locked);
  const custom = visible.filter((field) => !field.locked);
  const selected = visible.find((field) => field.id === selectedId) ?? null;
  const dirty = Boolean(selected && backup && JSON.stringify(selected) !== JSON.stringify(backup));
  const extraUsed = extraFieldCount(fields);

  useEffect(() => {
    if (THANK_YOU_ISSUE_FIELDS.some((field) => issues[field])) {
      setTab('thanks');
      setPanel('settings');
    } else if (FORM_ISSUE_FIELDS.some((field) => issues[field])) {
      setTab('form');
      setPanel('settings');
    }
  }, [issues]);

  function replace(next: FormField) {
    onFields(fields.map((item) => (item.id === next.id ? next : item)));
  }

  async function select(id: string) {
    if (id === selectedId) {
      setTab('field');
      setPanel('settings');
      return;
    }
    if (dirty && selected && backup) {
      const discard = await confirm({
        title: `Discard changes to “${selected.label || FIELD_TYPE_LABEL[selected.type]}”?`,
        description: 'You changed this field but didn’t press Save field.',
        confirmLabel: 'Discard changes',
        destructive: true,
      });
      if (!discard) return;
      replace(backup);
    }
    const next = visible.find((field) => field.id === id) ?? null;
    setSelectedId(id);
    setBackup(next ? structuredClone(next) : null);
    setLocalIssue('');
    setTab('field');
    setPanel('settings');
  }

  function afterAdd(nextFields: FormField[], id: string) {
    onFields(nextFields);
    const added = nextFields.find((field) => field.id === id) ?? null;
    setSelectedId(id);
    setBackup(added ? structuredClone(added) : null);
    setLocalIssue('');
    setTab('field');
    setPanel('settings');
  }

  function add(type: FieldType) {
    const result = addPaletteField(fields, type);
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    setNote('');
    afterAdd(result.fields, result.id);
  }

  function restoreCore(key: string) {
    onFields(fields.map((field) => (field.key === key ? { ...field, deleted: false } : field)));
  }

  function remove(field: FormField) {
    const used = isChoiceType(field.type) ? rulesUsing(rules, field.id) : [];
    if (used.length) {
      toast.error(`Used in Rule ${used.join(', ')}. Change the rule in Step 2 first.`);
      return;
    }
    if (field.locked && !coreUnlocked) {
      onUnlockCore();
      return;
    }
    onFields(removeField(fields, field.id));
    if (selectedId === field.id) {
      setSelectedId(null);
      setBackup(null);
    }
  }

  function duplicate(field: FormField) {
    const result = duplicateField(fields, field.id);
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    setNote('');
    afterAdd(result.fields, result.id);
  }

  function onSaveField() {
    if (!selected) return;
    const problem = fieldIssue(selected);
    if (problem) {
      setLocalIssue(problem);
      return;
    }
    setLocalIssue('');
    setBackup(structuredClone(selected));
    toast.success('Field saved');
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

  const q = debouncedQuery.trim().toLowerCase();
  const coreItems = Object.entries(CORE_FIELDS).filter(
    ([, item]) => !q || item.label.toLowerCase().includes(q),
  );
  const groups = FIELD_PALETTE.map((group) => ({
    ...group,
    items: group.items.filter((item) => !q || item.label.toLowerCase().includes(q)),
  })).filter((group) => group.items.length > 0);
  const customIndex = selected ? custom.findIndex((field) => field.id === selected.id) : -1;

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div
        className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1 xl:hidden"
        role="tablist"
        aria-label="Builder panels"
      >
        {(
          [
            ['palette', 'Add fields'],
            ['canvas', 'Form'],
            ['settings', 'Settings'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={panel === key}
            className={cn(
              'min-h-11 rounded-md text-sm font-medium',
              panel === key ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
            )}
            onClick={() => setPanel(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[17.5rem_minmax(0,1fr)_22rem] 2xl:grid-cols-[18.5rem_minmax(0,1fr)_25rem]">
        <section
          aria-label="Add fields"
          className={cn(
            'min-w-0 rounded-xl border border-border bg-card p-3 xl:sticky xl:top-4 xl:block xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto',
            panel === 'palette' ? 'block' : 'hidden',
          )}
        >
          <h2 className="font-semibold">Add fields</h2>
          <div className="relative mt-3">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              className="pl-9"
              placeholder="Search fields…"
              aria-label="Search fields"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {coreItems.length ? (
            <PaletteGroup title="Contact details · locked">
              {coreItems.map(([key, item]) => {
                const inForm = core.some((field) => field.key === key);
                return (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    className="h-auto min-h-11 justify-start gap-2 px-2 whitespace-normal"
                    disabled={inForm}
                    aria-label={inForm ? `${item.label} is on the form` : `Add ${item.label} back`}
                    onClick={() => restoreCore(key)}
                  >
                    {inForm ? (
                      <CheckIcon className="text-success" aria-hidden />
                    ) : (
                      <UserIcon aria-hidden />
                    )}
                    <span className="text-left text-sm">{item.label}</span>
                  </Button>
                );
              })}
            </PaletteGroup>
          ) : null}
          {groups.map((group) => (
            <PaletteGroup key={group.id} title={group.label}>
              {group.items.map((item) => (
                <PaletteItem
                  key={item.type}
                  type={item.type}
                  label={item.label}
                  disabled={!isContentType(item.type) && extraUsed >= MAX_EXTRA_FIELDS}
                  onAdd={() => add(item.type)}
                />
              ))}
            </PaletteGroup>
          ))}
          {!coreItems.length && !groups.length ? (
            <p className="mt-3 text-sm text-muted-foreground">No field matches that search.</p>
          ) : null}
          <p className="mt-4 text-sm text-muted-foreground">
            {extraUsed} of {MAX_EXTRA_FIELDS} extra fields used
            {extraUsed >= MAX_EXTRA_FIELDS ? '. Remove one to add another.' : '.'} Content blocks
            don't count.
          </p>
          {note ? (
            <p className="mt-2 text-sm text-destructive" role="status">
              {note}
            </p>
          ) : null}
        </section>

        <section
          aria-label="Form canvas"
          className={cn(
            'min-w-0 rounded-xl border border-border bg-card xl:block',
            panel === 'canvas' ? 'block' : 'hidden',
          )}
        >
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Form canvas</h2>
            <p className="text-sm text-muted-foreground">
              Drag fields here and arrange them in your preferred order.
            </p>
          </div>
          <div className="bg-muted/40 p-3 sm:p-5">
            {registeredCount > 0 ? (
              <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                {registeredCount === 1
                  ? '1 person has already registered. Field changes apply to new registrations.'
                  : `${registeredCount} people have already registered. Field changes apply to new registrations.`}
              </p>
            ) : null}
            <div className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-start gap-3 border-b border-border p-4">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
                  aria-hidden
                >
                  <ClipboardListIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-semibold">
                    {contestName || 'Contest name'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {showSponsorName && sponsorName ? `Presented by ${sponsorName} · ` : ''}
                    {welcomeMessage || 'Please complete the details below to register.'}
                  </p>
                </div>
                {formSettings ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTab('form');
                      setPanel('settings');
                    }}
                  >
                    <Settings2Icon data-icon="inline-start" />
                    Form settings
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Contact details
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={coreUnlocked}
                    onClick={onUnlockCore}
                  >
                    {coreUnlocked ? (
                      <UnlockIcon data-icon="inline-start" />
                    ) : (
                      <LockIcon data-icon="inline-start" />
                    )}
                    {coreUnlocked ? 'Unlocked' : 'Unlock'}
                  </Button>
                </div>
                {core.map((field) => (
                  <CanvasField
                    key={field.id}
                    field={field}
                    selected={field.id === selectedId}
                    issue={issues[field.id]}
                    lockedView={!coreUnlocked}
                    onSelect={() => void select(field.id)}
                    onDelete={
                      coreUnlocked && CORE_FIELDS[field.key]?.canDelete
                        ? () => remove(field)
                        : undefined
                    }
                  />
                ))}
                <div className="flex items-center justify-between gap-2 pt-3">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Your fields
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {extraUsed} of {MAX_EXTRA_FIELDS}
                  </span>
                </div>
                <SortableContext
                  items={custom.map((field) => field.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {custom.map((field) => (
                    <SortableCanvasField
                      key={field.id}
                      field={field}
                      selected={field.id === selectedId}
                      issue={issues[field.id]}
                      onSelect={() => void select(field.id)}
                      onDelete={() => remove(field)}
                      onDuplicate={() => duplicate(field)}
                    />
                  ))}
                </SortableContext>
                {custom.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">No extra fields yet.</p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-1 border-dashed"
                  onClick={() => {
                    setPanel('palette');
                    window.setTimeout(() => searchRef.current?.focus(), 0);
                  }}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add a field
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Settings"
          className={cn(
            'min-w-0 rounded-xl border border-border bg-card p-3 xl:sticky xl:top-4 xl:block xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto',
            panel === 'settings' ? 'block' : 'hidden',
          )}
        >
          <Tabs value={tab} onValueChange={(value) => setTab(value as SettingsTab)}>
            <TabsList className="grid h-auto w-full grid-cols-3 group-data-horizontal/tabs:h-auto">
              <TabsTrigger
                value="field"
                className="min-h-11 px-1 text-center leading-snug whitespace-normal"
              >
                Field Settings
              </TabsTrigger>
              <TabsTrigger
                value="form"
                className="min-h-11 px-1 text-center leading-snug whitespace-normal"
              >
                Form Settings
              </TabsTrigger>
              <TabsTrigger
                value="thanks"
                className="min-h-11 px-1 text-center leading-snug whitespace-normal"
              >
                Thank You Message
              </TabsTrigger>
            </TabsList>
            <TabsContent value="field" className="mt-3">
              <ContestFormFieldSettings
                field={selected}
                issue={localIssue || (selected ? issues[selected.id] : undefined)}
                rules={rules}
                coreUnlocked={coreUnlocked}
                dirty={dirty}
                canMoveUp={customIndex > 0}
                canMoveDown={customIndex >= 0 && customIndex < custom.length - 1}
                onChange={(next) => {
                  setLocalIssue('');
                  replace(next);
                }}
                onSave={onSaveField}
                onCancel={() => {
                  if (backup) replace(backup);
                  setLocalIssue('');
                }}
                onUnlock={onUnlockCore}
                onMove={(direction) =>
                  selected && onFields(moveCustomField(fields, selected.id, direction))
                }
                onDuplicate={() => selected && duplicate(selected)}
                onDelete={() => selected && remove(selected)}
              />
            </TabsContent>
            <TabsContent value="form" className="mt-3">
              {formSettings}
            </TabsContent>
            <TabsContent value="thanks" className="mt-3">
              <ContestFormThankYouPanel value={thankYou} issues={issues} onChange={onThankYou} />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </DndContext>
  );
}

function PaletteGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function PaletteItem({
  type,
  label,
  disabled,
  onAdd,
}: {
  type: FieldType;
  label: string;
  disabled: boolean;
  onAdd: () => void;
}) {
  const Icon = ICONS[type];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: 'palette', fieldType: type },
    disabled,
  });
  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-60')}>
      <Button
        {...attributes}
        {...listeners}
        aria-roledescription="draggable field type"
        type="button"
        variant="outline"
        className="h-auto min-h-11 w-full justify-start gap-1.5 px-2 text-left whitespace-normal"
        aria-label={`Add ${label} field`}
        disabled={disabled}
        onClick={onAdd}
      >
        <Icon aria-hidden />
        <span className="min-w-0 text-[13px] leading-tight break-words">{label}</span>
      </Button>
    </div>
  );
}

function SortableCanvasField(props: Omit<CanvasFieldProps, 'drag'> & { field: FormField }) {
  const sortableState = useSortable({ id: props.field.id, data: { source: 'canvas' } });
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
  lockedView?: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
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
  lockedView,
  onSelect,
  onDelete,
  onDuplicate,
  drag,
}: CanvasFieldProps) {
  const content = isContentType(field.type);
  const name = field.label || FIELD_TYPE_LABEL[field.type];
  return (
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      data-field={field.id}
      className={cn(
        'flex items-start gap-1 rounded-lg border bg-background p-2',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
        issue && !selected && 'border-destructive',
      )}
    >
      {drag ? (
        <button
          type="button"
          className="inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Drag to reorder ${name}`}
          {...drag.handleProps}
        >
          <GripVerticalIcon aria-hidden />
        </button>
      ) : (
        <span
          className="inline-flex size-11 shrink-0 items-center justify-center text-muted-foreground"
          title="Contact fields stay at the top"
        >
          <LockIcon className="size-4" aria-hidden />
        </span>
      )}
      <button
        type="button"
        className="min-w-0 flex-1 py-1.5 text-left"
        aria-pressed={selected}
        aria-label={`${name}${lockedView ? ', locked' : ''}. Open settings.`}
        onClick={onSelect}
      >
        {content ? (
          <span className="block text-xs font-medium text-muted-foreground">
            {FIELD_TYPE_LABEL[field.type]}
          </span>
        ) : (
          <span className="block text-sm font-medium">
            {name}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </span>
        )}
        {field.help && !content ? (
          <span className="block text-xs text-muted-foreground">{field.help}</span>
        ) : null}
        <span className="mt-1.5 block">
          <FieldPreview field={field} />
        </span>
        {issue ? (
          <span className="mt-1.5 block text-sm text-destructive" role="alert">
            {issue}
          </span>
        ) : null}
      </button>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        {onDuplicate ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Duplicate ${name}`}
            title="Duplicate"
            onClick={onDuplicate}
          >
            <CopyIcon />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Settings for ${name}`}
          title="Settings"
          onClick={onSelect}
        >
          {lockedView ? <LockIcon /> : <Settings2Icon />}
        </Button>
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete ${name}`}
            title="Delete"
            onClick={onDelete}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const box =
  'flex min-h-10 items-center justify-between rounded-[9px] border border-input bg-card px-3 text-sm text-muted-foreground';

/** A still picture of the field, so the canvas reads like the real form. */
function FieldPreview({ field }: { field: FormField }) {
  const options = field.options ?? [];
  switch (field.type) {
    case 'heading':
      return (
        <span className="block font-semibold text-foreground">{field.label || 'Heading'}</span>
      );
    case 'description':
      return (
        <span className="block text-sm text-foreground">
          {field.text || 'Add some text for participants.'}
        </span>
      );
    case 'image':
      return (
        <span className="flex min-h-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
          <ImageIcon aria-hidden />
          <span className="sr-only">{field.imageFileId ? 'Image chosen' : 'No image yet'}</span>
        </span>
      );
    case 'divider':
      return <hr className="my-2 border-border" />;
    case 'textarea':
      return (
        <span className={cn(box, 'min-h-16 items-start pt-2')}>
          {field.placeholder || 'Long answer'}
        </span>
      );
    case 'phone':
      return (
        <span className="flex">
          <span className="inline-flex items-center rounded-l-[9px] border border-r-0 border-input bg-muted px-3 text-sm">
            +91
          </span>
          <span className={cn(box, 'flex-1 rounded-l-none')}>
            {field.placeholder || '10-digit mobile number'}
          </span>
        </span>
      );
    case 'radio':
    case 'checkboxes':
      return (
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {options.slice(0, 4).map((option) => (
            <span key={option.id} className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  'size-3.5 border border-input',
                  field.type === 'radio' ? 'rounded-full' : 'rounded-sm',
                )}
                aria-hidden
              />
              {option.label}
            </span>
          ))}
          {options.length > 4 ? (
            <span className="text-muted-foreground">+{options.length - 4} more</span>
          ) : null}
        </span>
      );
    case 'dropdown':
    case 'multi_select':
      return (
        <span className={box}>
          {field.placeholder || (field.type === 'dropdown' ? 'Choose one' : 'Choose any')}
          <SquareChevronDownIcon className="size-4" aria-hidden />
        </span>
      );
    case 'date':
      return (
        <span className={box}>
          DD/MM/YYYY <CalendarIcon className="size-4" aria-hidden />
        </span>
      );
    case 'time':
      return (
        <span className={box}>
          --:-- <ClockIcon className="size-4" aria-hidden />
        </span>
      );
    case 'consent':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="size-3.5 rounded-sm border border-input" aria-hidden />
          {field.consentText || 'I agree to the terms and conditions.'}
        </span>
      );
    default:
      return <span className={box}>{field.placeholder || ' '}</span>;
  }
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
