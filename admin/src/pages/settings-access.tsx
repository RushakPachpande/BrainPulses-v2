import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';
import { KeyRoundIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getAccessUsers,
  getPermissions,
  updateMembershipAccess,
  type AccessUser,
} from '@/services';

export function AccessSettingsPage() {
  const [people, setPeople] = useState<AccessUser[]>([]);
  const [permissions, setPermissions] = useState<Awaited<ReturnType<typeof getPermissions>>>([]);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    void getAccessUsers()
      .then(setPeople)
      .catch(() => setPeople([]));
    void getPermissions()
      .then(setPermissions)
      .catch(() => setPermissions([]));
  }, []);

  function toggle(index: number, key: 'assessment' | 'quiz' | 'enabled') {
    setPeople((current) => {
      const next = current.map((person, personIndex) =>
        personIndex === index ? { ...person, [key]: !person[key] } : person,
      );
      const person = next[index];
      if (person?.membershipId) {
        void updateMembershipAccess(person.membershipId, {
          ...(key === 'assessment'
            ? { assessmentAccess: person.assessment ? 'full' : 'none' }
            : {}),
          ...(key === 'quiz' ? { quizAccess: person.quiz ? 'full' : 'none' } : {}),
          ...(key === 'enabled' ? { isActive: person.enabled } : {}),
        }).catch((err) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not update access.');
        });
      }
      return next;
    });
    setChanged(true);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <Card>
          <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UsersIcon className="size-5" />
              </span>
              <div>
                <CardTitle>Administrator access</CardTitle>
                <CardDescription className="mt-1">
                  Control which modules each administrator can access.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 py-2 sm:px-6">
            {people.map((user, index) => (
              <div key={user.email}>
                {index > 0 ? <Separator /> : null}
                <div className="flex min-w-0 flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {user.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{user.name}</p>
                        <StatusBadge value={user.role} />
                        {!user.enabled ? <StatusBadge value="Disabled" /> : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:gap-5 lg:min-w-[330px]">
                    {(['assessment', 'quiz', 'enabled'] as const).map((key) => (
                      <label
                        key={key}
                        className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                      >
                        <span>
                          {key === 'assessment'
                            ? 'Assessments'
                            : key === 'quiz'
                              ? 'Quizzes'
                              : 'Enabled'}
                        </span>
                        <Switch
                          checked={user[key]}
                          onCheckedChange={() => toggle(index, key)}
                          aria-label={`${user.name} ${key}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="px-5 pb-2 pt-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheckIcon className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-base">Role overview</CardTitle>
                  <CardDescription>Built-in access levels</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-5 pb-5 pt-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Super Admin</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Full platform configuration and access management.
                  </p>
                </div>
                <StatusBadge value="Full control" />
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Admin</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Access is limited by module permissions.
                  </p>
                </div>
                <StatusBadge value="Scoped" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/35">
            <CardContent className="flex gap-3 p-4">
              <KeyRoundIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Security note</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  These controls demonstrate the UI state. Enforce all permissions in the backend;
                  hiding a control is not authorization.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
          <CardTitle>Permission matrix</CardTitle>
          <CardDescription>
            Reference view of the capabilities assigned to each built-in role.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="min-w-56 pl-5">
                    Permission
                  </TableHead>
                  <TableHead scope="col">Super Admin</TableHead>
                  <TableHead scope="col">Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="pl-5 font-medium">{item.name}</TableCell>
                    <TableCell>
                      <StatusBadge value={item.superAdmin} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={item.admin} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {changed
            ? 'Access changes are staged locally in this prototype.'
            : 'Review access changes before applying them.'}
        </p>
        <button
          type="button"
          onClick={() => setChanged(false)}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {changed ? 'Mark reviewed' : 'Review complete'}
        </button>
      </div>
    </div>
  );
}
