import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useContainerNarrow } from '@/hooks/use-container-narrow';
import { cn } from '@/lib/utils';

function ScreenReaderLabel({ children }: { children: string }) {
  return <span className="sr-only">{children}</span>;
}

/** Full-screen session bootstrap (login redirect gate). */
export function AuthLoadingSkeleton() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <ScreenReaderLabel>Loading session</ScreenReaderLabel>
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-(--control-h) w-full rounded-lg" />
        <Skeleton className="h-(--control-h) w-full rounded-lg" />
        <Skeleton className="h-(--control-h) w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Suspense fallback inside the admin shell. */
export function RouteLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <ScreenReaderLabel>Loading page</ScreenReaderLabel>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <ScreenReaderLabel>Loading dashboard</ScreenReaderLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-14" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex justify-between gap-4">
                <Skeleton className="h-4 w-2/3 max-w-64 flex-1" />
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-(--control-h) w-36 rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type ListPageSkeletonProps = {
  columns?: number;
  rows?: number;
  kpiCount?: number;
  className?: string;
};

/** KPI row + toolbar strip + table ghost rows for list pages. */
export function ListPageSkeleton({
  columns = 6,
  rows = 8,
  kpiCount = 4,
  className,
}: ListPageSkeletonProps) {
  const { narrow, ref } = useContainerNarrow();
  return (
    <div
      ref={ref}
      className={cn('flex flex-col gap-4', className)}
      aria-busy="true"
      aria-live="polite"
    >
      <ScreenReaderLabel>Loading list</ScreenReaderLabel>
      {kpiCount > 0 ? (
        <div
          className={cn(
            'grid grid-cols-1 gap-4 sm:grid-cols-2',
            kpiCount > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4',
          )}
        >
          {Array.from({ length: kpiCount }, (_, i) => (
            <Card key={i}>
              <CardHeader className="gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-12" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-(--control-h) min-w-48 flex-1 rounded-lg sm:max-w-xs" />
        <Skeleton className="h-(--control-h) w-32 rounded-lg" />
        <Skeleton className="h-(--control-h) w-32 rounded-lg" />
        <Skeleton className="ml-auto h-(--control-h) w-28 rounded-lg" />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {narrow ? (
            Array.from({ length: rows }, (_, row) => (
              <div
                key={row}
                className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-4 shrink-0" />
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-(--control-h) w-24 rounded-lg" />
              </div>
            ))
          ) : (
            <>
              <div className="flex gap-3 border-b border-border px-4 py-3">
                {Array.from({ length: columns }, (_, i) => (
                  <Skeleton key={i} className="h-4 flex-1" />
                ))}
              </div>
              {Array.from({ length: rows }, (_, row) => (
                <div
                  key={row}
                  className="flex gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  {Array.from({ length: columns }, (_, col) => (
                    <Skeleton
                      key={col}
                      className={cn(
                        'h-4 flex-1',
                        col === 0 && 'max-w-8',
                        col === columns - 1 && 'max-w-10',
                      )}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function FormPageSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <ScreenReaderLabel>Loading form</ScreenReaderLabel>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-(--control-h) w-full rounded-lg" />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Skeleton className="h-(--control-h) w-24 rounded-lg" />
            <Skeleton className="h-(--control-h) w-28 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Compact card body stub for settings lists. */
export function SettingsListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <ScreenReaderLabel>Loading settings</ScreenReaderLabel>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-6 w-10 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
