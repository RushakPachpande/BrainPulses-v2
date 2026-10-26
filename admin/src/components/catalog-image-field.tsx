import { useEffect, useRef, useState } from 'react';
import { ImageIcon, UploadIcon } from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
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
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const hasImage = Boolean(preview || fileId);

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-center">
        {preview ? (
          <img
            src={preview}
            alt={alt}
            className="size-14 shrink-0 rounded-xl border border-border object-cover"
          />
        ) : fileId ? (
          <AuthImage
            fileId={fileId}
            alt={alt}
            className="size-14 shrink-0 rounded-xl border border-border"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
            <ImageIcon aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
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
              setFileName(next?.name ?? null);
              setPreview(next ? URL.createObjectURL(next) : null);
              onFile(next);
            }}
          />
        )}
      </div>
    </Field>
  );
}
