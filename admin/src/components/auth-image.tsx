import { useEffect, useState } from 'react';
import { apiGetBlob } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function AuthImage({
  fileId,
  alt,
  className,
}: {
  fileId: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    void apiGetBlob(`/api/files/${fileId}`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (failed) {
    return <span className="text-xs text-muted-foreground">Image unavailable</span>;
  }

  if (!src) {
    return (
      <span
        className={cn('inline-block size-10 animate-pulse rounded-md bg-muted', className)}
        aria-hidden
      />
    );
  }

  return <img src={src} alt={alt} className={cn('size-10 rounded-md object-cover', className)} />;
}
