import { useState, useEffect } from 'react';

export type AppTheme = 'flight' | 'war' | 'premium';

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    return (localStorage.getItem('task-pilot-theme') as AppTheme) || 'flight';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('task-pilot-theme', theme);
  }, [theme]);

  // Apply on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  const setTheme = (t: AppTheme) => setThemeState(t);

  return { theme, setTheme };
}
