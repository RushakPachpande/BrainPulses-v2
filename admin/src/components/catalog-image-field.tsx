import { useEffect, useRef, useState, type DragEvent, type SyntheticEvent } from 'react';
import { ImageIcon, ImagesIcon, UploadIcon, XIcon } from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { ImageLibraryDialog } from '@/components/image-library-dialog';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { UPLOAD_IMAGE_SIZE_CAPPING, formatUploadMegabytes } from '@/lib/upload-limits';
import { cn } from 'cn';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

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
  const [file, setFile] = useState<File | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [ratio, setRatio] = useState(16 / 9);

  function rememberRatio(image: HTMLImageElement) {
    const { naturalWidth, naturalHeight } = image;
    if (naturalWidth > 0 && naturalHeight > 0) setRatio(naturalWidth / naturalHeight);
  }

  function onPreviewLoad(event: SyntheticEvent<HTMLImageElement>) {
    rememberRatio(event.currentTarget);
  }

  function choose(next: File | null) {
    setFile(next);
    onFile(next);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = '';
    setRatio(16 / 9);
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
  const frameRatio = hasImage ? ratio : 16 / 9;
  const frameMaxWidth = Math.min(320, 180 * frameRatio);

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      <div
        className={cn(
          'flex min-w-0 flex-col gap-3 rounded-lg border border-border/70 p-3 sm:p-4',
          !compact && 'md:flex-row md:items-center md:gap-6',
        )}
      >
        <div
          className={cn('w-full', !compact && 'md:w-64 md:shrink-0')}
          style={{ maxWidth: compact ? '100%' : `min(100%, ${frameMaxWidth}px)` }}
        >
          <AspectRatio
            ratio={frameRatio}
            className={cn(
              'overflow-hidden rounded-xl border border-border bg-muted transition-colors',
              !hasImage && (compact ? 'border-dashed' : 'md:border-dashed'),
              dragging && 'border-primary bg-accent',
            )}
            {...dropHandlers}
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
            ) : disabled ? (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon aria-hidden />
              </div>
            ) : (
              <button
                type="button"
                aria-label={`Choose ${label.toLowerCase()} file`}
                className="flex size-full cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground transition-colors outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => inputRef.current?.click()}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-background ring-1 ring-border">
                  <UploadIcon aria-hidden className="size-4" />
                </span>
                <span
                  className={cn(
                    'text-sm font-medium text-foreground',
                    !compact && 'hidden md:block',
                  )}
                >
                  {dragging ? 'Drop to upload' : 'Click or drop an image'}
                </span>
              </button>
            )}
          </AspectRatio>
        </div>
        <div
          className={cn(
            'flex min-w-0 flex-col gap-3',
            compact
              ? 'sm:flex-row sm:items-center sm:justify-between'
              : 'sm:flex-row sm:items-center sm:justify-between md:flex-1 md:flex-col md:items-start md:justify-center',
          )}
        >
          <div className="min-w-0 max-w-full">
            <p className="truncate text-sm font-medium">
              {fileName ?? (fileId ? 'Current image' : 'No image chosen')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPEG, or WebP. {formatUploadMegabytes(UPLOAD_IMAGE_SIZE_CAPPING)} maximum.
            </p>
          </div>
          {disabled ? null : (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                className="min-w-0 flex-1 sm:flex-none"
                onClick={() => inputRef.current?.click()}
              >
                <UploadIcon data-icon="inline-start" />
                {hasImage ? 'Change' : 'Choose image'}
              </Button>
              {onPickExisting ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 flex-1 sm:flex-none"
                  onClick={() => setLibraryOpen(true)}
                >
                  <ImagesIcon data-icon="inline-start" />
                  Choose existing
                </Button>
              ) : null}
              {hasImage && onClear ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-w-0 sm:flex-none"
                  onClick={clear}
                >
                  <XIcon data-icon="inline-start" />
                  Clear
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
            accept="image/png,image/jpeg,image/webp"
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
