import { useCallback, useEffect, useState } from 'react';
import { readStorage, writeStorage } from '../storage';

const STORAGE_KEY = 'brainpulses-client-theme';

export type ClientThemeMode = 'dark' | 'light';

export function readClientDark(): boolean {
  return readStorage(STORAGE_KEY) !== 'light';
}

export function applyClientTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  writeStorage(STORAGE_KEY, dark ? 'dark' : 'light');
}

/** Shared dark/light theme for student portal (login + shell). Default is dark. */
export function useClientTheme() {
  const [dark, setDark] = useState(() => readClientDark());

  useEffect(() => {
    applyClientTheme(dark);
  }, [dark]);

  const setTheme = useCallback((mode: ClientThemeMode) => {
    setDark(mode === 'dark');
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => !prev);
  }, []);

  return {
    dark,
    theme: (dark ? 'dark' : 'light') as ClientThemeMode,
    setDark,
    setTheme,
    toggle,
  };
}
