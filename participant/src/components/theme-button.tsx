import { useClientTheme } from '../hooks/use-client-theme';
import { IconMoon, IconSun } from './portal-icons';

export function ThemeButton({ className = 'thm' }: { className?: string }) {
  const { dark, toggle } = useClientTheme();
  return (
    <button
      className={className}
      type="button"
      title="Light or dark"
      aria-label="Switch between light and dark theme"
      onClick={toggle}
    >
      {dark ? <IconMoon /> : <IconSun />}
    </button>
  );
}
