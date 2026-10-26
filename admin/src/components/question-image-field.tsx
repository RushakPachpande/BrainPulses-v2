import { useRef, useState } from 'react';
import { UploadIcon } from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { QA_UPLOAD_IMAGE_SIZE_CAPPING, formatUploadMegabytes } from '@/lib/upload-limits';
import { uploadQuestionImage } from '@/services';

const FILE_IMAGE = /^\/api\/files\/([0-9a-f-]{36})$/i;

export function QuestionImagePreview({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const fileId = src.match(FILE_IMAGE)?.[1];
  return (
    <div className={cn('w-full max-w-md', className)}>
      <AspectRatio
        ratio={16 / 9}
        className="overflow-hidden rounded-md border border-border bg-muted"
      >
        {fileId ? (
          <AuthImage fileId={fileId} alt={alt} className="size-full object-contain" />
        ) : (
          <img src={src} alt={alt} className="size-full object-contain" />
        )}
      </AspectRatio>
    </div>
  );
}

export function QuestionImageField({
  id,
  value,
  onChange,
  disabled,
  placeholder = 'Image URL',
  alt = 'Question image',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  alt?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const fileId = await uploadQuestionImage(file);
      onChange(`/api/files/${fileId}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Question and answer images must be ${formatUploadMegabytes(QA_UPLOAD_IMAGE_SIZE_CAPPING)} or smaller.`,
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled || uploading}
        onChange={(event) => {
          setError('');
          onChange(event.target.value);
        }}
      />
      {disabled ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            {uploading ? 'Uploading…' : 'Upload image'}
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, WebP, or GIF. {formatUploadMegabytes(QA_UPLOAD_IMAGE_SIZE_CAPPING)} maximum.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            aria-label="Upload question or answer image"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </div>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {value ? <QuestionImagePreview src={value} alt={alt} /> : null}
    </div>
  );
}
