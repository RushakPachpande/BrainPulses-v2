import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { ImageIcon, ImagesIcon, UploadIcon, XIcon } from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { ImageLibraryDialog } from '@/components/image-library-dialog';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { UPLOAD_IMAGE_SIZE_CAPPING, formatUploadMegabytes } from '@/lib/upload-limits';
import { cn } from '@/lib/utils';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPT_ATTR = 'image/png,image/jpeg,image/webp';
const FORMAT_HINT = `PNG, JPEG, or WebP · ${formatUploadMegabytes(UPLOAD_IMAGE_SIZE_CAPPING)} max`;

export function CatalogImageField({
  id,
  label,
  fileId,
  alt,
  disabled,
  required,
  onFile,
  onPickExisting,
  onClear,
  compact = false,
}: {
  id: string;
  label: string;
  fileId: string;
  alt: string;
  disabled: boolean;
  required: boolean;
  onFile: (file: File | null) => void;
  onPickExisting?: (fileId: string) => void;
  onClear?: () => void;
  /** Stack preview + actions for dialogs and narrow viewports. */
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const statusId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  function choose(next: File | null) {
    setFile(next);
    onFile(next);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = '';
    choose(null);
    onClear?.();
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (!dropped || !ACCEPTED_TYPES.includes(dropped.type)) return;
    if (inputRef.current) inputRef.current.files = event.dataTransfer.files;
    choose(dropped);
  }

  const dropHandlers = disabled
    ? {}
    : {
        onDragOver: (event: DragEvent<HTMLElement>) => {
          event.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop,
      };

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
  const statusLabel = fileName ?? (fileId ? 'Image selected' : 'No image yet');

  function openFilePicker() {
    inputRef.current?.click();
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>

      <div
        className={cn(
          'overflow-hidden rounded-xl border border-border bg-card',
          dragging && 'border-primary ring-2 ring-primary/20',
        )}
      >
        <div className={cn('relative', compact ? 'max-w-full' : 'mx-auto w-full max-w-xl')}>
          <AspectRatio
            ratio={16 / 9}
            className={cn(
              'bg-muted transition-colors',
              !hasImage && 'border-b border-dashed border-border',
              dragging && 'bg-accent',
            )}
            {...dropHandlers}
          >
            {preview ? (
              <img src={preview} alt={alt} className="size-full object-contain p-2" />
            ) : fileId ? (
              <AuthImage
                fileId={fileId}
                alt={alt}
                className="size-full rounded-none object-contain p-2"
              />
            ) : disabled ? (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <span className="flex size-11 items-center justify-center rounded-full bg-background ring-1 ring-border">
                  <ImageIcon aria-hidden className="size-5" />
                </span>
                <span className="text-sm">No image</span>
              </div>
            ) : (
              <button
                type="button"
                aria-label={`Choose ${label.toLowerCase()} file`}
                aria-describedby={statusId}
                className="flex size-full cursor-pointer flex-col items-center justify-center gap-3 px-4 py-6 text-center outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={openFilePicker}
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-background text-primary ring-1 ring-border">
                  <UploadIcon aria-hidden className="size-5" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {dragging ? 'Drop to upload' : 'Drop an image here, or click to browse'}
                  </span>
                  <span className="text-xs text-muted-foreground">{FORMAT_HINT}</span>
                </span>
              </button>
            )}
          </AspectRatio>

          {!disabled && hasImage && onClear ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2.5 right-2.5 border border-border bg-background text-foreground shadow-sm"
              aria-label="Remove image"
              onClick={clear}
            >
              <XIcon className="size-4" />
            </Button>
          ) : null}
        </div>

        <div
          className={cn(
            'flex flex-col gap-3 border-t border-border bg-muted/40 px-3.5 py-3',
            !compact && 'sm:flex-row sm:items-center sm:justify-between sm:gap-4',
          )}
        >
          <div className="min-w-0" id={statusId} aria-live="polite">
            <p className="truncate text-sm font-medium text-foreground">{statusLabel}</p>
            <FieldDescription className="mt-0.5">{FORMAT_HINT}</FieldDescription>
          </div>

          {disabled ? null : (
            <div
              className={cn(
                'grid shrink-0 gap-2',
                onPickExisting ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
                !compact && onPickExisting && 'sm:w-auto sm:min-w-[280px]',
              )}
            >
              <Button
                type="button"
                variant={hasImage ? 'outline' : 'default'}
                className="w-full justify-center"
                onClick={openFilePicker}
              >
                <UploadIcon data-icon="inline-start" />
                {hasImage ? 'Replace' : 'Upload'}
              </Button>
              {onPickExisting ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => setLibraryOpen(true)}
                >
                  <ImagesIcon data-icon="inline-start" />
                  Library
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {disabled ? null : (
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPT_ATTR}
            required={required && !fileId}
            className="sr-only"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
        )}
        {!disabled && onPickExisting ? (
          <ImageLibraryDialog
            open={libraryOpen}
            onOpenChange={setLibraryOpen}
            purpose="catalog"
            selectedFileId={file ? undefined : fileId || undefined}
            onSelect={(nextId) => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = '';
              onPickExisting(nextId);
            }}
          />
        ) : null}
      </div>
    </Field>
  );
}
