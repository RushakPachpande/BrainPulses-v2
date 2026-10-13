import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from '@/contexts/use-theme';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <DropdownMenuItem className="min-h-(--control-h)" onSelect={() => toggle()}>
      {isDark ? <SunIcon /> : <MoonIcon />}
      {label}
    </DropdownMenuItem>
  );
}
