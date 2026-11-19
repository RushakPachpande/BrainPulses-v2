import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrophyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CatalogImageField } from '@/components/catalog-image-field';
import { FormDialog } from '@/components/form-dialog';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/components/use-confirm';
import { useApplyServerRecord } from '@/hooks/use-apply-server-record';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { useOrgId } from '@/hooks/use-org-id';
import { ApiError } from '@/lib/api-client';
import { adminQueryKeys } from '@/lib/query-keys';
import {
  createContest,
  getContest,
  getSponsors,
  updateContest,
  uploadCatalogImage,
} from '@/services';

export function ContestEditorDialog({
  mode,
  contestId,
  onOpenChange,
  onSaved,
}: {
  mode: 'create' | 'edit';
  contestId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const formId = useId();
  const confirm = useConfirm();
  const orgId = useOrgId();
  const closeRef = useRef(onOpenChange);
  closeRef.current = onOpenChange;
  const [sponsorId, setSponsorId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFileId, setImageFileId] = useState('');
  const [initialImageFileId, setInitialImageFileId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);

  const sponsorsQuery = useQuery({
    queryKey: adminQueryKeys.sponsors(orgId),
    queryFn: ({ signal }) => getSponsors(signal),
    enabled: Boolean(orgId),
  });
  const sponsors = sponsorsQuery.data ?? [];
  const contestQuery = useQuery({
    queryKey: adminQueryKeys.contest(orgId, contestId ?? ''),
    queryFn: ({ signal }) => getContest(contestId ?? '', signal),
    enabled: mode === 'edit' && Boolean(orgId && contestId),
  });
  const loading = mode === 'edit' && hydratedId !== (contestId ?? '');

  useApplyServerRecord(
    mode === 'edit' ? contestQuery.data : undefined,
    contestId ?? '',
    dirty,
    (contest) => {
      setSponsorId(contest.sponsorId);
      setName(contest.name);
      setDescription(contest.description ?? '');
      setImageFileId(contest.imageFileId);
      setInitialImageFileId(contest.imageFileId);
      setHydratedId(contestId ?? '');
      setDirty(false);
    },
  );

  useEffect(() => {
    if (mode !== 'edit' || !contestQuery.isError) return;
    toast.error(
      contestQuery.error instanceof ApiError
        ? contestQuery.error.message
        : 'Could not load contest.',
    );
    closeRef.current(false);
  }, [contestQuery.error, contestQuery.isError, mode]);

  async function requestClose() {
    if (saving) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        description: 'These changes will not be saved.',
        confirmLabel: 'Discard',
        destructive: true,
      });
      if (!ok) return;
    }
    setDirty(false);
    onOpenChange(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading || saving || sponsorsQuery.isPending) return;
    if (!sponsorId) {
      toast.error('Choose a sponsor.');
      return;
    }
    if (!name.trim()) {
      toast.error('Contest name is required.');
      return;
    }
    if (!file && !imageFileId) {
      toast.error('An image is required.');
      return;
    }
    setSaving(true);
    try {
      const nextImageId = file ? await uploadCatalogImage(file) : imageFileId;
      const descriptionValue = description.trim();
      if (mode === 'create') {
        await createContest({
          sponsorId,
          name: name.trim(),
          ...(descriptionValue ? { description: descriptionValue } : {}),
          imageFileId: nextImageId,
        });
        toast.success('Contest created.');
      } else if (contestId) {
        await updateContest(contestId, {
          sponsorId,
          name: name.trim(),
          description: descriptionValue || null,
          ...(file || nextImageId !== initialImageFileId ? { imageFileId: nextImageId } : {}),
        });
        toast.success('Contest updated.');
      }
      allowLeave();
      setDirty(false);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save contest.');
    } finally {
      setSaving(false);
    }
  }

  const isCreate = mode === 'create';
  const formBusy = loading || sponsorsQuery.isPending;

  return (
    <FormDialog
      icon={TrophyIcon}
      size="lg"
      title={isCreate ? 'Add Contest' : 'Edit Contest'}
      description={
        isCreate
          ? 'Each contest belongs to one sponsor. Description is optional.'
          : 'Update this contest’s details and image.'
      }
      busy={saving}
      onOpenChange={(next) => {
        if (!next) void requestClose();
      }}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => void requestClose()}
            disabled={saving}
          >
            Cancel
          </Button>
          <SaveButton form={formId} pending={saving} disabled={formBusy}>
            {isCreate ? 'Save Contest' : 'Update Contest'}
          </SaveButton>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void onSubmit(event)} onChange={() => setDirty(true)}>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>
                Contest name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id={`${formId}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={formBusy || saving}
                placeholder="e.g. Spring Challenge"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-sponsor`}>
                Sponsor <span className="text-destructive">*</span>
              </FieldLabel>
              <Select
                value={sponsorId || undefined}
                disabled={formBusy || saving}
                onValueChange={(value) => {
                  setDirty(true);
                  setSponsorId(value);
                }}
              >
                <SelectTrigger id={`${formId}-sponsor`} className="w-full">
                  <SelectValue placeholder="Choose a sponsor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sponsors.map((sponsor) => (
                      <SelectItem key={sponsor.id} value={sponsor.id}>
                        {sponsor.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`${formId}-description`}>Description</FieldLabel>
            <Textarea
              id={`${formId}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={formBusy || saving}
              placeholder="Optional short summary"
            />
          </Field>
          <CatalogImageField
            id={`${formId}-image`}
            label="Image"
            fileId={imageFileId}
            alt={name ? `${name} image` : 'Contest image'}
            disabled={formBusy || saving}
            required
            compact
            onFile={(next) => {
              setFile(next);
              setDirty(true);
            }}
            onPickExisting={(id) => {
              setFile(null);
              setImageFileId(id);
              setDirty(true);
            }}
            onClear={() => {
              setImageFileId('');
              setDirty(true);
            }}
          />
          <p className="text-xs text-muted-foreground">* Required fields.</p>
        </FieldGroup>
      </form>
    </FormDialog>
  );
}
