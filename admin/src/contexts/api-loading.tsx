import { useEffect, useState, type ReactNode } from 'react';
import { LoadingOverlay } from '@/components/loading-overlay';
import { setApiLoadingListener } from '@/lib/api-client';

/**
 * Tracks in-flight api-client requests and shows a full-screen blocking spinner
 * until the refcount returns to zero.
 */
export function ApiLoadingProvider({ children }: { children: ReactNode }) {
  const [inFlight, setInFlight] = useState(0);

  useEffect(() => {
    setApiLoadingListener((delta) => {
      setInFlight((n) => Math.max(0, n + delta));
    });
    return () => setApiLoadingListener(null);
  }, []);

  useEffect(() => {
    if (inFlight <= 0) return;
    document.body.setAttribute('aria-busy', 'true');
    const blockKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', blockKey, true);
    return () => {
      document.body.removeAttribute('aria-busy');
      window.removeEventListener('keydown', blockKey, true);
    };
  }, [inFlight]);

  return (
    <>
      {children}
      {inFlight > 0 ? <LoadingOverlay /> : null}
    </>
  );
}
