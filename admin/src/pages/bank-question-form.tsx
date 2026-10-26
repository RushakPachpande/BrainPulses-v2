import { Loader2Icon } from 'lucide-react';
import { QuestionImageField, QuestionImagePreview } from '@/components/question-image-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { BankQuestionItem } from '@/services';
import {
  emptyDraft,
  emptyOptions,
  trueFalseOptions,
  type OptionDraft,
  type QuestionDraft,
} from './bank-question-draft';
import {
  bankQuestionTypeLabel,
  supportsChoiceMedia,
  typesForKind,
  type BankAuthorType,
  type BankKind,
} from './bank-question-types';

function OptionRows({
  options,
  multi,
  showImageUrl,
  readOnly,
  onChange,
}: {
  options: OptionDraft[];
  multi: boolean;
  showImageUrl: boolean;
  readOnly: boolean;
  onChange: (next: OptionDraft[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt, oi) => (
        <div key={opt.label} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {readOnly ? (
              <span className="text-sm font-medium">
                {opt.label}
                {opt.isCorrect ? (
                  <span className="ml-2 text-xs font-medium text-success">Correct</span>
                ) : null}
              </span>
            ) : (
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <Checkbox
                  checked={opt.isCorrect}
                  onCheckedChange={(value) => {
                    const checked = value === true;
                    onChange(
                      options.map((o, i) => {
                        if (multi) {
                          return i === oi ? { ...o, isCorrect: checked } : o;
                        }
                        return { ...o, isCorrect: i === oi ? checked : false };
                      }),
                    );
                  }}
                  aria-label={`Mark option ${opt.label} as correct`}
                />
                {opt.label}
              </label>
            )}
            <Input
              value={opt.body}
              placeholder={`Option ${opt.label}`}
              disabled={readOnly}
              onChange={(e) => {
                const value = e.target.value;
                onChange(options.map((o, i) => (i === oi ? { ...o, body: value } : o)));
              }}
            />
          </div>
          {showImageUrl ? (
            <QuestionImageField
              id={`bank-q-option-image-${opt.label}`}
              value={opt.imageUrl}
              placeholder="Image URL"
              alt="Answer image"
              disabled={readOnly}
              onChange={(value) =>
                onChange(options.map((o, i) => (i === oi ? { ...o, imageUrl: value } : o)))
              }
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function BankQuestionDialog({
  open,
  mode,
  draft,
  saving,
  kind = 'assessment',
  onOpenChange,
  onDraftChange,
  onSave,
}: {
  open: boolean;
  mode: 'add' | 'edit' | 'view';
  draft: QuestionDraft;
  saving: boolean;
  kind?: BankKind;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: QuestionDraft) => void;
  onSave: () => void;
}) {
  const readOnly = mode === 'view';
  const title =
    mode === 'add' ? 'Add question' : mode === 'edit' ? 'Edit question' : 'View question';
  const typeOptions = typesForKind(kind);
  const quizLocked = kind === 'quiz';
  const showMedia = supportsChoiceMedia(draft.type);

  function setType(type: BankAuthorType) {
    const next = emptyDraft(type);
    onDraftChange({
      ...next,
      question: draft.question,
      points: draft.points,
      questionImageUrl: draft.questionImageUrl,
      passageText: type === 'comprehension_mcq' ? draft.passageText : '',
    });
  }

  const showOptions =
    draft.type === 'single_mcq' ||
    draft.type === 'multiple_mcq' ||
    draft.type === 'true_false' ||
    draft.type === 'image_mcq' ||
    draft.type === 'image_selection' ||
    draft.type === 'comprehension_mcq';

  const multi = draft.type === 'multiple_mcq' || draft.type === 'image_selection';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? bankQuestionTypeLabel(draft.type)
              : quizLocked
                ? 'Single choice only. Options may be text, an image URL, or both.'
                : 'Choose a type, then fill in the question and answers.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!quizLocked ? (
            <Field>
              <FieldLabel htmlFor="bank-q-type">Type</FieldLabel>
              {readOnly ? (
                <Input id="bank-q-type" value={bankQuestionTypeLabel(draft.type)} disabled />
              ) : (
                <Select value={draft.type} onValueChange={(v) => setType(v as BankAuthorType)}>
                  <SelectTrigger id="bank-q-type" className="w-full" aria-label="Question type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          ) : null}

          {draft.type === 'comprehension_mcq' ? (
            <Field>
              <FieldLabel htmlFor="bank-q-passage">
                Passage <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="bank-q-passage"
                value={draft.passageText}
                disabled={readOnly}
                rows={5}
                onChange={(e) => onDraftChange({ ...draft, passageText: e.target.value })}
              />
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="bank-q-question">
              Question <span className="text-destructive">*</span>
            </FieldLabel>
            <Textarea
              id="bank-q-question"
              value={draft.question}
              disabled={readOnly}
              rows={3}
              onChange={(e) => onDraftChange({ ...draft, question: e.target.value })}
            />
          </Field>

          {showMedia ? (
            <Field>
              <FieldLabel htmlFor="bank-q-question-image">Question image (optional)</FieldLabel>
              <QuestionImageField
                id="bank-q-question-image"
                value={draft.questionImageUrl}
                disabled={readOnly}
                placeholder="https://…"
                onChange={(questionImageUrl) => onDraftChange({ ...draft, questionImageUrl })}
              />
            </Field>
          ) : null}

          <Field className="max-w-40">
            <FieldLabel htmlFor="bank-q-points">Points</FieldLabel>
            <Input
              id="bank-q-points"
              type="number"
              min={1}
              step={1}
              value={draft.points}
              disabled={readOnly}
              onChange={(e) =>
                onDraftChange({ ...draft, points: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </Field>

          {draft.type === 'numeric' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="bank-q-num">
                  Correct value <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="bank-q-num"
                  type="number"
                  value={draft.referenceValue}
                  disabled={readOnly}
                  onChange={(e) => onDraftChange({ ...draft, referenceValue: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bank-q-tol">Tolerance</FieldLabel>
                <Input
                  id="bank-q-tol"
                  type="number"
                  min={0}
                  step="any"
                  value={draft.numericTolerance}
                  disabled={readOnly}
                  onChange={(e) => onDraftChange({ ...draft, numericTolerance: e.target.value })}
                />
              </Field>
            </div>
          ) : null}

          {draft.type === 'short_text' || draft.type === 'long_text' ? (
            <Field>
              <FieldLabel htmlFor="bank-q-ref">
                Reference answer {draft.type === 'short_text' ? '(optional)' : '(optional)'}
              </FieldLabel>
              {draft.type === 'long_text' ? (
                <Textarea
                  id="bank-q-ref"
                  value={draft.referenceValue}
                  disabled={readOnly}
                  rows={4}
                  onChange={(e) => onDraftChange({ ...draft, referenceValue: e.target.value })}
                />
              ) : (
                <Input
                  id="bank-q-ref"
                  value={draft.referenceValue}
                  disabled={readOnly}
                  onChange={(e) => onDraftChange({ ...draft, referenceValue: e.target.value })}
                />
              )}
              <p className="text-xs text-muted-foreground">
                When set, answers are scored by case-insensitive exact match. When empty, the
                question is excluded from the auto score.
              </p>
            </Field>
          ) : null}

          {showOptions ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Options</p>
              {!readOnly && showMedia ? (
                <p className="text-xs text-muted-foreground">
                  Each option needs text, an image URL, or both.
                  {multi ? ' Mark at least one correct.' : ' Mark exactly one correct.'}
                </p>
              ) : null}
              <OptionRows
                options={draft.options}
                multi={multi}
                showImageUrl={showMedia}
                readOnly={readOnly}
                onChange={(options) => onDraftChange({ ...draft, options })}
              />
              {!readOnly && draft.type !== 'true_false' && draft.options.length < 6 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const nextLabel =
                      ['A', 'B', 'C', 'D', 'E', 'F'][draft.options.length] ??
                      String(draft.options.length + 1);
                    onDraftChange({
                      ...draft,
                      options: [
                        ...draft.options,
                        { label: nextLabel, body: '', isCorrect: false, imageUrl: '' },
                      ],
                    });
                  }}
                >
                  Add option
                </Button>
              ) : null}
              {!readOnly && draft.type === 'true_false' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => onDraftChange({ ...draft, options: trueFalseOptions() })}
                >
                  Reset True / False
                </Button>
              ) : null}
              {!readOnly &&
              (draft.type === 'single_mcq' || draft.type === 'image_mcq') &&
              draft.options.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onDraftChange({ ...draft, options: emptyOptions(4) })}
                >
                  Add options
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly ? (
            <Button type="button" disabled={saving} aria-busy={saving} onClick={onSave}>
              {saving ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save question'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BankQuestionReadOnlySummary({ item }: { item: BankQuestionItem }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-medium">{item.question}</p>
      {item.questionImageUrl ? (
        <QuestionImagePreview src={item.questionImageUrl} alt="Question image" />
      ) : null}
      {item.passageText ? (
        <p className="whitespace-pre-wrap text-muted-foreground">{item.passageText}</p>
      ) : null}
      <ul className="space-y-1">
        {(item.options ?? []).map((o) => (
          <li key={o.label} className="flex flex-col gap-1">
            <span>
              <span className="font-medium">{o.label}.</span> {o.body}
              {o.isCorrect ? (
                <span className="ml-2 text-xs font-medium text-success">Correct</span>
              ) : null}
            </span>
            {o.imageUrl ? <QuestionImagePreview src={o.imageUrl} alt="Answer image" /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
