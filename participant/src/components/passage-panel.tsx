import { IconBook } from './portal-icons';
import { passageHintLabel } from '../lib/passage-range';
import { isInstructionsEmpty, sanitizeInstructionsHtml } from '../lib/sanitize-html';

type PassagePanelProps = {
  text: string;
  range?: { start: number; end: number } | null;
  className?: string;
};

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function PassageBody({ text }: { text: string }) {
  const trimmed = text.trim();
  if (looksLikeHtml(trimmed) && !isInstructionsEmpty(trimmed)) {
    return (
      <div
        className="qpassage-body rich-instructions"
        dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(trimmed) }}
      />
    );
  }
  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return <div className="qpassage-body rich-instructions">{trimmed}</div>;
  }
  return (
    <div className="qpassage-body rich-instructions">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

export function PassagePanel({ text, range = null, className }: PassagePanelProps) {
  if (!text.trim()) return null;
  const hint = passageHintLabel(range);
  return (
    <aside className={['qpassage', className].filter(Boolean).join(' ')} aria-label="Passage">
      <header className="qpassage-head">
        <h2 className="qpassage-title">
          <IconBook size={18} />
          Passage
        </h2>
        <p className="qpassage-hint">{hint}</p>
      </header>
      <PassageBody text={text} />
    </aside>
  );
}
