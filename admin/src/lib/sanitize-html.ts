import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'h2', 'h3'];

/** Sanitize quiz instructions HTML for storage and preview. */
export function sanitizeInstructionsHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  }).trim();
}

/** True when HTML has no visible text (empty editor / whitespace-only). */
export function isInstructionsEmpty(html: string): boolean {
  const cleaned = sanitizeInstructionsHtml(html);
  if (!cleaned) return true;
  const text = cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length === 0;
}
