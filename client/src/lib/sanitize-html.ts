import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'h2', 'h3'];

/** Sanitize activity instructions HTML for student rendering. */
export function sanitizeInstructionsHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  }).trim();
}

export function isInstructionsEmpty(html: string | null | undefined): boolean {
  if (!html?.trim()) return true;
  const cleaned = sanitizeInstructionsHtml(html);
  if (!cleaned) return true;
  const text = cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length === 0;
}
