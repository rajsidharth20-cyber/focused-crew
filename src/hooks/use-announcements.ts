import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AnnouncementType = 'update' | 'feature' | 'maintenance' | 'important' | 'event';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  short_description: string | null;
  type: AnnouncementType;
  is_important: boolean;
  image_url: string | null;
  action_text: string | null;
  action_url: string | null;
  is_published: boolean;
  published_at: string | null;
  scheduled_for: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const ANNOUNCEMENT_TYPES: AnnouncementType[] = [
  'update',
  'feature',
  'maintenance',
  'important',
  'event',
];

export const TYPE_LABEL: Record<AnnouncementType, string> = {
  update: 'Update',
  feature: 'New feature',
  maintenance: 'Maintenance',
  important: 'Important',
  event: 'Event',
};

const liveFilter = <T extends { is_published: boolean }>(rows: Announcement[]) =>
  rows.filter(a => {
    const at = a.scheduled_for ?? a.published_at ?? a.created_at;
    return a.is_published && new Date(at).getTime() <= Date.now();
  });

/** True when the signed-in user is an admin (can manage announcements). */
export function useIsStaff() {
  const { user, isGuest } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['is-staff', user?.id],
    enabled: !!user && !isGuest,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id);
      return (data ?? []).some(r => r.role === 'admin' || r.role === 'moderator');
    },
  });
  return { isStaff: !!data, loading: isLoading };
}

/** IDs of announcements the current user has already read. */
export function useReadIds() {
  const { user, isGuest } = useAuth();
  return useQuery({
    queryKey: ['announcement-reads', user?.id],
    enabled: !!user && !isGuest,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('announcement_reads').select('announcement_id');
      return new Set((data ?? []).map(r => r.announcement_id as string));
    },
  });
}

/** Only the latest live announcement — used by the Home screen. */
export function useLatestAnnouncement() {
  const { user, isGuest } = useAuth();
  return useQuery({
    queryKey: ['announcement-latest'],
    enabled: !!user && !isGuest,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return liveFilter((data ?? []) as Announcement[])[0] ?? null;
    },
  });
}

export const PAGE_SIZE = 15;

/** Paginated history of live announcements. */
export function useAnnouncementHistory(page: number) {
  const { user, isGuest } = useAuth();
  return useQuery({
    queryKey: ['announcement-history', page],
    enabled: !!user && !isGuest,
    staleTime: 60_000,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const { data, error, count } = await supabase
        .from('announcements')
        .select('*', { count: 'exact' })
        .eq('is_published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: liveFilter((data ?? []) as Announcement[]), total: count ?? 0 };
    },
  });
}

export function useAnnouncement(id?: string) {
  return useQuery({
    queryKey: ['announcement', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('announcements').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Announcement | null;
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  return useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user || isGuest) return;
      await supabase
        .from('announcement_reads')
        .upsert({ announcement_id: announcementId, user_id: user.id }, { onConflict: 'announcement_id,user_id' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcement-reads'] }),
  });
}

/* ------------------------------- admin ------------------------------- */

export function useAllAnnouncements() {
  const { isStaff } = useIsStaff();
  return useQuery({
    queryKey: ['announcements-admin'],
    enabled: isStaff,
    queryFn: async () => {
      const [{ data, error }, counts] = await Promise.all([
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.rpc('announcement_read_counts'),
      ]);
      if (error) throw error;
      const map = new Map<string, number>(
        ((counts.data ?? []) as { announcement_id: string; read_count: number }[]).map(r => [
          r.announcement_id,
          Number(r.read_count),
        ])
      );
      return ((data ?? []) as Announcement[]).map(a => ({ ...a, read_count: map.get(a.id) ?? 0 }));
    },
  });
}

export type AnnouncementInput = Partial<Announcement> & { title: string; content: string };

export function useSaveAnnouncement() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: AnnouncementInput }) => {
      if (id) {
        const { error } = await supabase.from('announcements').update(values).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert({ ...values, created_by: user!.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements-admin'] });
      qc.invalidateQueries({ queryKey: ['announcement-latest'] });
      qc.invalidateQueries({ queryKey: ['announcement-history'] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements-admin'] });
      qc.invalidateQueries({ queryKey: ['announcement-latest'] });
    },
  });
}

export function statusOf(a: Announcement): 'Published' | 'Scheduled' | 'Draft' {
  if (!a.is_published) return 'Draft';
  const at = a.scheduled_for ?? a.published_at ?? a.created_at;
  return new Date(at).getTime() > Date.now() ? 'Scheduled' : 'Published';
}
