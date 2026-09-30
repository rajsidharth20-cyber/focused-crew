import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type MemberPair = { id?: string; group_id: string; user_id: string };

/** DELETE can carry only an id unless replica identity is FULL. */
export function applyMemberEvent<T extends MemberPair>(
  previous: T[],
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  groups: Set<string>,
): T[] {
  const row = payload.new as T;
  const old = payload.old as Partial<T>;
  const id = old?.id ?? row?.id;
  if (payload.eventType === 'DELETE') {
    if (!id && !(old?.group_id && old?.user_id)) return previous;
    return previous.filter(m => id ? m.id !== id : m.group_id !== old.group_id || m.user_id !== old.user_id);
  }
  if (!row?.group_id || !groups.has(row.group_id)) return previous;
  return [...previous.filter(m => id ? m.id !== id : m.group_id !== row.group_id || m.user_id !== row.user_id), row];
}