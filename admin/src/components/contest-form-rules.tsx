import {
  ArrowLeftIcon,
  CopyIcon,
  InfoIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { ActivityPicker } from '@/components/activity-picker';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MULTI_OPS,
  SINGLE_OPS,
  availabilityTone,
  endsBeforeClose,
  formatIst,
  isChoiceType,
  isMultiChoiceType,
  newId,
  newRule,
  type AssignmentMode,
  type AssignmentRule,
  type ContestFormQuiz,
  type FormField,
  type RuleCondition,
} from '@/lib/contest-form';
import { cn } from '@/lib/utils';

export type AssignmentValue = {
  assignmentMode: AssignmentMode;
  quizzes: ContestFormQuiz[];
  rules: AssignmentRule[];
  fallbackActivityIds: string[];
};

/** Step 2: how quizzes and assessments are given to people who register. */
export function ContestFormRules({
  value,
  fields,
  activities,
  closesAt,
  registrationCount,
  live,
  issues,
  onChange,
  onBackToFields,
}: {
  value: AssignmentValue;
  fields: FormField[];
  activities: ContestFormQuiz[];
  closesAt: string | null;
  registrationCount: number;
  live: boolean;
  issues: Record<string, string>;
  onChange: (patch: Partial<AssignmentValue>) => void;
  onBackToFields: () => void;
}) {
  const choiceFields = fields.filter((field) => !field.deleted && isChoiceType(field.type));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle id="mode-title">
            Assignment Mode <span className="text-destructive">*</span>
          </CardTitle>
          <CardDescription>
            Pick one way to give quizzes and assessments to the people who register.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            aria-labelledby="mode-title"
            value={value.assignmentMode}
            onValueChange={(mode) => {
              const next = mode as AssignmentMode;
              if (next === 'rules' && value.rules.length === 0 && choiceFields.length) {
                onChange({ assignmentMode: next, rules: [newRule()] });
              } else {
                onChange({ assignmentMode: next });
              }
            }}
            className="grid gap-3 md:grid-cols-2"
          >
            <ModeCard
              value="all"
              title="Default Assignment"
              text="Assign the quizzes and assessments you tick to every participant."
              selected={value.assignmentMode === 'all'}
            />
            <ModeCard
              value="rules"
              title="Option-based Quiz Mapping"
              text="Assign specific quizzes based on selected registration form responses."
              selected={value.assignmentMode === 'rules'}
            />
          </RadioGroup>
        </CardContent>
      </Card>

      {value.assignmentMode === 'all' ? (
        <DefaultAssignment
          activities={activities}
          selected={value.quizzes}
          closesAt={closesAt}
          onChange={(quizzes) => onChange({ quizzes })}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle>Option-based Quiz Mapping</CardTitle>
                <CardDescription>
                  Create rules using registration form fields to assign one or more quizzes. Each
                  rule stands on its own: a person gets the quizzes from <b>every</b> rule they
                  match.
                </CardDescription>
              </div>
              {choiceFields.length ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onChange({ rules: [...value.rules, newRule()] })}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add Rule
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {choiceFields.length === 0 ? (
              <>
                <Note tone="warn">
                  Rules need a choice field (Dropdown, Multiple choice, Checkboxes or Multi-select)
                  in the form. Add one in Step 1, for example “City”.
                </Note>
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={onBackToFields}
                >
                  <ArrowLeftIcon data-icon="inline-start" />
                  Add a choice field in Step 1
                </Button>
              </>
            ) : (
              <>
                {issues.rules ? (
                  <p className="text-sm text-destructive" role="alert">
                    {issues.rules}
                  </p>
                ) : null}
                {value.rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No rules yet. Add your first rule.
                  </p>
                ) : null}
                {value.rules.map((rule, index) => (
                  <div key={rule.id}>
                    {index > 0 ? (
                      <div className="flex justify-center py-1" aria-hidden>
                        <span
                          className="rounded-full border border-border bg-muted px-3 py-0.5 text-xs font-semibold text-muted-foreground"
                          title="Separate rule: anyone who matches it also gets its quizzes"
                        >
                          ALSO
                        </span>
                      </div>
                    ) : null}
                    <RuleRow
                      rule={rule}
                      index={index}
                      fields={choiceFields}
                      activities={activities}
                      closesAt={closesAt}
                      issue={issues[`rule:${rule.id}`]}
                      onChange={(next) =>
                        onChange({
                          rules: value.rules.map((item) => (item.id === rule.id ? next : item)),
                        })
                      }
                      onDuplicate={() => {
                        const copy: AssignmentRule = {
                          ...structuredClone(rule),
                          id: newId(),
                          conditions: rule.conditions.map((condition) => ({
                            ...condition,
                            id: newId(),
                          })),
                        };
                        const next = [...value.rules];
                        next.splice(index + 1, 0, copy);
                        onChange({ rules: next });
                      }}
                      onDelete={() =>
                        onChange({ rules: value.rules.filter((item) => item.id !== rule.id) })
                      }
                    />
                  </div>
                ))}
                {value.rules.length ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-dashed"
                    onClick={() => onChange({ rules: [...value.rules, newRule()] })}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Add Another Rule
                  </Button>
                ) : null}
                <div className="mt-2 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="flex gap-2">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div>
                      <p className="font-medium">Fallback Assignment</p>
                      <p className="text-sm text-muted-foreground">
                        If no rule matches, assign these. Leave empty to give nothing; they can
                        still log in.
                      </p>
                    </div>
                  </div>
                  <ActivityPicker
                    label="Fallback activities"
                    activities={activities}
                    selectedIds={value.fallbackActivityIds}
                    closesAt={closesAt}
                    onChange={(fallbackActivityIds) => onChange({ fallbackActivityIds })}
                  />
                </div>
              </>
            )}
            {live && registrationCount > 0 ? (
              <Note tone="info" icon={UsersIcon}>
                {registrationCount === 1 ? '1 person has' : `${registrationCount} people have`}{' '}
                already registered. When you save, everyone is checked against the rules again and
                gets any new activities. Activities someone has already started always stay.
              </Note>
            ) : null}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ModeCard({
  value,
  title,
  text,
  selected,
}: {
  value: string;
  title: string;
  text: string;
  selected: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-xl border p-4',
        selected ? 'border-primary bg-accent/40' : 'border-border',
      )}
    >
      <RadioGroupItem value={value} className="mt-1" />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
      </span>
    </label>
  );
}

