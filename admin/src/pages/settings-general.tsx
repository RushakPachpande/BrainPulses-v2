import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';
import { Building2Icon, CheckCircle2Icon, ImageIcon, SaveIcon, XIcon } from 'lucide-react';
import { CatalogImageField } from '@/components/catalog-image-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { useApplyServerRecord } from '@/hooks/use-apply-server-record';
import { useOrgId } from '@/hooks/use-org-id';
import { canManageUsersOrSettings } from '@/lib/access';
import { adminQueryKeys } from '@/lib/query-keys';
import { getSettingsGroup, patchSettingsGroup, uploadCatalogImage } from '@/services';

const initialSettings = {
  platformName: 'BrainPulses',
  organization: 'BrainPulses Learning Pvt. Ltd.',
};

function SettingField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Field className="gap-2">
      <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </Field>
  );
}

export function GeneralSettingsPage() {
  const auth = useAuth();
  const orgId = useOrgId();
  const membership = auth.status === 'authenticated' ? auth.membership : null;
  const canManage = canManageUsersOrSettings(membership);
  const [settings, setSettings] = useState(initialSettings);
  const [loginImageFileId, setLoginImageFileId] = useState('');
  const [loginImageFile, setLoginImageFile] = useState<File | null>(null);
  const [loginImageEpoch, setLoginImageEpoch] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const settingsQuery = useQuery({
    queryKey: adminQueryKeys.settings(orgId),
    queryFn: ({ signal }) => getSettingsGroup('general', signal),
    enabled: Boolean(orgId),
  });

  useApplyServerRecord(settingsQuery.data, orgId, touched, ({ values }) => {
    setSettings((current) => ({
      ...current,
      platformName: String(values.orgDisplayName ?? current.platformName),
      organization: String(values.organizationName ?? current.organization),
    }));
    setLoginImageFileId(
      typeof values.participantLoginImageFileId === 'string'
        ? values.participantLoginImageFileId
        : '',
    );
  });

  function update(key: keyof typeof initialSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
    setTouched(true);
    setSaved(false);
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      let participantLoginImageFileId: string | null = loginImageFileId.trim()
        ? loginImageFileId.trim()
        : null;
      if (loginImageFile) {
        participantLoginImageFileId = await uploadCatalogImage(loginImageFile);
      }
      await patchSettingsGroup('general', {
        orgDisplayName: settings.platformName,
        organizationName: settings.organization,
        participantLoginImageFileId,
      });
      setLoginImageFileId(participantLoginImageFileId ?? '');
      setLoginImageFile(null);
      setLoginImageEpoch((epoch) => epoch + 1);
      setTouched(false);
      setSaved(true);
      toast.success('General settings saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }
  function reset() {
    setSettings(initialSettings);
    setLoginImageFileId('');
    setLoginImageFile(null);
    setLoginImageEpoch((epoch) => epoch + 1);
    setTouched(true);
    setSaved(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5">
      <Card className="bg-muted/35">
        <CardContent className="flex gap-3 p-4 sm:items-center">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
            <CheckCircle2Icon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Workspace defaults</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Organization name is used when choosing an organization. The login image is shown on
              the participant sign-in screen.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2Icon className="size-5" />
            </span>
            <div>
              <CardTitle>Organization details</CardTitle>
              <CardDescription className="mt-1">
                Set the name and identity used throughout your workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          <FieldGroup className="gap-5 md:grid md:grid-cols-2 md:gap-x-5">
            <SettingField
              label="Platform name"
              hint="Shown on the organization chooser as product branding."
            >
              <Input
                value={settings.platformName}
                onChange={(e) => update('platformName', e.target.value)}
                autoComplete="organization-title"
                required
              />
            </SettingField>
            <SettingField
              label="Organization name"
              hint="Shown when choosing an organization after sign-in."
            >
              <Input
                value={settings.organization}
                onChange={(e) => update('organization', e.target.value)}
                autoComplete="organization"
                required
              />
            </SettingField>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="size-5" />
            </span>
            <div>
              <CardTitle>Participant login image</CardTitle>
              <CardDescription className="mt-1">
                Shown to the left of the participant sign-in card. It keeps its own shape, up to a
                maximum size, and stacks above the card on a phone. Clear it to hide the image.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          <CatalogImageField
            key={loginImageEpoch}
            id="participant-login-image"
            label="Login image"
            fileId={loginImageFileId}
            alt="Participant login image"
            disabled={!canManage || saving}
            required={false}
            onFile={(next) => {
              setLoginImageFile(next);
              setSaved(false);
            }}
            onPickExisting={(id) => {
              setLoginImageFile(null);
              setLoginImageFileId(id);
              setSaved(false);
            }}
            onClear={() => {
              setLoginImageFileId('');
              setLoginImageFile(null);
              setSaved(false);
            }}
          />
        </CardContent>
      </Card>
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-h-5 text-sm" aria-live="polite">
          {saved ? (
            <span className="inline-flex items-center gap-2 text-emerald-600">
              <CheckCircle2Icon className="size-4" /> Changes saved.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Changes are saved to the organization settings API.
            </span>
          )}
        </div>
        <div className="flex justify-end gap-2">
          {canManage ? (
            <>
              <Button type="button" variant="outline" onClick={reset}>
                <XIcon data-icon="inline-start" /> Reset
              </Button>
              <Button type="submit" disabled={saving}>
                <SaveIcon data-icon="inline-start" /> Save changes
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">View only — settings cannot be changed.</p>
          )}
        </div>
      </div>
    </form>
  );
}
