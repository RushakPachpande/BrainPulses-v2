import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { ImageIcon, UploadIcon } from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { UPLOAD_IMAGE_SIZE_CAPPING, formatUploadMegabytes } from '@/lib/upload-limits';

export function CatalogImageField({
  id,
  label,
  fileId,
  alt,
  disabled,
  required,
  onFile,
}: {
  id: string;
  label: string;
  fileId: string;
  alt: string;
  disabled: boolean;
  required: boolean;
  onFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ratio, setRatio] = useState(16 / 9);

  function rememberRatio(image: HTMLImageElement) {
    const { naturalWidth, naturalHeight } = image;
    if (naturalWidth > 0 && naturalHeight > 0) setRatio(naturalWidth / naturalHeight);
  }

  function onPreviewLoad(event: SyntheticEvent<HTMLImageElement>) {
    rememberRatio(event.currentTarget);
  }

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [file]);

  const hasImage = Boolean(file || fileId);
  const fileName = file?.name ?? null;
  const frameRatio = hasImage ? ratio : 16 / 9;
  const frameMaxWidth = Math.min(320, 180 * frameRatio);

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/70 p-4">
        <div className="w-full" style={{ maxWidth: `min(100%, ${frameMaxWidth}px)` }}>
          <AspectRatio
            ratio={frameRatio}
            className="overflow-hidden rounded-xl border border-border bg-muted"
          >
            {preview ? (
              <img
                src={preview}
                alt={alt}
                className="size-full object-contain"
                onLoad={onPreviewLoad}
              />
            ) : fileId ? (
              <AuthImage
                fileId={fileId}
                alt={alt}
                className="size-full rounded-none object-contain"
                onLoad={rememberRatio}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon aria-hidden />
              </div>
            )}
          </AspectRatio>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {fileName ?? (fileId ? 'Current image' : 'No image chosen')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPEG, or WebP. {formatUploadMegabytes(UPLOAD_IMAGE_SIZE_CAPPING)} maximum.
            </p>
          </div>
          {disabled ? null : (
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              <UploadIcon data-icon="inline-start" />
              {hasImage ? 'Change' : 'Choose image'}
            </Button>
          )}
        </div>
        {disabled ? null : (
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required={required && !fileId}
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              onFile(next);
            }}
          />
        )}
      </div>
    </Field>
  );
}
