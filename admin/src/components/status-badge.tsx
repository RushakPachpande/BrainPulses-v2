import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/utils/tone";

export function StatusBadge({ value }: { value: string }) {
  const tone = statusTone(value);
  return (
    <Badge variant="outline" data-tone={tone || undefined}>
      {value}
    </Badge>
  );
}
