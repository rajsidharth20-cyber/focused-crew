const STORAGE_KEY = 'fc:day-start-hour';
const DEFAULT_HOUR = 3;

let dayStartHour = (() => {
  if (typeof localStorage === 'undefined') return DEFAULT_HOUR;
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(raw) && raw >= 0 && raw <= 11 ? raw : DEFAULT_HOUR;
})();

const listeners = new Set<(h: number) => void>();

/** The hour (0–11) at which a new day begins for this user. */
export function getDayStartHour(): number {
  return dayStartHour;
}

export function setDayStartHour(hour: number) {
  const clamped = Math.min(11, Math.max(0, Math.round(hour)));
  if (clamped === dayStartHour) return;
  dayStartHour = clamped;
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    /* ignore */
  }
  listeners.forEach(l => l(clamped));
}

export function subscribeDayStartHour(fn: (h: number) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Turns any timestamp into the planner day it belongs to (YYYY-MM-DD). */
export function dayKeyFor(date: Date): string {
  const d = new Date(date);
  if (d.getHours() < dayStartHour) d.setDate(d.getDate() - 1);
  return key(d);
}

/**
 * Returns "today's" date string (YYYY-MM-DD) using the user's chosen day start hour.
 * Before that hour, we still consider it the previous day.
 */
export function getEffectiveToday(): string {
  return dayKeyFor(new Date());
}
