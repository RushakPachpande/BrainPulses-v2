import { Check, Eraser, Flag } from 'lucide-react';
import { StoredImage } from './stored-image';
import {
  instructionForType,
  isAnswered,
  isMultiSelectType,
  isSingleSelectType,
  optionLetterAt,
  type AttemptAnswerValue,
} from '../lib/attempt-answers';
import type { AttemptQuestion } from '../services/types';

type Props = {
  question: AttemptQuestion;
  index: number;
  total: number;
  answer: AttemptAnswerValue | undefined;
  marked: boolean;
  showTopline?: boolean;
  id?: string;
  onAnswer: (answer: AttemptAnswerValue) => void;
  onClear: () => void;
  onToggleMarked: () => void;
};

export function AttemptQuestionBlock({
  question: q,
  index,
  total,
  answer,
  marked,
  showTopline = true,
  id,
  onAnswer,
  onClear,
  onToggleMarked,
}: Props) {
  const singleChosen = answer && 'label' in answer ? answer.label : null;
  const multiChosen = answer && 'labels' in answer ? new Set(answer.labels) : new Set<string>();
  const numericValue =
    answer && 'value' in answer && Number.isFinite(answer.value) ? String(answer.value) : '';
  const textValue = answer && 'text' in answer ? answer.text : '';
  const isChoice = isSingleSelectType(q.type) || isMultiSelectType(q.type);

  return (
    <div id={id} className="attempt-question-block">
      {showTopline ? (
        <div className="question-topline">
          <span>
            QUESTION {String(index + 1).padStart(2, '0')}{' '}
            <span className="question-total">/ {String(total).padStart(2, '0')}</span>
          </span>
          {marked ? (
            <span className="review-chip">
              <Flag size={13} aria-hidden /> Marked for review
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="question-card">
        <div className="question-context">ASSESSMENT QUESTION</div>
        {q.passageText ? <div className="question-passage">{q.passageText}</div> : null}
        {q.questionImageUrl ? (
          <StoredImage src={q.questionImageUrl} alt="" className="question-stem-image" />
        ) : null}
        <h2 className="question-stem">{q.question}</h2>
        <p className="question-instruction">{instructionForType(q.type)}</p>

        {isSingleSelectType(q.type) || isMultiSelectType(q.type) ? (
          <div className="option-list">
            {q.options.map((op, optionIndex) => {
              const chosen = isMultiSelectType(q.type)
                ? multiChosen.has(op.label)
                : singleChosen === op.label;
              return (
                <button
                  key={op.id}
                  type="button"
                  className={`answer-option ${chosen ? 'chosen' : ''}`}
                  onClick={() => {
                    if (isMultiSelectType(q.type)) {
                      const next = new Set(multiChosen);
                      if (next.has(op.label)) next.delete(op.label);
                      else next.add(op.label);
                      onAnswer({ labels: [...next] });
                    } else {
                      onAnswer({ label: op.label });
                    }
                  }}
                >
                  <span className="option-letter">{optionLetterAt(optionIndex)}</span>
                  <span className="option-body">
                    {op.imageUrl ? (
                      <StoredImage src={op.imageUrl} alt="" className="option-image" />
                    ) : null}
                    <span>{op.body}</span>
                  </span>
                  {chosen && <Check size={17} className="option-check" />}
                </button>
              );
            })}
          </div>
        ) : null}

        {q.type === 'numeric' ? (
          <div className="option-list">
            <label className="answer-option answer-option-input">
              <span className="option-letter">#</span>
              <input
                type="number"
                inputMode="decimal"
                value={numericValue}
                aria-label={`Numeric answer for question ${index + 1}`}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.trim() === '') {
                    onClear();
                    return;
                  }
                  const num = Number(raw);
                  if (!Number.isNaN(num)) onAnswer({ value: num });
                }}
              />
            </label>
          </div>
        ) : null}

        {q.type === 'short_text' || q.type === 'long_text' ? (
          <div className="option-list">
            <textarea
              aria-label={`Text answer for question ${index + 1}`}
              rows={q.type === 'long_text' ? 6 : 3}
              value={textValue}
              className={`answer-textarea ${q.type === 'long_text' ? 'long' : 'short'}`}
              onChange={(e) => onAnswer({ text: e.target.value })}
            />
          </div>
        ) : null}
      </div>
      <div className="question-actions">
        <button
          className={`btn outline review-toggle ${marked ? 'is-marked' : ''}`}
          type="button"
          aria-pressed={marked}
          onClick={onToggleMarked}
        >
          <Flag size={15} aria-hidden />
          {marked ? 'Unmark review' : 'Mark for review'}
        </button>
        {isChoice ? (
          <button
            className="btn outline"
            type="button"
            disabled={!isAnswered(answer)}
            onClick={onClear}
          >
            <Eraser size={15} aria-hidden /> Clear selection
          </button>
        ) : null}
      </div>
    </div>
  );
}
