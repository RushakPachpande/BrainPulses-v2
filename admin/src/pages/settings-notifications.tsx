import { StatusBadge } from "@/components/status-badge";
import { ToggleRow } from "@/components/toggle-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getNotifications } from "@/services";

export function NotificationSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {getNotifications().map(([title, hint, on], index) => (
          <Card key={title} data-tint={index % 5}>
            <CardContent className="flex flex-col gap-4">
              <ToggleRow label={title} hint={hint} defaultOn={on} />
              <div className="flex flex-wrap gap-2">
                <StatusBadge value="Email" />
                <StatusBadge value="In-app" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="button">Save Changes</Button>
      </div>
    </div>
  );
}
