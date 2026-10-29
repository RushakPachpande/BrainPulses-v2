import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Building2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { CatalogImageField } from '@/components/catalog-image-field';
import { FormDialog } from '@/components/form-dialog';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/use-confirm';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { ApiError } from '@/lib/api-client';
import { createSponsor, getSponsor, updateSponsor, uploadCatalogImage } from '@/services';

export function SponsorEditorDialog({
  mode,
  sponsorId,
  onOpenChange,
  onSaved,
}: {
  mode: 'create' | 'edit';
  sponsorId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const formId = useId();
  const confirm = useConfirm();
  const closeRef = useRef(onOpenChange);
  closeRef.current = onOpenChange;
  const [name, setName] = useState('');
  const [imageFileId, setImageFileId] = useState('');
  const [initialImageFileId, setInitialImageFileId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);

  useEffect(() => {
    if (mode !== 'edit' || !sponsorId) return;
    let cancelled = false;
    void (async () => {
      try {
        const sponsor = await getSponsor(sponsorId);
        if (cancelled) return;
        setName(sponsor.name);
        setImageFileId(sponsor.imageFileId);
        setInitialImageFileId(sponsor.imageFileId);
        setDirty(false);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load sponsor.');
        closeRef.current(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, sponsorId]);

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
    if (loading || saving) return;
    if (!name.trim()) {
      toast.error('Sponsor name is required.');
      return;
    }
    if (!file && !imageFileId) {
      toast.error('An image is required.');
      return;
    }
    setSaving(true);
    try {
      const nextImageId = file ? await uploadCatalogImage(file) : imageFileId;
      if (mode === 'create') {
        await createSponsor({ name: name.trim(), imageFileId: nextImageId });
        toast.success('Sponsor created.');
      } else if (sponsorId) {
        await updateSponsor(sponsorId, {
          name: name.trim(),
          ...(file || nextImageId !== initialImageFileId ? { imageFileId: nextImageId } : {}),
        });
        toast.success('Sponsor updated.');
      }
      allowLeave();
      setDirty(false);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save sponsor.');
    } finally {
      setSaving(false);
    }
  }

  const isCreate = mode === 'create';

  return (
    <FormDialog
      icon={Building2Icon}
      size="lg"
      title={isCreate ? 'Add Sponsor' : 'Edit Sponsor'}
      description={
        isCreate ? 'Add a sponsor with a name and image.' : 'Update this sponsor’s name or image.'
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
          <SaveButton form={formId} pending={saving} disabled={loading}>
            {isCreate ? 'Save Sponsor' : 'Update Sponsor'}
          </SaveButton>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void onSubmit(event)} onChange={() => setDirty(true)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${formId}-name`}>
              Sponsor name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id={`${formId}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={loading || saving}
              placeholder="e.g. Northstar Academy"
            />
          </Field>
          <CatalogImageField
            id={`${formId}-image`}
            label="Image"
            fileId={imageFileId}
            alt={name ? `${name} image` : 'Sponsor image'}
            disabled={loading || saving}
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
