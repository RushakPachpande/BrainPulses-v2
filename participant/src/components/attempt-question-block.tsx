import { useState } from 'react';
import { StoredImage } from './stored-image';
import { IconCheck, IconStar } from './portal-icons';
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
  showMarkForReview?: boolean;
  id?: string;
  perQuestionSeconds?: number | null;
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
  showMarkForReview = true,
  id,
  perQuestionSeconds,
  onAnswer,
  onClear,
  onToggleMarked,
}: Props) {
  const singleChosen = answer && 'label' in answer ? answer.label : null;
  const multiChosen = answer && 'labels' in answer ? new Set(answer.labels) : new Set<string>();
  const numericValue =
    answer && 'value' in answer && Number.isFinite(answer.value) ? String(answer.value) : '';
  const textValue = answer && 'text' in answer ? answer.text : '';
  const multi = isMultiSelectType(q.type);
  const [zoom, setZoom] = useState<{ src: string; title: string } | null>(null);
  const [scale, setScale] = useState(1);

  function openZoom(src: string, title: string) {
    setScale(1);
    setZoom({ src, title });
  }

  return (
    <div id={id}>
      <div className="qh">
        <b>
          Question {index + 1} of {total}
        </b>
        {showMarkForReview ? (
          <button type="button" className={`rev ${marked ? 'on' : ''}`} onClick={onToggleMarked}>
            <IconStar /> {marked ? 'Marked for review' : 'Mark for review'}
          </button>
        ) : null}
      </div>
      {q.passageText ? <div className="rich-instructions">{q.passageText}</div> : null}
      {q.question.trim() ? <h2 className="qt">{q.question}</h2> : null}
      <p className="ql">
        {multi
          ? 'Multiple choice'
          : isSingleSelectType(q.type)
            ? 'Single choice'
            : instructionForType(q.type)}
        {perQuestionSeconds ? ` · ${perQuestionSeconds} sec per question` : ''}
        {q.questionImageUrl || q.options.some((option) => option.imageUrl)
          ? ' · tap a picture to enlarge'
          : ''}
      </p>
      {q.questionImageUrl ? (
        <button
          type="button"
          className="pic"
          aria-label="Enlarge picture"
          onClick={() => openZoom(q.questionImageUrl!, 'Question picture')}
        >
          <StoredImage src={q.questionImageUrl} alt="Question picture" />
        </button>
      ) : null}
      {isSingleSelectType(q.type) || multi ? (
        <div className="opts" role={multi ? 'group' : 'radiogroup'}>
          {q.options.map((option, optionIndex) => {
            const chosen = multi ? multiChosen.has(option.label) : singleChosen === option.label;
            return (
              <button
                key={option.id}
                type="button"
                className={`o ${chosen ? 'on' : ''} ${multi ? 'm' : ''} ${option.imageUrl ? 'has' : ''}`}
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={chosen}
                onClick={() => {
                  if (multi) {
                    const next = new Set(multiChosen);
                    if (next.has(option.label)) next.delete(option.label);
                    else next.add(option.label);
                    if (next.size === 0) onClear();
                    else onAnswer({ labels: [...next] });
                  } else if (chosen) {
                    onClear();
                  } else {
                    onAnswer({ label: option.label });
                  }
                }}
              >
                <b>{optionLetterAt(optionIndex)}</b>
                <span className="t">{option.body}</span>
                {option.imageUrl ? (
                  <span
                    className="th"
                    role="button"
                    tabIndex={0}
                    aria-label={`Enlarge ${option.body}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openZoom(option.imageUrl!, `Option ${optionLetterAt(optionIndex)}`);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        openZoom(option.imageUrl!, `Option ${optionLetterAt(optionIndex)}`);
                      }
                    }}
                  >
                    <StoredImage src={option.imageUrl} alt={option.body} />
                  </span>
                ) : null}
                <em>{chosen ? <IconCheck /> : null}</em>
              </button>
            );
          })}
        </div>
      ) : null}
      {q.type === 'numeric' ? (
        <label className="o">
          <b>#</b>
          <input
            className="answer-free"
            type="number"
            inputMode="decimal"
            value={numericValue}
            aria-label={`Numeric answer for question ${index + 1}`}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw.trim() === '') {
                onClear();
                return;
              }
              const num = Number(raw);
              if (!Number.isNaN(num)) onAnswer({ value: num });
            }}
          />
        </label>
      ) : null}
      {q.type === 'short_text' || q.type === 'long_text' ? (
        <textarea
          className="answer-free"
          aria-label={`Text answer for question ${index + 1}`}
          rows={q.type === 'long_text' ? 6 : 3}
          value={textValue}
          onChange={(event) => onAnswer({ text: event.target.value })}
        />
      ) : null}
      {isAnswered(answer) && (isSingleSelectType(q.type) || multi) ? null : null}
      <div className={`lbx ${zoom ? 'open' : ''}`} onClick={() => setZoom(null)}>
        <div
          className="lbc"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="lbh">
            <b>{zoom?.title ?? 'Picture'}</b>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setScale((value) => Math.max(0.5, value - 0.25))}
            >
              −
            </button>
            <em>{Math.round(scale * 100)}%</em>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setScale((value) => Math.min(3, value + 0.25))}
            >
              +
            </button>
            <button type="button" aria-label="Close" onClick={() => setZoom(null)}>
              ×
            </button>
          </div>
          <div className="lbi">
            {zoom ? (
              <StoredImage src={zoom.src} alt="" style={{ transform: `scale(${scale})` }} />
            ) : null}
          </div>
          <div className="lbf">Click outside the picture or press Esc to close</div>
        </div>
      </div>
    </div>
  );
}
