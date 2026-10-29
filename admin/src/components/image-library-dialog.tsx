import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AlertCircleIcon, SearchIcon } from 'lucide-react';
import { AuthImage } from '@/components/auth-image';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useOrgId } from '@/hooks/use-org-id';
import { ApiError } from '@/lib/api-client';
import { adminQueryKeys } from '@/lib/query-keys';
import { getImageLibraryPage, type ImageLibraryPurpose } from '@/services';

const PAGE_SIZE = 24;
const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4';

function LibraryBody({
  purpose,
  selectedFileId,
  onCancel,
  onSelect,
}: {
  purpose: ImageLibraryPurpose;
  selectedFileId?: string;
  onCancel: () => void;
  onSelect: (fileId: string) => void;
}) {
  const orgId = useOrgId();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const [selected, setSelected] = useState(selectedFileId ?? '');

  const query = useInfiniteQuery({
    queryKey: adminQueryKeys.imageLibrary(orgId, purpose, q),
    queryFn: ({ pageParam }) =>
      getImageLibraryPage({ purpose, q, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
    staleTime: 30_000,
  });
  const images = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder="Search by file name"
          aria-label="Search images by file name"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </InputGroup>
      <div className="max-h-[55dvh] min-w-0 overflow-y-auto p-1">
        {query.isPending ? (
          <div className={GRID} aria-busy="true" aria-label="Loading images">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="aspect-video w-full rounded-lg" />
            ))}
          </div>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>
              {query.error instanceof ApiError ? query.error.message : 'Could not load images.'}
            </AlertDescription>
          </Alert>
        ) : images.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {q ? 'No images match your search.' : 'No images uploaded yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <RadioGroup
              value={selected}
              onValueChange={setSelected}
              aria-label="Uploaded images"
              className={GRID}
            >
              {images.map((image) => {
                const itemId = `library-image-${image.id}`;
                return (
                  <FieldLabel key={image.id} htmlFor={itemId} className="min-w-0">
                    <Field className="min-w-0 gap-2">
                      <AspectRatio
                        ratio={16 / 9}
                        className="overflow-hidden rounded-md border border-border bg-muted"
                      >
                        <AuthImage
                          fileId={image.id}
                          alt=""
                          className="size-full rounded-none object-contain"
                        />
                      </AspectRatio>
                      <div className="flex min-w-0 items-center gap-2">
                        <RadioGroupItem id={itemId} value={image.id} />
                        <span className="truncate text-xs font-medium" title={image.originalName}>
                          {image.originalName}
                        </span>
                      </div>
                    </Field>
                  </FieldLabel>
                );
              })}
            </RadioGroup>
            {query.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                className="self-center"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            ) : null}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={!selected} onClick={() => onSelect(selected)}>
          Use image
        </Button>
      </DialogFooter>
    </>
  );
}

export function ImageLibraryDialog({
  open,
  onOpenChange,
  purpose,
  selectedFileId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purpose: ImageLibraryPurpose;
  selectedFileId?: string;
  onSelect: (fileId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* React bubbles portal events to the host form; keep search typing out of its onChange. */}
      <DialogContent className="sm:max-w-3xl" onChange={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Choose an existing image</DialogTitle>
          <DialogDescription>
            Reuse an image already uploaded in this organization instead of uploading it again.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <LibraryBody
            purpose={purpose}
            selectedFileId={selectedFileId}
            onCancel={() => onOpenChange(false)}
            onSelect={(fileId) => {
              onSelect(fileId);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
