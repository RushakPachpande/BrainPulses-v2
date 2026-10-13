import { Bar, BarChart, Cell, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getMonths } from "@/services";

export function BarChartCard({
  title,
  values,
  color,
  caption,
  labels,
  emphasizeLast = true,
}: {
  title: string;
  values: number[];
  color: string;
  caption: string;
  labels?: string[];
  emphasizeLast?: boolean;
}) {
  const axis = labels ?? getMonths();
  const data = values.map((value, index) => ({
    label: axis[index],
    value,
    fill: emphasizeLast && index !== values.length - 1 ? "var(--bar-muted)" : color,
    opacity: emphasizeLast ? 1 : 0.4 + index * 0.12,
  }));
  const config = { value: { label: title, color } } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{caption}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-44 w-full" aria-label={`${title}. ${caption}`}>
          <BarChart data={data} accessibilityLayer>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" radius={6}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.fill} fillOpacity={entry.opacity} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
