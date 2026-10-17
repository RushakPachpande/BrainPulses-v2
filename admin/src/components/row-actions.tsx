import { Button } from '@/components/ui/button';

export function RowActions({ viewLabel = 'View' }: { viewLabel?: string }) {
  return (
    <div className="flex items-center">
      <Button type="button" variant="link">
        {viewLabel}
      </Button>
      <Button type="button" variant="link">
        Edit
      </Button>
      <Button type="button" variant="link" aria-label="More actions">
        More
      </Button>
    </div>
  );
}
