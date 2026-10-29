import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { apiGetBlob } from '../lib/api-client';

const FILE_IMAGE = /^\/api\/files\/[0-9a-f-]{36}$/i;

export function StoredImage({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  const authed = FILE_IMAGE.test(src);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!authed) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setBlobUrl(null);
    setFailed(false);
    void apiGetBlob(src)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [authed, src]);

  if (authed && failed) return null;
  const resolved = authed ? blobUrl : src;
  if (!resolved) return null;
  return <img src={resolved} alt={alt} className={className} style={style} />;
}
