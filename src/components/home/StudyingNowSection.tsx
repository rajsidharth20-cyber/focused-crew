import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { useFriends, socialName } from '@/hooks/use-friends';
import { useMyGroups, fetchProfiles, memberName, type MemberProfile } from '@/hooks/use-study-groups';
import { useLiveStudy } from '@/hooks/use-live-study';
import { useNow } from '@/hooks/use-now';

const fmtClock = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const h = Math.floor(m / 60);
  return h > 0
    ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Social heart of the home screen: friends and group mates who are studying
 * right now, with live-synchronised elapsed times.
 */
export function StudyingNowSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { friends, profiles: friendProfiles } = useFriends();
  const { groups } = useMyGroups();
  const [groupProfiles, setGroupProfiles] = useState<Record<string, MemberProfile>>({});
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const instanceId = useId();
  const now = useNow(1000);

  const groupIds = useMemo(() => groups.map(g => g.id).sort().join(','), [groups]);

  const loadMembers = useCallback(async () => {
    const ids = groupIds ? groupIds.split(',') : [];
    if (ids.length === 0) {
      setGroupMemberIds([]);
      return;
    }
    const { data } = await supabase.from('group_members').select('user_id').in('group_id', ids);
    const unique = Array.from(new Set((data ?? []).map(m => m.user_id)));
    setGroupMemberIds(unique);
    setGroupProfiles(await fetchProfiles(unique));
  }, [groupIds]);

  useEffect(() => {
    loadMembers();
    if (!groupIds) return;
    const channel = supabase
      .channel(`home-live-members-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => loadMembers())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupIds, loadMembers, instanceId]);

  const watchIds = useMemo(
    () => Array.from(new Set([...friends, ...groupMemberIds])).filter(id => id !== user?.id),
    [friends, groupMemberIds, user],
  );

  const { presence, isUserLive } = useLiveStudy(watchIds);

  const nameFor = (id: string) =>
    friendProfiles[id] ? socialName(friendProfiles[id]) : memberName(groupProfiles[id]);
  const avatarFor = (id: string) => friendProfiles[id]?.avatar_url ?? groupProfiles[id]?.avatar_url;

  const live = watchIds
    .filter(isUserLive)
    .map(id => {
      const p = presence[id];
      const started = p?.started_at ? new Date(p.started_at).getTime() : now.getTime();
      return { id, p, seconds: Math.max(0, (now.getTime() - started) / 1000) };
    })
    .sort((a, b) => b.seconds - a.seconds);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Studying now</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          {live.length} online
        </span>
      </div>

      {live.length === 0 ? (
        <button
          onClick={() => navigate('/social')}
          className="press flex w-full items-center gap-3 rounded-[24px] border border-dashed border-border/70 bg-secondary/30 px-4 py-5 text-left"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-primary">
            <Users className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium">Nobody's studying right now</span>
            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
              Find friends or join a study room to see them live here.
            </span>
          </span>
        </button>
      ) : (
        <ul className="space-y-2">
          {live.map(({ id, p, seconds }, i) => (
            <motion.li
              key={id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.24) }}
            >
              <button
                onClick={() => navigate(`/u/${id}`)}
                className="press flex w-full items-center gap-3 rounded-[22px] border border-border/50 bg-card/70 px-3.5 py-3 text-left backdrop-blur"
              >
                <UserAvatar src={avatarFor(id)} name={nameFor(id)} live className="h-10 w-10" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold leading-tight">{nameFor(id)}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                    {p?.topic || p?.mode || 'Studying'}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtClock(seconds)}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
