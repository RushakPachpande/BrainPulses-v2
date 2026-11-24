import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, ClipboardListIcon } from 'lucide-react';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrgId } from '@/hooks/use-org-id';
import { adminQueryKeys, STALE_MS } from '@/lib/query-keys';
import { getContests, getSponsors } from '@/services';
import { getContestFormOverview } from '@/services/contest-forms';

/** Step 0: pick the sponsor, then the contest. One registration form per contest. */
export function ContestFormCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const orgId = useOrgId();
  const navigate = useNavigate();
  const [sponsorId, setSponsorId] = useState('');
  const [contestId, setContestId] = useState('');
  const sponsors = useQuery({
    queryKey: adminQueryKeys.sponsors(orgId),
    queryFn: ({ signal }) => getSponsors(signal),
    enabled: Boolean(orgId) && open,
    staleTime: STALE_MS,
  });
  const contests = useQuery({
    queryKey: adminQueryKeys.contests(orgId),
    queryFn: ({ signal }) => getContests(undefined, signal),
    enabled: Boolean(orgId) && open,
    staleTime: STALE_MS,
  });
  const overview = useQuery({
    queryKey: ['admin', 'contest-forms', orgId],
    queryFn: ({ signal }) => getContestFormOverview(signal),
    enabled: Boolean(orgId) && open,
  });
  const taken = new Set((overview.data?.forms ?? []).map((form) => form.contestId));
  const sponsorContests = (contests.data ?? []).filter(
    (contest) => contest.sponsorId === sponsorId,
  );
  const sponsorName = sponsors.data?.find((sponsor) => sponsor.id === sponsorId)?.name;

  function close(next: boolean) {
    if (!next) {
      setSponsorId('');
      setContestId('');
    }
    onOpenChange(next);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      icon={ClipboardListIcon}
      title="Create registration form"
      description="Choose the sponsor, then the contest. One registration form per contest."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!contestId}
            onClick={() => {
              const params = new URLSearchParams({ sponsor: sponsorId, contest: contestId });
              close(false);
              navigate(`/participants/forms/new?${params.toString()}`);
            }}
          >
            Start building
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="create-sponsor">
            Sponsor <span className="text-destructive">*</span>
          </Label>
          <Select
            value={sponsorId || undefined}
            onValueChange={(value) => {
              setSponsorId(value);
              setContestId('');
            }}
          >
            <SelectTrigger id="create-sponsor" className="mt-1 w-full">
              <SelectValue placeholder="Choose a sponsor" />
            </SelectTrigger>
            <SelectContent>
              {(sponsors.data ?? []).map((sponsor) => (
                <SelectItem key={sponsor.id} value={sponsor.id}>
                  {sponsor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="create-contest">
            Contest <span className="text-destructive">*</span>
          </Label>
          <Select value={contestId || undefined} disabled={!sponsorId} onValueChange={setContestId}>
            <SelectTrigger id="create-contest" className="mt-1 w-full">
              <SelectValue
                placeholder={sponsorId ? 'Choose a contest' : 'Choose a sponsor first'}
              />
            </SelectTrigger>
            <SelectContent>
              {sponsorContests.map((contest) => (
                <SelectItem key={contest.id} value={contest.id} disabled={taken.has(contest.id)}>
                  {taken.has(contest.id) ? `${contest.name} (already has a form)` : contest.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-sm text-muted-foreground">
            Only {sponsorName || 'that sponsor'}'s contests are listed. These can't change once the
            form is saved.
          </p>
        </div>
      </div>
    </FormDialog>
  );
}
