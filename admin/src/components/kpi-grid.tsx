import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function KpiGrid({
  items,
}: {
  items: ReadonlyArray<readonly [string, string, string, number]>;
}) {
  return (
    <section
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2',
        items.length > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4',
      )}
    >
      {items.map(([label, value, delta, tint]) => (
        <Card key={label} data-tint={tint}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl">{value}</CardTitle>
          </CardHeader>
          {delta ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">{delta}</p>
            </CardContent>
          ) : null}
        </Card>
      ))}
    </section>
  );
}
