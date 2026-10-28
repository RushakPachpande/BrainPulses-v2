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
  const statusLabel = fileName ?? (fileId ? 'Current image' : 'No image chosen');

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-border/70 bg-card',
          compact ? 'flex flex-col' : 'flex flex-col md:flex-row md:items-stretch',
        )}
      >
        <div
          className={cn(
            'relative min-w-0',
            compact ? 'w-full' : 'w-full md:w-64 md:shrink-0',
          )}
          style={compact ? undefined : { maxWidth: `min(100%, ${frameMaxWidth}px)` }}
        >
          <AspectRatio
            ratio={compact && !hasImage ? 16 / 9 : frameRatio}
            className={cn(
              'bg-muted transition-colors',
              !hasImage && 'border-b border-dashed border-border md:border-b-0 md:border-r',
              compact && !hasImage && 'border-b border-dashed border-border',
              dragging && 'bg-accent',
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
                <ImageIcon aria-hidden className="size-5" />
              </div>
            ) : (
              <button
                type="button"
                aria-label={`Choose ${label.toLowerCase()} file`}
                className="flex size-full cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground outline-none transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => inputRef.current?.click()}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-background ring-1 ring-border">
                  <UploadIcon aria-hidden className="size-4" />
                </span>
                <span className="text-sm font-medium text-foreground">
                  {dragging ? 'Drop to upload' : 'Click or drop an image'}
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPEG, or WebP · {formatUploadMegabytes(UPLOAD_IMAGE_SIZE_CAPPING)} max
                </span>
              </button>
            )}
          </AspectRatio>
          {!disabled && hasImage && onClear ? (
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="absolute top-1.5 right-1.5 size-9! h-9! max-h-9! min-h-9! w-9! min-w-9! border-border/50 bg-background/65 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/85 hover:text-foreground"
              aria-label="Clear image"
              onClick={clear}
            >
              <XIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col justify-center gap-2.5 p-3',
            !compact && 'md:gap-3 md:p-4',
          )}
        >
          {hasImage || disabled ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{statusLabel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                PNG, JPEG, or WebP · {formatUploadMegabytes(UPLOAD_IMAGE_SIZE_CAPPING)} max
              </p>
            </div>
          ) : null}

          {disabled ? null : (
            <div
              className={cn(
                'grid gap-2',
                onPickExisting ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
              )}
            >
              <Button
                type="button"
                variant={hasImage ? 'outline' : 'default'}
                className="w-full justify-center"
                onClick={() => inputRef.current?.click()}
              >
                <UploadIcon data-icon="inline-start" />
                {hasImage ? 'Upload new' : 'Upload image'}
              </Button>
              {onPickExisting ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => setLibraryOpen(true)}
                >
                  <ImagesIcon data-icon="inline-start" />
                  From library
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
