import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LinkIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusPill } from '@/components/status-pill';
import { ToggleRow } from '@/components/toggle-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { registrationUrl } from '@/lib/contest-form';

/** Live link, QR code, on/off switch and Regenerate. Used on Step 3 and on the form's page. */
export function ContestFormShareCard({
  slug,
  linkActive,
  contestName,
  canMutate,
  busy,
  onLinkActive,
  onRegenerate,
}: {
  slug: string;
  linkActive: boolean;
  contestName: string;
  canMutate: boolean;
  busy?: boolean;
  onLinkActive: (active: boolean) => void;
  onRegenerate: () => void;
}) {
  const link = registrationUrl(slug);
  const [qr, setQr] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const qrAlt = `QR code for the ${contestName || 'registration'} link`;

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(link, { margin: 1, width: 512, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr('');
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  function download() {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `${(contestName || 'registration').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-qr.png`;
    a.click();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="size-4 text-muted-foreground" aria-hidden />
              Registration link
            </CardTitle>
            <CardDescription>
              Share this with people who should register. You can share it before any quiz is given.
            </CardDescription>
          </div>
          <StatusPill
            value={linkActive ? 'Link active' : 'Link turned off'}
            tone={linkActive ? 'ok' : 'er'}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-2 text-sm break-all text-primary">
            {link}
          </code>
          <Button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success('Link copied');
            }}
          >
            <CopyIcon data-icon="inline-start" />
            Copy link
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(link, '_blank', 'noopener')}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            Open as participant
          </Button>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          {qr ? (
            <button
              type="button"
              className="rounded-lg focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Enlarge QR code"
              onClick={() => setQrOpen(true)}
            >
              <img
                src={qr}
                alt={qrAlt}
                className="size-32 rounded-lg border border-border bg-white p-1"
              />
            </button>
          ) : (
            <div className="size-32 rounded-lg border border-dashed border-border" aria-hidden />
          )}
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <p className="font-medium">QR code</p>
            <p className="text-sm text-muted-foreground">
              Scans to this registration page. Print it on posters or show it on a screen. Click the
              code to enlarge.
            </p>
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={!qr}
              onClick={download}
            >
              <DownloadIcon data-icon="inline-start" />
              Download PNG
            </Button>
          </div>
        </div>
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="sm:max-w-md" showCloseButton>
            <DialogHeader>
              <DialogTitle>QR code</DialogTitle>
              <DialogDescription>
                Scans to the registration link for {contestName || 'this form'}.
              </DialogDescription>
            </DialogHeader>
            {qr ? (
              <img
                src={qr}
                alt={qrAlt}
                className="mx-auto size-64 max-w-full rounded-lg border border-border bg-white p-2"
              />
            ) : null}
          </DialogContent>
        </Dialog>
        {canMutate ? (
          <>
            <ToggleRow
              label="Link is active"
              checked={linkActive}
              disabled={busy}
              onCheckedChange={onLinkActive}
            />
            {!linkActive ? (
              <p className="flex gap-2 text-sm text-warning">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                While the link is off, new people can't register. People already registered can
                still log in.
              </p>
            ) : null}
            <div>
              <Button type="button" variant="outline" disabled={busy} onClick={onRegenerate}>
                <RefreshCwIcon data-icon="inline-start" />
                Regenerate link
              </Button>
              <p className="mt-1 text-sm text-muted-foreground">
                Creates a new link; the old one stops working at once.
              </p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
