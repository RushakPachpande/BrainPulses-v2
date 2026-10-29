import { useEffect, useState } from 'react';

/** List container width where record panels give way to the table. */
export const RECORD_LIST_MIN_WIDTH = 720;

/**
 * True when the attached element is narrower than {@link RECORD_LIST_MIN_WIDTH}.
 * Width 0 (jsdom, hidden) stays false so the table remains the default.
 */
export function useContainerNarrow() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return;

    const update = (width: number) => {
      if (width <= 0) return;
      setNarrow(width < RECORD_LIST_MIN_WIDTH);
    };

    update(node.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      update(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { narrow, ref: setNode };
}
