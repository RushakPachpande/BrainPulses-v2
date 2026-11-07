import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemeMode } from '@/contexts/use-theme';
import { readSessionPref, writeSessionPref } from '@/lib/session-prefs';

export type { ThemeMode } from '@/contexts/use-theme';

const STORAGE_KEY = 'brainpulses-theme';

function applyDomTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#081020' : '#fafaff');
}

function loadTheme(): ThemeMode {
  return readSessionPref(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => loadTheme());

  useEffect(() => {
    applyDomTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    writeSessionPref(STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
