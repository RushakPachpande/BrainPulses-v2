import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeftIcon } from 'lucide-react';
import { CatalogImageField } from '@/components/catalog-image-field';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAuth } from '@/contexts/auth-context';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { useOrgId } from '@/hooks/use-org-id';
import { ApiError } from '@/lib/api-client';
import { canMutateOrg } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import {
  createContest,
  getContest,
  getSponsors,
  updateContest,
  uploadCatalogImage,
} from '@/services';

export function ContestFormPage({ mode }: { mode: 'create' | 'edit' | 'view' }) {
  const { contestId = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const orgId = useOrgId();
  const canEdit = canMutateOrg(auth.status === 'authenticated' ? auth.membership : null);
  const readOnly = mode === 'view';
  const [sponsorId, setSponsorId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFileId, setImageFileId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(!readOnly && dirty);

  const sponsorsQuery = useQuery({
    queryKey: adminQueryKeys.sponsors(orgId),
    queryFn: () => getSponsors(),
    enabled: Boolean(orgId),
  });
  const sponsors = sponsorsQuery.data ?? [];

  useEffect(() => {
    if (mode === 'create') return;
    let cancelled = false;
    void (async () => {
      try {
        const contest = await getContest(contestId);
        if (cancelled) return;
        setSponsorId(contest.sponsorId);
        setName(contest.name);
        setDescription(contest.description ?? '');
        setImageFileId(contest.imageFileId);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load contest.');
        void navigate('/contests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contestId, mode, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
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
      } else {
        await updateContest(contestId, {
          sponsorId,
          name: name.trim(),
          description: descriptionValue || null,
          ...(file ? { imageFileId: nextImageId } : {}),
        });
        toast.success('Contest updated.');
      }
      allowLeave();
      void navigate('/contests');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save contest.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || sponsorsQuery.isPending) return <FormPageSkeleton fields={4} />;

  const title =
    mode === 'create' ? 'Add Contest' : mode === 'edit' ? 'Edit Contest' : 'View Contest';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-1">
            <Link to="/contests">
              <ArrowLeftIcon data-icon="inline-start" /> Back to contests
            </Link>
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readOnly
              ? 'Contest profile (read-only).'
              : 'Each contest belongs to one sponsor. Description is optional.'}
          </p>
        </div>
        {mode === 'view' && canEdit ? (
          <Button asChild>
            <Link to={`/contests/${contestId}/edit`}>Edit</Link>
          </Button>
        ) : null}
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Contest information</CardTitle>
          <CardDescription>
            {readOnly
              ? 'Details for this contest.'
              : 'Required fields must be completed before saving.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={(event) => void onSubmit(event)} onChange={() => setDirty(true)}>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="contest-name">
                    Contest name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="contest-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    disabled={readOnly}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contest-sponsor">
                    Sponsor <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    value={sponsorId || undefined}
                    disabled={readOnly}
                    onValueChange={(value) => {
                      setDirty(true);
                      setSponsorId(value);
                    }}
                  >
                    <SelectTrigger id="contest-sponsor" className="w-full">
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
                <FieldLabel htmlFor="contest-description">Description</FieldLabel>
                <Textarea
                  id="contest-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={readOnly}
                />
              </Field>
              <CatalogImageField
                id="contest-image"
                label="Image"
                fileId={imageFileId}
                alt={name ? `${name} image` : 'Contest image'}
                disabled={readOnly}
                required
                onFile={setFile}
              />
              {!readOnly ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void navigate('/contests')}
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
