export type RangeKey = 'today' | 'next3' | 'week' | 'all';

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'next3', label: 'Next 3 days' },
  { key: 'week', label: 'This week' },
  { key: 'all', label: 'All' },
];

export function rangeDays(key: RangeKey): number {
  if (key === 'today') return 1;
  if (key === 'next3') return 3;
  if (key === 'week') return 7;
  return Infinity;
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The list of upcoming dates (inclusive of today) covered by a range. */
export function windowDates(key: RangeKey, from = new Date()): { isoDates: string[]; dows: number[] } {
  const days = rangeDays(key);
  if (!Number.isFinite(days)) return { isoDates: [], dows: [] };
  const isoDates: string[] = [];
  const dows: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    isoDates.push(toISO(d));
    dows.push(d.getDay());
  }
  return { isoDates, dows };
}

interface ScheduleItem {
  eventDate?: string | null;
  recurringDays?: number[] | null;
}

/** True when the item happens inside the selected range. */
export function matchesRange(item: ScheduleItem, key: RangeKey, from = new Date()): boolean {
  if (key === 'all') return true;
  const { isoDates, dows } = windowDates(key, from);
  if (item.recurringDays && item.recurringDays.length > 0) {
    return item.recurringDays.some(d => dows.includes(d));
  }
  if (item.eventDate) return isoDates.includes(item.eventDate);
  // Undated one-offs belong to today.
  return true;
}
