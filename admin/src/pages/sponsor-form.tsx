import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon } from 'lucide-react';
import { CatalogImageField } from '@/components/catalog-image-field';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { ApiError } from '@/lib/api-client';
import { canMutateOrg } from '@/lib/access';
import { createSponsor, getSponsor, updateSponsor, uploadCatalogImage } from '@/services';

export function SponsorFormPage({ mode }: { mode: 'create' | 'edit' | 'view' }) {
  const { sponsorId = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const canEdit = canMutateOrg(auth.status === 'authenticated' ? auth.membership : null);
  const readOnly = mode === 'view';
  const [name, setName] = useState('');
  const [imageFileId, setImageFileId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(!readOnly && dirty);

  useEffect(() => {
    if (mode === 'create') return;
    let cancelled = false;
    void (async () => {
      try {
        const sponsor = await getSponsor(sponsorId);
        if (cancelled) return;
        setName(sponsor.name);
        setImageFileId(sponsor.imageFileId);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load sponsor.');
        void navigate('/sponsors');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, navigate, sponsorId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
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
      } else {
        await updateSponsor(sponsorId, {
          name: name.trim(),
          ...(file ? { imageFileId: nextImageId } : {}),
        });
        toast.success('Sponsor updated.');
      }
      allowLeave();
      void navigate('/sponsors');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save sponsor.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FormPageSkeleton fields={3} />;

  const title =
    mode === 'create' ? 'Add Sponsor' : mode === 'edit' ? 'Edit Sponsor' : 'View Sponsor';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-1">
            <Link to="/sponsors">
              <ArrowLeftIcon data-icon="inline-start" /> Back to sponsors
            </Link>
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readOnly ? 'Sponsor profile (read-only).' : 'Name and image are required.'}
          </p>
        </div>
        {mode === 'view' && canEdit ? (
          <Button asChild>
            <Link to={`/sponsors/${sponsorId}/edit`}>Edit</Link>
          </Button>
        ) : null}
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Sponsor information</CardTitle>
          <CardDescription>
            {readOnly
              ? 'Details for this sponsor.'
              : 'Required fields must be completed before saving.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={(event) => void onSubmit(event)} onChange={() => setDirty(true)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="sponsor-name">
                  Sponsor name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="sponsor-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  disabled={readOnly}
                />
              </Field>
              <CatalogImageField
                id="sponsor-image"
                label="Image"
                fileId={imageFileId}
                alt={name ? `${name} image` : 'Sponsor image'}
                disabled={readOnly}
                required
                onFile={setFile}
              />
              {!readOnly ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void navigate('/sponsors')}
                  >
                    Cancel
                  </Button>
                  <SaveButton pending={saving}>Save</SaveButton>
                </div>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
