import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups, fetchProfiles, memberName, type MemberProfile } from '@/hooks/use-study-groups';
import { useLiveStudy } from '@/hooks/use-live-study';

const minutesSince = (since?: string | null) => {
  if (!since) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000));
};

const fmtMins = (mins: number) => (mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`);

/**
 * Compact, ambient "who is studying with me" surface for the immersive study mode.
 * Data comes from the existing group + presence hooks; this file is presentation only.
 */
export function LiveStudyPanel() {
  const { user } = useAuth();
  const { groups } = useMyGroups();
  const [membersByGroup, setMembersByGroup] = useState<Record<string, string[]>>({});
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});

  const groupIds = useMemo(() => groups.map(g => g.id).sort().join(','), [groups]);
  const instanceId = useId();

  const loadMembers = useCallback(async () => {
    const ids = groupIds ? groupIds.split(',') : [];
    if (ids.length === 0) {
      setMembersByGroup({});
      return;
    }
    const { data } = await supabase.from('group_members').select('group_id, user_id').in('group_id', ids);
    const map: Record<string, string[]> = {};
    (data ?? []).forEach(m => {
      (map[m.group_id] ??= []).push(m.user_id);
    });
    setMembersByGroup(map);
    const profs = await fetchProfiles(Array.from(new Set((data ?? []).map(m => m.user_id))));
    setProfiles(prev => ({ ...prev, ...profs }));
  }, [groupIds]);

  useEffect(() => {
    loadMembers();
    if (!groupIds) return;
    // Keep the member list in sync when people join or leave a group.
    const channel = supabase
      .channel(`live-study-members-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => loadMembers())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupIds, loadMembers, instanceId]);

  const allMemberIds = useMemo(
    () => Array.from(new Set(Object.values(membersByGroup).flat())),
    [membersByGroup]
  );
  const { presence, isUserLive } = useLiveStudy(allMemberIds);

  const liveIds = allMemberIds.filter(isUserLive);
  const liveSorted = liveIds
    .slice()
    .sort((a, b) => minutesSince(presence[b]?.started_at) - minutesSince(presence[a]?.started_at));

  const rooms = groups
    .map(g => {
      const members = membersByGroup[g.id] ?? [];
      const live = members.filter(isUserLive);
      const minutes = live.reduce((sum, id) => sum + minutesSince(presence[id]?.started_at), 0);
      return { group: g, members, live, minutes };
    })
    .sort((a, b) => b.live.length - a.live.length || a.group.name.localeCompare(b.group.name));

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Studying now</h2>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-foreground/80">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-primary opacity-70 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-primary" />
            </span>
            {liveSorted.length} studying
          </span>
        </div>

        {liveSorted.length === 0 ? (
          <p className="text-[12px] text-muted-foreground/80">
            {groups.length === 0
              ? 'Join a study room to feel the room fill up around you.'
              : 'Quiet right now — you can be the first one in.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {liveSorted.map((id, i) => {
              const p = presence[id];
              const isMe = id === user?.id;
              return (
                <motion.li
                  key={id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.24) }}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-foreground/[0.04] transition-colors"
                >
                  <span className="relative shrink-0">
                    <UserAvatar
                      src={profiles[id]?.avatar_url}
                      name={memberName(profiles[id])}
                      className="w-8 h-8 ring-1 ring-foreground/10"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate">{isMe ? 'You' : memberName(profiles[id])}</p>
                    {(p?.topic || p?.mode) && (
                      <p className="text-[10.5px] text-muted-foreground truncate">{p?.topic || p?.mode}</p>
                    )}
                  </div>
                  <span className="text-[12px] tabular-nums text-muted-foreground shrink-0">
                    {fmtMins(minutesSince(p?.started_at))}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Study rooms</h2>

        {rooms.length === 0 ? (
          <p className="text-[12px] text-muted-foreground/80">You haven't joined any study rooms yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {rooms.map(({ group, members, live, minutes }) => (
              <motion.li
                key={group.id}
                layout
                whileTap={{ scale: 0.985 }}
                className="flex items-center gap-3 rounded-2xl border border-foreground/[0.07] bg-foreground/[0.03] backdrop-blur px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {live.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                    )}
                    <p className="text-[13px] font-semibold truncate">{group.name}</p>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5 tabular-nums">
                    {live.length} studying{live.length > 0 ? ` · ${fmtMins(minutes)} together` : ` · ${members.length} members`}
                  </p>
                </div>
                <div className="flex -space-x-2 shrink-0">
                  {(live.length > 0 ? live : members).slice(0, 4).map(id => (
                    <UserAvatar
                      key={id}
                      src={profiles[id]?.avatar_url}
                      name={memberName(profiles[id])}
                      className={`w-6 h-6 ring-2 ring-background ${live.includes(id) ? '' : 'opacity-45'}`}
                    />
                  ))}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
