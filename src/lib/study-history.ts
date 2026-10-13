export const SESSION_COLUMNS = 'id, tag_id, subject_id, topic, type, duration_seconds, planned_seconds, started_at, ended_at, notes, delay_minutes';
export const RECENT_DAYS = 30;
export function recentStudyCutoff(now = new Date()): string {
  const start = new Date(now);
  start.setDate(start.getDate() - RECENT_DAYS);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export function mergeStudySessions<T extends { id: string; startedAt: string }>(older: T[], recent: T[]): T[] {
  const rows = new Map(older.map(row => [row.id, row]));
  recent.forEach(row => rows.set(row.id, row));
  return [...rows.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}