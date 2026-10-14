import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from '@/contexts/use-theme';
import { Button } from '@/components/ui/button';

/** Brand-aligned circular reveal theme toggle, with a graceful non-View-Transitions fallback. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const transitioningRef = useRef(false);
  const [transitioning, setTransitioning] = useState(false);
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  const toggle = useCallback(() => {
    const button = buttonRef.current;
    if (!button || transitioningRef.current) return;

    const nextTheme = isDark ? 'light' : 'dark';
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startViewTransition = (document as Document & {
      startViewTransition?: (callback: () => void) => { ready?: Promise<void>; finished?: Promise<void> };
    }).startViewTransition;

    const applyTheme = () => {
      // Update the class before React commits so the View Transition captures the new palette atomically.
      root.classList.toggle('dark', nextTheme === 'dark');
      root.style.colorScheme = nextTheme;
      flushSync(() => setTheme(nextTheme));
    };
    if (reducedMotion || typeof startViewTransition !== 'function') {
      applyTheme();
      return;
    }

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const point = `${(x / window.innerWidth) * 100}% ${(y / window.innerHeight) * 100}%`;
    const radiusPercent = (radius / (Math.hypot(window.innerWidth, window.innerHeight) / Math.SQRT2)) * 100;

    transitioningRef.current = true;
    setTransitioning(true);
    root.dataset.bpThemeTransition = 'active';
    root.style.setProperty('--bp-theme-transition-duration', '460ms');
    root.style.setProperty('--bp-theme-clip-from', `circle(0% at ${point})`);

    const transition = startViewTransition.call(document, applyTheme);
    transition.ready?.then(() => {
      root.animate(
        {
          clipPath: [`circle(0% at ${point})`, `circle(${radiusPercent}% at ${point})`],
        },
        { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => undefined);

    const cleanup = () => {
      delete root.dataset.bpThemeTransition;
      root.style.removeProperty('--bp-theme-transition-duration');
      root.style.removeProperty('--bp-theme-clip-from');
      transitioningRef.current = false;
      setTransitioning(false);
    };
    transition.finished?.then(cleanup, cleanup);
  }, [isDark, setTheme]);

  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      disabled={transitioning}
      className="theme-toggle"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
