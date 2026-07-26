import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'pwndora-theme';

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;
}

/** Read the stored preference, defaulting to the SOC-standard dark theme. */
export function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private browsing can deny storage; the default still applies.
  }
  return 'dark';
}

/** Apply the stored theme before React mounts, so there is no light flash. */
export function bootstrapTheme(): void {
  apply(initialTheme());
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    apply(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Persistence is a convenience, not a requirement.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggle };
}
