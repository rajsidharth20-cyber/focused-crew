import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Users, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups, fetchProfiles, memberName, type MemberProfile } from '@/hooks/use-study-groups';
import { useLiveStudy } from '@/hooks/use-live-study';

const elapsed = (since?: string | null) => {
  if (!since) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/**
 * Shows the groups the user has joined and which members are studying right now.
 * Used inside the full-screen study mode.
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

  const totalLive = allMemberIds.filter(id => id !== user?.id && isUserLive(id)).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground">Studying now</h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-primary">
          <Radio className="w-3.5 h-3.5" />
          {totalLive} live
        </span>
      </div>

      {groups.length === 0 && (
        <div className="glass-card p-4 text-[12.5px] text-muted-foreground">
          Join a study group to see who else is grinding right now.
        </div>
      )}

      <div className="space-y-3">
        {groups.map(g => {
          const members = (membersByGroup[g.id] ?? []).filter(id => id !== user?.id);
          const live = members.filter(id => isUserLive(id));
          const idle = members.filter(id => !isUserLive(id));
          return (
            <div key={g.id} className="glass-card p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <p className="text-[13px] font-semibold truncate flex-1">{g.name}</p>
                <span className="text-[11px] text-muted-foreground">
                  {live.length}/{members.length} studying
                </span>
              </div>

              {live.length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground">No one is studying in this group yet.</p>
              ) : (
                <ul className="space-y-2">
                  {live.map(id => {
                    const p = presence[id];
                    return (
                      <li key={id} className="flex items-center gap-2.5">
                        <span className="relative">
                          <UserAvatar src={profiles[id]?.avatar_url} name={memberName(profiles[id])} className="w-8 h-8" />
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-background animate-pulse" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium truncate">{memberName(profiles[id])}</p>
                          <p className="text-[10.5px] text-muted-foreground truncate">
                            {p?.topic || p?.mode || 'Focusing'}
                            {elapsed(p?.started_at) ? ` · ${elapsed(p?.started_at)}` : ''}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {idle.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
                  <div className="flex -space-x-2">
                    {idle.slice(0, 6).map(id => (
                      <UserAvatar
                        key={id}
                        src={profiles[id]?.avatar_url}
                        name={memberName(profiles[id])}
                        className="w-6 h-6 opacity-50 border border-background"
                      />
                    ))}
                  </div>
                  <span className="text-[10.5px] text-muted-foreground">{idle.length} offline</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
