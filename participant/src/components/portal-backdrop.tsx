import { useEffect } from 'react';

/** Fixed illustrated backdrop for authenticated participant pages (not login). */
export function PortalBackdrop() {
  useEffect(() => {
    document.body.classList.add('portal-in');
    return () => {
      document.body.classList.remove('portal-in');
    };
  }, []);

  return <div className="bp-bg" aria-hidden="true" />;
}
