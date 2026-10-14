import { useState } from 'react';
import { BellIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

type NotificationItem = {
  id: string;
  title: string;
  time: string;
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Priya Patel registered for JEE Mock Series 2026',
    time: '4 min ago',
  },
  {
    id: '2',
    title: 'Weekly GK Quiz published by Meera Joshi',
    time: '16 min ago',
  },
  {
    id: '3',
    title: 'Rohan Mehta completed Aptitude Screening Q4',
    time: '28 min ago',
  },
];

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const dismiss = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    setItems([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          aria-expanded={open}
        >
          <BellIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0" aria-label="Notifications panel">
        <PopoverHeader className="border-b border-border px-3 py-2.5">
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        {items.length === 0 ? (
          <PopoverDescription className="px-3 py-6 text-center">
            No notifications
          </PopoverDescription>
        ) : (
          <ul className="max-h-72 overflow-y-auto py-1" role="list">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 border-b border-border px-2 py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1 px-1 py-0.5">
                  <p className="text-sm leading-snug text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.time}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={`Dismiss ${item.title}`}
                  onClick={() => dismiss(item.id)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={items.length === 0}
            onClick={clearAll}
          >
            Clear all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
