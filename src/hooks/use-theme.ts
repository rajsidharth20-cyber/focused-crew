import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppTheme =
  | 'cirrus'
  | 'premium'
  | 'flight'
  | 'war'
  | 'forest'
  | 'ocean'
  | 'mountain'
  | 'cosmos'
  | 'sunset'
  | 'matcha'
  | 'daylight'
  | 'midnight';

export type ThemeMeta = {
  key: AppTheme;
  name: string;
  desc: string;
  emoji: string;
  dark: boolean;
  swatch: [string, string, string];
};

/** Every selectable theme, in display order. */
export const THEMES: ThemeMeta[] = [
  { key: 'forest', name: 'Forest', desc: 'Calm, natural deep focus', emoji: '🌲', dark: true, swatch: ['hsl(150 30% 6%)', 'hsl(152 24% 14%)', 'hsl(140 55% 52%)'] },
  { key: 'ocean', name: 'Ocean', desc: 'Peaceful and refreshing', emoji: '🌊', dark: true, swatch: ['hsl(208 60% 7%)', 'hsl(204 44% 15%)', 'hsl(188 85% 52%)'] },
  { key: 'mountain', name: 'Mountain', desc: 'Disciplined and sharp', emoji: '🏔️', dark: true, swatch: ['hsl(215 22% 10%)', 'hsl(215 16% 19%)', 'hsl(202 80% 62%)'] },
  { key: 'cosmos', name: 'Cosmos', desc: 'Futuristic starlit navy', emoji: '🌌', dark: true, swatch: ['hsl(232 48% 6%)', 'hsl(232 36% 14%)', 'hsl(248 85% 68%)'] },
  { key: 'sunset', name: 'Sunset', desc: 'Warm evening study', emoji: '🌅', dark: true, swatch: ['hsl(18 32% 8%)', 'hsl(16 26% 16%)', 'hsl(20 92% 60%)'] },
  { key: 'matcha', name: 'Matcha', desc: 'Cozy cream and green', emoji: '🍵', dark: false, swatch: ['hsl(44 44% 96%)', 'hsl(96 26% 91%)', 'hsl(132 34% 40%)'] },
  { key: 'daylight', name: 'Daylight', desc: 'Clean, bright, minimal', emoji: '☀️', dark: false, swatch: ['hsl(40 40% 98%)', 'hsl(40 30% 94%)', 'hsl(212 90% 48%)'] },
  { key: 'midnight', name: 'Midnight', desc: 'Pure black, zero noise', emoji: '🌑', dark: true, swatch: ['hsl(0 0% 3%)', 'hsl(0 0% 13%)', 'hsl(0 0% 92%)'] },
  { key: 'cirrus', name: 'Cirrus', desc: 'Soft white & lavender', emoji: '☁️', dark: false, swatch: ['hsl(250 30% 99%)', 'hsl(250 28% 96%)', 'hsl(252 70% 62%)'] },
  { key: 'premium', name: 'Indigo', desc: 'Light indigo', emoji: '✨', dark: false, swatch: ['hsl(228 40% 98%)', 'hsl(228 36% 95%)', 'hsl(231 84% 58%)'] },
  { key: 'flight', name: 'Flight', desc: 'Sky blue cockpit', emoji: '✈️', dark: true, swatch: ['hsl(224 40% 4%)', 'hsl(224 22% 14%)', 'hsl(210 100% 62%)'] },
  { key: 'war', name: 'War', desc: 'Tactical fire ops', emoji: '⚔️', dark: true, swatch: ['hsl(18 25% 4%)', 'hsl(18 15% 13%)', 'hsl(22 100% 55%)'] },
];

const VALID = new Set(THEMES.map(t => t.key));
const STORAGE_KEY = 'task-pilot-theme';
export const DEFAULT_THEME: AppTheme = 'cirrus';

function read(): AppTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as AppTheme | null;
    if (stored && VALID.has(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

let current: AppTheme = read();
const listeners = new Set<(t: AppTheme) => void>();

function apply(theme: AppTheme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = THEMES.find(t => t.key === theme);
  document.documentElement.classList.toggle('dark', !!meta?.dark);
}

apply(current);

/** Set the theme locally (paints instantly) and notify every subscriber. */
export function setThemeLocal(theme: AppTheme) {
  if (!VALID.has(theme)) return;
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  apply(theme);
  listeners.forEach(l => l(theme));
}

export function getTheme(): AppTheme {
  return current;
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(current);

  useEffect(() => {
    listeners.add(setThemeState);
    setThemeState(current);
    return () => {
      listeners.delete(setThemeState);
    };
  }, []);

  // Pull the saved theme from the user's profile so it follows them across devices.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      supabase
        .from('profiles')
        .select('theme')
        .eq('id', uid)
        .maybeSingle()
        .then(({ data: row }) => {
          const saved = (row as { theme?: string | null } | null)?.theme as AppTheme | undefined;
          if (!cancelled && saved && VALID.has(saved)) setThemeLocal(saved);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((t: AppTheme) => {
    setThemeLocal(t);
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from('profiles').update({ theme: t }).eq('id', uid).then(() => {});
    });
  }, []);

  return { theme, setTheme, themes: THEMES };
}
