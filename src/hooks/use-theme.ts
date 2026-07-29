import { useState, useEffect } from 'react';

export type AppTheme = 'cirrus' | 'flight' | 'war' | 'premium';

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const stored = localStorage.getItem('task-pilot-theme') as AppTheme | null;
    return stored ?? 'cirrus';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('task-pilot-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  const setTheme = (t: AppTheme) => setThemeState(t);

  return { theme, setTheme };
}