function DefaultAssignment({
  activities,
  selected,
  closesAt,
  onChange,
}: {
  activities: ContestFormQuiz[];
  selected: ContestFormQuiz[];
  closesAt: string | null;
  onChange: (next: ContestFormQuiz[]) => void;
}) {
  const group = (kind: 'quiz' | 'assessment', title: string) => {
    const list = activities.filter((item) =>
      kind === 'assessment' ? item.kind === 'assessment' : item.kind !== 'assessment',
    );
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">None in this contest.</p>
        ) : (
          list.map((activity) => {
            const ended = activity.availability === 'Ended';
            const checked = selected.some((item) => item.id === activity.id);
            return (
              <label
                key={activity.id}
                className={cn(
                  'flex gap-3 rounded-lg border border-border p-3 text-sm',
                  ended && !checked && 'opacity-60',
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={ended && !checked}
                  onCheckedChange={(next) =>
                    onChange(
                      next === true
                        ? [...selected, activity]
                        : selected.filter((item) => item.id !== activity.id),
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{activity.name}</span>
                    <StatusPill
                      value={activity.availability}
                      tone={availabilityTone(activity.availability)}
                    />
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    {activity.startsAt ? formatIst(activity.startsAt) : 'No start'} –{' '}
                    {activity.endsAt ? formatIst(activity.endsAt) : 'No end'}
                  </span>
                  {ended ? <span className="block">Ended: can't be given.</span> : null}
                  {!ended && endsBeforeClose(activity, closesAt) ? (
                    <span className="mt-1 flex gap-1.5 text-warning">
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                      Ends {formatIst(activity.endsAt)}, before registration closes (
                      {formatIst(closesAt)}). People who register after it ends won't be able to
                      take it.
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    );
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Assignment</CardTitle>
        <CardDescription>
          Optional. You can publish now and give activities later. People already registered also
          get anything you add.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {group('quiz', 'Quizzes')}
        {group('assessment', 'Assessments')}
        {selected.length === 0 ? (
          <Note tone="muted">
            No activity yet. You can still share the link. People who register get their
            Registration ID and see “No quizzes yet. You'll get an email when one is ready.”
          </Note>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RuleRow({
  rule,
  index,
  fields,
  activities,
  closesAt,
  issue,
  onChange,
  onDuplicate,
  onDelete,
}: {
  rule: AssignmentRule;
  index: number;
  fields: FormField[];
  activities: ContestFormQuiz[];
  closesAt: string | null;
  issue?: string;
  onChange: (next: AssignmentRule) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const n = index + 1;
  function setCondition(id: string, patch: Partial<RuleCondition>) {
    onChange({
      ...rule,
      conditions: rule.conditions.map((condition) =>
        condition.id === id ? { ...condition, ...patch } : condition,
      ),
    });
  }
  return (
    <div
      data-field={`rule:${rule.id}`}
      className={cn(
        'grid gap-3 rounded-xl border p-3 lg:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:items-start',
        issue ? 'border-destructive' : 'border-border',
      )}
    >
      <span className="self-start rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">
        Rule {n}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        {rule.conditions.map((condition, conditionIndex) => {
          const field = fields.find((item) => item.id === condition.fieldId);
          const ops = field && isMultiChoiceType(field.type) ? MULTI_OPS : SINGLE_OPS;
          return (
            <div key={condition.id} className="flex flex-col gap-2">
              {conditionIndex > 0 ? (
                <button
                  type="button"
                  className="self-start rounded-full border border-primary/40 bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground"
                  title="Switch between AND and OR"
                  aria-label={`Rule ${n}: condition ${conditionIndex} joined with ${(rule.joins[conditionIndex - 1] ?? 'and').toUpperCase()}. Press to switch.`}
                  onClick={() => {
                    const joins = [...rule.joins];
                    const edge = joins[conditionIndex - 1] === 'or' ? 'and' : 'or';
                    joins[conditionIndex - 1] = edge;
                    onChange({ ...rule, joins });
                  }}
                >
                  {(rule.joins[conditionIndex - 1] ?? 'and').toUpperCase()}
                </button>
              ) : null}
              <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[2rem_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_2.75rem] sm:items-center">
                <span
                  className={cn(
                    'text-sm font-medium text-muted-foreground',
                    conditionIndex > 0 && 'hidden sm:block',
                  )}
                >
                  {conditionIndex === 0 ? 'If' : ''}
                </span>
                <Select
                  value={condition.fieldId || undefined}
                  onValueChange={(fieldId) => {
                    const next = fields.find((item) => item.id === fieldId);
                    setCondition(condition.id, {
                      fieldId,
                      optionId: '',
                      op: next && isMultiChoiceType(next.type) ? 'includes' : 'is',
                    });
                  }}
                >
                  <SelectTrigger className="w-full" aria-label={`Rule ${n} field`}>
                    <SelectValue placeholder="Choose a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label || 'Untitled field'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.op}
                  disabled={!field}
                  onValueChange={(op) =>
                    setCondition(condition.id, { op: op as RuleCondition['op'] })
                  }
                >
                  <SelectTrigger className="w-full" aria-label={`Rule ${n} comparison`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ops.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.optionId || undefined}
                  disabled={!field}
                  onValueChange={(optionId) => setCondition(condition.id, { optionId })}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label={`Rule ${n} answer`}
                    aria-invalid={Boolean(issue && field && !condition.optionId) || undefined}
                  >
                    <SelectValue placeholder="Choose an answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(field?.options ?? []).map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label || 'Untitled option'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {rule.conditions.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove condition ${conditionIndex + 1} from Rule ${n}`}
                    onClick={() => {
                      const conditions = rule.conditions.filter((item) => item.id !== condition.id);
                      const joins = [...rule.joins];
                      if (conditionIndex > 0) joins.splice(conditionIndex - 1, 1);
                      else if (joins.length > 0) joins.splice(0, 1);
                      onChange({ ...rule, conditions, joins });
                    }}
                  >
                    <XIcon />
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          className="self-start text-primary"
          onClick={() =>
            onChange({
              ...rule,
              joins: [...rule.joins, 'and'],
              conditions: [
                ...rule.conditions,
                { id: newId(), fieldId: '', op: 'is', optionId: '' },
              ],
            })
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add condition
        </Button>
        {issue ? (
          <p className="text-sm text-destructive" role="alert">
            {issue}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium">
          Then assign quizzes <span className="text-destructive">*</span>
        </span>
        <ActivityPicker
          label={`Rule ${n} activities`}
          activities={activities}
          selectedIds={rule.activityIds}
          closesAt={closesAt}
          invalid={Boolean(issue) && rule.activityIds.length === 0}
          onChange={(activityIds) => onChange({ ...rule, activityIds })}
        />
      </div>
      <div className="flex gap-1 lg:flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Duplicate Rule ${n}`}
          title="Duplicate"
          onClick={onDuplicate}
        >
          <CopyIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          aria-label={`Delete Rule ${n}`}
          title="Delete"
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}

export function Note({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'warn' | 'info' | 'muted';
  icon?: typeof InfoIcon;
  children: React.ReactNode;
}) {
  const Glyph = Icon ?? (tone === 'warn' ? TriangleAlertIcon : InfoIcon);
  return (
    <div
      className={cn(
        'flex gap-2 rounded-lg border px-3 py-2 text-sm',
        tone === 'warn' && 'border-warning/40 bg-warning/10',
        tone === 'info' && 'border-primary/30 bg-accent/50',
        tone === 'muted' && 'border-border bg-muted text-muted-foreground',
      )}
    >
      <Glyph
        className={cn('mt-0.5 size-4 shrink-0', tone === 'warn' && 'text-warning')}
        aria-hidden
      />
      <span>{children}</span>
    </div>
  );
}
